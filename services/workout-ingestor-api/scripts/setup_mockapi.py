"""Script to set up mockapi.io endpoints for the Workout Ingestor API.

This script helps you create mock endpoints on mockapi.io for testing.
You'll need to:
1. Create a mockapi.io project at https://mockapi.io
2. Get your project API URL (e.g., https://<project_id>.mockapi.io/api/v1)
3. Set the MOCKAPI_BASE_URL environment variable or pass it as an argument
4. Run this script to create all endpoints

Usage:
    python scripts/setup_mockapi.py --base-url https://<project_id>.mockapi.io/api/v1
    # Or set environment variable:
    export MOCKAPI_BASE_URL=https://<project_id>.mockapi.io/api/v1
    python scripts/setup_mockapi.py
"""
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional
import argparse

def get_example_workout() -> Dict[str, Any]:
    """Generate an example workout response."""
    return {
        "title": "Sample Chest & Triceps Workout",
        "source": "example",
        "blocks": [
            {
                "label": "Main Workout",
                "structure": "4 sets",
                "rest_between_sec": 90,
                "exercises": [
                    {
                        "name": "Incline Barbell Bench Press",
                        "sets": 4,
                        "reps": 8,
                        "type": "strength",
                        "notes": "Last set to failure; 45° incline; narrow grip; pause on chest."
                    },
                    {
                        "name": "Seated Cable Fly",
                        "sets": 3,
                        "reps_range": "10-12",
                        "type": "strength",
                        "notes": "Slow negatives; elbows high; deep stretch."
                    }
                ],
                "supersets": []
            }
        ]
    }


def get_example_responses() -> Dict[str, Any]:
    """Get example responses for each endpoint."""
    workout = get_example_workout()
    
    return {
        "health": {"ok": True},
        "ingest_text": workout,
        "ingest_ai_workout": workout,
        "ingest_image": workout,
        "ingest_url": workout,
        "ingest_instagram_test": {
            **workout,
            "_provenance": {
                "mode": "instagram_image_test",
                "source_url": "https://www.instagram.com/p/example/",
                "image_count": 3
            }
        },
        "ingest_youtube": {
            **workout,
            "_provenance": {
                "mode": "transcript_only",
                "source_url": "https://www.youtube.com/watch?v=example",
                "has_captions": True,
                "has_asr": False,
                "has_ocr": False,
                "transcript_provider": "youtube-transcript.io",
                "transcript_summarized": False
            }
        },
        "export_tp_text": "WORKOUT: Sample Chest & Triceps Workout\n\nMain Workout\n4 sets; 90 sec rest\n  - Incline Barbell Bench Press: 4 x 8\n  - Seated Cable Fly: 3 x 10-12",
        "export_tcx": '<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase>\n  <Workouts>\n    <Workout>\n      <Name>Sample Chest & Triceps Workout</Name>\n    </Workout>\n  </Workouts>\n</TrainingCenterDatabase>',
        # Note: export/fit returns binary, so mockapi might need special handling
    }


def create_mockapi_endpoint(
    base_url: str,
    endpoint_name: str,
    method: str,
    path: str,
    request_body: Optional[Dict[str, Any]] = None,
    response_body: Any = None,
    headers: Optional[Dict[str, str]] = None
) -> bool:
    """Create a mock endpoint on mockapi.io.
    
    Note: mockapi.io works differently - you create resources, not routes.
    This is a helper to document endpoints. For actual mocking, you may need
    to use mockapi.io's web interface or their API differently.
    """
    # MockAPI.io uses a resource-based approach, not route-based
    # This function documents what endpoints should exist
    print(f"📝 Endpoint: {method} {path}")
    if request_body:
        print(f"   Request: {json.dumps(request_body, indent=2)}")
    if response_body:
        print(f"   Response: {json.dumps(response_body, indent=2) if isinstance(response_body, dict) else str(response_body)[:100]}")
    print()
    return True


def document_endpoints(base_url: Optional[str] = None):
    """Document all API endpoints for mockapi.io setup."""
    examples = get_example_responses()
    
    endpoints = [
        {
            "name": "health",
            "method": "GET",
            "path": "/health",
            "description": "Health check endpoint",
            "request_body": None,
            "response_body": examples["health"],
        },
        {
            "name": "ingest_text",
            "method": "POST",
            "path": "/ingest/text",
            "description": "Ingest workout from plain text",
            "request_body": {
                "text": "Incline Barbell Bench Press: 4 sets x 8 reps\nSeated Cable Fly: 3 sets x 10-12 reps",
                "source": "manual_entry"
            },
            "response_body": examples["ingest_text"],
            "content_type": "application/x-www-form-urlencoded"
        },
        {
            "name": "ingest_ai_workout",
            "method": "POST",
            "path": "/ingest/ai_workout",
            "description": "Ingest AI/ChatGPT-generated workout",
            "request_body": "Incline Barbell Bench Press: 4 sets x 8 reps...",
            "response_body": examples["ingest_ai_workout"],
            "content_type": "text/plain"
        },
        {
            "name": "ingest_image",
            "method": "POST",
            "path": "/ingest/image",
            "description": "Ingest workout from image using OCR",
            "request_body": "<binary image file>",
            "response_body": examples["ingest_image"],
            "content_type": "multipart/form-data"
        },
        {
            "name": "ingest_url",
            "method": "POST",
            "path": "/ingest/url",
            "description": "Ingest workout from video URL",
            "request_body": {"url": "https://www.youtube.com/watch?v=example"},
            "response_body": examples["ingest_url"],
            "content_type": "application/json"
        },
        {
            "name": "ingest_instagram_test",
            "method": "POST",
            "path": "/ingest/instagram_test",
            "description": "Ingest workout from Instagram post (requires credentials)",
            "request_body": {
                "username": "test_user",
                "password": "test_password",
                "url": "https://www.instagram.com/p/example/"
            },
            "response_body": examples["ingest_instagram_test"],
            "content_type": "application/json"
        },
        {
            "name": "ingest_youtube",
            "method": "POST",
            "path": "/ingest/youtube",
            "description": "Ingest workout from YouTube video using transcript",
            "request_body": {
                "url": "https://www.youtube.com/watch?v=example"
            },
            "response_body": examples["ingest_youtube"],
            "content_type": "application/json"
        },
        {
            "name": "export_tp_text",
            "method": "POST",
            "path": "/export/tp_text",
            "description": "Export workout as Training Peaks text format",
            "request_body": examples["ingest_text"],
            "response_body": examples["export_tp_text"],
            "content_type": "text/plain"
        },
        {
            "name": "export_tcx",
            "method": "POST",
            "path": "/export/tcx",
            "description": "Export workout as TCX (Training Center XML) format",
            "request_body": examples["ingest_text"],
            "response_body": examples["export_tcx"],
            "content_type": "application/vnd.garmin.tcx+xml"
        },
        {
            "name": "export_fit",
            "method": "POST",
            "path": "/export/fit",
            "description": "Export workout as FIT format (binary)",
            "request_body": examples["ingest_text"],
            "response_body": "<binary FIT file>",
            "content_type": "application/octet-stream"
        },
    ]
    
    print("=" * 80)
    print("WORKOUT INGESTOR API - MOCKAPI.IO SETUP")
    print("=" * 80)
    print()
    print("NOTE: MockAPI.io uses a resource-based model, not route-based.")
    print("You may need to configure custom routes in the MockAPI.io dashboard.")
    print()
    
    if base_url:
        print(f"Base URL: {base_url}")
        print()
    
    for endpoint in endpoints:
        print(f"Endpoint: {endpoint['method']} {endpoint['path']}")
        print(f"Description: {endpoint['description']}")
        if endpoint.get('content_type'):
            print(f"Content-Type: {endpoint['content_type']}")
        if endpoint['request_body']:
            print("Request Body:")
            if isinstance(endpoint['request_body'], dict):
                print(json.dumps(endpoint['request_body'], indent=2))
            else:
                print(f"  {endpoint['request_body']}")
        print("Response Body:")
        if isinstance(endpoint['response_body'], dict):
            print(json.dumps(endpoint['response_body'], indent=2))
        else:
            print(f"  {endpoint['response_body']}")
        print("-" * 80)
        print()
    
    # Save to JSON file for easier import
    output_file = Path(__file__).parent.parent / "mockapi_endpoints.json"
    with open(output_file, "w") as f:
        json.dump(endpoints, f, indent=2)
    print(f"✅ Endpoint definitions saved to: {output_file}")
    
    # Save example responses separately
    examples_file = Path(__file__).parent.parent / "mockapi_examples.json"
    with open(examples_file, "w") as f:
        json.dump(examples, f, indent=2)
    print(f"✅ Example responses saved to: {examples_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Set up mockapi.io endpoints")
    parser.add_argument(
        "--base-url",
        help="MockAPI.io base URL (or set MOCKAPI_BASE_URL env var)",
        default=os.getenv("MOCKAPI_BASE_URL")
    )
    args = parser.parse_args()
    
    document_endpoints(args.base_url)

