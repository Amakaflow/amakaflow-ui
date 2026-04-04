#!/bin/bash
# Run smoke tests and send results to Telegram
set -uo pipefail

APP_DIR="/Users/davidmini/.openclaw/workspace/amakaflow-ui"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
REPORT_DIR="$APP_DIR/test-results/smoke-$TIMESTAMP"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.volta/bin"

cd "$APP_DIR"
mkdir -p "$REPORT_DIR"

# Run smoke test
OUTPUT=$(node scripts/smoke-test.mjs --screenshots-dir "$REPORT_DIR" 2>&1) || true
EXIT_CODE=$?

# Extract results
PAGES_TESTED=$(echo "$OUTPUT" | grep "^PAGES_TESTED:" | head -1 | awk '{print $2}')
PAGES_PASSED=$(echo "$OUTPUT" | grep "^PAGES_PASSED:" | head -1 | awk '{print $2}')
PAGES_FAILED=$(echo "$OUTPUT" | grep "^PAGES_FAILED:" | head -1 | awk '{print $2}')

# Log
echo "$OUTPUT"
echo ""
echo "Timestamp: $TIMESTAMP"
echo "Exit code: $EXIT_CODE"
echo "Report dir: $REPORT_DIR"
