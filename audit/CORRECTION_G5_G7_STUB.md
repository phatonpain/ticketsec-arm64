# Correção G5/G7 — stubs não podem ser reportados como PASS

## Contexto

Durante o fechamento da Phase 8 v4, `scripts/honesty_check.sh` e `scripts/trace_check.sh` foram
commitados como stubs que sempre retornavam `0`. O gate `scripts/gates.sh` original nem os chamava,
mas o `HANDOFF_v4.md` e os commits de evidência registravam o fechamento como "11/11 PASS" — o que
mascarava G5 (honestidade) e G7 (rastreabilidade) como verdes sem nenhuma verificação real.

Isso viola o Artigo 10 da constituição (sem vitórias vazias) e a regra G0 do MASTER MISSION v2
(gate de integridade dos gates).

## Correção aplicada

1. `scripts/gates.sh` agora chama explicitamente `scripts/honesty_check.sh` (G5) e
   `scripts/trace_check.sh` (G7).
2. `scripts/gates.sh` detecta o marcador `# TODO: implement` no corpo dos scripts de gate e
   imprime `[STUB] Gx ... (não verificado)` em vez de `[PASS]`.
3. Enquanto os scripts forem stubs, o gate sai com `RED=1`, impedindo que G5/G7 sejam contados
   como PASS.
4. `HANDOFF_v4.md` foi atualizado para listar G5/G7 como **não avaliados** até que as asserções
   reais sejam escritas.
5. `audit/CORRECTION_G5_G7_STUB.md` documenta o incidente sem reescrever histórico git.

## Próximos passos

- Preencher `scripts/honesty_check.sh` com asserções reais antes do início de P2:
  - varrer `src/` por valores hardcoded em JSX;
  - detectar skeletons decorativos sem estado de loading real;
  - verificar que toda superfície de dados usa `useApi` status.
- Preencher `scripts/trace_check.sh` com asserções reais antes do início de P2:
  - enumerar números renderizados;
  - mapear cada número para store live ou artefato commitado;
  - sinalizar números órfãos.
- Após implementação, remover os marcadores `# TODO: implement`.

## Estado atual dos gates

- G1, G2, G3, G4, G6: verificáveis e PASS na última execução de 2026-07-20.
- G5, G7: STUB (não verificado).
- G8: tree clean, exceto arquivos de evidência de gates (`TEST_RESULTS_*.md`, `audit/evidence/*`).
