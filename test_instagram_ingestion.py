#!/usr/bin/env python3
"""
Test script for Instagram workout ingestion endpoint.

This script tests the /ingest/instagram_test endpoint with various Instagram post URLs
to verify that images are extracted and workouts are structured correctly.

Requirements:
    pip install requests
    
Or run inside Docker container:
    docker compose exec workout-ingestor-api python test_instagram_ingestion.py [args]

Usage:
    python test_instagram_ingestion.py [instagram_url] [--vision] [--ocr]
    
Examples:
    # Test with OCR (default)
    python test_instagram_ingestion.py https://www.instagram.com/p/DRHiuniDM1K/
    
    # Test with Vision model
    python test_instagram_ingestion.py https://www.instagram.com/p/DRHiuniDM1K/ --vision
    
    # Test multiple URLs
    python test_instagram_ingestion.py https://www.instagram.com/p/DRHiuniDM1K/ https://www.instagram.com/p/DOyajJ9AukY/
    
    # Test from inside Docker container
    docker compose exec workout-ingestor-api python test_instagram_ingestion.py https://www.instagram.com/p/DRHiuniDM1K/ --vision
"""

import argparse
import json
import sys
import requests
from typing import List, Dict, Any
from urllib.parse import urlparse


def test_instagram_ingestion(
    url: str,
    use_vision: bool = False,
    vision_provider: str = "openai",
    vision_model: str = "gpt-4o-mini",
    openai_api_key: str = None,
    base_url: str = "http://localhost:8004",
) -> Dict[str, Any]:
    """
    Test Instagram ingestion endpoint.
    
    Args:
        url: Instagram post URL
        use_vision: Whether to use vision model (default: False, uses OCR)
        vision_provider: Vision provider ("openai" or "anthropic")
        vision_model: Model name
        openai_api_key: OpenAI API key (optional, uses env var if not provided)
        base_url: API base URL
        
    Returns:
        Dict with test results
    """
    endpoint = f"{base_url}/ingest/instagram_test"
    
    # Prepare payload
    payload = {
        "url": url,
        "use_vision": use_vision,
    }
    
    if use_vision:
        payload["vision_provider"] = vision_provider
        payload["vision_model"] = vision_model
        if openai_api_key:
            payload["openai_api_key"] = openai_api_key
    
    print(f"\n{'='*80}")
    print(f"Testing Instagram URL: {url}")
    print(f"Method: {'Vision Model' if use_vision else 'OCR'}")
    if use_vision:
        print(f"Provider: {vision_provider}")
        print(f"Model: {vision_model}")
    print(f"{'='*80}\n")
    
    try:
        # Make request
        response = requests.post(
            endpoint,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=120,  # 2 minute timeout for vision models
        )
        
        # Check response
        if response.status_code != 200:
            error_detail = response.json().get("detail", "Unknown error")
            return {
                "success": False,
                "url": url,
                "status_code": response.status_code,
                "error": error_detail,
            }
        
        # Parse response
        result = response.json()
        provenance = result.get("_provenance", {})
        
        # Extract stats
        blocks = result.get("blocks", [])
        total_exercises = sum(len(block.get("exercises", [])) for block in blocks)
        total_supersets = sum(len(block.get("supersets", [])) for block in blocks)
        
        # Get exercise names
        exercise_names = []
        for block in blocks:
            for exercise in block.get("exercises", []):
                name = exercise.get("name")
                if name:
                    exercise_names.append(name)
        
        return {
            "success": True,
            "url": url,
            "extraction_method": provenance.get("extraction_method", "unknown"),
            "image_count": provenance.get("image_count", 0),
            "blocks_count": len(blocks),
            "total_exercises": total_exercises,
            "total_supersets": total_supersets,
            "exercise_names": exercise_names[:10],  # First 10 exercises
            "workout_title": result.get("title", "N/A"),
            "response": result,
        }
        
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "url": url,
            "error": "Request timeout (exceeded 120 seconds)",
        }
    except requests.exceptions.ConnectionError:
        return {
            "success": False,
            "url": url,
            "error": f"Connection error: Could not connect to {base_url}. Is the API running?",
        }
    except Exception as e:
        return {
            "success": False,
            "url": url,
            "error": str(e),
        }


def print_test_results(results: List[Dict[str, Any]]):
    """Print formatted test results."""
    print("\n" + "="*80)
    print("TEST RESULTS SUMMARY")
    print("="*80 + "\n")
    
    successful = sum(1 for r in results if r.get("success"))
    total = len(results)
    
    print(f"Total tests: {total}")
    print(f"Successful: {successful}")
    print(f"Failed: {total - successful}\n")
    
    for i, result in enumerate(results, 1):
        print(f"{'─'*80}")
        print(f"Test {i}: {result['url']}")
        print(f"{'─'*80}")
        
        if result.get("success"):
            print(f"✅ SUCCESS")
            print(f"  Extraction Method: {result.get('extraction_method', 'N/A')}")
            print(f"  Images Extracted: {result.get('image_count', 0)}")
            print(f"  Blocks: {result.get('blocks_count', 0)}")
            print(f"  Total Exercises: {result.get('total_exercises', 0)}")
            print(f"  Total Supersets: {result.get('total_supersets', 0)}")
            print(f"  Workout Title: {result.get('workout_title', 'N/A')}")
            
            exercise_names = result.get("exercise_names", [])
            if exercise_names:
                print(f"  Exercises:")
                for name in exercise_names:
                    print(f"    - {name}")
        else:
            print(f"❌ FAILED")
            print(f"  Error: {result.get('error', 'Unknown error')}")
            if result.get("status_code"):
                print(f"  Status Code: {result.get('status_code')}")
        
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Test Instagram workout ingestion endpoint",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "urls",
        nargs="+",
        help="Instagram post URLs to test",
    )
    
    parser.add_argument(
        "--vision",
        action="store_true",
        help="Use vision model instead of OCR",
    )
    
    parser.add_argument(
        "--ocr",
        action="store_true",
        help="Use OCR (default, can be combined with --vision to test both)",
    )
    
    parser.add_argument(
        "--vision-provider",
        choices=["openai", "anthropic"],
        default="openai",
        help="Vision provider (default: openai)",
    )
    
    parser.add_argument(
        "--vision-model",
        default="gpt-4o-mini",
        help="Vision model name (default: gpt-4o-mini)",
    )
    
    parser.add_argument(
        "--openai-api-key",
        help="OpenAI API key (optional, uses OPENAI_API_KEY env var if not provided)",
    )
    
    parser.add_argument(
        "--base-url",
        default="http://localhost:8004",
        help="API base URL (default: http://localhost:8004)",
    )
    
    parser.add_argument(
        "--output",
        help="Output JSON file to save results",
    )
    
    args = parser.parse_args()
    
    # Validate URLs
    for url in args.urls:
        parsed = urlparse(url)
        if "instagram.com" not in parsed.netloc:
            print(f"Warning: {url} doesn't appear to be an Instagram URL", file=sys.stderr)
    
    # Determine which methods to test
    methods = []
    if args.ocr or not args.vision:
        methods.append(("ocr", False))
    if args.vision:
        methods.append(("vision", True))
    
    if not methods:
        methods = [("ocr", False)]  # Default to OCR
    
    # Run tests
    all_results = []
    
    for method_name, use_vision in methods:
        print(f"\n{'#'*80}")
        print(f"Testing with {method_name.upper()}")
        print(f"{'#'*80}")
        
        for url in args.urls:
            result = test_instagram_ingestion(
                url=url,
                use_vision=use_vision,
                vision_provider=args.vision_provider,
                vision_model=args.vision_model,
                openai_api_key=args.openai_api_key,
                base_url=args.base_url,
            )
            result["method"] = method_name
            all_results.append(result)
    
    # Print results
    print_test_results(all_results)
    
    # Save to file if requested
    if args.output:
        with open(args.output, "w") as f:
            json.dump(all_results, f, indent=2)
        print(f"\nResults saved to: {args.output}")
    
    # Exit with appropriate code
    if all(r.get("success") for r in all_results):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()

