"""Phase 1 tool JSON schemas and stub executor.

Defines tool schemas so Claude knows what's available.
execute_tool_stub() returns a placeholder message until real
tool execution is implemented in AMA-440.
"""

from typing import Any, Dict, List

# Phase 1 tools: Claude sees these but they return stub results
PHASE_1_TOOLS: List[Dict[str, Any]] = [
    {
        "name": "lookup_user_profile",
        "description": "Look up the user's fitness profile including goals, experience level, injuries, and preferences.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "search_workouts",
        "description": "Search the workout library for workouts matching criteria like muscle group, equipment, difficulty, or duration.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language search query for workouts",
                },
                "muscle_group": {
                    "type": "string",
                    "description": "Target muscle group (e.g., chest, back, legs)",
                },
                "equipment": {
                    "type": "string",
                    "description": "Available equipment (e.g., dumbbells, barbell, bodyweight)",
                },
                "difficulty": {
                    "type": "string",
                    "enum": ["beginner", "intermediate", "advanced"],
                    "description": "Workout difficulty level",
                },
                "max_duration_minutes": {
                    "type": "integer",
                    "description": "Maximum workout duration in minutes",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_workout_history",
        "description": "Get the user's recent workout history including completed workouts, sets, reps, and progress.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Number of recent workouts to return (default: 10)",
                },
            },
            "required": [],
        },
    },
    {
        "name": "create_workout_plan",
        "description": "Create a structured workout plan for the user based on their goals and preferences.",
        "input_schema": {
            "type": "object",
            "properties": {
                "goal": {
                    "type": "string",
                    "description": "Training goal (e.g., muscle gain, fat loss, strength)",
                },
                "days_per_week": {
                    "type": "integer",
                    "description": "Number of training days per week",
                },
                "duration_weeks": {
                    "type": "integer",
                    "description": "Program duration in weeks",
                },
            },
            "required": ["goal"],
        },
    },
]


def execute_tool_stub(tool_name: str, tool_input: Dict[str, Any]) -> str:
    """Execute a tool call with a stub response.

    Returns a message indicating the tool is not yet implemented.
    AMA-440 will replace this with real FunctionDispatcher.

    Args:
        tool_name: The tool being called.
        tool_input: The input arguments.

    Returns:
        Stub response string.
    """
    return (
        f"[Tool '{tool_name}' is not yet connected. "
        f"This feature is coming soon. For now, I'll provide general guidance "
        f"based on my training knowledge.]"
    )
