import pytest
from workout_ingestor_api.services.adapters import (
    register_adapter, get_adapter, PlatformAdapter, MediaContent, _ADAPTER_REGISTRY
)


class _FakeAdapter(PlatformAdapter):
    @staticmethod
    def platform_name() -> str:
        return "fake_platform_test"

    def fetch(self, url: str, source_id: str) -> MediaContent:
        return MediaContent(primary_text="hello", title="test")


@pytest.fixture(autouse=True)
def clean_registry():
    """Remove test adapters from registry after each test."""
    yield
    _ADAPTER_REGISTRY.pop("fake_platform_test", None)


def test_register_and_get_adapter():
    register_adapter(_FakeAdapter)
    adapter = get_adapter("fake_platform_test")
    assert isinstance(adapter, _FakeAdapter)


def test_get_unregistered_raises():
    with pytest.raises(KeyError):
        get_adapter("nonexistent_platform_xyz")


def test_fetch_returns_media_content():
    register_adapter(_FakeAdapter)
    adapter = get_adapter("fake_platform_test")
    result = adapter.fetch("https://fake.com/video/1", "1")
    assert isinstance(result, MediaContent)
    assert result.primary_text == "hello"


def test_duplicate_registration_raises():
    register_adapter(_FakeAdapter)
    with pytest.raises(ValueError, match="already registered"):
        register_adapter(_FakeAdapter)
