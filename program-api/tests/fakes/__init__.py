"""
Fake implementations for testing.

Part of AMA-461: Create program-api service scaffold

This package provides in-memory fake implementations of repository
interfaces for fast, isolated testing without database dependencies.
"""

from tests.fakes.program_repository import FakeProgramRepository

__all__ = [
    "FakeProgramRepository",
]
