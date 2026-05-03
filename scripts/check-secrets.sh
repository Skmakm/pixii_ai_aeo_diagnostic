#!/usr/bin/env bash
# AC18: secret env vars MUST only be referenced inside lib/auth.ts, lib/openrouter.ts,
# or app/api/**/route.ts. Fail the build if any other file references them.
set -euo pipefail

PATTERN='process\.env\.(APP_PASSWORD|OPENROUTER_API_KEY|COOKIE_SECRET)'

# Search all TS/TSX, excluding node_modules / .next / openspec / scripts.
matches=$(grep -rEnH "$PATTERN" \
  --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=openspec --exclude-dir=scripts \
  . 2>/dev/null || true)

if [ -z "$matches" ]; then
  echo "[check-secrets] No references found. Skipping path audit."
  exit 0
fi

bad=$(echo "$matches" | grep -vE '^\./(lib/auth\.ts|lib/openrouter\.ts|app/api/[^:]+/route\.ts):' || true)

if [ -n "$bad" ]; then
  echo "[check-secrets] FAIL: secrets referenced outside allowed files."
  echo "$bad"
  exit 1
fi

echo "[check-secrets] OK: all secret references are in allowed files."
echo "$matches"
exit 0
