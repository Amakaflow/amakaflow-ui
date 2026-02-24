"""AmakaFlow chat-api evaluation framework.

LLM-as-judge scoring, golden datasets, and capability probes
for validating AI behavior in non-deterministic systems.

Usage:
    python -m evals.runner                          # Run all suites
    python -m evals.runner --suite tool-selection    # Run specific suite
    python -m evals.runner --threshold 80            # Fail if score < 80%
    python -m evals.runner --compare reports/last.json  # Compare against baseline
"""
