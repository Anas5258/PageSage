#!/usr/bin/env bash
# Builds dist/pagesage-<version>.zip from src/ with manifest.json at the zip root.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
version="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$root/src/manifest.json" | head -n1)"
mkdir -p "$root/dist"
out="$root/dist/pagesage-$version.zip"
rm -f "$out"
(cd "$root/src" && zip -r -X "$out" .)
echo "Built $out"
