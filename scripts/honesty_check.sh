#!/usr/bin/env bash
set -euo pipefail
# G5 — Honesty matrix check.
# Verifies that UI data surfaces declare live/cached/offline provenance
# and that no fake-live fallback exists.
#
# TODO: implement project-specific assertions.
#   - grep src/ for hardcoded metric values in JSX
#   - detect decorative skeletons without honest loading state
#   - verify every data surface uses useApi status

echo "[G5] Honesty matrix check: STUB (não verificado)"
exit 1
