"""Integration test for Instagram Reel ingestion (requires APIFY_API_TOKEN)."""
import os
import pytest
from workout_ingestor_api.services.instagram_reel_service import InstagramReelService

SKIP_REASON = "Set APIFY_API_TOKEN and OPENAI_API_KEY to run integration tests"


@pytest.mark.skipif(
    not os.getenv("APIFY_API_TOKEN") or not os.getenv("OPENAI_API_KEY"),
    reason=SKIP_REASON,
)
def test_real_reel_ingestion():
    """Test with an actual public Instagram Reel URL.

    This test verifies the full pipeline: Apify fetch -> LLM parse -> structured output.
    The test reel should be a fitness-related reel with identifiable exercises.
    """
    # Use a known fitness reel URL — update if this becomes unavailable
    url = "https://www.instagram.com/reel/DRHiuniDM1K/"

    result = InstagramReelService.ingest_reel(url=url)

    # Core structure assertions
    assert "title" in result
    assert "blocks" in result
    assert isinstance(result["blocks"], list)
    assert result["_provenance"]["mode"] == "instagram_reel"
    assert result["_provenance"]["source_url"] == url
    assert "shortcode" in result["_provenance"]
    assert "extraction_method" in result["_provenance"]
