#!/usr/bin/env bash
# G5 — Honesty matrix check (static assertions).
#
# Verifies the Honesty Contract invariants that are machine-checkable without
# a browser (the runtime live/cached/offline matrix stays in
# scripts/qa_honesty_matrix.mjs, run as QA evidence, not a gate):
#
#   H1  No setInterval anywhere in src/ — intervals are the classic vector
#       for fabricated "live" updates.
#   H2  Math.random only in the two sanctioned files (event IDs, backoff
#       jitter) — nowhere near a data surface.
#   H3  `source: 'live'` is written only in src/App.tsx, where real API rows
#       are tagged — no other module may claim liveness.
#   H4  Every Suspense fallback is <ChartSkeleton .../> (genuinely lazy
#       chunk) or {null} — no decorative skeletons.
#   H5  The five cached-capable surfaces render <ProvenanceBadge> — a
#       removed badge is a silent honesty regression.
#   H6  Offline honesty copy ("Unavailable") exists in the table and the
#       system monitor — guards against "empty but looks live".
#   H7  Zero dangerouslySetInnerHTML — model/LLM output renders as data only.
#   H8  No hardcoded fixture data in components: ticket-like literal arrays,
#       confidence literals, fabricated ISO timestamps. Derived values
#       computed from real inputs are fine; typed fake data is not.
#
# Exit 0 = all assertions hold. Exit 1 = at least one violated (gate red).
set -uo pipefail
cd "$(dirname "$0")/.."

RED=0
pass() { printf '[G5 PASS] %s\n' "$1"; }
fail() { printf '[G5 FAIL] %s — %s\n' "$1" "$2"; RED=1; }

# H1 — no setInterval in src/
if grep -rn 'setInterval' src/ --include='*.ts' --include='*.tsx' | grep -q .; then
  fail "H1 no setInterval" "$(grep -rn 'setInterval' src/ --include='*.ts' --include='*.tsx' | head -3)"
else
  pass "H1 no setInterval in src/"
fi

# H2 — Math.random only in sanctioned files
RANDOM_FILES=$(grep -rln 'Math\.random' src/ --include='*.ts' --include='*.tsx' | sort)
EXPECTED=$(printf '%s\n' "src/hooks/useEventLog.ts" "src/lib/backoff.ts" | sort)
if [ "$RANDOM_FILES" = "$EXPECTED" ]; then
  pass "H2 Math.random confined to useEventLog.ts + backoff.ts"
else
  fail "H2 Math.random allowlist" "found: ${RANDOM_FILES:-<none>}"
fi

# H3 — source: 'live' only in src/App.tsx
LIVE_FILES=$(grep -rln "source: 'live'" src/ --include='*.ts' --include='*.tsx')
if [ "$LIVE_FILES" = "src/App.tsx" ]; then
  pass "H3 live tagging only in App.tsx"
else
  fail "H3 live tagging" "found: ${LIVE_FILES:-<none>}"
fi

# H4 — Suspense fallbacks are ChartSkeleton or null only
BAD_FALLBACK=$(grep -rn 'fallback=' src/ --include='*.tsx' \
  | grep -vE 'fallback=\{<ChartSkeleton |fallback=\{null\}')
if [ -z "$BAD_FALLBACK" ]; then
  pass "H4 skeletons only for lazy chunks"
else
  fail "H4 fallback policy" "$BAD_FALLBACK"
fi

# H5 — cached-capable surfaces keep their ProvenanceBadge
H5_OK=1
for f in ClassificationTable ThreatBarChart PerformanceLineChart \
         ThreatDistributionDonut SeverityMixDonut; do
  if ! grep -q 'ProvenanceBadge' "src/components/$f.tsx"; then
    fail "H5 provenance badge" "$f.tsx lost its ProvenanceBadge"
    H5_OK=0
  fi
done
[ "$H5_OK" = "1" ] && pass "H5 ProvenanceBadge on all 5 cached-capable surfaces"

# H6 — offline honesty copy present
if grep -q 'Unavailable' src/components/ClassificationTable.tsx \
   && grep -q 'Unavailable' src/components/SystemMonitor.tsx; then
  pass "H6 offline 'Unavailable' copy present"
else
  fail "H6 offline copy" "missing 'Unavailable' state copy"
fi

# H7 — zero dangerouslySetInnerHTML
if grep -rn 'dangerouslySetInnerHTML' src/ --include='*.ts' --include='*.tsx' | grep -q .; then
  fail "H7 no dangerouslySetInnerHTML" "found in src/"
else
  pass "H7 zero dangerouslySetInnerHTML"
fi

# H8 — no hardcoded fixture data in components (ticket-like literal arrays,
# confidence literals, fabricated ISO timestamps). Derived values computed
# from real inputs (e.g. useTickets.computeTicketProbabilities) are fine —
# what is banned is typing fake data into the source.
H8_HITS=$(grep -rnE 'confidence:[[:space:]]*0\.[0-9]|new Date\(['"'"'"]20[0-9]{2}|\[[[:space:]]*\{[[:space:]]*(id|subject|text|createdAt):' \
  src/ --include='*.ts' --include='*.tsx')
if [ -z "$H8_HITS" ]; then
  pass "H8 no hardcoded fixture data in src/"
else
  fail "H8 hardcoded fixture data" "$H8_HITS"
fi

exit $RED
