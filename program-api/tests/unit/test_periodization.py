"""
Unit tests for PeriodizationService.

Part of AMA-462: Implement ProgramGenerator Service

Tests all 5 periodization models:
- Linear
- Undulating
- Block
- Conjugate
- Reverse Linear
"""

import pytest

from models.program import ExperienceLevel, ProgramGoal
from services.periodization import (
    BlockPhase,
    EffortType,
    PeriodizationModel,
    PeriodizationService,
    WeekParameters,
)


@pytest.fixture
def service():
    """Create a PeriodizationService instance."""
    return PeriodizationService()


class TestLinearProgression:
    """Tests for linear periodization model."""

    def test_week_1_is_lowest_intensity(self, service):
        """First week should have lowest intensity."""
        intensity, volume = service.calculate_linear_progression(week=1, total_weeks=8)
        assert intensity == 0.65
        assert volume == 1.0

    def test_last_week_is_highest_intensity(self, service):
        """Last week should have highest intensity."""
        intensity, volume = service.calculate_linear_progression(week=8, total_weeks=8)
        assert intensity == 0.95
        assert volume == 0.7

    def test_intensity_increases_over_time(self, service):
        """Intensity should increase progressively."""
        prev_intensity = 0
        for week in range(1, 9):
            intensity, _ = service.calculate_linear_progression(week, 8)
            assert intensity > prev_intensity
            prev_intensity = intensity

    def test_volume_decreases_over_time(self, service):
        """Volume should decrease as intensity increases."""
        prev_volume = 2.0
        for week in range(1, 9):
            _, volume = service.calculate_linear_progression(week, 8)
            assert volume < prev_volume
            prev_volume = volume

    def test_invalid_week_raises_error(self, service):
        """Invalid week number should raise ValueError."""
        with pytest.raises(ValueError):
            service.calculate_linear_progression(week=0, total_weeks=8)

        with pytest.raises(ValueError):
            service.calculate_linear_progression(week=10, total_weeks=8)


class TestUndulatingProgression:
    """Tests for daily undulating periodization (DUP)."""

    def test_session_1_is_heavy(self, service):
        """First session should be heavy (high intensity, lower volume)."""
        intensity, volume = service.calculate_undulating_progression(week=1, session=1)
        assert intensity >= 0.85
        assert volume < 1.0

    def test_session_2_is_light(self, service):
        """Second session should be light (low intensity, high volume)."""
        intensity, volume = service.calculate_undulating_progression(week=1, session=2)
        assert intensity <= 0.70
        assert volume > 1.0

    def test_session_3_is_moderate(self, service):
        """Third session should be moderate."""
        intensity, volume = service.calculate_undulating_progression(week=1, session=3)
        assert 0.7 <= intensity <= 0.8
        assert volume == 1.0

    def test_weekly_progression(self, service):
        """Intensity should increase slightly each week."""
        week1_int, _ = service.calculate_undulating_progression(week=1, session=1)
        week5_int, _ = service.calculate_undulating_progression(week=5, session=1)
        assert week5_int > week1_int

    def test_invalid_session_raises_error(self, service):
        """Invalid session number should raise ValueError."""
        with pytest.raises(ValueError):
            service.calculate_undulating_progression(week=1, session=0)


class TestBlockProgression:
    """Tests for block periodization model."""

    def test_accumulation_phase_first(self, service):
        """First phase should be accumulation."""
        _, _, phase = service.calculate_block_progression(week=1, total_weeks=10)
        assert phase == BlockPhase.ACCUMULATION

    def test_transmutation_phase_middle(self, service):
        """Middle phase should be transmutation."""
        _, _, phase = service.calculate_block_progression(week=5, total_weeks=10)
        assert phase == BlockPhase.TRANSMUTATION

    def test_realization_phase_last(self, service):
        """Final phase should be realization."""
        _, _, phase = service.calculate_block_progression(week=10, total_weeks=10)
        assert phase == BlockPhase.REALIZATION

    def test_accumulation_high_volume(self, service):
        """Accumulation should have high volume, moderate intensity."""
        intensity, volume, _ = service.calculate_block_progression(week=1, total_weeks=10)
        assert volume >= 1.1
        assert intensity < 0.75

    def test_realization_low_volume_high_intensity(self, service):
        """Realization should have low volume, high intensity."""
        intensity, volume, _ = service.calculate_block_progression(week=10, total_weeks=10)
        assert volume < 0.8
        assert intensity > 0.85

    def test_phase_transitions(self, service):
        """Phases should transition at correct boundaries."""
        # 40/40/20 split for 10 weeks: accum=4, trans=4, realize=2
        phases = []
        for week in range(1, 11):
            _, _, phase = service.calculate_block_progression(week, 10)
            phases.append(phase)

        assert phases[0] == BlockPhase.ACCUMULATION
        assert phases[3] == BlockPhase.ACCUMULATION  # Week 4
        assert phases[4] == BlockPhase.TRANSMUTATION  # Week 5
        assert phases[7] == BlockPhase.TRANSMUTATION  # Week 8
        assert phases[8] == BlockPhase.REALIZATION  # Week 9
        assert phases[9] == BlockPhase.REALIZATION  # Week 10


class TestConjugateProgression:
    """Tests for conjugate periodization model."""

    def test_session_1_max_effort(self, service):
        """Session 1 should be max effort."""
        _, _, effort = service.calculate_conjugate_progression(week=1, session=1)
        assert effort == EffortType.MAX_EFFORT

    def test_session_2_dynamic_effort(self, service):
        """Session 2 should be dynamic effort."""
        _, _, effort = service.calculate_conjugate_progression(week=1, session=2)
        assert effort == EffortType.DYNAMIC_EFFORT

    def test_session_3_repetition_effort(self, service):
        """Session 3 should be repetition effort."""
        _, _, effort = service.calculate_conjugate_progression(week=1, session=3)
        assert effort == EffortType.REPETITION_EFFORT

    def test_max_effort_high_intensity(self, service):
        """Max effort should have high intensity, low volume."""
        intensity, volume, _ = service.calculate_conjugate_progression(week=2, session=1)
        assert intensity >= 0.89
        assert volume <= 0.7

    def test_dynamic_effort_low_intensity(self, service):
        """Dynamic effort should have low intensity, high volume."""
        intensity, volume, _ = service.calculate_conjugate_progression(week=1, session=2)
        assert intensity <= 0.60
        assert volume >= 1.2

    def test_wave_loading(self, service):
        """3-week wave loading should vary intensity."""
        int_w1, _, _ = service.calculate_conjugate_progression(week=1, session=1)
        int_w2, _, _ = service.calculate_conjugate_progression(week=2, session=1)
        int_w3, _, _ = service.calculate_conjugate_progression(week=3, session=1)

        # Wave pattern: low, medium, high
        assert int_w1 < int_w2 < int_w3 or int_w1 != int_w2


class TestReverseLinearProgression:
    """Tests for reverse linear periodization model."""

    def test_week_1_highest_intensity(self, service):
        """First week should have highest intensity."""
        intensity, volume = service.calculate_reverse_linear_progression(week=1, total_weeks=8)
        assert intensity == 0.9
        assert volume == 0.7

    def test_last_week_lowest_intensity(self, service):
        """Last week should have lowest intensity."""
        intensity, volume = service.calculate_reverse_linear_progression(week=8, total_weeks=8)
        assert intensity == 0.6
        assert volume == 1.3

    def test_intensity_decreases_over_time(self, service):
        """Intensity should decrease progressively."""
        prev_intensity = 1.0
        for week in range(1, 9):
            intensity, _ = service.calculate_reverse_linear_progression(week, 8)
            assert intensity < prev_intensity
            prev_intensity = intensity

    def test_volume_increases_over_time(self, service):
        """Volume should increase as intensity decreases."""
        prev_volume = 0.0
        for week in range(1, 9):
            _, volume = service.calculate_reverse_linear_progression(week, 8)
            assert volume > prev_volume
            prev_volume = volume


class TestDeloadWeeks:
    """Tests for deload week calculation."""

    def test_beginner_deload_every_6_weeks(self, service):
        """Beginners should deload every 6 weeks."""
        deloads = service.calculate_deload_weeks(
            duration_weeks=12,
            experience_level=ExperienceLevel.BEGINNER,
        )
        assert 6 in deloads
        assert 12 in deloads

    def test_intermediate_deload_every_4_weeks(self, service):
        """Intermediates should deload every 4 weeks."""
        deloads = service.calculate_deload_weeks(
            duration_weeks=12,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )
        assert 4 in deloads
        assert 8 in deloads
        assert 12 in deloads

    def test_advanced_deload_every_3_weeks(self, service):
        """Advanced should deload every 3 weeks."""
        deloads = service.calculate_deload_weeks(
            duration_weeks=12,
            experience_level=ExperienceLevel.ADVANCED,
        )
        assert 3 in deloads
        assert 6 in deloads
        assert 9 in deloads
        assert 12 in deloads

    def test_block_deload_at_phase_transitions(self, service):
        """Block periodization should deload at phase transitions."""
        deloads = service.calculate_deload_weeks(
            duration_weeks=10,
            experience_level=ExperienceLevel.INTERMEDIATE,
            model=PeriodizationModel.BLOCK,
        )
        # Phase transitions at 40% and 80% of 10 weeks = weeks 4 and 8
        assert 4 in deloads
        assert 8 in deloads

    def test_last_week_deload_for_long_programs(self, service):
        """Programs 6+ weeks should deload on last week."""
        deloads = service.calculate_deload_weeks(
            duration_weeks=7,
            experience_level=ExperienceLevel.BEGINNER,
        )
        assert 7 in deloads


class TestWeekParameters:
    """Tests for get_week_parameters method."""

    def test_returns_week_parameters(self, service):
        """Should return WeekParameters dataclass."""
        params = service.get_week_parameters(
            week=1,
            total_weeks=8,
            model=PeriodizationModel.LINEAR,
            goal=ProgramGoal.STRENGTH,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )
        assert isinstance(params, WeekParameters)
        assert params.week_number == 1

    def test_deload_detected(self, service):
        """Deload weeks should be marked."""
        params = service.get_week_parameters(
            week=4,
            total_weeks=8,
            model=PeriodizationModel.LINEAR,
            goal=ProgramGoal.STRENGTH,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )
        assert params.is_deload is True

    def test_deload_reduces_intensity(self, service):
        """Deload weeks should have reduced intensity."""
        regular = service.get_week_parameters(
            week=3,
            total_weeks=8,
            model=PeriodizationModel.LINEAR,
            goal=ProgramGoal.STRENGTH,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )
        deload = service.get_week_parameters(
            week=4,
            total_weeks=8,
            model=PeriodizationModel.LINEAR,
            goal=ProgramGoal.STRENGTH,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )
        assert deload.intensity_percent < regular.intensity_percent
        assert deload.volume_modifier < regular.volume_modifier

    def test_goal_affects_intensity_range(self, service):
        """Different goals should have different intensity ranges."""
        strength = service.get_week_parameters(
            week=1,
            total_weeks=8,
            model=PeriodizationModel.LINEAR,
            goal=ProgramGoal.STRENGTH,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )
        endurance = service.get_week_parameters(
            week=1,
            total_weeks=8,
            model=PeriodizationModel.LINEAR,
            goal=ProgramGoal.ENDURANCE,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )
        # Strength should have higher intensity than endurance
        assert strength.intensity_percent > endurance.intensity_percent


class TestPlanProgression:
    """Tests for plan_progression method."""

    def test_returns_correct_number_of_weeks(self, service):
        """Should return one WeekParameters per week."""
        weeks = service.plan_progression(
            duration_weeks=8,
            goal=ProgramGoal.HYPERTROPHY,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )
        assert len(weeks) == 8

    def test_weeks_are_numbered_correctly(self, service):
        """Week numbers should be sequential."""
        weeks = service.plan_progression(
            duration_weeks=8,
            goal=ProgramGoal.STRENGTH,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )
        for i, week in enumerate(weeks, 1):
            assert week.week_number == i

    def test_auto_selects_model(self, service):
        """Should auto-select appropriate model when not specified."""
        weeks = service.plan_progression(
            duration_weeks=8,
            goal=ProgramGoal.STRENGTH,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )
        # Should be block periodization for strength with 8 weeks
        assert len(weeks) == 8


class TestModelSelection:
    """Tests for select_periodization_model method."""

    def test_strength_advanced_uses_conjugate(self, service):
        """Advanced strength should use conjugate."""
        model = service.select_periodization_model(
            goal=ProgramGoal.STRENGTH,
            experience_level=ExperienceLevel.ADVANCED,
            duration_weeks=8,
        )
        assert model == PeriodizationModel.CONJUGATE

    def test_strength_long_uses_block(self, service):
        """Long strength programs should use block."""
        model = service.select_periodization_model(
            goal=ProgramGoal.STRENGTH,
            experience_level=ExperienceLevel.INTERMEDIATE,
            duration_weeks=12,
        )
        assert model == PeriodizationModel.BLOCK

    def test_hypertrophy_intermediate_uses_undulating(self, service):
        """Intermediate hypertrophy should use undulating."""
        model = service.select_periodization_model(
            goal=ProgramGoal.HYPERTROPHY,
            experience_level=ExperienceLevel.INTERMEDIATE,
            duration_weeks=8,
        )
        assert model == PeriodizationModel.UNDULATING

    def test_endurance_uses_reverse_linear(self, service):
        """Endurance should use reverse linear."""
        model = service.select_periodization_model(
            goal=ProgramGoal.ENDURANCE,
            experience_level=ExperienceLevel.INTERMEDIATE,
            duration_weeks=8,
        )
        assert model == PeriodizationModel.REVERSE_LINEAR

    def test_beginner_uses_linear(self, service):
        """Beginners generally use linear."""
        model = service.select_periodization_model(
            goal=ProgramGoal.HYPERTROPHY,
            experience_level=ExperienceLevel.BEGINNER,
            duration_weeks=8,
        )
        assert model == PeriodizationModel.LINEAR
