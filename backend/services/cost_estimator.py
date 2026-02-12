"""Estimate USD cost from token counts and model name.

Pricing is per-token (not per 1K tokens). Update values when Anthropic
changes pricing. Fallback to Sonnet pricing for unknown models.
"""

# Per-token pricing (USD) — update when pricing changes
MODEL_PRICING: dict[str, dict[str, float]] = {
    "haiku": {"input": 0.80 / 1_000_000, "output": 4.00 / 1_000_000},
    "sonnet": {"input": 3.00 / 1_000_000, "output": 15.00 / 1_000_000},
    "opus": {"input": 15.00 / 1_000_000, "output": 75.00 / 1_000_000},
}

_DEFAULT_MODEL = "sonnet"


def estimate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """Return estimated USD cost for a given model and token counts."""
    pricing = MODEL_PRICING.get(model, MODEL_PRICING[_DEFAULT_MODEL])
    return (input_tokens * pricing["input"]) + (output_tokens * pricing["output"])
