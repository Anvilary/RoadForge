"""Public roadmap publication lifecycle."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.main import create_app
from api.models.roadmap import Participant
from api.shared.security import rate_limit_service
from api.shared.security.rate_limit_service import (
    RATE_LIMIT_POLICIES,
    MemoryRateLimiter,
)
from tests.conftest import _test_session_factory, create_roadmap
from tests.test_auth_and_share_links import _auth, _join, _rotate_link

pytestmark = pytest.mark.asyncio

_PRIVATE_PHASES = [
    {
        "id": "ph-1",
        "num": "01",
        "name": "Build",
        "color": "#336699",
        "status": "active",
        "progress": 0,
        "tasks": [
            {
                "id": "task-1",
                "title": "Public task",
                "done": False,
                "desc": "Private description",
                "est": "hidden-estimate",
                "assignees": ["Private Person"],
                "claimedBy": "Private Person",
                "claimedById": "pt_secret",
                "tags": ["launch"],
                "complexity": "low",
                "links": [
                    {
                        "id": "link-1",
                        "provider": "github",
                        "kind": "issue",
                        "url": "https://github.com/anvilary/roadforge/issues/601",
                        "owner": "anvilary",
                        "repo": "roadforge",
                        "number": 601,
                        "label": "Private issue",
                    }
                ],
            },
            {
                "id": "task-2",
                "title": "Public subtask",
                "done": True,
                "parentId": "task-1",
                "deps": ["task-1"],
            },
        ],
    }
]


def _public_url(public_id: str) -> str:
    return f"/api/public/roadmaps/{public_id}"


async def _publish(client: AsyncClient, roadmap_id: str, token: str):
    return await client.post(
        f"/api/roadmaps/{roadmap_id}/publication",
        headers=_auth(token),
    )


async def _put_phases(client: AsyncClient, body: dict, token: str, phases: list) -> dict:
    response = await client.put(
        f"/api/roadmaps/{body['id']}",
        headers=_auth(token),
        json={"phases": phases, "last_updated_at": body["updated_at"]},
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_owner_can_publish_and_anonymous_visitor_reads_allowlist(client: AsyncClient):
    created = await create_roadmap(client, name="Community roadmap")
    token = created["owner_session_token"]
    created = await _put_phases(client, created, token, _PRIVATE_PHASES)
    created["owner_session_token"] = token
    published = await _publish(client, created["id"], token)
    assert published.status_code == 200, published.text
    status = published.json()
    assert status["status"] == "published"
    assert status["public_id"].startswith("pub_")
    assert status["viewer_url"].endswith(f"/p/{status['public_id']}")
    assert status["embed_url"].endswith(f"/embed/{status['public_id']}")
    assert status["image_url"].endswith(f"/api/public/roadmaps/{status['public_id']}/preview.png")
    assert status["markdown"].startswith("[![Community roadmap](")
    assert "<iframe" in status["embed_html"]
    assert "Descriptions, estimates, and assignees" in status["private_fields"]
    assert created["owner_session_token"] not in published.text

    anonymous = await client.get(_public_url(status["public_id"]))
    assert anonymous.status_code == 200, anonymous.text
    body = anonymous.text
    payload = anonymous.json()
    assert payload["title"] == "Community roadmap"
    assert payload["phases"][0]["tasks"][1]["parent_id"] == "task-1"
    assert payload["phases"][0]["tasks"][1]["depends_on"] == ["task-1"]
    assert payload["done_count"] == 1
    assert "Private description" not in body
    assert "Private Person" not in body
    assert "hidden-estimate" not in body
    assert "github.com" not in body
    assert "owner_session_token" not in payload
    assert created["id"] not in body
    assert anonymous.headers["cache-control"] == "public, max-age=15"
    assert anonymous.headers["etag"]

    image = await client.get(f"{_public_url(status['public_id'])}/preview.png")
    assert image.status_code == 200
    assert image.headers["content-type"].startswith("image/png")
    assert image.content.startswith(b"\x89PNG")
    assert image.headers["cache-control"] == "public, max-age=60"
    assert b"Private description" not in image.content

    cached = await client.get(
        _public_url(status["public_id"]),
        headers={"If-None-Match": anonymous.headers["etag"]},
    )
    assert cached.status_code == 304


async def test_editor_viewer_and_anonymous_cannot_publish(client: AsyncClient):
    created = await create_roadmap(client)
    roadmap_id = created["id"]
    owner = created["owner_session_token"]

    missing = await client.post(f"/api/roadmaps/{roadmap_id}/publication")
    assert missing.status_code == 401

    for role in ("editor", "viewer"):
        invite = await _rotate_link(client, roadmap_id, owner, role)
        joined = await _join(client, invite, role)
        assert joined.status_code == 200, joined.text
        denied = await _publish(client, roadmap_id, joined.json()["session_token"])
        assert denied.status_code == 403, denied.text


async def test_unpublish_republish_and_delete_stop_public_access(
    client: AsyncClient,
    db_session: AsyncSession,
):
    created = await create_roadmap(client, name="Revocable")
    first = (await _publish(client, created["id"], created["owner_session_token"])).json()
    old_id = first["public_id"]

    unpublished = await client.delete(
        f"/api/roadmaps/{created['id']}/publication",
        headers=_auth(created["owner_session_token"]),
    )
    assert unpublished.status_code == 200
    assert unpublished.json()["status"] == "unpublished"
    assert unpublished.json()["public_id"] is None
    hidden = await client.get(_public_url(old_id))
    assert hidden.status_code == 404
    assert hidden.json()["detail"] == "Published roadmap not found"
    assert hidden.headers["cache-control"] == "no-store"

    unknown = await client.get(_public_url("pub_" + "a" * 22))
    assert unknown.status_code == 404
    assert unknown.json() == hidden.json()
    malformed = await client.get("/api/public/roadmaps/not-a-publication")
    assert malformed.status_code == 404
    assert malformed.json() == hidden.json()

    second = (await _publish(client, created["id"], created["owner_session_token"])).json()
    assert second["public_id"] != old_id
    assert (await client.get(_public_url(old_id))).status_code == 404
    assert (await client.get(_public_url(second["public_id"]))).status_code == 200

    participant = await db_session.scalar(
        select(Participant).where(
            Participant.roadmap_id == created["id"],
            Participant.role == "owner",
        )
    )
    assert participant is not None
    participant.revoked_at = datetime.now(timezone.utc)
    await db_session.flush()
    revoked = await _publish(client, created["id"], created["owner_session_token"])
    assert revoked.status_code == 401

    participant.revoked_at = None
    await db_session.flush()
    visible = second["public_id"]
    deleted = await client.delete(
        f"/api/roadmaps/{created['id']}",
        headers=_auth(created["owner_session_token"]),
    )
    assert deleted.status_code == 200, deleted.text
    assert (await client.get(_public_url(visible))).status_code == 404


async def test_saved_update_changes_public_revision(client: AsyncClient):
    created = await create_roadmap(client, name="Before")
    status = (await _publish(client, created["id"], created["owner_session_token"])).json()
    first = await client.get(_public_url(status["public_id"]))
    updated = await client.put(
        f"/api/roadmaps/{created['id']}",
        headers=_auth(created["owner_session_token"]),
        json={"name": "After", "last_updated_at": created["updated_at"]},
    )
    assert updated.status_code == 200, updated.text
    second = await client.get(_public_url(status["public_id"]))
    assert second.json()["title"] == "After"
    assert second.json()["revision"] != first.json()["revision"]


async def test_public_reads_are_rate_limited(client: AsyncClient, monkeypatch):
    created = await create_roadmap(client)
    status = (await _publish(client, created["id"], created["owner_session_token"])).json()
    monkeypatch.setitem(RATE_LIMIT_POLICIES, "public.roadmap.read", (2, 60))
    monkeypatch.setattr(rate_limit_service, "rate_limiter", MemoryRateLimiter())
    url = _public_url(status["public_id"])
    assert (await client.get(url)).status_code == 200
    assert (await client.get(url)).status_code == 200
    blocked = await client.get(url)
    assert blocked.status_code == 429
    assert blocked.headers["retry-after"]


@asynccontextmanager
async def _committing_client():
    async def _override_get_db():
        async with _test_session_factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as async_client:
            yield async_client
    finally:
        app.dependency_overrides.clear()


async def test_concurrent_publish_keeps_one_public_id(monkeypatch):
    monkeypatch.setattr(rate_limit_service, "rate_limiter", MemoryRateLimiter())
    async with _committing_client() as client:
        created = await create_roadmap(client, name="Concurrent publish")
        token = created["owner_session_token"]
        roadmap_id = created["id"]
        first, second = await asyncio.gather(
            _publish(client, roadmap_id, token),
            _publish(client, roadmap_id, token),
        )
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        assert first.json()["public_id"] == second.json()["public_id"]
        await client.delete(f"/api/roadmaps/{roadmap_id}", headers=_auth(token))


async def test_expired_session_and_cross_roadmap_publication_access_are_denied(
    client: AsyncClient,
    db_session: AsyncSession,
):
    first = await create_roadmap(client, name="Roadmap Alpha")
    second = await create_roadmap(client, name="Roadmap Beta")

    published_beta = (
        await _publish(client, second["id"], second["owner_session_token"])
    ).json()

    # Cross-roadmap owner token must be rejected without leaking publication metadata
    for method in ("get", "post", "delete"):
        resp = await getattr(client, method)(
            f"/api/roadmaps/{second['id']}/publication",
            headers=_auth(first["owner_session_token"]),
        )
        assert resp.status_code == 401, resp.text
        assert published_beta["public_id"] not in resp.text

    # Expired owner session must be rejected with 401
    participant = await db_session.scalar(
        select(Participant).where(
            Participant.roadmap_id == first["id"],
            Participant.role == "owner",
        )
    )
    assert participant is not None
    participant.session_expires_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
    await db_session.flush()

    for method in ("get", "post", "delete"):
        expired = await getattr(client, method)(
            f"/api/roadmaps/{first['id']}/publication",
            headers=_auth(first["owner_session_token"]),
        )
        assert expired.status_code == 401, expired.text


async def test_public_endpoints_are_read_only_and_strictly_allowlisted(
    client: AsyncClient,
):
    created = await create_roadmap(client, name="Allowlist Strict")
    token = created["owner_session_token"]
    created = await _put_phases(client, created, token, _PRIVATE_PHASES)
    status = (await _publish(client, created["id"], token)).json()
    public_id = status["public_id"]

    # Public endpoints reject non-read HTTP methods
    for endpoint in (_public_url(public_id), f"{_public_url(public_id)}/preview.png"):
        for method in ("post", "put", "patch", "delete"):
            resp = await getattr(client, method)(endpoint)
            assert resp.status_code == 405, f"{method.upper()} {endpoint} returned {resp.status_code}"

    json_res = await client.get(_public_url(public_id))
    assert json_res.status_code == 200
    assert json_res.headers["x-robots-tag"] == "noindex, nofollow"
    payload = json_res.json()
    assert set(payload.keys()) == {
        "title",
        "revision",
        "progress",
        "task_count",
        "done_count",
        "truncated",
        "phases",
    }
    phase = payload["phases"][0]
    assert set(phase.keys()) == {
        "id",
        "number",
        "name",
        "color",
        "status",
        "progress",
        "tasks",
    }
    for task in phase["tasks"]:
        assert set(task.keys()) == {
            "id",
            "title",
            "done",
            "complexity",
            "tags",
            "depends_on",
            "parent_id",
        }

    png_res = await client.get(f"{_public_url(public_id)}/preview.png")
    assert png_res.status_code == 200
    assert png_res.headers["x-robots-tag"] == "noindex, nofollow"
    # Check PNG IHDR dimensions (bytes 16..24 big-endian width/height = 1200x630)
    assert int.from_bytes(png_res.content[16:20], "big") == 1200
    assert int.from_bytes(png_res.content[20:24], "big") == 630
    assert b"pt_secret" not in png_res.content
    assert b"github.com" not in png_res.content

    miss_res = await client.get(_public_url("pub_" + "z" * 22))
    assert miss_res.status_code == 404
    assert miss_res.headers["x-robots-tag"] == "noindex, nofollow"
    assert miss_res.headers["cache-control"] == "no-store"
