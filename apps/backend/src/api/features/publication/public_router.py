from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.features.publication.image import cached_roadmap_png
from api.features.publication.schemas import PUBLIC_NOT_FOUND, PublicRoadmapResponse
from api.features.publication.service import make_etag, read_published_roadmap
from api.shared.security.client_ip_service import extract_client_ip
from api.shared.security.rate_limit_service import enforce_rate_limit

router = APIRouter(tags=["public-roadmap"])

_MISS_HEADERS = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"}


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail=PUBLIC_NOT_FOUND, headers=_MISS_HEADERS)


@router.get("/roadmaps/{public_id}", response_model=PublicRoadmapResponse)
async def get_published_roadmap(
    public_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    await enforce_rate_limit("public.roadmap.read", extract_client_ip(request))
    roadmap = await read_published_roadmap(db, public_id)
    if roadmap is None:
        raise _not_found()
    etag = make_etag(roadmap.revision)
    headers = {
        "ETag": etag,
        "Cache-Control": "public, max-age=15",
        "X-Robots-Tag": "noindex, nofollow",
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return JSONResponse(content=roadmap.model_dump(mode="json"), headers=headers)


@router.get("/roadmaps/{public_id}/preview.png")
async def get_published_roadmap_preview(
    public_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    await enforce_rate_limit("public.roadmap.image", extract_client_ip(request))
    roadmap = await read_published_roadmap(db, public_id)
    if roadmap is None:
        raise _not_found()
    etag = make_etag(roadmap.revision)
    headers = {
        "ETag": etag,
        "Cache-Control": "public, max-age=60",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Disposition": 'inline; filename="roadmap-preview.png"',
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(
        content=cached_roadmap_png(public_id, roadmap),
        media_type="image/png",
        headers=headers,
    )
