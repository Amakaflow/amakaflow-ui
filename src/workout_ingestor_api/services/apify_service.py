"""Apify actor client for Instagram Reel scraping."""

import logging
from typing import Any, Dict

from apify_client import ApifyClient

from workout_ingestor_api.config import settings

logger = logging.getLogger(__name__)

REEL_SCRAPER_ACTOR_ID = "apify/instagram-reel-scraper"


class ApifyServiceError(RuntimeError):
    """Raised when an Apify actor call fails."""


class ApifyService:
    """Wrapper around apify-client for Instagram Reel scraping."""

    @staticmethod
    def fetch_reel_data(
        url: str,
        timeout_secs: int = 120,
    ) -> Dict[str, Any]:
        """
        Run the Instagram Reel Scraper actor and return the first result.

        Args:
            url: Instagram Reel URL
            timeout_secs: Max wait time for actor run

        Returns:
            Dict with reel metadata including caption, transcript,
            videoDuration, videoUrl, ownerUsername, etc.

        Raises:
            ApifyServiceError: If token missing, actor fails, or no data returned
        """
        token = settings.APIFY_API_TOKEN
        if not token:
            raise ApifyServiceError(
                "APIFY_API_TOKEN not configured. Set the environment variable."
            )

        client = ApifyClient(token)

        run_input = {
            "username": [url],
            "resultsLimit": 1,
        }

        logger.info(f"Running Apify reel scraper for URL: {url[:80]}")

        try:
            run = client.actor(REEL_SCRAPER_ACTOR_ID).call(
                run_input=run_input,
                timeout_secs=timeout_secs,
            )
        except Exception as e:
            raise ApifyServiceError(f"Apify actor call failed: {e}") from e

        dataset_id = run.get("defaultDatasetId")
        if not dataset_id:
            raise ApifyServiceError("Apify run completed but returned no dataset ID.")

        items = list(client.dataset(dataset_id).iterate_items())
        if not items:
            raise ApifyServiceError(
                f"No reel data returned by Apify for URL: {url}"
            )

        reel = items[0]
        logger.info(
            f"Apify reel scraper returned: shortCode={reel.get('shortCode')}, "
            f"duration={reel.get('videoDuration')}s, "
            f"has_transcript={bool(reel.get('transcript'))}"
        )
        return reel
