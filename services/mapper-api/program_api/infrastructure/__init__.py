"""
Infrastructure layer package for program-api.

Part of AMA-461: Create program-api service scaffold

This package contains concrete implementations of the port interfaces.
"""

from infrastructure.calendar_client import (
    BulkCreateResult,
    CalendarAPIError,
    CalendarAPIUnavailableError,
    CalendarClient,
    CalendarClientError,
    ProgramEventData,
    ProgramEventsResult,
)
from infrastructure.db import SupabaseProgramRepository

__all__ = [
    "SupabaseProgramRepository",
    "CalendarClient",
    "CalendarClientError",
    "CalendarAPIUnavailableError",
    "CalendarAPIError",
    "ProgramEventData",
    "BulkCreateResult",
    "ProgramEventsResult",
]
