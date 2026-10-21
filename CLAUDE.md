# tiradentes-site

Satélite do fleet Pruma. A **plataforma (`pruma-plataform`) é a raiz canônica** de
arquitetura, decisões (ADRs) e disciplina de dev — este arquivo aponta para lá em
vez de copiar. Planejamento do stream: hub `.planning/workstreams/` da plataforma
(ADR 0003). Telemetria: todo workflow reporta em `POST /api/n8n/flows` da plataforma.

## Prumo Gates (disciplina de dev — obrigatória)

Este repo usa os **gates portáveis do Prumo** — instalados por
`scripts/prumo/bootstrap.sh` da plataforma (`pruma-plataform`), que é a dona do kit:
**não editar os arquivos do kit aqui**; update = re-rodar o bootstrap de lá.

- `commit-check` — commit atômico: formato conventional + teto de 60 arquivos/3000
  linhas (válvula: linha `prumo:bulk <motivo>` na mensagem, fica no histórico).
- `sensitive-data-check` — segredo, dump tabular e PII não entram no git
  (fixture legítimo: `scripts/prumo/sensitive-allowlist`, versionada).
- Rodam no `pre-push` (ative uma vez por clone: `git config core.hooksPath
  scripts/git-hooks`) e no CI de todo PR (`.github/workflows/prumo.yml`).
- Bypass local: `PRUMO_SKIP=1` — **o motivo vai escrito no PR, sempre**. O CI não
  tem válvula.
- Fluxo de branch: `feat/*` → PR → branch default (aqui, a default É produção —
  nunca commit direto nela; o padrão master→production é só do monorepo).

**Referências na plataforma** (raiz canônica — apontar, nunca copiar):
[`docs/README.md`](https://github.com/Pruma-ia/pruma-plataform/blob/master/docs/README.md) ·
[`docs/PRUMO.md`](https://github.com/Pruma-ia/pruma-plataform/blob/master/docs/PRUMO.md) ·
[ADR 0006](https://github.com/Pruma-ia/pruma-plataform/blob/master/docs/adr/0006-prumo-gates-ciclo-de-vida-deterministico.md) ·
[`docs/ARCHITECTURE.md`](https://github.com/Pruma-ia/pruma-plataform/blob/master/docs/ARCHITECTURE.md)
