#!/bin/bash
# Run smoke tests and report results to Telegram
set -euo pipefail

APP_DIR="/Users/davidmini/.openclaw/workspace/amakaflow-ui"
SCREENSHOTS_DIR="$APP_DIR/test-results/smoke-screenshots"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
REPORT_DIR="$APP_DIR/test-results/smoke-$TIMESTAMP"

cd "$APP_DIR"

# Run smoke test, capture output
mkdir -p "$REPORT_DIR"
OUTPUT=$(node scripts/smoke-test.mjs --screenshots-dir "$REPORT_DIR" 2>&1) || true

# Extract results
PAGES_TESTED=$(echo "$OUTPUT" | grep "^PAGES_TESTED:" | cut -d' ' -f2)
PAGES_PASSED=$(echo "$OUTPUT" | grep "^PAGES_PASSED:" | cut -d' ' -f2)
PAGES_FAILED=$(echo "$OUTPUT" | grep "^PAGES_FAILED:" | cut -d' ' -f2)
FAILURES=$(echo "$OUTPUT" | grep "^FAILURES:" | cut -d' ' -f2-)

echo "$OUTPUT"
echo ""
echo "Report saved to: $REPORT_DIR"
echo "SMOKE_TIMESTAMP: $TIMESTAMP"
echo "SMOKE_REPORT_DIR: $REPORT_DIR"
