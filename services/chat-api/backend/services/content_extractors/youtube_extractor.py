"""YouTube transcript extractor for KB content ingestion.

Implements the ContentExtractorPort protocol (AMA-656).

Protocol interface (inline reference — see application/ports/content_extractor_port.py
if AMA-656 is merged):
    can_handle(source_type: str) -> bool
    extract(source: dict) -> dict
"""

import logging
import re
from typing import Any, Dict
from urllib.parse import urlparse, parse_qs

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
)

logger = logging.getLogger(__name__)


class YouTubeExtractor:
    """Extracts transcripts from YouTube videos for KB ingestion.

    Supports the following URL formats:
      - https://www.youtube.com/watch?v=VIDEO_ID
      - https://youtu.be/VIDEO_ID
      - https://www.youtube.com/shorts/VIDEO_ID
    """

    def can_handle(self, source_type: str) -> bool:
        """Return True when source_type is 'youtube'."""
        return source_type == "youtube"

    def _extract_video_id(self, url: str) -> str:
        """Parse a YouTube URL and return the video ID.

        Args:
            url: A YouTube video URL in any of the supported formats.

        Returns:
            The video ID string.

        Raises:
            ValueError: If the URL does not match any recognised YouTube pattern.
        """
        parsed = urlparse(url)
        hostname = parsed.netloc.lower().replace("www.", "")

        # youtu.be/<VIDEO_ID>
        if hostname == "youtu.be":
            video_id = parsed.path.lstrip("/").split("/")[0]
            if video_id:
                return video_id

        # youtube.com/watch?v=<VIDEO_ID>
        if hostname in ("youtube.com", "m.youtube.com"):
            if parsed.path == "/watch":
                qs = parse_qs(parsed.query)
                ids = qs.get("v", [])
                if ids and ids[0]:
                    return ids[0]

            # youtube.com/shorts/<VIDEO_ID>
            shorts_match = re.match(r"^/shorts/([^/?&#]+)", parsed.path)
            if shorts_match:
                return shorts_match.group(1)

        raise ValueError(
            f"Could not extract video ID from URL: {url!r}. "
            "Supported formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID"
        )

    def extract(self, source: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch and return the transcript for a YouTube video.

        Args:
            source: A dict containing at minimum ``source_url`` (str).

        Returns:
            A dict with keys:
              - raw_content (str): Full transcript as a single space-joined string.
              - title (str): "YouTube: <video_id>".
              - source_url (str): The original URL.
              - metadata (dict): video_id and transcript_segments count.

        Raises:
            ValueError: If the URL is not a valid YouTube URL, or if no
                transcript is available for the video.
        """
        url: str = source["source_url"]
        video_id = self._extract_video_id(url)

        logger.info("Fetching YouTube transcript for video_id=%s", video_id)

        api = YouTubeTranscriptApi()
        try:
            fetched = api.fetch(video_id)
            segments = list(fetched)
        except NoTranscriptFound as exc:
            raise ValueError(
                f"No transcript found for YouTube video '{video_id}'. "
                "The video may not have captions enabled."
            ) from exc
        except TranscriptsDisabled as exc:
            raise ValueError(
                f"Transcript not available for YouTube video '{video_id}'. "
                "Captions are disabled for this video."
            ) from exc

        raw_content = " ".join(seg.text for seg in segments)

        return {
            "raw_content": raw_content,
            "title": f"YouTube: {video_id}",
            "source_url": url,
            "metadata": {
                "video_id": video_id,
                "transcript_segments": len(segments),
            },
        }
