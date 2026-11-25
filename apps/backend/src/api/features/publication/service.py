"""Publication lifecycle.

Only an owner session may change publication state. Anonymous reads go through
the public projection and never accept invite or session credentials.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.features.publication.projection import project_roadmap, revision_token
from api.features.publication.schemas import (
    AUTOMATIC_UPDATE_NOTE,
    CACHE_NOTE,
    PRIVATE_FIELD_LINES,
    PUBLIC_FIELD_LINES,
    PUBLIC_WARNING,
    REVOCATION_NOTE,
    PublicationStatusResponse,
    PublicRoadmapResponse,
)
from api.features.publication.snippets import (
    iframe_snippet,
    markdown_snippet,
    publication_urls,
)
from api.models.roadmap import Roadmap, RoadmapPublication
from api.shared.ids import generate_id

_PUBLIC_ID = re.compile(r"^pub_[A-Za-z0-9_-]{16,80}$")


def make_etag(revision: str) -> str:
    return '"' + revision.replace('"', "") + '"'


async def get_publication_status(
    db: AsyncSession,
    roadmap_id: str,
    web_base_url: str,
) -> PublicationStatusResponse:
    roadmap = await _active_roadmap(db, roadmap_id, lock=False)
    if roadmap is None:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    publication = await _publication(db, roadmap_id, lock=False)
    return _status_response(publication, roadmap, web_base_url)


async def publish_roadmap(
    db: AsyncSession,
    roadmap_id: str,
    web_base_url: str,
) -> PublicationStatusResponse:
    roadmap = await _active_roadmap(db, roadmap_id, lock=True)
    if roadmap is None:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    publication = await _publication(db, roadmap_id, lock=True)
    now = datetime.now(timezone.utc)
    if publication is None:
        publication = RoadmapPublication(
            id=generate_id("rpub_"),
            roadmap_id=roadmap.id,
            public_id=generate_id("pub_"),
            status="published",
            published_at=now,
            unpublished_at=None,
            created_at=now,
            updated_at=now,
        )
        db.add(publication)
    elif publication.status != "published":
        publication.public_id = generate_id("pub_")
        publication.status = "published"
        publication.published_at = now
        publication.unpublished_at = None
        publication.updated_at = now
    await db.commit()
    await db.refresh(publication)
    await db.refresh(roadmap)
    return _status_response(publication, roadmap, web_base_url)


async def unpublish_roadmap(
    db: AsyncSession,
    roadmap_id: str,
    web_base_url: str,
) -> PublicationStatusResponse:
    roadmap = await _active_roadmap(db, roadmap_id, lock=True)
    if roadmap is None:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    publication = await _publication(db, roadmap_id, lock=True)
    now = datetime.now(timezone.utc)
    if publication is not None:
        publication.public_id = generate_id("pub_")
        publication.status = "unpublished"
        publication.unpublished_at = now
        publication.updated_at = now
        await db.commit()
        await db.refresh(publication)
    return _status_response(publication, roadmap, web_base_url)


async def read_published_roadmap(
    db: AsyncSession,
    public_id: str,
) -> PublicRoadmapResponse | None:
    if _PUBLIC_ID.fullmatch(public_id) is None:
        return None
    result = await db.execute(
        select(RoadmapPublication, Roadmap)
        .join(Roadmap, Roadmap.id == RoadmapPublication.roadmap_id)
        .where(
            RoadmapPublication.public_id == public_id,
            RoadmapPublication.status == "published",
            Roadmap.deleted_at.is_(None),
        )
    )
    row = result.one_or_none()
    if row is None:
        return None
    _publication_row, roadmap = row
    return project_roadmap(roadmap.name, roadmap.updated_at, roadmap.snapshot_json)


def invalidate_publication(publication: RoadmapPublication, now: datetime) -> None:
    """Drop the live public identifier when its roadmap is deleted."""
    publication.status = "unpublished"
    publication.public_id = generate_id("pub_")
    publication.unpublished_at = now
    publication.updated_at = now


async def _active_roadmap(
    db: AsyncSession,
    roadmap_id: str,
    *,
    lock: bool,
) -> Roadmap | None:
    statement = select(Roadmap).where(
        Roadmap.id == roadmap_id,
        Roadmap.deleted_at.is_(None),
    )
    if lock:
        statement = statement.with_for_update()
    result = await db.execute(statement)
    return result.scalar_one_or_none()


async def _publication(
    db: AsyncSession,
    roadmap_id: str,
    *,
    lock: bool,
) -> RoadmapPublication | None:
    statement = select(RoadmapPublication).where(RoadmapPublication.roadmap_id == roadmap_id)
    if lock:
        statement = statement.with_for_update()
    result = await db.execute(statement)
    return result.scalar_one_or_none()


def _status_response(
    publication: RoadmapPublication | None,
    roadmap: Roadmap,
    web_base_url: str,
) -> PublicationStatusResponse:
    published = publication is not None and publication.status == "published"
    if not published or publication is None:
        return PublicationStatusResponse(
            status="unpublished",
            public_fields=list(PUBLIC_FIELD_LINES),
            private_fields=list(PRIVATE_FIELD_LINES),
            warning=PUBLIC_WARNING,
            automatic_update_note=AUTOMATIC_UPDATE_NOTE,
            cache_note=CACHE_NOTE,
            revocation_note=REVOCATION_NOTE,
        )
    viewer_url, embed_url, image_url = publication_urls(web_base_url, publication.public_id)
    title = roadmap.name
    return PublicationStatusResponse(
        status="published",
        public_id=publication.public_id,
        viewer_url=viewer_url,
        embed_url=embed_url,
        image_url=image_url,
        markdown=markdown_snippet(title, image_url, viewer_url),
        embed_html=iframe_snippet(title, embed_url),
        revision=revision_token(roadmap.updated_at),
        published_at=publication.published_at,
        public_fields=list(PUBLIC_FIELD_LINES),
        private_fields=list(PRIVATE_FIELD_LINES),
        warning=PUBLIC_WARNING,
        automatic_update_note=AUTOMATIC_UPDATE_NOTE,
        cache_note=CACHE_NOTE,
        revocation_note=REVOCATION_NOTE,
    )
