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

PHASE_2_TOOLS: List[Dict[str, Any]] = [
    {
        "name": "import_from_youtube",
        "description": (
            "Import a workout from a YouTube video URL. The video transcript will be "
            "analyzed to extract exercises, sets, reps, and timing."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "YouTube video URL",
                },
                "skip_cache": {
                    "type": "boolean",
                    "description": "Bypass cache for fresh extraction (default: false)",
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "import_from_tiktok",
        "description": (
            "Import a workout from a TikTok video URL. The video will be processed "
            "using audio transcription and/or vision analysis to extract the workout."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "TikTok video URL",
                },
                "mode": {
                    "type": "string",
                    "enum": ["oembed", "auto", "hybrid"],
                    "description": (
                        "Extraction mode: 'oembed' for metadata only, 'auto' for audio "
                        "first with vision fallback (default), 'hybrid' for both"
                    ),
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "import_from_instagram",
        "description": (
            "Import a workout from an Instagram post URL. The image or video will be "
            "analyzed using OCR and vision to extract workout details."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Instagram post URL",
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "import_from_pinterest",
        "description": (
            "Import workouts from a Pinterest pin or board URL. For boards, multiple "
            "workouts may be returned. Each image will be analyzed to extract exercises."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Pinterest pin or board URL",
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "import_from_image",
        "description": (
            "Import a workout from an uploaded image. The image will be analyzed using "
            "vision AI to extract exercises, sets, reps, and other workout details."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "image_data": {
                    "type": "string",
                    "description": "Base64-encoded image data",
                },
                "filename": {
                    "type": "string",
                    "description": "Original filename (optional, helps with format detection)",
                },
            },
            "required": ["image_data"],
        },
    },
]

PHASE_3_TOOLS: List[Dict[str, Any]] = [
    {
        "name": "edit_workout",
        "description": (
            "Edit a workout's title, description, tags, or exercises using "
            "JSON Patch operations."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "workout_id": {
                    "type": "string",
                    "description": "ID of workout to edit",
                },
                "operations": {
                    "type": "array",
                    "description": "JSON Patch operations (op: replace/add/remove, path, value)",
                    "items": {
                        "type": "object",
                        "properties": {
                            "op": {
                                "type": "string",
                                "enum": ["replace", "add", "remove"],
                            },
                            "path": {"type": "string"},
                            "value": {},
                        },
                        "required": ["op", "path"],
                    },
                },
            },
            "required": ["workout_id", "operations"],
        },
    },
    {
        "name": "export_workout",
        "description": (
            "Export a workout to a specific format for use with fitness devices or apps."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "workout_id": {
                    "type": "string",
                    "description": "ID of workout to export",
                },
                "format": {
                    "type": "string",
                    "enum": ["yaml", "zwo", "workoutkit", "fit_metadata"],
                    "description": (
                        "Export format (yaml=Garmin, zwo=Zwift, workoutkit=Apple Watch)"
                    ),
                },
            },
            "required": ["workout_id", "format"],
        },
    },
    {
        "name": "duplicate_workout",
        "description": "Create a copy of an existing workout, optionally with modifications.",
        "input_schema": {
            "type": "object",
            "properties": {
                "workout_id": {
                    "type": "string",
                    "description": "ID of workout to duplicate",
                },
                "new_title": {
                    "type": "string",
                    "description": "Title for the new workout",
                },
                "modifications": {
                    "type": "object",
                    "description": "Optional changes to apply to the copy",
                },
            },
            "required": ["workout_id"],
        },
    },
    {
        "name": "log_workout_completion",
        "description": "Record that a workout was completed with optional metrics.",
        "input_schema": {
            "type": "object",
            "properties": {
                "workout_id": {
                    "type": "string",
                    "description": "ID of completed workout",
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "Actual duration in minutes",
                },
                "notes": {
                    "type": "string",
                    "description": "User notes about the workout",
                },
                "rating": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 5,
                    "description": "Rating 1-5",
                },
            },
            "required": ["workout_id"],
        },
    },
    {
        "name": "get_workout_history",
        "description": "Get the user's workout completion history with optional date filtering.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 10, max 50)",
                },
                "start_date": {
                    "type": "string",
                    "description": "Filter from date (YYYY-MM-DD)",
                },
                "end_date": {
                    "type": "string",
                    "description": "Filter to date (YYYY-MM-DD)",
                },
            },
        },
    },
    {
        "name": "get_workout_details",
        "description": "Get detailed information about a specific workout.",
        "input_schema": {
            "type": "object",
            "properties": {
                "workout_id": {
                    "type": "string",
                    "description": "ID of workout to retrieve",
                },
            },
            "required": ["workout_id"],
        },
    },
]

# Combined list for convenience
ALL_TOOLS: List[Dict[str, Any]] = PHASE_1_TOOLS + PHASE_2_TOOLS + PHASE_3_TOOLS
