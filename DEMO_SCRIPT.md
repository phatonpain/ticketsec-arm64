# TicketSec Arm64 — Demo Script (60–90 seconds)

> **THE HONESTY CONTRACT:** Every datum shown is either **live** (from the API), **cached** (amber `CACHED` badge, sourced from `public/cache/tickets-snapshot.json`), or shown as **"Unavailable — API offline"**. The Event Log records ONLY real events. Nothing is ever fabricated and presented as live.

This script has two branches. Choose the branch based on the only allowed signal:

```bash
curl -s http://3.23.60.61:8000/health
```

- **Branch A:** returns HTTP 200 → live demo.
- **Branch B:** non-200 / timeout → cached / honest degraded-mode demo.

Every number spoken must trace to a committed artifact. PENDING values are announced as such.

---

## Shot list

### 00:00–00:05 — Hook

**Visual:** Full dashboard, centered. Header and KPI cards visible.

**Narration (Branch A & B):**
> "SOC analysts drown in tickets. TicketSec Arm64 is a tiny dashboard that classifies security tickets automatically — and never lies about whether the data is live or cached."

**On-screen text overlay:** none; let the dashboard speak.

---

### 00:05–00:15 — Problem

**Visual:** Slow pan across the threat-category bar chart and the six-category legend.

**Narration (Branch A & B):**
> "We triage into six categories: Phishing, Malware, Unauthorized Access, Data Breach, DDoS, and False Positive. The goal is to spend less time sorting and more time responding."

**Cite:** canonical categories from `00_SHARED_CONTEXT.md` §3.

---

### 00:15–00:45 — Core demo

#### Branch A — API live

**Visual:** Live Prediction panel. Cursor pastes text and clicks Classify.

**Actions:**
1. Paste: `suspicious login from unknown device`
2. Click **Classify**.
3. Show the returned `{category, confidence, processing_time_ms}`.
4. Show the green `LIVE` badge in the header.
5. Show the new real Event Log entry.
6. Show the new row in the Recent Classifications table.

**Narration:**
> "I paste a ticket, hit Classify, and the real `/predict` endpoint on the Graviton instance returns the category, confidence, and inference time. The green LIVE badge and the Event Log entry prove this is a live call."

**Cite:** live response from `POST http://3.23.60.61:8000/predict`.

#### Branch B — API down

**Visual:** Header showing amber `CACHED` badge. Live Prediction panel showing "Unavailable — API offline". Event Log empty.

**Actions:**
1. Show the amber `CACHED` badge in the header.
2. Point to the ticket table, which is populated from `public/cache/tickets-snapshot.json`.
3. Hover over the Live Prediction panel to show the "Unavailable — API offline" message.
4. Show the silent Event Log.

**Narration:**
> "Right now the backend is unreachable, so the dashboard shows the amber CACHED badge. The ticket table comes from a committed snapshot, the prediction panel says Unavailable — API offline, and the Event Log stays silent. This is not a fallback excuse — it is the product feature."

**Cite:** `public/cache/tickets-snapshot.json`; `useApi` status model.

---

### 00:45–01:00 — ARM64 / ONNX INT8 cost story

**Visual:** KPI cards (Model Footprint 0.22 MB) and a terminal showing the `t4g.micro` specs.

**Narration (Branch A & B):**
> "The model is an INT8-quantized ONNX artifact of about 0.22 MB. It runs on an AWS Graviton t4g.micro — ARM64, 2 vCPU, 1 GB RAM — costing roughly $0.0042 per hour. Latency p50 and p95 on the real instance are recorded in `model/latency_t4g_micro.json`."

**Cite:**
- `model/quantization.md` — INT8 size and RAM budget.
- `model/latency_t4g_micro.json` — p50/p95 `[PENDING until API online]`.
- AWS `t4g.micro` on-demand pricing, us-east-2.

**If Branch B:** append:
> "Those latency numbers are PENDING right now because the host is offline, but the measurement script is ready to run as soon as it comes back."

---

### 01:00–01:15 — Design / UX

**Visual:** Slow pan across the dense table, tabular numerals, keyboard shortcut hint (`?`), and focus rings.

**Narration (Branch A & B):**
> "The UI follows an enterprise SOC density bar: 40-pixel table rows, 16-pixel card padding, Inter and JetBrains Mono fonts, and a single token file. Accessibility is verified with axe — zero violations — and every interactive element has a visible focus ring and keyboard shortcut."

**Cite:**
- `TEST_RESULTS_v3.md` — build, lint, axe 0 violations.
- `src/styles/tokens.css` — design tokens.
- `A11Y_REPORT.md` *(owned by a11y-specialist.md; PENDING if not yet committed)*.

---

### 01:15–01:30 — CTA

**Visual:** Full dashboard, then cut to Devpost submission page / GitHub link.

**Narration (Branch A & B):**
> "Vote for TicketSec Arm64 on Devpost. The README, model card, and source are linked in the description."

**On-screen:** Devpost project URL + GitHub URL.

---

## Demo preparation checklist

Before recording:

- [ ] Run `curl -s http://3.23.60.61:8000/health` and note the result.
- [ ] Choose Branch A or B accordingly.
- [ ] If Branch A: verify `curl -s -X POST http://3.23.60.61:8000/predict -H 'Content-Type: application/json' -d '{"text":"suspicious login from unknown device"}'` returns valid JSON.
- [ ] If Branch B: confirm `public/cache/tickets-snapshot.json` is committed and not hand-edited.
- [ ] Run `npm run build` and `npm run lint`; confirm 0/0.
- [ ] Open `http://localhost:5173` and ensure the correct badge (`LIVE` or `CACHED`) is visible.
- [ ] Hide personal bookmarks / browser extensions.
- [ ] Record at 1080p, 30 fps, with system audio off unless narrating live.

## Claim Traceability Ledger

| Claim | Artifact | SHA-256 | Date |
|---|---|---|---|
| Six categories | `00_SHARED_CONTEXT.md` | N/A | repository |
| 0.22 MB INT8 model | `model/quantization.md` | `c6c873e5879e327e06d88ecab46ded049cf11f08c1919523952d1f3ae9f1a572` | 2026-07-17 |
| t4g.micro cost | AWS pricing | N/A | 2026-07-17 |
| Latency p50/p95 | `model/latency_t4g_micro.json` | `addc0f2ffea8c04c3c7d9e69953b3694f7010b095233b364a339218ecd40c8df` | 2026-07-17T14:33:51Z |
| axe 0 violations | `TEST_RESULTS_v3.md` | `75555737574f1092507958f33b32b714270f8e3f9cf0f53a019ad1866f03b75b` | 2026-07-17 |
| Keyboard shortcuts / focus rings | `src/App.tsx` / `A11Y_REPORT.md` | `[PENDING: A11Y_REPORT.md]` | 2026-07-17 |
