#!/usr/bin/env bash
# Runs the Playwright browser suite against a disposable test API and a test
# frontend, then stops both. The test frontend needs port 5173 and the test API
# port 5001, so stop the everyday dev frontend first.
set -euo pipefail
cd "$(dirname "$0")/.."

for port in 5001 5173; do
  if lsof -ti:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is in use. Stop whatever is using it (the dev frontend uses 5173) and retry." >&2
    exit 1
  fi
done

# macOS Chrome is used when no browser is given; the config only sets a path on Windows.
if [ -z "${BROWSER_BINARY:-}" ] && [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  export BROWSER_BINARY="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi

pids=()
cleanup() { for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

(cd server && exec node scripts/test-local.js --serve) &
pids+=($!)
VITE_API_BASE_URL=http://127.0.0.1:5001/api node node_modules/vite/bin/vite.js --host 127.0.0.1 --strictPort &
pids+=($!)

for url in http://127.0.0.1:5001/api/health http://127.0.0.1:5173/; do
  for _ in $(seq 1 30); do curl -sf "$url" >/dev/null && break; sleep 1; done
  curl -sf "$url" >/dev/null || { echo "Not ready: $url" >&2; exit 1; }
done

npx playwright test "$@"
