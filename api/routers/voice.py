"""
Voice router for TTS synthesis and settings.

Part of AMA-442: Extend Voice Infrastructure for Chat Assistant (TTS)

Provides endpoints for:
- Text-to-speech synthesis
- Available voices listing
- User TTS preferences management
"""

import base64
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from api.deps import (
    AuthContext,
    get_auth_context,
    get_tts_service,
    get_tts_settings_repository,
)
from backend.services.tts_service import TTSService
from backend.settings import get_settings
from infrastructure.db.tts_settings_repository import (
    SupabaseTTSSettingsRepository,
    TTSSettings,
    TTSSettingsUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])


# =============================================================================
# Request/Response Models
# =============================================================================


class SynthesizeRequest(BaseModel):
    """Request body for text-to-speech synthesis."""

    text: str = Field(..., min_length=1, max_length=3000)
    voice_id: Optional[str] = Field(
        None, description="ElevenLabs voice ID, uses user default if not provided"
    )
    speed: Optional[float] = Field(1.0, ge=0.25, le=4.0)
    stream: bool = Field(False, description="Return streaming response for long text")


class SynthesizeResponse(BaseModel):
    """Response for synthesis when not streaming."""

    audio_base64: str
    duration_ms: int
    voice_id: str
    chars_used: int


class VoiceInfoResponse(BaseModel):
    """Information about an available TTS voice."""

    voice_id: str
    name: str
    preview_url: Optional[str]
    labels: Dict[str, str]


class TTSSettingsResponse(BaseModel):
    """User's TTS settings."""

    tts_enabled: bool = True
    tts_voice_id: Optional[str] = None
    tts_speed: float = 1.0
    tts_pitch: float = 1.0
    auto_play_responses: bool = True
    daily_chars_remaining: int


class TTSSettingsUpdateRequest(BaseModel):
    """Request body for updating TTS settings."""

    tts_enabled: Optional[bool] = None
    tts_voice_id: Optional[str] = None
    tts_speed: Optional[float] = Field(None, ge=0.25, le=4.0)
    tts_pitch: Optional[float] = Field(None, ge=0.5, le=2.0)
    auto_play_responses: Optional[bool] = None


class UsageLimitResponse(BaseModel):
    """TTS usage limit information."""

    daily_chars_used: int
    daily_chars_remaining: int
    daily_char_limit: int


# =============================================================================
# Helper Functions
# =============================================================================


def _check_tts_available(tts_service: Optional[TTSService]) -> TTSService:
    """Raise 503 if TTS service not available, otherwise return the service."""
    if tts_service is None:
        raise HTTPException(
            status_code=503,
            detail="TTS service not available. ElevenLabs API key not configured.",
        )
    return tts_service


def _check_daily_limit(
    tts_service: TTSService,
    settings: TTSSettings,
    chars_needed: int,
) -> None:
    """Check daily limit and raise 429 if exceeded."""
    allowed, remaining = tts_service.check_daily_limit(
        settings.tts_daily_chars_used, chars_needed
    )

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "daily_limit_exceeded",
                "message": f"Daily TTS limit reached. {remaining} characters remaining.",
                "chars_remaining": remaining,
            },
        )


# =============================================================================
# Endpoints
# =============================================================================


@router.post("/synthesize")
async def synthesize_text(
    body: SynthesizeRequest,
    auth: AuthContext = Depends(get_auth_context),
    tts_service: Optional[TTSService] = Depends(get_tts_service),
    tts_repo: SupabaseTTSSettingsRepository = Depends(get_tts_settings_repository),
) -> Response:
    """
    Synthesize text to audio.

    Returns audio/mpeg (MP3 128kbps) for direct playback.
    Use stream=true for streaming response on long text.

    Rate limited to 50,000 characters per day per user.
    """
    service = _check_tts_available(tts_service)

    # Check daily limit
    tts_repo.reset_daily_chars_if_needed(auth.user_id)
    settings = tts_repo.get_settings(auth.user_id)
    chars_needed = len(body.text)
    _check_daily_limit(service, settings, chars_needed)

    # Use user's voice preference if not specified
    voice_id = body.voice_id or settings.tts_voice_id
    speed = body.speed or settings.tts_speed

    if body.stream:
        # Streaming response for long text
        def audio_stream():
            for chunk in service.synthesize_streaming(
                text=body.text,
                voice_id=voice_id,
                speed=speed,
            ):
                yield chunk

        # Increment usage (estimate based on text length)
        tts_repo.increment_daily_chars(auth.user_id, chars_needed)

        return StreamingResponse(
            audio_stream(),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "X-TTS-Chars-Used": str(chars_needed),
            },
        )

    # Non-streaming response
    result = service.synthesize(
        text=body.text,
        voice_id=voice_id,
        speed=speed,
    )

    if not result.success:
        raise HTTPException(
            status_code=502,
            detail={"error": "tts_failed", "message": result.error},
        )

    # Track usage
    tts_repo.increment_daily_chars(auth.user_id, result.chars_used)

    # Return audio as binary response
    return Response(
        content=result.audio_data,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline",
            "X-TTS-Duration-Ms": str(result.duration_ms),
            "X-TTS-Chars-Used": str(result.chars_used),
            "X-TTS-Voice-Id": result.voice_id,
        },
    )


@router.post("/synthesize/json")
async def synthesize_text_json(
    body: SynthesizeRequest,
    auth: AuthContext = Depends(get_auth_context),
    tts_service: Optional[TTSService] = Depends(get_tts_service),
    tts_repo: SupabaseTTSSettingsRepository = Depends(get_tts_settings_repository),
) -> SynthesizeResponse:
    """
    Synthesize text to audio, returning base64-encoded audio in JSON.

    Alternative to /synthesize for clients that prefer JSON responses.
    """
    service = _check_tts_available(tts_service)

    # Check daily limit
    tts_repo.reset_daily_chars_if_needed(auth.user_id)
    settings = tts_repo.get_settings(auth.user_id)
    chars_needed = len(body.text)
    _check_daily_limit(service, settings, chars_needed)

    # Use user's voice preference if not specified
    voice_id = body.voice_id or settings.tts_voice_id
    speed = body.speed or settings.tts_speed

    result = service.synthesize(
        text=body.text,
        voice_id=voice_id,
        speed=speed,
    )

    if not result.success:
        raise HTTPException(
            status_code=502,
            detail={"error": "tts_failed", "message": result.error},
        )

    # Track usage
    tts_repo.increment_daily_chars(auth.user_id, result.chars_used)

    return SynthesizeResponse(
        audio_base64=base64.b64encode(result.audio_data).decode("utf-8"),
        duration_ms=result.duration_ms or 0,
        voice_id=result.voice_id,
        chars_used=result.chars_used,
    )


@router.get("/voices")
async def list_voices(
    tts_service: Optional[TTSService] = Depends(get_tts_service),
) -> List[VoiceInfoResponse]:
    """
    List available TTS voices.

    Returns ElevenLabs voices with preview URLs for sampling.
    """
    service = _check_tts_available(tts_service)
    voices = service.get_available_voices()
    return [
        VoiceInfoResponse(
            voice_id=v.voice_id,
            name=v.name,
            preview_url=v.preview_url,
            labels=v.labels,
        )
        for v in voices
    ]


@router.get("/tts-settings")
async def get_tts_settings(
    auth: AuthContext = Depends(get_auth_context),
    tts_repo: SupabaseTTSSettingsRepository = Depends(get_tts_settings_repository),
) -> TTSSettingsResponse:
    """
    Get user's TTS preferences.

    Returns settings with remaining daily character allowance.
    """
    # Reset daily counter if needed before returning
    tts_repo.reset_daily_chars_if_needed(auth.user_id)
    settings = tts_repo.get_settings(auth.user_id)

    return TTSSettingsResponse(
        tts_enabled=settings.tts_enabled,
        tts_voice_id=settings.tts_voice_id,
        tts_speed=settings.tts_speed,
        tts_pitch=settings.tts_pitch,
        auto_play_responses=settings.auto_play_responses,
        daily_chars_remaining=settings.daily_chars_remaining,
    )


@router.patch("/tts-settings")
async def update_tts_settings(
    body: TTSSettingsUpdateRequest,
    auth: AuthContext = Depends(get_auth_context),
    tts_repo: SupabaseTTSSettingsRepository = Depends(get_tts_settings_repository),
) -> TTSSettingsResponse:
    """
    Update user's TTS preferences.

    Only provided fields will be updated.
    """
    update = TTSSettingsUpdate(
        tts_enabled=body.tts_enabled,
        tts_voice_id=body.tts_voice_id,
        tts_speed=body.tts_speed,
        tts_pitch=body.tts_pitch,
        auto_play_responses=body.auto_play_responses,
    )

    settings = tts_repo.update_settings(auth.user_id, update)

    return TTSSettingsResponse(
        tts_enabled=settings.tts_enabled,
        tts_voice_id=settings.tts_voice_id,
        tts_speed=settings.tts_speed,
        tts_pitch=settings.tts_pitch,
        auto_play_responses=settings.auto_play_responses,
        daily_chars_remaining=settings.daily_chars_remaining,
    )


@router.get("/usage")
async def get_usage(
    auth: AuthContext = Depends(get_auth_context),
    tts_repo: SupabaseTTSSettingsRepository = Depends(get_tts_settings_repository),
) -> UsageLimitResponse:
    """
    Get current TTS usage for the day.

    Returns characters used, remaining, and daily limit.
    """
    app_settings = get_settings()
    tts_repo.reset_daily_chars_if_needed(auth.user_id)
    user_settings = tts_repo.get_settings(auth.user_id)

    return UsageLimitResponse(
        daily_chars_used=user_settings.tts_daily_chars_used,
        daily_chars_remaining=user_settings.daily_chars_remaining,
        daily_char_limit=app_settings.tts_daily_char_limit,
    )
