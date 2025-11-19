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
    
    WORKOUT_EXTRACTION_PROMPT = """CRITICAL: Extract workout information ONLY from what you can ACTUALLY SEE in these images. Do NOT make up or guess exercises that are not visible.

Look carefully at each image and extract:
- Exercise names (EXACTLY as written/spelled in the images)
- Sets and reps numbers (if visible)
- Weights/loads (if visible)
- Time intervals (if visible)
- Rest periods (if visible)
- Structure information (e.g., "for time", "EMOM", "3 rounds", "AMRAP" - if visible)
- Any text, labels, or numbers visible in the images

IMPORTANT:
- Only extract text that is clearly visible in the images
- Preserve exact spelling and capitalization from the images
- If something is unclear or not visible, use null or omit it
- Do NOT invent generic workout data like "Squats" or "Bench Press" if you cannot see them
- Pay attention to all text in the images, including handwritten notes, captions, and labels"""

    WORKOUT_STRUCTURE_PROMPT = """You are a fitness workout parser. Convert the EXTRACTED workout text (from the images) into structured JSON format.

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
- Use ONLY the text that was extracted from the images - do NOT invent or add exercises
- If no exercises were visible in the images, return an empty workout structure
- Preserve exact exercise names as extracted (including any spelling errors or abbreviations)
- Extract all numbers exactly as shown in the images
- If information is missing from the images, use null - do NOT guess or invent values
- Group exercises into supersets only if they were clearly grouped in the images
- Preserve time caps, intervals, and structure information exactly as extracted

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

Remember: Only use information that is ACTUALLY visible in the images. Do not invent exercises."""
        
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
            return json.loads(result_text)
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

