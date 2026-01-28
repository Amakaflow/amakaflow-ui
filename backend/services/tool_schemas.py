"""Phase 1 tool JSON schemas for Claude function calling.

Defines the tools available for Claude to use when chatting with users.
These schemas follow Anthropic's tool use specification.
"""

from typing import Any, Dict, List

PHASE_1_TOOLS: List[Dict[str, Any]] = [
    {
        "name": "search_workout_library",
        "description": (
            "Search the user's workout library using natural language. "
            "Returns matching workouts with IDs that can be used for scheduling."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "Natural language search query (e.g., 'leg workouts', 'quick cardio')"
                    ),
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum results to return (default: 5)",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "add_workout_to_calendar",
        "description": (
            "Schedule a workout on the user's calendar for a specific date and time."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "workout_id": {
                    "type": "string",
                    "description": "ID of the workout to schedule",
                },
                "date": {
                    "type": "string",
                    "description": "Date in ISO format (YYYY-MM-DD)",
                },
                "time": {
                    "type": "string",
                    "description": "Time in HH:MM format (optional)",
                },
                "recurrence": {
                    "type": "string",
                    "enum": ["daily", "weekly"],
                    "description": "Recurring schedule (optional)",
                },
            },
            "required": ["workout_id", "date"],
        },
    },
    {
        "name": "generate_ai_workout",
        "description": (
            "Generate a custom workout based on a natural language description "
            "of what the user wants."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Natural language description of desired workout",
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "Target workout duration in minutes",
                },
                "equipment": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Available equipment",
                },
                "difficulty": {
                    "type": "string",
                    "enum": ["beginner", "intermediate", "advanced"],
                    "description": "Difficulty level",
                },
            },
            "required": ["description"],
        },
    },
    {
        "name": "navigate_to_page",
        "description": "Navigate the user to a specific page in the app.",
        "input_schema": {
            "type": "object",
            "properties": {
                "page": {
                    "type": "string",
                    "enum": ["home", "library", "calendar", "workout", "settings"],
                    "description": "Target page",
                },
                "workout_id": {
                    "type": "string",
                    "description": "Workout ID (required when page='workout')",
                },
            },
            "required": ["page"],
        },
    },
]
