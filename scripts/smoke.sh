#!/usr/bin/env bash
# ==============================================================================
# DRCH Sprint 1 Core Loop Smoke Test Script (Bash Wrapper)
# ==============================================================================
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
echo "Running DRCH Core Loop Smoke Test against $API_URL..."

if command -v python3 &>/dev/null; then
    python3 scripts/smoke.py --base-url "$API_URL"
elif command -v python &>/dev/null; then
    python scripts/smoke.py --base-url "$API_URL"
else
    echo "ERROR: python3 or python not found in PATH"
    exit 1
fi
