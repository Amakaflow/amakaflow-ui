"""
Services package for program-api.

Part of AMA-461: Create program-api service scaffold
Updated in AMA-462: Added template selector, program validator, LLM integration

Contains business logic services for:
- Program generation (AI-powered hybrid template + LLM approach)
- Periodization planning (5 periodization models)
- Template selection and matching
- Program validation (safety and quality)
- Progression tracking
"""

from services.periodization import (
    BlockPhase,
    EffortType,
    PeriodizationModel,
    PeriodizationService,
    WeekParameters,
)
from services.program_generator import ProgramGenerationError, ProgramGenerator
from services.program_validator import (
    ProgramValidator,
    ValidationIssue,
    ValidationResult,
    ValidationSeverity,
)
from services.progression_engine import ProgressionEngine
from services.template_selector import TemplateMatch, TemplateSelector

__all__ = [
    # Periodization
    "BlockPhase",
    "EffortType",
    "PeriodizationModel",
    "PeriodizationService",
    "WeekParameters",
    # Program Generation
    "ProgramGenerationError",
    "ProgramGenerator",
    # Validation
    "ProgramValidator",
    "ValidationIssue",
    "ValidationResult",
    "ValidationSeverity",
    # Progression
    "ProgressionEngine",
    # Templates
    "TemplateMatch",
    "TemplateSelector",
]
