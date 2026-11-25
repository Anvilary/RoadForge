from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings
from api.database import get_db
from api.features.publication.schemas import PublicationStatusResponse
from api.features.publication.service import (
    get_publication_status,
    publish_roadmap,
    unpublish_roadmap,
)
from api.shared.auth.auth_service import require_participant
from api.shared.auth.session_policy import OWNER_ONLY
from api.shared.security.rate_limit_service import enforce_rate_limit, participant_rate_key

router = APIRouter(tags=["roadmaps"])


@router.get("/{roadmap_id}/publication", response_model=PublicationStatusResponse)
async def fetch_publication(
    roadmap_id: str,
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> PublicationStatusResponse:
    participant = await require_participant(db, roadmap_id, authorization, OWNER_ONLY)
    await enforce_rate_limit(
        "publication.read", participant_rate_key(participant.id, roadmap_id)
    )
    return await get_publication_status(db, roadmap_id, get_settings().web_base_url)


@router.post("/{roadmap_id}/publication", response_model=PublicationStatusResponse)
async def post_publication(
    roadmap_id: str,
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> PublicationStatusResponse:
    participant = await require_participant(db, roadmap_id, authorization, OWNER_ONLY)
    await enforce_rate_limit(
        "publication.publish", participant_rate_key(participant.id, roadmap_id)
    )
    return await publish_roadmap(db, roadmap_id, get_settings().web_base_url)


@router.delete("/{roadmap_id}/publication", response_model=PublicationStatusResponse)
async def delete_publication(
    roadmap_id: str,
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> PublicationStatusResponse:
    participant = await require_participant(db, roadmap_id, authorization, OWNER_ONLY)
    await enforce_rate_limit(
        "publication.unpublish", participant_rate_key(participant.id, roadmap_id)
    )
    return await unpublish_roadmap(db, roadmap_id, get_settings().web_base_url)
