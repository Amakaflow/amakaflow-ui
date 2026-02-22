#!/usr/bin/env python3
"""
Unit tests for workout_import_qa.py

Tests for: parse_kimi_response, build_report, set_has_issues_output
"""

import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the functions to test
# We need to re-import from the module
import importlib.util
spec = importlib.util.spec_from_file_location(
    "workout_import_qa",
    os.path.join(os.path.dirname(__file__), "workout_import_qa.py")
)
qa_module = importlib.util.module_from_spec(spec)

# We can't directly load the module because it has async main
# So let's test the pure functions by copying them here for testing
# Actually, let's just load the module and patch the async parts


class TestParseKimIResponse(unittest.TestCase):
    """Tests for parse_kimi_response function."""
    
    def test_ok_response(self):
        """Test that 'OK' response is parsed correctly."""
        from workout_import_qa import parse_kimi_response
        result = parse_kimi_response("Everything looks good. OK. The UI is displaying correctly.")
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["issues"], [])
    
    def test_issues_found(self):
        """Test that issues are detected in response."""
        from workout_import_qa import parse_kimi_response
        response = "I see a problem with the workout title. The title area appears blank."
        result = parse_kimi_response(response)
        self.assertEqual(result["status"], "issues")
        self.assertTrue(len(result["issues"]) > 0)
    
    def test_error_response(self):
        """Test that error responses are detected."""
        from workout_import_qa import parse_kimi_response
        result = parse_kimi_response("Error: Failed to load the workout data.")
        self.assertEqual(result["status"], "error")
        self.assertTrue(len(result["issues"]) > 0)
    
    def test_multiple_issues(self):
        """Test that multiple issues are captured."""
        from workout_import_qa import parse_kimi_response
        response = "There are multiple problems: the title is wrong, the description is missing, and the duration shows an incorrect value."
        result = parse_kimi_response(response)
        self.assertEqual(result["status"], "issues")
    
    def test_broken_keyword(self):
        """Test that 'broken' keyword triggers issues."""
        from workout_import_qa import parse_kimi_response
        result = parse_kimi_response("The layout looks broken in the sidebar.")
        self.assertEqual(result["status"], "issues")


class TestBuildReport(unittest.TestCase):
    """Tests for build_report function."""
    
    def test_empty_results(self):
        """Test report with no results."""
        from workout_import_qa import build_report
        report = build_report([])
        self.assertIn("Total", report)
        self.assertIn("0", report)
    
    def test_all_ok(self):
        """Test report with all OK results."""
        from workout_import_qa import build_report
        results = [
            {"url": "https://example.com/1", "status": "ok", "issues": [], "screenshot_path": "/path/1.png"},
            {"url": "https://example.com/2", "status": "ok", "issues": [], "screenshot_path": "/path/2.png"},
        ]
        report = build_report(results)
        self.assertIn("| 2 | 2 | 0 | 0 |", report)
        self.assertIn("✅", report)
    
    def test_with_issues(self):
        """Test report with issues."""
        from workout_import_qa import build_report
        results = [
            {"url": "https://example.com/1", "status": "ok", "issues": [], "screenshot_path": "/path/1.png"},
            {"url": "https://example.com/2", "status": "issues", "issues": ["Title missing", "Duration error"], "screenshot_path": "/path/2.png"},
        ]
        report = build_report(results)
        self.assertIn("| 2 | 1 | 1 | 0 |", report)
        self.assertIn("⚠️", report)
        self.assertIn("Title missing", report)
    
    def test_with_errors(self):
        """Test report with errors."""
        from workout_import_qa import build_report
        results = [
            {"url": "https://example.com/1", "status": "error", "issues": ["Connection timeout"], "screenshot_path": ""},
        ]
        report = build_report(results)
        self.assertIn("| 1 | 0 | 0 | 1 |", report)
        self.assertIn("❌", report)
    
    def test_generates_timestamp(self):
        """Test that report includes timestamp."""
        from workout_import_qa import build_report
        report = build_report([])
        self.assertIn("Generated:", report)


class TestSetHasIssuesOutput(unittest.TestCase):
    """Tests for set_has_issues_output function."""
    
    def test_no_issues(self):
        """Test output when there are no issues."""
        from workout_import_qa import set_has_issues_output
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            temp_path = f.name
        
        try:
            results = [
                {"url": "https://example.com/1", "status": "ok", "issues": []},
                {"url": "https://example.com/2", "status": "ok", "issues": []},
            ]
            set_has_issues_output(results, temp_path)
            
            with open(temp_path, 'r') as f:
                content = f.read()
            
            self.assertIn("has_issues=false", content)
        finally:
            os.unlink(temp_path)
    
    def test_with_issues(self):
        """Test output when there are issues."""
        from workout_import_qa import set_has_issues_output
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            temp_path = f.name
        
        try:
            results = [
                {"url": "https://example.com/1", "status": "ok", "issues": []},
                {"url": "https://example.com/2", "status": "issues", "issues": ["Something wrong"]},
            ]
            set_has_issues_output(results, temp_path)
            
            with open(temp_path, 'r') as f:
                content = f.read()
            
            self.assertIn("has_issues=true", content)
        finally:
            os.unlink(temp_path)
    
    def test_with_errors(self):
        """Test output when there are errors."""
        from workout_import_qa import set_has_issues_output
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            temp_path = f.name
        
        try:
            results = [
                {"url": "https://example.com/1", "status": "error", "issues": ["Failed"]},
            ]
            set_has_issues_output(results, temp_path)
            
            with open(temp_path, 'r') as f:
                content = f.read()
            
            self.assertIn("has_issues=true", content)
        finally:
            os.unlink(temp_path)
    
    def test_uses_github_output_env(self):
        """Test that GITHUB_OUTPUT env variable is respected."""
        from workout_import_qa import set_has_issues_output
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            temp_path = f.name
        
        with patch.dict(os.environ, {"GITHUB_OUTPUT": temp_path}):
            try:
                results = [{"url": "https://example.com/1", "status": "ok", "issues": []}]
                set_has_issues_output(results)
                
                with open(temp_path, 'r') as f:
                    content = f.read()
                
                self.assertIn("has_issues=false", content)
            finally:
                os.unlink(temp_path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
