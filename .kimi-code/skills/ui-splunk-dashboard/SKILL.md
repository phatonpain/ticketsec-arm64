---
name: ui-splunk-dashboard
description: Constrói UI de dashboard SOC no estilo Splunk/Datadog/CrowdStrike — denso, profissional, com estados honestos
whenToUse: Quando criar ou revisar views, componentes de dashboard, KPIs, tabelas de triagem ou charts do TicketSec
---

## Missão

Implementar UI seguindo `DESIGN_BRIEF.md` e `src/styles/tokens.css` (leia ambos antes de codar).

## Regras

- CSS exclusivamente via `tokens.css` — zero hex literals em componentes; nenhum número mágico de spacing/typography.
- ECharts lazy-chunked; charts sempre com estados `loading`/`empty`/`error`/`offline` honestos.
- KPI stat blocks com fonte do número declarada em comentário ou proveniência (rastreabilidade G7).
- Tabelas de triagem com severity rail; densidade compacta de console SOC (40 px row, 16 px card padding, Inter + JetBrains Mono).
- Proibido: sombras grandes, badges pastel, empty states genéricos, skeleton decorativo.
- Estados de honestidade obrigatórios:
  - `live` → badge `LIVE` verde, dados da API.
  - `cached` → badge `CACHED` âmbar, dados de `public/cache/tickets-snapshot.json`.
  - `offline` → "Unavailable — API offline", sem entradas fabricadas.

## Verificação

```bash
npm run build        # G1: 0 erros, chunk <600 KB
npm run lint         # G2: 0 errors / 0 warnings
npx axe http://localhost:5173/#/<route>  # G4: 0 violações por rota
```

- Screenshot @1366px da mudança visível (WebBridge quando configurado).
- Auto-avaliação 1–10 nos 10 critérios do `DESIGN_BRIEF`; nota <9 exige correção.
