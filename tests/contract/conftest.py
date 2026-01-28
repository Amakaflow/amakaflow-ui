"""Fixtures for contract tests.

Import fixtures from e2e conftest to reuse the fake infrastructure.
"""

# Re-export fixtures from e2e conftest so pytest discovers them
from tests.e2e.conftest import (
    app,
    client,
    ai_client,
    function_dispatcher,
    session_repo,
    message_repo,
    rate_limit_repo,
    embedding_repo,
    embedding_service,
    noauth_app,
    noauth_client,
    _reset_fakes,
)

# Make fixtures available to pytest
__all__ = [
    "app",
    "client",
    "ai_client",
    "function_dispatcher",
    "session_repo",
    "message_repo",
    "rate_limit_repo",
    "embedding_repo",
    "embedding_service",
    "noauth_app",
    "noauth_client",
    "_reset_fakes",
]
