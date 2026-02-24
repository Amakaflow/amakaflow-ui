"""Verify all modules can be imported without errors."""


def test_core_module_imports():
    """Import core modules to catch bad import paths."""
    import workout_ingestor_api.main
    import workout_ingestor_api.models
    import workout_ingestor_api.config
    import workout_ingestor_api.utils
    import workout_ingestor_api.auth


def test_api_imports():
    """Import API route modules."""
    import workout_ingestor_api.api.routes
    # Note: routes_additions.py is a code snippet file, not a standalone module
    import workout_ingestor_api.api.bulk_import_routes
    import workout_ingestor_api.api.youtube_ingest


def test_service_imports():
    """Import service modules."""
    import workout_ingestor_api.services.bulk_import
    import workout_ingestor_api.services.youtube_cache_service
    import workout_ingestor_api.services.youtube_service
    import workout_ingestor_api.services.tiktok_service
    import workout_ingestor_api.services.instagram_service
    import workout_ingestor_api.services.pinterest_service
    import workout_ingestor_api.services.export_service
    import workout_ingestor_api.services.parser_service
    import workout_ingestor_api.services.llm_service
    import workout_ingestor_api.services.ocr_service
    import workout_ingestor_api.services.vision_service
    import workout_ingestor_api.services.asr_service
    import workout_ingestor_api.services.video_service
    import workout_ingestor_api.services.keyframe_service
    import workout_ingestor_api.services.fusion_service
    import workout_ingestor_api.services.url_normalizer
    import workout_ingestor_api.services.feedback_service
    import workout_ingestor_api.services.wger_service


def test_parser_imports():
    """Import parser modules."""
    import workout_ingestor_api.parsers.base
    import workout_ingestor_api.parsers.models
    import workout_ingestor_api.parsers.csv_parser
    import workout_ingestor_api.parsers.excel_parser
    import workout_ingestor_api.parsers.json_parser
    import workout_ingestor_api.parsers.text_parser
    import workout_ingestor_api.parsers.url_parser
    import workout_ingestor_api.parsers.image_parser


def test_app_starts():
    """Verify FastAPI app can be instantiated."""
    from main import app
    assert app is not None
    assert hasattr(app, 'routes')
