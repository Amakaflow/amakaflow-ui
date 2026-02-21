"""LLM-powered knowledge enrichment service (AMA-658).

Provides three operations for Knowledge Base cards:
  - summarize: generate summary, micro_summary, and key takeaways
  - discover_tags: suggest typed tags from content
  - judge_relationships: score relationships between cards

All methods use the AsyncAIClient stream_chat interface, collecting
content_delta events into a complete response before JSON-parsing.
"""

import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Model constants
_SONNET_MODEL = "claude-sonnet-4-6"
_HAIKU_MODEL = "claude-haiku-4-5-20251001"

# Valid tag types — mirrors the KB design
_VALID_TAG_TYPES = {
    "topic",
    "muscle_group",
    "equipment",
    "methodology",
    "sport",
    "movement_pattern",
    "goal",
}

# Relationship types that match the DB CHECK constraint
_VALID_RELATIONSHIP_TYPES = {
    "related_to",
    "builds_on",
    "contradicts",
    "same_topic",
    "cites",
}

# Minimum confidence to include a relationship result
_RELATIONSHIP_CONFIDENCE_THRESHOLD = 0.6


async def _collect_stream(stream) -> str:
    """Collect all content_delta text events from an async stream into a string.

    Args:
        stream: AsyncGenerator[StreamEvent, None] from AsyncAIClient.stream_chat.

    Returns:
        Concatenated text from all content_delta events.
    """
    parts: List[str] = []
    async for event in stream:
        if event.event == "content_delta":
            text = event.data.get("text", "")
            if text:
                parts.append(text)
    return "".join(parts)


def _parse_json_safe(raw: str, default: Any) -> Any:
    """Parse JSON from raw string, returning default on any failure.

    Args:
        raw: Raw string that should contain JSON.
        default: Value to return if parsing fails.

    Returns:
        Parsed object or default.
    """
    try:
        return json.loads(raw.strip())
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Failed to parse LLM JSON response: %s | raw=%r", exc, raw[:200])
        return default


class KnowledgeLLMService:
    """LLM-powered enrichment for Knowledge Base cards.

    Uses AsyncAIClient (stream_chat) internally. All three methods are async
    and safe to call concurrently.

    Args:
        ai_client: An AsyncAIClient instance (or any object with a compatible
                   async stream_chat method).
    """

    def __init__(self, ai_client: Any) -> None:
        self._client = ai_client

    async def summarize(self, content: str) -> Dict[str, Any]:
        """Summarize fitness content using Claude Sonnet.

        Generates a 2-3 sentence summary, a short micro_summary for watch
        display (≤100 chars), and 3-5 key takeaway bullet points.

        Args:
            content: Raw fitness content text to summarize.

        Returns:
            Dict with keys:
              - "summary" (str): 2-3 sentence paragraph.
              - "micro_summary" (str): ≤100 character teaser.
              - "key_takeaways" (list[str]): 3-5 concise bullet points.

            On parse failure returns safe defaults with empty/minimal values.
        """
        system_prompt = (
            "You are a fitness and health knowledge assistant. "
            "You specialize in summarizing exercise science, training methodologies, "
            "nutrition, and wellness content for athletes and fitness enthusiasts. "
            "Always respond with valid JSON only — no markdown fences, no extra text."
        )

        user_prompt = (
            "Summarize the following fitness content. "
            "Return a JSON object with exactly these keys:\n"
            '  "summary": a 2-3 sentence paragraph capturing the main ideas,\n'
            '  "micro_summary": a single sentence of at most 100 characters suitable '
            "for a smartwatch display (truncate if needed),\n"
            '  "key_takeaways": a list of 3 to 5 concise bullet-point strings.\n\n'
            "Respond with valid JSON only. No markdown code fences.\n\n"
            f"Content:\n{content}"
        )

        messages = [{"role": "user", "content": user_prompt}]

        stream = self._client.stream_chat(
            messages=messages,
            system=system_prompt,
            model=_SONNET_MODEL,
            max_tokens=1024,
        )

        raw = await _collect_stream(stream)

        default = {
            "summary": "",
            "micro_summary": "",
            "key_takeaways": [],
        }
        result = _parse_json_safe(raw, default)

        if not isinstance(result, dict):
            return default

        # Enforce micro_summary length constraint (watch display limit)
        micro = result.get("micro_summary", "")
        if isinstance(micro, str) and len(micro) > 100:
            result["micro_summary"] = micro[:100]

        # Ensure all expected keys are present
        result.setdefault("summary", "")
        result.setdefault("micro_summary", "")
        result.setdefault("key_takeaways", [])

        return result

    async def discover_tags(
        self, content: str, existing_tags: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Suggest typed tags for fitness content using Claude Haiku.

        Prefers reusing tags the user already has over creating new ones.
        Returns 3-8 tags, each with a name, type, and confidence score.

        Args:
            content: Raw fitness content text to tag.
            existing_tags: Tag names the user already has (prefer these).

        Returns:
            List of dicts, each with:
              - "name" (str): Tag name (may match an existing tag).
              - "tag_type" (str): One of: topic, muscle_group, equipment,
                methodology, sport, movement_pattern, goal.
              - "confidence" (float): 0.0–1.0.

            On parse failure returns an empty list.
        """
        existing_tags = existing_tags or []
        existing_section = (
            f"The user already has these tags (prefer reusing them over creating new ones):\n"
            f"{', '.join(existing_tags)}\n\n"
            if existing_tags
            else ""
        )

        system_prompt = (
            "You are a fitness taxonomy expert. "
            "You tag fitness and health content with precise, reusable labels. "
            "Always respond with valid JSON only — no markdown fences, no extra text."
        )

        user_prompt = (
            f"{existing_section}"
            "Analyse the following fitness content and return a JSON array of 3 to 8 tags.\n"
            "Each tag must be an object with exactly these keys:\n"
            '  "name": the tag label (string, lowercase, hyphen-separated if multi-word),\n'
            '  "tag_type": one of: topic, muscle_group, equipment, methodology, '
            "sport, movement_pattern, goal,\n"
            '  "confidence": a float between 0.0 and 1.0 indicating certainty.\n\n'
            "Prefer matching existing user tags where applicable. "
            "Respond with a JSON array only. No markdown code fences.\n\n"
            f"Content:\n{content}"
        )

        messages = [{"role": "user", "content": user_prompt}]

        stream = self._client.stream_chat(
            messages=messages,
            system=system_prompt,
            model=_HAIKU_MODEL,
            max_tokens=512,
        )

        raw = await _collect_stream(stream)
        result = _parse_json_safe(raw, [])

        if not isinstance(result, list):
            return []

        # Validate and normalise each tag entry
        validated: List[Dict[str, Any]] = []
        for item in result:
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            tag_type = item.get("tag_type")
            confidence = item.get("confidence")
            if not isinstance(name, str) or not name.strip():
                continue
            if tag_type not in _VALID_TAG_TYPES:
                tag_type = "topic"
            if not isinstance(confidence, (int, float)):
                confidence = 0.5
            confidence = max(0.0, min(1.0, float(confidence)))
            validated.append(
                {"name": name.strip(), "tag_type": tag_type, "confidence": confidence}
            )

        return validated

    async def judge_relationships(
        self, card_summary: str, candidate_cards: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Evaluate relationships between a card and a list of candidates.

        Uses Claude Haiku for cost efficiency. Filters out surface-level
        similarity and only returns genuinely related cards (confidence ≥ 0.6).

        Args:
            card_summary: Summary text of the source card.
            candidate_cards: List of dicts, each with "id" (str) and
                "summary" (str).

        Returns:
            List of dicts for candidates with confidence ≥ 0.6, each with:
              - "card_id" (str)
              - "relationship_type" (str): related_to | builds_on |
                contradicts | same_topic | cites
              - "confidence" (float): 0.0–1.0

            On parse failure returns an empty list.
        """
        if not candidate_cards:
            return []

        candidates_text = "\n".join(
            f'- id: "{c.get("id", "")}" | summary: {c.get("summary", "")}'
            for c in candidate_cards
        )

        system_prompt = (
            "You are a fitness knowledge graph specialist. "
            "You evaluate whether two pieces of fitness content are genuinely related, "
            "filtering out surface-level keyword similarity. "
            "Always respond with valid JSON only — no markdown fences, no extra text."
        )

        user_prompt = (
            "Given the source card summary and a list of candidate cards, "
            "determine which candidates have a genuine relationship with the source.\n\n"
            "Return a JSON array. Include ONLY candidates with meaningful relationships "
            "(do not include low-confidence or surface-level similarity matches). "
            "For each included candidate provide:\n"
            '  "card_id": the candidate id string,\n'
            '  "relationship_type": one of: related_to, builds_on, contradicts, same_topic, cites,\n'
            '  "confidence": float 0.0–1.0.\n\n'
            "Respond with a JSON array only. No markdown code fences.\n\n"
            f"Source card summary:\n{card_summary}\n\n"
            f"Candidate cards:\n{candidates_text}"
        )

        messages = [{"role": "user", "content": user_prompt}]

        stream = self._client.stream_chat(
            messages=messages,
            system=system_prompt,
            model=_HAIKU_MODEL,
            max_tokens=512,
        )

        raw = await _collect_stream(stream)
        result = _parse_json_safe(raw, [])

        if not isinstance(result, list):
            return []

        # Validate, normalise, and filter by confidence threshold
        validated: List[Dict[str, Any]] = []
        for item in result:
            if not isinstance(item, dict):
                continue
            card_id = item.get("card_id")
            relationship_type = item.get("relationship_type")
            confidence = item.get("confidence")

            if not isinstance(card_id, str) or not card_id.strip():
                continue
            if relationship_type not in _VALID_RELATIONSHIP_TYPES:
                relationship_type = "related_to"
            if not isinstance(confidence, (int, float)):
                confidence = 0.5
            confidence = max(0.0, min(1.0, float(confidence)))

            # Filter: only include genuinely related cards
            if confidence < _RELATIONSHIP_CONFIDENCE_THRESHOLD:
                continue

            validated.append(
                {
                    "card_id": card_id.strip(),
                    "relationship_type": relationship_type,
                    "confidence": confidence,
                }
            )

        return validated
