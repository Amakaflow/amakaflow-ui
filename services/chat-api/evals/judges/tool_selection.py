"""Deterministic judge for tool selection evals.

Checks whether the AI selected the correct tool. No LLM call needed.
"""

from evals.judges.base import BaseJudge
from evals.models import CriterionScore, EvalCase, JudgeResult


class ToolSelectionJudge(BaseJudge):
    """Deterministic judge: did the AI pick the right tool?"""

    def judge(
        self,
        case: EvalCase,
        response_text: str,
        tool_called: str | None = None,
    ) -> JudgeResult:
        criteria = []

        # Criterion 1: correct tool selected
        correct_tool = tool_called == case.expected_tool
        criteria.append(CriterionScore(
            key="correct_tool",
            score=1.0 if correct_tool else 0.0,
            explanation=(
                f"Expected '{case.expected_tool}', got '{tool_called}'"
                if not correct_tool
                else "Correct tool selected"
            ),
        ))

        # Criterion 2: didn't call a forbidden tool
        avoided_forbidden = True
        if case.not_tools and tool_called:
            if tool_called in case.not_tools:
                avoided_forbidden = False
                criteria.append(CriterionScore(
                    key="avoided_forbidden",
                    score=0.0,
                    explanation=f"Called forbidden tool '{tool_called}' (not_tools: {case.not_tools})",
                ))
            else:
                criteria.append(CriterionScore(
                    key="avoided_forbidden",
                    score=1.0,
                    explanation="Avoided all forbidden tools",
                ))

        # Overall: both criteria must pass
        passed = correct_tool and avoided_forbidden
        score = sum(c.score for c in criteria) / len(criteria) if criteria else 0.0

        return JudgeResult(
            case_id=case.id,
            score=score,
            passed=passed,
            criteria=criteria,
            response_text=response_text,
            tool_called=tool_called,
        )
