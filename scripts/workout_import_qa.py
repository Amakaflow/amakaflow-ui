#!/usr/bin/env python3
"""
Workout Import QA Script

Nightly automated QA that imports real workout URLs into the AmakaFlow UI via Playwright,
screenshots each result, sends the screenshot to Kimi 2.5 vision to judge what looks wrong,
and sends a Markdown report plus screenshots via Telegram Bot to David (chat ID 7888191549)
when issues are found.

Phase 1 is observe only — no auto-fix, no Linear ticket creation.
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Any

from openai import OpenAI
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError, Error as PlaywrightError


# ============== UTILITY FUNCTIONS ==============

def validate_url(url: str) -> bool:
    """
    Validate that a URL is properly formatted.
    
    Args:
        url: URL string to validate
        
    Returns:
        True if URL is valid, False otherwise
    """
    try:
        result = urllib.parse.urlparse(url)
        return all([result.scheme, result.netloc]) and result.scheme in ('http', 'https')
    except Exception:
        return False


def retry_with_backoff(max_retries: int = 3, initial_delay: float = 1.0):
    """
    Decorator for retrying functions with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            delay = initial_delay
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries:
                        print(f"  Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
                        await asyncio.sleep(delay)
                        delay *= 2  # Exponential backoff
                    else:
                        print(f"  All {max_retries + 1} attempts failed")
            raise last_exception
        return wrapper
    return decorator


# ============== PURE FUNCTIONS ==============

def parse_kimi_response(response_text: str) -> dict[str, Any]:
    """
    Parse Kimi vision API response to extract status and issues.
    
    Args:
        response_text: Raw response from Kimi vision API
        
    Returns:
        Dictionary with 'status' (ok/issues/error) and 'issues' list
    """
    response_lower = response_text.lower()
    
    # Check for explicit error indicators
    if "error" in response_lower or "failed" in response_lower:
        return {"status": "error", "issues": [response_text]}
    
    # Check for issues indicators
    issues_keywords = ["issue", "problem", "wrong", "broken", "missing", "fail", "error", "blank", "empty"]
    found_issues = []
    
    for keyword in issues_keywords:
        if keyword in response_lower:
            # Try to extract the context around the keyword
            pattern = rf".{{0,100}}{keyword}.{{0,100}}"
            matches = re.findall(pattern, response_lower, re.IGNORECASE)
            found_issues.extend(matches)
    
    if found_issues:
        return {"status": "issues", "issues": found_issues[:5]}  # Limit to 5 issues
    
    return {"status": "ok", "issues": []}


def build_report(results: list[dict[str, Any]]) -> str:
    """
    Build Markdown report from QA results.
    
    Args:
        results: List of result dictionaries with url, status, issues, screenshot_path
        
    Returns:
        Markdown formatted report string
    """
    total = len(results)
    ok_count = sum(1 for r in results if r.get("status") == "ok")
    issues_count = sum(1 for r in results if r.get("status") == "issues")
    error_count = sum(1 for r in results if r.get("status") == "error")
    
    report_lines = [
        f"# Workout Import QA Report",
        f"",
        f"**Generated:** {datetime.utcnow().isoformat()} UTC",
        f"",
        f"## Summary",
        f"",
        f"| Total | OK | Issues | Failed |",
        f"|-------|-----|--------|--------|",
        f"| {total} | {ok_count} | {issues_count} | {error_count} |",
        f"",
        f"## Per-URL Findings",
        f"",
    ]
    
    for i, result in enumerate(results, 1):
        url = result.get("url", "Unknown")
        status = result.get("status", "unknown")
        issues = result.get("issues", [])
        screenshot = result.get("screenshot_path", "")
        
        status_emoji = "✅" if status == "ok" else "⚠️" if status == "issues" else "❌"
        
        report_lines.append(f"### {i}. {url}")
        report_lines.append(f"")
        report_lines.append(f"**Status:** {status_emoji} {status.upper()}")
        report_lines.append(f"")
        
        if issues:
            report_lines.append(f"**Issues Found:**")
            for issue in issues:
                report_lines.append(f"- {issue}")
            report_lines.append(f"")
        
        if screenshot:
            report_lines.append(f"**Screenshot:** {screenshot}")
            report_lines.append(f"")
        
        report_lines.append(f"---")
        report_lines.append(f"")
    
    return "\n".join(report_lines)


def set_has_issues_output(results: list[dict[str, Any]], output_path: str = "GITHUB_OUTPUT") -> None:
    """
    Write has_issues=true to GITHUB_OUTPUT when any URL has non-ok status.
    
    Args:
        results: List of result dictionaries
        output_path: Path to GitHub output file
    """
    has_issues = any(r.get("status") != "ok" for r in results)
    
    # Check if running in GitHub Actions environment
    if os.environ.get("GITHUB_OUTPUT"):
        output_path = os.environ.get("GITHUB_OUTPUT")
    
    with open(output_path, "a") as f:
        f.write(f"has_issues={str(has_issues).lower()}\n")


# ============== SIDE-EFFECT FUNCTIONS ==============

async def import_workflow_url(page, url: str, timeout: int = 120) -> dict[str, Any]:
    """
    Import a workout URL via the AmakaFlow UI using Playwright.
    
    Args:
        page: Playwright page object
        url: Workout URL to import
        timeout: Timeout in seconds
        
    Returns:
        Dictionary with import status and details
    """
    result = {"url": url, "status": "unknown", "issues": [], "screenshot_path": ""}
    
    # Validate URL format before attempting import
    if not validate_url(url):
        result["status"] = "error"
        result["issues"].append(f"Invalid URL format: {url}")
        return result
    
    try:
        # Navigate to the app
        await page.goto("http://localhost:3000", wait_until="networkidle", timeout=30000)
        
        # Wait for the URL input field to be visible
        url_input = page.locator('[data-testid="import-url-input"]')
        await url_input.wait_for(state="visible", timeout=10000)
        
        # Enter the URL
        await url_input.fill(url)
        
        # Click the import button
        submit_button = page.locator('[data-testid="import-url-submit"]')
        await submit_button.click()
        
        # Wait for streaming to complete (button text changes from "Importing..." to "Import")
        max_wait = timeout * 1000  # Convert to milliseconds
        start_time = asyncio.get_event_loop().time()
        
        while True:
            button_text = await submit_button.text_content()
            if button_text and "Import" in button_text and "Importing" not in button_text:
                break
            if (asyncio.get_event_loop().time() - start_time) * 1000 > max_wait:
                result["status"] = "error"
                result["issues"].append("Timeout waiting for import to complete")
                break
            await asyncio.sleep(1)
        
        # Wait a bit for any animations/renders
        await asyncio.sleep(2)
        
        # Take screenshot
        screenshot_dir = Path("artifacts/screenshots")
        screenshot_dir.mkdir(parents=True, exist_ok=True)
        
        # Create a safe filename from URL
        safe_name = re.sub(r'[^\w\-_]', '_', url.split('/')[-2] if url.split('/')[-2] else url.split('/')[-1])
        screenshot_path = screenshot_dir / f"{safe_name}.png"
        
        await page.screenshot(path=str(screenshot_path), full_page=True)
        
        result["screenshot_path"] = str(screenshot_path)
        
        if result["status"] == "unknown":
            result["status"] = "ok"
            
    except PlaywrightTimeoutError as e:
        result["status"] = "error"
        result["issues"].append(f"Playwright timeout: {str(e)}")
    except PlaywrightError as e:
        result["status"] = "error"
        result["issues"].append(f"Playwright error: {str(e)}")
    except Exception as e:
        result["status"] = "error"
        result["issues"].append(str(e))
    
    return result


async def analyze_screenshot_with_kimi(screenshot_path: str) -> dict[str, Any]:
    """
    Send screenshot to Kimi vision API for analysis.
    
    Args:
        screenshot_path: Path to the screenshot file
        
    Returns:
        Analysis result from Kimi
    """
    # Check if screenshot file exists
    if not os.path.exists(screenshot_path):
        return {"status": "error", "issues": [f"Screenshot file not found: {screenshot_path}"]}
    
    # Check file size before processing (limit to 10MB)
    file_size = os.path.getsize(screenshot_path)
    if file_size > 10 * 1024 * 1024:
        return {"status": "error", "issues": [f"Screenshot file too large: {file_size} bytes (max 10MB)"]}
    
    api_key = os.environ.get("MOONSHOT_API_KEY")
    if not api_key:
        return {"status": "error", "issues": ["MOONSHOT_API_KEY not set"]}
    
    client = OpenAI(
        api_key=api_key,
        base_url="https://api.moonshot.cn/v1"
    )
    
    try:
        with open(screenshot_path, "rb") as image_file:
            image_data = image_file.read()
        
        return await _call_kimi_api(client, image_data)
        
    except Exception as e:
        return {"status": "error", "issues": [str(e)]}


@retry_with_backoff(max_retries=3, initial_delay=1.0)
async def _call_kimi_api(client: OpenAI, image_data: bytes) -> dict[str, Any]:
    """
    Call Kimi vision API with retry logic.
    
    Args:
        client: OpenAI client configured for Kimi
        image_data: Raw image bytes
        
    Returns:
        Analysis result from Kimi
    """
    response = client.chat.completions.create(
        model="moonshot-v1-vision-preview",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Analyze this screenshot of the AmakaFlow workout import UI. What, if anything, looks wrong? Look for: blank areas, broken layouts, missing data, error messages, or any visual issues. Respond with a brief description of any problems you find, or say 'OK' if everything looks correct."
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_data.hex()}"
                        }
                    }
                ]
            }
        ],
        max_tokens=300
    )
    
    response_text = response.choices[0].message.content
    return parse_kimi_response(response_text)


def send_telegram_message(bot_token: str, chat_id: str, message: str) -> dict:
    """
    Send a message via Telegram Bot API.
    
    Args:
        bot_token: Telegram bot token
        chat_id: Target chat ID
        message: Message to send
        
    Returns:
        API response
    """
    import requests
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    data = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown"
    }
    
    response = requests.post(url, json=data)
    return response.json()


def send_telegram_photo(bot_token: str, chat_id: str, photo_path: str, caption: str = "") -> dict:
    """
    Send a photo via Telegram Bot API.
    
    Args:
        bot_token: Telegram bot token
        chat_id: Target chat ID
        photo_path: Path to photo file
        caption: Optional caption
        
    Returns:
        API response
    """
    import requests
    
    url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
    data = {
        "chat_id": chat_id,
        "caption": caption
    }
    
    with open(photo_path, "rb") as photo:
        files = {"photo": photo}
        response = requests.post(url, data=data, files=files)
    
    return response.json()


def send_telegram_report(report: str, screenshot_paths: list[str], issues_found: bool = True) -> None:
    """
    Send QA report and screenshots via Telegram.
    
    Args:
        report: Markdown report text
        screenshot_paths: List of screenshot file paths
        issues_found: Whether any issues were found
    """
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "7888191549")
    
    if not bot_token:
        print("WARNING: TELEGRAM_BOT_TOKEN not set, skipping Telegram notification")
        return
    
    # Send the report message
    send_telegram_message(bot_token, chat_id, report)
    
    # Send each screenshot if there are issues
    if issues_found:
        for screenshot_path in screenshot_paths:
            if os.path.exists(screenshot_path):
                caption = os.path.basename(screenshot_path)
                send_telegram_photo(bot_token, chat_id, screenshot_path, caption)


# ============== MAIN ORCHESTRATION ==============

async def run_qa(urls: list[str], headed: bool = False, timeout: int = 120) -> list[dict[str, Any]]:
    """
    Run the full QA workflow.
    
    Args:
        urls: List of workout URLs to test
        headed: Whether to run browser in headed mode
        timeout: Timeout per URL in seconds
        
    Returns:
        List of results
    """
    results = []
    
    async with async_playwright() as p:
        # Launch browser
        launch_options = {"headless": not headed}
        browser = await p.chromium.launch(**launch_options)
        
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()
        
        for url in urls:
            print(f"Testing URL: {url}")
            
            # Import the URL
            result = await import_workflow_url(page, url, timeout)
            
            # Analyze screenshot with Kimi if we have one
            if result.get("screenshot_path"):
                print(f"  Analyzing screenshot with Kimi...")
                analysis = await analyze_screenshot_with_kimi(result["screenshot_path"])
                result["status"] = analysis.get("status", result["status"])
                result["issues"].extend(analysis.get("issues", []))
            
            print(f"  Status: {result['status']}")
            results.append(result)
        
        await browser.close()
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Workout Import QA Script")
    parser.add_argument("--urls", required=True, help="Path to JSON file with workout URLs")
    parser.add_argument("--headed", action="store_true", help="Run browser in headed mode")
    parser.add_argument("--timeout", type=int, default=120, help="Timeout per URL in seconds")
    parser.add_argument("--output", default="artifacts/workout-qa-report.md", help="Output report path")
    
    args = parser.parse_args()
    
    # Load URLs
    with open(args.urls, "r") as f:
        urls_data = json.load(f)
    
    urls = [item["url"] for item in urls_data]
    
    # Run QA
    results = asyncio.run(run_qa(urls, args.headed, args.timeout))
    
    # Build report
    report = build_report(results)
    
    # Save report
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w") as f:
        f.write(report)
    
    print(f"\nReport saved to: {args.output}")
    
    # Set GitHub output
    set_has_issues_output(results)
    
    # Send Telegram notification if there are issues
    has_issues = any(r.get("status") != "ok" for r in results)
    if has_issues:
        screenshot_paths = [r.get("screenshot_path", "") for r in results if r.get("screenshot_path")]
        send_telegram_report(report, screenshot_paths, has_issues)
        print("Telegram notification sent!")
    
    # Return exit code based on results
    sys.exit(0 if not has_issues else 1)


if __name__ == "__main__":
    main()
