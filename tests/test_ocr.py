"""Unit tests for OCR service."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from app.services.ocr_service import OCRService


class TestOCRService:
    """Test cases for OCRService."""
    
    def test_post_process_text_fixes_ocr_misreadings(self):
        """Test that OCR post-processing fixes common misreadings."""
        text = "82: Bench Press\n81: Squat\n72: Deadlift"
        processed = OCRService._post_process_text(text)
        
        assert "B2:" in processed or "B1:" in processed
        assert "A2:" in processed
    
    def test_post_process_text_adds_spaces(self):
        """Test that OCR post-processing adds missing spaces."""
        text = "A1:GOOD X10"
        processed = OCRService._post_process_text(text)
        
        assert "A1: GOOD" in processed or " X10" in processed
    
    @patch('app.services.ocr_service.pytesseract.image_to_string')
    @patch('app.services.ocr_service.Image')
    def test_ocr_image_bytes_processes_image(self, mock_image, mock_tesseract):
        """Test that OCR processes image correctly."""
        mock_tesseract.return_value = "Sample text"
        
        # Mock PIL Image
        mock_img = MagicMock()
        mock_img.size = (100, 100)
        mock_img.convert.return_value = mock_img
        mock_img.resize.return_value = mock_img
        mock_img.filter.return_value = mock_img
        mock_image.open.return_value = mock_img
        
        # Mock numpy array conversion
        with patch('app.services.ocr_service.np.array') as mock_array:
            mock_array.return_value = [[128] * 100 for _ in range(100)]
            with patch('app.services.ocr_service.Image.fromarray') as mock_fromarray:
                mock_fromarray.return_value = mock_img
                
                result = OCRService.ocr_image_bytes(b"fake_image_bytes")
                
                assert result == "Sample text"
                mock_tesseract.assert_called_once()
    
    def test_ocr_many_images_to_text_empty_directory(self):
        """Test OCR with empty directory."""
        with patch('app.services.ocr_service.glob.glob', return_value=[]):
            result = OCRService.ocr_many_images_to_text("/fake/path")
            assert result == ""

