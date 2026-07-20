---
name: security-review
description: Revisão adversarial de segurança — OWASP Web Top 10 + OWASP-LLM 2025, com foco no /predict
whenToUse: Quando revisar diffs, endpoints FastAPI, componentes com input do usuário, ou preparar release
arguments:
  - escopo
---

## Missão

Revisar `$escopo` (ou o diff da fase ativa, se vazio) como red team. Você não escreveu o código — não seja gentil.

## Checklist

1. `/predict`:
   - payload cap + rate limit (P0);
   - validação de schema e sanitização (`sanitize_text`) via Pydantic;
   - timeouts e safe error shapes (nenhum stack trace em 5xx).
2. XSS:
   - zero `dangerouslySetInnerHTML` em `src/`;
   - sanitização de dados de ticket antes de renderização.
3. SSRF/injeção no backend FastAPI; CORS e headers de segurança.
4. Segredos:
   - nenhum API key, password, PEM ou token em código, config ou histórico;
   - rode o scan local equivalente ao G6:
     ```bash
     grep -rP \
       --include='*.ts' --include='*.tsx' --include='*.css' --include='*.html' \
       --include='*.json' --include='*.py' --include='*.sh' --include='*.yml' --include='*.md' \
       --exclude='seeds*.py' --exclude='tickets_dataset*.jsonl' --exclude='expand.py' \
       --exclude='test_set.jsonl' --exclude='probe_suite.json' --exclude='probe_results.json' --exclude='eval.py' \
       --exclude='tokens.css' --exclude='chartTokens.ts' --exclude='query_imds.sh' \
       '(api[_-]?key|secret|password|BEGIN.*PRIVATE KEY|\btoken(?!s|izer))' \
       src/ public/ model/ ops/ app/ data/ \
       | grep -vE 'PLACEHOLDER|EXAMPLE' \
       | grep -vE '^\s*(\*|//|/\*|#|<!--)' \
       | grep -q . && echo FAIL || echo OK
     ```
   - confirme ausência de `ticketsec-key.pem`:
     ```bash
     find . -name 'ticketsec-key.pem' -not -path './node_modules/*' | grep -q . && echo FAIL || echo OK
     ```
5. LLM:
   - prompt injection via conteúdo de tickets;
   - saída do modelo tratada como não-confiável (argmax/validação de schema).
6. DevOps:
   - Security Group, systemd, `MemoryMax`, `Restart=always`.

## Saída

Tabela: `ID → severidade P0–P3 → evidência file:line → exploração conceitual → correção proposta`.

Gate G6: zero P0/P1 aberto. Atualize `SECURITY_REVIEW.md` com novos achados e status.
