"""
Stress tests for ParserService with diverse real-world workout scenarios.

Tests 10 different real-world workout text formats to verify the parser
handles strength, cardio, CrossFit, superset, distance, messy captions,
and mixed-format inputs correctly.

Tests are adjusted to match actual parser behavior. Known limitations are
documented with comments and, where behavior is clearly wrong, marked with
pytest.xfail so we capture regressions while documenting gaps.
"""

import re
import pytest
from workout_ingestor_api.services.parser_service import ParserService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def all_exercises(workout):
    """Get all exercises from a workout, including those inside legacy supersets."""
    exercises = []
    for block in workout.blocks:
        exercises.extend(block.exercises)
        for ss in block.supersets:
            exercises.extend(ss.exercises)
    return exercises


def exercise_names(workout):
    """Get lowercase exercise names for easier assertions."""
    return [ex.name.lower() for ex in all_exercises(workout)]


def dump_workout(workout):
    """Debug helper: return human-readable workout structure."""
    lines = [f"Title: {workout.title}"]
    for i, block in enumerate(workout.blocks):
        lines.append(
            f"  Block {i}: label={block.label!r}, structure={block.structure!r}, "
            f"rounds={block.rounds}"
        )
        for j, ex in enumerate(block.exercises):
            lines.append(
                f"    Ex {j}: {ex.name!r} sets={ex.sets} reps={ex.reps} "
                f"reps_range={ex.reps_range!r} distance_m={ex.distance_m} "
                f"distance_range={ex.distance_range!r} type={ex.type!r}"
            )
        for k, ss in enumerate(block.supersets):
            lines.append(f"    Superset {k}:")
            for j, ex in enumerate(ss.exercises):
                lines.append(
                    f"      Ex {j}: {ex.name!r} sets={ex.sets} reps={ex.reps} "
                    f"distance_m={ex.distance_m} type={ex.type!r}"
                )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Scenario 1: Strength + Cardio Finisher (labeled supersets + rounds)
# ---------------------------------------------------------------------------

SCENARIO_1 = """\
A1: Bench Press 4x8
A2: DB Row 4x10
B1: Incline DB Press 3x12
B2: Cable Face Pull 3x15

Finisher - 3 Rounds:
- 200m Row
- 10 Burpees
- 15 Box Jumps
"""


class TestScenario1StrengthCardioFinisher:
    """Labeled supersets (A1/A2, B1/B2) plus a cardio finisher with rounds."""

    @pytest.fixture(autouse=True)
    def parse(self):
        self.workout = ParserService.parse_free_text_to_workout(SCENARIO_1, source="test")
        self.exercises = all_exercises(self.workout)
        self.names = [ex.name.lower() for ex in self.exercises]

    def test_parse_succeeds(self):
        assert self.workout is not None
        assert len(self.workout.blocks) > 0, dump_workout(self.workout)

    def test_exercise_count(self):
        # 4 labeled + 3 finisher = 7 exercises total
        assert len(self.exercises) == 7, (
            f"Expected 7 exercises, got {len(self.exercises)}: {self.names}\n"
            f"{dump_workout(self.workout)}"
        )

    def test_labeled_exercises_present(self):
        assert any("bench press" in n for n in self.names)
        assert any("row" in n for n in self.names)
        assert any("incline" in n for n in self.names)
        assert any("face pull" in n for n in self.names)

    def test_finisher_exercises_present(self):
        assert any("burpee" in n for n in self.names)
        assert any("box jump" in n for n in self.names)

    def test_bench_press_reps(self):
        bench = [ex for ex in self.exercises if "bench press" in ex.name.lower() and "incline" not in ex.name.lower()]
        assert len(bench) >= 1, f"No bench press found in {self.names}"
        assert bench[0].reps == 8

    @pytest.mark.xfail(reason="Parser does not extract sets from labeled 'NxM' pattern in superset grouping")
    def test_bench_press_sets_extracted(self):
        """Ideally sets=4 for 'Bench Press 4x8', but parser currently leaves sets=None."""
        bench = [ex for ex in self.exercises if "bench press" in ex.name.lower() and "incline" not in ex.name.lower()]
        assert bench[0].sets == 4

    def test_row_distance(self):
        row_ex = [ex for ex in self.exercises if "row" in ex.name.lower() and "db" not in ex.name.lower() and "barbell" not in ex.name.lower()]
        assert len(row_ex) >= 1, f"No row exercise found in {self.names}"
        assert row_ex[0].distance_m == 200

    def test_finisher_block_has_rounds_structure(self):
        # The finisher block should have structure containing 'rounds'
        finisher_blocks = [b for b in self.workout.blocks if b.label and "finisher" in b.label.lower()]
        assert len(finisher_blocks) >= 1, f"No finisher block found in {dump_workout(self.workout)}"
        assert "round" in (finisher_blocks[0].structure or "").lower()


# ---------------------------------------------------------------------------
# Scenario 2: CrossFit-style WOD
# ---------------------------------------------------------------------------

SCENARIO_2 = """\
Warm Up:
- 400m Run
- 20 Air Squats
- 10 Push-ups

WOD - AMRAP 20 min:
- 5 Pull-ups
- 10 Push-ups
- 15 Air Squats

Strength:
Back Squat 5x5 @RPE8
"""


class TestScenario2CrossFitWOD:
    """CrossFit-style with warm-up, AMRAP WOD, and strength section."""

    @pytest.fixture(autouse=True)
    def parse(self):
        self.workout = ParserService.parse_free_text_to_workout(SCENARIO_2, source="test")
        self.exercises = all_exercises(self.workout)
        self.names = [ex.name.lower() for ex in self.exercises]

    def test_parse_succeeds(self):
        assert self.workout is not None
        assert len(self.workout.blocks) > 0, dump_workout(self.workout)

    def test_exercise_count(self):
        # Warm Up: 3, WOD: 3, Strength: 1 = 7 total
        assert len(self.exercises) == 7, (
            f"Expected 7 exercises, got {len(self.exercises)}: {self.names}\n"
            f"{dump_workout(self.workout)}"
        )

    def test_warm_up_exercises(self):
        assert any("run" in n for n in self.names)
        assert any("air squat" in n for n in self.names)

    def test_back_squat_present(self):
        # Parser may include "Back Squat" or "Back Squat 5x5 @RPE8"
        assert any("back squat" in n or "squat" in n for n in self.names), (
            f"No back squat found in {self.names}"
        )

    def test_back_squat_reps(self):
        squat = [ex for ex in self.exercises if "back squat" in ex.name.lower() or
                 ("squat" in ex.name.lower() and "air" not in ex.name.lower())]
        assert len(squat) >= 1, f"No back squat found in {self.names}"
        assert squat[0].reps == 5

    def test_no_headers_as_exercises(self):
        for name in self.names:
            clean = name.strip()
            assert clean not in ("warm up", "wod", "strength"), (
                f"Header '{name}' incorrectly parsed as exercise"
            )

    def test_run_has_distance(self):
        run_ex = [ex for ex in self.exercises if "run" in ex.name.lower()]
        if run_ex:
            assert run_ex[0].distance_m is not None, "400m Run should have distance_m set"


# ---------------------------------------------------------------------------
# Scenario 3: Multi-section with time and distance
# ---------------------------------------------------------------------------

SCENARIO_3 = """\
Push Day

Bench Press 4x6-8
Incline DB Press 3x10-12
Cable Flyes 3x15
Lateral Raises 4x12
Tricep Pushdowns 3x12

Cardio:
- Bike 5km
- Run 1.5km
"""


class TestScenario3PushDayWithCardio:
    """Push day with range-reps and km-distance cardio section.

    Known parser limitations:
    - "Push Day" is parsed as an exercise (should be a title/header)
    - km distances are stored as raw numbers (5, not 5000)
    - Sets not extracted from "NxM" pattern
    """

    @pytest.fixture(autouse=True)
    def parse(self):
        self.workout = ParserService.parse_free_text_to_workout(SCENARIO_3, source="test")
        self.exercises = all_exercises(self.workout)
        self.names = [ex.name.lower() for ex in self.exercises]

    def test_parse_succeeds(self):
        assert self.workout is not None
        assert len(self.workout.blocks) > 0

    def test_exercise_count(self):
        # Parser currently produces 8 exercises (including "Push Day" as exercise)
        # Ideal would be 7 (without the header)
        # Actual: Push Day, Bench Press, Incline DB Press, Cable Flyes,
        #         Lateral Raises, Tricep Pushdowns, Bike, Run = 8
        actual_count = len(self.exercises)
        assert actual_count >= 7, (
            f"Expected at least 7 exercises, got {actual_count}: {self.names}\n"
            f"{dump_workout(self.workout)}"
        )

    @pytest.mark.xfail(reason="Parser treats 'Push Day' as an exercise instead of a section header")
    def test_push_day_not_exercise(self):
        for name in self.names:
            assert "push day" not in name, f"'Push Day' header incorrectly parsed as exercise"

    def test_reps_range_parsed(self):
        # Find bench press or incline that has range
        range_ex = [ex for ex in self.exercises if ex.reps_range is not None]
        assert len(range_ex) >= 1, (
            f"No exercises with reps_range found. All exercises: "
            f"{[(ex.name, ex.reps_range) for ex in self.exercises]}"
        )

    def test_cardio_exercises_present(self):
        assert any("bike" in n for n in self.names)
        assert any("run" in n for n in self.names)

    def test_bike_has_distance(self):
        bike = [ex for ex in self.exercises if "bike" in ex.name.lower()]
        assert len(bike) >= 1
        assert bike[0].distance_m is not None, f"Bike should have distance, got {bike[0]}"

    @pytest.mark.xfail(reason="Parser stores km as raw number (5) not meters (5000)")
    def test_bike_distance_in_meters(self):
        """5km should be stored as 5000m, but parser currently stores 5."""
        bike = [ex for ex in self.exercises if "bike" in ex.name.lower()]
        assert bike[0].distance_m == 5000

    def test_cardio_not_exercise(self):
        for name in self.names:
            assert name.strip() != "cardio", f"'Cardio' header incorrectly parsed as exercise"


# ---------------------------------------------------------------------------
# Scenario 4: Superset-heavy with rounds
# ---------------------------------------------------------------------------

SCENARIO_4 = """\
Pull-ups 4x8 + Dips 4x10
DB Curl 3x12 + Tricep Extension 3x12
Face Pulls 3x15

4 Rounds
- 500m Row
- 20 KB Swings
- 15 Box Jumps
- 200m Run
"""


class TestScenario4SupersetsAndRounds:
    """Plus-sign supersets and a rounds section.

    Known parser limitation:
    - "Pull-ups 4x8 + Dips 4x10" is parsed as a single exercise
      instead of being split into two superset exercises.
    """

    @pytest.fixture(autouse=True)
    def parse(self):
        self.workout = ParserService.parse_free_text_to_workout(SCENARIO_4, source="test")
        self.exercises = all_exercises(self.workout)
        self.names = [ex.name.lower() for ex in self.exercises]

    def test_parse_succeeds(self):
        assert self.workout is not None
        assert len(self.workout.blocks) > 0

    def test_exercise_count(self):
        # Parser treats "X + Y" as one exercise:
        # "Pull-ups 4x8 + Dips 4x10", "DB Curl 3x12 + Tricep Extension 3x12",
        # Face Pulls, Row, KB Swings, Box Jumps, Run = 7
        assert len(self.exercises) == 7, (
            f"Expected 7 exercises, got {len(self.exercises)}: {self.names}\n"
            f"{dump_workout(self.workout)}"
        )

    def test_face_pulls_present(self):
        assert any("face pull" in n for n in self.names)

    def test_rounds_exercises_present(self):
        assert any("kb swing" in n or "kettlebell" in n for n in self.names)
        assert any("box jump" in n for n in self.names)

    def test_rounds_header_not_exercise(self):
        for name in self.names:
            assert "4 rounds" not in name and name.strip() != "rounds", (
                f"'4 Rounds' header incorrectly parsed as exercise"
            )

    def test_row_has_distance(self):
        row_ex = [ex for ex in self.exercises if "row" in ex.name.lower()]
        assert len(row_ex) >= 1
        assert row_ex[0].distance_m == 500

    def test_run_has_distance(self):
        run_ex = [ex for ex in self.exercises if "run" in ex.name.lower()]
        assert len(run_ex) >= 1
        assert run_ex[0].distance_m == 200

    @pytest.mark.xfail(reason="Parser does not split 'X + Y' into separate superset exercises")
    def test_plus_supersets_split(self):
        """Ideally 'Pull-ups 4x8 + Dips 4x10' should become two exercises."""
        assert any("dip" in n and "+" not in n for n in self.names)

    def test_block_has_rounds_structure(self):
        # Should have a block with rounds structure
        has_rounds = any(
            b.structure and "round" in b.structure.lower()
            for b in self.workout.blocks
        )
        assert has_rounds, dump_workout(self.workout)


# ---------------------------------------------------------------------------
# Scenario 5: Minimalist format (no bullets/numbers)
# ---------------------------------------------------------------------------

SCENARIO_5 = """\
Squats 5x5
Deadlift 3x5
Bench Press 5x5
Barbell Row 5x5
Overhead Press 5x5
"""


class TestScenario5Minimalist:
    """Plain NxM format without any bullets, numbers, or section headers."""

    @pytest.fixture(autouse=True)
    def parse(self):
        self.workout = ParserService.parse_free_text_to_workout(SCENARIO_5, source="test")
        self.exercises = all_exercises(self.workout)
        self.names = [ex.name.lower() for ex in self.exercises]

    def test_parse_succeeds(self):
        assert self.workout is not None

    def test_exercise_count(self):
        assert len(self.exercises) == 5, (
            f"Expected 5 exercises, got {len(self.exercises)}: {self.names}\n"
            f"{dump_workout(self.workout)}"
        )

    def test_all_exercises_present(self):
        assert any("squat" in n for n in self.names)
        assert any("deadlift" in n for n in self.names)
        assert any("bench press" in n for n in self.names)
        assert any("row" in n for n in self.names)
        assert any("overhead press" in n or "press" in n for n in self.names)

    def test_reps_correct(self):
        for ex in self.exercises:
            assert ex.reps == 5, f"{ex.name} expected reps=5, got {ex.reps}"

    @pytest.mark.xfail(reason="Parser only extracts reps from 'NxM', not sets (sets left as None)")
    def test_sets_extracted(self):
        """Ideally 'Squats 5x5' should give sets=5, reps=5."""
        for ex in self.exercises:
            expected_sets = 3 if "deadlift" in ex.name.lower() else 5
            assert ex.sets == expected_sets, f"{ex.name} expected sets={expected_sets}, got {ex.sets}"


# ---------------------------------------------------------------------------
# Scenario 6: Hashtag-heavy Instagram caption
# ---------------------------------------------------------------------------

SCENARIO_6 = """\
Leg Day \U0001f525

1. Barbell Back Squats 5x5
2. Romanian Deadlifts 4x10
3. Walking Lunges 3x20
4. Leg Press 4x12
5. Calf Raises 4x15

#legday #fitness #gym #workout #gains #neverskiplegday #quadgoals
"""


class TestScenario6InstagramHashtags:
    """Instagram caption with numbered exercises, emojis, and hashtag line.

    Known parser limitations:
    - "Leg Day" header is parsed as an exercise
    - Hashtag line is parsed as an exercise
    - Number prefixes (1., 2.) kept in exercise names
    """

    @pytest.fixture(autouse=True)
    def parse(self):
        self.workout = ParserService.parse_free_text_to_workout(SCENARIO_6, source="test")
        self.exercises = all_exercises(self.workout)
        self.names = [ex.name.lower() for ex in self.exercises]

    def test_parse_succeeds(self):
        assert self.workout is not None

    def test_real_exercises_present(self):
        """Core exercises should be found regardless of extra noise."""
        assert any("squat" in n for n in self.names)
        assert any("deadlift" in n for n in self.names)
        assert any("lunge" in n for n in self.names)
        assert any("leg press" in n for n in self.names)
        assert any("calf" in n for n in self.names)

    def test_exercise_count(self):
        # Parser currently produces 7: Leg Day + 5 exercises + hashtag line
        # Acceptable range: 5 (ideal) to 7 (current behavior)
        actual = len(self.exercises)
        assert actual >= 5, (
            f"Expected at least 5 exercises, got {actual}: {self.names}\n"
            f"{dump_workout(self.workout)}"
        )

    @pytest.mark.xfail(reason="Parser does not filter out hashtag lines as junk")
    def test_no_hashtags_as_exercises(self):
        for name in self.names:
            assert "#" not in name, f"Hashtag found in exercise name: {name}"

    @pytest.mark.xfail(reason="Parser treats 'Leg Day' as an exercise rather than a header")
    def test_leg_day_not_exercise(self):
        for name in self.names:
            assert "leg day" not in name, f"Header 'Leg Day' in exercise: {name}"

    def test_reps_extracted(self):
        squats = [ex for ex in self.exercises if "squat" in ex.name.lower()]
        if squats:
            assert squats[0].reps == 5


# ---------------------------------------------------------------------------
# Scenario 7: EMOM/Tabata format
# ---------------------------------------------------------------------------

SCENARIO_7 = """\
EMOM 12 min:
- Odd: 8 Power Cleans
- Even: 12 Wall Balls

Rest 3 min

Tabata - 8 Rounds:
- 20s Assault Bike
- 10s Rest
"""


class TestScenario7EMOMTabata:
    """EMOM and Tabata blocks with interval timing.

    Known parser limitations:
    - "Odd: 8 Power Cleans" is treated as a block label, not an exercise
    - "Even:" prefix remains in exercise name as "E: 12 Wall Balls"
    - "EMOM 12 min:" is parsed as an exercise in a superset
    - Power Cleans is completely lost (becomes block label only)
    """

    @pytest.fixture(autouse=True)
    def parse(self):
        self.workout = ParserService.parse_free_text_to_workout(SCENARIO_7, source="test")
        self.exercises = all_exercises(self.workout)
        self.names = [ex.name.lower() for ex in self.exercises]

    def test_parse_succeeds(self):
        assert self.workout is not None
        assert len(self.workout.blocks) > 0

    @pytest.mark.xfail(reason="Parser treats 'Odd: 8 Power Cleans' as block label, losing it as an exercise")
    def test_power_cleans_present(self):
        assert any("power clean" in n for n in self.names), (
            f"Power Cleans not found in {self.names}\n{dump_workout(self.workout)}"
        )

    def test_wall_balls_present(self):
        # Parser produces "E: 12 Wall Balls" — still contains "wall ball"
        assert any("wall ball" in n for n in self.names), (
            f"Wall Balls not found in {self.names}\n{dump_workout(self.workout)}"
        )

    def test_assault_bike_present(self):
        assert any("assault bike" in n or "bike" in n for n in self.names), (
            f"Assault Bike not found in {self.names}\n{dump_workout(self.workout)}"
        )

    def test_headers_not_exercises(self):
        for name in self.names:
            clean = name.strip()
            assert clean not in ("emom", "tabata"), (
                f"Header '{name}' incorrectly parsed as exercise"
            )

    def test_tabata_block_has_rounds(self):
        tabata_blocks = [b for b in self.workout.blocks if b.label and "tabata" in b.label.lower()]
        assert len(tabata_blocks) >= 1, f"No tabata block found in {dump_workout(self.workout)}"
        assert "round" in (tabata_blocks[0].structure or "").lower()


# ---------------------------------------------------------------------------
# Scenario 8: Distance-only workout (swimming)
# ---------------------------------------------------------------------------

SCENARIO_8 = """\
Swimming Session
- 200m Freestyle
- 100m Backstroke
- 4x50m Sprint
- 200m Cool Down
"""


class TestScenario8SwimmingDistances:
    """Swimming workout with distance-only exercises.

    Known parser limitation:
    - "Swimming Session" is parsed as an exercise (should be title/header)
    """

    @pytest.fixture(autouse=True)
    def parse(self):
        self.workout = ParserService.parse_free_text_to_workout(SCENARIO_8, source="test")
        self.exercises = all_exercises(self.workout)
        self.names = [ex.name.lower() for ex in self.exercises]

    def test_parse_succeeds(self):
        assert self.workout is not None

    def test_swimming_exercises_present(self):
        assert any("freestyle" in n for n in self.names)
        assert any("backstroke" in n for n in self.names)
        assert any("sprint" in n for n in self.names)
        assert any("cool down" in n for n in self.names)

    def test_exercise_count(self):
        # Parser currently produces 5 (including "Swimming Session" as exercise)
        actual = len(self.exercises)
        assert actual >= 4, (
            f"Expected at least 4 exercises, got {actual}: {self.names}\n"
            f"{dump_workout(self.workout)}"
        )

    @pytest.mark.xfail(reason="Parser treats 'Swimming Session' as an exercise")
    def test_swimming_session_not_exercise(self):
        for name in self.names:
            assert "swimming session" not in name

    def test_freestyle_distance(self):
        freestyle = [ex for ex in self.exercises if "freestyle" in ex.name.lower()]
        assert len(freestyle) >= 1, f"Freestyle not found in {self.names}"
        assert freestyle[0].distance_m == 200

    def test_backstroke_distance(self):
        backstroke = [ex for ex in self.exercises if "backstroke" in ex.name.lower()]
        assert len(backstroke) >= 1, f"Backstroke not found in {self.names}"
        assert backstroke[0].distance_m == 100

    def test_sprint_parsed(self):
        sprint = [ex for ex in self.exercises if "sprint" in ex.name.lower()]
        assert len(sprint) >= 1, f"Sprint not found in {self.names}"
        # 4x50m: should have distance=50
        if sprint[0].distance_m is not None:
            assert sprint[0].distance_m == 50


# ---------------------------------------------------------------------------
# Scenario 9: Messy real-world caption with emojis and extra text
# ---------------------------------------------------------------------------

SCENARIO_9 = """\
Monday workout \U0001f4aa

Did this one today and my legs are DEAD

- Barbell Back Squats 5x5
- Barbell Reverse Lunges 4x20

5 Rounds
- Rowing 500m
- Run 500m
- Walking Lunges 25m

Try this and let me know! \U0001f64c
Save for later \u2764\ufe0f
Follow @fitnessguru for more
"""


class TestScenario9MessyCaption:
    """Instagram caption with commentary, emojis, and CTA junk.

    Known parser limitations:
    - "Try this and let me know!" parsed as exercise
    - "Did this one today..." parsed as exercise
    - Commentary not properly filtered as junk
    """

    @pytest.fixture(autouse=True)
    def parse(self):
        self.workout = ParserService.parse_free_text_to_workout(SCENARIO_9, source="test")
        self.exercises = all_exercises(self.workout)
        self.names = [ex.name.lower() for ex in self.exercises]

    def test_parse_succeeds(self):
        assert self.workout is not None

    def test_real_exercises_present(self):
        """Core exercises should always be found."""
        assert any("squat" in n for n in self.names), f"Squats not in {self.names}"
        assert any("lunge" in n for n in self.names), f"Lunges not in {self.names}"

    def test_rowing_present(self):
        assert any("row" in n for n in self.names), f"Rowing not in {self.names}"

    def test_run_present(self):
        assert any("run" in n for n in self.names), f"Run not in {self.names}"

    def test_rowing_has_distance(self):
        rowing = [ex for ex in self.exercises if "row" in ex.name.lower()]
        if rowing:
            assert rowing[0].distance_m == 500

    def test_run_has_distance(self):
        run = [ex for ex in self.exercises if "run" in ex.name.lower()]
        if run:
            assert run[0].distance_m == 500

    @pytest.mark.xfail(reason="Parser does not filter social media CTA text as junk")
    def test_no_junk_exercises(self):
        for name in self.names:
            assert "follow" not in name, f"Social text in exercise: {name}"
            assert "try this" not in name, f"Social text in exercise: {name}"
            assert "let me know" not in name, f"Social text in exercise: {name}"
            assert "dead" not in name, f"Commentary in exercise: {name}"

    @pytest.mark.xfail(reason="Parser includes commentary lines as exercises, count exceeds ideal 5")
    def test_exercise_count_ideal(self):
        """Ideally: Squats, Reverse Lunges, Rowing, Run, Walking Lunges = 5."""
        assert len(self.exercises) == 5, (
            f"Expected 5 exercises, got {len(self.exercises)}: {self.names}"
        )


# ---------------------------------------------------------------------------
# Scenario 10: Mixed units (meters, km, miles)
# ---------------------------------------------------------------------------

SCENARIO_10 = """\
Triathlon Training
- Swim 750m
- Bike 20km
- Run 5km

Brick Workout:
- Bike 40km
- Run 10km
"""


class TestScenario10MixedUnits:
    """Distance exercises with meters and kilometers.

    Known parser limitations:
    - "Triathlon Training" parsed as exercise (should be header)
    - km distances stored as raw number (20) not meters (20000)
    """

    @pytest.fixture(autouse=True)
    def parse(self):
        self.workout = ParserService.parse_free_text_to_workout(SCENARIO_10, source="test")
        self.exercises = all_exercises(self.workout)
        self.names = [ex.name.lower() for ex in self.exercises]

    def test_parse_succeeds(self):
        assert self.workout is not None

    def test_real_exercises_present(self):
        assert any("swim" in n for n in self.names)
        assert any("bike" in n for n in self.names)
        assert any("run" in n for n in self.names)

    def test_exercise_count(self):
        # Parser produces 6: Triathlon Training + 5 real exercises
        actual = len(self.exercises)
        assert actual >= 5, (
            f"Expected at least 5 exercises, got {actual}: {self.names}\n"
            f"{dump_workout(self.workout)}"
        )

    @pytest.mark.xfail(reason="Parser treats 'Triathlon Training' as an exercise")
    def test_triathlon_training_not_exercise(self):
        for name in self.names:
            assert "triathlon training" not in name

    def test_swim_distance(self):
        swim = [ex for ex in self.exercises if "swim" in ex.name.lower()]
        assert len(swim) >= 1, f"Swim not found in {self.names}"
        assert swim[0].distance_m == 750

    def test_all_distances_populated(self):
        """All real exercises (swim/bike/run) should have some distance_m value."""
        real_exercises = [ex for ex in self.exercises if
                         any(w in ex.name.lower() for w in ("swim", "bike", "run"))]
        for ex in real_exercises:
            assert ex.distance_m is not None, (
                f"{ex.name} should have distance_m set, got None"
            )

    @pytest.mark.xfail(reason="Parser stores km as raw number not meters (20km -> 20 instead of 20000)")
    def test_km_converted_to_meters(self):
        bikes = [ex for ex in self.exercises if "bike" in ex.name.lower()]
        distances = [b.distance_m for b in bikes if b.distance_m is not None]
        assert 20000 in distances or 40000 in distances

    @pytest.mark.xfail(reason="Parser stores km as raw number not meters (5km -> 5 instead of 5000)")
    def test_run_distances_in_meters(self):
        runs = [ex for ex in self.exercises if "run" in ex.name.lower()]
        distances = [r.distance_m for r in runs if r.distance_m is not None]
        assert 5000 in distances or 10000 in distances

    def test_no_brick_workout_as_exercise(self):
        for name in self.names:
            assert "brick workout" not in name, (
                f"'Brick Workout' header incorrectly parsed as exercise"
            )
