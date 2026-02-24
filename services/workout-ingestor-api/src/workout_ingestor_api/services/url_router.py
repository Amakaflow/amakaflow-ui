"""Route any URL to a platform name and source ID."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class RoutingResult:
    """Result of routing a URL."""
    platform: str
    source_id: str


# Each entry: (compiled_pattern, platform_name)
# The first capture group must be the source ID.
_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)"), "instagram"),
    (re.compile(r"youtube\.com/watch[^#]*[?&]v=([A-Za-z0-9_-]{11})"), "youtube"),
    (re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"), "youtube"),
    (re.compile(r"youtube\.com/shorts/([A-Za-z0-9_-]{11})"), "youtube"),
    (re.compile(r"tiktok\.com/@[\w.]+/video/(\d+)"), "tiktok"),
    (re.compile(r"vm\.tiktok\.com/([A-Za-z0-9]+)"), "tiktok"),
    (re.compile(r"pinterest\.com/pin/(\d+)"), "pinterest"),
    (re.compile(r"pin\.it/([A-Za-z0-9]+)"), "pinterest"),
    (re.compile(r"tiktok\.com/t/([A-Za-z0-9]+)"), "tiktok"),
    (re.compile(r"youtube\.com/live/([A-Za-z0-9_-]{11})"), "youtube"),
    (re.compile(r"pinterest\.com/[^/]+/[^/]+/[^/]+/(\d+)"), "pinterest"),
]


def route_url(url: str) -> Optional[RoutingResult]:
    """Route a URL to its platform and source ID."""
    for pattern, platform in _PATTERNS:
        match = pattern.search(url)
        if match:
            return RoutingResult(platform=platform, source_id=match.group(1))
    return None
