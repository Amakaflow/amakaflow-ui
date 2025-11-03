"""OCR (Optical Character Recognition) service for extracting text from images."""
import io
import re
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
import numpy as np


class OCRService:
    """Service for performing OCR on images."""
    
    @staticmethod
    def ocr_image_bytes(b: bytes) -> str:
        """
        Extract text from image bytes using OCR with image preprocessing.
        
        Args:
            b: Image bytes
            
        Returns:
            Extracted text string
        """
        img = Image.open(io.BytesIO(b))
        
        # Convert to grayscale
        img = img.convert("L")
        
        # Upscale image for better OCR (especially for small text like "Ax", "Az")
        # Scale to at least 300 DPI equivalent (2x-3x scaling helps with small text)
        width, height = img.size
        if width < 2000 or height < 2000:
            # Upscale by factor to ensure minimum dimensions
            scale_factor = max(2000 / width, 2000 / height, 2.0)
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            img = img.resize((new_width, new_height), Image.LANCZOS)
        
        # Enhance contrast to improve binarization
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)  # Increase contrast by 2x
        
        # Apply slight sharpening to make edges clearer
        img = img.filter(ImageFilter.SHARPEN)
        
        # Binarize (threshold) to black and white
        # Convert to numpy array for thresholding
        img_array = np.array(img)
        
        # Use Otsu's method for automatic thresholding or adaptive threshold
        # For simplicity, use a fixed threshold - adjust based on typical image brightness
        threshold = 128  # Middle gray
        img_array = np.where(img_array > threshold, 255, 0).astype(np.uint8)
        
        # Convert back to PIL Image
        img = Image.fromarray(img_array)
        
        # Use pytesseract with optimized config for better accuracy
        # --psm 6: Assume a single uniform block of text  
        # Don't use whitelist - it can cause spacing issues
        # Instead use PSM 6 which preserves spacing better
        custom_config = r'--oem 3 --psm 6'
        
        try:
            text = pytesseract.image_to_string(img, config=custom_config)
            # Post-process: fix common OCR misreadings for exercise labels
            text = OCRService._post_process_text(text)
            return text
        except Exception:
            # Fallback to default config if custom config fails
            return pytesseract.image_to_string(img)
    
    @staticmethod
    def _post_process_text(text: str) -> str:
        """
        Post-process OCR text to fix common misreadings.
        
        Args:
            text: Raw OCR text
            
        Returns:
            Post-processed text
        """
        # Fix "82:" -> "B2:" (B is often misread as 8)
        text = re.sub(r'\b82([:\-])', r'B2\1', text)
        # Fix similar misreadings for other exercise numbers
        text = re.sub(r'\b81([:\-])', r'B1\1', text)
        text = re.sub(r'\b83([:\-])', r'B3\1', text)
        text = re.sub(r'\b72([:\-])', r'A2\1', text)
        text = re.sub(r'\b71([:\-])', r'A1\1', text)
        text = re.sub(r'\b73([:\-])', r'A3\1', text)
        # Context-aware correction: if we see B1 followed by 82, correct to B2
        text = re.sub(r'(\bB1[:\-].*?\n.*?)82([:\-])', r'\1B2\2', text, flags=re.MULTILINE | re.IGNORECASE)
        # Same for other letter patterns (A1->82=A2, C1->82=C2, etc.)
        text = re.sub(r'(\bA1[:\-].*?\n.*?)72([:\-])', r'\1A2\2', text, flags=re.MULTILINE | re.IGNORECASE)
        text = re.sub(r'(\bC1[:\-].*?\n.*?)82([:\-])', r'\1C2\2', text, flags=re.MULTILINE | re.IGNORECASE)
        text = re.sub(r'(\bD1[:\-].*?\n.*?)82([:\-])', r'\1D2\2', text, flags=re.MULTILINE | re.IGNORECASE)
        # Ensure spaces are preserved around colons and X multipliers
        # Add space after colon if missing: "A1:GOOD" -> "A1: GOOD"
        text = re.sub(r'([A-E]\d*):([A-Z])', r'\1: \2', text)
        # Add space before X when followed by number: "GOODX10" -> "GOOD X10"
        text = re.sub(r'([A-Za-z])X(\d)', r'\1 X\2', text)
        return text
    
    @staticmethod
    def ocr_many_images_to_text(dir_with_pngs: str) -> str:
        """
        Extract text from multiple PNG images in a directory.
        
        Args:
            dir_with_pngs: Directory path containing PNG images
            
        Returns:
            Combined text from all images
        """
        import glob
        import os
        texts = []
        for img_path in sorted(glob.glob(os.path.join(dir_with_pngs, "frame_*.png"))):
            try:
                with Image.open(img_path) as im:
                    im = im.convert("L")
                    txt = pytesseract.image_to_string(im)
                    if txt.strip():
                        texts.append(txt)
            except Exception:
                continue
        return "\n".join(texts)

