"""
Service unit tests.

Part of AMA-461: Create program-api service scaffold

Tests service layer logic (stubs for now, will be expanded as services are implemented).
"""

import pytest

from services.program_generator import ProgramGenerator
from services.periodization import PeriodizationService
from services.progression_engine import ProgressionEngine
from models.program import ProgramGoal, ExperienceLevel
from models.generation import GenerateProgramRequest


# ---------------------------------------------------------------------------
# ProgramGenerator Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestProgramGenerator:
    """Tests for ProgramGenerator service."""

    def test_initialization_without_keys(self):
        """Generator can be initialized without API keys."""
        generator = ProgramGenerator()
        assert generator._openai_key is None
        assert generator._anthropic_key is None

    def test_initialization_with_keys(self):
        """Generator can be initialized with API keys."""
        generator = ProgramGenerator(
            openai_api_key="sk-test-openai",
            anthropic_api_key="sk-test-anthropic",
        )
        assert generator._openai_key == "sk-test-openai"
        assert generator._anthropic_key == "sk-test-anthropic"

    @pytest.mark.asyncio
    async def test_generate_raises_not_implemented(self):
        """Generate method raises NotImplementedError (stub)."""
        generator = ProgramGenerator()
        request = GenerateProgramRequest(
            goal=ProgramGoal.STRENGTH,
            duration_weeks=8,
            sessions_per_week=4,
            experience_level=ExperienceLevel.INTERMEDIATE,
        )

        with pytest.raises(NotImplementedError):
            await generator.generate(request, "user-123")

    def test_select_exercises_raises_not_implemented(self):
        """_select_exercises raises NotImplementedError (stub)."""
        generator = ProgramGenerator()

        with pytest.raises(NotImplementedError):
            generator._select_exercises("strength", ["barbell"], "intermediate")

    def test_create_weekly_structure_raises_not_implemented(self):
        """_create_weekly_structure raises NotImplementedError (stub)."""
        generator = ProgramGenerator()

        with pytest.raises(NotImplementedError):
            generator._create_weekly_structure(4, "strength")


# ---------------------------------------------------------------------------
# PeriodizationService Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestPeriodizationService:
    """Tests for PeriodizationService."""

    def test_instantiation(self):
        """Service can be instantiated."""
        service = PeriodizationService()
        assert service is not None

    def test_plan_progression_raises_not_implemented(self):
        """plan_progression raises NotImplementedError (stub)."""
        service = PeriodizationService()

        with pytest.raises(NotImplementedError):
            service.plan_progression(
                duration_weeks=12,
                goal=ProgramGoal.STRENGTH,
                experience_level=ExperienceLevel.INTERMEDIATE,
            )

    def test_calculate_deload_weeks_raises_not_implemented(self):
        """calculate_deload_weeks raises NotImplementedError (stub)."""
        service = PeriodizationService()

        with pytest.raises(NotImplementedError):
            service.calculate_deload_weeks(
                duration_weeks=12,
                experience_level=ExperienceLevel.INTERMEDIATE,
            )

    def test_get_intensity_target_raises_not_implemented(self):
        """get_intensity_target raises NotImplementedError (stub)."""
        service = PeriodizationService()

        with pytest.raises(NotImplementedError):
            service.get_intensity_target(
                week_number=4,
                total_weeks=12,
                goal=ProgramGoal.STRENGTH,
            )


# ---------------------------------------------------------------------------
# ProgressionEngine Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestProgressionEngine:
    """Tests for ProgressionEngine."""

    def test_instantiation(self):
        """Engine can be instantiated."""
        engine = ProgressionEngine()
        assert engine is not None

    def test_calculate_1rm_raises_not_implemented(self):
        """calculate_1rm raises NotImplementedError (stub)."""
        engine = ProgressionEngine()

        with pytest.raises(NotImplementedError):
            engine.calculate_1rm(weight=100.0, reps=10)

    def test_calculate_1rm_accepts_formula_parameter(self):
        """calculate_1rm accepts formula parameter (for when implemented)."""
        engine = ProgressionEngine()

        # These should all raise NotImplementedError for now
        for formula in ["epley", "brzycki", "lombardi"]:
            with pytest.raises(NotImplementedError):
                engine.calculate_1rm(weight=100.0, reps=10, formula=formula)

    def test_get_progression_suggestion_raises_not_implemented(self):
        """get_progression_suggestion raises NotImplementedError (stub)."""
        engine = ProgressionEngine()
        from uuid import uuid4

        with pytest.raises(NotImplementedError):
            engine.get_progression_suggestion("user-123", uuid4())

    def test_detect_personal_records_raises_not_implemented(self):
        """detect_personal_records raises NotImplementedError (stub)."""
        engine = ProgressionEngine()
        from uuid import uuid4

        with pytest.raises(NotImplementedError):
            engine.detect_personal_records(
                "user-123",
                uuid4(),
                {"weight": 225, "reps": 5},
            )

    def test_get_volume_analytics_raises_not_implemented(self):
        """get_volume_analytics raises NotImplementedError (stub)."""
        engine = ProgressionEngine()

        with pytest.raises(NotImplementedError):
            engine.get_volume_analytics("user-123")


# ---------------------------------------------------------------------------
# Fake Repository Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestFakeProgramRepository:
    """Tests for FakeProgramRepository (testing infrastructure)."""

    def test_seed_and_get_by_user(self, fake_program_repo):
        """Can seed programs and retrieve by user."""
        fake_program_repo.seed([
            {"id": "prog-1", "user_id": "user-1", "name": "Program 1"},
            {"id": "prog-2", "user_id": "user-1", "name": "Program 2"},
            {"id": "prog-3", "user_id": "user-2", "name": "Program 3"},
        ])

        user_1_programs = fake_program_repo.get_by_user("user-1")
        assert len(user_1_programs) == 2

        user_2_programs = fake_program_repo.get_by_user("user-2")
        assert len(user_2_programs) == 1

    def test_get_by_id(self, fake_program_repo):
        """Can retrieve program by ID."""
        fake_program_repo.seed([
            {"id": "prog-1", "user_id": "user-1", "name": "Program 1"},
        ])

        program = fake_program_repo.get_by_id("prog-1")
        assert program is not None
        assert program["name"] == "Program 1"

        not_found = fake_program_repo.get_by_id("nonexistent")
        assert not_found is None

    def test_create(self, fake_program_repo):
        """Can create new programs."""
        program = fake_program_repo.create({
            "user_id": "user-1",
            "name": "New Program",
        })

        assert program["id"] is not None
        assert program["name"] == "New Program"
        assert program["created_at"] is not None
        assert fake_program_repo.count() == 1

    def test_update(self, fake_program_repo):
        """Can update existing programs."""
        fake_program_repo.seed([
            {"id": "prog-1", "user_id": "user-1", "name": "Original Name"},
        ])

        updated = fake_program_repo.update("prog-1", {"name": "Updated Name"})

        assert updated["name"] == "Updated Name"
        assert updated["id"] == "prog-1"  # ID preserved

    def test_update_nonexistent_raises(self, fake_program_repo):
        """Updating nonexistent program raises KeyError."""
        with pytest.raises(KeyError):
            fake_program_repo.update("nonexistent", {"name": "Test"})

    def test_delete(self, fake_program_repo):
        """Can delete programs."""
        fake_program_repo.seed([
            {"id": "prog-1", "user_id": "user-1", "name": "Program 1"},
        ])

        result = fake_program_repo.delete("prog-1")
        assert result is True
        assert fake_program_repo.count() == 0

        result = fake_program_repo.delete("nonexistent")
        assert result is False

    def test_reset(self, fake_program_repo):
        """Can reset all data."""
        fake_program_repo.seed([
            {"id": "prog-1", "user_id": "user-1", "name": "Program 1"},
            {"id": "prog-2", "user_id": "user-1", "name": "Program 2"},
        ])

        assert fake_program_repo.count() == 2
        fake_program_repo.reset()
        assert fake_program_repo.count() == 0

    def test_weeks_and_workouts(self, fake_program_repo):
        """Can manage weeks and workouts."""
        fake_program_repo.seed([
            {"id": "prog-1", "user_id": "user-1", "name": "Program 1"},
        ])

        week = fake_program_repo.create_week("prog-1", {
            "week_number": 1,
            "name": "Week 1",
        })
        assert week["program_id"] == "prog-1"

        workout = fake_program_repo.create_workout(week["id"], {
            "day_of_week": 1,
            "name": "Push Day",
            "order_index": 0,
        })
        assert workout["program_week_id"] == week["id"]

        weeks = fake_program_repo.get_weeks("prog-1")
        assert len(weeks) == 1
        assert len(weeks[0]["workouts"]) == 1
