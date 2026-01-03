"""Voice dictionary service for user corrections and settings (AMA-229).

Manages personal voice corrections that improve transcription accuracy over time.
Syncs across devices via Supabase backend.
"""
import os
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Optional dependencies
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None


class DictionaryEntry(BaseModel):
    """A single correction entry in the personal dictionary."""
    misheard: str  # What ASR got wrong
    corrected: str  # User's correction
    frequency: int = 1  # How often this correction was made


class VoiceSettings(BaseModel):
    """User voice transcription settings."""
    provider: str = "smart"  # whisperkit, deepgram, assemblyai, smart
    cloud_fallback_enabled: bool = True
    accent_region: str = "en-US"


@dataclass
class FitnessVocabulary:
    """Fitness vocabulary data."""
    categories: Dict[str, List[str]]
    flat_list: List[str]
    total_terms: int
    version: str


class VoiceDictionaryService:
    """Service for managing voice dictionaries and settings."""

    _fitness_vocab_cache: Optional[FitnessVocabulary] = None

    @classmethod
    def _get_supabase_client(cls) -> Optional[Any]:
        """Get Supabase client instance."""
        if not SUPABASE_AVAILABLE:
            return None

        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            logger.warning("Supabase credentials not configured")
            return None

        try:
            return create_client(supabase_url, supabase_key)
        except Exception as e:
            logger.error(f"Failed to create Supabase client: {e}")
            return None

    @classmethod
    def load_fitness_vocabulary(cls) -> FitnessVocabulary:
        """Load the fitness vocabulary from JSON file."""
        if cls._fitness_vocab_cache:
            return cls._fitness_vocab_cache

        # Find the vocabulary file
        current_dir = Path(__file__).parent
        vocab_path = current_dir.parent / "data" / "fitness_vocabulary.json"

        try:
            with open(vocab_path, "r") as f:
                data = json.load(f)

            cls._fitness_vocab_cache = FitnessVocabulary(
                categories=data.get("categories", {}),
                flat_list=data.get("flat_list", []),
                total_terms=data.get("total_terms", 0),
                version=data.get("version", "1.0.0"),
            )
            return cls._fitness_vocab_cache
        except Exception as e:
            logger.error(f"Failed to load fitness vocabulary: {e}")
            # Return empty vocabulary
            return FitnessVocabulary(
                categories={},
                flat_list=[],
                total_terms=0,
                version="0.0.0",
            )

    @classmethod
    def get_fitness_vocabulary_response(cls) -> Dict[str, Any]:
        """Get fitness vocabulary as API response."""
        vocab = cls.load_fitness_vocabulary()
        return {
            "version": vocab.version,
            "total_terms": vocab.total_terms,
            "categories": vocab.categories,
            "flat_list": vocab.flat_list,
        }

    @classmethod
    def get_user_dictionary(cls, user_id: str) -> Dict[str, Any]:
        """
        Get user's personal correction dictionary.

        Args:
            user_id: The Clerk user ID

        Returns:
            Dict with corrections list
        """
        supabase = cls._get_supabase_client()
        if not supabase:
            return {"corrections": [], "error": "Database not available"}

        try:
            result = supabase.table("user_voice_corrections") \
                .select("misheard, corrected, frequency, created_at, updated_at") \
                .eq("user_id", user_id) \
                .order("frequency", desc=True) \
                .execute()

            corrections = []
            for row in result.data or []:
                corrections.append({
                    "misheard": row["misheard"],
                    "corrected": row["corrected"],
                    "frequency": row["frequency"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                })

            return {
                "corrections": corrections,
                "count": len(corrections),
            }
        except Exception as e:
            logger.error(f"Failed to get user dictionary: {e}")
            return {"corrections": [], "error": str(e)}

    @classmethod
    def sync_user_dictionary(
        cls,
        user_id: str,
        corrections: List[DictionaryEntry]
    ) -> Dict[str, Any]:
        """
        Sync/upsert user corrections to database.

        Args:
            user_id: The Clerk user ID
            corrections: List of corrections to sync

        Returns:
            Dict with sync results
        """
        supabase = cls._get_supabase_client()
        if not supabase:
            return {"success": False, "error": "Database not available"}

        try:
            synced = 0
            errors = []

            for correction in corrections:
                try:
                    # Upsert: insert or update on conflict
                    record = {
                        "user_id": user_id,
                        "misheard": correction.misheard.lower().strip(),
                        "corrected": correction.corrected.strip(),
                        "frequency": correction.frequency,
                    }

                    supabase.table("user_voice_corrections") \
                        .upsert(record, on_conflict="user_id,misheard") \
                        .execute()

                    synced += 1
                except Exception as e:
                    errors.append(f"{correction.misheard}: {str(e)}")

            return {
                "success": len(errors) == 0,
                "synced": synced,
                "errors": errors if errors else None,
            }
        except Exception as e:
            logger.error(f"Failed to sync user dictionary: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def delete_correction(cls, user_id: str, misheard: str) -> Dict[str, Any]:
        """
        Delete a single correction from user's dictionary.

        Args:
            user_id: The Clerk user ID
            misheard: The misheard text to delete

        Returns:
            Dict with deletion result
        """
        supabase = cls._get_supabase_client()
        if not supabase:
            return {"success": False, "error": "Database not available"}

        try:
            result = supabase.table("user_voice_corrections") \
                .delete() \
                .eq("user_id", user_id) \
                .eq("misheard", misheard.lower().strip()) \
                .execute()

            return {"success": True, "deleted": len(result.data or [])}
        except Exception as e:
            logger.error(f"Failed to delete correction: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def get_user_settings(cls, user_id: str) -> Dict[str, Any]:
        """
        Get user's voice transcription settings.

        Args:
            user_id: The Clerk user ID

        Returns:
            Dict with voice settings
        """
        supabase = cls._get_supabase_client()
        if not supabase:
            # Return defaults if DB not available
            return VoiceSettings().model_dump()

        try:
            result = supabase.table("user_voice_settings") \
                .select("provider, cloud_fallback_enabled, accent_region") \
                .eq("user_id", user_id) \
                .single() \
                .execute()

            if result.data:
                return {
                    "provider": result.data["provider"],
                    "cloud_fallback_enabled": result.data["cloud_fallback_enabled"],
                    "accent_region": result.data["accent_region"],
                }
            else:
                # Return defaults
                return VoiceSettings().model_dump()
        except Exception as e:
            # Single() throws if no row found
            if "no rows" in str(e).lower() or "0 rows" in str(e).lower():
                return VoiceSettings().model_dump()
            logger.error(f"Failed to get user settings: {e}")
            return VoiceSettings().model_dump()

    @classmethod
    def update_user_settings(
        cls,
        user_id: str,
        settings: VoiceSettings
    ) -> Dict[str, Any]:
        """
        Update user's voice transcription settings.

        Args:
            user_id: The Clerk user ID
            settings: New settings to save

        Returns:
            Dict with update result
        """
        supabase = cls._get_supabase_client()
        if not supabase:
            return {"success": False, "error": "Database not available"}

        try:
            record = {
                "user_id": user_id,
                "provider": settings.provider,
                "cloud_fallback_enabled": settings.cloud_fallback_enabled,
                "accent_region": settings.accent_region,
            }

            supabase.table("user_voice_settings") \
                .upsert(record, on_conflict="user_id") \
                .execute()

            return {"success": True, "settings": settings.model_dump()}
        except Exception as e:
            logger.error(f"Failed to update user settings: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def apply_corrections(cls, text: str, user_id: str) -> str:
        """
        Apply user's personal corrections to transcribed text.

        Args:
            text: The transcribed text
            user_id: The Clerk user ID

        Returns:
            Text with corrections applied
        """
        dictionary = cls.get_user_dictionary(user_id)
        corrections = dictionary.get("corrections", [])

        if not corrections:
            return text

        result = text
        for correction in corrections:
            misheard = correction["misheard"]
            corrected = correction["corrected"]
            # Case-insensitive replacement
            import re
            pattern = re.compile(re.escape(misheard), re.IGNORECASE)
            result = pattern.sub(corrected, result)

        return result
