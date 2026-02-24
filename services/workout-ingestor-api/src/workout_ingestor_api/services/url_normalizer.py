"""
URL normalization utilities for YouTube links.

Handles various YouTube URL formats and normalizes them to a canonical form
for consistent caching and lookup.
"""

from urllib.parse import urlparse, parse_qs
from typing import Optional, Tuple
import re


# Parameters to strip from YouTube URLs (tracking, playlist, timestamp)
STRIP_PARAMS = {'t', 'list', 'index', 'si', 'utm_source', 'utm_medium', 'utm_campaign', 'feature'}


def extract_youtube_video_id(url: str) -> Optional[str]:
    """
    Extract YouTube video ID from various URL formats.

    Supported formats:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    - https://youtube.com/v/VIDEO_ID
    - https://www.youtube.com/shorts/VIDEO_ID
    - VIDEO_ID (bare ID, 11 characters)

    Args:
        url: YouTube URL or video ID

    Returns:
        Video ID string or None if not found
    """
    if not url:
        return None

    url = url.strip()

    # Check if it's already a bare video ID (11 alphanumeric chars + _ and -)
    if re.match(r'^[A-Za-z0-9_-]{11}$', url):
        return url

    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or '').lower()

        # youtu.be/VIDEO_ID
        if hostname == 'youtu.be':
            video_id = parsed.path.lstrip('/')
            # Remove any trailing path segments
            video_id = video_id.split('/')[0]
            if video_id and len(video_id) == 11:
                return video_id
            return None

        # youtube.com variants
        if 'youtube' in hostname:
            # Standard watch URL: /watch?v=VIDEO_ID
            query = parse_qs(parsed.query)
            if 'v' in query and query['v']:
                return query['v'][0]

            # Embed URL: /embed/VIDEO_ID
            path_parts = parsed.path.split('/')
            if 'embed' in path_parts:
                idx = path_parts.index('embed')
                if idx + 1 < len(path_parts) and path_parts[idx + 1]:
                    return path_parts[idx + 1]

            # Old-style URL: /v/VIDEO_ID
            if '/v/' in parsed.path:
                idx = path_parts.index('v')
                if idx + 1 < len(path_parts) and path_parts[idx + 1]:
                    return path_parts[idx + 1]

            # Shorts URL: /shorts/VIDEO_ID
            if '/shorts/' in parsed.path:
                idx = path_parts.index('shorts')
                if idx + 1 < len(path_parts) and path_parts[idx + 1]:
                    return path_parts[idx + 1]

        return None
    except Exception:
        return None


def normalize_youtube_url(url: str) -> Optional[str]:
    """
    Normalize a YouTube URL to a canonical form for consistent caching.

    Normalization rules:
    - youtu.be/VIDEO_ID -> youtube.com/watch?v=VIDEO_ID
    - Strip tracking params (&t=, &list=, &index=, &si=, UTM params)
    - Lowercase domain
    - Remove www. prefix
    - Keep only the video ID in query string

    Args:
        url: YouTube URL in any format

    Returns:
        Normalized URL string like "youtube.com/watch?v=VIDEO_ID" or None if invalid
    """
    video_id = extract_youtube_video_id(url)
    if not video_id:
        return None

    # Canonical form: youtube.com/watch?v=VIDEO_ID (no https://, no www.)
    return f"youtube.com/watch?v={video_id}"


def get_full_youtube_url(video_id: str) -> str:
    """
    Get the full YouTube URL for a video ID.

    Args:
        video_id: YouTube video ID (11 characters)

    Returns:
        Full YouTube URL
    """
    return f"https://www.youtube.com/watch?v={video_id}"


def parse_youtube_url(url: str) -> Tuple[Optional[str], Optional[str], str]:
    """
    Parse a YouTube URL and return video ID, normalized URL, and original URL.

    Args:
        url: YouTube URL in any format

    Returns:
        Tuple of (video_id, normalized_url, original_url)
    """
    original = url.strip()
    video_id = extract_youtube_video_id(original)
    normalized = normalize_youtube_url(original) if video_id else None

    return video_id, normalized, original
