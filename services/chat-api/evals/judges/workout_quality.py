"""LLM-as-judge for workout quality evals.

Uses Claude Haiku to score generated workouts against rubric criteria.
"""

import json
import logging

import anthropic
from anthropic import APIError as AnthropicAPIError

from evals.config import DEFAULT_JUDGE_MODEL, WORKOUT_QUALITY_JUDGE_PROMPT
from evals.judges.base import BaseJudge
from evals.models import CriterionScore, EvalCase, JudgeResult

logger = logging.getLogger(__name__)


class WorkoutQualityJudge(BaseJudge):
    """LLM-as-judge for workout quality evaluation."""

    def __init__(self, model: str | None = None):
        self._model = model or DEFAULT_JUDGE_MODEL
        self._client = anthropic.Anthropic()

    def judge(
        self,
        case: EvalCase,
        response_text: str,
        tool_called: str | None = None,
    ) -> JudgeResult:
        rubric = case.rubric
        if not isinstance(rubric, dict):
            return JudgeResult(
                case_id=case.id,
                score=0.0,
                passed=False,
                error="Workout quality judge requires a dict rubric",
                response_text=response_text,
                tool_called=tool_called,
            )

        user_prompt = (
            f"## User Request\n{case.prompt}\n\n"
            f"## AI Response\n{response_text}\n\n"
            f"## Rubric\nScore each criterion:\n"
        )
        for key, description in rubric.items():
            user_prompt += f"- **{key}**: {description}\n"

        try:
            message = self._client.messages.create(
                model=self._model,
                max_tokens=1024,
                temperature=0,
                system=WORKOUT_QUALITY_JUDGE_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            raw = message.content[0].text.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()

            judge_output = json.loads(raw)
        except (json.JSONDecodeError, AnthropicAPIError, IndexError) as e:
            logger.warning("Judge failed for case %s: %s", case.id, e)
            return JudgeResult(
                case_id=case.id,
                score=0.0,
                passed=False,
                error=f"Judge error: {e}",
                response_text=response_text,
                tool_called=tool_called,
            )

        criteria = []
        criteria_data = judge_output.get("criteria", {})
        for key in rubric:
            entry = criteria_data.get(key, {})
            criteria.append(CriterionScore(
                key=key,
                score=float(entry.get("score", 0)),
                explanation=entry.get("explanation", ""),
            ))

        total = sum(c.score for c in criteria)
        avg_score = total / len(criteria) if criteria else 0.0

        return JudgeResult(
            case_id=case.id,
            score=avg_score,
            passed=avg_score >= 0.6,
            criteria=criteria,
            response_text=response_text,
            tool_called=tool_called,
        )
