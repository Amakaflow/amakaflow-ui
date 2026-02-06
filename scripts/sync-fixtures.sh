#!/usr/bin/env bash
# sync-fixtures.sh
#
# Copies shared fixture JSON files into each platform's app bundle.
# Run after adding or editing fixtures, or as a CI step before building.
#
# Usage: ./scripts/sync-fixtures.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$REPO_ROOT/fixtures/workouts"

# Target directories (relative to monorepo root)
MONOREPO_ROOT="$(cd "$REPO_ROOT/.." && pwd)"
IOS_TARGET="$MONOREPO_ROOT/amakaflow-ios-app/amakaflow-ios-app/AmakaFlow/Resources/Fixtures"

echo "=== AmakaFlow Fixture Sync ==="
echo "Source:  $FIXTURES_DIR"

# Count source fixtures
FIXTURE_COUNT=$(ls -1 "$FIXTURES_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$FIXTURE_COUNT" -eq 0 ]; then
    echo "ERROR: No fixture JSON files found in $FIXTURES_DIR"
    exit 1
fi
echo "Found $FIXTURE_COUNT fixture file(s)"

# --- iOS ---
if [ -d "$MONOREPO_ROOT/amakaflow-ios-app" ]; then
    echo ""
    echo "--- iOS ---"
    mkdir -p "$IOS_TARGET"
    cp "$FIXTURES_DIR"/*.json "$IOS_TARGET/"
    echo "Copied $FIXTURE_COUNT fixture(s) to $IOS_TARGET/"
    ls -1 "$IOS_TARGET"/*.json
else
    echo ""
    echo "--- iOS ---"
    echo "SKIP: amakaflow-ios-app not found at $MONOREPO_ROOT/amakaflow-ios-app"
fi

# --- Android (placeholder) ---
ANDROID_TARGET="$MONOREPO_ROOT/amakaflow-android-app/app/src/debug/assets/fixtures"
if [ -d "$MONOREPO_ROOT/amakaflow-android-app" ]; then
    echo ""
    echo "--- Android ---"
    mkdir -p "$ANDROID_TARGET"
    cp "$FIXTURES_DIR"/*.json "$ANDROID_TARGET/"
    echo "Copied $FIXTURE_COUNT fixture(s) to $ANDROID_TARGET/"
    ls -1 "$ANDROID_TARGET"/*.json
else
    echo ""
    echo "--- Android ---"
    echo "SKIP: amakaflow-android-app not found at $MONOREPO_ROOT/amakaflow-android-app"
fi

echo ""
echo "=== Sync complete ==="
