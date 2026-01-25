"""
Periodization planning service.

Part of AMA-461: Create program-api service scaffold

This service handles periodization logic for training programs:
- Linear periodization
- Undulating periodization
- Block periodization
- Deload week planning
"""

from typing import List, Optional

from models.program import ProgramGoal, ExperienceLevel


class PeriodizationService:
    """
    Service for planning program periodization.

    Handles the science-based progression of training variables
    across weeks and mesocycles.
    """

    def plan_progression(
        self,
        duration_weeks: int,
        goal: ProgramGoal,
        experience_level: ExperienceLevel,
    ) -> List[dict]:
        """
        Plan the periodization structure for a program.

        Args:
            duration_weeks: Total program duration
            goal: Primary training goal
            experience_level: User's experience level

        Returns:
            List of week configurations with intensity/volume targets

        Raises:
            NotImplementedError: This is a stub
        """
        # Stub: Will be implemented in future tickets
        raise NotImplementedError("Periodization planning not yet implemented")

    def calculate_deload_weeks(
        self,
        duration_weeks: int,
        experience_level: ExperienceLevel,
    ) -> List[int]:
        """
        Determine which weeks should be deload weeks.

        Args:
            duration_weeks: Total program duration
            experience_level: User's experience level

        Returns:
            List of week numbers that should be deloads

        Raises:
            NotImplementedError: This is a stub
        """
        # Stub: Will be implemented in future tickets
        raise NotImplementedError()

    def get_intensity_target(
        self,
        week_number: int,
        total_weeks: int,
        goal: ProgramGoal,
    ) -> float:
        """
        Calculate target intensity for a given week.

        Args:
            week_number: Current week (1-indexed)
            total_weeks: Total program duration
            goal: Training goal

        Returns:
            Target intensity as percentage (0.0-1.0)

        Raises:
            NotImplementedError: This is a stub
        """
        # Stub: Will be implemented in future tickets
        raise NotImplementedError()
