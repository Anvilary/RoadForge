"""Build the public roadmap projection from the committed snapshot.

The projector copies an allowlist of fields. It does not serialize a private
model and then delete sensitive keys.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from api.features.publication.schemas import (
    PublicPhase,
    PublicRoadmapResponse,
    PublicTask,
)
from api.features.roadmaps.limit_schemas import (
    PHASE_NAME_MAX,
    PHASE_NUM_MAX,
    PHASES_MAX,
    ROADMAP_NAME_MAX,
    TAG_MAX,
    TASK_TAGS_MAX,
    TASK_TITLE_MAX,
    TASKS_PER_PHASE_MAX,
)

_HEX_COLOR = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
_COMPLEXITY = {"very_low", "low", "medium", "high", "very_high"}
_STATUS = {"done", "active", "next", "future"}
_DEFAULT_COLOR = "#d97442"
_MAX_PUBLIC_JSON_BYTES = 800_000
_ID_MAX = 80


def project_roadmap(
    title: object,
    updated_at: datetime,
    snapshot_json: object,
) -> PublicRoadmapResponse:
    phases = _phases(snapshot_json)
    roadmap = PublicRoadmapResponse(
        title=_text(title, ROADMAP_NAME_MAX) or "Roadmap",
        revision=revision_token(updated_at),
        progress=_progress(phases),
        task_count=sum(len(phase.tasks) for phase in phases),
        done_count=sum(task.done for phase in phases for task in phase.tasks),
        truncated=False,
        phases=phases,
    )
    return _fit_payload(roadmap)


def revision_token(updated_at: datetime) -> str:
    aware = updated_at if updated_at.tzinfo is not None else updated_at.replace(
        tzinfo=timezone.utc
    )
    return aware.astimezone(timezone.utc).isoformat()


def _phases(snapshot_json: object) -> list[PublicPhase]:
    raw_phases = snapshot_json.get("phases") if isinstance(snapshot_json, dict) else None
    if not isinstance(raw_phases, list):
        return []
    phases: list[PublicPhase] = []
    seen_phase_ids: set[str] = set()
    for raw_phase in raw_phases[:PHASES_MAX]:
        if not isinstance(raw_phase, dict):
            continue
        phase_id = _identifier(raw_phase.get("id"))
        if phase_id is None or phase_id in seen_phase_ids:
            continue
        seen_phase_ids.add(phase_id)
        tasks = _tasks(raw_phase.get("tasks"))
        done = sum(task.done for task in tasks)
        phases.append(
            PublicPhase(
                id=phase_id,
                number=_text(raw_phase.get("num"), PHASE_NUM_MAX),
                name=_text(raw_phase.get("name"), PHASE_NAME_MAX) or "Phase",
                color=_color(raw_phase.get("color")),
                status=_status(raw_phase.get("status")),
                progress=_ratio(done, len(tasks)),
                tasks=tasks,
            )
        )
    return phases


def _tasks(raw_tasks: object) -> list[PublicTask]:
    if not isinstance(raw_tasks, list):
        return []
    drafts: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw_task in raw_tasks[:TASKS_PER_PHASE_MAX]:
        if not isinstance(raw_task, dict):
            continue
        task_id = _identifier(raw_task.get("id"))
        if task_id is None or task_id in seen:
            continue
        seen.add(task_id)
        drafts.append(
            {
                "id": task_id,
                "title": _text(raw_task.get("title"), TASK_TITLE_MAX) or "Task",
                "done": raw_task.get("done") is True,
                "complexity": raw_task.get("complexity")
                if raw_task.get("complexity") in _COMPLEXITY
                else "medium",
                "tags": _tags(raw_task.get("tags")),
                "depends_on": _identifiers(raw_task.get("deps")),
                "parent_id": _identifier(raw_task.get("parentId")),
            }
        )
    known = {item["id"] for item in drafts}
    tasks: list[PublicTask] = []
    for item in drafts:
        parent_id = item["parent_id"] if item["parent_id"] in known else None
        if parent_id == item["id"]:
            parent_id = None
        depends_on = [
            dependency
            for dependency in item["depends_on"]
            if dependency in known and dependency != item["id"]
        ]
        tasks.append(
            PublicTask(
                id=item["id"],
                title=item["title"],
                done=item["done"],
                complexity=item["complexity"],
                tags=item["tags"],
                depends_on=depends_on,
                parent_id=parent_id,
            )
        )
    return tasks


def _fit_payload(roadmap: PublicRoadmapResponse) -> PublicRoadmapResponse:
    if _size(roadmap) <= _MAX_PUBLIC_JSON_BYTES:
        return roadmap
    phases = list(roadmap.phases)
    changed = False
    while phases and _size(roadmap.model_copy(update={"phases": phases, "truncated": True})) > (
        _MAX_PUBLIC_JSON_BYTES
    ):
        last = phases[-1]
        if last.tasks:
            tasks = last.tasks[:-1]
            done = sum(task.done for task in tasks)
            phases[-1] = last.model_copy(
                update={"tasks": tasks, "progress": _ratio(done, len(tasks))}
            )
            changed = True
            continue
        phases.pop()
        changed = True
    if not changed:
        return roadmap.model_copy(update={"truncated": True, "phases": []})
    trimmed = roadmap.model_copy(update={"phases": phases, "truncated": True})
    return trimmed.model_copy(
        update={
            "progress": _progress(trimmed.phases),
            "task_count": sum(len(phase.tasks) for phase in trimmed.phases),
            "done_count": sum(task.done for phase in trimmed.phases for task in phase.tasks),
        }
    )


def _size(roadmap: PublicRoadmapResponse) -> int:
    return len(json.dumps(roadmap.model_dump(mode="json"), separators=(",", ":")).encode())


def _text(value: object, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = "".join(ch if ch.isprintable() else " " for ch in value)
    return " ".join(cleaned.split())[:limit]


def _identifier(value: object) -> str | None:
    text = _text(value, _ID_MAX)
    return text or None


def _identifiers(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    found: list[str] = []
    for item in value[:50]:
        identifier = _identifier(item)
        if identifier and identifier not in found:
            found.append(identifier)
    return found


def _tags(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    tags: list[str] = []
    for item in value[:TASK_TAGS_MAX]:
        tag = _text(item, TAG_MAX)
        if tag and tag not in tags:
            tags.append(tag)
    return tags


def _color(value: object) -> str:
    if isinstance(value, str) and _HEX_COLOR.fullmatch(value.strip()):
        return value.strip().lower()
    return _DEFAULT_COLOR


def _status(value: object) -> str:
    if isinstance(value, str) and value in _STATUS:
        return value
    return "future"


def _ratio(done: int, total: int) -> int:
    if total <= 0:
        return 0
    return round(done * 100 / total)


def _progress(phases: list[PublicPhase]) -> int:
    total = sum(len(phase.tasks) for phase in phases)
    done = sum(task.done for phase in phases for task in phase.tasks)
    return _ratio(done, total)
