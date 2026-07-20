---
name: honesty-contract
description: Aplica o contrato de honestidade — todo número rastreia, todo estado é declarado, nada é fingido
whenToUse: Quando adicionar números/métricas à UI, estados de carregamento/erro, ou claims de modelo
---

## Contrato

1. Todo número na UI rastreia para artefato commitado ou fonte live/store (G7).
2. Estados honestos: loading real, erro declarado, offline admitido — nunca skeleton decorativo nem dado estático fingindo ser live.
3. Métricas de modelo exigem seed, split, `n` e intervalo de confiança (ver `MODEL_CARD.md`).
4. Incerteza se marca `UNKNOWN`; suposição não vira UI.
5. `useApi` fornece `status: 'live' | 'cached' | 'offline'` e deve dirigir toda superfície de dados.
6. Event Log registra apenas eventos reais da API; nenhuma entrada fabricada para "deixar o dashboard vivo".

## Verificação

```bash
npx vitest run tests/flows/offline-silence.test.tsx tests/flows/classify-offline.test.tsx
```

- Offline test passa: zero linhas fabricadas, zero entradas fake no log, spinner sem conclusão forçada.
- Cada claim em README/Devpost/demo aponta para artefato commitado.
- Drill manual: desabilite a API → observe `CACHED` → restaure → observe `LIVE`.
