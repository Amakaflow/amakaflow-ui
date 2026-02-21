"""Article extractor: fetches and cleans arbitrary web articles (AMA-656).

Handles source_type "url". Uses readability-lxml to distil the main prose from
a page and strips any remaining HTML so the downstream pipeline receives clean
plain text.
"""

import logging
import re

import httpx
from readability import Document

logger = logging.getLogger(__name__)

# Maximum response body size in bytes before truncation (500 KB).
_MAX_CONTENT_BYTES = 500 * 1024

# Browser-like User-Agent to avoid bot-blocking on most public pages.
_USER_AGENT = "AmakaFlow/1.0 (Knowledge Base)"


def _strip_html(html: str) -> str:
    """Remove HTML tags from *html* and collapse whitespace into single spaces."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class ArticleExtractor:
    """Extracts readable plain-text content from a public URL.

    Satisfies the ContentExtractorPort protocol — no explicit base class is
    needed; isinstance checks use runtime_checkable on the Protocol.
    """

    def can_handle(self, source_type: str) -> bool:
        """Return True only for source_type "url"."""
        return source_type == "url"

    def extract(self, source: dict) -> dict:
        """Fetch *source['source_url']* and return cleaned article text.

        Args:
            source: Dict with at minimum a "source_url" key.

        Returns:
            Dict with keys: raw_content, title, source_url, metadata.

        Raises:
            ValueError: On network errors (timeout, connection failure) or when
                source_url is missing.
        """
        url: str = source.get("source_url", "").strip()
        if not url:
            raise ValueError("source_url is required for ArticleExtractor")

        logger.debug("ArticleExtractor fetching %s", url)

        try:
            with httpx.Client(timeout=15, headers={"User-Agent": _USER_AGENT}) as client:
                response = client.get(url)
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise ValueError(f"Request timed out fetching {url}") from exc
        except httpx.ConnectError as exc:
            raise ValueError(f"Connection error fetching {url}") from exc
        except httpx.HTTPError as exc:
            raise ValueError(f"Failed to fetch {url}: {exc}") from exc

        # Truncate to MAX_CONTENT_BYTES before decoding to avoid OOM on huge pages.
        raw_bytes = response.content[:_MAX_CONTENT_BYTES]
        # Decode with replacement so partial multi-byte sequences don't crash.
        encoding = response.encoding or "utf-8"
        html = raw_bytes.decode(encoding, errors="replace")

        doc = Document(html)
        title: str = doc.title() or ""
        summary_html: str = doc.summary()
        plain_text = _strip_html(summary_html)

        return {
            "raw_content": plain_text,
            "title": title,
            "source_url": url,
            "metadata": {"content_length": len(plain_text)},
        }
