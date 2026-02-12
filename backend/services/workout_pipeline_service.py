"""Standalone workout generation pipeline that yields SSE events.

Wraps the same ingestor-api call used by AsyncFunctionDispatcher._generate_ai_workout,
but as an async generator producing typed PipelineEvent objects for SSE streaming.
"""

import json
import uuid
from dataclasses import dataclass
from typing import AsyncGenerator, Optional

import httpx


@dataclass
class PipelineEvent:
    """A single SSE event from the workout generation pipeline."""

    event: str  # "stage", "content_delta", "preview", "error", "complete"
    data: str  # JSON string


class WorkoutPipelineService:
    """Generates workouts via ingestor-api and yields streaming SSE events."""

    def __init__(self, ingestor_url: str, auth_token: str):
        self._ingestor_url = ingestor_url
        self._auth_token = auth_token

    async def generate(
        self,
        description: str,
        difficulty: Optional[str] = None,
        duration_minutes: Optional[int] = None,
        equipment: Optional[list[str]] = None,
        user_id: Optional[str] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Generate a workout and yield SSE events as stages progress."""
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "analyzing", "message": "Understanding your workout goals..."}),
        )

        body: dict = {"transcription": description}
        if difficulty:
            body["difficulty"] = difficulty
        if duration_minutes:
            body["duration_minutes"] = duration_minutes
        if equipment:
            body["equipment"] = equipment

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "creating", "message": "Generating exercises..."}),
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self._ingestor_url}/workouts/parse-voice",
                    json=body,
                    headers={"Authorization": self._auth_token},
                )
        except httpx.HTTPError:
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "creating",
                    "message": "Failed to connect to workout service",
                    "recoverable": True,
                }),
            )
            return

        result = response.json()
        if response.status_code != 200 or not result.get("success"):
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "creating",
                    "message": "Failed to generate workout",
                    "recoverable": True,
                }),
            )
            return

        workout = result.get("workout", {})
        preview_id = str(uuid.uuid4())

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Workout ready!"}),
        )

        yield PipelineEvent(
            "preview",
            json.dumps({
                "preview_id": preview_id,
                "workout": {
                    "name": workout.get("name", "Generated Workout"),
                    "exercises": [
                        {
                            "name": ex.get("name"),
                            "sets": ex.get("sets"),
                            "reps": ex.get("reps"),
                            "muscle_group": ex.get("muscle_group"),
                            "notes": ex.get("notes"),
                        }
                        for ex in workout.get("exercises", [])
                    ],
                    "duration_minutes": workout.get("duration_minutes"),
                    "difficulty": workout.get("difficulty"),
                },
            }),
        )
