"""Base judge interface."""

from abc import ABC, abstractmethod

from evals.models import EvalCase, JudgeResult


class BaseJudge(ABC):
    """Abstract base class for eval judges."""

    @abstractmethod
    def judge(self, case: EvalCase, response_text: str, tool_called: str | None = None) -> JudgeResult:
        """Score a single eval case.

        Args:
            case: The eval case with prompt and rubric.
            response_text: The AI's text response.
            tool_called: The tool/function the AI selected (if any).

        Returns:
            JudgeResult with score and details.
        """
        ...
