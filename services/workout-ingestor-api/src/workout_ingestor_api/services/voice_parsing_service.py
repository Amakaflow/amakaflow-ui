"""Voice workout parsing service using OpenAI API.

Parses natural language workout descriptions into structured workout data
compatible with iOS WorkoutKit intervals format.
"""
import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from workout_ingestor_api.ai import AIClientFactory, AIRequestContext, retry_sync_call


logger = logging.getLogger(__name__)

# Optional dependencies
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None


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
- Superset patterns where two exercises are performed back-to-back

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
    {"kind": "repeat", "reps": <number_of_rounds>, "intervals": [/* nested intervals */]},

    // For supersets: two exercises performed back-to-back without rest between them:
    {"kind": "repeat", "reps": <number_of_rounds>, "intervals": [{"kind": "reps", "reps": <num>, "name": "Exercise A", "sets": 1}, {"kind": "reps", "reps": <num>, "name": "Exercise B", "sets": 1}]}
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
9. For supersets: detect patterns like "A plus B", "A and B", "superset of A and B", "back to back", and group them in a repeat block with both exercises

Sport Detection:
- "running": mentions running, jogging, pace, tempo, intervals, track, miles, 5k
- "strength": mentions weights, reps, sets, barbell, dumbbell, exercises
- "hiit": mentions HIIT, Tabata, work/rest intervals, high intensity
- "cardio": general cardio, cycling, rowing, elliptical
Superset Detection:
Common voice patterns that indicate supersets:
- "Pull-ups 4x8 plus Z Press 4x8" → superset of pull-ups and Z Press
- "Squats and lunges" performed consecutively → superset
- "Superset of push-ups and rows" → group both exercises
- "A plus B" → A and B are a superset
- "Back to back" exercises → superset
- "Dumbbell curl then tricep extension" without rest → superset

When detecting supersets, nest both exercises inside a single repeat block with the same reps.

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

Input: "Pull-ups 4x8 plus Z Press 4x8"
Output:
{
  "name": "Upper Body Superset",
  "sport": "strength",
  "duration": 1800,
  "description": "Pull-ups and Z Press superset",
  "source": "ai",
  "sourceUrl": null,
  "intervals": [
    {"kind": "repeat", "reps": 4, "intervals": [
      {"kind": "reps", "reps": 8, "name": "Pull-up", "sets": 1},
      {"kind": "reps", "reps": 8, "name": "Z Press", "sets": 1}
    ]}
  ],
  "confidence": 0.92,
  "suggestions": ["Consider adding rest between superset rounds"]
}

Return ONLY the JSON object, no additional text or markdown formatting."""

    @classmethod
    def parse_voice_workout(
        cls,
        transcription: str,
        sport_hint: Optional[str] = None,
        api_key: Optional[str] = None,
        model: str = "gpt-4-turbo",
        user_id: Optional[str] = None,
    ) -> VoiceParseResult:
        """
        Parse a voice transcription into structured workout data.

        Args:
            transcription: The transcribed text from voice input
            sport_hint: Optional hint about the sport type
            api_key: OpenAI API key (deprecated, uses config)
            model: OpenAI model to use (default: gpt-4-turbo)
            user_id: Optional user ID for tracking

        Returns:
            VoiceParseResult with parsed workout or error
        """
        if not OPENAI_AVAILABLE:
            return VoiceParseResult(
                success=False,
                error="OpenAI library not installed. Run: pip install openai"
            )

        # Validate transcription
        if not transcription or len(transcription.strip()) < 10:
            return VoiceParseResult(
                success=False,
                error="Could not understand workout description",
                message="The transcription was too short to create a structured workout"
            )

        # Validate sport_hint to prevent prompt injection and DoS
        if sport_hint:
            # Limit length to prevent DoS
            if len(sport_hint) > 100:
                logger.warning(f"sport_hint exceeds max length (100), truncating")
                sport_hint = sport_hint[:100]
            # Whitelist allowed characters (alphanumeric, spaces, hyphens)
            if not re.match(r'^[\w\s-]+$', sport_hint):
                logger.warning(f"sport_hint contains invalid characters, sanitizing")
                sport_hint = re.sub(r'[^\w\s-]', '', sport_hint)
            # Use structured parameter formatting to prevent prompt injection
            safe_sport_hint = sport_hint.strip()

        # Build the prompt with optional sport hint
        user_content = f"Voice transcription:\n{transcription}"
        if sport_hint:
            # Use structured format to prevent prompt injection
            user_content += f"\n\n[SPORT_HINT]: {safe_sport_hint}"

        # Create context for tracking
        context = AIRequestContext(
            user_id=user_id,
            feature_name="voice_workout_parsing",
            custom_properties={"model": model, "sport_hint": sport_hint or "none"},
        )

        try:
            client = AIClientFactory.create_openai_client(context=context)
        except ValueError as e:
            return VoiceParseResult(success=False, error=str(e))

        def _make_api_call() -> Dict[str, Any]:
            response = client.chat.completions.create(
                model=model,
                max_tokens=4096,
                messages=[
                    {"role": "system", "content": cls.VOICE_WORKOUT_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.1,
            )
            result_text = response.choices[0].message.content

            # Extract JSON from response (model may add markdown formatting)
            # Try to find JSON block first, being more careful with nested structures
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                try:
                    return json.loads(json_match.group(0))
                except json.JSONDecodeError:
                    # Fall back to trying entire response if regex match fails
                    pass
            return json.loads(result_text)

        try:
            workout_data = retry_sync_call(_make_api_call)

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
            logger.error(f"Failed to parse OpenAI response as JSON: {e}")
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
