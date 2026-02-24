
from workout_ingestor_api.services.parser_service import ParserService


class TestParserService:
    def test_parse_simple_workout_smoke(self):
        """
        Smoke test: ensure free-text parsing returns a workout object
        with a non-empty title and a blocks list.

        We intentionally avoid asserting on the exact block/exercise
        structure because the parsing heuristics are evolving.
        """
        text = """
        STRENGTH

        A1: Bench Press X10
        A2: Squat X10
        """

        workout = ParserService.parse_free_text_to_workout(text)

        # Basic sanity checks
        assert workout is not None
        assert isinstance(workout.title, str)
        assert workout.title.strip() != ""

        # Blocks should be a list (may be empty or partially populated)
        assert hasattr(workout, "blocks")
        assert isinstance(workout.blocks, list)
