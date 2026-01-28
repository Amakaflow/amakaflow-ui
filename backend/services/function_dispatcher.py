"""FunctionDispatcher for executing Phase 1 tool functions.

Dispatches tool calls to external services (mapper-api, calendar-api, workout-ingestor-api)
with synchronous HTTP calls using httpx.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional

import httpx

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
            "search_workout_library": self._search_workout_library,
            "add_workout_to_calendar": self._add_workout_to_calendar,
            "generate_ai_workout": self._generate_ai_workout,
            "navigate_to_page": self._navigate_to_page,
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
        except Exception as e:
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
            return self._error_response("validation_error", "Missing required fields: workout_id and date are required.")

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
