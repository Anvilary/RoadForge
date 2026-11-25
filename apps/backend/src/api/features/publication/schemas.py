"""Public publication contracts.

These models are an allowlist. Private roadmap responses are never reused as
the public body.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PUBLIC_NOT_FOUND = "Published roadmap not found"

PUBLIC_FIELD_LINES = [
    "Roadmap title",
    "Phase names, numbers, order, status, and colors",
    "Task and subtask titles, order, completion, complexity, and tags",
    "Dependencies between published tasks",
    "Progress computed from task completion",
]

PRIVATE_FIELD_LINES = [
    "Descriptions, estimates, and assignees",
    "Claims, participants, and the owner name",
    "External links, including GitHub links",
    "Activity history, version history, and invite credentials",
]

AUTOMATIC_UPDATE_NOTE = (
    "Saved changes to the published fields become public, including new and edited tasks. "
    "Unsaved edits in a browser stay private until they are saved."
)

CACHE_NOTE = (
    "The public viewer reads the latest saved roadmap. GitHub and other sites cache the "
    "preview image, so a README can lag behind the live viewer."
)

REVOCATION_NOTE = (
    "Unpublishing stops new public access. It cannot remove copies that a browser, GitHub, "
    "or another site has already cached. Republishing creates a new public link."
)

PUBLIC_WARNING = (
    "Anyone with the public link can view the published roadmap. "
    "New roadmap changes may also become publicly visible."
)


class PublicTask(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    done: bool
    complexity: Literal["very_low", "low", "medium", "high", "very_high"]
    tags: list[str]
    depends_on: list[str]
    parent_id: str | None


class PublicPhase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    number: str
    name: str
    color: str
    status: Literal["done", "active", "next", "future"]
    progress: int = Field(ge=0, le=100)
    tasks: list[PublicTask]


class PublicRoadmapResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    revision: str
    progress: int = Field(ge=0, le=100)
    task_count: int = Field(ge=0)
    done_count: int = Field(ge=0)
    truncated: bool
    phases: list[PublicPhase]


class PublicationStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["published", "unpublished"]
    public_id: str | None = None
    viewer_url: str | None = None
    embed_url: str | None = None
    image_url: str | None = None
    markdown: str | None = None
    embed_html: str | None = None
    revision: str | None = None
    published_at: datetime | None = None
    public_fields: list[str]
    private_fields: list[str]
    warning: str
    automatic_update_note: str
    cache_note: str
    revocation_note: str
