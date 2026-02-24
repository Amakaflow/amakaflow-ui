"""Vision model service for extracting and structuring workout data from images."""
import base64
import io
import json
import logging
from typing import Dict, List, Optional

from PIL import Image

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


class VisionService:
    """Service for using vision models to extract workout data from images."""
    
    WORKOUT_EXTRACTION_PROMPT = """IMPORTANT: These images are sequential frames from a workout video. Exercises are shown one at a time across different frames.

YOUR TASK: Look at EVERY image and extract ALL exercises visible across ALL frames. Combine everything into one complete workout list.

DO NOT stop after the first few exercises - scan through ALL provided images to find EVERY exercise shown.

For each exercise you find, extract:
- Exercise names (EXACTLY as written/spelled in the images)
- Sets and reps numbers (if visible)
- Weights/loads (if visible)
- Time intervals (if visible)
- Rest periods (if visible)

CRITICAL RULES:
1. Look at EVERY image - exercises appear in different frames throughout the video
2. Extract text EXACTLY as written - preserve spelling, capitalization, abbreviations
3. If an exercise name is abbreviated (e.g., "BS"), write it as "BS" - do NOT expand unless the full name is visible
4. Combine all exercises from all frames into one complete list
5. Do NOT make up exercises - only extract what's actually visible
6. If the same exercise appears in multiple frames, include it only once

Return a complete list of ALL exercises visible across ALL images, including:
- Every exercise name found (in order of appearance)
- Any numbers, sets, reps, or timing visible
- Any workout structure information visible"""

    WORKOUT_STRUCTURE_PROMPT = """You are a fitness workout parser. Convert the EXTRACTED workout text (from the images) into structured JSON format.

The workout text may contain:
- Exercise names
- Sets and reps (e.g., "3 sets of 10 reps", "5x5", "15 WALL BALLS" where 15 is the reps)
- Weights/loads (e.g., "32kg", "100lb")
- Time intervals (e.g., "30 seconds", "2 minutes")
- Rest periods
- Equipment notes
- Exercise cues/instructions

CRITICAL: Extract reps from exercise names when they appear at the start:
- "15 WALL BALLS" → reps: 15, name: "WALL BALLS"
- "25 WALL BALLS" → reps: 25, name: "WALL BALLS"
- "1000M RUN" → distance_m: 1000, name: "RUN" (M = meters)
- "60 LUNGES" → reps: 60, name: "LUNGES"
- If a number appears before the exercise name and it's not a distance (no M/meter/km), extract it as reps

Extract and structure this into a JSON format matching:
{
  "title": "workout title",
  "workout_type": "strength | circuit | hiit | cardio | follow_along | mixed",
  "workout_type_confidence": 0.0-1.0,
  "blocks": [
    {
      "label": "block name (e.g., 'Warm-up', 'Strength', 'Conditioning')",
      "structure": "one of: 'superset', 'circuit', 'tabata', 'emom', 'amrap', 'for-time', 'rounds', 'sets', 'regular', or null",
      "exercises": [
        {
          "name": "exercise name (include rep count or distance in name, e.g., '15 WALL BALLS', '1000m RUN')",
          "sets": number or null,
          "reps": number or null,
          "reps_range": "range like '8-10' or null",
          "duration_sec": number or null,
          "rest_sec": number or null,
          "distance_m": number or null,
          "distance_range": "range like '400-800m' or null",
          "type": "strength" or "cardio" or "interval",
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
- "strength": Weight training, bodybuilding (barbell/dumbbell exercises with sets/reps)
- "circuit": Timed circuits, rounds of exercises with minimal rest between
- "hiit": High-intensity interval training (work/rest intervals, Tabata)
- "cardio": Running, cycling, rowing focused
- "follow_along": Video-based workouts
- "mixed": Combination or unclear

Set workout_type_confidence (0.0-1.0) based on clarity of workout type.

CRITICAL INSTRUCTIONS:
- Use ONLY the text that was extracted from the images - do NOT invent, guess, or make up exercises
- Use exercise names EXACTLY as extracted (if "BS" was extracted, use "BS" not "Back Squat")
- Only interpret abbreviations if the image clearly shows the full name elsewhere
- If no clear workout information was extracted, return an empty workout structure (empty blocks array)
- Extract numbers ONLY if they were visible in the images
- If information is missing from images, use null - do NOT guess or use default values
- Group exercises into supersets ONLY if they were clearly grouped in the images
- Preserve workout structure (rounds, AMRAP, EMOM, etc.) ONLY if it was clearly written in the images
- Create blocks ONLY if the images show distinct workout sections

REPS EXTRACTION RULES:
- If an exercise name starts with a number followed by a space (e.g., "15 WALL BALLS"), extract the number as "reps" BUT KEEP IT IN THE NAME
- If the number is followed by "M", "meter", "meters", "km", "mi", "mile", "miles", extract it as "distance_m" BUT KEEP IT IN THE NAME
- Examples:
  * "15 WALL BALLS" → {"reps": 15, "name": "15 WALL BALLS"}
  * "25 WALL BALLS" → {"reps": 25, "name": "25 WALL BALLS"}
  * "1000M RUN" → {"distance_m": 1000, "name": "1000m RUN"}
  * "1 MIN REST" → {"rest_sec": 60, "name": "1 MIN REST"} (convert "1 MIN" to 60 seconds)
- IMPORTANT: Always include the count (reps, distance, or duration) in the exercise name for easier scanning

If the images contain no readable workout text, return:
{
  "title": null,
  "workout_type": null,
  "workout_type_confidence": null,
  "blocks": []
}

Return ONLY valid JSON matching the format above, no additional text or explanations."""

    @staticmethod
    def image_to_base64(image_path: str) -> str:
        """Convert image file to base64 string for API."""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    @staticmethod
    def image_to_base64_resized(image_path: str, max_size: int = 1024, quality: int = 75) -> tuple[str, str]:
        """
        Convert image to base64, resizing if needed to reduce file size.

        Args:
            image_path: Path to image file
            max_size: Maximum dimension (width or height) in pixels
            quality: JPEG quality (1-100)

        Returns:
            Tuple of (base64_string, format_string)
        """
        with Image.open(image_path) as img:
            # Convert to RGB if needed (for PNG with transparency)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Resize if larger than max_size
            if max(img.size) > max_size:
                ratio = max_size / max(img.size)
                new_size = (int(img.width * ratio), int(img.height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)

            # Save to bytes as JPEG for better compression
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=quality, optimize=True)
            buffer.seek(0)

            return base64.b64encode(buffer.read()).decode('utf-8'), 'jpeg'

    @staticmethod
    def extract_text_from_images_openai(
        image_paths: List[str],
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Extract text from workout images using OpenAI Vision API.

        Args:
            image_paths: List of paths to image files
            model: OpenAI model to use (gpt-4o-mini or gpt-4o recommended)
            api_key: OpenAI API key (deprecated, uses config)
            user_id: Optional user ID for tracking

        Returns:
            Extracted text from all images
        """
        if not OPENAI_AVAILABLE:
            raise ValueError(
                "OpenAI library not installed. Run: pip install openai"
            )

        # Create context for tracking
        context = AIRequestContext(
            user_id=user_id,
            feature_name="vision_extract_text",
            custom_properties={"model": model, "image_count": str(len(image_paths))},
        )

        client = AIClientFactory.create_openai_client(context=context)

        # Prepare image content for API
        image_content = []
        for image_path in image_paths:
            base64_image = VisionService.image_to_base64(image_path)
            # Get image format
            with Image.open(image_path) as img:
                img_format = img.format.lower() or "jpeg"

            image_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/{img_format};base64,{base64_image}"
                }
            })

        def _make_api_call() -> str:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": VisionService.WORKOUT_EXTRACTION_PROMPT},
                            *image_content
                        ]
                    }
                ],
                temperature=0.1,  # Low temperature for accurate text extraction
                max_tokens=4000
            )
            return response.choices[0].message.content or ""

        try:
            return retry_sync_call(_make_api_call)
        except Exception as e:
            logger.error(f"OpenAI Vision API call failed after retries: {e}")
            raise ValueError(f"OpenAI Vision API call failed: {e}") from e

    @staticmethod
    def extract_and_structure_workout_openai(
        image_paths: List[str],
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict:
        """
        Extract and structure workout data from images using OpenAI Vision API.

        Works with:
        - ChatGPT Plus ($20/month) - includes API access
        - OpenAI API account (pay-as-you-go)

        Args:
            image_paths: List of paths to image files
            model: OpenAI model to use (gpt-4o-mini recommended for cost, gpt-4o for accuracy)
            api_key: OpenAI API key (deprecated, uses config)
            user_id: Optional user ID for tracking

        Returns:
            Structured workout JSON
        """
        if not OPENAI_AVAILABLE:
            raise ValueError(
                "OpenAI library not installed. Run: pip install openai"
            )

        # Create context for tracking
        context = AIRequestContext(
            user_id=user_id,
            feature_name="vision_extract_and_structure",
            custom_properties={"model": model, "image_count": str(len(image_paths))},
        )

        client = AIClientFactory.create_openai_client(context=context)

        # Prepare image content for API - resize images to stay under 50MB limit
        image_content = []
        for image_path in image_paths:
            # Use resized images to reduce total size (25 frames * 2MB = 50MB limit)
            base64_image, img_format = VisionService.image_to_base64_resized(
                image_path, max_size=1024, quality=70
            )

            image_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/{img_format};base64,{base64_image}"
                }
            })

        # Combine prompts with clear separation
        combined_prompt = f"""{VisionService.WORKOUT_EXTRACTION_PROMPT}

{VisionService.WORKOUT_STRUCTURE_PROMPT}

FINAL REMINDER:
- Look at EVERY image - these are sequential frames, exercises appear throughout
- Extract ALL exercises visible across ALL frames - do not stop early
- Do NOT invent or make up exercises - only extract what's visible
- Use exercise names EXACTLY as written in images (preserve abbreviations)
- Combine all exercises from all frames into one complete workout"""

        def _make_api_call() -> Dict:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": combined_prompt},
                            *image_content
                        ]
                    }
                ],
                temperature=0.1,  # Low temperature for accuracy
                response_format={"type": "json_object"},
                max_tokens=4000
            )

            result_text = response.choices[0].message.content
            return json.loads(result_text)

        try:
            workout_dict = retry_sync_call(_make_api_call)

            # Post-process: Filter out obviously garbled/invalid exercise names
            # If exercise names look like OCR garbage (random chars, symbols), remove them
            for block in workout_dict.get("blocks", []):
                exercises = block.get("exercises", [])
                filtered_exercises = []
                for ex in exercises:
                    name = ex.get("name", "").strip()
                    if not name:
                        continue

                    # Skip if name is clearly garbled/invalid:
                    # 1. Too short (1-2 chars) with no meaningful content
                    # 2. Mostly symbols/special characters
                    # 3. Pattern matching OCR garbage (random combinations)

                    # Count meaningful characters
                    letters = sum(c.isalpha() for c in name)
                    digits = sum(c.isdigit() for c in name)
                    spaces = sum(c.isspace() for c in name)
                    symbols = len(name) - letters - digits - spaces

                    # Valid exercise name criteria:
                    # - Has at least 2 letters, OR
                    # - Has at least 4 characters total with more letters/digits than symbols
                    if len(name) <= 2 and letters == 0:
                        continue  # Too short, no letters

                    if len(name) >= 3:
                        # For longer names, require meaningful content
                        meaningful = letters + digits
                        if meaningful == 0:
                            continue  # Only symbols

                        # If mostly symbols, skip (likely OCR garbage)
                        if symbols > meaningful * 2:
                            continue

                        # If it's just random characters/symbols with no pattern, skip
                        # Check for patterns that suggest OCR garbage
                        if all(c in "®°©™'\"()[]{}.,;:!?-_=+|\\/@#$%^&*~`" for c in name.replace(" ", "")):
                            continue

                    # Keep this exercise
                    filtered_exercises.append(ex)

                block["exercises"] = filtered_exercises

            # If all exercises were filtered out, keep at least empty structure
            # (don't delete blocks, just empty their exercises)

            return workout_dict
        except Exception as e:
            logger.error(f"OpenAI Vision API call failed after retries: {e}")
            raise ValueError(f"OpenAI Vision API call failed: {e}") from e

    @staticmethod
    def extract_text_from_images_anthropic(
        image_paths: List[str],
        model: str = "claude-3-5-sonnet-20241022",
        api_key: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Extract text from workout images using Anthropic Claude Vision API.

        Args:
            image_paths: List of paths to image files
            model: Claude model to use
            api_key: Anthropic API key (deprecated, uses config)
            user_id: Optional user ID for tracking

        Returns:
            Extracted text from all images
        """
        if not ANTHROPIC_AVAILABLE:
            raise ValueError(
                "Anthropic library not installed. Run: pip install anthropic"
            )

        # Create context for tracking
        context = AIRequestContext(
            user_id=user_id,
            feature_name="vision_extract_text_anthropic",
            custom_properties={"model": model, "image_count": str(len(image_paths))},
        )

        client = AIClientFactory.create_anthropic_client(context=context)

        # Prepare image content for API
        image_content = []
        for image_path in image_paths:
            with open(image_path, "rb") as image_file:
                image_data = image_file.read()
                base64_image = base64.b64encode(image_data).decode('utf-8')

            with Image.open(image_path) as img:
                img_format = img.format.lower() or "jpeg"

            image_content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": f"image/{img_format}",
                    "data": base64_image
                }
            })

        def _make_api_call() -> str:
            message = client.messages.create(
                model=model,
                max_tokens=4096,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": VisionService.WORKOUT_EXTRACTION_PROMPT},
                            *image_content
                        ]
                    }
                ],
                temperature=0.1
            )
            return message.content[0].text

        try:
            return retry_sync_call(_make_api_call)
        except Exception as e:
            logger.error(f"Anthropic Vision API call failed after retries: {e}")
            raise ValueError(f"Anthropic Vision API call failed: {e}") from e

    @staticmethod
    def extract_text_from_images(
        image_paths: List[str],
        provider: str = "openai",
        model: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Extract text from workout images using vision model.
        
        Args:
            image_paths: List of paths to image files
            provider: Vision provider ("openai" or "anthropic")
            model: Model name (optional, uses defaults)
            **kwargs: Additional arguments for provider
            
        Returns:
            Extracted text from all images
        """
        if provider.lower() == "openai":
            default_model = model or "gpt-4o-mini"
            return VisionService.extract_text_from_images_openai(
                image_paths, model=default_model, **kwargs
            )
        elif provider.lower() == "anthropic":
            default_model = model or "claude-3-5-sonnet-20241022"
            return VisionService.extract_text_from_images_anthropic(
                image_paths, model=default_model, **kwargs
            )
        else:
            raise ValueError(f"Unknown vision provider: {provider}. Use 'openai' or 'anthropic'.")

