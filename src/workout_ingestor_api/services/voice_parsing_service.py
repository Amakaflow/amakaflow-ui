"""Voice workout parsing service using Claude API.

Parses natural language workout descriptions into structured workout data
compatible with iOS WorkoutKit intervals format.
"""
import os
import json
import re
import uuid
import logging
from typing import Dict, Optional, List, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Optional dependencies
try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    Anthropic = None


@dataclass
class VoiceParseResult:
    """Result of parsing voice transcription."""
    success: bool
    workout: Optional[Dict[str, Any]] = None
    confidence: float = 0.0
    suggestions: List[str] = field(default_factory=list)
    error: Optional[str] = None
    message: Optional[str] = None


class VoiceParsingService:
    """Service for parsing voice transcriptions into structured workouts."""

    VOICE_WORKOUT_PROMPT = """You are a fitness workout parser specialized in converting spoken workout descriptions into structured workout data.

Parse the following voice transcription into a structured workout. The user may describe:
- Running/cardio workouts with intervals, distances, paces
- Strength workouts with exercises, sets, reps, weights
- HIIT/circuit workouts with timed intervals
- Mixed workouts combining multiple types

Output ONLY valid JSON matching this exact schema:

{
  "name": "Descriptive workout name based on content",
  "sport": "running | cycling | strength | mobility | swimming | cardio | hiit | mixed",
  "duration": <estimated total duration in seconds>,
  "description": "Brief 1-2 sentence summary",
  "source": "ai",
  "sourceUrl": null,
  "intervals": [
    // Use these interval types:

    // For warmup periods:
    {"kind": "warmup", "seconds": <duration>, "target": "description like 'Easy jog'"},

    // For cooldown periods:
    {"kind": "cooldown", "seconds": <duration>, "target": "description"},

    // For timed intervals:
    {"kind": "time", "seconds": <duration>, "target": "description like 'Tempo pace' or 'Rest'"},

    // For distance-based intervals:
    {"kind": "distance", "meters": <distance_in_meters>, "target": "description like '5K pace'"},

    // For strength exercises:
    {"kind": "reps", "reps": <number>, "name": "Exercise Name", "sets": <number>, "load": "weight description", "restSec": <rest_between_sets>},

    // For repeated intervals (use this to group work/rest cycles):
    {"kind": "repeat", "reps": <number_of_rounds>, "intervals": [/* nested intervals */]}
  ],
  "confidence": <0.0-1.0 based on parsing certainty>,
  "suggestions": ["Helpful suggestion 1", "Suggestion 2"]
}

Parsing Rules:
1. Convert time references: "5 minutes" → 300 seconds, "30 seconds" → 30 seconds, "1 hour" → 3600 seconds
2. Convert distances: "1 mile" → 1609 meters, "400 meters" → 400 meters, "1k" → 1000 meters, "5k" → 5000 meters
3. Use "repeat" blocks for interval patterns like "4x400m" or "3 rounds of..."
4. For "work/rest" patterns, nest both in a repeat block
5. Include warmup/cooldown when mentioned, default to 5 min if workout seems to need one
6. For strength: extract exercise names, sets, reps, and weights if mentioned
7. Set confidence: 0.9+ if very clear, 0.7-0.9 if reasonably clear, 0.5-0.7 if some guessing
8. Add suggestions for ambiguous parts (e.g., "Consider specifying rest duration")

Sport Detection:
- "running": mentions running, jogging, pace, tempo, intervals, track, miles, 5k
- "strength": mentions weights, reps, sets, barbell, dumbbell, exercises
- "hiit": mentions HIIT, Tabata, work/rest intervals, high intensity
- "cardio": general cardio, cycling, rowing, elliptical
- "mixed": combination of multiple types

Examples:

Input: "5 minute warmup jog, then 4 sets of 400 meters at 5k pace with 90 seconds rest between each, then 10 minute cooldown"
Output:
{
  "name": "4x400m Interval Workout",
  "sport": "running",
  "duration": 2100,
  "description": "400m repeats at 5K pace with 90s recovery",
  "source": "ai",
  "sourceUrl": null,
  "intervals": [
    {"kind": "warmup", "seconds": 300, "target": "Easy jog"},
    {"kind": "repeat", "reps": 4, "intervals": [
      {"kind": "distance", "meters": 400, "target": "5K pace"},
      {"kind": "time", "seconds": 90, "target": "Rest"}
    ]},
    {"kind": "cooldown", "seconds": 600, "target": "Easy jog"}
  ],
  "confidence": 0.95,
  "suggestions": ["Consider specifying the exact 5K pace target"]
}

Input: "Strength workout: 4 sets of 8 squats at 185 pounds, then 3 sets of 10 Romanian deadlifts at 135"
Output:
{
  "name": "Lower Body Strength",
  "sport": "strength",
  "duration": 2400,
  "description": "Squats and Romanian deadlifts workout",
  "source": "ai",
  "sourceUrl": null,
  "intervals": [
    {"kind": "reps", "reps": 8, "name": "Barbell Squat", "sets": 4, "load": "185 lbs", "restSec": 90},
    {"kind": "reps", "reps": 10, "name": "Romanian Deadlift", "sets": 3, "load": "135 lbs", "restSec": 90}
  ],
  "confidence": 0.92,
  "suggestions": ["Rest periods estimated at 90 seconds - adjust as needed"]
}

Return ONLY the JSON object, no additional text or markdown formatting."""

    @classmethod
    def parse_voice_workout(
        cls,
        transcription: str,
        sport_hint: Optional[str] = None,
        api_key: Optional[str] = None,
        model: str = "claude-sonnet-4-20250514"
    ) -> VoiceParseResult:
        """
        Parse a voice transcription into structured workout data.

        Args:
            transcription: The transcribed text from voice input
            sport_hint: Optional hint about the sport type
            api_key: Anthropic API key (or use ANTHROPIC_API_KEY env var)
            model: Claude model to use

        Returns:
            VoiceParseResult with parsed workout or error
        """
        if not ANTHROPIC_AVAILABLE:
            return VoiceParseResult(
                success=False,
                error="Anthropic library not installed. Run: pip install anthropic"
            )

        api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return VoiceParseResult(
                success=False,
                error="Anthropic API key not provided. Set ANTHROPIC_API_KEY environment variable."
            )

        # Validate transcription
        if not transcription or len(transcription.strip()) < 10:
            return VoiceParseResult(
                success=False,
                error="Could not understand workout description",
                message="The transcription was too short to create a structured workout"
            )

        # Build the prompt with optional sport hint
        user_content = f"Voice transcription:\n{transcription}"
        if sport_hint:
            user_content += f"\n\nSport type hint: {sport_hint}"

        client = Anthropic(api_key=api_key, timeout=60.0)

        try:
            message = client.messages.create(
                model=model,
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": f"{cls.VOICE_WORKOUT_PROMPT}\n\n{user_content}"}
                ],
                temperature=0.1,
            )

            result_text = message.content[0].text

            # Extract JSON from response (Claude may add markdown formatting)
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                workout_data = json.loads(json_match.group(0))
            else:
                workout_data = json.loads(result_text)

            # Validate required fields
            if not workout_data.get("intervals"):
                return VoiceParseResult(
                    success=False,
                    error="Could not understand workout description",
                    message="No exercises or intervals could be extracted from the description"
                )

            # Add workout ID if not present
            if not workout_data.get("id"):
                workout_data["id"] = str(uuid.uuid4())

            # Extract confidence and suggestions
            confidence = workout_data.pop("confidence", 0.8)
            suggestions = workout_data.pop("suggestions", [])

            return VoiceParseResult(
                success=True,
                workout=workout_data,
                confidence=confidence,
                suggestions=suggestions
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude response as JSON: {e}")
            return VoiceParseResult(
                success=False,
                error="Failed to parse workout structure",
                message="The AI response was not in the expected format"
            )
        except Exception as e:
            logger.exception(f"Voice parsing failed: {e}")
            return VoiceParseResult(
                success=False,
                error=f"Failed to parse voice workout: {str(e)}"
            )
