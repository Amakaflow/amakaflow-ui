"""Load testing script for Chat API using Locust.

This script defines user behavior patterns for load testing the chat API.
It simulates realistic user interactions including chat messages, health checks,
and function-triggering requests.

Usage:
    # Start web UI
    locust -f tests/load/locustfile.py --host http://localhost:8000

    # Headless mode (for CI)
    locust -f tests/load/locustfile.py --host http://localhost:8000 \
           --headless -u 100 -r 10 -t 1m

    # With specific target metrics
    locust -f tests/load/locustfile.py --host http://localhost:8000 \
           --headless -u 100 -r 10 -t 5m \
           --csv=results/load_test

Target metrics:
    - 100 concurrent users
    - P95 latency < 2s for streaming start
    - Zero errors under normal load
    - Graceful degradation at 200+ users
"""

import json
import random
import time
from typing import Any, Dict, List, Optional

from locust import HttpUser, between, task, events


# =============================================================================
# Test Data
# =============================================================================

# Realistic chat messages for different scenarios
SEARCH_MESSAGES = [
    "Find me a 20 minute HIIT workout",
    "Show me some leg workouts",
    "Search for strength training",
    "Find cardio workouts",
    "Show me bodyweight exercises",
    "Find 30 minute full body workout",
    "Search for ab exercises",
    "Find upper body workouts",
]

CALENDAR_MESSAGES = [
    "Schedule this workout for tomorrow",
    "Add to my calendar for Monday",
    "Book this for 7am tomorrow",
    "Schedule for next week",
    "Put this on my calendar",
]

GENERATION_MESSAGES = [
    "Create a 30 minute workout",
    "Generate a beginner HIIT session",
    "Make me an upper body workout",
    "Create a quick 15 minute routine",
    "Design a no-equipment workout",
]

NAVIGATION_MESSAGES = [
    "Take me to my calendar",
    "Go to my library",
    "Open settings",
    "Show me the home page",
    "Navigate to my workouts",
]

GENERAL_MESSAGES = [
    "Hello!",
    "What can you help me with?",
    "Thanks!",
    "How do I use this?",
]


def random_message() -> str:
    """Get a random message from all categories."""
    all_messages = (
        SEARCH_MESSAGES
        + CALENDAR_MESSAGES
        + GENERATION_MESSAGES
        + NAVIGATION_MESSAGES
        + GENERAL_MESSAGES
    )
    return random.choice(all_messages)


def random_search_message() -> str:
    """Get a random search message."""
    return random.choice(SEARCH_MESSAGES)


# =============================================================================
# Custom SSE Response Handler
# =============================================================================


def parse_sse_time_to_first_event(response) -> Optional[float]:
    """Parse SSE response and return time to first event in seconds.

    Returns None if no events found or parsing failed.
    """
    try:
        content = response.text
        lines = content.split("\n")

        for line in lines:
            if line.startswith("event:"):
                # Found first event
                return response.elapsed.total_seconds()

        return None
    except Exception:
        return None


# =============================================================================
# Locust User Classes
# =============================================================================


class ChatAPIUser(HttpUser):
    """Simulates a typical chat API user with mixed behavior.

    This user class represents normal user patterns:
    - Mostly sends chat messages (80% of requests)
    - Occasionally checks health endpoints (10%)
    - Sometimes makes search-heavy requests (10%)
    """

    wait_time = between(1, 3)  # Wait 1-3 seconds between requests

    def on_start(self):
        """Initialize user state."""
        self.session_id: Optional[str] = None
        self.auth_token = f"Bearer load-test-token-{random.randint(1000, 9999)}"

    @task(10)
    def send_chat_message(self):
        """Send a general chat message."""
        message = random_message()

        payload: Dict[str, Any] = {"message": message}

        # Reuse session 70% of the time
        if self.session_id and random.random() < 0.7:
            payload["session_id"] = self.session_id

        start_time = time.time()

        with self.client.post(
            "/chat/stream",
            json=payload,
            headers={"Authorization": self.auth_token},
            catch_response=True,
            stream=True,  # Enable streaming
        ) as response:
            if response.status_code == 200:
                # Read first chunk to measure time to first byte
                first_chunk_time = None
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk and first_chunk_time is None:
                        first_chunk_time = time.time() - start_time
                        break

                # Track time to first byte as custom metric
                if first_chunk_time:
                    events.request.fire(
                        request_type="SSE",
                        name="chat_stream_ttfb",
                        response_time=first_chunk_time * 1000,  # Convert to ms
                        response_length=len(chunk) if chunk else 0,
                        exception=None,
                        context={},
                    )

                response.success()

                # Extract session_id from response for reuse
                try:
                    text = response.text
                    if "session_id" in text:
                        # Simple extraction (would be more robust in production)
                        import re

                        match = re.search(r'"session_id":\s*"([^"]+)"', text)
                        if match:
                            self.session_id = match.group(1)
                except Exception:
                    pass

            elif response.status_code == 429:
                response.failure("Rate limited")
            else:
                response.failure(f"Status {response.status_code}")

    @task(2)
    def send_search_message(self):
        """Send a search-specific message (higher function call likelihood)."""
        message = random_search_message()

        payload: Dict[str, Any] = {"message": message}

        with self.client.post(
            "/chat/stream",
            json=payload,
            headers={"Authorization": self.auth_token},
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                # Verify we got some response
                if len(response.text) > 0:
                    response.success()
                else:
                    response.failure("Empty response")
            else:
                response.failure(f"Status {response.status_code}")

    @task(1)
    def check_health(self):
        """Check the health endpoint."""
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("status") in ["ok", "healthy"]:
                    response.success()
                else:
                    response.failure(f"Unhealthy: {data.get('status')}")
            else:
                response.failure(f"Status {response.status_code}")

    @task(1)
    def check_ready(self):
        """Check the readiness endpoint."""
        with self.client.get("/ready", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status {response.status_code}")


class HeavyAPIUser(HttpUser):
    """Simulates a power user making frequent requests.

    This user class represents heavy usage patterns:
    - Rapid-fire chat messages
    - Multiple concurrent sessions
    - Complex function-triggering queries
    """

    wait_time = between(0.5, 1.5)  # Faster request rate

    def on_start(self):
        """Initialize user state."""
        self.sessions: List[str] = []
        self.auth_token = f"Bearer heavy-user-{random.randint(1000, 9999)}"

    @task(5)
    def rapid_chat(self):
        """Send rapid chat messages."""
        message = random_message()

        # Randomly pick a session or create new
        session_id = random.choice(self.sessions) if self.sessions else None

        payload: Dict[str, Any] = {"message": message}
        if session_id:
            payload["session_id"] = session_id

        with self.client.post(
            "/chat/stream",
            json=payload,
            headers={"Authorization": self.auth_token},
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()

                # Track new sessions
                try:
                    import re

                    match = re.search(r'"session_id":\s*"([^"]+)"', response.text)
                    if match and match.group(1) not in self.sessions:
                        self.sessions.append(match.group(1))
                        # Keep only last 5 sessions
                        self.sessions = self.sessions[-5:]
                except Exception:
                    pass
            else:
                response.failure(f"Status {response.status_code}")

    @task(2)
    def complex_query(self):
        """Send complex multi-intent queries."""
        complex_messages = [
            "Find a 30 minute HIIT workout and schedule it for tomorrow at 6am",
            "Create a beginner workout and add it to my calendar",
            "Show me leg workouts then take me to the calendar",
        ]
        message = random.choice(complex_messages)

        with self.client.post(
            "/chat/stream",
            json={"message": message},
            headers={"Authorization": self.auth_token},
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status {response.status_code}")


class HealthCheckUser(HttpUser):
    """Simulates monitoring systems checking health endpoints.

    This user class represents automated health checks:
    - Frequent health/ready checks
    - No chat requests
    """

    wait_time = between(5, 10)  # Check every 5-10 seconds

    @task(1)
    def health_check(self):
        """Check health endpoint."""
        self.client.get("/health")

    @task(1)
    def ready_check(self):
        """Check readiness endpoint."""
        self.client.get("/ready")


# =============================================================================
# Custom Event Handlers
# =============================================================================


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Log test start."""
    print("Load test starting...")
    print(f"Target host: {environment.host}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Log test completion and summary."""
    print("\nLoad test completed!")

    stats = environment.stats
    print(f"\nTotal requests: {stats.total.num_requests}")
    print(f"Failed requests: {stats.total.num_failures}")
    print(f"Average response time: {stats.total.avg_response_time:.2f}ms")

    if stats.total.num_requests > 0:
        error_rate = (stats.total.num_failures / stats.total.num_requests) * 100
        print(f"Error rate: {error_rate:.2f}%")

        # Check against targets
        if error_rate > 1:
            print("WARNING: Error rate exceeds 1% target")

        if stats.total.avg_response_time > 2000:
            print("WARNING: Average response time exceeds 2s target")


# =============================================================================
# Custom Metrics Reporting
# =============================================================================


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Track custom metrics for each request."""
    # Could be extended to send to external monitoring
    pass
