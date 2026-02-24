"""APNs push notification service for device sync (AMA-567 Phase D).

Sends silent push notifications to paired iOS devices to trigger
background workout sync after a workout is saved from the web app.
"""

import asyncio
import base64
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from backend.settings import Settings

logger = logging.getLogger(__name__)


@dataclass
class PushResult:
    """Result of a single push notification attempt."""

    device_token: str
    success: bool
    error: Optional[str] = None
    is_stale_token: bool = False


class APNsService:
    """Sends silent APNs push notifications via HTTP/2."""

    def __init__(self, settings: Settings):
        self._enabled = settings.apns_enabled
        self._bundle_id = settings.apns_bundle_id
        self._use_sandbox = settings.apns_use_sandbox
        self._mapper_url = settings.mapper_api_url
        self._client = None

        if self._enabled:
            if not all([settings.apns_team_id, settings.apns_key_id, settings.apns_key_base64]):
                logger.warning("APNs enabled but missing credentials (team_id, key_id, or key_base64)")
                self._enabled = False
                return

            try:
                from aioapns import APNs

                key_bytes = base64.b64decode(settings.apns_key_base64)
                self._client = APNs(
                    key=key_bytes,
                    key_id=settings.apns_key_id,
                    team_id=settings.apns_team_id,
                    topic=self._bundle_id,
                    use_sandbox=self._use_sandbox,
                )
                logger.info("APNs service initialized (sandbox=%s)", self._use_sandbox)
                if self._use_sandbox:
                    logger.warning(
                        "APNs using SANDBOX environment — pushes will not reach "
                        "production devices. Set APNS_USE_SANDBOX=false for production."
                    )
            except ImportError:
                logger.warning("aioapns not installed, APNs disabled")
                self._enabled = False
            except Exception as e:
                logger.error("Failed to initialize APNs client: %s", e)
                self._enabled = False

    @property
    def enabled(self) -> bool:
        return self._enabled

    async def send_silent_push(self, device_token: str, payload: dict) -> PushResult:
        """Send a silent push notification to a single device.

        Args:
            device_token: Hex-encoded APNs device token.
            payload: Custom data dict (e.g. {"workout_id": "..."}).

        Returns:
            PushResult with success status.
        """
        if not self._enabled or not self._client:
            return PushResult(device_token=device_token, success=False, error="APNs not enabled")

        try:
            from aioapns import NotificationRequest

            # Silent push: content-available=1, no alert/badge/sound
            apns_payload = {
                "aps": {"content-available": 1},
                **payload,
            }

            request = NotificationRequest(
                device_token=device_token,
                message=apns_payload,
                push_type="background",
                priority=5,  # Low priority for background pushes
            )

            response = await self._client.send_notification(request)

            if response.is_successful:
                logger.debug("Push sent to %s...", device_token[:8])
                return PushResult(device_token=device_token, success=True)
            else:
                stale = response.description in ("BadDeviceToken", "Unregistered")
                logger.warning(
                    "Push failed for %s...: %s %s%s",
                    device_token[:8],
                    response.status,
                    response.description,
                    " (stale token)" if stale else "",
                )
                return PushResult(
                    device_token=device_token,
                    success=False,
                    error=f"{response.status}: {response.description}",
                    is_stale_token=stale,
                )

        except Exception as e:
            logger.error("Push error for %s...: %s", device_token[:8], e)
            return PushResult(device_token=device_token, success=False, error=str(e))

    async def send_to_user(
        self,
        user_id: str,
        payload: dict,
        auth_token: str = "",
    ) -> list[PushResult]:
        """Fetch user's APNs tokens from mapper-api and send push to all devices.

        Args:
            user_id: Clerk user ID.
            payload: Custom data dict to include in push.
            auth_token: Auth token for mapper-api call.

        Returns:
            List of PushResult, one per device token.
        """
        if not self._enabled:
            logger.debug("APNs disabled, skipping push for user %s", user_id)
            return []

        # Fetch device tokens from mapper-api
        tokens = await self._fetch_user_tokens(user_id, auth_token)
        if not tokens:
            logger.info("No APNs tokens found for user %s", user_id)
            return []

        results = await asyncio.gather(
            *(self.send_silent_push(token, payload) for token in tokens)
        )

        sent = sum(1 for r in results if r.success)
        logger.info("Push sent to %d/%d devices for user %s", sent, len(results), user_id)
        return results

    async def _fetch_user_tokens(self, user_id: str, auth_token: str) -> list[str]:
        """Fetch APNs tokens for a user from mapper-api."""
        try:
            headers = {"Content-Type": "application/json"}
            if auth_token:
                headers["Authorization"] = auth_token

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self._mapper_url}/mobile/devices/push-tokens",
                    headers=headers,
                )

            if response.status_code != 200:
                logger.warning(
                    "Failed to fetch push tokens for user %s: %d",
                    user_id,
                    response.status_code,
                )
                return []

            data = response.json()
            return data.get("tokens", [])

        except Exception as e:
            logger.error("Error fetching push tokens for user %s: %s", user_id, e)
            return []
