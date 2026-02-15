"""
Integration tests for the bulk import router.

Part of AMA-592: Write integration tests for bulk import router

Tests all endpoints in api/routers/bulk_import.py:
- POST /import/detect — Detect workout items from sources
- POST /import/detect/file — Detect from uploaded file
- POST /import/detect/urls — Detect from URLs
- POST /import/detect/images — Detect from images (OCR)
- POST /import/map — Apply column mappings (files only)
- POST /import/match — Match exercises to Garmin database
- POST /import/preview — Generate preview before import
- POST /import/execute — Execute the bulk import
- GET /import/status/{job_id} — Get import job status
- POST /import/cancel/{job_id} — Cancel a running import

Coverage: All 10 endpoints with 60+ test cases including success, error, and edge cases
"""

import pytest
import base64
from datetime import datetime
from io import BytesIO
from typing import Dict, Any
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from fastapi import status, HTTPException
from fastapi.datastructures import UploadFile

from backend.main import create_app
from backend.settings import Settings
from api.deps import get_current_user

# =============================================================================
# Test Constants
# =============================================================================

TEST_USER_ID = "test-user-592"
TEST_PROFILE_ID = "profile-592-test"
TEST_JOB_ID = "job-592-abc123"
TEST_WORKOUT_ID = "workout-592-def456"

SAMPLE_DETECTED_ITEM = {
    "id": "item-1",
    "source_index": 0,
    "source_type": "file",
    "source_ref": "data.xlsx",
    "raw_data": {"name": "Push-ups", "reps": 10},
    "parsed_title": "Push-ups",
    "parsed_exercise_count": 1,
    "parsed_block_count": 1,
    "confidence": 0.95,
    "errors": None,
    "warnings": None,
}

SAMPLE_DETECT_RESPONSE = {
    "success": True,
    "job_id": TEST_JOB_ID,
    "items": [SAMPLE_DETECTED_ITEM],
    "metadata": {"file_type": "xlsx", "row_count": 10},
    "total": 1,
    "success_count": 1,
    "error_count": 0,
}

SAMPLE_COLUMN_MAPPING = {
    "source_column": "Exercise Name",
    "source_column_index": 0,
    "target_field": "exercise_name",
    "confidence": 0.98,
    "user_override": False,
    "sample_values": ["Push-ups", "Squats", "Deadlifts"],
}

SAMPLE_MAP_RESPONSE = {
    "success": True,
    "job_id": TEST_JOB_ID,
    "mapped_count": 5,
    "patterns": [
        {
            "pattern_type": "exercise_name",
            "regex": None,
            "confidence": 0.95,
            "examples": ["Push-ups", "Pull-ups", "Dips"],
            "count": 3,
        }
    ],
}

SAMPLE_EXERCISE_MATCH = {
    "id": "exercise-1",
    "original_name": "Push-ups",
    "matched_garmin_name": "Push-up",
    "confidence": 0.99,
    "suggestions": [
        {"name": "Push-up", "confidence": 0.99},
        {"name": "Chest Press", "confidence": 0.85},
    ],
    "status": "matched",
    "user_selection": None,
    "source_workout_ids": ["item-1"],
    "occurrence_count": 3,
}

SAMPLE_MATCH_RESPONSE = {
    "success": True,
    "job_id": TEST_JOB_ID,
    "exercises": [SAMPLE_EXERCISE_MATCH],
    "total_exercises": 1,
    "matched": 1,
    "needs_review": 0,
    "unmapped": 0,
}

SAMPLE_VALIDATION_ISSUE = {
    "id": "issue-1",
    "severity": "warning",
    "field": "duration",
    "message": "Duration not specified",
    "workout_id": TEST_WORKOUT_ID,
    "exercise_name": "Push-ups",
    "suggestion": "Estimate based on similar workouts",
    "auto_fixable": True,
}

SAMPLE_PREVIEW_WORKOUT = {
    "id": "preview-1",
    "detected_item_id": "item-1",
    "title": "Full Body Workout",
    "description": "A comprehensive workout",
    "exercise_count": 5,
    "block_count": 3,
    "estimated_duration": 1800,
    "validation_issues": [SAMPLE_VALIDATION_ISSUE],
    "workout": {"exercises": [{"name": "Push-ups", "reps": 10}]},
    "selected": True,
    "is_duplicate": False,
    "duplicate_of": None,
}

SAMPLE_IMPORT_STATS = {
    "total_detected": 1,
    "total_selected": 1,
    "total_skipped": 0,
    "exercises_matched": 1,
    "exercises_needing_review": 0,
    "exercises_unmapped": 0,
    "new_exercises_to_create": 0,
    "estimated_duration": 1800,
    "duplicates_found": 0,
    "validation_errors": 0,
    "validation_warnings": 1,
}

SAMPLE_PREVIEW_RESPONSE = {
    "success": True,
    "job_id": TEST_JOB_ID,
    "workouts": [SAMPLE_PREVIEW_WORKOUT],
    "stats": SAMPLE_IMPORT_STATS,
}

SAMPLE_EXECUTE_RESPONSE = {
    "success": True,
    "job_id": TEST_JOB_ID,
    "status": "processing",
    "message": "Import started",
}

SAMPLE_IMPORT_RESULT = {
    "workout_id": TEST_WORKOUT_ID,
    "title": "Full Body Workout",
    "status": "success",
    "error": None,
    "saved_workout_id": "saved-123",
    "export_formats": ["csv", "json"],
}

SAMPLE_STATUS_RESPONSE = {
    "success": True,
    "job_id": TEST_JOB_ID,
    "status": "completed",
    "progress": 100,
    "current_item": None,
    "results": [SAMPLE_IMPORT_RESULT],
    "error": None,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T01:00:00Z",
}

SAMPLE_CANCEL_RESPONSE = {
    "success": True,
    "message": "Import cancelled",
}

VALID_SOURCE_URLS = [
    "https://youtube.com/watch?v=test123",
    "https://youtu.be/test456",
    "https://instagram.com/p/test789",
    "https://www.instagram.com/reel/test012",
    "https://tiktok.com/@user/video/123",
    "https://vimeo.com/987654",
]

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def app():
    """Create test app with mocked dependencies."""
    settings = Settings(environment="test", _env_file=None)
    test_app = create_app(settings=settings)

    async def mock_get_current_user():
        return TEST_USER_ID

    test_app.dependency_overrides[get_current_user] = mock_get_current_user
    return test_app


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def sample_detect_response():
    """Return sample detect response."""
    return SAMPLE_DETECT_RESPONSE.copy()


@pytest.fixture
def sample_map_response():
    """Return sample map response."""
    return SAMPLE_MAP_RESPONSE.copy()


@pytest.fixture
def sample_match_response():
    """Return sample match response."""
    return SAMPLE_MATCH_RESPONSE.copy()


@pytest.fixture
def sample_preview_response():
    """Return sample preview response."""
    return SAMPLE_PREVIEW_RESPONSE.copy()


@pytest.fixture
def sample_execute_response():
    """Return sample execute response."""
    return SAMPLE_EXECUTE_RESPONSE.copy()


@pytest.fixture
def sample_status_response():
    """Return sample status response."""
    return SAMPLE_STATUS_RESPONSE.copy()


# =============================================================================
# POST /import/detect Tests
# =============================================================================


class TestBulkDetect:
    """Tests for POST /import/detect endpoint."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_from_file_success(self, mock_detect, client, sample_detect_response):
        """Test successful detection from file."""
        mock_detect.return_value = sample_detect_response

        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "file",
            "sources": ["data.xlsx:base64encodedcontent"],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["job_id"] == TEST_JOB_ID
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == SAMPLE_DETECTED_ITEM["parsed_title"]
        mock_detect.assert_called_once()

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_from_urls_success(self, mock_detect, client, sample_detect_response):
        """Test successful detection from URLs."""
        mock_detect.return_value = sample_detect_response

        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "urls",
            "sources": VALID_SOURCE_URLS[:3],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        mock_detect.assert_called_once()

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_from_images_success(self, mock_detect, client, sample_detect_response):
        """Test successful detection from images."""
        mock_detect.return_value = sample_detect_response

        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "images",
            "sources": ["image.jpg:base64imagedata", "image2.jpg:base64imagedata"],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        mock_detect.assert_called_once()

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_multiple_items(self, mock_detect, client):
        """Test detection with multiple items."""
        multi_response = {
            **SAMPLE_DETECT_RESPONSE,
            "items": [
                SAMPLE_DETECTED_ITEM,
                {
                    **SAMPLE_DETECTED_ITEM,
                    "id": "item-2",
                    "source_index": 1,
                    "parsed_title": "Squats",
                },
                {
                    **SAMPLE_DETECTED_ITEM,
                    "id": "item-3",
                    "source_index": 2,
                    "parsed_title": "Deadlifts",
                },
            ],
            "total": 3,
            "success_count": 3,
        }
        mock_detect.return_value = multi_response

        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "file",
            "sources": ["data.xlsx:base64content"],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) == 3

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_with_errors(self, mock_detect, client):
        """Test detection with some errors."""
        error_response = {
            **SAMPLE_DETECT_RESPONSE,
            "items": [
                SAMPLE_DETECTED_ITEM,
                {
                    **SAMPLE_DETECTED_ITEM,
                    "id": "item-2",
                    "source_index": 1,
                    "errors": ["Failed to parse row 2"],
                    "confidence": 0.0,
                },
            ],
            "total": 2,
            "success_count": 1,
            "error_count": 1,
        }
        mock_detect.return_value = error_response

        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "file",
            "sources": ["data.xlsx:base64content"],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["error_count"] == 1

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_service_error(self, mock_detect, client):
        """Test handling of service error."""
        mock_detect.side_effect = Exception("Detection service failed")

        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "file",
            "sources": ["data.xlsx:base64content"],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @pytest.mark.integration
    def test_detect_invalid_source_type(self, client):
        """Test validation of invalid source type."""
        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "invalid_type",
            "sources": ["something"],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_detect_missing_required_fields(self, client):
        """Test validation of missing required fields."""
        request_data = {
            "profile_id": TEST_PROFILE_ID,
            # Missing source_type and sources
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_detect_empty_sources(self, client):
        """Test validation of empty sources list."""
        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "file",
            "sources": [],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# POST /import/detect/file Tests
# =============================================================================


class TestBulkDetectFile:
    """Tests for POST /import/detect/file endpoint."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_file_upload_success(self, mock_detect, client, sample_detect_response):
        """Test successful file upload detection."""
        mock_detect.return_value = sample_detect_response

        file_content = b"Exercise,Reps,Sets\nPush-ups,10,3\nSquats,15,3"
        
        response = client.post(
            "/import/detect/file",
            data={"profile_id": TEST_PROFILE_ID},
            files={"file": ("data.csv", BytesIO(file_content), "text/csv")},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        mock_detect.assert_called_once()

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_xlsx_upload(self, mock_detect, client, sample_detect_response):
        """Test Excel file upload detection."""
        mock_detect.return_value = sample_detect_response

        file_content = b"PK\x03\x04"  # Minimal zip header for xlsx
        
        response = client.post(
            "/import/detect/file",
            data={"profile_id": TEST_PROFILE_ID},
            files={"file": ("data.xlsx", BytesIO(file_content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )

        assert response.status_code == status.HTTP_200_OK
        mock_detect.assert_called_once()

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_json_upload(self, mock_detect, client, sample_detect_response):
        """Test JSON file upload detection."""
        mock_detect.return_value = sample_detect_response

        file_content = b'[{"exercise": "Push-ups", "reps": 10}]'
        
        response = client.post(
            "/import/detect/file",
            data={"profile_id": TEST_PROFILE_ID},
            files={"file": ("data.json", BytesIO(file_content), "application/json")},
        )

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_txt_upload(self, mock_detect, client, sample_detect_response):
        """Test text file upload detection."""
        mock_detect.return_value = sample_detect_response

        file_content = b"Warm-up: 5 minutes\nMain: Push-ups, Squats\nCool-down: 5 minutes"
        
        response = client.post(
            "/import/detect/file",
            data={"profile_id": TEST_PROFILE_ID},
            files={"file": ("workout.txt", BytesIO(file_content), "text/plain")},
        )

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_file_with_special_filename(self, mock_detect, client, sample_detect_response):
        """Test file upload with special characters in filename."""
        mock_detect.return_value = sample_detect_response

        file_content = b"Exercise,Reps"
        
        response = client.post(
            "/import/detect/file",
            data={"profile_id": TEST_PROFILE_ID},
            files={"file": ("my-workout_2024-01-14 (1).csv", BytesIO(file_content), "text/csv")},
        )

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_file_large_upload(self, mock_detect, client, sample_detect_response):
        """Test large file upload detection."""
        mock_detect.return_value = sample_detect_response

        # Create a file with many rows
        rows = ["Exercise,Reps,Sets"]
        for i in range(1000):
            rows.append(f"Exercise {i},10,3")
        file_content = "\n".join(rows).encode()
        
        response = client.post(
            "/import/detect/file",
            data={"profile_id": TEST_PROFILE_ID},
            files={"file": ("large_data.csv", BytesIO(file_content), "text/csv")},
        )

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    def test_detect_file_missing_file(self, client):
        """Test validation when file is missing."""
        response = client.post(
            "/import/detect/file",
            data={"profile_id": TEST_PROFILE_ID},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_detect_file_missing_profile_id(self, client):
        """Test validation when profile_id is missing."""
        file_content = b"Exercise,Reps"
        
        response = client.post(
            "/import/detect/file",
            files={"file": ("data.csv", BytesIO(file_content), "text/csv")},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# POST /import/detect/urls Tests
# =============================================================================


class TestBulkDetectUrls:
    """Tests for POST /import/detect/urls endpoint."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_urls_newline_separated(self, mock_detect, client, sample_detect_response):
        """Test URL detection with newline-separated URLs."""
        mock_detect.return_value = sample_detect_response

        urls_text = "\n".join(VALID_SOURCE_URLS[:3])

        response = client.post(
            "/import/detect/urls",
            data={
                "profile_id": TEST_PROFILE_ID,
                "urls": urls_text,
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        # Verify that detect_items was called with 3 URLs
        call_args = mock_detect.call_args
        assert len(call_args.kwargs["sources"]) == 3

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_urls_comma_separated(self, mock_detect, client, sample_detect_response):
        """Test URL detection with comma-separated URLs."""
        mock_detect.return_value = sample_detect_response

        urls_text = ",".join(VALID_SOURCE_URLS[:2])

        response = client.post(
            "/import/detect/urls",
            data={
                "profile_id": TEST_PROFILE_ID,
                "urls": urls_text,
            },
        )

        assert response.status_code == status.HTTP_200_OK
        call_args = mock_detect.call_args
        assert len(call_args.kwargs["sources"]) == 2

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_urls_mixed_separators(self, mock_detect, client, sample_detect_response):
        """Test URL detection with mixed newline and comma separators."""
        mock_detect.return_value = sample_detect_response

        urls_text = f"{VALID_SOURCE_URLS[0]}\n{VALID_SOURCE_URLS[1]},{VALID_SOURCE_URLS[2]}"

        response = client.post(
            "/import/detect/urls",
            data={
                "profile_id": TEST_PROFILE_ID,
                "urls": urls_text,
            },
        )

        assert response.status_code == status.HTTP_200_OK
        call_args = mock_detect.call_args
        assert len(call_args.kwargs["sources"]) == 3

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_urls_with_whitespace(self, mock_detect, client, sample_detect_response):
        """Test URL detection handles extra whitespace."""
        mock_detect.return_value = sample_detect_response

        urls_text = f"  {VALID_SOURCE_URLS[0]}  \n  {VALID_SOURCE_URLS[1]}  "

        response = client.post(
            "/import/detect/urls",
            data={
                "profile_id": TEST_PROFILE_ID,
                "urls": urls_text,
            },
        )

        assert response.status_code == status.HTTP_200_OK
        call_args = mock_detect.call_args
        assert len(call_args.kwargs["sources"]) == 2

    @pytest.mark.integration
    def test_detect_urls_empty_urls(self, client):
        """Test validation when no valid URLs provided."""
        response = client.post(
            "/import/detect/urls",
            data={
                "profile_id": TEST_PROFILE_ID,
                "urls": "   \n   ",
            },
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "No URLs provided" in response.json()["detail"]

    @pytest.mark.integration
    def test_detect_urls_missing_urls(self, client):
        """Test validation when urls field is missing."""
        response = client.post(
            "/import/detect/urls",
            data={"profile_id": TEST_PROFILE_ID},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_detect_urls_missing_profile_id(self, client):
        """Test validation when profile_id is missing."""
        response = client.post(
            "/import/detect/urls",
            data={"urls": VALID_SOURCE_URLS[0]},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# POST /import/detect/images Tests
# =============================================================================


class TestBulkDetectImages:
    """Tests for POST /import/detect/images endpoint."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_images_single(self, mock_detect, client, sample_detect_response):
        """Test OCR detection from single image."""
        mock_detect.return_value = sample_detect_response

        image_content = b"\x89PNG\r\n\x1a\n\x00"  # Minimal PNG header

        response = client.post(
            "/import/detect/images",
            data={"profile_id": TEST_PROFILE_ID},
            files={"files": ("workout.png", BytesIO(image_content), "image/png")},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_images_multiple(self, mock_detect, client, sample_detect_response):
        """Test OCR detection from multiple images."""
        mock_detect.return_value = {
            **sample_detect_response,
            "items": [
                {**SAMPLE_DETECTED_ITEM, "id": f"item-{i}", "source_index": i}
                for i in range(3)
            ],
        }

        image_content = b"\x89PNG\r\n\x1a\n\x00"

        response = client.post(
            "/import/detect/images",
            data={"profile_id": TEST_PROFILE_ID},
            files=[
                ("files", ("image1.png", BytesIO(image_content), "image/png")),
                ("files", ("image2.png", BytesIO(image_content), "image/png")),
                ("files", ("image3.png", BytesIO(image_content), "image/png")),
            ],
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) == 3

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_images_jpg(self, mock_detect, client, sample_detect_response):
        """Test OCR detection from JPEG image."""
        mock_detect.return_value = sample_detect_response

        image_content = b"\xff\xd8\xff\xe0"  # Minimal JPEG header

        response = client.post(
            "/import/detect/images",
            data={"profile_id": TEST_PROFILE_ID},
            files={"files": ("workout.jpg", BytesIO(image_content), "image/jpeg")},
        )

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_images_webp(self, mock_detect, client, sample_detect_response):
        """Test OCR detection from WebP image."""
        mock_detect.return_value = sample_detect_response

        image_content = b"RIFF\x00\x00\x00\x00WEBP"  # WebP header

        response = client.post(
            "/import/detect/images",
            data={"profile_id": TEST_PROFILE_ID},
            files={"files": ("workout.webp", BytesIO(image_content), "image/webp")},
        )

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    def test_detect_images_exceeds_limit(self, client):
        """Test validation when too many images provided."""
        image_content = b"\x89PNG\r\n\x1a\n\x00"

        files = [
            ("files", (f"image{i}.png", BytesIO(image_content), "image/png"))
            for i in range(25)  # More than max of 20
        ]

        response = client.post(
            "/import/detect/images",
            data={"profile_id": TEST_PROFILE_ID},
            files=files,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Too many images" in response.json()["detail"]

    @pytest.mark.integration
    def test_detect_images_no_files(self, client):
        """Test validation when no images provided."""
        response = client.post(
            "/import/detect/images",
            data={"profile_id": TEST_PROFILE_ID},
        )

        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        ]

    @pytest.mark.integration
    def test_detect_images_missing_profile_id(self, client):
        """Test validation when profile_id is missing."""
        image_content = b"\x89PNG\r\n\x1a\n\x00"

        response = client.post(
            "/import/detect/images",
            files={"files": ("image.png", BytesIO(image_content), "image/png")},
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# POST /import/map Tests
# =============================================================================


class TestBulkMap:
    """Tests for POST /import/map endpoint."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.apply_column_mappings")
    def test_map_columns_success(self, mock_map, client, sample_map_response):
        """Test successful column mapping."""
        mock_map.return_value = sample_map_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "column_mappings": [SAMPLE_COLUMN_MAPPING],
        }

        response = client.post("/import/map", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["mapped_count"] == 5

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.apply_column_mappings")
    def test_map_multiple_columns(self, mock_map, client, sample_map_response):
        """Test mapping with multiple columns."""
        mock_map.return_value = {
            **sample_map_response,
            "patterns": [
                *sample_map_response["patterns"],
                {
                    "pattern_type": "reps",
                    "regex": None,
                    "confidence": 0.92,
                    "examples": ["10", "15", "20"],
                    "count": 3,
                },
            ],
        }

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "column_mappings": [
                SAMPLE_COLUMN_MAPPING,
                {
                    **SAMPLE_COLUMN_MAPPING,
                    "source_column": "Reps",
                    "target_field": "reps",
                },
            ],
        }

        response = client.post("/import/map", json=request_data)

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.apply_column_mappings")
    def test_map_with_user_override(self, mock_map, client, sample_map_response):
        """Test mapping with user overrides."""
        mock_map.return_value = sample_map_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "column_mappings": [
                {
                    **SAMPLE_COLUMN_MAPPING,
                    "user_override": True,
                    "confidence": 1.0,
                }
            ],
        }

        response = client.post("/import/map", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        mock_map.assert_called_once()

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.apply_column_mappings")
    def test_map_service_error(self, mock_map, client):
        """Test handling of service error."""
        mock_map.side_effect = Exception("Mapping service failed")

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "column_mappings": [SAMPLE_COLUMN_MAPPING],
        }

        response = client.post("/import/map", json=request_data)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @pytest.mark.integration
    def test_map_missing_job_id(self, client):
        """Test validation when job_id is missing."""
        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "column_mappings": [SAMPLE_COLUMN_MAPPING],
        }

        response = client.post("/import/map", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_map_empty_mappings(self, client):
        """Test mapping with empty column_mappings list."""
        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "column_mappings": [],
        }

        response = client.post("/import/map", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# POST /import/match Tests
# =============================================================================


class TestBulkMatch:
    """Tests for POST /import/match endpoint."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.match_exercises")
    def test_match_exercises_success(self, mock_match, client, sample_match_response):
        """Test successful exercise matching."""
        mock_match.return_value = sample_match_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "user_mappings": None,
        }

        response = client.post("/import/match", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["matched"] == 1

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.match_exercises")
    def test_match_with_user_selections(self, mock_match, client, sample_match_response):
        """Test matching with user-provided selections."""
        mock_match.return_value = sample_match_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "user_mappings": {
                "Push-ups": "Push-up",
                "Squats": "Squat",
                "Deadlifts": "Deadlift",
            },
        }

        response = client.post("/import/match", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        call_args = mock_match.call_args
        assert call_args.kwargs["user_mappings"] == request_data["user_mappings"]

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.match_exercises")
    def test_match_with_review_needed(self, mock_match, client):
        """Test matching with exercises needing review."""
        review_response = {
            **sample_match_response,
            "exercises": [
                {
                    **SAMPLE_EXERCISE_MATCH,
                    "status": "needs_review",
                    "matched_garmin_name": None,
                    "confidence": 0.65,
                },
                {
                    **SAMPLE_EXERCISE_MATCH,
                    "id": "exercise-2",
                    "original_name": "Weird Exercise",
                    "status": "unmapped",
                    "confidence": 0.0,
                },
            ],
            "matched": 0,
            "needs_review": 1,
            "unmapped": 1,
        }
        mock_match.return_value = review_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
        }

        response = client.post("/import/match", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["needs_review"] == 1
        assert data["unmapped"] == 1

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.match_exercises")
    def test_match_service_error(self, mock_match, client):
        """Test handling of service error."""
        mock_match.side_effect = Exception("Matching service failed")

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
        }

        response = client.post("/import/match", json=request_data)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @pytest.mark.integration
    def test_match_missing_job_id(self, client):
        """Test validation when job_id is missing."""
        request_data = {
            "profile_id": TEST_PROFILE_ID,
        }

        response = client.post("/import/match", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# POST /import/preview Tests
# =============================================================================


class TestBulkPreview:
    """Tests for POST /import/preview endpoint."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.generate_preview")
    def test_preview_success(self, mock_preview, client, sample_preview_response):
        """Test successful preview generation."""
        mock_preview.return_value = sample_preview_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "selected_ids": ["preview-1"],
        }

        response = client.post("/import/preview", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert len(data["workouts"]) == 1
        assert data["stats"]["total_selected"] == 1

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.generate_preview")
    def test_preview_multiple_workouts(self, mock_preview, client):
        """Test preview with multiple workouts."""
        multi_response = {
            **SAMPLE_PREVIEW_RESPONSE,
            "workouts": [
                SAMPLE_PREVIEW_WORKOUT,
                {
                    **SAMPLE_PREVIEW_WORKOUT,
                    "id": "preview-2",
                    "title": "Upper Body",
                },
                {
                    **SAMPLE_PREVIEW_WORKOUT,
                    "id": "preview-3",
                    "title": "Lower Body",
                },
            ],
            "stats": {
                **SAMPLE_IMPORT_STATS,
                "total_selected": 3,
            },
        }
        mock_preview.return_value = multi_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "selected_ids": ["preview-1", "preview-2", "preview-3"],
        }

        response = client.post("/import/preview", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["workouts"]) == 3

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.generate_preview")
    def test_preview_with_duplicates_detected(self, mock_preview, client):
        """Test preview detecting duplicates."""
        dup_response = {
            **SAMPLE_PREVIEW_RESPONSE,
            "workouts": [
                SAMPLE_PREVIEW_WORKOUT,
                {
                    **SAMPLE_PREVIEW_WORKOUT,
                    "id": "preview-2",
                    "is_duplicate": True,
                    "duplicate_of": "preview-1",
                },
            ],
            "stats": {
                **SAMPLE_IMPORT_STATS,
                "duplicates_found": 1,
                "total_selected": 2,
            },
        }
        mock_preview.return_value = dup_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "selected_ids": ["preview-1", "preview-2"],
        }

        response = client.post("/import/preview", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["stats"]["duplicates_found"] == 1

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.generate_preview")
    def test_preview_with_validation_errors(self, mock_preview, client):
        """Test preview with validation errors."""
        error_response = {
            **SAMPLE_PREVIEW_RESPONSE,
            "workouts": [
                {
                    **SAMPLE_PREVIEW_WORKOUT,
                    "validation_issues": [
                        {
                            **SAMPLE_VALIDATION_ISSUE,
                            "severity": "error",
                            "message": "Missing required field: duration",
                        },
                        {
                            **SAMPLE_VALIDATION_ISSUE,
                            "severity": "warning",
                            "message": "Duration not specified",
                        },
                    ],
                }
            ],
            "stats": {
                **SAMPLE_IMPORT_STATS,
                "validation_errors": 1,
                "validation_warnings": 1,
            },
        }
        mock_preview.return_value = error_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "selected_ids": ["preview-1"],
        }

        response = client.post("/import/preview", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["stats"]["validation_errors"] == 1

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.generate_preview")
    def test_preview_service_error(self, mock_preview, client):
        """Test handling of service error."""
        mock_preview.side_effect = Exception("Preview service failed")

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "selected_ids": ["preview-1"],
        }

        response = client.post("/import/preview", json=request_data)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @pytest.mark.integration
    def test_preview_missing_job_id(self, client):
        """Test validation when job_id is missing."""
        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "selected_ids": ["preview-1"],
        }

        response = client.post("/import/preview", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_preview_empty_selected_ids(self, client):
        """Test preview with empty selected_ids."""
        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "selected_ids": [],
        }

        response = client.post("/import/preview", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# POST /import/execute Tests
# =============================================================================


class TestBulkExecute:
    """Tests for POST /import/execute endpoint."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.execute_import")
    def test_execute_async_success(self, mock_execute, client, sample_execute_response):
        """Test successful async import execution."""
        mock_execute.return_value = sample_execute_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "workout_ids": [TEST_WORKOUT_ID],
            "device": "garmin",
            "async_mode": True,
        }

        response = client.post("/import/execute", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["status"] in ["processing", "queued"]

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.execute_import")
    def test_execute_sync_success(self, mock_execute, client):
        """Test successful sync import execution."""
        sync_response = {
            **sample_execute_response,
            "status": "completed",
            "message": "Import completed successfully",
        }
        mock_execute.return_value = sync_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "workout_ids": [TEST_WORKOUT_ID],
            "device": "garmin",
            "async_mode": False,
        }

        response = client.post("/import/execute", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.execute_import")
    def test_execute_multiple_workouts(self, mock_execute, client, sample_execute_response):
        """Test execution with multiple workouts."""
        mock_execute.return_value = sample_execute_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "workout_ids": [f"workout-{i}" for i in range(5)],
            "device": "garmin",
            "async_mode": True,
        }

        response = client.post("/import/execute", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        call_args = mock_execute.call_args
        assert len(call_args.kwargs["workout_ids"]) == 5

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.execute_import")
    def test_execute_different_devices(self, mock_execute, client, sample_execute_response):
        """Test execution with different target devices."""
        devices = ["garmin", "apple_watch", "ios_companion", "strava"]
        
        for device in devices:
            mock_execute.return_value = sample_execute_response

            request_data = {
                "job_id": TEST_JOB_ID,
                "profile_id": TEST_PROFILE_ID,
                "workout_ids": [TEST_WORKOUT_ID],
                "device": device,
                "async_mode": True,
            }

            response = client.post("/import/execute", json=request_data)

            assert response.status_code == status.HTTP_200_OK
            call_args = mock_execute.call_args
            assert call_args.kwargs["device"] == device

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.execute_import")
    def test_execute_service_error(self, mock_execute, client):
        """Test handling of service error."""
        mock_execute.side_effect = Exception("Execution service failed")

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "workout_ids": [TEST_WORKOUT_ID],
            "device": "garmin",
            "async_mode": True,
        }

        response = client.post("/import/execute", json=request_data)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @pytest.mark.integration
    def test_execute_missing_job_id(self, client):
        """Test validation when job_id is missing."""
        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "workout_ids": [TEST_WORKOUT_ID],
            "device": "garmin",
        }

        response = client.post("/import/execute", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_execute_empty_workout_ids(self, client):
        """Test validation when workout_ids is empty."""
        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "workout_ids": [],
            "device": "garmin",
        }

        response = client.post("/import/execute", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_execute_missing_device(self, client):
        """Test validation when device is missing."""
        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "workout_ids": [TEST_WORKOUT_ID],
        }

        response = client.post("/import/execute", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# GET /import/status/{job_id} Tests
# =============================================================================


class TestBulkStatus:
    """Tests for GET /import/status/{job_id} endpoint."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.get_import_status")
    def test_status_completed(self, mock_status, client, sample_status_response):
        """Test status check for completed import."""
        mock_status.return_value = sample_status_response

        response = client.get(f"/import/status/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["status"] == "completed"
        assert data["progress"] == 100

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.get_import_status")
    def test_status_in_progress(self, mock_status, client):
        """Test status check for import in progress."""
        progress_response = {
            **SAMPLE_STATUS_RESPONSE,
            "status": "processing",
            "progress": 45,
            "current_item": "workout-2",
            "results": [SAMPLE_IMPORT_RESULT],
        }
        mock_status.return_value = progress_response

        response = client.get(f"/import/status/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "processing"
        assert data["progress"] == 45

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.get_import_status")
    def test_status_failed(self, mock_status, client):
        """Test status check for failed import."""
        failed_response = {
            **SAMPLE_STATUS_RESPONSE,
            "status": "failed",
            "progress": 50,
            "error": "Connection timeout during export",
        }
        mock_status.return_value = failed_response

        response = client.get(f"/import/status/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "failed"
        assert data["error"] is not None

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.get_import_status")
    def test_status_with_partial_results(self, mock_status, client):
        """Test status with partial results."""
        partial_response = {
            **SAMPLE_STATUS_RESPONSE,
            "status": "processing",
            "progress": 60,
            "results": [
                SAMPLE_IMPORT_RESULT,
                {
                    **SAMPLE_IMPORT_RESULT,
                    "workout_id": "workout-2",
                    "status": "failed",
                    "error": "Invalid exercise data",
                },
                {
                    **SAMPLE_IMPORT_RESULT,
                    "workout_id": "workout-3",
                    "status": "skipped",
                },
            ],
        }
        mock_status.return_value = partial_response

        response = client.get(f"/import/status/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["results"]) == 3

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.get_import_status")
    def test_status_service_error(self, mock_status, client):
        """Test handling of service error."""
        mock_status.side_effect = Exception("Status service failed")

        response = client.get(f"/import/status/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}")

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @pytest.mark.integration
    def test_status_missing_profile_id(self, client):
        """Test validation when profile_id is missing."""
        response = client.get(f"/import/status/{TEST_JOB_ID}")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# POST /import/cancel/{job_id} Tests
# =============================================================================


class TestBulkCancel:
    """Tests for POST /import/cancel/{job_id} endpoint."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.cancel_import")
    def test_cancel_success(self, mock_cancel, client, sample_cancel_response):
        """Test successful import cancellation."""
        mock_cancel.return_value = True

        response = client.post(
            f"/import/cancel/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "cancelled" in data["message"].lower()

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.cancel_import")
    def test_cancel_already_completed(self, mock_cancel, client):
        """Test cancellation of completed import."""
        mock_cancel.return_value = False

        response = client.post(
            f"/import/cancel/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is False
        assert "Failed to cancel" in data["message"]

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.cancel_import")
    def test_cancel_service_error(self, mock_cancel, client):
        """Test handling of service error."""
        mock_cancel.side_effect = Exception("Cancel service failed")

        response = client.post(
            f"/import/cancel/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}"
        )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    @pytest.mark.integration
    def test_cancel_missing_profile_id(self, client):
        """Test validation when profile_id is missing."""
        response = client.post(f"/import/cancel/{TEST_JOB_ID}")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# Authentication and Authorization Tests
# =============================================================================


class TestAuthenticationAndAuthorization:
    """Tests for authentication and authorization."""

    @pytest.mark.integration
    def test_detect_requires_auth(self, client):
        """Test that detect endpoint requires authentication."""
        app = client.app

        async def mock_no_auth():
            raise HTTPException(status_code=401, detail="Unauthorized")

        app.dependency_overrides[get_current_user] = mock_no_auth

        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "file",
            "sources": ["data.xlsx:base64content"],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.integration
    def test_all_endpoints_require_auth(self, client):
        """Test that all endpoints require authentication."""
        app = client.app

        async def mock_no_auth():
            raise HTTPException(status_code=401, detail="Unauthorized")

        app.dependency_overrides[get_current_user] = mock_no_auth

        # Test various endpoints
        endpoints = [
            ("POST", "/import/detect", {"profile_id": TEST_PROFILE_ID, "source_type": "file", "sources": ["test"]}),
            ("POST", "/import/map", {"job_id": TEST_JOB_ID, "profile_id": TEST_PROFILE_ID, "column_mappings": []}),
            ("POST", "/import/match", {"job_id": TEST_JOB_ID, "profile_id": TEST_PROFILE_ID}),
            ("POST", "/import/preview", {"job_id": TEST_JOB_ID, "profile_id": TEST_PROFILE_ID, "selected_ids": []}),
            ("POST", "/import/execute", {"job_id": TEST_JOB_ID, "profile_id": TEST_PROFILE_ID, "workout_ids": ["1"], "device": "garmin"}),
            ("GET", f"/import/status/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}", None),
            ("POST", f"/import/cancel/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}", None),
        ]

        for method, endpoint, data in endpoints:
            if method == "POST":
                response = client.post(endpoint, json=data)
            else:
                response = client.get(endpoint)
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# Edge Cases and Boundary Tests
# =============================================================================


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_with_many_sources(self, mock_detect, client, sample_detect_response):
        """Test detection with many sources."""
        mock_detect.return_value = {
            **sample_detect_response,
            "items": [
                {**SAMPLE_DETECTED_ITEM, "id": f"item-{i}", "source_index": i}
                for i in range(100)
            ],
            "total": 100,
            "success_count": 100,
        }

        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "urls",
            "sources": [f"https://youtube.com/watch?v={i}" for i in range(100)],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) == 100

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_with_unicode_content(self, mock_detect, client, sample_detect_response):
        """Test detection with unicode characters."""
        unicode_response = {
            **sample_detect_response,
            "items": [
                {
                    **SAMPLE_DETECTED_ITEM,
                    "parsed_title": "倒立撑 (Handstand Push-up)",
                }
            ],
        }
        mock_detect.return_value = unicode_response

        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "file",
            "sources": ["データ.xlsx:base64content"],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "倒立撑" in data["items"][0]["parsed_title"]

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.apply_column_mappings")
    def test_map_with_many_columns(self, mock_map, client):
        """Test mapping with many columns."""
        mock_map.return_value = {
            "success": True,
            "job_id": TEST_JOB_ID,
            "mapped_count": 50,
            "patterns": [],
        }

        mappings = [
            {
                **SAMPLE_COLUMN_MAPPING,
                "source_column": f"Column {i}",
                "target_field": f"field_{i}",
                "source_column_index": i,
            }
            for i in range(50)
        ]

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "column_mappings": mappings,
        }

        response = client.post("/import/map", json=request_data)

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.execute_import")
    def test_execute_with_many_workouts(self, mock_execute, client, sample_execute_response):
        """Test execution with many workouts."""
        mock_execute.return_value = sample_execute_response

        request_data = {
            "job_id": TEST_JOB_ID,
            "profile_id": TEST_PROFILE_ID,
            "workout_ids": [f"workout-{i}" for i in range(500)],
            "device": "garmin",
            "async_mode": True,
        }

        response = client.post("/import/execute", json=request_data)

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.get_import_status")
    def test_status_with_many_results(self, mock_status, client):
        """Test status with many results."""
        many_results = [
            {
                **SAMPLE_IMPORT_RESULT,
                "workout_id": f"workout-{i}",
                "title": f"Workout {i}",
                "status": "success" if i % 2 == 0 else "failed",
            }
            for i in range(100)
        ]

        mock_status.return_value = {
            **SAMPLE_STATUS_RESPONSE,
            "results": many_results,
        }

        response = client.get(f"/import/status/{TEST_JOB_ID}?profile_id={TEST_PROFILE_ID}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["results"]) == 100

    @pytest.mark.integration
    @patch("backend.bulk_import.bulk_import_service.detect_items")
    def test_detect_with_empty_response(self, mock_detect, client):
        """Test detection with no items detected."""
        empty_response = {
            "success": True,
            "job_id": TEST_JOB_ID,
            "items": [],
            "metadata": {},
            "total": 0,
            "success_count": 0,
            "error_count": 0,
        }
        mock_detect.return_value = empty_response

        request_data = {
            "profile_id": TEST_PROFILE_ID,
            "source_type": "file",
            "sources": ["empty.xlsx:base64content"],
        }

        response = client.post("/import/detect", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) == 0
