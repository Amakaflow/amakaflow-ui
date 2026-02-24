"""
WGER Exercise Service + Disk Cache

PURPOSE
-------
- Fetch exercises from the free WGER API (no API key required)
- Cache them locally on disk to avoid overloading WGER servers
- Expose a single function: `get_all_exercises()`

USAGE
-----
1. Import: `from workout_ingestor_api.services.wger_service import get_all_exercises`
2. Call: `exercises = await get_all_exercises()`
3. This service:
   - Caches data to `.cache/wger-exercises.json` at project root
   - Only refetches from WGER if cache is older than 24 hours

This pattern is "industry standard":
- Persistent cache on disk
- Stale-while-revalidate style TTL
- WGER is only hit occasionally, not on every user request
"""

import os
import json
import requests
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path

# ------------------------
# CONFIG
# ------------------------

# Base URL for WGER API
WGER_BASE_URL = "https://wger.de/api/v2"

# English language ID for WGER exercises
WGER_LANGUAGE_ID = 2

# Where to store cache on disk (relative to project root)
CACHE_DIR = Path(__file__).parent.parent.parent / ".cache"
CACHE_FILE = CACHE_DIR / "wger-exercises.json"

# How long cache is valid (in milliseconds) - 24 hours
CACHE_TTL_MS = 24 * 60 * 60 * 1000

# ------------------------
# TYPES
# ------------------------

class NormalizedExercise:
    """Normalized exercise structure for our app."""
    def __init__(
        self,
        id: int,
        name: str,
        description_plain: str,
        category: Optional[str],
        primary_muscles: List[str],
        secondary_muscles: List[str],
        equipment: List[str],
        image_urls: List[str],
        source: str = "wger"
    ):
        self.id = id
        self.name = name
        self.description_plain = description_plain
        self.category = category
        self.primary_muscles = primary_muscles
        self.secondary_muscles = secondary_muscles
        self.equipment = equipment
        self.image_urls = image_urls
        self.source = source
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "description_plain": self.description_plain,
            "category": self.category,
            "primary_muscles": self.primary_muscles,
            "secondary_muscles": self.secondary_muscles,
            "equipment": self.equipment,
            "image_urls": self.image_urls,
            "source": self.source
        }

# ------------------------
# PUBLIC ENTRYPOINT
# ------------------------

def get_all_exercises() -> List[Dict[str, Any]]:
    """
    Get all exercises, using disk cache + WGER API.
    
    - Returns normalized exercises as dictionaries
    - Reads from `.cache/wger-exercises.json` if fresh
    - If cache is missing or stale, fetches from WGER and updates cache
    """
    # 1. Try reading from cache
    cached = _read_cache_safe()
    
    if cached and not _is_cache_stale(cached["fetched_at"]):
        return cached["exercises"]
    
    # 2. Otherwise, fetch from WGER
    wger_exercises = _fetch_all_wger_exercises()
    
    # 3. Normalize into our canonical structure
    normalized = [_normalize_exercise(ex) for ex in wger_exercises]
    
    # 4. Convert to dicts for JSON serialization
    normalized_dicts = [ex.to_dict() for ex in normalized]
    
    # 5. Save to disk cache (best-effort; don't throw if it fails)
    _write_cache_safe({
        "fetched_at": datetime.now().isoformat(),
        "exercises": normalized_dicts,
    })
    
    return normalized_dicts

# ------------------------
# CORE FETCH LOGIC
# ------------------------

def _fetch_all_wger_exercises() -> List[Dict[str, Any]]:
    """
    Fetch ALL exercises (exerciseinfo) from WGER with pagination.
    
    Endpoint: /exerciseinfo/?language=2
    WGER uses standard pagination with `next` and `results`.
    """
    all_exercises = []
    url = f"{WGER_BASE_URL}/exerciseinfo/?language={WGER_LANGUAGE_ID}"
    
    # Respectful pagination loop
    while url:
        response = requests.get(url, timeout=30)
        if response.status_code != 200:
            raise Exception(
                f"Failed to fetch WGER exercises: {response.status_code} {response.reason}"
            )
        
        data = response.json()
        
        results = data.get("results", [])
        all_exercises.extend(results)
        
        # Move to next page (if any)
        url = data.get("next")
    
    return all_exercises

# ------------------------
# NORMALIZATION
# ------------------------

def _html_to_plain_text(html: str) -> str:
    """
    Very simple HTML -> text cleaner.
    WGER `description` is HTML; we strip tags and decode basic entities.
    """
    if not html:
        return ""
    
    # Very simple tag removal
    import re
    text = re.sub(r"<[^>]*>", " ", html)
    
    # Decode common HTML entities
    entities = {
        "&nbsp;": " ",
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
        "&apos;": "'",
    }
    
    for entity, char in entities.items():
        text = text.replace(entity, char)
    
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()
    
    return text

def _normalize_exercise(ex: Dict[str, Any]) -> NormalizedExercise:
    """Transform a WGER exercise into our normalized exercise shape."""
    # Extract name from translations array (WGER stores names in translations)
    # Filter for English translations (language=2)
    name = ""
    description = ""
    translations = ex.get("translations", [])
    
    # Find English translation (language=2)
    english_translation = None
    for trans in translations:
        if trans.get("language") == WGER_LANGUAGE_ID:
            english_translation = trans
            break
    
    # If no English translation found, use first available
    if not english_translation and translations:
        english_translation = translations[0]
    
    if english_translation:
        name = english_translation.get("name", "")
        description = english_translation.get("description", "")
    
    # Fallback: try direct name field (though it's usually not present)
    if not name:
        name = ex.get("name", "")
    
    primary_muscles = [
        m.get("name_en", "") for m in ex.get("muscles", [])
        if m.get("name_en")
    ]
    secondary_muscles = [
        m.get("name_en", "") for m in ex.get("muscles_secondary", [])
        if m.get("name_en")
    ]
    equipment = [
        e.get("name", "") for e in ex.get("equipment", [])
        if e.get("name")
    ]
    images = [
        img.get("image", "") for img in ex.get("images", [])
        if img.get("image")
    ]
    
    return NormalizedExercise(
        id=ex.get("id", 0),
        name=name,
        description_plain=_html_to_plain_text(description),
        category=ex.get("category", {}).get("name") if ex.get("category") else None,
        primary_muscles=primary_muscles,
        secondary_muscles=secondary_muscles,
        equipment=equipment,
        image_urls=images,
        source="wger"
    )

# ------------------------
# CACHE HELPERS
# ------------------------

def _ensure_cache_dir_exists():
    """Ensure cache directory exists."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

def _read_cache_safe() -> Optional[Dict[str, Any]]:
    """Read cache file, but do not throw if anything goes wrong."""
    try:
        if not CACHE_FILE.exists():
            return None
        
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            parsed = json.load(f)
        
        if not parsed or "fetched_at" not in parsed or "exercises" not in parsed:
            return None
        
        if not isinstance(parsed["exercises"], list):
            return None
        
        return parsed
    except Exception:
        return None

def _write_cache_safe(cache: Dict[str, Any]):
    """Write cache file, but ignore errors (don't crash the app)."""
    try:
        _ensure_cache_dir_exists()
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
    except Exception:
        # Ignore cache write errors to keep app robust
        pass

def _is_cache_stale(fetched_at_iso: str) -> bool:
    """Determine whether cache is too old and needs a refresh."""
    try:
        # Handle different ISO format variations
        iso_str = str(fetched_at_iso)
        
        # Replace Z with +00:00 for timezone
        if iso_str.endswith("Z"):
            iso_str = iso_str[:-1] + "+00:00"
        
        # Try parsing with timezone first
        try:
            fetched_at = datetime.fromisoformat(iso_str)
        except ValueError:
            # If that fails, try without timezone
            if "+" not in iso_str and not iso_str.endswith("Z"):
                # Remove any trailing timezone info and try again
                base_str = iso_str.split("+")[0].split("-")[0] if "+" in iso_str or (len(iso_str) > 10 and iso_str[10] == "-") else iso_str
                fetched_at = datetime.fromisoformat(base_str)
            else:
                raise
        
        # Get current time - handle timezone-aware vs naive
        if fetched_at.tzinfo:
            from datetime import timezone
            now = datetime.now(timezone.utc)
        else:
            now = datetime.now()
            fetched_at = fetched_at.replace(tzinfo=None)
        
        # Calculate age in milliseconds
        age_ms = (now - fetched_at).total_seconds() * 1000
        return age_ms > CACHE_TTL_MS
    except Exception as e:
        # If parsing fails, consider cache stale
        import sys
        print(f"Warning: Failed to parse cache timestamp '{fetched_at_iso}': {e}", file=sys.stderr)
        return True

