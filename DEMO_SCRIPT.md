# TicketSec Arm64 — Demo Script (60–90 seconds)

> **THE HONESTY CONTRACT:** Every datum shown is either **live** (from the API), **cached** (amber `CACHED` badge, sourced from `public/cache/tickets-snapshot.json`), or shown as **"Unavailable — API offline"**. The Event Log records ONLY real events. Nothing is ever fabricated and presented as live.

This script is organized as a 60–90 second shot list. The only allowed signal for choosing the live vs. cached branch is:

```bash
curl -s http://3.23.60.61:8000/health
```

- **Branch A:** returns HTTP 200 → run the live classification shots.
- **Branch B:** non-200 / timeout → run the cached/offline honesty shots.

Every number spoken must trace to a committed artifact. PENDING values are announced as such.

---

## Shot list

### 00:00–00:08 — Hook + problem

**Visual:** Full dashboard, centered. Header and KPI cards visible.

**Narration:**
> "SOC analysts drown in alerts. TicketSec Arm64 triages security tickets into six categories — Phishing, Malware, Unauthorized Access, Data Breach, DDoS, and False Positive — and it never lies about whether the data is live or cached."

**Cite:** canonical categories from `model/categories.py`.

---

### 00:08–00:30 — Live classification on Graviton (Branch A)

**Visual:** Live Prediction panel. Cursor pastes text and clicks **Classify**.

**Actions:**
1. Paste: `suspicious login from unknown device`
2. Click **Classify**.
3. Show the returned `{predicted_category, confidence, processing_time_ms, probabilities}`.
4. Show the green `LIVE` badge in the header.
5. Show the new real Event Log entry.
6. Show the new row in the Recent Classifications table.

**Narration:**
> "I paste a ticket and hit Classify. The real `/predict` endpoint on the AWS Graviton t4g.micro returns the category, calibrated confidence, and inference time. The green LIVE badge and the Event Log entry prove this is a live call."

**Cite:** live response from `POST http://3.23.60.61:8000/predict`; latency from `model/latency_t4g_micro.json` (p50 0.237 ms, p95 0.286 ms, n=100, measured 2026-07-20).

---

### 00:08–00:30 — Honest cached mode (Branch B)

**Visual:** Header showing amber `CACHED` badge. Live Prediction panel showing "Unavailable — API offline". Event Log empty.

**Actions:**
1. Show the amber `CACHED` badge in the header.
2. Point to the ticket table, populated from `public/cache/tickets-snapshot.json`.
3. Hover over the Live Prediction panel to show "Unavailable — API offline".
4. Show the silent Event Log.

**Narration:**
> "Right now the backend is unreachable, so the dashboard shows the amber CACHED badge. The ticket table comes from a committed snapshot, the prediction panel says Unavailable — API offline, and the Event Log stays silent. This is not a fallback excuse — it is the product feature."

**Cite:** `public/cache/tickets-snapshot.json`; `useApi` status model; `tests/flows/offline-silence.test.tsx`.

---

### 00:30–00:55 — Model Registry: hashes, ablation, confusion matrix

**Visual:** Model Registry view. Pan across the Model Card, Accuracy & Eval, and Latency on Graviton panels.

**Actions:**
1. Show the Model Card with artifact size (0.38 MB), SHA-256 prefix, and target host.
2. Show the Accuracy & Eval panel: 92.94% accuracy, 609-sample test set, per-class metrics.
3. Show the confusion matrix snippet or mention it is committed in `model/confusion_matrix.json`.
4. Show the Latency on Graviton panel: p50 0.237 ms, p95 0.286 ms.

**Narration:**
> "The Model Registry shows the artifact hash, the 0.38 MB INT8 size, and the 92.94% held-out accuracy on a 609-sample test set. Latency on the real t4g.micro is 0.237 ms at p50 and 0.286 ms at p95."

**Engineering-story beat (highlight):**
> "The strongest candidate actually scored 93.60%, but it uses character n-grams that skl2onnx cannot export to ONNX. We chose the best exportable candidate at 92.94% so the model actually runs on Graviton."

**Cite:**
- `model/eval_results.json` — accuracy, ablation, per-class metrics.
- `model/confusion_matrix.json` — confusion matrix.
- `model/latency_t4g_micro.json` — p50/p95.
- `model/quantization.md` — INT8 size and RAM budget.
- `MODEL_CARD.md` — candidate selection rationale.

**If Branch B:** append:
> "Those latency numbers are from the live endpoint; right now the host is offline, so the dashboard is in cached mode."

---

### 00:55–01:15 — Honesty drill (recommended for Branch A, mandatory if time permits)

**Visual:** Header, Live Prediction panel, Event Log.

**Actions:**
1. Block the API by disabling Wi-Fi / unplugging the network cable for ~5 seconds, OR toggle the API base URL in the Settings drawer to a non-routable host.
2. Watch the header flip from `LIVE` to `CACHED` or `API OFFLINE`.
3. Try to submit a classification; the button is disabled and no request is sent.
4. Show the Event Log: no new fabricated entries appear.
5. Restore connectivity and watch the badge return to `LIVE`.

**Narration:**
> "If the API drops, the dashboard flips to cached mode, the prediction panel disables itself, and the Event Log stays silent. No fake entries. When connectivity returns, it goes back to live. That is the Honesty Contract."

**Cite:** `tests/flows/offline-silence.test.tsx`; `tests/flows/classify-offline.test.tsx`; `public/cache/tickets-snapshot.json`.

---

### 01:15–01:30 — Close + CTA

**Visual:** Full dashboard, then cut to Devpost submission page / GitHub link.

**Narration:**
> "TicketSec Arm64: a tiny, honest SOC dashboard that ships the model that runs on ARM64, not just the one that scores highest. Vote for it on Devpost; the README, model card, and source are linked below."

**On-screen:** Devpost project URL + GitHub URL.

---

## Fallback narration if the API drops mid-recording

If the Graviton host becomes unreachable while recording a Branch A take:

1. **Do not restart the recording.** Keep the current clip running.
2. **Point to the header.** Say: "The backend just went offline. Watch what happens."
3. **Show the transition:** green `LIVE` → amber `CACHED` or `API OFFLINE`.
4. **Show the consequences:** prediction panel disabled, Event Log silent, ticket table still populated from the committed snapshot.
5. **Conclude with:** "This is the feature, not a bug. The dashboard is honest by design."

This honest transition is a stronger demo than a perfectly stable synthetic one.

---

## Demo preparation checklist

Before recording:

- [ ] Run `curl -s http://3.23.60.61:8000/health` and note the result.
- [ ] Choose Branch A or B accordingly.
- [ ] If Branch A: verify `curl -s -X POST http://3.23.60.61:8000/predict -H "Content-Type: application/json" -d '{"text":"suspicious login from unknown device"}'` returns valid JSON.
- [ ] If Branch B: confirm `public/cache/tickets-snapshot.json` is committed and not hand-edited.
- [ ] Run `npm run build` and `npm run lint`; confirm 0/0.
- [ ] Run `bash scripts/gates.sh`; confirm 11/11 PASS.
- [ ] Open `http://localhost:5173` and ensure the correct badge (`LIVE` or `CACHED`) is visible.
- [ ] Hide personal bookmarks / browser extensions.
- [ ] Record at 1080p, 30 fps, with system audio off unless narrating live.

---

## Claim Traceability Ledger

| Claim | Artifact | SHA-256 | Date |
|---|---|---|---|
| Six categories | `model/categories.py` | N/A | repository |
| 0.38 MB INT8 model | `model/quantization.md` | `d9425f31...` | 2026-07-20 |
| Held-out accuracy | `model/eval_results.json` | `05b4c580...` | 2026-07-20 |
| Latency p50/p95 | `model/latency_t4g_micro.json` | `835355a1...` | 2026-07-20 |
| axe 0 violations | `TEST_RESULTS_v4.md` | `52bc513e...` | 2026-07-20 |
| Contrast AA | `audit/PHASE4_QA_EVIDENCE.md` | N/A | 2026-07-20 |
| Offline silence | `tests/flows/offline-silence.test.tsx` | N/A | repository |
