"""Tests for Settings / config.py — AMA-749."""


def test_parse_model_default():
    """PARSE_MODEL defaults to gpt-4o-mini when the env var is not set."""
    from workout_ingestor_api.config import Settings

    s = Settings()
    assert s.PARSE_MODEL == "gpt-4o-mini"


def test_parse_model_reads_env_var(monkeypatch):
    """PARSE_MODEL reflects the PARSE_MODEL environment variable when set."""
    monkeypatch.setenv("PARSE_MODEL", "gpt-4o")

    from workout_ingestor_api.config import Settings

    s = Settings()
    assert s.PARSE_MODEL == "gpt-4o"


def test_parse_model_used_in_unified_parser():
    """unified_parser passes settings.PARSE_MODEL as the model name to the OpenAI client."""
    import json
    from unittest.mock import MagicMock, patch

    from workout_ingestor_api.services.adapters.base import MediaContent
    from workout_ingestor_api.services.unified_parser import UnifiedParser

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps({
        "title": "Test", "workout_type": "strength", "workout_type_confidence": 0.9,
        "blocks": [{"label": "Main", "structure": "straight_sets", "rounds": None,
                    "exercises": [{"name": "Squat", "reps": 5, "type": "strength"}],
                    "supersets": []}],
    })))]
    mock_client.chat.completions.create.return_value = mock_response

    media = MediaContent(
        primary_text="Squat 5 reps",
        title="Test",
        media_metadata={},
    )

    # Patch the settings object that unified_parser already has a reference to
    with patch(
        "workout_ingestor_api.services.unified_parser.settings"
    ) as mock_settings, patch(
        "workout_ingestor_api.services.unified_parser.AIClientFactory.create_openai_client",
        return_value=mock_client,
    ):
        mock_settings.PARSE_MODEL = "gpt-4o"
        parser = UnifiedParser()
        parser.parse(media, platform="instagram")

    call_kwargs = mock_client.chat.completions.create.call_args
    model_used = call_kwargs.kwargs.get("model") or (call_kwargs.args[0] if call_kwargs.args else None)
    assert model_used == "gpt-4o", f"Expected model='gpt-4o' but got {model_used!r}"


def test_parse_model_used_in_instagram_reel_service():
    """InstagramReelService._parse_transcript passes settings.PARSE_MODEL to the OpenAI client."""
    import json
    from unittest.mock import MagicMock, patch

    from workout_ingestor_api.services.instagram_reel_service import InstagramReelService

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps({
        "title": "Test", "workout_type": "strength", "workout_type_confidence": 0.9,
        "blocks": [{"label": "Main", "structure": "straight_sets", "rounds": None,
                    "exercises": [{"name": "Squat", "reps": 5, "type": "strength"}],
                    "supersets": []}],
    })))]
    mock_client.chat.completions.create.return_value = mock_response

    with patch(
        "workout_ingestor_api.services.instagram_reel_service.settings"
    ) as mock_settings, patch(
        "workout_ingestor_api.services.instagram_reel_service.AIClientFactory.create_openai_client",
        return_value=mock_client,
    ):
        mock_settings.PARSE_MODEL = "gpt-4o-test"
        InstagramReelService._parse_transcript(
            transcript="Squat 5 reps",
            title="Test Workout",
        )

    call_kwargs = mock_client.chat.completions.create.call_args
    model_used = call_kwargs.kwargs.get("model") or (call_kwargs.args[0] if call_kwargs.args else None)
    assert model_used == "gpt-4o-test", f"Expected model='gpt-4o-test' but got {model_used!r}"


def test_parse_model_used_in_youtube_parse_with_openai():
    """youtube_ingest._parse_with_openai passes settings.PARSE_MODEL to the OpenAI client."""
    import json
    from unittest.mock import MagicMock, patch

    from workout_ingestor_api.api.youtube_ingest import _parse_with_openai

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps({
        "title": "Test", "workout_type": "strength", "workout_type_confidence": 0.9,
        "blocks": [{"label": "Main", "structure": "straight_sets", "rounds": None,
                    "exercises": [{"name": "Squat", "reps": 5, "type": "strength"}],
                    "supersets": []}],
    })))]
    mock_client.chat.completions.create.return_value = mock_response

    with patch(
        "workout_ingestor_api.api.youtube_ingest.settings"
    ) as mock_settings, patch(
        "workout_ingestor_api.api.youtube_ingest.AIClientFactory.create_openai_client",
        return_value=mock_client,
    ):
        mock_settings.PARSE_MODEL = "gpt-4o-test"
        _parse_with_openai(
            transcript="Squat 5 reps",
            title="Test Workout",
        )

    call_kwargs = mock_client.chat.completions.create.call_args
    model_used = call_kwargs.kwargs.get("model") or (call_kwargs.args[0] if call_kwargs.args else None)
    assert model_used == "gpt-4o-test", f"Expected model='gpt-4o-test' but got {model_used!r}"


def test_anthropic_parse_model_used_in_youtube_parse_with_anthropic():
    """youtube_ingest._parse_with_anthropic passes settings.ANTHROPIC_PARSE_MODEL to the Anthropic client."""
    import json
    from unittest.mock import MagicMock, patch

    from workout_ingestor_api.api.youtube_ingest import _parse_with_anthropic

    mock_client = MagicMock()
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=json.dumps({
        "title": "Test", "workout_type": "strength", "workout_type_confidence": 0.9,
        "blocks": [{"label": "Main", "structure": "straight_sets", "rounds": None,
                    "exercises": [{"name": "Squat", "reps": 5, "type": "strength"}],
                    "supersets": []}],
    }))]
    mock_message.usage = MagicMock(cache_read_input_tokens=0, cache_creation_input_tokens=0)
    mock_client.messages.create.return_value = mock_message

    with patch(
        "workout_ingestor_api.api.youtube_ingest.settings"
    ) as mock_settings, patch(
        "workout_ingestor_api.api.youtube_ingest.AIClientFactory.create_anthropic_client",
        return_value=mock_client,
    ):
        mock_settings.ANTHROPIC_PARSE_MODEL = "claude-test"
        _parse_with_anthropic(
            transcript="Squat 5 reps",
            title="Test Workout",
        )

    call_kwargs = mock_client.messages.create.call_args
    model_used = call_kwargs.kwargs.get("model") or (call_kwargs.args[0] if call_kwargs.args else None)
    assert model_used == "claude-test", f"Expected model='claude-test' but got {model_used!r}"
