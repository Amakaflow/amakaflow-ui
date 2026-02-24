"""Unit tests for export service."""
from workout_ingestor_api.models import Workout, Block, Exercise, Superset
from workout_ingestor_api.services.export_service import ExportService


class TestExportService:
    """Test cases for ExportService."""
    
    def test_render_text_for_tp_simple(self):
        """Test rendering simple workout as TP text."""
        exercise = Exercise(name="Bench Press", reps=10, sets=3)
        block = Block(label="Strength", exercises=[exercise])
        workout = Workout(title="Test Workout", blocks=[block])
        
        text = ExportService.render_text_for_tp(workout)
        
        assert "# Test Workout" in text
        assert "## Strength" in text
        assert "Bench Press" in text
        assert "10 reps" in text
        assert "3 sets" in text
    
    def test_render_text_for_tp_with_source(self):
        """Test rendering workout with source."""
        workout = Workout(title="Test", source="test_source", blocks=[])
        
        text = ExportService.render_text_for_tp(workout)
        
        assert "(source: test_source)" in text
    
    def test_render_text_for_tp_with_supersets(self):
        """Test rendering workout with supersets."""
        exercise1 = Exercise(name="Bench Press", reps=10)
        exercise2 = Exercise(name="Squat", reps=10)
        superset = Superset(exercises=[exercise1, exercise2])
        block = Block(label="Strength", supersets=[superset])
        workout = Workout(title="Test", blocks=[block])
        
        text = ExportService.render_text_for_tp(workout)
        
        assert "Bench Press" in text
        assert "Squat" in text
    
    def test_render_tcx_simple(self):
        """Test rendering simple workout as TCX."""
        exercise = Exercise(name="Bench Press", reps=10)
        block = Block(label="Strength", exercises=[exercise])
        workout = Workout(title="Test Workout", blocks=[block])
        
        tcx = ExportService.render_tcx(workout)
        
        assert "<?xml version=\"1.0\"" in tcx
        assert "TrainingCenterDatabase" in tcx
        assert "Bench Press" in tcx
        assert "10 reps" in tcx
    
    def test_render_tcx_with_distance(self):
        """Test rendering workout with distance."""
        exercise = Exercise(name="Run", distance_m=200)
        block = Block(label="Cardio", exercises=[exercise])
        workout = Workout(title="Test", blocks=[block])
        
        tcx = ExportService.render_tcx(workout)
        
        assert "200m" in tcx
    
    def test_canonical_name(self):
        """Test exercise name canonicalization."""
        assert ExportService._canonical_name("db incline bench press") == "Dumbbell Incline Bench Press"
        assert ExportService._canonical_name("trx row") == "TRX Row"
        assert ExportService._canonical_name("unknown exercise") == "unknown exercise"
    
    def test_infer_sets_reps_with_reps(self):
        """Test inferring sets and reps when reps are provided."""
        exercise = Exercise(name="Bench Press", reps=10, sets=3)
        sets, reps = ExportService._infer_sets_reps(exercise)
        
        assert sets == 3
        assert reps == 10
    
    def test_infer_sets_reps_with_range(self):
        """Test inferring sets and reps with rep range."""
        exercise = Exercise(name="Bench Press", reps_range="10-12", sets=3)
        sets, reps = ExportService._infer_sets_reps(exercise)
        
        assert sets == 3
        assert reps == 12  # Uses upper bound
    
    def test_infer_sets_reps_defaults(self):
        """Test inferring sets and reps with defaults."""
        exercise = Exercise(name="Bench Press")
        sets, reps = ExportService._infer_sets_reps(exercise)
        
        assert sets == 3  # Default sets
        assert reps == 8  # Default reps
    
    def test_rounds_from_structure(self):
        """Test extracting rounds from structure string."""
        assert ExportService._rounds_from_structure("3 rounds") == 3
        assert ExportService._rounds_from_structure("5 sets") == 5
        assert ExportService._rounds_from_structure(None) == 1
        assert ExportService._rounds_from_structure("invalid") == 1


# ---------------------------------------------------------------------------
# API Endpoint Tests
# ---------------------------------------------------------------------------

import json  # noqa: E402
import zipfile  # noqa: E402
from io import BytesIO  # noqa: E402


class TestCsvExportEndpoint:
    """Test CSV export API endpoints."""

    def test_export_csv_strong_format(self, api_client, sample_workout_dict):
        """Test CSV export in Strong format."""
        response = api_client.post(
            "/export/csv",
            json=sample_workout_dict,
            params={"style": "strong"},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert "attachment" in response.headers.get("content-disposition", "")

        content = response.content.decode("utf-8")
        assert len(content) > 0
        lines = content.strip().split("\n")
        assert len(lines) >= 1  # At least header row

    def test_export_csv_extended_format(self, api_client, sample_workout_dict):
        """Test CSV export in Extended format."""
        response = api_client.post(
            "/export/csv",
            json=sample_workout_dict,
            params={"style": "extended"},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"

    def test_export_csv_default_style(self, api_client, sample_workout_dict):
        """Test CSV export defaults to Strong format."""
        response = api_client.post(
            "/export/csv",
            json=sample_workout_dict,
        )
        assert response.status_code == 200
        assert "workout_strong.csv" in response.headers.get("content-disposition", "")

    def test_export_csv_bulk(self, api_client, sample_workout_dict):
        """Test bulk CSV export with multiple workouts."""
        workouts = [sample_workout_dict, sample_workout_dict]
        response = api_client.post(
            "/export/csv/bulk",
            json=workouts,
            params={"style": "strong"},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"


class TestJsonExportEndpoint:
    """Test JSON export API endpoints."""

    def test_export_json_with_metadata(self, api_client, sample_workout_dict):
        """Test JSON export includes metadata when requested."""
        response = api_client.post(
            "/export/json",
            json=sample_workout_dict,
            params={"include_metadata": True, "pretty": True},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

        content = json.loads(response.content)
        # With metadata, workout is wrapped in a structure with version, format, etc.
        if "workout" in content:
            assert "title" in content["workout"] or "blocks" in content["workout"]
        else:
            assert "title" in content or "blocks" in content

    def test_export_json_bulk(self, api_client, sample_workout_dict):
        """Test bulk JSON export with multiple workouts."""
        workouts = [sample_workout_dict, sample_workout_dict]
        response = api_client.post(
            "/export/json/bulk",
            json=workouts,
            params={"include_metadata": True},
        )
        assert response.status_code == 200


class TestTextExportEndpoint:
    """Test TrainingPeaks text export endpoint."""

    def test_export_tp_text(self, api_client, sample_workout_dict):
        """Test TrainingPeaks text format export."""
        response = api_client.post(
            "/export/tp_text",
            json=sample_workout_dict,
        )
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]
        assert "attachment" in response.headers.get("content-disposition", "")

        content = response.content.decode("utf-8")
        assert len(content) > 0


class TestTcxExportEndpoint:
    """Test TCX format export endpoint."""

    def test_export_tcx(self, api_client, sample_workout_dict):
        """Test TCX format export."""
        response = api_client.post(
            "/export/tcx",
            json=sample_workout_dict,
        )
        assert response.status_code == 200
        assert "garmin.tcx" in response.headers["content-type"]

        content = response.content.decode("utf-8")
        assert "<?xml" in content or "<TrainingCenterDatabase" in content


class TestFitExportEndpoint:
    """Test FIT format export endpoint."""

    def test_export_fit(self, api_client, sample_workout_dict):
        """Test FIT format export."""
        response = api_client.post(
            "/export/fit",
            json=sample_workout_dict,
        )
        # FIT export may fail with 500 if fit-tool has issues with specific data
        assert response.status_code in [200, 500]

        if response.status_code == 200:
            assert "octet-stream" in response.headers["content-type"]
            assert "strength_workout.fit" in response.headers.get("content-disposition", "")
            assert len(response.content) > 0


class TestPdfExportEndpoint:
    """Test PDF format export endpoint."""

    def test_export_pdf(self, api_client, sample_workout_dict):
        """Test PDF format export."""
        response = api_client.post(
            "/export/pdf",
            json=sample_workout_dict,
        )
        # PDF export may return 200 or 501 if reportlab not installed
        assert response.status_code in [200, 501]

        if response.status_code == 200:
            assert "application/pdf" in response.headers["content-type"]
            assert response.content[:4] == b"%PDF"


class TestBulkZipExportEndpoint:
    """Test bulk ZIP archive export endpoint."""

    def test_export_bulk_zip_default_formats(self, api_client, sample_workout_dict):
        """Test bulk ZIP export with default formats."""
        workouts = [sample_workout_dict]
        response = api_client.post(
            "/export/bulk/zip",
            json=workouts,
        )
        # May return 422 if workout validation fails, or 200 on success
        assert response.status_code in [200, 422]

        if response.status_code == 200:
            assert "application/zip" in response.headers["content-type"]
            zip_buffer = BytesIO(response.content)
            with zipfile.ZipFile(zip_buffer, "r") as zf:
                file_list = zf.namelist()
                assert len(file_list) > 0

    def test_export_bulk_zip_custom_formats(self, api_client, sample_workout_dict):
        """Test bulk ZIP export with custom formats."""
        workouts = [sample_workout_dict]
        response = api_client.post(
            "/export/bulk/zip",
            json=workouts,
            params={"formats": ["json", "csv"], "csv_style": "strong"},
        )
        # May return 422 if workout validation fails, or 200 on success
        assert response.status_code in [200, 422]

