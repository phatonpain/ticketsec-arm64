# RUBRIC.md — Quality gate (score each 0–5)
Threshold: mean >= 4.0 AND no dimension < 3. Grade in writing per phase
in audit/RUBRIC_SCORES.md: dimension → score → evidence → next fix.
## D1 Scope & file change (did it touch the right files, only them?)
5: minimal diff, correct layer, zero unrelated edits
3: correct outcome with some scope creep, justified
1: wrong-layer fix or drive-by changes
## D2 Spec alignment (does it do what the phase specified?)
5: every phase item addressed or explicitly deferred with reason
3: minor items missing, listed
1: silent deviations from the spec
## D3 Integrity (no shortcuts)
5: no hardcoded expected values, no disabled tests, no gate reinterpretation,
   honesty states preserved (no fake-live)
3: shortcut present but disclosed with remediation plan
1: hidden shortcut
## D4 Runtime correctness (does it actually run?)
5: gates.sh green incl. edge cases (offline, empty input, burst)
3: green with documented non-blocking warnings
1: green by narrative only
## D5 Evidence quality (can a skeptic re-verify?)
5: file:line + command + raw output + artifact path for every claim
3: evidence present but incomplete chain
1: "trust me"
## D6 Design fidelity (Phase 1 only; DESIGN_BRIEF §5)
5: >=9/10 per criterion with screenshot proof @1366px
3: 8/10 with fixes listed
1: below 8/10
