"""Anonymous published-roadmap routes."""

from api.features.publication import public_router as publication_public

router = publication_public.router
