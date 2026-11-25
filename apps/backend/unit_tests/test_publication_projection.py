from datetime import datetime, timezone

import api.features.publication.projection as projection
from api.features.publication.image import render_roadmap_png
from api.features.publication.projection import project_roadmap
from api.features.publication.schemas import PublicRoadmapResponse
from api.features.publication.snippets import iframe_snippet, markdown_snippet


def _snapshot() -> dict:
    return {
        "phases": [
            {
                "id": "ph-1",
                "num": "01",
                "name": "Foundation <script>",
                "color": "blue",
                "status": "active",
                "progress": 10,
                "secret": "phase-secret",
                "tasks": [
                    {
                        "id": "task-1",
                        "title": "Ship the public viewer",
                        "done": True,
                        "desc": "Private description",
                        "est": "secret-estimate",
                        "assignees": ["Ada Lovelace"],
                        "claimedBy": "Ada Lovelace",
                        "claimedById": "pt_private",
                        "links": [{"url": "https://github.com/acme/private/issues/1"}],
                        "tags": ["public", "public"],
                        "complexity": "high",
                        "deps": ["missing", "task-2"],
                        "parentId": None,
                    },
                    {
                        "id": "task-2",
                        "title": "Write the embed",
                        "done": False,
                        "parentId": "task-1",
                        "deps": ["task-1"],
                        "complexity": "nope",
                    },
                ],
            }
        ]
    }


def test_projection_allowlist_drops_private_fields():
    roadmap = project_roadmap(
        "Public roadmap",
        datetime(2026, 11, 21, tzinfo=timezone.utc),
        _snapshot(),
    )
    payload = roadmap.model_dump(mode="json")
    text = str(payload)
    assert "Private description" not in text
    assert "Ada Lovelace" not in text
    assert "secret-estimate" not in text
    assert "github.com" not in text
    assert "pt_private" not in text
    assert "phase-secret" not in text
    phase = payload["phases"][0]
    assert phase["color"] == "#d97442"
    assert phase["status"] == "active"
    assert phase["progress"] == 50
    task = phase["tasks"][0]
    assert task["depends_on"] == ["task-2"]
    assert task["tags"] == ["public"]
    assert phase["tasks"][1]["parent_id"] == "task-1"
    assert phase["tasks"][1]["complexity"] == "medium"
    assert set(task) == {
        "id", "title", "done", "complexity", "tags", "depends_on", "parent_id",
    }


def test_projection_truncates_oversized_payload(monkeypatch):
    monkeypatch.setattr(projection, "_MAX_PUBLIC_JSON_BYTES", 400)
    snapshot = {
        "phases": [
            {
                "id": "phase",
                "num": "01",
                "name": "Large",
                "color": "#112233",
                "status": "future",
                "tasks": [
                    {"id": f"task-{index}", "title": "x" * 80, "done": False}
                    for index in range(30)
                ],
            }
        ]
    }
    roadmap = project_roadmap("Large", datetime.now(timezone.utc), snapshot)
    assert roadmap.truncated is True
    assert roadmap.task_count < 30
    assert len(roadmap.model_dump_json().encode()) <= 800


def test_projection_keeps_unicode_title():
    roadmap = project_roadmap("路线图 Café", datetime.now(timezone.utc), {"phases": []})
    assert roadmap.title == "路线图 Café"
    assert roadmap.progress == 0
    assert roadmap.phases == []


def test_snippets_are_escaped_and_absolute():
    markdown = markdown_snippet(
        'Roadmap <script> [alpha]',
        "https://example.test/api/public/roadmaps/pub_abc/preview.png",
        "https://example.test/p/pub_abc",
    )
    assert markdown == (
        "[![Roadmap  script  (alpha)]"
        "(https://example.test/api/public/roadmaps/pub_abc/preview.png)]"
        "(https://example.test/p/pub_abc)"
    )
    html = iframe_snippet('Tom & "Jerry" <script>', "https://example.test/embed/pub_abc")
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "Tom &amp; &quot;Jerry&quot;" in html
    assert 'src="https://example.test/embed/pub_abc"' in html


def test_preview_png_is_deterministic_and_has_no_script_payload():
    roadmap = PublicRoadmapResponse(
        title="<script>alert(1)</script> 路线图",
        revision="rev-1",
        progress=50,
        task_count=1,
        done_count=0,
        truncated=False,
        phases=[],
    )
    first = render_roadmap_png(roadmap)
    second = render_roadmap_png(roadmap)
    assert first.startswith(b"\x89PNG\r\n\x1a\n")
    assert first == second
    assert b"<script" not in first
    assert len(first) < 400_000
