"""Utility functions."""
from typing import Optional


def to_int(s: Optional[str]) -> Optional[int]:
    """Convert string to int, returning None if conversion fails."""
    try:
        return int(s) if s is not None else None
    except Exception:
        return None


def upper_from_range(txt: str) -> Optional[int]:
    """Extract upper bound from a range string like '10-12'."""
    try:
        a, b = txt.replace("–", "-").split("-", 1)
        return int(b.strip())
    except Exception:
        return None

