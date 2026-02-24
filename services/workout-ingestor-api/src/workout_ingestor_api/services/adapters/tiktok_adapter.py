"""TikTok platform adapter — three-tier fallback: transcript → vision → oEmbed.

Tier 1 (transcript):
    yt-dlp downloads the video → ffmpeg extracts audio →
    OpenAI Whisper API transcribes it.  Used when the transcript is at
    least TRANSCRIPT_MIN_CHARS characters long.

Tier 2 (vision):
    If the transcript is too short (or transcription fails), VideoService
    samples keyframes and VisionService.extract_text_from_images() analyses
    them with GPT-4o.

Tier 3 (oEmbed):
    If both tiers above fail — video unavailable, APIs down, empty output —
    the adapter falls back to the oEmbed caption, matching the original
    behaviour.
"""
from __future__ import annotations

import logging
import os
import shutil
import tempfile
from typing import List, Optional

from .base import PlatformAdapter, MediaContent, PlatformFetchError
from . import register_adapter
from workout_ingestor_api.services.tiktok_service import TikTokService
from workout_ingestor_api.services.asr_service import ASRService
from workout_ingestor_api.services.video_service import VideoService
from workout_ingestor_api.services.vision_service import VisionService

logger = logging.getLogger(__name__)

# Minimum transcript length (characters) required before we trust it
# and skip the vision tier.
TRANSCRIPT_MIN_CHARS: int = 50


def _collect_frame_paths(frame_dir: str) -> List[str]:
    """Return sorted list of PNG frame paths inside *frame_dir*."""
    return sorted(
        os.path.join(frame_dir, f)
        for f in os.listdir(frame_dir)
        if f.endswith(".png")
    )


class TikTokAdapter(PlatformAdapter):
    @staticmethod
    def platform_name() -> str:
        return "tiktok"

    def fetch(self, url: str, source_id: str) -> MediaContent:
        # ------------------------------------------------------------------
        # Fetch oEmbed metadata first — needed for all tiers and the title.
        # ------------------------------------------------------------------
        try:
            metadata = TikTokService.extract_metadata(url)
        except Exception as e:
            raise PlatformFetchError(f"TikTok fetch failed for {source_id}: {e}") from e

        title = (
            (metadata.title or "").strip()
            or f"TikTok by @{metadata.author_name}"
        )[:80]

        base_meta = {
            "platform": "tiktok",
            "video_id": source_id,
            "creator": metadata.author_name,
            "hashtags": metadata.hashtags,
            "duration_seconds": metadata.duration_seconds,
        }

        # ------------------------------------------------------------------
        # Tier 1 + 2: attempt video download → transcript → (if short) vision
        # ------------------------------------------------------------------
        tmpdir: Optional[str] = None
        try:
            tmpdir = tempfile.mkdtemp(prefix="tiktok_adapter_")
            video_path: Optional[str] = TikTokService.download_video(url, tmpdir)

            if video_path:
                # --- Tier 1: audio transcription ---
                transcript: Optional[str] = None
                try:
                    audio_path = ASRService.extract_audio(video_path)
                    result = ASRService.transcribe_with_openai_api(audio_path)
                    raw = (result.get("text") or "").strip()
                    if len(raw) >= TRANSCRIPT_MIN_CHARS:
                        transcript = raw
                    else:
                        logger.debug(
                            "TikTok transcript too short (%d chars < %d) for %s — "
                            "falling through to vision",
                            len(raw),
                            TRANSCRIPT_MIN_CHARS,
                            source_id,
                        )
                except Exception as exc:
                    logger.warning(
                        "TikTok transcription failed for %s: %s — trying vision",
                        source_id,
                        exc,
                    )

                if transcript:
                    return MediaContent(
                        primary_text=transcript,
                        secondary_texts=[metadata.title.strip()] if metadata.title else [],
                        title=title,
                        media_metadata={**base_meta, "extraction_tier": "transcript"},
                    )

                # --- Tier 2: vision keyframe analysis ---
                try:
                    frames_dir = tmpdir
                    VideoService.sample_frames(video_path, frames_dir, fps=0.5, max_secs=180)
                    frame_paths = _collect_frame_paths(frames_dir)
                    if frame_paths:
                        vision_text = VisionService.extract_text_from_images(
                            frame_paths,
                            provider="openai",
                            model="gpt-4o",
                        )
                        if vision_text and vision_text.strip():
                            return MediaContent(
                                primary_text=vision_text.strip(),
                                secondary_texts=(
                                    [metadata.title.strip()] if metadata.title else []
                                ),
                                title=title,
                                media_metadata={**base_meta, "extraction_tier": "vision"},
                            )
                except Exception as exc:
                    logger.warning(
                        "TikTok vision analysis failed for %s: %s — "
                        "falling back to oEmbed",
                        source_id,
                        exc,
                    )
        finally:
            if tmpdir:
                shutil.rmtree(tmpdir, ignore_errors=True)

        # ------------------------------------------------------------------
        # Tier 3: oEmbed caption fallback (original behaviour)
        # ------------------------------------------------------------------
        description = (metadata.title or "").strip()
        if not description:
            raise PlatformFetchError(f"No text found for TikTok video {source_id}")

        return MediaContent(
            primary_text=description,
            secondary_texts=[],
            title=title,
            media_metadata={**base_meta, "extraction_tier": "oembed"},
        )


register_adapter(TikTokAdapter)
