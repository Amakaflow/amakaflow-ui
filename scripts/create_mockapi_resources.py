"""Script to create all MockAPI.io resources at once using their REST API.

MockAPI.io resources are created automatically when you POST data to them.
This script creates all resources by POSTing example data.

Usage:
    python scripts/create_mockapi_resources.py --base-url https://6917363aa7a34288a27ff1d6.mockapi.io/api/v1

Or set environment variable:
    export MOCKAPI_BASE_URL=https://6917363aa7a34288a27ff1d6.mockapi.io/api/v1
    python scripts/create_mockapi_resources.py
"""
import json
import os
import sys
import argparse
from pathlib import Path
from typing import Dict, Any, Optional
import time

try:
    import requests
except ImportError:
    print("ERROR: The 'requests' library is required.")
    print("Install it with: pip install requests")
    sys.exit(1)


def load_examples() -> Dict[str, Any]:
    """Load example responses from JSON file."""
    examples_file = Path(__file__).parent.parent / "mockapi_examples.json"
    if not examples_file.exists():
        print(f"ERROR: {examples_file} not found. Run setup_mockapi.py first.")
        sys.exit(1)
    
    with open(examples_file, "r") as f:
        return json.load(f)


def create_resource(base_url: str, resource_name: str, data: Any) -> bool:
    """Create a resource by POSTing data to MockAPI.io.
    
    In MockAPI.io, resources are created automatically when you POST to them.
    """
    url = f"{base_url.rstrip('/')}/{resource_name}"
    
    try:
        response = requests.post(
            url,
            json=data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            print(f"✅ Created resource '{resource_name}'")
            return True
        else:
            print(f"❌ Failed to create '{resource_name}': {response.status_code} - {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Error creating '{resource_name}': {e}")
        return False


def create_all_resources(base_url: str, examples: Dict[str, Any]) -> None:
    """Create all MockAPI.io resources from examples."""
    print("=" * 80)
    print("Creating MockAPI.io Resources")
    print("=" * 80)
    print(f"Base URL: {base_url}")
    print()
    
    # Map endpoint names to resource names
    # Since MockAPI.io is resource-based, we'll create resources that match our endpoints
    resource_mapping = {
        "health": ("health", examples["health"]),
        "ingest_text": ("ingest_text", examples["ingest_text"]),
        "ingest_ai_workout": ("ingest_ai_workout", examples["ingest_ai_workout"]),
        "ingest_image": ("ingest_image", examples["ingest_image"]),
        "ingest_url": ("ingest_url", examples["ingest_url"]),
        "ingest_instagram_test": ("ingest_instagram_test", examples["ingest_instagram_test"]),
        "ingest_youtube": ("ingest_youtube", examples["ingest_youtube"]),
        "export_tp_text": ("export_tp_text", examples["export_tp_text"]),
        "export_tcx": ("export_tcx", examples["export_tcx"]),
        # Note: export_fit is binary, so we'll skip it or handle it differently
    }
    
    success_count = 0
    failed_count = 0
    
    for endpoint_name, (resource_name, data) in resource_mapping.items():
        print(f"Creating resource: {resource_name}...", end=" ")
        
        # For text-based responses (export_tp_text, export_tcx), we need to wrap them
        if isinstance(data, str):
            # Store as a JSON object with a "content" field
            wrapped_data = {"content": data, "type": "text"}
            if endpoint_name == "export_tcx":
                wrapped_data["type"] = "xml"
        else:
            wrapped_data = data
        
        if create_resource(base_url, resource_name, wrapped_data):
            success_count += 1
        else:
            failed_count += 1
        
        # Small delay to avoid rate limiting
        time.sleep(0.5)
    
    print()
    print("=" * 80)
    print(f"Summary: {success_count} resources created successfully, {failed_count} failed")
    print("=" * 80)
    print()
    print("Your resources are now available at:")
    for endpoint_name, (resource_name, _) in resource_mapping.items():
        print(f"  GET/POST {base_url}/{resource_name}")
    print()
    print("NOTE: MockAPI.io resources work like REST APIs.")
    print("  - GET /resource_name returns all items")
    print("  - POST /resource_name creates a new item")
    print("  - GET /resource_name/:id returns a specific item")


def main():
    parser = argparse.ArgumentParser(
        description="Create all MockAPI.io resources at once"
    )
    parser.add_argument(
        "--base-url",
        help="MockAPI.io base URL (e.g., https://6917363aa7a34288a27ff1d6.mockapi.io/api/v1)",
        default=os.getenv("MOCKAPI_BASE_URL", "https://6917363aa7a34288a27ff1d6.mockapi.io/api/v1")
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be created without actually creating resources"
    )
    
    args = parser.parse_args()
    
    if not args.base_url:
        print("ERROR: --base-url is required or set MOCKAPI_BASE_URL environment variable")
        sys.exit(1)
    
    examples = load_examples()
    
    if args.dry_run:
        print("DRY RUN - Would create the following resources:")
        print()
        for key in examples.keys():
            if key != "export_tcx" and key != "export_tp_text":
                print(f"  - {key}: {type(examples[key]).__name__}")
            else:
                print(f"  - {key}: text")
    else:
        create_all_resources(args.base_url, examples)


if __name__ == "__main__":
    main()

