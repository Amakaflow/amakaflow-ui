import pytest
from backend.services.cost_estimator import estimate_cost


def test_haiku_cost():
    # haiku: $0.80/1M input, $4.00/1M output
    # (1000 * 0.80/1e6) + (500 * 4.00/1e6) = 0.0008 + 0.002 = 0.0028
    cost = estimate_cost(model="haiku", input_tokens=1000, output_tokens=500)
    assert cost == pytest.approx(0.0028, rel=1e-6)


def test_sonnet_cost():
    # sonnet: $3.00/1M input, $15.00/1M output
    # (2000 * 3.00/1e6) + (1000 * 15.00/1e6) = 0.006 + 0.015 = 0.021
    cost = estimate_cost(model="sonnet", input_tokens=2000, output_tokens=1000)
    assert cost == pytest.approx(0.021, rel=1e-6)


def test_opus_cost():
    # opus: $15.00/1M input, $75.00/1M output
    # (500 * 15.00/1e6) + (200 * 75.00/1e6) = 0.0075 + 0.015 = 0.0225
    cost = estimate_cost(model="opus", input_tokens=500, output_tokens=200)
    assert cost == pytest.approx(0.0225, rel=1e-6)


def test_unknown_model_falls_back_to_sonnet():
    # Should use sonnet pricing: $3.00/1M input, $15.00/1M output
    # (100 * 3.00/1e6) + (50 * 15.00/1e6) = 0.0003 + 0.00075 = 0.00105
    cost = estimate_cost(model="unknown-model", input_tokens=100, output_tokens=50)
    assert cost == pytest.approx(0.00105, rel=1e-6)


def test_zero_tokens():
    assert estimate_cost(model="haiku", input_tokens=0, output_tokens=0) == 0.0
