"""YouTube platform adapter — wraps YouTubeService/yt-dlp."""
from __future__ import annotations

import logging
import re

from workout_ingestor_api.services.youtube_service import YouTubeService
from .base import PlatformAdapter, MediaContent, PlatformFetchError
from . import register_adapter

logger = logging.getLogger(__name__)


def _extract_transcript_from_captions(captions: dict) -> str:
    """Parse the first available English caption track into a plain text string.

    Supports both 'srt' and 'json3' caption formats as returned by
    YouTubeService.extract_metadata() / extract_captions().
    Returns an empty string if no usable captions are found.
    """
    if not captions:
        return ""

    # Prefer explicit English tracks; fall back to the first available track.
    preferred = ["en", "en-US", "en-GB"]
    lang_key: str | None = None
    for lang in preferred:
        if lang in captions:
            lang_key = lang
            break
    if lang_key is None:
        lang_key = next(iter(captions))

    track = captions[lang_key]
    fmt = track.get("format", "")
    data = track.get("data", "")

    if fmt == "srt" and isinstance(data, str):
        return _parse_srt_to_text(data)
    if fmt == "json3" and isinstance(data, dict):
        return _parse_json3_to_text(data)

    # Unknown format — try to return raw text if it's a string
    if isinstance(data, str):
        return data.strip()
    return ""


def _parse_srt_to_text(srt: str) -> str:
    """Extract plain text lines from SRT subtitle data."""
    # Strip sequence numbers and timestamps; keep text lines only.
    lines = []
    for line in srt.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.isdigit():
            continue
        if re.match(r"\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}", line):
            continue
        lines.append(line)
    return "\n".join(lines)


def _parse_json3_to_text(json3: dict) -> str:
    """Extract plain text from a JSON3 caption object."""
    events = json3.get("events", [])
    parts: list[str] = []
    for event in events:
        for seg in event.get("segs", []):
            text = seg.get("utf8", "")
            if text and text != "\n":
                parts.append(text)
    return " ".join(parts).strip()


class YouTubeAdapter(PlatformAdapter):
    """Fetches YouTube videos via yt-dlp (existing YouTubeService)."""

    @staticmethod
    def platform_name() -> str:
        return "youtube"

    def fetch(self, url: str, source_id: str) -> MediaContent:
        try:
            data = YouTubeService.extract_metadata(url)
        except Exception as e:
            raise PlatformFetchError(
                f"YouTube fetch failed for {source_id}: {e}"
            ) from e

        title: str = data.get("title") or f"YouTube video {source_id}"
        description: str = data.get("description") or ""
        duration = data.get("duration")
        channel: str = (
            data.get("channel")
            or data.get("uploader")
            or "unknown"
        )
        captions: dict = data.get("captions") or {}

        transcript: str = _extract_transcript_from_captions(captions)

        primary_text = transcript.strip() if transcript.strip() else description.strip()
        if not primary_text:
            raise PlatformFetchError(
                f"No extractable text found for YouTube video {source_id}"
            )

        secondary_texts = (
            [description.strip()]
            if transcript.strip() and description.strip()
            else []
        )

        return MediaContent(
            primary_text=primary_text,
            secondary_texts=secondary_texts,
            title=title[:80],
            media_metadata={
                "video_duration_sec": duration,
                "channel": channel,
                "video_id": source_id,
            },
        )


register_adapter(YouTubeAdapter)
