# Demo Script — 3 minutes (Arm Create AI Optimization Challenge + NeuralSprint)

Recording: 1366×768 minimum, OBS or similar, no copyrighted music, no
third-party trademarks. Record twice, keep the better take. Narration below
is EN; on-screen UI is EN.

Honesty rules for this recording (A-series constitution):

- Every number said on camera must be visible on screen or trace to a
  committed artifact. No "92% of alerts are noise"-type industry stats —
  we have no source for them.
- The chaos drill is real: the API actually stops, the UI actually
  transitions. No editing tricks, no cut between "kill" and "offline".
- If something breaks mid-take, keep rolling only if the failure itself is
  instructive; otherwise restart the take.

---

## Shot list

### 0:00–0:15 — Problem

**Visual:** Dashboard in honest cached or live state, classification table
visible.

**Narration:**
> "SOC analysts drown in false positives — and most dashboards make it
> worse: they show you numbers without ever telling you when those numbers
> are stale, cached, or just guessed. TicketSec is a ticket-triage
> dashboard that classifies security tickets on a $6-a-month Arm64 VM —
> and it tells you exactly when to stop trusting it."

### 0:15–0:45 — Live classification

**Visual:** Live Prediction panel. Type/paste a ticket ("User clicked a
link in a fake HR email and entered credentials"), hit classify. Point
at: the green `LIVE` pill in the header with real probe latency, the
predicted category with the severity rail, the confidence bar, the tier
badge `ONNX INT8`.

**Narration:**
> "A ticket comes in. The model is a logistic-regression classifier
> exported to ONNX INT8 — 0.38 megabytes — running on AWS Graviton.
> Server-side inference is a quarter of a millisecond: p50 0.237,
> p95 0.286, measured over a hundred requests on the real host."

**Fallback (Branch B):** if the API is down, say it out loud — "the API is
unreachable, so the panel disables itself instead of pretending" — and
move to the drill.

### 0:45–1:15 — CHAOS DRILL (the differentiator)

**Visual:** terminal with SSH into the Graviton host next to the browser.

1. `sudo systemctl stop ticketsec` — on camera.
2. Browser: header pill flips `LIVE` → `CACHED` (amber) on the next health
   probe; cached rows show amber badges and the snapshot footer.
3. Hard refresh: `API OFFLINE`. Live Prediction panel disables with
   "API offline — classification unavailable".
4. Open the Event Log / notifications: entries stop. Nothing new is
   invented while the API is dead.

**Narration:**
> "Now the part most dashboards fail. I'm killing the backend — actually
> killing it, on the host. Watch the badge: live becomes cached, cached
> becomes offline. The prediction panel refuses to guess. And the event
> log goes quiet — zero fabricated entries. Every dashboard shows you
> data. This one tells you when to stop trusting it."

**Restart after the segment:** `sudo systemctl start ticketsec`, pill
returns to `LIVE`. Keep this in the take — recovery is part of the story.

### 1:15–1:45 — Model Registry

**Visual:** Model Registry view. Scroll: artifact SHA-256, size 0.38 MB,
ablation table **including the losing candidates**, deployed-vs-winner
note, confusion matrix, latency benchmark, adversarial probes.

**Narration:**
> "The registry shows the model like a supply-chain artifact: hash, size,
> and the full ablation — including the losers. The accuracy winner, 93.6
> percent, couldn't be exported to ONNX, so we ship the best exportable
> candidate at 92.94 — the model that runs, not the model that scores
> highest. Fourteen adversarial probes, zero mismatches."

(Do not claim confidence intervals here — the registry does not display
them. The Wilson 95% CI lives in the README metrics table and
`docs/PERFORMANCE.md`.)

### 1:45–2:15 — Architecture

**Visual:** README mermaid diagram (or the System Health view), then the
Model Footprint donut (INT8 artifact vs 700 MB memory budget).

**Narration:**
> "The whole inference path fits on the cheapest Graviton instance: two
> vCPUs, one gig of RAM, about six dollars a month on-demand. The systemd
> unit caps memory at 700 megabytes — the model uses half a meg. There's
> also an optional tiered endpoint: ONNX first, and below the confidence
> threshold it falls back to a local quantized LLM — and the UI badges
> which tier answered, honestly, including 'unavailable'."

### 2:15–3:00 — Impact + close

**Visual:** `docs/MIGRATION_GUIDE.md` checklist section, then back to the
dashboard with the `LIVE` pill.

**Narration:**
> "The reusable artifact is the migration guide: the exact pipeline to
> move any sklearn text model to ONNX INT8 on Arm64, including the
> pitfalls we hit. And the Honesty Contract is a design pattern you can
> steal: live, cached, offline — declared, never faked. Every number you
> saw in this video has a committed artifact that proves it. Links are in
> the README."

**End card:** repo URL + "MIT licensed".

---

## Pre-recording checklist

- [ ] Graviton host reachable: `curl -s http://3.23.60.61:8000/health`
- [ ] SSH access ready (`ticketsec-key.pem` outside the repo)
- [ ] Chaos drill rehearsed TWICE (local rehearsal evidence:
      `qa/proof/honesty-matrix.json`; Graviton rehearsal: notes in
      `audit/HANDOFF_P6.md` addendum)
- [ ] Browser at 1366×768, zoom 100%, no personal tabs/bookmarks bar
- [ ] Event Log cleared before take (fresh session)
- [ ] DEMO video URL placeholder in README/DEVPOST replaced after upload
