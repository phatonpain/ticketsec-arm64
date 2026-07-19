# AGENTS.md — TicketSec Arm64
## O que é
SOC ticket-triage dashboard: React+Vite frontend (hash-routed), FastAPI
/predict backend, ONNX model served on AWS Graviton (arm64, systemd unit
"ticketsec"). Public demo endpoint on :8000 during hackathon period.
## Leis permanentes (nunca violar)
1. DESIGN_BRIEF.md + tokens.css + Honesty Contract (live/cached/offline
   truthfulness) override everything. UI never fakes "live".
2. Every UI number traces to a committed artifact (model/*.json) or a
   live/store source. Never type a metric into code.
3. Surgical diffs. No rewrites of working systems. No new dependency
   without a one-line justification.
4. No guessing: verify against code or mark UNKNOWN.
5. Gates are machine-checkable (scripts/gates.sh). Never lower a gate.
6. Conventional commits. Green-gate checkpoints only.
## Comandos canônicos
- Dev:        npm run dev          (frontend, :5173)
- Build:      npm run build        (watch: main chunk must stay <600KB)
- Lint:       npm run lint         (0 errors / 0 warnings required)
- Tests:      npx vitest run       (all green, 0 it.fails, 0 skips)
- A11y:       npx axe <route>      (0 violations per hash route)
- Gates:      bash scripts/gates.sh
- Model eval: python -m model.eval (must run clean; seed 42,
              GroupShuffleSplit)
## Convenções
- Views live in src/views/<Name>/; one error boundary per view root.
- ECharts always lazy-chunked; EventLog updates must not re-render charts.
- CSS only via tokens.css variables — no hex literals in components.
- Skeletons only where data is genuinely loading.
## Restrições de segurança
- Zero dangerouslySetInnerHTML. Model output renders as data only.
- /predict: payload cap + rate limit are P0 (public endpoint).
- No secrets in repo. ticketsec-key.pem never commits. Scan before push:
  grep -rEn '(api[_-]?key|secret|token|password|BEGIN.*PRIVATE KEY)' \
    src/ public/ model/ ops/ app/ data/
## Definição de "pronto"
build 0 errors + chunk <600KB · lint 0/0 · vitest green · axe 0 ·
contrast 23/23 · honesty matrix pass · tree clean & committed.
