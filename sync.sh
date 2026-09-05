#!/bin/bash

# Awen Music — Sync docs/index.html to awenstudio.github.io
# Usage: ./sync.sh

set -e

AWEN_MUSIC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GITHUB_REPO="awenstudio/awenstudio.github.io"
TARGET_FILE="music/index.html"
DEPLOY_URL="${AWEN_DEPLOY_URL:-git@github.com:${GITHUB_REPO}.git}"

echo "🎵 Syncing Awen Music..."

# Check every runtime asset.  index.html intentionally loads reliability.js
# as a separate, cache-busted-by-server local module; publishing only the HTML
# creates a broken deployed page after a local reliability fix.
if [ ! -f "$AWEN_MUSIC_DIR/docs/index.html" ] || [ ! -f "$AWEN_MUSIC_DIR/docs/reliability.js" ] || [ ! -f "$AWEN_MUSIC_DIR/docs/vendor/babel.min.js" ]; then
  echo "❌ docs/index.html or docs/reliability.js not found!"
  exit 1
fi

# Clone target repo to temp dir
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "📦 Cloning $GITHUB_REPO..."
git clone "$DEPLOY_URL" "$TEMP_DIR" --depth=1 -q

# Copy runtime assets as one versioned set.
echo "📝 Copying docs runtime assets..."
mkdir -p "$TEMP_DIR/music"
cp "$AWEN_MUSIC_DIR/docs/index.html" "$TEMP_DIR/$TARGET_FILE"
cp "$AWEN_MUSIC_DIR/docs/reliability.js" "$TEMP_DIR/music/reliability.js"
cp -R "$AWEN_MUSIC_DIR/docs/vendor" "$TEMP_DIR/music/"

# Commit and push
cd "$TEMP_DIR"
git config user.name "Awen Studio"
git config user.email "awen@studio.local"

git add "$TARGET_FILE" "music/reliability.js" "music/vendor"
if git diff --cached --quiet -- "$TARGET_FILE" "music/reliability.js" "music/vendor"; then
  echo "✅ Already up to date"
  exit 0
fi

LATEST_COMMIT=$(git -C "$AWEN_MUSIC_DIR" log -1 --pretty=format:%H)
git add "$TARGET_FILE" "music/reliability.js" "music/vendor"
git commit -m "sync: update Awen Music runtime from awen-music

Auto-synced from docs/index.html
Source HEAD: $LATEST_COMMIT
Runtime SHA256: $(shasum -a 256 "$TARGET_FILE" "music/reliability.js")" -q

git push -q
echo "✅ Synced successfully!"
