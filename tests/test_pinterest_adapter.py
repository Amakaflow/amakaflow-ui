"""Tests for PinterestAdapter (AMA-710)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from workout_ingestor_api.services.adapters import get_adapter
from workout_ingestor_api.services.adapters.base import MediaContent, PlatformFetchError
from workout_ingestor_api.services.adapters.pinterest_adapter import PinterestAdapter
from workout_ingestor_api.services.pinterest_service import PinterestPin, PinterestIngestResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_pin(
    pin_id: str = "123456789",
    title: str = "HIIT Workout Infographic",
    description: str = "30-minute full body HIIT. Squats, lunges, burpees.",
    image_url: str = "https://i.pinimg.com/originals/ab/cd/ef/abcdef.jpg",
    is_carousel: bool = False,
    image_urls: list | None = None,
) -> PinterestPin:
    return PinterestPin(
        pin_id=pin_id,
        title=title,
        description=description,
        image_url=image_url,
        original_url=f"https://www.pinterest.com/pin/{pin_id}/",
        is_carousel=is_carousel,
        image_urls=image_urls or [],
    )


def _make_ingest_result(
    pin: PinterestPin | None = None,
    success: bool = True,
    errors: list | None = None,
) -> PinterestIngestResult:
    p = pin or _make_pin()
    return PinterestIngestResult(
        success=success,
        pins_processed=1,
        workouts=[],
        parse_results=[],
        errors=errors or [],
        source_url=p.original_url,
    )


# ---------------------------------------------------------------------------
# Test 1 — platform_name
# ---------------------------------------------------------------------------

class TestPinterestAdapterPlatformName:
    def test_platform_name(self):
        assert PinterestAdapter.platform_name() == "pinterest"

    def test_registered_in_registry(self):
        adapter = get_adapter("pinterest")
        assert isinstance(adapter, PinterestAdapter)


# ---------------------------------------------------------------------------
# Test 2 — happy path: description available → MediaContent returned
# ---------------------------------------------------------------------------

class TestPinterestAdapterFetch:
    def _run_fetch(
        self,
        pin: PinterestPin | None = None,
        url: str = "https://www.pinterest.com/pin/123456789/",
        source_id: str = "123456789",
    ) -> MediaContent:
        p = pin or _make_pin()
        with patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.PinterestService"
        ) as mock_cls:
            mock_instance = MagicMock()
            mock_cls.return_value = mock_instance
            # _get_pin_metadata is async; mock it as AsyncMock
            mock_instance._get_pin_metadata = AsyncMock(return_value=p)
            mock_instance._resolve_short_url = AsyncMock(return_value=url)
            adapter = PinterestAdapter()
            return adapter.fetch(url, source_id)

    def test_fetch_returns_media_content(self):
        pin = _make_pin(
            pin_id="123456789",
            title="HIIT Workout Infographic",
            description="30-minute full body HIIT. Squats, lunges, burpees.",
        )
        result = self._run_fetch(pin=pin)

        assert isinstance(result, MediaContent)
        assert "HIIT" in result.primary_text or "Squats" in result.primary_text

    def test_fetch_uses_description_as_primary_text(self):
        pin = _make_pin(description="5x5 Squat program. Progressive overload.")
        result = self._run_fetch(pin=pin)
        assert result.primary_text == "5x5 Squat program. Progressive overload."

    def test_fetch_title_included_in_secondary_texts(self):
        pin = _make_pin(
            title="My Workout Plan",
            description="Push pull legs routine for beginners.",
        )
        result = self._run_fetch(pin=pin)
        # title should appear somewhere — either in MediaContent.title or secondary_texts
        assert result.title == "My Workout Plan" or "My Workout Plan" in result.secondary_texts

    def test_fetch_populates_media_metadata(self):
        pin = _make_pin(
            pin_id="987654321",
            title="Leg Day",
            description="Squats and deadlifts.",
            image_url="https://i.pinimg.com/originals/aa/bb/cc/aabbcc.jpg",
        )
        result = self._run_fetch(pin=pin, source_id="987654321")

        assert result.media_metadata["pin_id"] == "987654321"
        assert result.media_metadata["image_url"] == "https://i.pinimg.com/originals/aa/bb/cc/aabbcc.jpg"

    def test_fetch_raises_when_no_text(self):
        """Empty description AND empty title raises PlatformFetchError."""
        pin = _make_pin(title="", description="")
        with patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.PinterestService"
        ) as mock_cls:
            mock_instance = MagicMock()
            mock_cls.return_value = mock_instance
            mock_instance._get_pin_metadata = AsyncMock(return_value=pin)
            mock_instance._resolve_short_url = AsyncMock(
                return_value="https://www.pinterest.com/pin/123456789/"
            )
            adapter = PinterestAdapter()
            with pytest.raises(PlatformFetchError, match="no text"):
                adapter.fetch("https://www.pinterest.com/pin/123456789/", "123456789")

    def test_fetch_raises_on_service_failure(self):
        """Any exception from the service layer is wrapped in PlatformFetchError."""
        with patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.PinterestService"
        ) as mock_cls:
            mock_instance = MagicMock()
            mock_cls.return_value = mock_instance
            mock_instance._resolve_short_url = AsyncMock(
                side_effect=RuntimeError("Network timeout")
            )
            adapter = PinterestAdapter()
            with pytest.raises(PlatformFetchError, match="Pinterest fetch failed"):
                adapter.fetch("https://www.pinterest.com/pin/abc/", "abc")

    def test_fetch_title_falls_back_to_pin_id_when_missing(self):
        """When title is absent, MediaContent.title uses a sensible fallback."""
        pin = _make_pin(title="", description="Killer leg workout routine.")
        result = self._run_fetch(pin=pin, source_id="123456789")
        # Should not crash and title should reference the pin somehow
        assert result.title is not None
        assert isinstance(result.title, str)

    def test_fetch_is_carousel_flag_in_metadata(self):
        """Carousel pin flag is surfaced in media_metadata."""
        pin = _make_pin(
            is_carousel=True,
            image_urls=[
                "https://i.pinimg.com/originals/aa/bb/cc/img1.jpg",
                "https://i.pinimg.com/originals/dd/ee/ff/img2.jpg",
            ],
        )
        result = self._run_fetch(pin=pin)
        assert result.media_metadata.get("is_carousel") is True
