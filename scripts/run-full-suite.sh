#!/usr/bin/env bash
#
# AmakaFlow Test Runner
#
# Single command entry point for running test suites via OpenClaw and Maestro
# Supports web, iOS, Android, watchOS, and Wear OS platforms
#
# Usage:
#   ./scripts/run-full-suite.sh [suite] [platform] [options]
#
# Suites:
#   smoke   - Quick validation (<3 min) [default]
#   health  - Service health checks (~30s) [web only]
#   golden  - UI golden paths (~15 min)
#   api     - API contract validation (~5 min) [web only]
#   ios     - iOS + watchOS tests
#   android - Android + Wear OS tests
#   mobile  - All mobile platforms
#   full    - All platforms, all tests
#
# Platforms:
#   all     - All available platforms [default]
#   web     - Web UI only
#   ios     - iOS phone only
#   android - Android phone only
#   watchos - Apple Watch only
#   wearos  - Wear OS only
#   mobile  - All mobile (iOS + Android + watches)
#
# Options (via environment variables):
#   CLEAN_ARTIFACTS=true  - Clean previous artifacts before run
#   TEST_TIMEOUT=300      - Timeout per test in seconds (default: 300)
#   JUNIT_OUTPUT=true     - Generate JUnit XML reports
#

set -euo pipefail

# ============================================
# Java PATH Configuration for Maestro
# ============================================
# Non-interactive shells don't source ~/.zshrc, so explicitly set Java paths
# This is critical for CI/automation contexts
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk}"
export PATH="$JAVA_HOME/bin:$PATH"

# Require Bash 4.0+ for associative arrays
if ((BASH_VERSINFO[0] < 4)); then
  echo "Error: This script requires Bash 4.0 or higher"
  echo "Current version: $BASH_VERSION"
  echo ""
  echo "On macOS, install with: brew install bash"
  echo "Then run with: /opt/homebrew/bin/bash $0 $*"
  exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Arguments
SUITE="${1:-smoke}"
PLATFORM="${2:-all}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Options from environment
CLEAN_ARTIFACTS="${CLEAN_ARTIFACTS:-false}"
TEST_TIMEOUT="${TEST_TIMEOUT:-300}"
JUNIT_OUTPUT="${JUNIT_OUTPUT:-true}"

# Validate suite argument
case "$SUITE" in
  smoke|health|golden|api|ios|android|mobile|full)
    ;;
  *)
    echo -e "${RED}Error: Invalid suite '$SUITE'${NC}"
    echo "Valid suites: smoke, health, golden, api, ios, android, mobile, full"
    exit 1
    ;;
esac

# Validate platform argument
case "$PLATFORM" in
  all|web|ios|android|watchos|wearos|mobile)
    ;;
  *)
    echo -e "${RED}Error: Invalid platform '$PLATFORM'${NC}"
    echo "Valid platforms: all, web, ios, android, watchos, wearos, mobile"
    exit 1
    ;;
esac

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AmakaFlow Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Suite:     ${GREEN}$SUITE${NC}"
echo -e "Platform:  ${CYAN}$PLATFORM${NC}"
echo -e "Timestamp: ${YELLOW}$TIMESTAMP${NC}"
echo -e "Timeout:   ${TEST_TIMEOUT}s per test"
echo -e "Project:   $PROJECT_DIR"
echo ""

# Determine which platforms to test
RUN_WEB=false
RUN_IOS=false
RUN_ANDROID=false
RUN_WATCHOS=false
RUN_WEAROS=false

case "$PLATFORM" in
  all)
    RUN_WEB=true
    RUN_IOS=true
    RUN_ANDROID=true
    RUN_WATCHOS=true
    RUN_WEAROS=true
    ;;
  web)
    RUN_WEB=true
    ;;
  ios)
    RUN_IOS=true
    ;;
  android)
    RUN_ANDROID=true
    ;;
  watchos)
    RUN_WATCHOS=true
    ;;
  wearos)
    RUN_WEAROS=true
    ;;
  mobile)
    RUN_IOS=true
    RUN_ANDROID=true
    RUN_WATCHOS=true
    RUN_WEAROS=true
    ;;
esac

# Adjust based on suite
case "$SUITE" in
  health|api)
    # Web only suites
    RUN_IOS=false
    RUN_ANDROID=false
    RUN_WATCHOS=false
    RUN_WEAROS=false
    ;;
  ios)
    RUN_WEB=false
    RUN_ANDROID=false
    RUN_WEAROS=false
    RUN_IOS=true
    RUN_WATCHOS=true
    ;;
  android)
    RUN_WEB=false
    RUN_IOS=false
    RUN_WATCHOS=false
    RUN_ANDROID=true
    RUN_WEAROS=true
    ;;
  mobile)
    RUN_WEB=false
    ;;
  smoke)
    # Smoke doesn't include watch apps
    RUN_WATCHOS=false
    RUN_WEAROS=false
    ;;
esac

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check for ANTHROPIC_API_KEY
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo -e "${RED}Error: ANTHROPIC_API_KEY environment variable not set${NC}"
  echo "Set it with: export ANTHROPIC_API_KEY=sk-..."
  exit 1
fi
echo -e "  ${GREEN}✓${NC} ANTHROPIC_API_KEY is set"

# Clean previous artifacts if requested
if [[ "$CLEAN_ARTIFACTS" == "true" ]]; then
  echo -e "  ${YELLOW}Cleaning previous artifacts...${NC}"
  rm -rf "$PROJECT_DIR/artifacts/screenshots/"*.png 2>/dev/null || true
  rm -rf "$PROJECT_DIR/artifacts/logs/"*.log 2>/dev/null || true
  rm -rf "$PROJECT_DIR/artifacts/reports/"*.json 2>/dev/null || true
  rm -rf "$PROJECT_DIR/artifacts/reports/"*.xml 2>/dev/null || true
fi

# Create artifacts directories
mkdir -p "$PROJECT_DIR/artifacts/screenshots"
mkdir -p "$PROJECT_DIR/artifacts/logs"
mkdir -p "$PROJECT_DIR/artifacts/reports"
echo -e "  ${GREEN}✓${NC} Artifacts directories ready"

# Check web prerequisites
if [[ "$RUN_WEB" == "true" ]]; then
  if command -v docker &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Docker available (for web tests)"
  else
    echo -e "  ${YELLOW}!${NC} Docker not found - web tests will run natively"
  fi
fi

# Check mobile prerequisites
if [[ "$RUN_IOS" == "true" ]] || [[ "$RUN_WATCHOS" == "true" ]]; then
  if command -v maestro &> /dev/null; then
    MAESTRO_VERSION=$(maestro --version 2>/dev/null || echo "unknown")
    echo -e "  ${GREEN}✓${NC} Maestro installed ($MAESTRO_VERSION)"
  else
    echo -e "${RED}Error: Maestro not installed${NC}"
    echo "Install with: curl -Ls https://get.maestro.mobile.dev | bash"
    exit 1
  fi

  if xcrun simctl list 2>/dev/null | grep -q "Booted"; then
    BOOTED_SIM=$(xcrun simctl list | grep "Booted" | head -1)
    echo -e "  ${GREEN}✓${NC} iOS Simulator booted: $BOOTED_SIM"
  else
    echo -e "${YELLOW}Warning: No iOS simulator booted${NC}"
    echo "Boot with: xcrun simctl boot 'iPhone 15 Pro'"
    if [[ "$RUN_IOS" == "true" ]]; then
      RUN_IOS=false
      echo -e "  ${YELLOW}!${NC} Skipping iOS tests"
    fi
  fi
fi

if [[ "$RUN_ANDROID" == "true" ]] || [[ "$RUN_WEAROS" == "true" ]]; then
  if command -v adb &> /dev/null; then
    if adb devices 2>/dev/null | grep -q "device$"; then
      DEVICE=$(adb devices | grep "device$" | head -1 | cut -f1)
      echo -e "  ${GREEN}✓${NC} Android device/emulator connected: $DEVICE"
    else
      echo -e "${YELLOW}Warning: No Android device/emulator connected${NC}"
      echo "Start with: emulator -avd Pixel_7_API_34 &"
      if [[ "$RUN_ANDROID" == "true" ]]; then
        RUN_ANDROID=false
        echo -e "  ${YELLOW}!${NC} Skipping Android tests"
      fi
    fi
  else
    echo -e "${YELLOW}Warning: adb not found${NC}"
    RUN_ANDROID=false
    RUN_WEAROS=false
  fi
fi

echo ""
echo -e "${YELLOW}Test Configuration:${NC}"
echo -e "  Web:     $([ "$RUN_WEB" == "true" ] && echo -e "${GREEN}Yes${NC}" || echo -e "${YELLOW}No${NC}")"
echo -e "  iOS:     $([ "$RUN_IOS" == "true" ] && echo -e "${GREEN}Yes${NC}" || echo -e "${YELLOW}No${NC}")"
echo -e "  Android: $([ "$RUN_ANDROID" == "true" ] && echo -e "${GREEN}Yes${NC}" || echo -e "${YELLOW}No${NC}")"
echo -e "  watchOS: $([ "$RUN_WATCHOS" == "true" ] && echo -e "${GREEN}Yes${NC}" || echo -e "${YELLOW}No${NC}")"
echo -e "  Wear OS: $([ "$RUN_WEAROS" == "true" ] && echo -e "${GREEN}Yes${NC}" || echo -e "${YELLOW}No${NC}")"
echo ""

# Check if any tests will run
if [[ "$RUN_WEB" == "false" ]] && [[ "$RUN_IOS" == "false" ]] && [[ "$RUN_ANDROID" == "false" ]]; then
  echo -e "${RED}Error: No platforms available to test${NC}"
  exit 1
fi

echo -e "${YELLOW}Starting test suite: $SUITE${NC}"
echo ""

# Track results
OVERALL_EXIT=0
declare -A PLATFORM_RESULTS

# Helper function to run Maestro with timeout and optional JUnit output
run_maestro_test() {
  local flow_file="$1"
  local platform="$2"
  local result=0

  echo -e "  Running: ${CYAN}$flow_file${NC}"

  # Build Maestro command with optional JUnit output
  local maestro_cmd="maestro test"
  if [[ "$JUNIT_OUTPUT" == "true" ]]; then
    local report_name=$(basename "$flow_file" .yaml)
    maestro_cmd="$maestro_cmd --format junit --output $PROJECT_DIR/artifacts/reports/${platform}-${report_name}-${TIMESTAMP}.xml"
  fi
  maestro_cmd="$maestro_cmd $PROJECT_DIR/$flow_file"

  # Run with timeout - capture exit code before if statement
  local exit_code=0
  timeout "$TEST_TIMEOUT" bash -c "$maestro_cmd" || exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
    echo -e "  ${GREEN}✓${NC} PASSED: $flow_file"
  elif [[ $exit_code -eq 124 ]]; then
    echo -e "  ${RED}✗${NC} TIMEOUT: $flow_file (exceeded ${TEST_TIMEOUT}s)"
    result=1
  else
    echo -e "  ${RED}✗${NC} FAILED: $flow_file (exit code: $exit_code)"
    result=1
  fi

  return $result
}

# Helper function to capture device logs on failure
capture_device_logs() {
  local platform="$1"

  echo -e "${YELLOW}Capturing device logs for $platform...${NC}"

  case "$platform" in
    ios|watchos)
      if command -v xcrun &> /dev/null; then
        xcrun simctl spawn booted log show --last 5m --style compact > \
          "$PROJECT_DIR/artifacts/logs/${platform}-device-${TIMESTAMP}.log" 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} iOS logs captured"
      fi
      ;;
    android|wearos)
      if command -v adb &> /dev/null; then
        adb logcat -d -t 1000 > \
          "$PROJECT_DIR/artifacts/logs/${platform}-logcat-${TIMESTAMP}.log" 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} Android logs captured"
      fi
      ;;
  esac
}

# Run web tests
if [[ "$RUN_WEB" == "true" ]]; then
  echo -e "${CYAN}Running web tests...${NC}"
  cd "$PROJECT_DIR"
  PLATFORM_RESULTS[web]="pending"

  # Check if we can use Docker
  if docker network ls 2>/dev/null | grep -q "amakaflow"; then
    if TEST_SUITE="$SUITE" docker compose run --rm openclaw-tester; then
      PLATFORM_RESULTS[web]="passed"
    else
      PLATFORM_RESULTS[web]="failed"
      OVERALL_EXIT=1
    fi
  else
    # Run via OpenClaw directly (if installed)
    if command -v openclaw &> /dev/null; then
      if openclaw --workspace . --run "/test-runner $SUITE --platform web"; then
        PLATFORM_RESULTS[web]="passed"
      else
        PLATFORM_RESULTS[web]="failed"
        OVERALL_EXIT=1
      fi
    else
      echo -e "${YELLOW}OpenClaw not installed - skipping web tests${NC}"
      PLATFORM_RESULTS[web]="skipped"
    fi
  fi
  echo ""
fi

# Run iOS tests
if [[ "$RUN_IOS" == "true" ]]; then
  echo -e "${CYAN}Running iOS tests...${NC}"
  cd "$PROJECT_DIR"
  PLATFORM_RESULTS[ios]="passed"

  case "$SUITE" in
    smoke|full)
      if ! run_maestro_test "flows/ios/smoke.yaml" "ios"; then
        PLATFORM_RESULTS[ios]="failed"
        OVERALL_EXIT=1
        capture_device_logs "ios"
      fi
      ;;
    golden|ios)
      if ! run_maestro_test "flows/ios/golden-paths.yaml" "ios"; then
        PLATFORM_RESULTS[ios]="failed"
        OVERALL_EXIT=1
        capture_device_logs "ios"
      fi
      ;;
  esac
  echo ""
fi

# Run watchOS tests
if [[ "$RUN_WATCHOS" == "true" ]]; then
  echo -e "${CYAN}Running watchOS tests...${NC}"
  cd "$PROJECT_DIR"
  PLATFORM_RESULTS[watchos]="passed"

  case "$SUITE" in
    smoke)
      if ! run_maestro_test "flows/ios/watch/smoke.yaml" "watchos"; then
        PLATFORM_RESULTS[watchos]="failed"
        OVERALL_EXIT=1
        capture_device_logs "watchos"
      fi
      ;;
    golden|ios|full)
      if ! run_maestro_test "flows/ios/watch/golden-paths.yaml" "watchos"; then
        PLATFORM_RESULTS[watchos]="failed"
        OVERALL_EXIT=1
        capture_device_logs "watchos"
      fi
      ;;
  esac
  echo ""
fi

# Run Android tests
if [[ "$RUN_ANDROID" == "true" ]]; then
  echo -e "${CYAN}Running Android tests...${NC}"
  cd "$PROJECT_DIR"
  PLATFORM_RESULTS[android]="passed"

  case "$SUITE" in
    smoke|full)
      if ! run_maestro_test "flows/android/smoke.yaml" "android"; then
        PLATFORM_RESULTS[android]="failed"
        OVERALL_EXIT=1
        capture_device_logs "android"
      fi
      ;;
    golden|android)
      if ! run_maestro_test "flows/android/golden-paths.yaml" "android"; then
        PLATFORM_RESULTS[android]="failed"
        OVERALL_EXIT=1
        capture_device_logs "android"
      fi
      ;;
  esac
  echo ""
fi

# Run Wear OS tests
if [[ "$RUN_WEAROS" == "true" ]]; then
  echo -e "${CYAN}Running Wear OS tests...${NC}"
  cd "$PROJECT_DIR"
  PLATFORM_RESULTS[wearos]="passed"

  case "$SUITE" in
    smoke)
      if ! run_maestro_test "flows/android/wear/smoke.yaml" "wearos"; then
        PLATFORM_RESULTS[wearos]="failed"
        OVERALL_EXIT=1
        capture_device_logs "wearos"
      fi
      ;;
    golden|android|full)
      if ! run_maestro_test "flows/android/wear/golden-paths.yaml" "wearos"; then
        PLATFORM_RESULTS[wearos]="failed"
        OVERALL_EXIT=1
        capture_device_logs "wearos"
      fi
      ;;
  esac
  echo ""
fi

# Generate summary report
REPORT_FILE="$PROJECT_DIR/artifacts/reports/summary-${TIMESTAMP}.json"
cat > "$REPORT_FILE" << EOF
{
  "suite": "$SUITE",
  "platform": "$PLATFORM",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "overall_result": "$([ $OVERALL_EXIT -eq 0 ] && echo "passed" || echo "failed")",
  "results": {
    "web": "${PLATFORM_RESULTS[web]:-skipped}",
    "ios": "${PLATFORM_RESULTS[ios]:-skipped}",
    "android": "${PLATFORM_RESULTS[android]:-skipped}",
    "watchos": "${PLATFORM_RESULTS[watchos]:-skipped}",
    "wearos": "${PLATFORM_RESULTS[wearos]:-skipped}"
  }
}
EOF

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Results${NC}"
echo -e "${BLUE}========================================${NC}"

for platform in web ios android watchos wearos; do
  result="${PLATFORM_RESULTS[$platform]:-skipped}"
  case "$result" in
    passed)
      echo -e "  $platform: ${GREEN}PASSED${NC}"
      ;;
    failed)
      echo -e "  $platform: ${RED}FAILED${NC}"
      ;;
    skipped)
      echo -e "  $platform: ${YELLOW}SKIPPED${NC}"
      ;;
    *)
      echo -e "  $platform: ${YELLOW}$result${NC}"
      ;;
  esac
done

echo ""
echo -e "${BLUE}========================================${NC}"

if [[ $OVERALL_EXIT -eq 0 ]]; then
  echo -e "${GREEN}TEST SUITE PASSED${NC}"
else
  echo -e "${RED}TEST SUITE FAILED${NC}"
fi

echo -e "${BLUE}========================================${NC}"
echo ""
echo "Artifacts:"
echo "  Screenshots: $PROJECT_DIR/artifacts/screenshots/"
echo "  Logs:        $PROJECT_DIR/artifacts/logs/"
echo "  Reports:     $PROJECT_DIR/artifacts/reports/"
echo "  Summary:     $REPORT_FILE"
echo ""

# List recent artifacts
if ls "$PROJECT_DIR/artifacts/screenshots/"*.png 1> /dev/null 2>&1; then
  echo "Recent screenshots:"
  ls -la "$PROJECT_DIR/artifacts/screenshots/"*.png 2>/dev/null | tail -5
  echo ""
fi

if ls "$PROJECT_DIR/artifacts/reports/"*.xml 1> /dev/null 2>&1; then
  echo "JUnit reports:"
  ls -la "$PROJECT_DIR/artifacts/reports/"*.xml 2>/dev/null
  echo ""
fi

exit $OVERALL_EXIT
