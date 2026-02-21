"""Unit tests for ArticleExtractor (AMA-656).

All HTTP calls are mocked so tests run offline without touching the network.
"""

import pytest
import httpx
from unittest.mock import MagicMock, patch

from backend.services.content_extractors.article_extractor import ArticleExtractor


class TestArticleExtractorCanHandle:
    def test_handles_url_source_type(self):
        """can_handle returns True for source_type 'url'."""
        extractor = ArticleExtractor()
        assert extractor.can_handle("url") is True

    def test_rejects_other_source_types(self):
        """can_handle returns False for non-url source types."""
        extractor = ArticleExtractor()
        assert extractor.can_handle("youtube") is False
        assert extractor.can_handle("pdf") is False
        assert extractor.can_handle("manual") is False


class TestArticleExtractorExtract:
    def _make_response(self, html: str, encoding: str = "utf-8") -> MagicMock:
        """Build a minimal mock httpx.Response."""
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.content = html.encode(encoding)
        mock_resp.encoding = encoding
        mock_resp.raise_for_status.return_value = None
        return mock_resp

    @patch("backend.services.content_extractors.article_extractor.httpx.Client")
    def test_extract_returns_cleaned_text_and_title(self, mock_client_cls):
        """extract strips HTML tags and returns plain text with the page title."""
        html = """
        <html>
          <head><title>10 Best Squat Variations</title></head>
          <body>
            <article>
              <p>The squat is a foundational lower-body exercise.</p>
              <p>It targets quads, glutes, and hamstrings effectively.</p>
            </article>
          </body>
        </html>
        """
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = self._make_response(html)
        mock_client_cls.return_value = mock_client

        extractor = ArticleExtractor()
        result = extractor.extract({"source_url": "https://example.com/squats"})

        assert result["source_url"] == "https://example.com/squats"
        assert result["title"] == "10 Best Squat Variations"
        # Plain text must not contain any HTML tags
        assert "<" not in result["raw_content"]
        assert ">" not in result["raw_content"]
        # Core content must be present
        assert "squat" in result["raw_content"].lower()
        # Metadata carries content_length
        assert result["metadata"]["content_length"] == len(result["raw_content"])

    @patch("backend.services.content_extractors.article_extractor.httpx.Client")
    def test_extract_raises_value_error_on_timeout(self, mock_client_cls):
        """extract raises ValueError when the request times out."""
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.TimeoutException("timed out")
        mock_client_cls.return_value = mock_client

        extractor = ArticleExtractor()
        with pytest.raises(ValueError, match="timed out"):
            extractor.extract({"source_url": "https://slow-site.example.com/"})

    @patch("backend.services.content_extractors.article_extractor.httpx.Client")
    def test_extract_raises_value_error_on_connection_error(self, mock_client_cls):
        """extract raises ValueError on connection failure."""
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.ConnectError("no route to host")
        mock_client_cls.return_value = mock_client

        extractor = ArticleExtractor()
        with pytest.raises(ValueError, match="Connection error"):
            extractor.extract({"source_url": "https://unreachable.example.com/"})

    def test_extract_raises_value_error_when_url_missing(self):
        """extract raises ValueError when source_url is absent."""
        extractor = ArticleExtractor()
        with pytest.raises(ValueError, match="source_url is required"):
            extractor.extract({})
