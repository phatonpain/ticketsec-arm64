---
name: handoff-retro
description: Gera HANDOFF de fase e minera retrospectivas em regras novas para AGENTS.md
whenToUse: Ao fechar uma fase, escrever HANDOFF, ou rodar a retrospectiva P8
---

## HANDOFF_P<N>.md contém

- Fase concluída e gates G1–G8 com status.
- Decisões tomadas e porquês.
- UNKNOWNs abertos com owner e prazo proposto.
- Próxima fase e seu primeiro comando.
- Hash do commit de fechamento.

## RETRO_v<N>.md contém

1. **3 lições** que viram regra nova no `AGENTS.md`.
2. **Gates que falharam >1 vez** e por quê (file:line quando aplicável).
3. **Fases sem mudança mensurável** — recomendação de corte ou redesenho.
4. **Diff proposto** de `AGENTS.md` + `RUBRIC.md`.

## Verificação

- `audit/HANDOFF_P<N>.md` escrito e commitado.
- `audit/RETRO_v<N>.md` sincronizado com `audit/TEST_RESULTS_*`, `BLOCKER_*` e `transcripts/`.
- Toda lição convertida em regra tem linha correspondente no diff de `AGENTS.md`.
