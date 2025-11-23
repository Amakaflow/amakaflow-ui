"""Vision model service for extracting and structuring workout data from images."""
import os
import json
import base64
from typing import Dict, List, Optional
from PIL import Image
import io

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
    
    WORKOUT_EXTRACTION_PROMPT = """CRITICAL: Extract ONLY the workout information that is ACTUALLY VISIBLE in these images. 

DO NOT invent, guess, or make up exercises that are not clearly visible in the images.

Look carefully at each image and extract ONLY what you can actually see:
- Exercise names (EXACTLY as written/spelled in the images - do NOT interpret abbreviations as full names)
- Sets and reps numbers (ONLY if clearly visible)
- Weights/loads (ONLY if clearly visible)
- Time intervals (ONLY if clearly visible)
- Rest periods (ONLY if clearly visible)
- Structure information (ONLY if clearly visible in the images)

CRITICAL RULES:
1. Extract text EXACTLY as written in the images - preserve spelling, capitalization, abbreviations
2. If an exercise name is abbreviated (e.g., "BS"), write it as "BS" - do NOT expand to "Back Squat" unless that's literally what the image says
3. If text is unclear or partially visible, write what you can see (e.g., "Jumpi..." not "Jumping Jacks")
4. If you cannot clearly see workout information in an image, do NOT make up generic exercises
5. If an image appears to be blank, has no text, or is too blurry to read, say so
6. Do NOT use common workout terminology unless it's literally written in the image

Return a detailed description of what you can ACTUALLY SEE in each image, including:
- Any text that is visible (even if unclear)
- Exercise names as written (even if abbreviated or stylized)
- Numbers that are visible
- Any workout structure that is clearly written"""

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
  "blocks": []
}

Return ONLY valid JSON matching the format above, no additional text or explanations."""

    @staticmethod
    def image_to_base64(image_path: str) -> str:
        """Convert image file to base64 string for API."""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    @staticmethod
    def extract_text_from_images_openai(
        image_paths: List[str],
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None
    ) -> str:
        """
        Extract text from workout images using OpenAI Vision API.
        
        Args:
            image_paths: List of paths to image files
            model: OpenAI model to use (gpt-4o-mini or gpt-4o recommended)
            api_key: OpenAI API key (or use OPENAI_API_KEY env var)
            
        Returns:
            Extracted text from all images
        """
        if not OPENAI_AVAILABLE:
            raise ValueError(
                "OpenAI library not installed. Run: pip install openai"
            )
        
        api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenAI API key not provided. Set OPENAI_API_KEY environment variable."
            )
        
        client = openai.OpenAI(api_key=api_key)
        
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
        
        try:
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
        except Exception as e:
            raise ValueError(f"OpenAI Vision API call failed: {e}") from e

    @staticmethod
    def extract_and_structure_workout_openai(
        image_paths: List[str],
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None
    ) -> Dict:
        """
        Extract and structure workout data from images using OpenAI Vision API.
        
        Works with:
        - ChatGPT Plus ($20/month) - includes API access
        - OpenAI API account (pay-as-you-go)
        
        Args:
            image_paths: List of paths to image files
            model: OpenAI model to use (gpt-4o-mini recommended for cost, gpt-4o for accuracy)
            api_key: OpenAI API key (or use OPENAI_API_KEY env var, or pass from request)
            
        Returns:
            Structured workout JSON
        """
        """
        Extract and structure workout data from images in one API call.
        
        This is more efficient and often more accurate than extracting text then structuring.
        
        Args:
            image_paths: List of paths to image files
            model: OpenAI model to use (gpt-4o-mini or gpt-4o recommended)
            api_key: OpenAI API key (or use OPENAI_API_KEY env var)
            
        Returns:
            Structured workout JSON
        """
        if not OPENAI_AVAILABLE:
            raise ValueError(
                "OpenAI library not installed. Run: pip install openai"
            )
        
        api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenAI API key not provided. Set OPENAI_API_KEY environment variable."
            )
        
        client = openai.OpenAI(api_key=api_key)
        
        # Prepare image content for API
        image_content = []
        for image_path in image_paths:
            base64_image = VisionService.image_to_base64(image_path)
            with Image.open(image_path) as img:
                img_format = img.format.lower() or "jpeg"
            
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
- Extract ONLY what you can ACTUALLY SEE in the images
- Do NOT invent or make up exercises
- If images are blank, blurry, or contain no readable workout text, return empty workout structure
- Use exercise names EXACTLY as written in images (preserve abbreviations, don't expand them)
- If you cannot clearly see workout data, return empty blocks array rather than guessing"""
        
        try:
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
            workout_dict = json.loads(result_text)
            
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
            raise ValueError(f"OpenAI Vision API call failed: {e}") from e

    @staticmethod
    def extract_text_from_images_anthropic(
        image_paths: List[str],
        model: str = "claude-3-5-sonnet-20241022",
        api_key: Optional[str] = None
    ) -> str:
        """
        Extract text from workout images using Anthropic Claude Vision API.
        
        Args:
            image_paths: List of paths to image files
            model: Claude model to use
            api_key: Anthropic API key (or use ANTHROPIC_API_KEY env var)
            
        Returns:
            Extracted text from all images
        """
        if not ANTHROPIC_AVAILABLE:
            raise ValueError(
                "Anthropic library not installed. Run: pip install anthropic"
            )
        
        api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError(
                "Anthropic API key not provided. Set ANTHROPIC_API_KEY environment variable."
            )
        
        client = Anthropic(api_key=api_key)
        
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
        
        try:
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
        except Exception as e:
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

