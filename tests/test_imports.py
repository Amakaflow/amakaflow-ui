"""Verify all modules can be imported without errors."""


def test_app_module_imports():
    """Import core app modules to catch bad import paths."""
    import app.main
    import app.db
    import app.models
    import app.schemas
    import app.auth


def test_routes_imports():
    """Import route modules."""
    import app.routes.calendar
    import app.routes.connected_calendars


def test_utils_imports():
    """Import utility modules."""
    import app.utils.calendar_sync


def test_rules_imports():
    """Import rules modules."""
    import app.rules.anchor_rules


def test_app_starts():
    """Verify FastAPI app can be instantiated."""
    from app.main import app
    assert app is not None
    assert hasattr(app, 'routes')
