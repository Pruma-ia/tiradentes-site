#!/usr/bin/env node
//
// prumo commit-check — proxies mecânicos de commit atômico.
//
// Atomicidade plena é julgamento humano; o que máquina prova são dois proxies,
// e os dois têm incidente de origem:
//
//   1. FORMATO — conventional commit (feat|fix|refactor|docs|test|chore|perf|
//      ci|style|build|revert, com escopo opcional) ou merge. Mensagem sem tipo
//      é sintoma de commit sem recorte.
//   2. TAMANHO — commit não-merge com > MAX_LINES linhas mudadas ou > MAX_FILES
//      arquivos é grande demais para revisar como unidade (o PR #217 era UM
//      commit de 9k linhas — o review inteiro virou arqueologia). Válvula
//      auditável NA MENSAGEM do commit: a linha `prumo:bulk <motivo>` libera e
//      fica no histórico para sempre.
//
// Uso:
//   node scripts/prumo/commit-check.cjs --range <a..b> [--json]
//
// Exit: 0 limpo, 1 achado, 2 falha de execução (nunca é reprovação).

"use strict"

const { execFileSync } = require("node:child_process")

const MAX_LINES = 3000
const MAX_FILES = 60

// Arquivos GERADOS por ferramenta, descontados do tamanho. Não é indulgência: o teto existe
// para proteger o que se revisa como unidade, e ninguém revisa retrato de schema linha a linha.
// O snapshot do drizzle tem ~12 mil linhas por migration — medido na 0080 e de novo na 0081 —,
// então sem isto TODO commit de migration estoura o teto e a válvula `prumo:bulk` vira carimbo
// automático, que é como gate morre.
//
// O lockfile fica DE FORA desta lista de propósito: mudar dependência merece a fricção de
// escrever o motivo, e é a mesma linha que o Snyk depois cobra.
const GERADOS = [/(^|\/)db\/migrations\/meta\/[^/]+\.json$/]

const ehGerado = (caminho) => GERADOS.some((re) => re.test(caminho))
const TYPE_RE = /^(feat|fix|refactor|docs|test|chore|perf|ci|style|build|revert)(\([^)]+\))?!?: .+/
const MERGE_RE = /^(Merge |merge[:( ])/i
/**
 * A válvula de tamanho, estreitada em 07/09/2026 — ela abria por ACIDENTE.
 *
 * Era `/prumo:bulk\s+\S+/`, solta em qualquer posição do corpo. Duas formas de
 * ligar sem querer, e a primeira foi medida na prática (no gate irmão
 * `test-integrity`, que copiava esta forma):
 *
 *   - MENCIONAR a válvula liberava a válvula. O commit que documenta a sintaxe
 *     traz `prumo:bulk <motivo>` no corpo para explicar como usar, e o
 *     placeholder entre `<>` satisfazia o `\S+`. Escrever sobre a regra
 *     desligava a regra — para o range inteiro, porque o corpo é lido por
 *     commit mas o teto vale para o push;
 *   - citação no meio de frase contava igual. "não use prumo:bulk aqui" liberava.
 *
 * Agora exige LINHA PRÓPRIA (que é como a doc sempre a descreveu — "a linha
 * `prumo:bulk <motivo>`") e recusa motivo que comece com `<`, que não é motivo,
 * é a documentação da sintaxe. Gate cuja válvula abre sozinha é pior que gate
 * ausente: ele fica verde e parece ter avaliado.
 */
const BULK_RE = /^[ \t]*prumo:bulk[ \t]+(?!<)\S/m

function git(...argv) {
  return execFileSync("git", argv, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })
}

function main() {
  const argv = process.argv.slice(2)
  const rIdx = argv.indexOf("--range")
  const range = rIdx !== -1 ? argv[rIdx + 1] : null
  const json = argv.includes("--json")
  if (!range) {
    console.error("[prumo] uso: commit-check.cjs --range <a..b>")
    process.exit(2)
  }

  // As DUAS chamadas ficam no mesmo try: a segunda estava fora, e uma exceção
  // ali derrubava o processo com exit 1 — que todo chamador lê como "achado
  // real" e reporta como violação de formato que nunca existiu.
  let shas, allShas
  try {
    shas = git("rev-list", "--no-merges", range).split("\n").filter(Boolean)
    // Merges entram só para o check de formato (MERGE_RE cobre).
    allShas = git("rev-list", range).split("\n").filter(Boolean)
  } catch (err) {
    console.error(`[prumo] commit-check não conseguiu avaliar (${err.message.split("\n")[0]}) — NÃO é reprovação.`)
    process.exit(2)
  }

  const findings = []

  // O LAÇO INTEIRO no try, pelo mesmo motivo dos rev-list acima: no CI o fetch é
  // `--depth=200`, e um commit do range além da fronteira rasa faz `git log -1`
  // estourar. Fora do try isso viraria exit 1 — que o step lê como "commit-check
  // reprovou" e reporta uma violação de formato que nunca existiu.
  try {
    for (const sha of allShas) {
      const subject = git("log", "-1", "--format=%s", sha).trim()
      const body = git("log", "-1", "--format=%B", sha)

      if (!TYPE_RE.test(subject) && !MERGE_RE.test(subject)) {
        findings.push({
          check: "formato",
          sha: sha.slice(0, 8),
          message: `"${subject.slice(0, 72)}" — sem tipo conventional (feat|fix|docs|test|chore|refactor|perf|ci|...). Mensagem sem recorte costuma ser commit sem recorte.`,
        })
      }

      if (!shas.includes(sha)) continue // merge: tamanho não conta

      // `--numstat` e não `--shortstat`: preciso do caminho de cada arquivo para descontar os
      // gerados. Binário vem como `-\t-\tcaminho`; conta como arquivo, com zero linha.
      const numstat = git("show", "--numstat", "--format=", sha).trim()
      let files = 0
      let lines = 0
      let filesGerados = 0
      let linhasGeradas = 0
      for (const linha of numstat.split("\n").filter(Boolean)) {
        const [a, d, ...resto] = linha.split("\t")
        const caminho = resto.join("\t")
        if (!caminho) continue
        const n = (Number(a) || 0) + (Number(d) || 0)
        if (ehGerado(caminho)) {
          filesGerados += 1
          linhasGeradas += n
          continue
        }
        files += 1
        lines += n
      }

      if ((lines > MAX_LINES || files > MAX_FILES) && !BULK_RE.test(body)) {
        findings.push({
          check: "tamanho",
          sha: sha.slice(0, 8),
          message:
            `${files} arquivo(s), ${lines} linha(s) mudada(s)` +
            (filesGerados
              ? ` (já descontados ${filesGerados} arquivo(s) gerado(s), ${linhasGeradas} linha(s))`
              : "") +
            ` — acima de ${MAX_FILES} arquivos ou ${MAX_LINES} linhas ` +
            `não se revisa como unidade (o PR #217 era UM commit de 9k linhas). Divida em commits atômicos, ou — para ` +
            `lockfile/geração/vendoring legítimos — libere com a linha "prumo:bulk <motivo>" na mensagem do commit.`,
        })
      }
    }
  } catch (err) {
    console.error(
      `[prumo] commit-check não conseguiu ler um commit do range (${err.message.split("\n")[0]}) — ` +
        `clone raso? NÃO é reprovação.`,
    )
    process.exit(2)
  }

  if (json) {
    console.log(JSON.stringify({ range, commits: allShas.length, findings }, null, 2))
    process.exit(findings.length ? 1 : 0)
  }

  if (findings.length === 0) {
    console.log(`[prumo] commit-check OK — ${allShas.length} commit(s) em ${range}.`)
    process.exit(0)
  }

  console.error("")
  console.error(`[prumo] BLOQUEADO: ${findings.length} problema(s) de commit em ${range}.`)
  console.error("")
  for (const f of findings) {
    console.error(`  ✗ [${f.check}] ${f.sha}`)
    console.error(`    ${f.message}`)
    console.error("")
  }
  process.exit(1)
}

main()
