"""
End-to-end tests for Helicone integration.

These tests make REAL API calls and should only run:
- Nightly in CI (not on every PR)
- Manually during development
- In staging environment

Requires real API keys:
- OPENAI_API_KEY
- ANTHROPIC_API_KEY (for Anthropic tests)
- HELICONE_API_KEY
- HELICONE_ENABLED=true
"""
import os
import uuid

import pytest


# Skip E2E tests unless explicitly enabled
pytestmark = pytest.mark.skipif(
    os.getenv("RUN_E2E_TESTS", "false").lower() != "true",
    reason="E2E tests disabled. Set RUN_E2E_TESTS=true to run.",
)


@pytest.fixture
def real_api_keys():
    """Verify real API keys are available."""
    openai_key = os.getenv("OPENAI_API_KEY")
    helicone_key = os.getenv("HELICONE_API_KEY")

    if not openai_key or openai_key.startswith("test"):
        pytest.skip("Real OPENAI_API_KEY required for E2E tests")
    if not helicone_key:
        pytest.skip("Real HELICONE_API_KEY required for E2E tests")

    return {"openai": openai_key, "helicone": helicone_key}


@pytest.fixture
def real_anthropic_key():
    """Verify real Anthropic API key is available."""
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key or key.startswith("test"):
        pytest.skip("Real ANTHROPIC_API_KEY required for Anthropic E2E tests")
    return key


class TestHeliconeOpenAIE2E:
    """End-to-end tests for OpenAI via Helicone."""

    @pytest.mark.slow
    def test_openai_call_through_helicone_proxy(
        self, real_api_keys, isolated_env_runner, helicone_enabled_env
    ):
        """
        Smoke test: Make a real OpenAI call through Helicone.

        Validates:
        - Helicone proxy is reachable
        - Authentication works
        - Request completes successfully
        """
        test_code = """
from workout_ingestor_api.ai.client_factory import AIClientFactory, AIRequestContext

context = AIRequestContext(
    user_id="e2e-test-user",
    feature_name="e2e_smoke_test",
    custom_properties={"test_run": "true"},
)

client = AIClientFactory.create_openai_client(context=context)

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Say 'test passed' in 2 words"}],
    max_tokens=10,
)

content = response.choices[0].message.content
assert content is not None, "Response content should not be None"
print(f"SUCCESS: {content}")
"""
        result = isolated_env_runner(test_code, helicone_enabled_env)

        assert result.returncode == 0, f"Test failed: {result.stderr}"
        assert "SUCCESS:" in result.stdout

    @pytest.mark.slow
    def test_openai_direct_call_when_helicone_disabled(
        self, real_api_keys, isolated_env_runner, helicone_disabled_env
    ):
        """
        Verify direct OpenAI calls work when Helicone is disabled.

        This ensures the fallback path (no proxy) is functional.
        """
        test_code = """
from workout_ingestor_api.ai.client_factory import AIClientFactory

client = AIClientFactory.create_openai_client()

# Verify base URL is NOT the Helicone proxy
base_url = str(client.base_url)
assert "helicone" not in base_url.lower(), f"Should not use Helicone: {base_url}"

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Say 'direct test' in 2 words"}],
    max_tokens=10,
)

content = response.choices[0].message.content
assert content is not None
print(f"SUCCESS: {content}")
"""
        result = isolated_env_runner(test_code, helicone_disabled_env)

        assert result.returncode == 0, f"Test failed: {result.stderr}"
        assert "SUCCESS:" in result.stdout


class TestHeliconeAnthropicE2E:
    """End-to-end tests for Anthropic via Helicone."""

    @pytest.mark.slow
    def test_anthropic_call_through_helicone_proxy(
        self, real_api_keys, real_anthropic_key, isolated_env_runner, helicone_enabled_env
    ):
        """
        Smoke test: Make a real Anthropic call through Helicone.

        Validates:
        - Helicone Anthropic proxy is reachable
        - Authentication works with Anthropic
        - Request completes successfully
        """
        test_code = """
from workout_ingestor_api.ai.client_factory import AIClientFactory, AIRequestContext

context = AIRequestContext(
    user_id="e2e-anthropic-test",
    feature_name="e2e_anthropic_smoke",
    custom_properties={"provider": "anthropic"},
)

client = AIClientFactory.create_anthropic_client(context=context)

response = client.messages.create(
    model="claude-3-haiku-20240307",
    max_tokens=10,
    messages=[{"role": "user", "content": "Say 'anthropic test' in 2 words"}],
)

content = response.content[0].text
assert content is not None, "Response content should not be None"
print(f"SUCCESS: {content}")
"""
        result = isolated_env_runner(test_code, helicone_enabled_env)

        assert result.returncode == 0, f"Test failed: {result.stderr}"
        assert "SUCCESS:" in result.stdout

    @pytest.mark.slow
    def test_anthropic_direct_call_when_helicone_disabled(
        self, real_api_keys, real_anthropic_key, isolated_env_runner, helicone_disabled_env
    ):
        """
        Verify direct Anthropic calls work when Helicone is disabled.
        """
        test_code = """
from workout_ingestor_api.ai.client_factory import AIClientFactory

client = AIClientFactory.create_anthropic_client()

response = client.messages.create(
    model="claude-3-haiku-20240307",
    max_tokens=10,
    messages=[{"role": "user", "content": "Say 'direct anthropic' in 2 words"}],
)

content = response.content[0].text
assert content is not None
print(f"SUCCESS: {content}")
"""
        result = isolated_env_runner(test_code, helicone_disabled_env)

        assert result.returncode == 0, f"Test failed: {result.stderr}"
        assert "SUCCESS:" in result.stdout


class TestHeliconeSessionTracking:
    """Tests for session grouping in Helicone."""

    @pytest.mark.slow
    def test_session_id_groups_multiple_requests(
        self, real_api_keys, isolated_env_runner, helicone_enabled_env
    ):
        """
        Multiple requests with same session_id should be grouped in Helicone.

        After running, verify in Helicone dashboard that all 3 requests
        appear under the same session.
        """
        session_id = f"e2e-session-{uuid.uuid4().hex[:8]}"

        test_code = f"""
from workout_ingestor_api.ai.client_factory import AIClientFactory, AIRequestContext

session_id = "{session_id}"
results = []

for i in range(3):
    context = AIRequestContext(
        user_id="e2e-session-test",
        session_id=session_id,
        feature_name="session_grouping_test",
        custom_properties={{"request_number": str(i)}},
    )

    client = AIClientFactory.create_openai_client(context=context)
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{{"role": "user", "content": f"Request {{i}}"}}],
        max_tokens=5,
    )
    results.append(response.choices[0].message.content)

print(f"SUCCESS: session_id={session_id}")
print(f"VERIFY: Check Helicone for 3 requests grouped under session {session_id}")
"""
        result = isolated_env_runner(test_code, helicone_enabled_env)

        assert result.returncode == 0, f"Test failed: {result.stderr}"
        assert "SUCCESS:" in result.stdout
        # Log the session_id for manual verification
        print(f"\n[VERIFY IN HELICONE] Session ID: {session_id}")


class TestHeliconeMetadataVerification:
    """Tests to verify metadata appears in Helicone dashboard."""

    @pytest.mark.slow
    @pytest.mark.manual
    def test_verify_user_id_in_helicone_dashboard(
        self, real_api_keys, isolated_env_runner, helicone_enabled_env
    ):
        """
        Manual verification test - check Helicone dashboard after running.

        Steps:
        1. Run this test
        2. Go to Helicone dashboard
        3. Find request with user_id = "e2e-verify-user-{unique_id}"
        4. Verify custom properties are visible
        """
        unique_id = uuid.uuid4().hex[:8]

        test_code = f"""
from workout_ingestor_api.ai.client_factory import AIClientFactory, AIRequestContext

context = AIRequestContext(
    user_id="e2e-verify-user-{unique_id}",
    session_id="e2e-session-{unique_id}",
    feature_name="metadata_verification_test",
    request_id="e2e-req-{unique_id}",
    custom_properties={{
        "test_type": "manual_verification",
        "workout_source": "youtube",
    }},
)

client = AIClientFactory.create_openai_client(context=context)

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{{"role": "user", "content": "Echo: metadata test"}}],
    max_tokens=10,
)

print("SUCCESS")
print("VERIFY_USER_ID: e2e-verify-user-{unique_id}")
print("VERIFY_SESSION_ID: e2e-session-{unique_id}")
print("VERIFY_REQUEST_ID: e2e-req-{unique_id}")
"""
        result = isolated_env_runner(test_code, helicone_enabled_env)

        assert result.returncode == 0, f"Test failed: {result.stderr}"

        # Print verification instructions
        print(f"\n{'='*60}")
        print("[MANUAL VERIFICATION REQUIRED]")
        print(f"{'='*60}")
        print(f"Check Helicone dashboard for request with:")
        print(f"  - User ID: e2e-verify-user-{unique_id}")
        print(f"  - Session ID: e2e-session-{unique_id}")
        print(f"  - Feature: metadata_verification_test")
        print(f"  - Request ID: e2e-req-{unique_id}")
        print(f"  - Custom properties: test_type, workout_source")
        print(f"{'='*60}")


class TestHeliconeProxyResilience:
    """Test resilience when Helicone proxy has issues."""

    @pytest.mark.slow
    @pytest.mark.skip(reason="Requires intentional network manipulation")
    def test_behavior_when_helicone_unreachable(self, real_api_keys):
        """
        Test what happens when Helicone proxy is unreachable.

        This test is skipped by default as it requires network manipulation.
        Run manually to verify failure behavior.

        Expected behavior: Retry logic should attempt 3 times, then fail
        with a connection error (not silently fall back to direct API).
        """
        pass
