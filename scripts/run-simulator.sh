#!/usr/bin/env bash
# Build Voice Journal and open it in the iOS Simulator (on a Mac with Xcode).
#
#   scripts/run-simulator.sh                 # iPhone 17 Pro
#   scripts/run-simulator.sh "iPhone 16 Pro" # any installed simulator
set -euo pipefail

DEVICE="${1:-iPhone 17 Pro}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_ID="com.abhibhullar.VoiceJournal"

if ! command -v xcodegen >/dev/null; then
  echo "Installing XcodeGen (generates the Xcode project from App/project.yml)..."
  brew install xcodegen
fi

if ! xcrun simctl list devices available | grep -q "$DEVICE ("; then
  echo "No simulator called \"$DEVICE\". Installed ones:"
  xcrun simctl list devices available | grep -E "iPhone" || true
  echo "Add one in Xcode > Settings > Components, or pass a name from the list."
  exit 1
fi

cd "$ROOT/App"
xcodegen --quiet

echo "Building for $DEVICE..."
xcodebuild \
  -project VoiceJournal.xcodeproj \
  -scheme VoiceJournal \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath build \
  -quiet \
  build

xcrun simctl boot "$DEVICE" 2>/dev/null || true
open -a Simulator
xcrun simctl install "$DEVICE" build/Build/Products/Debug-iphonesimulator/VoiceJournal.app
xcrun simctl terminate "$DEVICE" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl launch "$DEVICE" "$BUNDLE_ID"
echo "Voice Journal is running on $DEVICE."
