#!/usr/bin/env bash
set -euo pipefail
# G7 — UI number traceability check.
# Verifies that every displayed number traces to a committed artifact
# or a live store source.
#
# TODO: implement project-specific assertions.
#   - enumerate rendered numbers from src/ components
#   - map each to a live store selector or committed artifact JSON
#   - flag orphan numbers without source

echo "[G7] Traceability check: STUB (não verificado)"
exit 1
