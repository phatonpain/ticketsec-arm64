---
name: qa-gates
description: Executa e interpreta os gates machine-checkable G1–G8 (scripts/gates.sh) com protocolo de falha
whenToUse: Quando rodar gates, investigar gate vermelho, ou validar fechamento de fase
---

## Missão

Rodar `bash scripts/gates.sh` e tratar a saída como contrato.

## Regras

- Gate vermelho = informação: registre gate, saída literal e hipótese de causa-raiz com `file:line`.
- Máximo 3 tentativas por gate, cada uma com hipótese distinta; depois STOP + `audit/BLOCKER_<gate>.md`.
- Nunca rebaixar gate; correção de gate errado é commit separado e justificado.
- Fechamento só com G1–G8 PASS e `git status --porcelain` vazio.
- Espelho CI: divergência entre local e `.github/workflows/quality-gates.yml` é bug de infraestrutura.
- G4 axe exige Vite dev server em `localhost:5173`; inicie-o antes de rodar gates.

## Verificação

```bash
npm run dev -- --port 5173   # terminal separado
bash scripts/gates.sh
```

- `TEST_RESULTS_v4.md` contém o bloco da execução mais recente.
- Zero `it.fails` ou `.skip` no output do Vitest.
- Main JS chunk <600 KB.
