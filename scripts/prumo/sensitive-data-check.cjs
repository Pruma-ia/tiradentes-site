#!/usr/bin/env node
//
// prumo sensitive-data-check — dado real e segredo não entram no git.
//
// O incidente que motiva: 1.238 linhas de contas a receber reais (id de cliente,
// valores, vencimentos, operador) commitadas no satélite da Universal em CSVs de
// backup. Repo privado segurou o vazamento, mas "privado é configuração, não
// propriedade do dado" — e blob commitado nunca mais sai do histórico.
//
// Detalhe que define o desenho: aqueles CSVs NÃO têm CPF/CNPJ — são ids, dinheiro
// e datas. Detector de padrão de documento não os pega. O sinal confiável é a
// FORMA: arquivo tabular novo com muitas linhas de dado. Por isso o gate tem três
// detectores independentes:
//
//   1. segredo:   chave privada, token de provedor, atribuição suspeita de senha
//   2. dump:      arquivo .csv/.tsv/.jsonl/.xlsx/.sql/.parquet adicionado com
//                 ≥ DUMP_MIN_ROWS linhas de dado, ou qualquer tamanho sob path
//                 com backup/dump/export no nome
//   3. densidade: ≥ PII_MIN_HITS ocorrências de CPF/CNPJ/e-mail num arquivo novo
//
// Falso positivo tem saída: scripts/prumo/sensitive-allowlist — um glob por
// linha, versionado, então liberar um fixture fica no diff e no blame.
//
// Uso:
//   node scripts/prumo/sensitive-data-check.cjs [--base <ref>] [--json]
//
// Compara `<base>..HEAD` (diff de árvore, não precisa de merge-base — funciona em
// checkout shallow do CI). Sem --base tenta origin/master, depois master.
// Exit: 0 limpo, 1 achado, 2 falha de execução (nunca é reprovação).

"use strict"

const { execFileSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")

const DUMP_EXTENSIONS = new Set([".csv", ".tsv", ".jsonl", ".ndjson", ".xlsx", ".xls", ".parquet", ".sql", ".dump"])
// SQL é código tanto quanto dado: só vira suspeita sob path de backup/dump/export.
const SQL_LIKE = new Set([".sql", ".dump"])
const DUMP_MIN_ROWS = 50
const DUMP_PATH_HINT = /(^|\/)(backups?|dumps?|exports?)(\/|$)|_ANTES\b|_backup\b/i
const PII_MIN_HITS = 10

const SECRET_PATTERNS = [
  { re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/, what: "chave privada" },
  { re: /\bAKIA[0-9A-Z]{16}\b/, what: "AWS access key" },
  { re: /\bghp_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/, what: "GitHub token" },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, what: "Slack token" },
  { re: /\bsk-[A-Za-z0-9_-]{20,}\b/, what: "API key (sk-…)" },
  { re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/, what: "JWT" },
  {
    re: /\b(?:api[_-]?key|secret|senha|password|token)\b\s*[:=]\s*["'][A-Za-z0-9+/_-]{24,}["']/i,
    what: "atribuição de credencial",
  },
  { re: /postgres(?:ql)?:\/\/[^\s"'/]+:[^\s"'@]+@(?!localhost|127\.0\.0\.1|pruma_db|db:)/, what: "connection string com senha para host não-local" },
]

// Valores obviamente de exemplo não bloqueiam — placeholder em teste e runbook é
// rotina. `user:pass@host` e interpolação `${VAR}` entraram após falso positivo
// real no primeiro run de ponta a ponta (infra/stack/EVO.md, doc de config).
// `<[^>]+>` era largo demais: casava QUALQUER tag. Uma linha `<Provider
// apiKey="sk-live-…" />` num .tsx, ou `<code>ghp_…</code>` num runbook, era
// classificada como exemplo e o segredo real passava.
//
// A forma angular fica num teste SEPARADO, e case-SENSITIVE de propósito. A
// primeira correção só estreitou o padrão para `<[A-Z]…>` e deixou o `/i` do
// regex inteiro valendo — o que anula a distinção por caixa e mantém `<code>`,
// `<div>`, `<br>` desligando o detector naquela linha. Medido em 30/08: o
// conserto não consertava nada, e a regressão que escrevi não pegou porque o
// fixture (`<Provider apiKey="…" />`) tem `"` e `=` dentro dos colchetes.
const PLACEHOLDER_I =
  /placeholder|example|exemplo|dummy|changeme|xxxx|your[_-]?key|\bfake\b|\buser:pass\w*@|@host\b|\$\{[A-Za-z_]+\}/i
// `<TOKEN>`, `<SEU_TOKEN_AQUI>`, `<YOUR API KEY>` — maiúscula por convenção, que
// é justamente o que separa placeholder de marcação.
const PLACEHOLDER_ANGULAR = /<[A-Z][A-Z0-9_ -]{1,40}>/

function isPlaceholder(line) {
  return PLACEHOLDER_I.test(line) || PLACEHOLDER_ANGULAR.test(line)
}

const PII_PATTERNS = [
  { re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, what: "CPF" },
  { re: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, what: "CNPJ" },
  { re: /\b[A-Za-z0-9._%+-]+@(?!pruma\.io|example|exemplo|test)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, what: "e-mail" },
]

function parseArgs(argv) {
  const args = { base: null, json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--base") args.base = argv[++i]
    else if (a === "--json") args.json = true
    else if (a === "--help" || a === "-h") args.help = true
    else return { error: `argumento desconhecido: ${a}` }
  }
  return args
}

function git(...argv) {
  return execFileSync("git", argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
}

function resolveBase(explicit) {
  // master = monorepo da plataforma; main = satélites (lá main É produção).
  const candidates = explicit ? [explicit] : ["origin/master", "origin/main", "master", "main"]
  for (const ref of candidates) {
    try {
      // ^{tree} em vez de ^{commit}: aceita também a EMPTY TREE
      // (4b825dc642cb…), que o pre-push de repo novo passa como base para
      // varrer o repo inteiro no primeiro push.
      git("rev-parse", "--verify", `${ref}^{tree}`)
      return ref
    } catch {
      /* próxima */
    }
  }
  return null
}

/**
 * O RANGE de commits que este push publica.
 *
 * Merge-base quando existir: `base..HEAD` comparado como árvore traria também o
 * que a base ganhou depois do fork — arquivo de outra pessoa escaneado como se
 * fosse deste push. Sem merge-base (clone shallow do CI) cai para a ponta:
 * escanear demais é o lado seguro do erro.
 *
 * Base pode ser a ÁRVORE VAZIA (primeiro push de repo novo, sem origin): ali não
 * existe `..`, o range é toda a história de HEAD.
 */
function commitRange(base) {
  let from = base
  try {
    from = git("merge-base", base, "HEAD").trim() || base
  } catch {
    /* shallow: segue com a ponta */
  }
  try {
    git("rev-parse", "--verify", `${from}^{commit}`)
    return `${from}..HEAD`
  } catch {
    return "HEAD" // base é tree (árvore vazia): varre tudo
  }
}

/**
 * Arquivos tocados por QUALQUER commit do range — não o diff de pontas.
 *
 * `git diff base HEAD` mostra o efeito líquido, e é justamente onde o dado real
 * se esconde: o arquivo adicionado no commit A e apagado no commit B some do
 * diff, mas o blob de A já está no histórico e é o que o push publica. `git log
 * --name-only` sobre o range pega as duas formas.
 *
 * `-z` é obrigatório, não estilo: sem ele o git aplica core.quotepath e devolve
 * `"sd/relat\303\263rio.csv"` — com aspas e escape octal. O caminho não existe no
 * disco, o scanner pulava em silêncio, e QUALQUER arquivo com acento escapava do
 * gate inteiro (achado na bateria adversarial; em repo brasileiro, `títulos.csv`
 * e `coleção.csv` são o caso comum, não o exótico).
 */
function touchedFiles(range) {
  const out = git("log", "--format=", "--name-only", "--diff-filter=AM", "-z", range)
  return [...new Set(out.split("\0").filter(Boolean))]
}

// Teto de versões por arquivo: um arquivo reescrito em dezenas de commits não
// pode fazer o gate rastejar.
//
// Quais versões guardar, porém, NÃO é indiferente. A intuição ("as mais
// recentes importam") está errada para este gate: o formato do incidente é
// blob sujo commitado e sanitizado depois, então o perigoso está na ponta MAIS
// ANTIGA. Cortar as 20 primeiras de um `rev-list` (que vem newest-first)
// escondia justamente o blob original de um arquivo reescrito muitas vezes.
// Por isso o corte é pelas DUAS pontas.
const MAX_VERSIONS_PER_FILE = 20

/**
 * As VERSÕES (blobs) de um arquivo dentro do range — o que de fato vai para o
 * histórico. Ler o checkout era o furo: dev commita 1.238 linhas reais, percebe,
 * commita 3 linhas sanitizadas, e o scanner lia o disco limpo e liberava o push
 * com o blob real dentro. Blob commitado nunca mais sai do histórico, que é o
 * dano irreversível descrito no cabeçalho deste arquivo.
 *
 * Deduplica por SHA de blob: reescrita que volta ao conteúdo anterior é lida uma
 * vez só.
 */
function fileVersions(range, file) {
  let commits
  try {
    commits = git("rev-list", range, "--", file).split("\n").filter(Boolean)
  } catch {
    return []
  }
  // `rev-list` vem newest-first. Acima do teto, guarda as duas pontas: as mais
  // novas (o que o dev acabou de fazer) e as mais ANTIGAS (onde o blob sujo do
  // incidente mora). Ficar só com as recentes escondia a origem.
  if (commits.length > MAX_VERSIONS_PER_FILE) {
    const metade = Math.floor(MAX_VERSIONS_PER_FILE / 2)
    commits = [...commits.slice(0, metade), ...commits.slice(-(MAX_VERSIONS_PER_FILE - metade))]
  }

  const versions = []
  const seen = new Set()
  for (const commit of commits) {
    let blob
    try {
      blob = git("rev-parse", `${commit}:${file}`).trim()
    } catch {
      continue // não existe nesse commit (deletado ou renomeado)
    }
    if (!blob || seen.has(blob)) continue
    seen.add(blob)
    versions.push({ commit: commit.slice(0, 8), blob })
  }
  return versions
}

function readBlob(sha) {
  return execFileSync("git", ["cat-file", "blob", sha], { maxBuffer: 64 * 1024 * 1024 })
}

function loadAllowlist(repoRoot) {
  const p = path.join(repoRoot, "scripts", "prumo", "sensitive-allowlist")
  if (!fs.existsSync(p)) return []
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
}

function globToRe(glob) {
  // `**` atravessa diretórios, `*` para na barra. Construção caractere a caractere
  // para não depender de regex de escape (que já quebrou duas vezes nesta linha).
  // `?` precisa estar aqui: sem ele, uma entrada `data?.csv` vira regex com o
  // `a` opcional e libera caminhos que o autor da allowlist nunca pretendeu
  // isentar — allowlist frouxa é gate desligado sem ninguém saber.
  const special = new Set([".", "+", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\", "?"])
  let out = "^"
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === "*") {
      if (glob[i + 1] === "*") {
        out += ".*"
        i++
      } else {
        out += "[^/]*"
      }
    } else if (special.has(c)) {
      out += "\\" + c
    } else {
      out += c
    }
  }
  return new RegExp(out + "$")
}

function isAllowed(file, allowRes) {
  return allowRes.some((re) => re.test(file))
}

function checkSecrets(file, content) {
  const found = []
  for (const p of SECRET_PATTERNS) {
    // TODAS as ocorrências, não a primeira. `exec` devolvia um match só: se a
    // linha dele fosse placeholder, o `continue` pulava para o próximo PADRÃO e
    // as ocorrências seguintes nunca eram olhadas — o oposto do que o comentário
    // abaixo promete. Medido em 30/08:
    //   "AWS_EXAMPLE=AKIA…EXAMPLE\nAWS_PROD=AKIA1234567890ABCDEF" → []
    // Uma linha de exemplo no topo do arquivo desligava o detector inteiro para
    // aquele padrão. Padrão de exemplo em .env.example é rotina, então isso não
    // era hipótese exótica: era o arranjo comum.
    const rx = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g")
    for (const m of content.matchAll(rx)) {
      // A LINHA do match decide se é placeholder — não o arquivo inteiro, senão um
      // "example" qualquer no topo liberaria um segredo real lá embaixo.
      const lineStart = content.lastIndexOf("\n", m.index) + 1
      const lineEnd = content.indexOf("\n", m.index)
      const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
      if (isPlaceholder(line)) continue
      found.push({
        check: "segredo",
        file,
        message: `${p.what} detectada — segredo não entra no git (use .env.local / secret do CI)`,
      })
      break // um achado por padrão basta para bloquear; não inunda a saída
    }
  }
  return found
}

function checkDump(file, content) {
  const ext = path.extname(file).toLowerCase()
  if (!DUMP_EXTENSIONS.has(ext)) return []
  const rows = content.split("\n").filter((l) => l.trim()).length
  const hinted = DUMP_PATH_HINT.test(file)
  // `.sql` só conta como dump sob path de backup/dump/export: migration é SQL
  // longo e legítimo por natureza — 7 das migrations deste repo já passam do
  // teto, e sem esta guarda o próximo PR com migration normal seria bloqueado
  // com uma mensagem mandando tirar dado de produção do git.
  if (SQL_LIKE.has(ext) && !hinted) return []
  if (rows >= DUMP_MIN_ROWS || hinted) {
    return [
      {
        check: "dump",
        file,
        message:
          `arquivo tabular com ${rows} linha(s)${hinted ? " sob path de backup/dump/export" : ""} — ` +
          `parece dado real (o incidente da Universal eram CSVs assim, sem nenhum CPF para um regex achar). ` +
          `Dado real vive fora do git; fixture legítimo entra em scripts/prumo/sensitive-allowlist (versionado, fica no diff)`,
      },
    ]
  }
  return []
}

function checkPiiDensity(file, content) {
  const found = []
  for (const p of PII_PATTERNS) {
    const hits = content.match(p.re)
    if (hits && hits.length >= PII_MIN_HITS) {
      found.push({
        check: "pii",
        file,
        message: `${hits.length} ocorrências de ${p.what} — densidade de dado pessoal alta para arquivo versionado`,
      })
    }
  }
  return found
}

function run(args) {
  let repoRoot
  try {
    repoRoot = git("rev-parse", "--show-toplevel").trim()
  } catch (err) {
    return { status: 2, reason: `fora de um repo git: ${err.message}`, findings: [] }
  }

  const base = resolveBase(args.base)
  if (!base) {
    return { status: 2, reason: `base inalcançável (${args.base ?? "origin/master, master"})`, findings: [] }
  }

  let range, files
  try {
    range = commitRange(base)
    files = touchedFiles(range)
  } catch (err) {
    return { status: 2, reason: `git log falhou: ${err.message}`, findings: [] }
  }

  const allowRes = loadAllowlist(repoRoot).map(globToRe)
  const findings = []
  const skipped = []
  let versionsScanned = 0

  for (const file of files) {
    if (isAllowed(file, allowRes)) {
      skipped.push(file)
      continue
    }

    for (const { commit, blob } of fileVersions(range, file)) {
      let buf
      try {
        buf = readBlob(blob)
      } catch {
        continue
      }
      versionsScanned++

      // Binário: só o detector de dump interessa (xlsx/parquet são binários).
      const isBinary = buf.includes(0)
      if (isBinary) {
        const ext = path.extname(file).toLowerCase()
        if (DUMP_EXTENSIONS.has(ext)) {
          findings.push({
            check: "dump",
            file,
            commit,
            message: `arquivo de dados binário (${ext}, ${(buf.length / 1024).toFixed(0)} KB) adicionado — mesmo tratamento do CSV: fora do git ou na allowlist`,
          })
        }
        continue
      }

      const content = buf.toString("utf8")
      const hits = [
        ...checkSecrets(file, content),
        ...checkDump(file, content),
        ...checkPiiDensity(file, content),
      ]
      findings.push(...hits.map((h) => ({ ...h, commit })))
    }
  }

  return {
    status: findings.length ? 1 : 0,
    base,
    range,
    scanned: files.length,
    versionsScanned,
    allowlisted: skipped,
    findings,
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.error) {
    console.error(`[prumo] ${args.error}`)
    process.exit(2)
  }
  if (args.help) {
    console.log("uso: node scripts/prumo/sensitive-data-check.cjs [--base <ref>] [--json]")
    process.exit(0)
  }

  const result = run(args)

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.status)
  }

  if (result.status === 2) {
    console.error(`[prumo] sensitive-data-check não conseguiu avaliar: ${result.reason}`)
    console.error("[prumo] NÃO é reprovação — investigue a causa acima.")
    process.exit(2)
  }

  if (result.findings.length === 0) {
    console.log(
      `[prumo] sensitive-data-check OK — ${result.scanned} arquivo(s), ` +
        `${result.versionsScanned} versão(ões) em ${result.range}.`,
    )
    process.exit(0)
  }

  console.error("")
  console.error(`[prumo] BLOQUEADO: ${result.findings.length} achado(s) de dado sensível.`)
  console.error("")
  for (const f of result.findings) {
    // O commit é parte do achado, não enfeite: a versão suja pode não estar mais
    // no disco, e sem o SHA o dev olha o arquivo limpo e não entende o bloqueio.
    console.error(`  ✗ [${f.check}] ${f.file}${f.commit ? ` @ ${f.commit}` : ""}`)
    console.error(`    ${f.message}`)
    console.error("")
  }
  console.error(
    "[prumo] O conteúdo pode já ter saído do disco: o gate lê os BLOBS que o push publica.",
  )
  console.error(
    "[prumo] Para tirar do histórico da branch: git rebase -i, ou refaça os commits sem o arquivo.",
  )
  process.exit(1)
}

if (require.main === module) main()

module.exports = { run, checkSecrets, checkDump, checkPiiDensity }
