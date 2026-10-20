#!/usr/bin/env bash
# Watch development live: checks GitHub every 30 seconds and, whenever new
# commits land on the branch, pulls them and relaunches the app in the simulator.
#
#   scripts/live-simulator.sh                        # follows the current branch
#   scripts/live-simulator.sh claude/some-branch     # follows another branch
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
DEVICE="${DEVICE:-iPhone 17 Pro}"

git checkout -q "$BRANCH"
"$ROOT/scripts/run-simulator.sh" "$DEVICE"

echo "Following $BRANCH. Press Ctrl+C to stop."
while true; do
  sleep 30
  git fetch -q origin "$BRANCH" || continue
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]; then
    echo "New changes on $BRANCH:"
    git log --oneline HEAD.."origin/$BRANCH"
    git pull -q --ff-only origin "$BRANCH"
    "$ROOT/scripts/run-simulator.sh" "$DEVICE" || echo "Build failed; waiting for the next change."
  fi
done
