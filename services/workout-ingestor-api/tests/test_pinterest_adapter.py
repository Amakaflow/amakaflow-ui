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
            mock_instance.get_pin_metadata = AsyncMock(return_value=p)
            mock_instance.resolve_short_url = AsyncMock(return_value=url)
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
            mock_instance.get_pin_metadata = AsyncMock(return_value=pin)
            mock_instance.resolve_short_url = AsyncMock(
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
            mock_instance.resolve_short_url = AsyncMock(
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


# ---------------------------------------------------------------------------
# Test 3 — Vision AI success path: image → vision text becomes primary_text
# ---------------------------------------------------------------------------

class TestPinterestAdapterVisionSuccess:
    """When VisionService returns text, it should become primary_text and
    the original description/title should be relegated to secondary_texts."""

    def _run_fetch_with_vision(
        self,
        pin: PinterestPin | None = None,
        vision_text: str = "10 push-ups, 20 squats, 30 lunges",
        url: str = "https://www.pinterest.com/pin/123456789/",
        source_id: str = "123456789",
    ) -> MediaContent:
        p = pin or _make_pin()
        with patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.PinterestService"
        ) as mock_svc_cls, patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.VisionService"
        ) as mock_vis_cls:
            mock_svc = MagicMock()
            mock_svc_cls.return_value = mock_svc
            mock_svc.resolve_short_url = AsyncMock(return_value=url)
            mock_svc.get_pin_metadata = AsyncMock(return_value=p)
            mock_svc.download_image = AsyncMock(return_value=b"fake-image-bytes")

            mock_vis_cls.extract_text_from_images = MagicMock(return_value=vision_text)

            adapter = PinterestAdapter()
            return adapter.fetch(url, source_id)

    def test_vision_text_becomes_primary_text(self):
        """When VisionService returns text, it is used as primary_text."""
        vision_text = "10 push-ups, 20 squats, 30 lunges"
        pin = _make_pin(
            description="30-minute full body HIIT. Squats, lunges, burpees.",
            title="HIIT Workout Infographic",
        )
        result = self._run_fetch_with_vision(pin=pin, vision_text=vision_text)

        assert result.primary_text == vision_text

    def test_original_description_in_secondary_texts_after_vision(self):
        """When vision succeeds, original description/title move to secondary_texts."""
        pin = _make_pin(
            description="30-minute full body HIIT. Squats, lunges, burpees.",
            title="HIIT Workout Infographic",
        )
        result = self._run_fetch_with_vision(pin=pin)

        # description and/or title should appear somewhere in secondary_texts
        combined_secondary = " ".join(result.secondary_texts)
        assert "HIIT" in combined_secondary or "Squats" in combined_secondary

    def test_vision_text_not_empty_means_no_fallback_to_description(self):
        """Non-empty vision text prevents the description from becoming primary_text."""
        vision_text = "Deadlifts 5x5 @ 80%"
        pin = _make_pin(description="This is the pin description.", title="Pin Title")
        result = self._run_fetch_with_vision(pin=pin, vision_text=vision_text)

        assert result.primary_text == vision_text
        assert result.primary_text != "This is the pin description."

    def test_vision_result_returns_media_content_instance(self):
        """Vision success path returns a valid MediaContent object."""
        result = self._run_fetch_with_vision()
        assert isinstance(result, MediaContent)


# ---------------------------------------------------------------------------
# Test 4 — Vision AI fallback path: vision fails → description as primary_text
# ---------------------------------------------------------------------------

class TestPinterestAdapterVisionFallback:
    """When VisionService raises an exception or returns empty text,
    the adapter should fall back to using the original description as primary_text."""

    def _run_fetch_vision_raises(
        self,
        pin: PinterestPin | None = None,
        vision_side_effect: Exception | None = None,
        url: str = "https://www.pinterest.com/pin/123456789/",
        source_id: str = "123456789",
    ) -> MediaContent:
        p = pin or _make_pin()
        exc = vision_side_effect or ValueError("OpenAI Vision API call failed")
        with patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.PinterestService"
        ) as mock_svc_cls, patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.VisionService"
        ) as mock_vis_cls:
            mock_svc = MagicMock()
            mock_svc_cls.return_value = mock_svc
            mock_svc.resolve_short_url = AsyncMock(return_value=url)
            mock_svc.get_pin_metadata = AsyncMock(return_value=p)
            mock_svc.download_image = AsyncMock(return_value=b"fake-image-bytes")

            mock_vis_cls.extract_text_from_images = MagicMock(side_effect=exc)

            adapter = PinterestAdapter()
            return adapter.fetch(url, source_id)

    def _run_fetch_vision_empty(
        self,
        pin: PinterestPin | None = None,
        url: str = "https://www.pinterest.com/pin/123456789/",
        source_id: str = "123456789",
    ) -> MediaContent:
        p = pin or _make_pin()
        with patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.PinterestService"
        ) as mock_svc_cls, patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.VisionService"
        ) as mock_vis_cls:
            mock_svc = MagicMock()
            mock_svc_cls.return_value = mock_svc
            mock_svc.resolve_short_url = AsyncMock(return_value=url)
            mock_svc.get_pin_metadata = AsyncMock(return_value=p)
            mock_svc.download_image = AsyncMock(return_value=b"fake-image-bytes")

            mock_vis_cls.extract_text_from_images = MagicMock(return_value="   ")

            adapter = PinterestAdapter()
            return adapter.fetch(url, source_id)

    def test_vision_exception_falls_back_to_description(self):
        """When VisionService raises, description is used as primary_text."""
        pin = _make_pin(description="5x5 Squat program. Progressive overload.")
        result = self._run_fetch_vision_raises(pin=pin)
        assert result.primary_text == "5x5 Squat program. Progressive overload."

    def test_vision_empty_text_falls_back_to_description(self):
        """When VisionService returns blank text, description is used as primary_text."""
        pin = _make_pin(description="Push pull legs routine.")
        result = self._run_fetch_vision_empty(pin=pin)
        assert result.primary_text == "Push pull legs routine."

    def test_vision_fallback_returns_media_content(self):
        """Vision fallback path still returns a valid MediaContent."""
        result = self._run_fetch_vision_raises()
        assert isinstance(result, MediaContent)

    def test_no_image_url_falls_back_to_description(self):
        """When pin has no image_url, skip vision and use description as primary_text."""
        pin = _make_pin(
            description="No image available but has description.",
            image_url="",
        )
        # No vision mock needed — pin has no image_url so vision is never called
        with patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.PinterestService"
        ) as mock_svc_cls:
            mock_svc = MagicMock()
            mock_svc_cls.return_value = mock_svc
            mock_svc.resolve_short_url = AsyncMock(
                return_value="https://www.pinterest.com/pin/123456789/"
            )
            mock_svc.get_pin_metadata = AsyncMock(return_value=pin)
            adapter = PinterestAdapter()
            result = adapter.fetch("https://www.pinterest.com/pin/123456789/", "123456789")

        assert result.primary_text == "No image available but has description."


# ---------------------------------------------------------------------------
# Test 5 — asyncio.run() fix: no RuntimeError in async context
# ---------------------------------------------------------------------------

class TestPinterestAdapterAsyncioFix:
    """Verify that fetch() does not raise RuntimeError when called from within
    an already-running event loop (e.g. an async test or FastAPI handler)."""

    @pytest.mark.asyncio
    async def test_no_runtime_error_in_async_context(self):
        """fetch() must not raise 'This event loop is already running'."""
        pin = _make_pin()
        url = "https://www.pinterest.com/pin/123456789/"
        with patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.PinterestService"
        ) as mock_svc_cls, patch(
            "workout_ingestor_api.services.adapters.pinterest_adapter.VisionService"
        ) as mock_vis_cls:
            mock_svc = MagicMock()
            mock_svc_cls.return_value = mock_svc
            mock_svc.resolve_short_url = AsyncMock(return_value=url)
            mock_svc.get_pin_metadata = AsyncMock(return_value=pin)
            mock_svc.download_image = AsyncMock(return_value=b"fake-image-bytes")
            mock_vis_cls.extract_text_from_images = MagicMock(
                return_value="10 squats, 10 push-ups"
            )

            adapter = PinterestAdapter()
            # This must NOT raise RuntimeError: This event loop is already running
            result = adapter.fetch(url, "123456789")

        assert isinstance(result, MediaContent)
