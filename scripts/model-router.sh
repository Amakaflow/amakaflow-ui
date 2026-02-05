#!/bin/bash
# model-router.sh - Routes requests to appropriate model based on task type
#
# Usage: ./model-router.sh <task-type> <prompt>
#
# Task types:
#   code, coding, write-code, edit-code, fix-code -> MiniMax M2
#   orchestration (default), *                     -> Kimi K2.5

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TASK_TYPE="${1:-orchestration}"
PROMPT="${2:-}"

# Validate prompt is provided
if [ -z "$PROMPT" ]; then
  echo "Error: Prompt is required" >&2
  echo "Usage: $0 <task-type> <prompt>" >&2
  exit 1
fi

# Load environment from project root
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
fi

# Determine which model to use
case "$TASK_TYPE" in
  "code"|"coding"|"write-code"|"edit-code"|"fix-code")
    API_KEY="${MINIMAX_API_KEY:-}"
    BASE_URL="https://api.minimax.chat/v1"
    MODEL="${CODING_MODEL:-minimax-m2}"
    ;;
  *)
    API_KEY="${MOONSHOT_API_KEY:-}"
    BASE_URL="https://api.moonshot.ai/v1"
    MODEL="${ORCHESTRATION_MODEL:-kimi-k2.5}"
    ;;
esac

if [ -z "$API_KEY" ]; then
  echo "Error: API key not set for $TASK_TYPE task" >&2
  exit 1
fi

# Build JSON payload safely using jq
if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed" >&2
  exit 1
fi

JSON_PAYLOAD=$(jq -n \
  --arg model "$MODEL" \
  --arg prompt "$PROMPT" \
  '{model: $model, messages: [{role: "user", content: $prompt}], temperature: 0}')

# Make API call with timeout and error handling
HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" \
  --connect-timeout 10 \
  --max-time 120 \
  "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -1)
BODY=$(echo "$HTTP_RESPONSE" | sed '$d')

if [ "$HTTP_STATUS" -ge 400 ]; then
  echo "Error: API request failed with status $HTTP_STATUS" >&2
  echo "$BODY" >&2
  exit 1
fi

echo "$BODY"
