# HANDOFF P6 — G5/G7 reais (mission/v5)

Data: 2026-07-23 · Branch: mission/v5 · Baseline: tag `baseline-v5`
Fase: implementação das assertions reais de G5 (honesty) e G7 (traceability),
o blocker #1 declarado no CURRENT STATE da Master Mission.

## Done (file:line)

- `scripts/honesty_check.sh` — G5 real, 7 assertions estáticas (H1–H7):
  sem `setInterval` em src/, `Math.random` confinado a
  `useEventLog.ts`/`backoff.ts`, `source: 'live'` só em `App.tsx`,
  fallbacks Suspense só `ChartSkeleton`/`null`, `ProvenanceBadge` nas 5
  superfícies cache-able, copy offline "Unavailable" presente, zero
  `dangerouslySetInnerHTML`. Runtime matrix (live/cached/offline + silêncio
  de 60 s) permanece em `scripts/qa_honesty_matrix.mjs` como evidência QA.
- `scripts/trace_check.sh` — G7 real: T1 readiness dos 7 artefatos via
  JSON (node), T2 `src/lib/artifacts.ts` como único importador de `model/*`,
  T3 scan de literais órfãos (`%|MB|GB|vCPU|RPM`) com allowlist justificada
  `scripts/g7_orphan_allowlist.txt`; entradas stale da allowlist reprovam.
- `src/components/ModelHealthDonut.tsx:29-37,126-138` — fix A3: removidos
  fallbacks hardcoded `0.38`/`700`; artefato ausente agora rende
  `EmptyState` "Model metadata pending" (sem duplicar valores do artefato).
- Teste negativo de ambos os gates: arquivo-sonda com `setInterval` +
  literal `42 GB` → G5 e G7 vermelhos; removido → verdes. Um gate que não
  falha é inválido (A5).
- Gate run final: **G1–G8 8/8 PASS, GATES_RC=0** (2026-07-23 05:39:51Z),
  evidência em `TEST_RESULTS_v4.md`.
- Commit: `fcf83f6 test(gates): real G5/G7 assertions replacing stubs`.
- `.gitignore`: exceção `!scripts/g7_orphan_allowlist.txt`.

## Open items (achados do audit, não corrigidos nesta fase — cirúrgico)

1. **Backend fabrica confiança "live"**: `app/main.py:507-531`
   (`/api/v1/classifications`) gera `confidence = 0.75 + 0.24*rng.random()`
   e status/assignee aleatórios; `src/App.tsx:57-68` marca essas linhas como
   `source: 'live'`, então números RNG aparecem sob badge Live. Viola o
  espírito do Honesty Contract. Opções: (A) marcar essas linhas como
   snapshot/sintéticas na UI; (B) backend persistir scores reais de
   inferência. Precisa de decisão — Fase seguinte.
2. **`/api/v1/performance/history` sempre retorna `[]`**
   (`app/main.py:494-499`): `PerformanceLineChart`/`ModelPerformancePanel`
   nunca têm série live real. Honesto porém vazio — decidir se instrumenta
   de verdade ou remove a superfície.
3. **Drift do threshold 70%**: `src/components/LivePrediction.tsx:417-428`
   espelha `TIERED_CONFIDENCE_THRESHOLD` (app/main.py:55) sem ler do backend.
   `model/decision_threshold.json` está no `.gitignore:41` — ou se commita
   esse artefato e a UI lê via `artifacts.ts`, ou o backend expõe o valor.
   Allowlisted no G7 com justificativa.
4. **Superfícies sem badge de proveniência** (achado do audit):
   `TimelineChart`, `CategoryCountBlocks` e `ModelPerformancePanel` rendem
   dados de snapshot sem `ProvenanceBadge`; donuts derivam `source` do
   status global (`Dashboard.tsx:25-30`) e podem omitir CACHED quando a API
   está live mas as linhas são snapshot. H5 do G5 cobre só as 5 superfícies
   originais — ampliar se decidido.
5. **Duplicata de copy de backoff**: "5s–60s" em `Header.tsx:390` e
   `SystemMonitor.tsx:149` duplica `useApi.ts:124`. Não coberto pelo scan
   de unidades do G7 (unidade `s`).
6. `tests/README.md:7` menciona "27 expected-fails" — stale; suíte tem 0.

## Next-phase warnings

- G5/G7 agora reprovam de verdade: qualquer literal novo com unidade
  métrica em src/ quebra o build de gates — justificar na allowlist ou
  wire no artefato. Não contornar (A6/E3).
- `run_script_gate` em `scripts/gates.sh:32` marca STUB se o script
  contiver `# TODO: implement` — não reintroduzir esse marker.
- A matriz runtime (`qa_honesty_matrix.mjs`) mata o processo na porta 8000
  via PowerShell — nunca rodar com o backend de produção acessível localmente.
- Veredito A10: fase com mudança mensurável real (2 gates STUB→reais,
  1 fix A3, 8/8 verde). Sem vitória vazia.

## Evidence paths

- `TEST_RESULTS_v4.md` — dois gate runs desta fase (05:36:41Z com G8 red
  pré-commit; 05:39:51Z 8/8 verde).
- `scripts/g7_orphan_allowlist.txt` — 4 exceções justificadas.
- Audit de superfícies (explore subagent): relatório na sessão; achados
  consolidados nos Open items acima.

## Addendum — FASE 1 close-out (2026-07-23, commit `0661c08`)

A FASE 1 formal da Master Mission pediu exatamente este trabalho (G5/G7
reais). O grosso já estava neste HANDOFF; o addendum registra o delta:

- **H8 adicionada** (`scripts/honesty_check.sh`): detecção de dados
  hardcoded em componentes — arrays literais tipo-ticket, confianças
  literais (`confidence: 0.x`), timestamps ISO fabricados. src/ estava
  limpo (0 violações); sonda de teste reprovou e foi removida. Spec pedia
  também skeleton-sem-loading (coberto por H4: único skeleton do projeto é
  `ChartSkeleton`, só como fallback de Suspense) e LIVE-badge-vs-provenance
  (coberto comportamentalmente por `tests/flows/honesty-matrix.test.tsx`
  sob G3; estaticamente por H3).
- **G3 flake eliminado** (`vitest.config.ts:16-21`): root cause da FASE 0
  — `EnvironmentTeardownError: Closing rpc while "onUserConsoleLog" was
  pending`, rc=1 com 178/178 verdes. `disableConsoleIntercept: true`;
  2/2 repros `build+vitest` sem o erro fantasma. Efeito colateral:
  warnings `act()` do React agora aparecem crus no stderr (antes eram
  engolidos pela interceptação); nenhum teste depende de console
  interceptado.
- **Violações encontradas e corrigidas na fase (file:line)**: 1 systemic
  (G3 flake, vitest.config.ts) + 0 órfãos novos (T3 estável com 4
  exceções allowlisted < 10 — condição de stop não acionada).
- **Gate run final: 8/8 PASS, GATES_RC=0** (2026-07-23 08:59:23Z,
  `TEST_RESULTS_v4.md`) — primeira integralidade de gates com G5/G7 reais
  e G3 endurecido.

## Addendum — FASE 2 close-out: documentation pack (2026-07-23, commit `26b2b23`)

Spec pedia `HANDOFF_P2.md`; P2 já existe da v4 — registro aqui (mesma regra
da FASE 1). Gate run final: **8/8 PASS, GATES_RC=0** (15:12:07Z,
`TEST_RESULTS_v4.md`).

### Done (file:line)

- `README.md` — quickstart Docker (all-in-one :8000), linha Wilson 95% CI
  derivada [90.63%, 94.72%] ±2.05pp, linha multi-tier, quality bars
  atualizados (G1–G8, chunk 321.32KB), links novos, layout com Dockerfile.
- `docs/MIGRATION_GUIDE.md` — guia reutilizável sklearn→ONNX→Arm64
  (subagent coder, fatos conferidos): pipeline real, pitfall char_wb C2→C1,
  tamanho paridade, checklist de 10 pontos.
- `docs/PERFORMANCE.md` — metodologia (n=100, processing_time_ms server-side,
  RTT excluído) + resultados + design multi-tier com custo honesto do tier
  `unavailable` (p50 ≈4s = timeout de conexão, não inferência; LLM tier
  n=0 — Ollama offline, célula vazia em vez de estimativa).
- `docs/DEVPOST_SUBMISSION.md` — draft duplo (Arm Cloud AI / NeuralSprint).
- `Dockerfile` + `.dockerignore` — multi-stage node22→python3.12-slim;
  `app/main.py` monta `dist/` só quando presente (mount registrado por
  último; rotas API vencem). Rota `GET /` JSON removida (nada consumia —
  verificado em ops/, src/) para o mount servir index.html.

### Correções de fatos encontradas na fase (reviewer A7 + verificação)

1. `model/quantization.md` estava STALE: bytes 401,542/401,770 → real
   401,864/401,872 (stat + sha256 + `artifact_meta.json` conferem), hashes
   atualizados, "-0.1% smaller" → "same size (+8 bytes, +0.002%)",
   1→2 vCPU. `model/export_onnx.py:189` (template) corrigido também.
2. Custo do host errado desde a v4: $0.0042/h é preço do t4g.nano;
   t4g.micro on-demand = **$0.0084/h ≈ $6/mês** (verificado em fontes AWS
   externas). Corrigido em 6 lugares.
3. Dois testes pinavam o byte count stale (`artifacts.test.ts:75`,
   `ModelRegistry.test.tsx:41`) — expectations atualizadas para o valor
   medido (fato corrigido, não teste dobrado).

### Verificações executadas

- Quickstart local testado: `uvicorn app.main:app` → `/` serve index.html,
  `/health` ok, `/predict` ok, asset 200. Frontend `npm run dev` ok.
- Revisão A7 por explore agent independente: rubric R1–R7; 2 HIGH
  corrigidos, nice-to-haves aplicados.
- Re-run vitest pós-correção: 16/16 nos dois arquivos tocados; gate final
  178/178.

### Open items / warnings

- **Docker build NÃO testado** — docker CLI não existe nesta máquina. O
  Dockerfile foi revisado estaticamente (todos os COPY conferem contra a
  tree; stage-1 cobre os 7 imports de artifacts.ts), mas `docker build`
  precisa rodar numa máquina com Docker antes da submissão. Não há evidência
  de que a imagem constrói — claim limitado a isso.
- nit do reviewer rejeitado com evidência: `model/test_set.jsonl` FICA no
  stage runtime — `app/main.py:228` carrega test_records para
  `/api/v1/classifications` e `/api/v1/stats/categories`.
- Prazos/prêmios dos hackathons no DEVPOST são do enunciado do usuário —
  não verificáveis por artefato; confirmar antes de submeter.
- FASE 0 pendente: `audit/STATE_MAP_v5.md` bloqueado até repo público
  (sem remote configurado).

## Addendum — FASE 3 parcial: roteiro + ensaios do chaos drill (2026-07-23)

Spec pedia `HANDOFF_P3.md`; P3 já existe da v4 — registro aqui.

### Done

- `docs/DEMO_SCRIPT.md` — shot list de 3:00 para os dois hackathons, com
  regras de honestidade para gravação (número falado = número na tela ou
  artefato). Link adicionado ao README.
- **Correções de claims do spec antes de gravar (A4)**:
  1. "92% of alerts are noise" — sem fonte; removido do roteiro.
  2. "95% CIs no Model Registry" — **não existe** (verificado: nem
     `ModelRegistry.tsx` nem `eval_results.json` têm CI; o único CI do
     projeto é o Wilson derivado no README/PERFORMANCE). Roteiro não
     menciona CI no Registry. O CURRENT STATE da mission estava impreciso.
- **Ensaio do chaos drill 2× PASS** (evidência: `qa/proof/honesty-matrix.json`
  + 15 screenshots por run em `qa/proof/`): transições live→cached→offline
  nas 5 views + silêncio de 60 s do EventLog (0 entradas fabricadas, 0
  novas entradas) nos DOIS ensaios.

### Achado de ensaio (diagnóstico, não bug)

- O primeiro ensaio falhou em OFFLINE porque a UI **default aponta para a
  API de produção** (`useSettings.ts:4`: `DEFAULT_API_BASE =
  'http://3.23.60.61:8000'`) — matar o backend local não afeta a UI.
  Comportamento honesto correto (pill CACHED via `dataIsSnapshotOnly`,
  `Header.tsx:58`). Para ensaiar a mecânica sem tocar na produção:
  `VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev` (localStorage
  limpo no perfil headless → env vira default).
- O pill pode mostrar `CACHED · 142ms` com API live quando só há linhas de
  snapshot — é o design, não um bug. Narrar assim no vídeo se acontecer.

### MANUAL (bloqueado para o usuário — B4/outward-facing)

1. **Ensaio + gravação do drill na Graviton**: `systemctl stop ticketsec`
   no host de produção é ação outward-facing — não executada por mim.
   Me autorize explicitamente ou rode você mesmo antes de gravar.
2. **Gravação OBS** (1366×768, 2 takes) — ação de desktop, manual.
3. **Upload YouTube (unlisted)** — conta do usuário. Depois substituir o
   placeholder "TBD" em `README.md` e `docs/DEVPOST_SUBMISSION.md`.
4. Nota de produção: enquanto o drill roda na Graviton, o endpoint público
   do hackathon fica fora — coordenar janela curta.

### Housekeeping

- Órfãos de vite após TaskStop voltaram a segurar :5173 duas vezes;
  mortos por PID via PowerShell. Regra permanente: confirmar porta livre
  antes de gate runs/ensaios.
