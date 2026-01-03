"""Cloud transcription service for Deepgram and AssemblyAI (AMA-229).

Provides multi-provider transcription with fitness vocabulary boosting.
API keys are stored server-side for security - never exposed to clients.
"""
import os
import base64
import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Optional dependencies
try:
    from deepgram import DeepgramClient, PrerecordedOptions
    DEEPGRAM_AVAILABLE = True
except ImportError:
    DEEPGRAM_AVAILABLE = False
    DeepgramClient = None
    PrerecordedOptions = None

try:
    import assemblyai as aai
    ASSEMBLYAI_AVAILABLE = True
except ImportError:
    ASSEMBLYAI_AVAILABLE = False
    aai = None


@dataclass
class WordTiming:
    """Word with timing information."""
    word: str
    start: float  # seconds
    end: float    # seconds
    confidence: float = 1.0


@dataclass
class TranscriptionResult:
    """Result from cloud transcription."""
    success: bool
    text: str = ""
    confidence: float = 0.0
    words: List[WordTiming] = field(default_factory=list)
    provider: str = ""
    language: str = "en-US"
    duration_seconds: float = 0.0
    error: Optional[str] = None


class CloudTranscriptionService:
    """Service for cloud-based audio transcription."""

    # Default fitness vocabulary for keyword boosting
    DEFAULT_FITNESS_KEYWORDS = [
        # Common exercises
        "deadlift", "squat", "bench press", "overhead press", "barbell row",
        "pull-up", "chin-up", "dip", "lunge", "plank",
        # Abbreviations and acronyms
        "RDL", "AMRAP", "EMOM", "RPE", "PR", "PB",
        # Equipment
        "kettlebell", "dumbbell", "barbell", "trap bar", "EZ bar",
        "cable machine", "Smith machine", "resistance band",
        # Body parts
        "lats", "delts", "traps", "glutes", "quads", "hamstrings",
        "triceps", "biceps", "forearms", "calves", "rhomboids",
        # Workout types
        "superset", "drop set", "rest-pause", "tempo", "circuit",
    ]

    @classmethod
    def transcribe_with_deepgram(
        cls,
        audio_data: bytes,
        language: str = "en-US",
        keywords: Optional[List[str]] = None,
        api_key: Optional[str] = None,
    ) -> TranscriptionResult:
        """
        Transcribe audio using Deepgram Nova-3 model.

        Args:
            audio_data: Raw audio bytes
            language: Language code (en-US, en-GB, en-AU, etc.)
            keywords: Custom keywords for boosting (merged with fitness vocab)
            api_key: Deepgram API key (or uses DEEPGRAM_API_KEY env var)

        Returns:
            TranscriptionResult with text, confidence, and word timings
        """
        if not DEEPGRAM_AVAILABLE:
            return TranscriptionResult(
                success=False,
                provider="deepgram",
                error="Deepgram SDK not installed. Run: pip install deepgram-sdk"
            )

        api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            return TranscriptionResult(
                success=False,
                provider="deepgram",
                error="Deepgram API key not configured. Set DEEPGRAM_API_KEY environment variable."
            )

        try:
            client = DeepgramClient(api_key)

            # Merge custom keywords with default fitness vocabulary
            all_keywords = cls.DEFAULT_FITNESS_KEYWORDS.copy()
            if keywords:
                all_keywords.extend(keywords)

            options = PrerecordedOptions(
                model="nova-2",  # Nova-2 is more widely available than Nova-3
                language=language,
                smart_format=True,  # Formatting for numbers, currency, etc.
                punctuate=True,
                diarize=False,
                keywords=all_keywords[:100],  # Deepgram has keyword limit
            )

            # Transcribe from bytes
            source = {"buffer": audio_data, "mimetype": "audio/wav"}
            response = client.listen.prerecorded.v("1").transcribe_file(source, options)

            # Extract results
            if not response or not response.results:
                return TranscriptionResult(
                    success=False,
                    provider="deepgram",
                    error="No transcription results returned"
                )

            channel = response.results.channels[0]
            alternative = channel.alternatives[0]

            # Build word timings
            words = []
            for word_info in alternative.words or []:
                words.append(WordTiming(
                    word=word_info.word,
                    start=word_info.start,
                    end=word_info.end,
                    confidence=word_info.confidence,
                ))

            return TranscriptionResult(
                success=True,
                text=alternative.transcript,
                confidence=alternative.confidence,
                words=words,
                provider="deepgram",
                language=language,
                duration_seconds=response.metadata.duration if response.metadata else 0.0,
            )

        except Exception as e:
            logger.exception(f"Deepgram transcription failed: {e}")
            return TranscriptionResult(
                success=False,
                provider="deepgram",
                error=f"Deepgram transcription failed: {str(e)}"
            )

    @classmethod
    def transcribe_with_assemblyai(
        cls,
        audio_data: bytes,
        language: str = "en-US",
        keywords: Optional[List[str]] = None,
        api_key: Optional[str] = None,
    ) -> TranscriptionResult:
        """
        Transcribe audio using AssemblyAI Universal model.

        Args:
            audio_data: Raw audio bytes
            language: Language code (en, en_us, en_uk, en_au, etc.)
            keywords: Custom keywords for boosting (merged with fitness vocab)
            api_key: AssemblyAI API key (or uses ASSEMBLYAI_API_KEY env var)

        Returns:
            TranscriptionResult with text, confidence, and word timings
        """
        if not ASSEMBLYAI_AVAILABLE:
            return TranscriptionResult(
                success=False,
                provider="assemblyai",
                error="AssemblyAI SDK not installed. Run: pip install assemblyai"
            )

        api_key = api_key or os.getenv("ASSEMBLYAI_API_KEY")
        if not api_key:
            return TranscriptionResult(
                success=False,
                provider="assemblyai",
                error="AssemblyAI API key not configured. Set ASSEMBLYAI_API_KEY environment variable."
            )

        try:
            # Configure AssemblyAI
            aai.settings.api_key = api_key

            # Merge custom keywords with default fitness vocabulary
            all_keywords = cls.DEFAULT_FITNESS_KEYWORDS.copy()
            if keywords:
                all_keywords.extend(keywords)

            # Map language codes
            language_map = {
                "en-US": "en_us",
                "en-GB": "en_uk",
                "en-AU": "en_au",
                "en": "en",
            }
            aai_language = language_map.get(language, "en")

            config = aai.TranscriptionConfig(
                language_code=aai_language,
                punctuate=True,
                format_text=True,
                word_boost=all_keywords[:100],  # AssemblyAI has a limit
                boost_param="high",  # high, low, or default
            )

            transcriber = aai.Transcriber(config=config)

            # Transcribe from bytes - AssemblyAI needs file path or URL
            # Write to temp file
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_data)
                temp_path = f.name

            try:
                transcript = transcriber.transcribe(temp_path)
            finally:
                # Clean up temp file
                os.unlink(temp_path)

            if transcript.status == aai.TranscriptStatus.error:
                return TranscriptionResult(
                    success=False,
                    provider="assemblyai",
                    error=f"AssemblyAI error: {transcript.error}"
                )

            # Build word timings
            words = []
            for word_info in transcript.words or []:
                words.append(WordTiming(
                    word=word_info.text,
                    start=word_info.start / 1000.0,  # Convert ms to seconds
                    end=word_info.end / 1000.0,
                    confidence=word_info.confidence,
                ))

            # Calculate average confidence
            avg_confidence = 0.0
            if transcript.words:
                avg_confidence = sum(w.confidence for w in transcript.words) / len(transcript.words)

            return TranscriptionResult(
                success=True,
                text=transcript.text or "",
                confidence=avg_confidence,
                words=words,
                provider="assemblyai",
                language=language,
                duration_seconds=transcript.audio_duration or 0.0,
            )

        except Exception as e:
            logger.exception(f"AssemblyAI transcription failed: {e}")
            return TranscriptionResult(
                success=False,
                provider="assemblyai",
                error=f"AssemblyAI transcription failed: {str(e)}"
            )

    @classmethod
    def transcribe(
        cls,
        audio_data: bytes,
        provider: str = "deepgram",
        language: str = "en-US",
        keywords: Optional[List[str]] = None,
    ) -> TranscriptionResult:
        """
        Transcribe audio using specified cloud provider.

        Args:
            audio_data: Raw audio bytes
            provider: "deepgram" or "assemblyai"
            language: Language code
            keywords: Custom keywords for boosting

        Returns:
            TranscriptionResult with transcription details
        """
        if provider == "deepgram":
            return cls.transcribe_with_deepgram(audio_data, language, keywords)
        elif provider == "assemblyai":
            return cls.transcribe_with_assemblyai(audio_data, language, keywords)
        else:
            return TranscriptionResult(
                success=False,
                provider=provider,
                error=f"Unknown transcription provider: {provider}. Use 'deepgram' or 'assemblyai'."
            )
