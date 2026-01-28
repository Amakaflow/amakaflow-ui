"""Load testing scripts for Chat API.

These scripts use Locust to simulate realistic user load patterns
against the chat API endpoints.

Usage:
    # Start web UI
    locust -f tests/load/locustfile.py --host http://localhost:8000

    # Headless mode (for CI)
    locust -f tests/load/locustfile.py --host http://localhost:8000 \
           --headless -u 100 -r 10 -t 1m
"""
