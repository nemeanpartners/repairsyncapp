#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="${TWA_DIR:-twa-android}"

if [[ ! -d "$OUT_DIR" ]]; then
  echo "Missing $OUT_DIR. Run scripts/twa-init.sh first."
  exit 1
fi

cd "$OUT_DIR"
echo "Building TWA APK…"
npx bubblewrap build

