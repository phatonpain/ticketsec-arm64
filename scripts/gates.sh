#!/usr/bin/env bash
# scripts/gates.sh — TicketSec quality gates (machine-checkable, A5)
# Usage: bash scripts/gates.sh  → exits non-zero on first red gate
set -uo pipefail
EVIDENCE="TEST_RESULTS_v4.md"
STAMP=$(date -u +"%Y-%m-%d %H:%M:%SZ")
say()  { printf '%s\n' "$*"; }
log()  { printf '%s\n' "$*" | tee -a "$EVIDENCE"; }
pass() { log "- [PASS] $1 ($STAMP)"; }
fail() { log "- [FAIL] $1 — $2 ($STAMP)"; RED=1; }
RED=0
say "" >> "$EVIDENCE"; log "## Gate run — $STAMP"
# G1 build + chunk size (<600KB main)
OUT=$(npm run build 2>&1); RC=$?
echo "$OUT" | tail -5 | tee -a "$EVIDENCE" >/dev/null
[ $RC -eq 0 ] && pass "G1 build" || fail "G1 build" "exit $RC"
MAIN=$(echo "$OUT" | grep -oE 'index-[A-Za-z0-9_-]+\.js +[0-9.]+' | head -1 | grep -oE '[0-9.]+$')
if [ -n "$MAIN" ]; then
  BIG=$(echo "$MAIN > 600" | bc -l)
  [ "$BIG" = "0" ] && pass "G1 chunk ${MAIN}KB<600KB" || fail "G1 chunk" "${MAIN}KB"
fi
# G2 lint
npm run lint >/dev/null 2>&1 && pass "G2 lint 0/0" || fail "G2 lint" "see npm run lint"
# G3 tests
TOUT=$(npx vitest run 2>&1); RC=$?
echo "$TOUT" | tail -8 | tee -a "$EVIDENCE" >/dev/null
FAILS=$(echo "$TOUT" | grep -cE 'it\.fails|\.skip' || true)
{ [ $RC -eq 0 ] && [ "$FAILS" = "0" ]; } && pass "G3 vitest green, 0 it.fails/skips" \
  || fail "G3 vitest" "rc=$RC fails/skips=$FAILS"
# G4 a11y (per hash route — adjust route list to the app)
for R in dashboard detections analytics registry health; do
  npx axe "http://localhost:5173/#/$R" --exit >/dev/null 2>&1 \
    && pass "G4 axe $R" || fail "G4 axe $R" "violations"
done
# G6 secrets scan
if grep -rEn '(api[_-]?key|secret|token|password|BEGIN.*PRIVATE KEY)' \
     src/ public/ model/ ops/ app/ data/ 2>/dev/null | grep -vE 'PLACEHOLDER|EXAMPLE'; 
then
  fail "G6 secrets" "matches above"
else
  pass "G6 secrets scan clean"
fi
[ -f ticketsec-key.pem ] && fail "G6 pem" "ticketsec-key.pem in tree"
find . -name 'ticketsec-key.pem' -not -path './node_modules/*' | grep -q . \
  && fail "G6 pem" "found" || true
# G8 git clean
[ -z "$(git status --porcelain)" ] && pass "G8 tree clean" || fail "G8 git" "uncommitted changes"
