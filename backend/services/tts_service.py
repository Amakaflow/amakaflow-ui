"""
TTS Service for ElevenLabs text-to-speech synthesis.

Part of AMA-442: Extend Voice Infrastructure for Chat Assistant (TTS)

Provides text-to-speech capabilities with:
- Daily character limit tracking per user
- Text truncation at sentence boundaries
- Streaming support for long responses
- Graceful degradation when service unavailable
"""

import logging
import re
from dataclasses import dataclass
from typing import Dict, Iterator, List, Optional, Tuple

from elevenlabs import ElevenLabs
from elevenlabs.core import ApiError

logger = logging.getLogger(__name__)


@dataclass
class TTSResult:
    """Result of a TTS synthesis operation."""

    success: bool
    audio_data: Optional[bytes]  # MP3 128kbps
    duration_ms: Optional[int]
    chars_used: int
    provider: str
    voice_id: str
    error: Optional[str] = None


@dataclass
class VoiceInfo:
    """Information about an available TTS voice."""

    voice_id: str
    name: str
    preview_url: Optional[str]
    labels: Dict[str, str]  # accent, gender, age, etc.


class TTSService:
    """ElevenLabs TTS service with usage tracking."""

    DAILY_CHAR_LIMIT = 50_000
    MAX_TEXT_LENGTH = 3000
    DEFAULT_MODEL = "eleven_turbo_v2_5"
    PROVIDER = "elevenlabs"

    def __init__(
        self,
        api_key: str,
        default_voice_id: str = "21m00Tcm4TlvDq8ikWAM",
        daily_char_limit: int = 50_000,
    ) -> None:
        """
        Initialize TTS service.

        Args:
            api_key: ElevenLabs API key.
            default_voice_id: Default voice ID to use (Rachel by default).
            daily_char_limit: Maximum characters per user per day.
        """
        self._client = ElevenLabs(api_key=api_key)
        self._default_voice_id = default_voice_id
        self._daily_char_limit = daily_char_limit

    def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> TTSResult:
        """
        Synthesize text to audio.

        Args:
            text: Text to synthesize (max 3000 chars).
            voice_id: ElevenLabs voice ID, uses default if not provided.
            speed: Speech rate multiplier (0.25-4.0).

        Returns:
            TTSResult with audio data or error information.
        """
        # Use default voice if not specified
        voice_id = voice_id or self._default_voice_id

        # Truncate text if too long
        original_length = len(text)
        if original_length > self.MAX_TEXT_LENGTH:
            text = self._truncate_at_sentence(text, self.MAX_TEXT_LENGTH)
            logger.info(
                "Truncated text from %d to %d chars for TTS",
                original_length,
                len(text),
            )

        chars_used = len(text)

        try:
            # Generate audio using ElevenLabs
            # Note: Speed is supported via voice_settings for eleven_turbo_v2_5+
            voice_settings = None
            if speed != 1.0:
                voice_settings = {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "speed": speed,
                }

            audio_generator = self._client.text_to_speech.convert(
                voice_id=voice_id,
                text=text,
                model_id=self.DEFAULT_MODEL,
                output_format="mp3_44100_128",
                voice_settings=voice_settings,
            )

            # Collect all audio chunks
            audio_chunks = list(audio_generator)
            audio_data = b"".join(audio_chunks)

            # Estimate duration (MP3 128kbps = 16000 bytes/sec)
            duration_ms = int((len(audio_data) / 16000) * 1000)

            return TTSResult(
                success=True,
                audio_data=audio_data,
                duration_ms=duration_ms,
                chars_used=chars_used,
                provider=self.PROVIDER,
                voice_id=voice_id,
            )

        except ApiError as e:
            logger.error("ElevenLabs API error: %s", e)
            return TTSResult(
                success=False,
                audio_data=None,
                duration_ms=None,
                chars_used=0,
                provider=self.PROVIDER,
                voice_id=voice_id,
                error=f"TTS service error: {e.body if hasattr(e, 'body') else str(e)}",
            )
        except Exception as e:
            logger.error("Unexpected TTS error: %s", e)
            return TTSResult(
                success=False,
                audio_data=None,
                duration_ms=None,
                chars_used=0,
                provider=self.PROVIDER,
                voice_id=voice_id,
                error="TTS service temporarily unavailable",
            )

    def synthesize_streaming(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
        chunk_size: int = 4096,
    ) -> Iterator[bytes]:
        """
        Stream audio chunks for long responses.

        Yields audio chunks (approximately 250ms each) for immediate playback.

        Args:
            text: Text to synthesize.
            voice_id: ElevenLabs voice ID, uses default if not provided.
            speed: Speech rate multiplier (0.25-4.0).
            chunk_size: Size of audio chunks to yield.

        Yields:
            Audio data chunks (MP3 format).
        """
        voice_id = voice_id or self._default_voice_id

        # Truncate if needed
        if len(text) > self.MAX_TEXT_LENGTH:
            text = self._truncate_at_sentence(text, self.MAX_TEXT_LENGTH)

        try:
            # Apply speed setting if not default
            voice_settings = None
            if speed != 1.0:
                voice_settings = {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "speed": speed,
                }

            audio_generator = self._client.text_to_speech.convert(
                voice_id=voice_id,
                text=text,
                model_id=self.DEFAULT_MODEL,
                output_format="mp3_44100_128",
                voice_settings=voice_settings,
            )

            buffer = b""
            for chunk in audio_generator:
                buffer += chunk
                while len(buffer) >= chunk_size:
                    yield buffer[:chunk_size]
                    buffer = buffer[chunk_size:]

            # Yield remaining data
            if buffer:
                yield buffer

        except Exception as e:
            logger.error("TTS streaming error: %s", e)
            # Don't raise - caller should handle empty iterator

    def get_available_voices(self) -> List[VoiceInfo]:
        """
        Get list of available ElevenLabs voices.

        Returns:
            List of VoiceInfo with voice details and preview URLs.
        """
        try:
            response = self._client.voices.get_all()
            voices = []
            for voice in response.voices:
                voices.append(
                    VoiceInfo(
                        voice_id=voice.voice_id,
                        name=voice.name,
                        preview_url=voice.preview_url,
                        labels=voice.labels or {},
                    )
                )
            return voices
        except Exception as e:
            logger.error("Failed to fetch voices: %s", e)
            return []

    def check_daily_limit(
        self,
        chars_used: int,
        chars_needed: int,
    ) -> Tuple[bool, int]:
        """
        Check if user can synthesize chars_needed characters.

        Args:
            chars_used: Characters already used today.
            chars_needed: Characters needed for this request.

        Returns:
            Tuple of (allowed, remaining_chars).
        """
        remaining = self._daily_char_limit - chars_used
        allowed = chars_needed <= remaining
        return (allowed, max(0, remaining))

    def _truncate_at_sentence(self, text: str, max_length: int) -> str:
        """
        Truncate text at sentence boundary.

        Attempts to find a natural break point (sentence end) before max_length.
        Falls back to word boundary if no sentence end found.

        Args:
            text: Text to truncate.
            max_length: Maximum allowed length.

        Returns:
            Truncated text ending at a natural boundary.
        """
        if len(text) <= max_length:
            return text

        # Find last sentence ending before max_length
        truncated = text[:max_length]

        # Look for sentence endings: . ! ? followed by space or end
        sentence_endings = list(re.finditer(r'[.!?](?:\s|$)', truncated))

        if sentence_endings:
            # Use the last complete sentence
            last_end = sentence_endings[-1].end()
            return truncated[:last_end].strip()

        # No sentence boundary - try word boundary
        last_space = truncated.rfind(' ')
        if last_space > max_length // 2:
            return truncated[:last_space].strip() + "..."

        # Fallback to hard cut
        return truncated.strip() + "..."
