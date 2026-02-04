"""AsyncFunctionDispatcher for executing tool functions asynchronously.

Dispatches tool calls to external services (mapper-api, calendar-api, workout-ingestor-api)
with async HTTP calls using httpx.AsyncClient.

Part of AMA-505: Convert Streaming to Async Patterns
Updated in AMA-506: Add OpenTelemetry tracing and metrics
"""

import base64
import io
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set, TYPE_CHECKING

from opentelemetry.trace import SpanKind

from backend.observability import get_tracer, ChatMetrics

if TYPE_CHECKING:
    from infrastructure.db.async_function_rate_limit_repository import (
        AsyncSupabaseFunctionRateLimitRepository,
    )
    from backend.services.feature_flag_service import FeatureFlagService
from urllib.parse import urlparse

import httpx


# =============================================================================
# Security: Allowed domains for content ingestion (SSRF prevention)
# =============================================================================

YOUTUBE_ALLOWED_DOMAINS: Set[str] = {
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "m.youtube.com",
}

TIKTOK_ALLOWED_DOMAINS: Set[str] = {
    "tiktok.com",
    "www.tiktok.com",
    "vm.tiktok.com",
    "m.tiktok.com",
}

INSTAGRAM_ALLOWED_DOMAINS: Set[str] = {
    "instagram.com",
    "www.instagram.com",
    "m.instagram.com",
}

PINTEREST_ALLOWED_DOMAINS: Set[str] = {
    "pinterest.com",
    "www.pinterest.com",
    "pin.it",
    "m.pinterest.com",
}

# Maximum image size: 10MB
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

# =============================================================================
# Security: ID validation pattern (prevents path traversal)
# =============================================================================
# Accepts UUIDs and alphanumeric IDs with hyphens/underscores (1-64 chars)
ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")

logger = logging.getLogger(__name__)


@dataclass
class FunctionContext:
    """Context passed to function handlers."""

    user_id: str
    auth_token: Optional[str] = None


class FunctionExecutionError(Exception):
    """User-friendly error for function failures."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class AsyncFunctionDispatcher:
    """Async dispatcher for tool function calls to external services."""

    def __init__(
        self,
        mapper_api_url: str,
        calendar_api_url: str,
        ingestor_api_url: str,
        timeout: float = 30.0,
        strava_sync_api_url: Optional[str] = None,
        garmin_sync_api_url: Optional[str] = None,
        function_rate_limit_repo: Optional["AsyncSupabaseFunctionRateLimitRepository"] = None,
        feature_flag_service: Optional["FeatureFlagService"] = None,
        sync_rate_limit_per_hour: int = 3,
    ):
        self._mapper_url = mapper_api_url
        self._calendar_url = calendar_api_url
        self._ingestor_url = ingestor_api_url
        self._strava_sync_url = strava_sync_api_url or "http://localhost:8004"
        self._garmin_sync_url = garmin_sync_api_url or "http://localhost:8005"
        self._client = httpx.AsyncClient(timeout=timeout)
        self._rate_limit_repo = function_rate_limit_repo
        self._feature_flags = feature_flag_service
        self._sync_rate_limit = sync_rate_limit_per_hour

        self._handlers: Dict[
            str, Callable[[Dict[str, Any], FunctionContext], Awaitable[str]]
        ] = {
            # Phase 1
            "search_workout_library": self._search_workout_library,
            "add_workout_to_calendar": self._add_workout_to_calendar,
            "generate_ai_workout": self._generate_ai_workout,
            "navigate_to_page": self._navigate_to_page,
            # Phase 2
            "import_from_youtube": self._import_from_youtube,
            "import_from_tiktok": self._import_from_tiktok,
            "import_from_instagram": self._import_from_instagram,
            "import_from_pinterest": self._import_from_pinterest,
            "import_from_image": self._import_from_image,
            "save_imported_workout": self._save_imported_workout,
            # Phase 3
            "edit_workout": self._edit_workout,
            "export_workout": self._export_workout,
            "duplicate_workout": self._duplicate_workout,
            "log_workout_completion": self._log_workout_completion,
            "get_workout_history": self._get_workout_history,
            "get_workout_details": self._get_workout_details,
            # Phase 4
            "get_calendar_events": self._get_calendar_events,
            "reschedule_workout": self._reschedule_workout,
            "cancel_scheduled_workout": self._cancel_scheduled_workout,
            "sync_strava": self._sync_strava,
            "sync_garmin": self._sync_garmin,
            "get_strava_activities": self._get_strava_activities,
        }

    async def close(self) -> None:
        """Close the async HTTP client connection pool."""
        await self._client.aclose()

    async def __aenter__(self) -> "AsyncFunctionDispatcher":
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit - close the client."""
        await self.close()

    async def execute(
        self,
        function_name: str,
        arguments: Dict[str, Any],
        context: FunctionContext,
    ) -> str:
        """Execute function and return result string for Claude.

        Args:
            function_name: Name of the tool function to execute.
            arguments: Parsed arguments from Claude's tool use.
            context: User context with auth info.

        Returns:
            Result string to send back to Claude.
        """
        handler = self._handlers.get(function_name)
        if not handler:
            ChatMetrics.tool_execution_seconds().record(
                0, {"tool_name": function_name, "status": "unknown"}
            )
            return self._error_response("unknown_function", f"Unknown function '{function_name}'")

        tracer = get_tracer()
        start_time = time.time()

        with tracer.start_as_current_span(
            f"tool.{function_name}",
            kind=SpanKind.CLIENT,
            attributes={
                "tool.name": function_name,
                "user.id": context.user_id,
            },
        ) as span:
            try:
                result = await handler(arguments, context)
                duration = time.time() - start_time
                ChatMetrics.tool_execution_seconds().record(
                    duration, {"tool_name": function_name, "status": "success"}
                )
                span.set_attribute("tool.duration_seconds", duration)
                return result
            except FunctionExecutionError as e:
                duration = time.time() - start_time
                ChatMetrics.tool_execution_seconds().record(
                    duration, {"tool_name": function_name, "status": "error"}
                )
                span.set_attribute("tool.duration_seconds", duration)
                span.set_attribute("error.type", "execution_error")
                span.set_attribute("error.message", e.message)
                return self._error_response("execution_error", e.message)
            except Exception as e:
                duration = time.time() - start_time
                ChatMetrics.tool_execution_seconds().record(
                    duration, {"tool_name": function_name, "status": "error"}
                )
                span.set_attribute("tool.duration_seconds", duration)
                span.set_attribute("error.type", "internal_error")
                span.record_exception(e)
                logger.exception("Error in async function %s", function_name)
                return self._error_response("internal_error", "An unexpected error occurred. Please try again.")

    def _error_response(self, code: str, message: str) -> str:
        """Create a standardized error response for Claude."""
        return json.dumps({"error": True, "code": code, "message": message})

    def _validate_url(
        self, url: Optional[str], allowed_domains: Set[str], platform: str
    ) -> Optional[str]:
        """Validate URL is non-empty and from allowed domains (SSRF prevention)."""
        if not url or not url.strip():
            return self._error_response("validation_error", "URL cannot be empty")

        try:
            parsed = urlparse(url.strip())

            if parsed.scheme not in ("http", "https"):
                return self._error_response(
                    "validation_error",
                    "Invalid URL. Must start with http:// or https://"
                )

            domain = parsed.netloc.lower()
            if ":" in domain:
                domain = domain.split(":")[0]

            if domain not in allowed_domains:
                return self._error_response(
                    "validation_error",
                    f"Invalid {platform} URL. Please provide a valid {platform} link."
                )

            return None  # Valid

        except Exception:
            return self._error_response("validation_error", "Invalid URL format")

    def _validate_id(self, value: Optional[str], field_name: str) -> Optional[str]:
        """Validate ID format to prevent path traversal attacks."""
        if not value or not value.strip():
            return self._error_response(
                "validation_error", f"Missing required field: {field_name}"
            )

        if not ID_PATTERN.match(value.strip()):
            return self._error_response(
                "validation_error", f"Invalid {field_name} format"
            )

        return None  # Valid

    def _validate_id_list(
        self, values: Optional[List[str]], field_name: str
    ) -> Optional[str]:
        """Validate a list of IDs."""
        if not values or len(values) == 0:
            return self._error_response(
                "validation_error", f"Missing required field: {field_name}"
            )

        for value in values:
            if not value or not ID_PATTERN.match(str(value).strip()):
                return self._error_response(
                    "validation_error", f"Invalid ID format in {field_name}"
                )

        return None  # Valid

    async def _call_api(
        self,
        method: str,
        url: str,
        context: FunctionContext,
        **kwargs,
    ) -> Dict[str, Any]:
        """Async HTTP call with error handling and auth forwarding."""
        headers = kwargs.pop("headers", {})
        if context.auth_token:
            headers["Authorization"] = context.auth_token
        headers["X-User-Id"] = context.user_id

        try:
            response = await self._client.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            raise FunctionExecutionError(
                "The service is taking too long. Please try again."
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise FunctionExecutionError(
                    "Authentication error. Please try logging in again."
                )
            elif e.response.status_code == 404:
                raise FunctionExecutionError("The requested item was not found.")
            raise FunctionExecutionError(f"Service error ({e.response.status_code})")
        except httpx.RequestError:
            raise FunctionExecutionError("Unable to connect to the service.")

    async def _call_multipart_api(
        self,
        url: str,
        context: FunctionContext,
        files: Dict[str, Any],
        data: Dict[str, Any],
        error_context: str = "processing",
    ) -> Dict[str, Any]:
        """Async HTTP multipart POST with error handling and auth forwarding."""
        headers: Dict[str, str] = {}
        if context.auth_token:
            headers["Authorization"] = context.auth_token
        headers["X-User-Id"] = context.user_id

        try:
            response = await self._client.post(url, files=files, data=data, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            raise FunctionExecutionError(
                f"{error_context} is taking too long. Please try again."
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise FunctionExecutionError(
                    "Authentication error. Please try logging in again."
                )
            raise FunctionExecutionError(
                f"{error_context} failed ({e.response.status_code})"
            )
        except httpx.RequestError:
            raise FunctionExecutionError(
                f"Unable to connect to the {error_context.lower()} service."
            )

    # --- Function Handlers ---

    async def _search_workout_library(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Search workouts via mapper-api semantic search."""
        query = args.get("query", "")
        max_results = min(args.get("limit", 5), 10)

        result = await self._call_api(
            "GET",
            f"{self._mapper_url}/workouts/search",
            ctx,
            params={"q": query, "limit": max_results},
        )

        workouts = result.get("results", [])[:max_results]
        if not workouts:
            return "No workouts found matching your search."

        lines = ["Found these workouts:"]
        for i, w in enumerate(workouts, 1):
            title = w.get("title", "Untitled")
            lines.append(f"{i}. {title} (ID: {w.get('workout_id', 'unknown')})")
        return "\n".join(lines)

    async def _add_workout_to_calendar(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Schedule a workout via calendar-api."""
        workout_id = args.get("workout_id")
        date = args.get("date")
        time = args.get("time")

        if not workout_id or not date:
            return self._error_response(
                "validation_error", "Missing required fields: workout_id and date are required."
            )

        body = {
            "workout_id": workout_id,
            "scheduled_date": date,
            "scheduled_time": time,
        }

        await self._call_api(
            "POST",
            f"{self._calendar_url}/calendar",
            ctx,
            json=body,
        )

        return f"Added workout to calendar on {date}" + (f" at {time}" if time else "")

    async def _generate_ai_workout(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Generate a workout via workout-ingestor-api."""
        description = args.get("description", "")

        body: Dict[str, Any] = {
            "transcription": description,
        }
        if args.get("difficulty"):
            body["difficulty"] = args["difficulty"]
        if args.get("duration_minutes"):
            body["duration_minutes"] = args["duration_minutes"]
        if args.get("equipment"):
            body["equipment"] = args["equipment"]

        result = await self._call_api(
            "POST",
            f"{self._ingestor_url}/workouts/parse-voice",
            ctx,
            json=body,
        )

        if not result.get("success"):
            return self._error_response(
                "generation_failed",
                "Couldn't generate workout from that description. Please try being more specific.",
            )

        workout = result.get("workout", {})
        name = workout.get("name", "Generated Workout")
        return f"Generated workout: {name}"

    async def _navigate_to_page(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Return navigation instruction for the client."""
        page = args.get("page", "home")
        workout_id = args.get("workout_id")

        valid_pages = ["home", "library", "calendar", "workout", "settings"]
        if page not in valid_pages:
            return self._error_response(
                "validation_error",
                f"Unknown page '{page}'. Valid pages: {', '.join(valid_pages)}",
            )

        nav = {"action": "navigate", "page": page}
        if workout_id:
            nav["workout_id"] = workout_id

        return json.dumps(nav)

    # --- Phase 2: Content Ingestion Handlers ---

    async def _import_from_youtube(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Import a workout from a YouTube video URL.

        NOTE: This extracts the workout but does NOT save it to the user's library.
        The AI must present the workout to the user and call save_imported_workout
        after user confirmation.
        """
        url = args.get("url")

        validation_error = self._validate_url(url, YOUTUBE_ALLOWED_DOMAINS, "YouTube")
        if validation_error:
            return validation_error

        cleaned_url = url.strip()
        body: Dict[str, Any] = {"url": cleaned_url}
        if args.get("skip_cache"):
            body["skip_cache"] = True

        result = await self._call_api(
            "POST",
            f"{self._ingestor_url}/ingest/youtube",
            ctx,
            json=body,
        )

        return self._format_ingestion_result(result, "YouTube video", source_url=cleaned_url)

    async def _import_from_tiktok(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Import a workout from a TikTok video URL.

        NOTE: This extracts the workout but does NOT save it to the user's library.
        The AI must present the workout to the user and call save_imported_workout
        after user confirmation.
        """
        url = args.get("url")

        validation_error = self._validate_url(url, TIKTOK_ALLOWED_DOMAINS, "TikTok")
        if validation_error:
            return validation_error

        cleaned_url = url.strip()
        mode = args.get("mode", "auto")
        body: Dict[str, Any] = {"url": cleaned_url, "mode": mode}

        result = await self._call_api(
            "POST",
            f"{self._ingestor_url}/ingest/tiktok",
            ctx,
            json=body,
        )

        return self._format_ingestion_result(result, "TikTok video", source_url=cleaned_url)

    async def _import_from_instagram(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Import a workout from an Instagram post URL.

        NOTE: This extracts the workout but does NOT save it to the user's library.
        The AI must present the workout to the user and call save_imported_workout
        after user confirmation.
        """
        url = args.get("url")

        validation_error = self._validate_url(url, INSTAGRAM_ALLOWED_DOMAINS, "Instagram")
        if validation_error:
            return validation_error

        cleaned_url = url.strip()
        body: Dict[str, Any] = {"url": cleaned_url}

        result = await self._call_api(
            "POST",
            f"{self._ingestor_url}/ingest/instagram_test",
            ctx,
            json=body,
        )

        return self._format_ingestion_result(result, "Instagram post", source_url=cleaned_url)

    async def _import_from_pinterest(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Import workouts from a Pinterest pin or board URL.

        NOTE: This extracts the workout but does NOT save it to the user's library.
        The AI must present the workout to the user and call save_imported_workout
        after user confirmation.
        """
        url = args.get("url")

        validation_error = self._validate_url(url, PINTEREST_ALLOWED_DOMAINS, "Pinterest")
        if validation_error:
            return validation_error

        cleaned_url = url.strip()
        body: Dict[str, Any] = {"url": cleaned_url}

        result = await self._call_api(
            "POST",
            f"{self._ingestor_url}/ingest/pinterest",
            ctx,
            json=body,
        )

        # Pinterest can return multiple workouts for boards
        if "workouts" in result:
            workouts = result["workouts"]
            total = result.get("total", len(workouts))
            return json.dumps({
                "success": True,
                "preview_mode": True,
                "persisted": False,
                "multiple_workouts": True,
                "total": total,
                "source_url": cleaned_url,
                "workouts": [
                    {
                        "title": w.get("title", "Untitled"),
                        "full_workout_data": w,
                    }
                    for w in workouts
                ],
                "next_step": (
                    "Present these workouts to the user and ask which ones they want to save. "
                    "Call save_imported_workout for each workout they confirm."
                ),
            })

        return self._format_ingestion_result(result, "Pinterest", source_url=cleaned_url)

    async def _import_from_image(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Import a workout from an uploaded image using vision AI."""
        image_data = args.get("image_data")
        if not image_data:
            return self._error_response(
                "validation_error", "Missing required field: image_data"
            )

        max_encoded_size = int(MAX_IMAGE_SIZE_BYTES * 1.4)
        if len(image_data) > max_encoded_size:
            return self._error_response(
                "validation_error",
                "Image too large. Maximum size is 10MB."
            )

        filename = args.get("filename", "workout_image.jpg")

        try:
            image_bytes = base64.b64decode(image_data)
        except Exception:
            return self._error_response(
                "validation_error", "Invalid base64 image data"
            )

        if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
            return self._error_response(
                "validation_error",
                "Image too large. Maximum size is 10MB."
            )

        content_type = "image/jpeg"
        if filename.lower().endswith(".png"):
            content_type = "image/png"
        elif filename.lower().endswith(".webp"):
            content_type = "image/webp"
        elif filename.lower().endswith(".gif"):
            content_type = "image/gif"

        files = {"file": (filename, io.BytesIO(image_bytes), content_type)}
        data = {"vision_provider": "openai", "vision_model": "gpt-4o-mini"}

        result = await self._call_multipart_api(
            f"{self._ingestor_url}/ingest/image_vision",
            ctx,
            files=files,
            data=data,
            error_context="Image processing",
        )

        return self._format_ingestion_result(result, "image", source_url=f"uploaded:{filename}")

    def _format_ingestion_result(
        self, result: Dict[str, Any], source: str, source_url: Optional[str] = None
    ) -> str:
        """Format ingestion result into a user-friendly response.

        Args:
            result: API response from ingestor.
            source: Human-readable source description.
            source_url: Original URL the content was imported from.

        Returns:
            JSON string with success/error info and workout details.
            NOTE: This returns preview_mode=true and persisted=false because
            the workout has NOT been saved to the user's library yet.
            The AI must call save_imported_workout after user confirmation.
        """
        if not result.get("success", True):
            error_msg = result.get("error", "Failed to extract workout")
            return self._error_response("ingestion_failed", error_msg)

        # Handle both response formats from ingestor:
        # 1. Nested: {"workout": {"title": ..., "blocks": ...}}
        # 2. Root level: {"title": ..., "blocks": ...}
        if "workout" in result:
            workout = result["workout"]
        elif "title" in result or "blocks" in result:
            # Workout data is at root level - extract it
            workout = {
                k: v for k, v in result.items()
                if k not in ("success", "error", "_provenance")
            }
        else:
            workout = {}

        title = workout.get("title") or workout.get("name", "Imported Workout")

        response: Dict[str, Any] = {
            "success": True,
            "source": source,
            "preview_mode": True,
            "persisted": False,
            "workout": {
                "title": title,
                "full_workout_data": workout,  # Include full data for save_imported_workout
            },
            "next_step": (
                "Present this workout to the user and ask if they want to save it to their library. "
                "If they confirm, call save_imported_workout with the workout_data."
            ),
        }

        # Include source_url for save_imported_workout
        if source_url:
            response["source_url"] = source_url

        # Include blocks if available (for structured workouts)
        blocks = workout.get("blocks", [])
        if blocks:
            response["workout"]["block_count"] = len(blocks)

        # Include exercise count and details if available
        # Check both root-level exercises and exercises nested in blocks
        exercises = workout.get("exercises", [])
        if not exercises and blocks:
            # Extract exercises from all blocks
            for block in blocks:
                block_exercises = block.get("exercises", [])
                exercises.extend(block_exercises)

        if exercises:
            response["workout"]["exercise_count"] = len(exercises)
            # Include exercise names for preview
            response["workout"]["exercise_names"] = [
                ex.get("name", "Unknown") for ex in exercises[:10]
            ]
            if len(exercises) > 10:
                response["workout"]["exercise_names"].append(
                    f"... and {len(exercises) - 10} more"
                )

        return json.dumps(response)

    async def _save_imported_workout(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Save an imported workout to the user's library.

        Uses cache-keyed architecture: only requires source_url.
        The workout data is fetched from the ingestor's cache automatically.
        If cache has expired, re-ingests transparently.

        Flow:
        1. User asks to import from YouTube/TikTok/etc
        2. AI calls import_from_* which extracts and caches (but does NOT save)
        3. AI presents the workout to the user
        4. User confirms they want to save it
        5. AI calls this function with just source_url
        6. This function fetches from cache and saves to library
        """
        source_url = args.get("source_url")
        title_override = args.get("title_override")

        if not source_url:
            return self._error_response(
                "validation_error",
                "Missing required field: source_url. "
                "Provide the URL the workout was imported from."
            )

        # Determine the ingest endpoint based on URL domain
        parsed = urlparse(source_url)
        domain = parsed.netloc.lower().replace("www.", "")

        if any(d in domain for d in ["youtube.com", "youtu.be"]):
            ingest_endpoint = "/ingest/youtube"
            body: Dict[str, Any] = {"url": source_url}
        elif "tiktok.com" in domain:
            ingest_endpoint = "/ingest/tiktok"
            body = {"url": source_url, "mode": "auto"}
        elif "instagram.com" in domain:
            ingest_endpoint = "/ingest/instagram_test"
            body = {"url": source_url}
        elif "pinterest.com" in domain or "pin.it" in domain:
            ingest_endpoint = "/ingest/pinterest"
            body = {"url": source_url}
        else:
            return self._error_response(
                "validation_error",
                f"Unsupported source URL domain: {domain}"
            )

        # Fetch workout data from ingestor (uses cache, fast if previously imported)
        try:
            ingest_result = await self._call_api(
                "POST",
                f"{self._ingestor_url}{ingest_endpoint}",
                ctx,
                json=body,
            )
        except FunctionExecutionError as e:
            return self._error_response(
                "fetch_failed",
                f"Failed to fetch workout data: {e.message}"
            )

        # Extract workout data from ingestor response (handle both formats)
        if "workout" in ingest_result:
            workout_data = ingest_result["workout"]
        elif "title" in ingest_result or "blocks" in ingest_result:
            workout_data = {
                k: v for k, v in ingest_result.items()
                if k not in ("success", "error", "_provenance")
            }
        else:
            return self._error_response(
                "fetch_failed",
                "No workout data found in ingestor response."
            )

        # Get the title
        title = (
            title_override
            or workout_data.get("title")
            or workout_data.get("name", "Imported Workout")
        )

        # Build the payload for the mapper API
        save_payload: Dict[str, Any] = {
            "profile_id": ctx.user_id,
            "workout_data": workout_data,
            "sources": [source_url],
            "device": "web",
            "title": title,
        }

        try:
            result = await self._call_api(
                "POST",
                f"{self._mapper_url}/workouts/save",
                ctx,
                json=save_payload,
            )
        except FunctionExecutionError as e:
            return self._error_response(
                "save_failed",
                f"Failed to save workout to library: {e.message}"
            )

        # Extract the saved workout ID
        saved_workout = result.get("workout", result)
        workout_id = saved_workout.get("id") or saved_workout.get("workout_id")

        if not workout_id:
            return self._error_response(
                "save_failed",
                "Workout was saved but no ID was returned. Please check your library."
            )

        return json.dumps({
            "success": True,
            "persisted": True,
            "message": f"Workout '{title}' has been saved to your library!",
            "workout_id": workout_id,
            "title": title,
            "location": "The workout is now available in your 'My Workouts' tab.",
        })

    # --- Phase 3: Workout Management Handlers ---

    async def _edit_workout(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Edit a workout via JSON Patch operations."""
        workout_id = args.get("workout_id")
        operations = args.get("operations", [])

        if not workout_id:
            return self._error_response(
                "validation_error", "Missing required field: workout_id"
            )

        if not operations:
            return self._error_response(
                "validation_error", "Missing required field: operations"
            )

        for op in operations:
            if op.get("op") not in ("replace", "add", "remove"):
                return self._error_response(
                    "validation_error",
                    f"Invalid operation: {op.get('op')}. Must be replace, add, or remove."
                )
            if not op.get("path"):
                return self._error_response(
                    "validation_error", "Each operation must have a path."
                )

        await self._call_api(
            "PATCH",
            f"{self._mapper_url}/workouts/{workout_id}",
            ctx,
            json={"operations": operations},
        )

        return json.dumps({
            "success": True,
            "message": "Workout updated successfully",
            "workout_id": workout_id,
        })

    async def _export_workout(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Export a workout to a specific format."""
        workout_id = args.get("workout_id")
        export_format = args.get("format")

        if not workout_id:
            return self._error_response(
                "validation_error", "Missing required field: workout_id"
            )

        if not export_format:
            return self._error_response(
                "validation_error", "Missing required field: format"
            )

        valid_formats = {"yaml", "zwo", "workoutkit", "fit_metadata"}
        if export_format not in valid_formats:
            return self._error_response(
                "validation_error",
                f"Invalid format: {export_format}. Valid formats: {', '.join(valid_formats)}"
            )

        result = await self._call_api(
            "GET",
            f"{self._mapper_url}/export/{workout_id}",
            ctx,
            params={"export_format": export_format},
        )

        format_names = {
            "yaml": "Garmin YAML",
            "zwo": "Zwift ZWO",
            "workoutkit": "Apple WorkoutKit",
            "fit_metadata": "FIT metadata",
        }

        return json.dumps({
            "success": True,
            "format": export_format,
            "format_name": format_names.get(export_format, export_format),
            "workout_id": workout_id,
            "content": result.get("content"),
            "download_url": result.get("download_url"),
        })

    async def _duplicate_workout(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Create a copy of an existing workout with optional modifications."""
        workout_id = args.get("workout_id")
        new_title = args.get("new_title")
        modifications = args.get("modifications", {})

        if not workout_id:
            return self._error_response(
                "validation_error", "Missing required field: workout_id"
            )

        original = await self._call_api(
            "GET",
            f"{self._mapper_url}/workouts/{workout_id}",
            ctx,
        )

        workout_data = original.copy()
        workout_data.pop("id", None)
        workout_data.pop("workout_id", None)
        workout_data.pop("created_at", None)
        workout_data.pop("updated_at", None)

        if new_title:
            workout_data["title"] = new_title
        else:
            original_title = workout_data.get("title", "Workout")
            workout_data["title"] = f"{original_title} (Copy)"

        allowed_modification_fields = {
            "title", "description", "tags", "difficulty", "exercises",
            "estimated_duration_minutes", "equipment", "notes", "category",
        }
        safe_modifications = {
            k: v for k, v in modifications.items()
            if k in allowed_modification_fields
        }
        workout_data.update(safe_modifications)

        result = await self._call_api(
            "POST",
            f"{self._mapper_url}/workouts/save",
            ctx,
            json=workout_data,
        )

        new_workout = result.get("workout", result)
        return json.dumps({
            "success": True,
            "message": "Workout duplicated successfully",
            "original_id": workout_id,
            "new_workout": {
                "id": new_workout.get("id") or new_workout.get("workout_id"),
                "title": new_workout.get("title"),
            },
        })

    async def _log_workout_completion(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Record a workout completion with optional metrics."""
        workout_id = args.get("workout_id")

        if not workout_id:
            return self._error_response(
                "validation_error", "Missing required field: workout_id"
            )

        rating = args.get("rating")
        if rating is not None:
            if not isinstance(rating, int) or rating < 1 or rating > 5:
                return self._error_response(
                    "validation_error", "Rating must be an integer between 1 and 5"
                )

        body: Dict[str, Any] = {"workout_id": workout_id}

        if args.get("duration_minutes"):
            body["duration_minutes"] = args["duration_minutes"]
        if args.get("notes"):
            body["notes"] = args["notes"]
        if rating is not None:
            body["rating"] = rating

        result = await self._call_api(
            "POST",
            f"{self._mapper_url}/workouts/complete",
            ctx,
            json=body,
        )

        return json.dumps({
            "success": True,
            "message": "Workout completion logged",
            "workout_id": workout_id,
            "completion_id": result.get("id") or result.get("completion_id"),
        })

    async def _get_workout_history(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Get user's workout completion history."""
        limit = min(args.get("limit", 10), 50)

        params: Dict[str, Any] = {"limit": limit}

        if args.get("start_date"):
            params["start_date"] = args["start_date"]
        if args.get("end_date"):
            params["end_date"] = args["end_date"]

        result = await self._call_api(
            "GET",
            f"{self._mapper_url}/workouts/completions",
            ctx,
            params=params,
        )

        completions = result.get("completions", result.get("results", []))

        if not completions:
            return "No workout completions found for the specified period."

        lines = [f"Found {len(completions)} workout completion(s):"]
        for i, c in enumerate(completions, 1):
            title = c.get("workout_title") or c.get("title", "Workout")
            date = c.get("completed_at", c.get("date", "Unknown date"))
            duration = c.get("duration_minutes")
            rating = c.get("rating")

            line = f"{i}. {title} - {date}"
            if duration:
                line += f" ({duration} min)"
            if rating:
                line += f" - {rating}/5"
            lines.append(line)

        return "\n".join(lines)

    async def _get_workout_details(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Get detailed information about a specific workout."""
        workout_id = args.get("workout_id")

        if not workout_id:
            return self._error_response(
                "validation_error", "Missing required field: workout_id"
            )

        result = await self._call_api(
            "GET",
            f"{self._mapper_url}/workouts/{workout_id}",
            ctx,
        )

        title = result.get("title", "Untitled Workout")
        description = result.get("description", "")
        exercises = result.get("exercises", [])
        tags = result.get("tags", [])
        duration = result.get("estimated_duration_minutes")

        response: Dict[str, Any] = {
            "success": True,
            "workout": {
                "id": workout_id,
                "title": title,
                "description": description,
                "exercise_count": len(exercises),
                "tags": tags,
            },
        }

        if duration:
            response["workout"]["estimated_duration_minutes"] = duration

        if exercises:
            exercise_list = []
            for ex in exercises[:20]:
                ex_summary = {
                    "name": ex.get("name", "Unknown"),
                }
                if ex.get("sets"):
                    ex_summary["sets"] = ex["sets"]
                if ex.get("reps"):
                    ex_summary["reps"] = ex["reps"]
                if ex.get("duration"):
                    ex_summary["duration"] = ex["duration"]
                exercise_list.append(ex_summary)
            response["workout"]["exercises"] = exercise_list

        return json.dumps(response)

    # --- Phase 4: Calendar & Sync Handlers ---

    async def _get_calendar_events(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Get scheduled workouts from the user's calendar."""
        start_date = args.get("start_date")
        end_date = args.get("end_date")

        if not start_date or not end_date:
            return self._error_response(
                "validation_error",
                "Missing required fields: start_date and end_date are required.",
            )

        result = await self._call_api(
            "GET",
            f"{self._calendar_url}/calendar",
            ctx,
            params={"start": start_date, "end": end_date},
        )

        events = result.get("events", result.get("results", []))
        if not events:
            return f"No workouts scheduled between {start_date} and {end_date}."

        lines = [f"Found {len(events)} scheduled workout(s):"]
        for i, event in enumerate(events, 1):
            title = event.get("title") or event.get("workout_title", "Workout")
            date = event.get("scheduled_date") or event.get("date", "Unknown date")
            time = event.get("scheduled_time") or event.get("time")
            event_id = event.get("id") or event.get("event_id")

            line = f"{i}. {title} - {date}"
            if time:
                line += f" at {time}"
            if event_id:
                line += f" (ID: {event_id})"
            lines.append(line)

        return "\n".join(lines)

    async def _reschedule_workout(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Reschedule a workout on the calendar."""
        event_id = args.get("event_id")
        new_date = args.get("new_date")
        new_time = args.get("new_time")

        validation_error = self._validate_id(event_id, "event_id")
        if validation_error:
            return validation_error

        if not new_date and not new_time:
            return self._error_response(
                "validation_error",
                "At least one of new_date or new_time must be provided.",
            )

        body: Dict[str, Any] = {}
        if new_date:
            body["scheduled_date"] = new_date
        if new_time:
            body["scheduled_time"] = new_time

        await self._call_api(
            "PUT",
            f"{self._calendar_url}/calendar/{event_id}",
            ctx,
            json=body,
        )

        message = "Workout rescheduled"
        if new_date:
            message += f" to {new_date}"
        if new_time:
            message += f" at {new_time}"

        return json.dumps({
            "success": True,
            "message": message,
            "event_id": event_id,
        })

    async def _cancel_scheduled_workout(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Cancel a scheduled workout from the calendar."""
        event_id = args.get("event_id")
        confirm = args.get("confirm", False)

        validation_error = self._validate_id(event_id, "event_id")
        if validation_error:
            return validation_error

        if not confirm:
            return self._error_response(
                "confirmation_required",
                "Please confirm cancellation by setting confirm to true.",
            )

        try:
            event = await self._call_api(
                "GET",
                f"{self._calendar_url}/calendar/{event_id}",
                ctx,
            )
            event_title = event.get("title") or event.get("workout_title", "Workout")
        except FunctionExecutionError:
            event_title = "Workout"

        await self._call_api(
            "DELETE",
            f"{self._calendar_url}/calendar/{event_id}",
            ctx,
        )

        return json.dumps({
            "success": True,
            "message": f"Cancelled: {event_title}",
            "event_id": event_id,
        })

    async def _sync_strava(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Sync activities from Strava."""
        days_back = min(args.get("days_back", 7), 30)

        if self._rate_limit_repo:
            allowed, count, limit = await self._rate_limit_repo.check_and_increment(
                ctx.user_id, "sync_strava", self._sync_rate_limit, window_hours=1
            )
            if not allowed:
                return self._error_response(
                    "rate_limit_exceeded",
                    f"Strava sync is limited to {limit} times per hour. "
                    f"You've used {count}/{limit}. Please try again later.",
                )

        result = await self._call_api(
            "POST",
            f"{self._strava_sync_url}/strava/sync",
            ctx,
            json={"days_back": days_back},
        )

        synced_count = result.get("synced_count", 0)
        activities = result.get("activities", [])

        if synced_count == 0:
            return "No new activities found to sync from Strava."

        lines = [f"Synced {synced_count} activity(ies) from Strava:"]
        for activity in activities[:10]:
            name = activity.get("name", "Activity")
            activity_type = activity.get("type", "")
            distance = activity.get("distance_km")
            duration = activity.get("duration_minutes")

            line = f"- {name}"
            if activity_type:
                line += f" ({activity_type})"
            if distance:
                line += f" - {distance:.1f}km"
            if duration:
                line += f", {duration}min"
            lines.append(line)

        if len(activities) > 10:
            lines.append(f"... and {len(activities) - 10} more")

        return "\n".join(lines)

    async def _sync_garmin(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Sync workout data from Garmin."""
        if self._feature_flags:
            if not self._feature_flags.is_function_enabled(ctx.user_id, "garmin_sync"):
                return self._error_response(
                    "feature_disabled",
                    "Garmin sync is currently in beta. Please check back later.",
                )

        workout_ids = args.get("workout_ids", [])

        validation_error = self._validate_id_list(workout_ids, "workout_ids")
        if validation_error:
            return validation_error

        if self._rate_limit_repo:
            allowed, count, limit = await self._rate_limit_repo.check_and_increment(
                ctx.user_id, "sync_garmin", self._sync_rate_limit, window_hours=1
            )
            if not allowed:
                return self._error_response(
                    "rate_limit_exceeded",
                    f"Garmin sync is limited to {limit} times per hour. "
                    f"You've used {count}/{limit}. Please try again later.",
                )

        result = await self._call_api(
            "POST",
            f"{self._garmin_sync_url}/garmin/sync",
            ctx,
            json={"workout_ids": workout_ids},
        )

        synced_count = result.get("synced_count", 0)
        return json.dumps({
            "success": True,
            "message": f"Synced {synced_count} workout(s) from Garmin",
            "synced_count": synced_count,
        })

    async def _get_strava_activities(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Get recent activities from Strava."""
        limit = min(args.get("limit", 10), 30)

        result = await self._call_api(
            "GET",
            f"{self._strava_sync_url}/strava/activities",
            ctx,
            params={"limit": limit, "userId": ctx.user_id},
        )

        activities = result if isinstance(result, list) else result.get("activities", result.get("results", []))
        if not activities:
            return "No recent Strava activities found."

        lines = [f"Found {len(activities)} recent Strava activity(ies):"]
        for i, activity in enumerate(activities[:limit], 1):
            name = activity.get("name", "Activity")
            activity_type = activity.get("type", "")
            date = activity.get("start_date", "")
            distance = activity.get("distance", 0) / 1000
            elapsed_time = activity.get("elapsed_time", 0)
            duration_min = elapsed_time // 60

            line = f"{i}. {name}"
            if activity_type:
                line += f" ({activity_type})"
            if date:
                date_display = date[:10] if len(date) >= 10 else date
                line += f" - {date_display}"
            if distance > 0:
                line += f" - {distance:.1f}km"
            if duration_min > 0:
                line += f", {duration_min}min"
            lines.append(line)

        return "\n".join(lines)
