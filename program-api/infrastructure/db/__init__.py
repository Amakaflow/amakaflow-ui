"""
Database infrastructure package.

Part of AMA-461: Create program-api service scaffold
"""

from infrastructure.db.program_repository import SupabaseProgramRepository

__all__ = [
    "SupabaseProgramRepository",
]
