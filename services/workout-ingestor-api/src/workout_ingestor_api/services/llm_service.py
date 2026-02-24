"""LLM service for structuring workout text into canonical JSON format."""
import json
import logging
import re
from typing import Dict, Optional
from fastapi import HTTPException

from workout_ingestor_api.ai import AIClientFactory, AIRequestContext, retry_sync_call


logger = logging.getLogger(__name__)

# Optional dependencies
try:
    import openai  # type: ignore
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    openai = None

try:
    from anthropic import Anthropic  # type: ignore
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    Anthropic = None


class LLMService:
    """Service for using LLMs to structure workout data."""
    
    WORKOUT_STRUCTURE_PROMPT = """You are a fitness workout parser. Convert the following workout text into structured JSON format.

The workout text may contain:
- Exercise names
- Sets and reps (e.g., "3 sets of 10 reps", "5x5")
- Weights/loads (e.g., "32kg", "100lb")
- Time intervals (e.g., "30 seconds", "2 minutes")
- Rest periods
- Equipment notes
- Exercise cues/instructions

Extract and structure this into a JSON format matching:
{
  "title": "workout title",
  "workout_type": "strength | circuit | hiit | cardio | follow_along | mixed",
  "workout_type_confidence": 0.0-1.0,
  "blocks": [
    {
      "label": "block name (e.g., 'Warm-up', 'Strength', 'Conditioning')",
      "structure": "structure description (e.g., '3 sets', 'for time')",
      "exercises": [
        {
          "name": "exercise name",
          "sets": number or null,
          "reps": number or null,
          "reps_range": "range like '8-10' or null",
          "weight_kg": number or null,
          "duration_sec": number or null,
          "rest_sec": number or null,
          "distance_m": number or null,
          "notes": "any additional cues or instructions"
        }
      ],
      "supersets": [
        {
          "exercises": [/* same format as above */],
          "rest_between_sec": number or null
        }
      ]
    }
  ]
}

Workout Type Detection:
- "strength": Weight training, bodybuilding, powerlifting (barbell/dumbbell exercises with sets/reps)
- "circuit": Timed circuits, rounds of exercises with minimal rest between
- "hiit": High-intensity interval training (work/rest intervals, Tabata, etc.)
- "cardio": Running, cycling, rowing, swimming focused
- "follow_along": Video-based workouts, along-with-me style
- "mixed": Combination of multiple types or unclear

Set workout_type_confidence between 0.0 and 1.0:
- 0.9-1.0: Very clear workout type (e.g., "5x5 Strength Training")
- 0.7-0.9: Likely workout type based on exercise selection
- 0.5-0.7: Mixed signals, moderate confidence
- Below 0.5: Unclear or ambiguous workout type

Focus on accuracy:
- Prefer OCR-extracted numbers for reps/weights/times (they're more accurate)
- Use transcript/ASR text for exercise names and instructions
- If numbers conflict, prefer OCR values
- Group exercises into supersets if they're performed together
- Preserve time caps, intervals, and structure information

Return ONLY valid JSON, no additional text."""

    @staticmethod
    def structure_with_openai(
        text: str,
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict:
        """
        Structure workout text using OpenAI API.

        Args:
            text: Fused workout text
            model: OpenAI model to use
            api_key: OpenAI API key (deprecated, uses config)
            user_id: Optional user ID for tracking

        Returns:
            Structured workout JSON
        """
        if not OPENAI_AVAILABLE:
            raise HTTPException(
                status_code=500,
                detail="OpenAI library not installed. Run: pip install openai"
            )

        # Create context for tracking
        context = AIRequestContext(
            user_id=user_id,
            feature_name="llm_structure_workout",
            custom_properties={"model": model},
        )

        try:
            client = AIClientFactory.create_openai_client(context=context)
        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))

        def _make_api_call() -> Dict:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": LLMService.WORKOUT_STRUCTURE_PROMPT},
                    {"role": "user", "content": text}
                ],
                temperature=0.1,  # Low temperature for structured output
                response_format={"type": "json_object"},
                timeout=60.0  # 60 second timeout
            )
            result_text = response.choices[0].message.content
            return json.loads(result_text)

        try:
            return retry_sync_call(_make_api_call)
        except Exception as e:
            logger.error(f"OpenAI API call failed after retries: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"OpenAI API call failed: {e}"
            )
    
    @staticmethod
    def structure_with_anthropic(
        text: str,
        model: str = "claude-3-5-sonnet-20241022",
        api_key: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict:
        """
        Structure workout text using Anthropic Claude API.

        Args:
            text: Fused workout text
            model: Claude model to use
            api_key: Anthropic API key (deprecated, uses config)
            user_id: Optional user ID for tracking

        Returns:
            Structured workout JSON
        """
        if not ANTHROPIC_AVAILABLE:
            raise HTTPException(
                status_code=500,
                detail="Anthropic library not installed. Run: pip install anthropic"
            )

        # Create context for tracking
        context = AIRequestContext(
            user_id=user_id,
            feature_name="llm_structure_workout",
            custom_properties={"model": model},
        )

        try:
            client = AIClientFactory.create_anthropic_client(context=context)
        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))

        def _make_api_call() -> Dict:
            message = client.messages.create(
                model=model,
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": f"{LLMService.WORKOUT_STRUCTURE_PROMPT}\n\nWorkout text:\n{text}"}
                ],
                temperature=0.1,
            )
            result_text = message.content[0].text
            # Extract JSON from response (Claude may add markdown formatting)
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            return json.loads(result_text)

        try:
            return retry_sync_call(_make_api_call)
        except Exception as e:
            logger.error(f"Anthropic API call failed after retries: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Anthropic API call failed: {e}"
            )
    
    @staticmethod
    def structure_workout(
        text: str,
        provider: str = "openai",
        **kwargs
    ) -> Dict:
        """
        Structure workout text using specified LLM provider.
        
        Args:
            text: Fused workout text
            provider: LLM provider ("openai" or "anthropic")
            **kwargs: Additional arguments for provider
            
        Returns:
            Structured workout JSON
        """
        if provider.lower() == "openai":
            return LLMService.structure_with_openai(text, **kwargs)
        elif provider.lower() == "anthropic":
            return LLMService.structure_with_anthropic(text, **kwargs)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown LLM provider: {provider}. Use 'openai' or 'anthropic'."
            )

