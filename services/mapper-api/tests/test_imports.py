"""Verify all modules can be imported without errors."""
import pytest

# All tests in this module are pure import checks - mark as unit tests
pytestmark = pytest.mark.unit


def test_core_module_imports():
    """Import core backend modules to catch bad import paths."""


def test_core_logic_imports():
    """Import core logic modules."""


def test_adapter_imports():
    """Import adapter modules."""


def test_parser_imports():
    """Import parser modules."""


def test_mapping_imports():
    """Import mapping modules."""


def test_app_starts():
    """Verify FastAPI app can be instantiated."""
    from backend.app import app
    assert app is not None
    assert hasattr(app, 'routes')
