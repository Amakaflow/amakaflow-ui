"""FunctionDispatcher for executing tool functions.

Dispatches tool calls to external services (mapper-api, calendar-api, workout-ingestor-api)
with synchronous HTTP calls using httpx.
"""

import base64
import io
import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional, Set
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


class FunctionDispatcher:
    """Dispatches tool function calls to external services."""

    def __init__(
        self,
        mapper_api_url: str,
        calendar_api_url: str,
        ingestor_api_url: str,
        timeout: float = 30.0,
    ):
        self._mapper_url = mapper_api_url
        self._calendar_url = calendar_api_url
        self._ingestor_url = ingestor_api_url
        self._client = httpx.Client(timeout=timeout)

        self._handlers = {
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
        }

    def close(self) -> None:
        """Close the HTTP client connection pool."""
        self._client.close()

    def __enter__(self) -> "FunctionDispatcher":
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit - close the client."""
        self.close()

    def execute(
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
            return self._error_response("unknown_function", f"Unknown function '{function_name}'")

        try:
            return handler(arguments, context)
        except FunctionExecutionError as e:
            return self._error_response("execution_error", e.message)
        except Exception:
            logger.exception("Error in function %s", function_name)
            return self._error_response("internal_error", "An unexpected error occurred. Please try again.")

    def _error_response(self, code: str, message: str) -> str:
        """Create a standardized error response for Claude.

        Args:
            code: Error code for categorization.
            message: User-friendly error message.

        Returns:
            JSON string with error details.
        """
        return json.dumps({"error": True, "code": code, "message": message})

    def _validate_url(
        self, url: Optional[str], allowed_domains: Set[str], platform: str
    ) -> Optional[str]:
        """Validate URL is non-empty and from allowed domains (SSRF prevention).

        Args:
            url: URL to validate.
            allowed_domains: Set of allowed domain names.
            platform: Platform name for error messages.

        Returns:
            Error response string if invalid, None if valid.
        """
        if not url or not url.strip():
            return self._error_response(
                "validation_error", "URL cannot be empty"
            )

        try:
            parsed = urlparse(url.strip())

            # Must be http or https
            if parsed.scheme not in ("http", "https"):
                return self._error_response(
                    "validation_error",
                    "Invalid URL. Must start with http:// or https://"
                )

            # Domain must be in allowed list
            domain = parsed.netloc.lower()
            # Strip port if present
            if ":" in domain:
                domain = domain.split(":")[0]

            if domain not in allowed_domains:
                return self._error_response(
                    "validation_error",
                    f"Invalid {platform} URL. Please provide a valid {platform} link."
                )

            return None  # Valid

        except Exception:
            return self._error_response(
                "validation_error", "Invalid URL format"
            )

    def _call_api(
        self,
        method: str,
        url: str,
        context: FunctionContext,
        **kwargs,
    ) -> Dict[str, Any]:
        """HTTP call with error handling and auth forwarding.

        Args:
            method: HTTP method (GET, POST, etc.).
            url: Full URL to call.
            context: User context for auth header.
            **kwargs: Additional arguments for httpx.request.

        Returns:
            Parsed JSON response.

        Raises:
            FunctionExecutionError: On API errors with user-friendly messages.
        """
        headers = kwargs.pop("headers", {})
        if context.auth_token:
            headers["Authorization"] = context.auth_token
        # Always include user_id for defense in depth - downstream services
        # can use JWT or this header for user identification
        headers["X-User-Id"] = context.user_id

        try:
            response = self._client.request(method, url, headers=headers, **kwargs)
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

    def _call_multipart_api(
        self,
        url: str,
        context: FunctionContext,
        files: Dict[str, Any],
        data: Dict[str, Any],
        error_context: str = "processing",
    ) -> Dict[str, Any]:
        """HTTP multipart POST with error handling and auth forwarding.

        Args:
            url: Full URL to call.
            context: User context for auth header.
            files: Files dict for multipart upload.
            data: Form data dict.
            error_context: Context string for error messages (e.g., "Image processing").

        Returns:
            Parsed JSON response.

        Raises:
            FunctionExecutionError: On API errors with user-friendly messages.
        """
        headers: Dict[str, str] = {}
        if context.auth_token:
            headers["Authorization"] = context.auth_token
        headers["X-User-Id"] = context.user_id

        try:
            response = self._client.post(url, files=files, data=data, headers=headers)
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

    def _search_workout_library(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Search workouts via mapper-api semantic search."""
        query = args.get("query", "")
        # Cap limit at 10 for safety, default to 5
        max_results = min(args.get("limit", 5), 10)

        result = self._call_api(
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

    def _add_workout_to_calendar(
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

        self._call_api(
            "POST",
            f"{self._calendar_url}/calendar",
            ctx,
            json=body,
        )

        return f"Added workout to calendar on {date}" + (f" at {time}" if time else "")

    def _generate_ai_workout(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Generate a workout via workout-ingestor-api."""
        description = args.get("description", "")

        body: Dict[str, Any] = {
            "transcription": description,
        }
        # Pass difficulty level if provided (beginner/intermediate/advanced)
        if args.get("difficulty"):
            body["difficulty"] = args["difficulty"]
        # Pass duration hint if provided
        if args.get("duration_minutes"):
            body["duration_minutes"] = args["duration_minutes"]
        # Pass equipment list if provided
        if args.get("equipment"):
            body["equipment"] = args["equipment"]

        result = self._call_api(
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

    def _navigate_to_page(
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

    def _import_from_youtube(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Import a workout from a YouTube video URL."""
        url = args.get("url")

        # Validate URL domain (SSRF prevention)
        validation_error = self._validate_url(url, YOUTUBE_ALLOWED_DOMAINS, "YouTube")
        if validation_error:
            return validation_error

        body: Dict[str, Any] = {"url": url.strip()}
        if args.get("skip_cache"):
            body["skip_cache"] = True

        result = self._call_api(
            "POST",
            f"{self._ingestor_url}/ingest/youtube",
            ctx,
            json=body,
        )

        return self._format_ingestion_result(result, "YouTube video")

    def _import_from_tiktok(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Import a workout from a TikTok video URL."""
        url = args.get("url")

        # Validate URL domain (SSRF prevention)
        validation_error = self._validate_url(url, TIKTOK_ALLOWED_DOMAINS, "TikTok")
        if validation_error:
            return validation_error

        # Default to "auto" mode (audio first, vision fallback)
        mode = args.get("mode", "auto")
        body: Dict[str, Any] = {"url": url.strip(), "mode": mode}

        result = self._call_api(
            "POST",
            f"{self._ingestor_url}/ingest/tiktok",
            ctx,
            json=body,
        )

        return self._format_ingestion_result(result, "TikTok video")

    def _import_from_instagram(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Import a workout from an Instagram post URL."""
        url = args.get("url")

        # Validate URL domain (SSRF prevention)
        validation_error = self._validate_url(url, INSTAGRAM_ALLOWED_DOMAINS, "Instagram")
        if validation_error:
            return validation_error

        body: Dict[str, Any] = {"url": url.strip()}

        result = self._call_api(
            "POST",
            f"{self._ingestor_url}/ingest/instagram_test",
            ctx,
            json=body,
        )

        return self._format_ingestion_result(result, "Instagram post")

    def _import_from_pinterest(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Import workouts from a Pinterest pin or board URL."""
        url = args.get("url")

        # Validate URL domain (SSRF prevention)
        validation_error = self._validate_url(url, PINTEREST_ALLOWED_DOMAINS, "Pinterest")
        if validation_error:
            return validation_error

        body: Dict[str, Any] = {"url": url.strip()}

        result = self._call_api(
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
                "multiple_workouts": True,
                "total": total,
                "workouts": [
                    {
                        "title": w.get("title", "Untitled"),
                        "id": w.get("id"),
                    }
                    for w in workouts
                ],
            })

        # Single workout response
        return self._format_ingestion_result(result, "Pinterest")

    def _import_from_image(
        self, args: Dict[str, Any], ctx: FunctionContext
    ) -> str:
        """Import a workout from an uploaded image using vision AI."""
        image_data = args.get("image_data")
        if not image_data:
            return self._error_response(
                "validation_error", "Missing required field: image_data"
            )

        # Validate image size before decoding (base64 is ~33% larger than binary)
        # Check encoded length to prevent memory exhaustion
        max_encoded_size = int(MAX_IMAGE_SIZE_BYTES * 1.4)
        if len(image_data) > max_encoded_size:
            return self._error_response(
                "validation_error",
                "Image too large. Maximum size is 10MB."
            )

        filename = args.get("filename", "workout_image.jpg")

        # Decode base64 to bytes
        try:
            image_bytes = base64.b64decode(image_data)
        except Exception:
            return self._error_response(
                "validation_error", "Invalid base64 image data"
            )

        # Double-check decoded size
        if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
            return self._error_response(
                "validation_error",
                "Image too large. Maximum size is 10MB."
            )

        # Determine content type from filename
        content_type = "image/jpeg"
        if filename.lower().endswith(".png"):
            content_type = "image/png"
        elif filename.lower().endswith(".webp"):
            content_type = "image/webp"
        elif filename.lower().endswith(".gif"):
            content_type = "image/gif"

        # Send as multipart/form-data
        files = {"file": (filename, io.BytesIO(image_bytes), content_type)}
        data = {"vision_provider": "openai", "vision_model": "gpt-4o-mini"}

        result = self._call_multipart_api(
            f"{self._ingestor_url}/ingest/image_vision",
            ctx,
            files=files,
            data=data,
            error_context="Image processing",
        )

        return self._format_ingestion_result(result, "image")

    def _format_ingestion_result(
        self, result: Dict[str, Any], source: str
    ) -> str:
        """Format ingestion result into a user-friendly response.

        Args:
            result: API response from ingestor.
            source: Human-readable source description.

        Returns:
            JSON string with success/error info and workout details.
        """
        if not result.get("success", True):
            error_msg = result.get("error", "Failed to extract workout")
            return self._error_response("ingestion_failed", error_msg)

        workout = result.get("workout", {})
        title = workout.get("title") or workout.get("name", "Imported Workout")
        workout_id = workout.get("id")

        response: Dict[str, Any] = {
            "success": True,
            "source": source,
            "workout": {
                "title": title,
                "id": workout_id,
            },
        }

        # Include exercise count if available
        exercises = workout.get("exercises", [])
        if exercises:
            response["workout"]["exercise_count"] = len(exercises)

        return json.dumps(response)
