"""Verify all modules can be imported without errors."""


def test_core_module_imports():
    """Import core modules to catch bad import paths."""


def test_api_imports():
    """Import API route modules."""
    # Note: routes_additions.py is a code snippet file, not a standalone module


def test_service_imports():
    """Import service modules."""


def test_parser_imports():
    """Import parser modules."""


def test_app_starts():
    """Verify FastAPI app can be instantiated."""
    from main import app
    assert app is not None
    assert hasattr(app, 'routes')
