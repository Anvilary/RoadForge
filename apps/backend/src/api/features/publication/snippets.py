"""Copyable public snippets.

URLs come from the configured public origin. They are not derived from the
request host and they do not embed invite or session credentials.
"""

from __future__ import annotations

from html import escape


def publication_urls(web_base_url: str, public_id: str) -> tuple[str, str, str]:
    origin = web_base_url.strip().rstrip("/")
    viewer_url = f"{origin}/p/{public_id}"
    embed_url = f"{origin}/embed/{public_id}"
    image_url = f"{origin}/api/public/roadmaps/{public_id}/preview.png"
    return viewer_url, embed_url, image_url


def markdown_snippet(title: str, image_url: str, viewer_url: str) -> str:
    alt = _markdown_alt(title)
    return f"[![{alt}]({image_url})]({viewer_url})"


def iframe_snippet(title: str, embed_url: str) -> str:
    safe_title = escape(title.strip() or "Project roadmap", quote=True)
    safe_src = escape(embed_url, quote=True)
    return (
        "<iframe\n"
        f'  src="{safe_src}"\n'
        f'  title="{safe_title}"\n'
        '  loading="lazy"\n'
        '  style="width:100%;height:620px;border:0;border-radius:12px"\n'
        "></iframe>"
    )


def _markdown_alt(title: str) -> str:
    cleaned = " ".join(title.split())
    cleaned = cleaned.replace("[", "(").replace("]", ")").replace("<", " ").replace(">", " ")
    if not cleaned:
        return "Project roadmap"
    return cleaned[:120]
