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

**Cite:** canonical categories from `model/categories.py`.

---

### 00:15–00:45 — Core demo

#### Branch A — API live

**Visual:** Live Prediction panel. Cursor pastes text and clicks Classify.

**Actions:**
1. Paste: `suspicious login from unknown device`
2. Click **Classify**.
3. Show the returned `{predicted_category, confidence, processing_time_ms, probabilities}`.
4. Show the green `LIVE` badge in the header.
5. Show the new real Event Log entry.
6. Show the new row in the Recent Classifications table.

**Narration:**
> "I paste a ticket, hit Classify, and the real `/predict` endpoint on the Graviton instance returns the category, confidence, and inference time. The green LIVE badge and the Event Log entry prove this is a live call."

**Cite:** live response from `POST http://3.23.60.61:8000/predict`; latency from `model/latency_t4g_micro.json` (p50 0.224 ms, p95 0.296 ms).

#### Branch B — API down

**Visual:** Header showing amber `CACHED` badge. Live Prediction panel showing "Unavailable — API offline". Event Log empty.

**Actions:**
1. Show the amber `CACHED` badge in the header.
2. Point to the ticket table, which is populated from `public/cache/tickets-snapshot.json`.
3. Hover over the Live Prediction panel to show the "Unavailable — API offline" message.
4. Show the silent Event Log.

**Narration:**
> "Right now the backend is unreachable, so the dashboard shows the amber CACHED badge. The ticket table comes from a committed snapshot, the prediction panel says Unavailable — API offline, and the Event Log stays silent. This is not a fallback excuse — it is the product feature."

**Cite:** `public/cache/tickets-snapshot.json`; `useApi` status model; `tests/flows/offline-silence.test.tsx`.

---

### 00:45–01:00 — ARM64 / ONNX INT8 cost story + Model Registry

**Visual:** Model Registry view. Show the Accuracy & Eval card and the Latency on Graviton card.

**Narration (Branch A & B):**
> "The model is an INT8-quantized ONNX artifact of 0.38 MB, deployed on an AWS Graviton t4g.micro — ARM64, 2 vCPU, 1 GB RAM — costing roughly $0.0042 per hour. The Model Registry shows the 92.94% held-out accuracy, the 609-sample test set, and the per-class precision, recall, and F1."

**Cite:**
- `model/quantization.md` — INT8 size and RAM budget.
- `model/eval_results.json` — accuracy, split, per-class metrics.
- `model/latency_t4g_micro.json` — p50/p95.
- AWS `t4g.micro` on-demand pricing, us-east-2.

**Engineering-story beat (highlight):**
> "The strongest candidate actually scored 93.60%, but it uses character n-grams that skl2onnx cannot export to ONNX. We chose the best exportable candidate at 92.94% so the model actually runs on Graviton."

**If Branch B:** append:
> "Those latency numbers are from the live endpoint, but right now the host is offline, so the dashboard is in cached mode."

---

### 01:00–01:15 — Design / UX + honesty demo

**Visual:** Slow pan across the dense table, tabular numerals, keyboard shortcut hint (`?`), and focus rings. Optionally unplug the network cable / disable Wi-Fi for 5 seconds to flip the header from `LIVE` to `CACHED` or `API OFFLINE`, then plug back in.

**Narration (Branch A & B):**
> "The UI follows an enterprise SOC density bar: 40-pixel table rows, 16-pixel card padding, Inter and JetBrains Mono fonts, and a single token file. Accessibility is verified with axe — zero violations — and every interactive element has a visible focus ring and keyboard shortcut."

**Cite:**
- `TEST_RESULTS_v4.md` — build, lint, axe 0 violations.
- `src/styles/tokens.css` — design tokens.
- `audit/PHASE4_QA_EVIDENCE.md` — contrast 23/23 AA.

---

### 01:15–01:30 — CTA

**Visual:** Full dashboard, then cut to Devpost submission page / GitHub link.

**Narration (Branch A & B):**
> "Vote for TicketSec Arm64 on Devpost. The README, model card, security review, and source are linked in the description."

**On-screen:** Devpost project URL + GitHub URL.

---

## Demo preparation checklist

Before recording:

- [ ] Run `curl -s http://3.23.60.61:8000/health` and note the result.
- [ ] Choose Branch A or B accordingly.
- [ ] If Branch A: verify `curl -s -X POST http://3.23.60.61:8000/predict -H "Content-Type: application/json" -d '{"text":"suspicious login from unknown device"}'` returns valid JSON.
- [ ] If Branch B: confirm `public/cache/tickets-snapshot.json` is committed and not hand-edited.
- [ ] Run `npm run build` and `npm run lint`; confirm 0/0.
- [ ] Open `http://localhost:5173` and ensure the correct badge (`LIVE` or `CACHED`) is visible.
- [ ] Hide personal bookmarks / browser extensions.
- [ ] Record at 1080p, 30 fps, with system audio off unless narrating live.

## Claim Traceability Ledger

| Claim | Artifact | SHA-256 | Date |
|---|---|---|---|
| Six categories | `model/categories.py` | N/A | repository |
| 0.38 MB INT8 model | `model/quantization.md` | `d9425f3122adba02183189b39b3ab1d5f75bf04e9caf43aa158cd78570579d2d` | 2026-07-19 |
| Held-out accuracy | `model/eval_results.json` | `74adeac8c07735303dfe77beb39a3a1a2b5218c05f5e5f5dc23246e9d6fb4002` | 2026-07-19 |
| Latency p50/p95 | `model/latency_t4g_micro.json` | `bcf9439154bb97225380da106d2662c247857726ac2500b49c5a33244098c096` | 2026-07-19 |
| axe 0 violations | `TEST_RESULTS_v4.md` | `545d5b64aeccb0e8828f3963f8e986a755c8191642a3efc72e12e46506501c06` | 2026-07-19 |
| Contrast AA | `audit/PHASE4_QA_EVIDENCE.md` | N/A | 2026-07-19 |
