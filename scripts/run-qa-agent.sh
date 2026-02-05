#!/bin/bash
# run-qa-agent.sh - Main entry point for OpenClaw QA automation
# Uses Kimi K2.5 for orchestration, MiniMax M2 for coding

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$ROOT_DIR/.env" ]; then
  source "$ROOT_DIR/.env"
fi

# Verify API keys
if [ -z "${MOONSHOT_API_KEY:-}" ]; then
  echo "Error: MOONSHOT_API_KEY not set" >&2
  echo "Get your key at: https://platform.moonshot.ai/" >&2
  exit 1
fi

# Parse arguments
PLATFORM="${1:-all}"
SUITE="${2:-smoke}"
MODE="${3:-run}"

if [ "$MODE" = "analyze" ] && [ -z "${MINIMAX_API_KEY:-}" ]; then
  echo "Warning: MINIMAX_API_KEY not set - code fix suggestions will be unavailable" >&2
fi

echo "========================================"
echo "AmakaFlow QA Agent"
echo "========================================"
echo "Platform: $PLATFORM"
echo "Suite: $SUITE"
echo "Mode: $MODE"
echo "Orchestration: Kimi K2.5"
echo "Coding: MiniMax M2"
echo "========================================"

# Create artifacts directory
mkdir -p "$ROOT_DIR/artifacts/screenshots"
mkdir -p "$ROOT_DIR/artifacts/logs"
mkdir -p "$ROOT_DIR/artifacts/reports"

# Check for jq dependency
if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed" >&2
  exit 1
fi

# Function to call orchestration model
call_orchestrator() {
  local prompt="$1"
  local system_prompt
  system_prompt=$(cat "$ROOT_DIR/prompts/orchestration-agent.md")

  local json_payload
  json_payload=$(jq -n \
    --arg model "kimi-k2.5" \
    --arg system "$system_prompt" \
    --arg user "$prompt" \
    '{
      model: $model,
      messages: [
        {role: "system", content: $system},
        {role: "user", content: $user}
      ],
      temperature: 0,
      max_tokens: 4096
    }')

  local http_response http_status body
  http_response=$(curl -s -w "\n%{http_code}" --connect-timeout 10 --max-time 120 \
    "https://api.moonshot.ai/v1/chat/completions" \
    -H "Authorization: Bearer $MOONSHOT_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$json_payload")

  http_status=$(echo "$http_response" | tail -1)
  body=$(echo "$http_response" | sed '$d')

  if [ "$http_status" -ge 400 ]; then
    echo "Error: Orchestration API failed with status $http_status" >&2
    echo "$body" >&2
    return 1
  fi

  echo "$body" | jq -r '.choices[0].message.content'
}

# Function to call coding model
call_coder() {
  local prompt="$1"
  if [ -z "${MINIMAX_API_KEY:-}" ]; then
    echo "Warning: MINIMAX_API_KEY not set, skipping code generation" >&2
    return 1
  fi

  local json_payload
  json_payload=$(jq -n \
    --arg model "minimax-m2" \
    --arg user "$prompt" \
    '{
      model: $model,
      messages: [{role: "user", content: $user}],
      temperature: 0.1,
      max_tokens: 8192
    }')

  local http_response http_status body
  http_response=$(curl -s -w "\n%{http_code}" --connect-timeout 10 --max-time 120 \
    "https://api.minimax.chat/v1/chat/completions" \
    -H "Authorization: Bearer $MINIMAX_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$json_payload")

  http_status=$(echo "$http_response" | tail -1)
  body=$(echo "$http_response" | sed '$d')

  if [ "$http_status" -ge 400 ]; then
    echo "Error: Coder API failed with status $http_status" >&2
    echo "$body" >&2
    return 1
  fi

  echo "$body" | jq -r '.choices[0].message.content'
}

# Verify prerequisites
check_prerequisites() {
  echo "Checking prerequisites..."

  # Check Maestro
  if ! command -v maestro &> /dev/null; then
    echo "Error: Maestro not installed" >&2
    echo "Install with: curl -Ls https://get.maestro.mobile.dev | bash" >&2
    exit 1
  fi

  # Check platform availability
  case "$PLATFORM" in
    ios|all)
      if ! xcrun simctl list devices 2>/dev/null | grep -q "Booted"; then
        echo "Warning: No iOS simulator booted" >&2
        echo "Boot with: xcrun simctl boot 'iPhone 15 Pro'" >&2
      fi
      ;;
    android|all)
      if ! adb devices 2>/dev/null | grep -q "device$"; then
        echo "Warning: No Android device connected" >&2
        echo "Start emulator: emulator -avd Pixel_7_API_34 &" >&2
      fi
      ;;
  esac

  echo "Prerequisites check complete"
}

# Run tests for a platform
run_platform_tests() {
  local platform="$1"
  local suite="$2"
  local flow_path="$ROOT_DIR/flows/$platform/$suite.yaml"

  echo "Running $suite tests on $platform..."

  if [ ! -f "$flow_path" ]; then
    echo "Warning: Flow not found: $flow_path" >&2
    return 1
  fi

  # Run Maestro test
  local output_file="$ROOT_DIR/artifacts/reports/${platform}-${suite}-$(date +%Y%m%d-%H%M%S).xml"

  if maestro test "$flow_path" --format junit --output "$output_file" 2>&1; then
    echo "PASS: $platform $suite"
    return 0
  else
    echo "FAIL: $platform $suite"
    # Capture failure info
    maestro hierarchy > "$ROOT_DIR/artifacts/logs/${platform}-hierarchy-$(date +%Y%m%d-%H%M%S).txt" 2>/dev/null || true
    return 1
  fi
}

# Main execution
main() {
  check_prerequisites

  local failed=0
  local passed=0

  case "$PLATFORM" in
    ios)
      run_platform_tests "ios" "$SUITE" && ((++passed)) || ((++failed))
      ;;
    android)
      run_platform_tests "android" "$SUITE" && ((++passed)) || ((++failed))
      ;;
    all)
      run_platform_tests "ios" "$SUITE" && ((++passed)) || ((++failed))
      run_platform_tests "android" "$SUITE" && ((++passed)) || ((++failed))
      ;;
    *)
      echo "Unknown platform: $PLATFORM" >&2
      echo "Valid options: ios, android, all" >&2
      exit 1
      ;;
  esac

  echo "========================================"
  echo "Results: $passed passed, $failed failed"
  echo "========================================"

  # If failures, ask orchestrator for analysis
  if [ $failed -gt 0 ] && [ "$MODE" = "analyze" ]; then
    echo "Analyzing failures..."
    local analysis
    analysis=$(call_orchestrator "Tests failed. Analyze the failures in artifacts/reports/ and suggest fixes.")
    echo "$analysis"

    # If analysis suggests code fix, call coder
    if echo "$analysis" | grep -qi "element.*not found\|accessibility.*ID\|fix.*flow"; then
      echo "Requesting code fix from MiniMax..."
      local fix
      fix=$(call_coder "Fix the Maestro test flow based on this analysis: $analysis")
      echo "$fix"
    fi
  fi

  exit $failed
}

main
