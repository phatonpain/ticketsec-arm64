# COPY_FIXES.md — Microcopy & Empty-State Audit (W-07)

**Scope:** every user-facing string in the TicketSec Arm64 dashboard.
**Sources:** `evidence/text-content.txt` (all 160 nodes, read fully), `evidence/dom.html` (title/placeholder/aria attrs), `evidence/a11y-attrs.txt` (48 entries), screenshots S1–S4.
**Standard:** Splunk ES / CrowdStrike Falcon-class SOC console. English only. Honesty Contract preserved — no replacement below fabricates data or hides the offline state.
**Status tags:** **[CONFIRMED]** = string verified verbatim in evidence. **[INFERRED]** = root cause/wiring needs `src/` to confirm; replacement string itself is ready to paste.

**Excluded (NOT app copy — do not patch):**
- "Ferramentas de IA" (text node 160) — injected by the Kimi WebBridge browser extension (float button: `div.float-btn`, `chat-gpt-query-model-wrapper` in `dom.html`; cf. S1–S4 browser bar "O Kimi WebBridge começou a depurar este navegador"). Extension noise, same class as the `contentscript.js` console noise in S6.
- No lorem ipsum, no placeholder filler, no non-English strings found in app copy. Sample ticket texts are realistic SOC examples — keep.

---

## 1. Sidebar / Brand

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-01 | Sidebar product subtitle | text-content L3; S1 | `Arm64 Guardian` | Consumer codename ("Guardian") undermines enterprise tone; casing "Arm64" conflicts with "ARM64" used on the same screen (L27). | `Security Operations` | P1 |
| C-02 | Sidebar search placeholder | a11y-attrs; dom.html `placeholder="Search tickets..."` | `Search tickets...` | Three ASCII dots; app standard is single ellipsis U+2026 (cf. textarea placeholder). | `Search tickets…` | P2 |
| C-03 | User card role | text-content L19; S1 | `Security Analyst` | Correct, SOC-conventional. Keep. | — (no change) | — |

## 2. Header

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-04 | Connection pill (transient) | text-content L23; S1–S4 | `Checking…` | Ambiguous — what is being checked? Pill persisted across all four screenshots while API was already unreachable (S6: ERR_CONNECTION_TIMED_OUT ×3), so the transient state also appears to hang. | `Connecting to inference API…` | P1 |
| C-05 | Connection pill (terminal states) | [INFERRED — needs src/ to confirm pill state machine; only "Checking…" captured] | (not captured) | Pill must resolve to an honest terminal state, not spin forever. | Live: `LIVE` · Offline: `API OFFLINE` | P0 |
| C-06 | Time-range selector | text-content L24; S1 | `Last 24 hours` | Correct. Keep. | — (no change) | — |
| C-07 | Notifications button | a11y-attrs | `Notifications, 3 unread` (aria-label) | Correct pattern. Keep. | — (no change) | — |
| C-08 | Refresh button | a11y-attrs | `Refresh data` (aria-label) | Correct. Keep. | — (no change) | — |
| C-09 | Breadcrumb leaf vs page title | text-content L20–22 vs L26; S1 | `Dashboard › Security Operations` + H1 `Security Operations Center` | Two names for one page ("Security Operations" vs "Security Operations Center"). | Breadcrumb: `Dashboard › Security Operations Center` — or drop the leaf; H1 unchanged | P2 |

## 3. Page title block

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-10 | H1 | text-content L26; S1 | `Security Operations Center` | Good. Keep. | — (no change) | — |
| C-11 | Tagline | text-content L27; S1 | `Real-time ML ticket classification on AWS Graviton ARM64` | "Real-time" over-promises while every panel is cached; casing "ARM64" vs brand "Arm64" (C-01). | `ML ticket classification on AWS Graviton Arm64` | P2 |

## 4. KPI cards

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-12 | Latency KPI subtitle | text-content L29–31; S1 | `—` + `Last known latency · cached snapshot` | **Honesty contradiction:** copy claims a last-known value exists, but the metric shows null "—". Either show the cached value or stop claiming it exists. | If snapshot has a value: render it + `Cached snapshot from <timestamp>`. If not: `No cached latency — API offline` | P0 |
| C-13 | Throughput KPI subtitle | text-content L33–35; S1 | `—` + `Last known throughput · cached snapshot` | Same contradiction as C-12; also no unit context (req/s? req/min?). | Value state: `Cached snapshot from <timestamp>`. Null state: `No cached throughput — API offline`. Label context: `THROUGHPUT (REQ/MIN)` | P0 |
| C-14 | Accuracy KPI subtitle | text-content L38–39; S1 | `Awaiting eval — see MODEL_CARD.md` | Dead end: points to a repo file the analyst cannot open from the UI; "eval" is jargon-forward. | `No evaluation run recorded — metrics appear after the first run against live traffic` | P1 |
| C-15 | Accuracy KPI badge | text-content L38; S1 | `Pending Validation` (rendered PENDING VALIDATION) | Correct state term. Keep; canonical (see Vocabulary). | — (no change) | — |
| C-16 | Footprint KPI value | text-content L41; S1 | `8.73MB` | Missing space between number and unit. | `8.73 MB` | P2 |
| C-17 | Footprint KPI subtitle | text-content L42–43; S1 | `ONNX INT8` | Terse but accurate; add budget context so the number means something. | `INT8-quantized ONNX · 1.2% of the 700 MB t4g.micro budget` | P2 |
| C-18 | KPI info tooltip (latency) | S1 (stuck tooltip over header) | `Latency data comes from the live metrics endpoint when available. Sparkline shows the last 24 points.` | References a sparkline that is not rendered in cached state — copy promises a UI element that isn't there. [INFERRED: sparkline presumably renders with live data only] | `Reported by the inference API /metrics endpoint. Sparkline: last 24 samples when live data is available.` | P2 |

## 5. Threat Category Distribution (bar chart)

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-19 | Panel provenance line | text-content L48; S1–S2 | `Snapshot: cached` | Jargon-forward, no timestamp, duplicated verbatim on 6 panels (L48, L53, L60, L76, L134, L147) — reads like a debug label. | `Cached snapshot from <timestamp>` (bind to snapshot `generatedAt`) [INFERRED — field name needs src/] | P1 |
| C-20 | Subtitle | text-content L45; S1 | `Detections by category` | Accurate. Keep. | — (no change) | — |

## 6. Model Footprint (donut)

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-21 | Donut center label | S1 (ECharts canvas) | `8.73MB Optimized` | "Optimized" is marketing-vague and unsubstantiated; missing unit space. | `8.73 MB` (line 1) `of 700 MB budget` (line 2) | P1 |
| C-22 | Legend row 1 | S1 | `Model (INT8) 8.73MB 1.2%` | Missing space; "1.2%" lacks "of budget" context. | `Model (INT8) — 8.73 MB · 1.2% of budget` | P2 |
| C-23 | Legend row 2 | S1 | `Memory headroom 691.27MB 98.8%` | Ambiguous: 98.8% reads as usage at a glance; missing space. | `Free headroom — 691.27 MB · 98.8% of budget` | P1 |
| C-24 | Footer caption | text-content L54; S1 | `Budget: 700MB` | Missing space. | `Budget: 700 MB (t4g.micro, 1 GB RAM)` | P2 |
| C-25 | Subtitle | text-content L50; S1 | `INT8 artifact vs t4g.micro memory budget` | Accurate and specific. Keep. | — (no change) | — |

## 7. Classification Performance (empty state)

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-26 | Empty-state title | text-content L58; S2 | `Awaiting live performance data` | Passive dead end — no what/why/next. | `No accuracy data available` | P1 |
| C-27 | Empty-state body | text-content L59; S2 | `Historical accuracy will appear once the API returns real metrics.` | Does not say why it is empty now (API offline + no cached series) or what happens next. | `Accuracy is computed from inference API metrics. The API is currently offline and the cache holds no accuracy series. This chart populates automatically when the API reconnects — no action needed.` | P1 |
| C-28 | Subtitle | text-content L56; S2 | `Accuracy over the last 24 hours` | Keep, but tie to the live range selector for consistency. | `Accuracy over the selected time range` | P2 |

## 8. System Monitor

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-29 | Metric null state ×4 | text-content L66/69/72/75; S2 | `Unavailable — API offline` | Correct, honest, and internally consistent — this is the canonical metric-level null string. Keep. | — (no change) | — |
| C-30 | Panel provenance line | text-content L76; S2 | `Snapshot: cached` | **Honesty contradiction:** claims a cached snapshot exists while all four metrics are "Unavailable". If the snapshot has no system metrics, say so. | `No cached system metrics — API offline` (when snapshot lacks this section); otherwise `Cached snapshot from <timestamp>` | P0 |
| C-31 | Metric label | text-content L73; S2 | `Requests / Min` | Spacing around slash; canonical unit form. | `Requests/min` | P2 |
| C-32 | Metric label | text-content L67; S2 | `Memory (RAM)` | Redundant parenthetical. | `Memory` | P2 |
| C-33 | Metric label | text-content L64; S2 | `CPU (Neoverse N1)` | Hardware specificity is exactly right for an Arm64 ops console. Keep. | — (no change) | — |

## 9. Recent Classifications (table)

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-34 | Panel subtitle | text-content L78; S2–S3 | `Cached predictions — API offline` | Third phrasing for the same state (vs. badge "API Offline — Displaying cached data" 20 px away, and "Snapshot: cached" footers elsewhere). Fragmented vocabulary reads as unpolished. | `Cached snapshot from <timestamp>` | P1 |
| C-35 | Offline banner badge | text-content L80; S2–S3 | `API Offline — Displaying cached data` | Right idea, non-canonical phrasing; casing "API Offline" vs badge style "CACHED". | `API OFFLINE — showing cached snapshot` | P1 |
| C-36 | Category badge (row 3) | S2–S3 | `Unauthorized Acces` (clipped mid-word, no ellipsis, **no title attr** — cf. a11y-attrs) | Category names are never truncated — this is data, not decoration. Fix layout (badge `white-space: nowrap`, column min-width), not text; add `title="Unauthorized Access"` as stopgap. [Layout owner: UI auditor] | Full string always: `Unauthorized Access` | P1 |
| C-37 | Assignee cell (rows 3–4) | S2–S3 | `Security T…` | Truncates a 12-character word; **no title attr** (absent from a11y-attrs) so full text is unreachable. Fix column width; add `title="Security Team"`. | `Security Team` | P1 |
| C-38 | Subject cells (5 rows) | text-content L96/110/124; a11y-attrs `td title=...` | `Suspicious email asking for ban…` etc. | Acceptable pattern: truncated with U+2026 + full text in `title` on the `<td>`. Verified present for all 5 rows. Keep; ensure the row's keyboard focus (`tr tabindex=0`) also exposes it (a11y owner). | — (no change) | — |
| C-39 | Export button | text-content L79; a11y-attrs | `Export CSV` + title `Export filtered results as CSV` | Correct and descriptive. Keep. | — (no change) | — |
| C-40 | Pagination | text-content L130–133; S3 | `Showing 1–5 of 6` · `Previous` · `Page 1` · `Next` | "Page 1" lacks total pages. | `Page 1 of 2` | P2 |
| C-41 | Table footer | text-content L134; S3 | `Snapshot: cached` | Same as C-19. | `Cached snapshot from <timestamp>` | P1 |
| C-42 | Relative time cells | text-content L101…129; S3 | `2m ago` / `5m ago` / … | Format is correct SOC idiom, but no full-timestamp access (no `title` on time cells in a11y-attrs). Add `title` with full ISO timestamp. [code change, copy rule] | Display unchanged; add `title="17 Jul 2026, 13:17:50 UTC"`-style full timestamp | P2 |

## 10. Event Log

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-43 | Panel footer | text-content L147; S4 | `Snapshot: cached` | Same as C-19. | `Cached snapshot from <timestamp>` | P1 |
| C-44 | Filter chips | text-content L137–140; S4 | `All` / `Info` / `Debug` / `Error` | Correct severity vocabulary. Keep. | — (no change) | — |
| C-45 | Entries | text-content L141–146; S4 | `Dashboard initialized` / `Health probe started` | Correct, terse, honest. Both carry `title` attrs. Keep. | — (no change) | — |

## 11. Live Predictions

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-46 | Panel heading vs nav | text-content L148 vs L11; S1/S4 | Nav: `Live Predictions` — Panel: `Live Classification` | Same surface, two names. Zero-cost fix: rename the heading (no route change). | `Live Predictions` | P1 |
| C-47 | Panel subtitle | text-content L149; S4 | `Submit a ticket for real-time prediction` | Imperative subtitle describing what the form already shows; over-promises "real-time" while API is offline. | `Real-time classification via the ONNX inference API` + when offline: `API offline — live classification unavailable` | P1 |
| C-48 | Textarea placeholder | a11y-attrs | `Paste ticket subject or body here…` | Good — action, content, correct ellipsis. Keep. | — (no change) | — |
| C-49 | Keyboard hint | text-content L150; S4 | `Ctrl+Enter to submit` | Works, but format is non-standard and it is the *only* documented shortcut (guarantee #6 implies more exist). [INFERRED — other shortcuts need src/ to confirm] | `Ctrl + Enter to classify` (kbd styling); if more shortcuts exist, list them in one "Keyboard shortcuts" popover (e.g. `?`) | P2 |
| C-50 | Sample chips ×3 | text-content L151–153; S4 | `suspicious email asking for bank credentials` / `trojan horse detected in downloaded file` / `multiple failed login attempts from unknown IP` | All-lowercase reads sloppy next to sentence-case table subjects (which use the same texts capitalized). Add a micro-label so chips read as samples, not history. | `Suspicious email asking for bank credentials` / `Trojan horse detected in downloaded file` / `Multiple failed login attempts from unknown IP`; label above chips: `Try a sample` | P2 |
| C-51 | Primary button | text-content L154; S4 | `Classify Ticket` | Correct verb-object action. Keep. | — (no change) | — |
| C-52 | Result-area empty state | text-content L155; S4 | `Submit a ticket to see the real-time prediction result.` | States the obvious, and promises "real-time" while the API is offline — clicking can only fail (S6: connection timed out). Honesty risk. | Online idle: `Enter ticket text and select Classify Ticket — predicted category, confidence, and latency appear here.` Offline: `Inference API offline — live classification unavailable. Cached predictions are listed under Recent Classifications.` | P0 |
| C-53 | Offline submit behavior | [INFERRED — needs src/; button enabled in S4 while API unreachable] | (button active while offline) | If the button stays enabled offline, the error toast copy must be honest and specific. | Error toast: `Classification failed — inference API unreachable (3.23.60.61:8000). Retry when the API is back, or review cached predictions.` | P0 |

## 12. Footer

| # | Location | Evidence | Current string (verbatim) | Problem | Replacement string (verbatim) | Severity |
|---|----------|----------|---------------------------|---------|-------------------------------|----------|
| C-54 | Footer meta line | text-content L156; S4 | `TicketSec Arm64 Guardian \| AWS Graviton Deployment \| ONNX Runtime · API Docs · GitHub` | Mixed separators (`\|` then `·`); "Guardian" codename (C-01). | `TicketSec Arm64 · AWS Graviton Deployment · ONNX Runtime` then links `API Docs · GitHub` | P2 |
| C-55 | API Docs link | a11y-attrs: `href="http://3.23.60.61:8000/docs"` | `API Docs` | Label fine; target is the offline host, so the link is currently dead. Keep the link (honest), add expectation-setting tooltip. | Label unchanged; add `title="Swagger UI — available when the inference API is online"` | P2 |
| C-56 | GitHub link | a11y-attrs: `href="https://github.com/phatonpain/ticketsec-arm64"` | `GitHub` | Correct. Keep. | — (no change) | — |
| C-57 | Document title | saved HTML filename: `TicketSec Arm64 - Security Operations …` | `TicketSec Arm64 - Security Operations` | Hyphen separator; align with canonical "·"/em-dash style. | `TicketSec Arm64 — Security Operations` | P2 |

## 13. Nav labels (conservative review — renames have routing cost)

| # | Location | Evidence | Current string | Assessment | Recommendation | Severity |
|---|----------|----------|----------------|------------|----------------|----------|
| C-58 | Nav OVERVIEW | text-content L5–8 | `Dashboard` / `Cases` / `Detections` / `Threat Analytics` | All match SOC conventions (Splunk ES uses the same nouns). | Keep all | — |
| C-59 | Nav OPERATIONS | text-content L10 | `Ticket Query` | "Investigations" is the Splunk ES idiom, but renaming costs a route change for marginal gain. | Keep `Ticket Query`; revisit only if routes are ever refactored | — |
| C-60 | Nav OPERATIONS / SYSTEM | text-content L11–15 | `Live Predictions` / `Model Registry` / `System Health` / `API Metrics` / `Settings` | All conventional. | Keep all; only fix the panel-heading mismatch (C-46) | — |

## 14. Cross-cutting defects (patterns, not single strings)

| # | Pattern | Evidence | Problem | Rule / Fix | Severity |
|---|---------|----------|---------|-----------|----------|
| C-61 | Offline-state vocabulary fragmentation | text-content L31/35/48/53/60/66/76/78/80/134/147 | **Six** phrasings for two states: "Last known X · cached snapshot", "Snapshot: cached" ×6, "Cached predictions — API offline", "API Offline — Displaying cached data", "Unavailable — API offline", "CACHED" badge. | Adopt the canonical vocabulary below; one term per state, per surface. | P1 |
| C-62 | Ellipsis character inconsistency | dom.html: `...` ×1 (`Search tickets...`) vs `…` (U+2026) ×5 | Mixed ASCII triple-dot and U+2026. | U+2026 `…` everywhere (C-02). | P2 |
| C-63 | Unit spacing | S1; text-content L41/52/54 | `8.73MB`, `691.27MB`, `700MB` | Non-breaking space between number and unit: `8.73 MB`. Apply in KPI, chart formatters (chartTokens), and captions. | P2 |
| C-64 | Brand casing | text-content L3 vs L27 | `Arm64` vs `ARM64` on one screen. | `Arm64` everywhere (Arm trademark style; matches repo `ticketsec-arm64`). | P2 |
| C-65 | Null glyph "—" without reason | S1/S2 (KPIs) | "—" alone is honest but unexplained outside System Monitor. | Every "—" must be paired with a reason string (canonical: `Unavailable — API offline` or `No cached X — API offline`). | P1 |
| C-66 | Truncation policy | S2–S3; a11y-attrs | Category badge + assignee clipped with no `title` fallback (C-36/C-37); subjects correctly use `title`. | Policy: (1) never truncate category names, status, severity, IDs; (2) free-text fields may truncate at word boundary + U+2026 **only** with full text in `title`; (3) fix layout before truncating. | P1 |

---

## CANONICAL VOCABULARY (binding for all future copy)

**Data states — one badge term + one sentence pattern each:**
| State | Badge (styled ALL-CAPS via CSS) | Explanatory sentence |
|-------|--------------------------------|----------------------|
| Live data | `LIVE` | `Streaming from the inference API` |
| Cached data | `CACHED` | `Cached snapshot from <timestamp>` |
| API unreachable | `API OFFLINE` | `Unavailable — API offline` (metric level) · `API OFFLINE — showing cached snapshot` (panel/banner level) |
| Metric not yet computed | `PENDING VALIDATION` | `No evaluation run recorded` |

**Provenance line (replaces every "Snapshot: cached" / "Last known X · cached snapshot"):**
`Cached snapshot from <timestamp>` — `<timestamp>` = snapshot `generatedAt`, formatted `17 Jul 2026, 13:19 UTC`. Never claim a "last known value" while rendering "—".

**Connection pill (header):** `Connecting to inference API…` → `LIVE` → `API OFFLINE`. Never a permanent transient state.

**Null metric:** glyph `—` + adjacent reason string. Null is never naked.

**Units:** non-breaking space between number and unit (`8.73 MB`, `700 MB`, `691.27 MB`); `Requests/min`; latency `ms`; percentages as `98.8% of budget` when the base is ambiguous.

**Punctuation:** ellipsis `…` (U+2026) only; meta-line separator `·` (U+00B7); state explanations use em dash `State — reason`; document titles use em dash.

**Categories (never truncated, never abbreviated):** `Phishing`, `Malware`, `Unauthorized Access`, `Data Breach`, `DDoS`, `False Positive`.

**Statuses:** `Resolved`, `Escalated`, `Pending`. **Severities:** `Critical`, `High`, `Medium`, `Low`. **Assignees:** `Auto`, `Security Team`, `NOC` — full strings, layout must fit them.

**Actions (verb + object, sentence case):** `Classify Ticket`, `Export CSV`, `Refresh data`, `Search tickets…`, `Previous` / `Next`, pagination `Page X of Y`.

**Keyboard hints:** `Ctrl + Enter` format, kbd-styled, all shortcuts documented in one place.

**Brand:** `TicketSec Arm64` (product), `Security Operations Center` (page), `AWS Graviton Arm64` (platform). No codenames ("Guardian") in UI chrome.

**Time:** relative `2m ago` for <1 h, with full UTC timestamp in `title`; log entries use `HH:MM:SS`.

**Empty states (pattern):** 1) what is missing, 2) why (name the real cause — offline / not yet computed / none cached), 3) what happens next and whether the user must act. No dead ends, no repo-file references (`MODEL_CARD.md`) as UI copy, no "awaiting" without a resolution path.

**Forbidden:** fabricated values in offline states; skeletons implying live data; "real-time" claims in copy while `API OFFLINE`; truncating controlled vocabulary; ASCII `...`; unit-less large numbers; exclamation marks; "Oops"/"Whoops" register.
