---
name: demo-script
description: Roteiro de demo de 90 segundos para jurados, com o Honesty Contract como diferencial demonstrável
whenToUse: Quando preparar demo, pitch, README de submissão ou material para banca
---

## Estrutura dos 90 segundos

- **0–15s:** problema — triagem de tickets SOC é lenta e opaca.
- **15–45s:** TicketSec ao vivo — triagem em tempo real, severity rail, KPIs rastreáveis.
- **45–70s:** diferencial — chaos drill: derrube o backend propositalmente; a UI declara estar offline em vez de fingir dados.
- **70–90s:** prova — `bash scripts/gates.sh` verde, `MODEL_CARD.md` com protocolo, deploy arm64/Graviton.

## Regras

- Tudo que aparece na demo existe e é reproduzível; zero mock.
- Cada métrica falada precisa de uma linha `Cite:` apontando para artefato commitado.
- Nunca arredondar latência/accuracy de forma que oculte o valor do artefato.
- Nunca apresentar screenshot como "live" a não ser que tenha sido capturado contra o endpoint real.
- Ensaiar o chaos drill duas vezes antes de gravar/apresentar.

## Verificação

- Branch A (API saudável) e Branch B (API offline/cached) cobertas.
- Narração fallback para queda da API durante gravação.
- Checklist pré-demo inclui `curl /health`, `npm run build` e `bash scripts/gates.sh`.
- Duração entre 60 e 90 segundos.
