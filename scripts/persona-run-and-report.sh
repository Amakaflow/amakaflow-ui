#!/bin/bash
# persona-run-and-report.sh — Run persona engine, push diaries, notify Telegram, auto-ticket failures
set -euo pipefail

export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.volta/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

CHAT_ID="7888191549"
UI_DIR="$HOME/.openclaw/workspace/amakaflow-ui"
DOCS_DIR="$HOME/.openclaw/workspace/amakaflow-docs"
BACKEND_DIR="$HOME/.openclaw/workspace/amakaflow-backend"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)

# ── Auto-start required services ─────────────────────────────────────
# Mock Garmin server (port 8099) — needed for Marcus + Ray persona tests
if ! curl -s http://localhost:8099/health > /dev/null 2>&1; then
  echo "[$(date)] Starting mock Garmin server..."
  cd "$BACKEND_DIR/services/garmin-sync-api"
  nohup python3.11 tests/mock_garmin_server.py > /tmp/mock-garmin.log 2>&1 &
  sleep 3
fi

# Backend services (8001-8005) — needed for API persona tests
for port in 8001 8004 8005; do
  if ! curl -s http://localhost:$port/health > /dev/null 2>&1; then
    echo "[$(date)] Service on port $port not running — persona API tests may fail"
  fi
done

# Load Telegram token
TELEGRAM_TOKEN=""
if [ -f "$HOME/.claude/channels/telegram/.env" ]; then
  TELEGRAM_TOKEN=$(grep TELEGRAM_BOT_TOKEN "$HOME/.claude/channels/telegram/.env" | cut -d= -f2)
fi

send_telegram() {
  if [ -n "$TELEGRAM_TOKEN" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
      -d "chat_id=${CHAT_ID}" \
      -d "text=$1" > /dev/null 2>&1 || true
  fi
}

echo "[$(date)] Starting persona run..."

# Run persona engine
cd "$UI_DIR"
OUTPUT=$(node scripts/persona-engine.mjs 2>&1) || true
echo "$OUTPUT"

# Extract summary lines
SUMMARY=$(echo "$OUTPUT" | grep -E "^\s+(✅|⚠️)" | grep -E "Sarah|Marcus|Lisa|Ray|Priya" | head -5)
TOTAL=$(echo "$OUTPUT" | grep "^Total:" | head -1)

# Extract failures for auto-ticketing
FAILURES=$(echo "$OUTPUT" | grep "❌" | sed 's/^[[:space:]]*//' | head -10)
FAILURE_COUNT=$(echo "$OUTPUT" | grep -c "❌" || echo "0")

# Push diaries to GitHub
cd "$DOCS_DIR"
git add persona-diaries/ 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "docs: persona diary run $DATE $TIME (automated)" 2>/dev/null || true
  git push origin main 2>/dev/null || true
  echo "Diaries pushed to GitHub"
else
  echo "No new diary files"
fi

# Auto-ticket failures via Linear MCP (or gh CLI)
if [ "$FAILURE_COUNT" -gt 0 ] && [ "$FAILURE_COUNT" != "0" ]; then
  echo "Found $FAILURE_COUNT failures — creating ticket..."

  TICKET_BODY="## Persona Test Failures — $DATE $TIME

$FAILURE_COUNT step(s) failed during automated persona testing.

### Failures:
\`\`\`
$FAILURES
\`\`\`

### Full Summary:
$SUMMARY

### Diaries:
https://github.com/Amakaflow/amakaflow-docs/tree/main/persona-diaries/$DATE

### Action:
Review each failure. If it's a real bug, fix it. If it's a test selector issue, update the persona config."

  # Create GitHub issue for tracking (labels may not exist, so omit them)
  cd "$DOCS_DIR"
  gh issue create --repo Amakaflow/amakaflow-docs \
    --title "Persona test failures — $DATE ($FAILURE_COUNT steps)" \
    --body "$TICKET_BODY" 2>/dev/null || echo "Could not create GitHub issue — check gh auth"
fi

# Send Telegram notification
MSG="🎭 Persona Test Run — $DATE $TIME

$SUMMARY

$TOTAL

$([ "$FAILURE_COUNT" -gt 0 ] && echo "⚠️ $FAILURE_COUNT failure(s) — ticket created" || echo "✅ All steps passed!")

Diaries: github.com/Amakaflow/amakaflow-docs/tree/main/persona-diaries/$DATE"

send_telegram "$MSG"

echo "[$(date)] Done. Failures: $FAILURE_COUNT"
