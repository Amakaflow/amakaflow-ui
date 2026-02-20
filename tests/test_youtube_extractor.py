"""Unit tests for YouTubeExtractor (AMA-657)."""

from unittest.mock import patch, MagicMock

import pytest

from backend.services.content_extractors.youtube_extractor import YouTubeExtractor


@pytest.fixture
def extractor():
    return YouTubeExtractor()


def _make_snippet(text: str) -> MagicMock:
    """Create a mock FetchedTranscriptSnippet with a .text attribute."""
    snippet = MagicMock()
    snippet.text = text
    return snippet


# =============================================================================
# can_handle
# =============================================================================


class TestCanHandle:
    def test_returns_true_for_youtube(self, extractor):
        assert extractor.can_handle("youtube") is True

    def test_returns_false_for_other_types(self, extractor):
        assert extractor.can_handle("url") is False
        assert extractor.can_handle("pdf") is False
        assert extractor.can_handle("") is False


# =============================================================================
# _extract_video_id
# =============================================================================


class TestExtractVideoId:
    def test_watch_url(self, extractor):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert extractor._extract_video_id(url) == "dQw4w9WgXcQ"

    def test_short_url(self, extractor):
        url = "https://youtu.be/dQw4w9WgXcQ"
        assert extractor._extract_video_id(url) == "dQw4w9WgXcQ"

    def test_shorts_url(self, extractor):
        url = "https://www.youtube.com/shorts/dQw4w9WgXcQ"
        assert extractor._extract_video_id(url) == "dQw4w9WgXcQ"

    def test_invalid_url_raises_value_error(self, extractor):
        with pytest.raises(ValueError, match="Could not extract video ID"):
            extractor._extract_video_id("https://vimeo.com/123456")

    def test_watch_url_with_extra_params(self, extractor):
        url = "https://www.youtube.com/watch?v=abc123&t=30s&list=PL123"
        assert extractor._extract_video_id(url) == "abc123"


# =============================================================================
# extract
# =============================================================================

_MOCK_SNIPPETS = [
    _make_snippet("Hello world"),
    _make_snippet("this is a test"),
    _make_snippet("transcript"),
]


def _patch_api(return_value=None, side_effect=None):
    """Return a context manager that patches YouTubeTranscriptApi at the module level."""
    mock_api_instance = MagicMock()
    if side_effect is not None:
        mock_api_instance.fetch.side_effect = side_effect
    else:
        mock_fetched = MagicMock()
        mock_fetched.__iter__ = MagicMock(return_value=iter(return_value or []))
        mock_api_instance.fetch.return_value = mock_fetched

    return patch(
        "backend.services.content_extractors.youtube_extractor.YouTubeTranscriptApi",
        return_value=mock_api_instance,
    )


class TestExtract:
    def test_joins_transcript_segments_into_single_string(self, extractor):
        with _patch_api(return_value=_MOCK_SNIPPETS):
            result = extractor.extract({"source_url": "https://youtu.be/dQw4w9WgXcQ"})

        assert result["raw_content"] == "Hello world this is a test transcript"

    def test_returns_expected_keys(self, extractor):
        with _patch_api(return_value=_MOCK_SNIPPETS):
            result = extractor.extract({"source_url": "https://youtu.be/dQw4w9WgXcQ"})

        assert result["title"] == "YouTube: dQw4w9WgXcQ"
        assert result["source_url"] == "https://youtu.be/dQw4w9WgXcQ"
        assert result["metadata"]["video_id"] == "dQw4w9WgXcQ"
        assert result["metadata"]["transcript_segments"] == 3

    def test_no_transcript_found_raises_value_error(self, extractor):
        from youtube_transcript_api._errors import NoTranscriptFound

        with _patch_api(side_effect=NoTranscriptFound("dQw4w9WgXcQ", ["en"], {})):
            with pytest.raises(ValueError, match="No transcript found"):
                extractor.extract({"source_url": "https://youtu.be/dQw4w9WgXcQ"})

    def test_transcripts_disabled_raises_value_error(self, extractor):
        from youtube_transcript_api._errors import TranscriptsDisabled

        with _patch_api(side_effect=TranscriptsDisabled("dQw4w9WgXcQ")):
            with pytest.raises(ValueError, match="Transcript not available"):
                extractor.extract({"source_url": "https://youtu.be/dQw4w9WgXcQ"})
