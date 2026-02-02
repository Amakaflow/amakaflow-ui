#!/usr/bin/env bash
#
# Maestro Setup Script
#
# Installs Maestro and verifies the development environment for mobile testing
#
# Usage:
#   ./scripts/setup-maestro.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Maestro Setup for AmakaFlow${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check OS
OS=$(uname -s)
echo -e "Operating System: ${YELLOW}$OS${NC}"

if [[ "$OS" != "Darwin" ]]; then
  echo -e "${YELLOW}Warning: This script is optimized for macOS${NC}"
  echo "For Linux, see: https://maestro.mobile.dev/getting-started/installing-maestro"
fi

echo ""
echo -e "${YELLOW}Step 1: Installing/Updating Maestro${NC}"

if command -v maestro &> /dev/null; then
  CURRENT_VERSION=$(maestro --version 2>/dev/null || echo "unknown")
  echo -e "Current Maestro version: $CURRENT_VERSION"
  echo -e "Updating to latest..."
fi

# Install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# Verify installation
if command -v maestro &> /dev/null; then
  NEW_VERSION=$(maestro --version 2>/dev/null || echo "unknown")
  echo -e "${GREEN}✓${NC} Maestro installed: $NEW_VERSION"
else
  echo -e "${RED}Error: Maestro installation failed${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Checking Xcode Command Line Tools${NC}"

if xcode-select -p &> /dev/null; then
  echo -e "${GREEN}✓${NC} Xcode CLI tools installed"
else
  echo -e "${YELLOW}Installing Xcode CLI tools...${NC}"
  xcode-select --install
fi

echo ""
echo -e "${YELLOW}Step 3: Checking iOS Simulator${NC}"

if command -v xcrun &> /dev/null; then
  echo -e "${GREEN}✓${NC} xcrun available"

  # List available simulators
  echo ""
  echo "Available iOS Simulators:"
  xcrun simctl list devices available | grep -E "iPhone|iPad" | head -10

  # Check for booted simulator
  if xcrun simctl list | grep -q "Booted"; then
    echo ""
    echo -e "${GREEN}✓${NC} Simulator already booted:"
    xcrun simctl list | grep "Booted"
  else
    echo ""
    echo -e "${YELLOW}No simulator booted. Boot one with:${NC}"
    echo "  xcrun simctl boot 'iPhone 15 Pro'"
  fi
else
  echo -e "${RED}Error: xcrun not found. Install Xcode.${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: Checking Android SDK${NC}"

if [[ -n "${ANDROID_HOME:-}" ]] || [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
  ANDROID_SDK="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
  echo -e "${GREEN}✓${NC} Android SDK found: $ANDROID_SDK"

  # Check for adb
  if command -v adb &> /dev/null; then
    echo -e "${GREEN}✓${NC} adb available"

    # Check for connected devices
    if adb devices | grep -q "device$"; then
      echo ""
      echo "Connected Android devices:"
      adb devices
    else
      echo ""
      echo -e "${YELLOW}No Android device/emulator connected${NC}"
    fi
  else
    echo -e "${YELLOW}Warning: adb not in PATH${NC}"
    echo "Add to PATH: export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
  fi

  # Check for emulator
  if command -v emulator &> /dev/null; then
    echo ""
    echo "Available Android AVDs:"
    emulator -list-avds 2>/dev/null || echo "  (none or emulator not in PATH)"
  fi
else
  echo -e "${YELLOW}Android SDK not found${NC}"
  echo "Set ANDROID_HOME or ANDROID_SDK_ROOT environment variable"
  echo "Or install Android Studio: https://developer.android.com/studio"
fi

echo ""
echo -e "${YELLOW}Step 5: Verifying Maestro can connect${NC}"

# Test iOS connection
if xcrun simctl list 2>/dev/null | grep -q "Booted"; then
  echo "Testing Maestro iOS connection..."
  if maestro hierarchy --platform ios &> /dev/null; then
    echo -e "${GREEN}✓${NC} Maestro can connect to iOS Simulator"
  else
    echo -e "${YELLOW}!${NC} Could not connect to iOS Simulator (app may not be running)"
  fi
fi

# Test Android connection
if adb devices 2>/dev/null | grep -q "device$"; then
  echo "Testing Maestro Android connection..."
  if maestro hierarchy --platform android &> /dev/null; then
    echo -e "${GREEN}✓${NC} Maestro can connect to Android device"
  else
    echo -e "${YELLOW}!${NC} Could not connect to Android device (app may not be running)"
  fi
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Setup Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Boot iOS Simulator (if not already):"
echo "   xcrun simctl boot 'iPhone 15 Pro'"
echo ""
echo "2. Start Android Emulator (if not already):"
echo "   emulator -avd Pixel_7_API_34 &"
echo ""
echo "3. Install AmakaFlow apps on simulators/emulators"
echo ""
echo "4. Run tests:"
echo "   ./scripts/run-full-suite.sh smoke"
echo ""
echo "5. For interactive debugging:"
echo "   maestro studio"
echo ""
