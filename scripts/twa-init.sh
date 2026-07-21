#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MANIFEST_URL="${TWA_MANIFEST_URL:-https://repairsync.ai.studio/manifest.webmanifest}"
OUT_DIR="${TWA_DIR:-twa-android}"

if [[ -d "$OUT_DIR" ]] && [[ -n "$(ls -A "$OUT_DIR" 2>/dev/null || true)" ]]; then
  echo "Refusing to overwrite non-empty $OUT_DIR. Remove it, or set TWA_DIR to a new path."
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "Initializing TWA project from: $MANIFEST_URL"
npx bubblewrap init --manifest="$MANIFEST_URL" --directory="$OUT_DIR"
