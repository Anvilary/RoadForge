"""Deterministic PNG preview for published roadmaps.

Rendering stays in-process. It does not launch a browser and it does not fetch
remote images or URLs from roadmap content.
"""

from __future__ import annotations

import threading
from collections import OrderedDict
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from api.features.publication.schemas import PublicPhase, PublicRoadmapResponse

_ASSETS = Path(__file__).resolve().parent / "assets"
_FONT_PATH = _ASSETS / "DejaVuSans.ttf"
_LOGO_PATH = _ASSETS / "anvilary-logo.png"

_WIDTH = 1200
_HEIGHT = 630
_BG = (18, 18, 20)
_INK = (237, 237, 234)
_MUTED = (184, 182, 176)
_DIM = (138, 135, 127)
_EMBER = (217, 116, 66)
_TRACK = (37, 37, 43)
_LINE = (47, 47, 54)
_MAX_PHASES = 5
_MAX_TASKS = 2
_CACHE_MAX = 32

_cache: OrderedDict[tuple[str, str], bytes] = OrderedDict()
_cache_lock = threading.Lock()


def cached_roadmap_png(public_id: str, roadmap: PublicRoadmapResponse) -> bytes:
    key = (public_id, roadmap.revision)
    with _cache_lock:
        cached = _cache.get(key)
        if cached is not None:
            _cache.move_to_end(key)
            return cached
    rendered = render_roadmap_png(roadmap)
    with _cache_lock:
        _cache[key] = rendered
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)
    return rendered


def render_roadmap_png(roadmap: PublicRoadmapResponse) -> bytes:
    image = Image.new("RGB", (_WIDTH, _HEIGHT), _BG)
    draw = ImageDraw.Draw(image)
    title_font = _font(40)
    body_font = _font(22)
    small_font = _font(18)
    draw.rectangle((0, 0, _WIDTH, 8), fill=_EMBER)

    x = 56
    y = 36
    draw.text(
        (x, y),
        _fit(draw, roadmap.title or "Roadmap", title_font, _WIDTH - 112),
        font=title_font,
        fill=_INK,
    )
    y += 58
    summary = (
        f"{roadmap.progress}% complete   ·   "
        f"{roadmap.done_count} of {roadmap.task_count} tasks"
    )
    draw.text((x, y), summary, font=body_font, fill=_MUTED)
    y += 42
    _progress_bar(draw, x, y, _WIDTH - 112, 14, roadmap.progress, _EMBER)
    y += 36

    shown = roadmap.phases[:_MAX_PHASES]
    for phase in shown:
        if y > _HEIGHT - 108:
            break
        y = _draw_phase(draw, phase, x, y, body_font, small_font)

    hidden_phases = max(0, len(roadmap.phases) - len(shown))
    if hidden_phases and y < _HEIGHT - 84:
        label = f"+ {hidden_phases} more phases"
        if roadmap.truncated:
            label += " · summary"
        draw.text((x, y), label, font=small_font, fill=_DIM)
    elif roadmap.truncated and y < _HEIGHT - 84:
        draw.text((x, y), "Summary of a larger roadmap", font=small_font, fill=_DIM)

    draw.line((x, _HEIGHT - 58, _WIDTH - x, _HEIGHT - 58), fill=_LINE)
    _draw_attribution(image, draw, x, small_font)

    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def _draw_phase(
    draw: ImageDraw.ImageDraw,
    phase: PublicPhase,
    x: int,
    y: int,
    body_font: ImageFont.ImageFont,
    small_font: ImageFont.ImageFont,
) -> int:
    color = _hex_rgb(phase.color)
    draw.rounded_rectangle((x, y + 4, x + 16, y + 20), radius=4, fill=color)
    name = _fit(draw, phase.name, body_font, 820)
    draw.text((x + 28, y), name, font=body_font, fill=_INK)
    percent = f"{phase.progress}%"
    percent_width = draw.textlength(percent, font=body_font)
    draw.text((_WIDTH - 56 - percent_width, y), percent, font=body_font, fill=_MUTED)
    y += 32
    _progress_bar(draw, x + 28, y, 280, 6, phase.progress, color)
    y += 16
    top_level = [task for task in phase.tasks if task.parent_id is None]
    visible = top_level[:_MAX_TASKS]
    for task in visible:
        mark = "[x]" if task.done else "[ ]"
        label = _fit(draw, f"{mark}  {task.title}", small_font, 980)
        draw.text((x + 28, y), label, font=small_font, fill=_INK if task.done else _MUTED)
        y += 24
    hidden = max(0, len(phase.tasks) - len(visible))
    if hidden:
        draw.text((x + 28, y), f"+ {hidden} more tasks", font=small_font, fill=_DIM)
        y += 24
    return y + 12


def _draw_attribution(
    image: Image.Image,
    draw: ImageDraw.ImageDraw,
    x: int,
    font: ImageFont.ImageFont,
) -> None:
    text_x = x
    if _LOGO_PATH.is_file():
        try:
            logo = Image.open(_LOGO_PATH).convert("RGBA")
            logo.thumbnail((28, 28))
            image.paste(logo, (x, _HEIGHT - 46), logo)
            text_x = x + 36
        except OSError:
            text_x = x
    draw.text(
        (text_x, _HEIGHT - 42),
        "Built with RoadForge by Anvilary.Tools",
        font=font,
        fill=_MUTED,
    )


def _progress_bar(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    width: int,
    height: int,
    progress: int,
    fill: tuple[int, int, int],
) -> None:
    draw.rounded_rectangle((x, y, x + width, y + height), radius=height // 2, fill=_TRACK)
    bounded = max(0, min(100, progress))
    filled = round(width * bounded / 100)
    if filled > 0:
        draw.rounded_rectangle(
            (x, y, x + max(filled, height), y + height),
            radius=height // 2,
            fill=fill,
        )


def _fit(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: float) -> str:
    cleaned = " ".join(text.split()) or "Roadmap"
    if draw.textlength(cleaned, font=font) <= max_width:
        return cleaned
    ellipsis = "..."
    lo = 0
    hi = len(cleaned)
    best = ellipsis
    while lo <= hi:
        mid = (lo + hi) // 2
        candidate = cleaned[:mid].rstrip() + ellipsis
        if draw.textlength(candidate, font=font) <= max_width:
            best = candidate
            lo = mid + 1
        else:
            hi = mid - 1
    return best


def _font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype(str(_FONT_PATH), size=size)
    except OSError:
        return ImageFont.load_default()


def _hex_rgb(value: str) -> tuple[int, int, int]:
    raw = value.removeprefix("#")
    if len(raw) == 3:
        raw = "".join(ch * 2 for ch in raw)
    if len(raw) not in {6, 8}:
        return _EMBER
    try:
        return (int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16))
    except ValueError:
        return _EMBER
