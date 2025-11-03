"""Unit tests for utility functions."""
import pytest
from app.utils import to_int, upper_from_range


class TestUtils:
    """Test cases for utility functions."""
    
    def test_to_int_valid(self):
        """Test to_int with valid input."""
        assert to_int("10") == 10
        assert to_int("0") == 0
        assert to_int("-5") == -5
    
    def test_to_int_invalid(self):
        """Test to_int with invalid input."""
        assert to_int("abc") is None
        assert to_int("") is None
        assert to_int(None) is None
    
    def test_upper_from_range(self):
        """Test upper_from_range extraction."""
        assert upper_from_range("10-12") == 12
        assert upper_from_range("8-10") == 10
        assert upper_from_range("5-8") == 8
    
    def test_upper_from_range_invalid(self):
        """Test upper_from_range with invalid input."""
        assert upper_from_range("10") is None
        assert upper_from_range("invalid") is None
        assert upper_from_range("") is None
    
    def test_upper_from_range_en_dash(self):
        """Test upper_from_range with en dash."""
        assert upper_from_range("10–12") == 12

