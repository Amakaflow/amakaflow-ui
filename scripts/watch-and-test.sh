#!/bin/bash
# watch-and-test.sh - Watch for app changes and run tests automatically
# Note: Requires macOS (uses macOS-specific stat command; also iOS testing requires macOS)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
IOS_APP_DIR="${IOS_APP_DIR:-$ROOT_DIR/../../amakaflow-ios-app}"
ANDROID_APP_DIR="${ANDROID_APP_DIR:-$ROOT_DIR/../../amakaflow-android-app}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"
SUITE="${1:-smoke}"

echo "========================================"
echo "AmakaFlow QA Watch Mode"
echo "========================================"
echo "Watching for changes..."
echo "iOS app dir: $IOS_APP_DIR"
echo "Android app dir: $ANDROID_APP_DIR"
echo "Poll interval: ${POLL_INTERVAL}s"
echo "Test suite: $SUITE"
echo "Press Ctrl+C to stop"
echo "========================================"

# Check watched directories exist
if [ ! -d "$IOS_APP_DIR" ]; then
  echo "Warning: iOS app directory not found: $IOS_APP_DIR" >&2
fi
if [ ! -d "$ANDROID_APP_DIR" ]; then
  echo "Warning: Android app directory not found: $ANDROID_APP_DIR" >&2
fi

# Track last modification times
ios_last_mod=0
android_last_mod=0

get_last_mod() {
  local dir="$1"
  if [ -d "$dir" ]; then
    find "$dir" -type f \( -name "*.swift" -o -name "*.kt" -o -name "*.java" \) 2>/dev/null | \
      xargs stat -f "%m" 2>/dev/null | sort -n | tail -1 || echo "0"
  else
    echo "0"
  fi
}

# Clean shutdown on Ctrl+C
trap 'echo ""; echo "Watch mode stopped"; exit 0' SIGINT SIGTERM

while true; do
  # Check iOS changes
  ios_current=$(get_last_mod "$IOS_APP_DIR")
  if [ "$ios_current" != "$ios_last_mod" ] && [ "$ios_last_mod" != "0" ]; then
    echo ""
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] iOS app changed, running tests..."
    "$SCRIPT_DIR/run-qa-agent.sh" ios "$SUITE" analyze || true
    ios_last_mod="$ios_current"
  elif [ "$ios_last_mod" = "0" ]; then
    ios_last_mod="$ios_current"
  fi

  # Check Android changes
  android_current=$(get_last_mod "$ANDROID_APP_DIR")
  if [ "$android_current" != "$android_last_mod" ] && [ "$android_last_mod" != "0" ]; then
    echo ""
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Android app changed, running tests..."
    "$SCRIPT_DIR/run-qa-agent.sh" android "$SUITE" analyze || true
    android_last_mod="$android_current"
  elif [ "$android_last_mod" = "0" ]; then
    android_last_mod="$android_current"
  fi

  sleep "$POLL_INTERVAL"
done
