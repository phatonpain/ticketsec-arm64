#!/usr/bin/env bash
# G7 — UI number traceability check.
#
# A3: every UI number traces to a committed artifact or a live/store source.
# Machine-checkable invariants:
#
#   T1  Every artifact consumed by src/lib/artifacts.ts exists, parses, and
#       carries status OK|COMPLETE (checked via node — JSON truth, not grep).
#   T2  src/lib/artifacts.ts is the ONLY module importing model/* artifacts —
#       no component may bypass the single source of truth.
#   T3  Orphan-literal scan: metric-unit literals (%, MB, GB, vCPU, RPM) in
#       non-comment, non-geometry source lines must be allowlisted in
#       scripts/g7_orphan_allowlist.txt with a written justification. New
#       orphans fail; stale allowlist entries also fail (allowlist drift).
#
# Geometry noise is filtered: 0/50/100 percentages, positioning lines
# (left/top/width/height/inset/radius/center), unicode escapes, comments.
#
# Exit 0 = all invariants hold. Exit 1 = gate red.
set -uo pipefail
cd "$(dirname "$0")/.."

RED=0
ALLOWLIST="scripts/g7_orphan_allowlist.txt"
pass() { printf '[G7 PASS] %s\n' "$1"; }
fail() { printf '[G7 FAIL] %s — %s\n' "$1" "$2"; RED=1; }

# T1 — artifact readiness (JSON truth via node)
T1_OUT=$(node -e '
const files = [
  "model/eval_results.json",
  "model/confusion_matrix.json",
  "model/latency_t4g_micro.json",
  "model/probe_results.json",
  "model/artifact_meta.json",
  "model/calibration.json",
];
const fs = require("fs");
const ready = s => typeof s === "string" && ["ok", "complete"].includes(s.trim().toLowerCase());
const bad = [];
for (const f of files) {
  try {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!ready(j.status)) bad.push(`${f}: status=${JSON.stringify(j.status)}`);
  } catch (e) {
    bad.push(`${f}: ${e.code || "unparseable"}`);
  }
}
try {
  if (fs.statSync("model/quantization.md").size === 0) bad.push("model/quantization.md: empty");
} catch { bad.push("model/quantization.md: missing"); }
if (bad.length) { console.log(bad.join("\n")); process.exit(1); }
' 2>&1)
if [ $? -eq 0 ]; then
  pass "T1 all 7 committed artifacts ready (OK|COMPLETE)"
else
  fail "T1 artifact readiness" "$T1_OUT"
fi

# T2 — single source of truth for artifact imports
BYPASS=$(grep -rn "^import .*model/" src/ --include='*.ts' --include='*.tsx' \
  | grep -v '^src/lib/artifacts\.ts:')
if [ -z "$BYPASS" ]; then
  pass "T2 only src/lib/artifacts.ts imports model/* artifacts"
else
  fail "T2 artifact import bypass" "$BYPASS"
fi

# T3 — orphan metric-literal scan vs allowlist
ORPHANS=""
SEEN_LITERALS=$'\n'
while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; lineno="${rest%%:*}"; literal="${rest#*:}"
  line=$(sed -n "${lineno}p" "$file")
  trimmed=$(printf '%s' "$line" | sed 's/^[[:space:]]*//')
  # Skip comment lines (//, /*, *, <!--).
  if printf '%s' "$trimmed" | grep -qE '^(//|/\*|\*|<!--)'; then
    continue
  fi
  # Skip literals that exist only inside \uXXXX escapes (e.g. MB).
  cleaned=$(printf '%s' "$line" | sed 's/\\u[0-9A-Fa-f]\{4\}//g')
  if ! printf '%s' "$cleaned" | grep -qF "$literal"; then
    continue
  fi
  # Skip positioning/geometry lines.
  if printf '%s' "$line" | grep -qE '(left|top|width|height|inset|radius|center)\s*:'; then
    continue
  fi
  # Geometry trio percentages are layout, not metrics.
  if [ "$literal" = "0%" ] || [ "$literal" = "50%" ] || [ "$literal" = "100%" ]; then
    continue
  fi
  key="$file	$literal"
  SEEN_LITERALS="${SEEN_LITERALS}${key}"$'\n'
  if ! grep -qF "$key" "$ALLOWLIST" 2>/dev/null; then
    ORPHANS="${ORPHANS}${file}:${lineno}: ${literal}  >>  ${trimmed}"$'\n'
  fi
done < <(grep -rnoE '[0-9]+(\.[0-9]+)?[[:space:]]*(%|MB\b|GB\b|RPM\b|vCPUs?\b)' src/ \
           --include='*.ts' --include='*.tsx')

if [ -n "$ORPHANS" ]; then
  fail "T3 orphan metric literals (not in $ALLOWLIST)" "$ORPHANS"
fi

# T3b — stale allowlist entries fail (keep the allowlist honest)
STALE=""
while IFS=$'\t' read -r afile aliteral arest; do
  case "$afile" in ''|'#'*) continue ;; esac
  if ! printf '%s' "$SEEN_LITERALS" | grep -qF "$afile	$aliteral"; then
    STALE="${STALE}${afile} :: ${aliteral}"$'\n'
  fi
done < "$ALLOWLIST"
if [ -n "$STALE" ]; then
  fail "T3b stale allowlist entries" "$STALE"
fi

[ "$RED" = "0" ] && pass "T3 orphan scan clean, allowlist current"
exit $RED
