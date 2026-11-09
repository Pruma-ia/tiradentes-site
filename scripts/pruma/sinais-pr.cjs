#!/usr/bin/env node
// pruma sinais-pr — os fatos da triagem rodando sozinhos em todo PR, sem minuto novo de CI.
//
// Dois modos, uma marca:
//
//   publicar  (máquina do autor: `pre-push` e o hook do `gh pr create`)
//             roda `sinais.cjs --local --json`, deriva o nível de risco e deixa no PR da
//             branch UM comentário fixo (cria na 1ª vez, edita nas seguintes) mais o label
//             `risco: <nível>`. Sem PR aberto, não faz nada. Nunca bloqueia: sai 0 sempre,
//             dizendo o que fez.
//   conferir  (CI, dentro de job que já existe)
//             procura o comentário cuja marca traz o SHA da cabeça do PR. Achou e não aponta
//             migration com a master nem "não avaliou" → 0 (colisão com PR aberto é aviso). Não achou em `--espera` s → 1, com a
//             instrução. API fora → 2. Promoção (base `production`) → 0 sem cobrar.
//
// Por que assim (SPEC-2026-10-26-conferencias-sozinhas-no-pr): rodar o `sinais.cjs` no CI
// custaria ≈ 1 min por push; o job de declarações já paga 1 min e usa 12 s. A triagem roda
// onde o autor já está, e o CI só confere que ela rodou para ESTE commit. A marca pode ser
// forjada por quem tem escrita no repo — aceito, o mesmo teto do ledger local (Pedro, 26/10).
//
// Uso:
//   node scripts/pruma/sinais-pr.cjs publicar [--sha <sha que vai subir>] [--conferencias <json do sinais.cjs>]
//   node scripts/pruma/sinais-pr.cjs conferir --repo Pruma-ia/<repo> --pr <n> --head <sha> \
//     [--base-ref <base>] [--espera 40]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ORG = 'Pruma-ia';
const MARCA = 'pruma-sinais';
// prum[ao]-sinais: revisão publicada antes da troca de nome (08/11/2026) ainda é a desta conferência.
const MARCA_RE = /^<!-- prum[ao]-sinais head=([0-9a-f]{40,64}) nivel=(\S+) migration=(\S+) -->/;
const LABELS = {
  alto: { name: 'risco: alto', color: 'b60205', description: 'sinais.cjs: toca o que vale para todos os clientes' },
  médio: { name: 'risco: médio', color: 'fbca04', description: 'sinais.cjs: acendeu conferência de um cliente só ou sem impacto em todos' },
  baixo: { name: 'risco: baixo', color: '0e8a16', description: 'sinais.cjs: nenhuma conferência acesa' },
};
// Conferência acesa que vale para todos os clientes ou não tem volta: o nível vira `alto`. A que o
// `sinais.cjs` marca com `alcance` fica em `médio`: `cliente` (o que mudou só chega a um cliente —
// pasta, rota ou linha do núcleo sob o cliente) ou `equipe` (ferramental que não roda em produção).
// Mudou a lista ou a regra? Mude o critério 5 do SPEC-2026-10-27-triagem-risco-de-verdade junto.
const DE_ALTO = new Set(['nucleo', 'acesso', 'login', 'migration', 'sem-volta', 'crescimento', 'contrato', 'rotina',
  'escrita', 'servidor', 'base', 'vermelho']);
const TEMPO_SINAIS_MS = 90_000;
const TEMPO_GH_MS = 30_000;
const INSTRUCAO = 'rode `node scripts/pruma/sinais-pr.cjs publicar` na branch do PR (o `pre-push` faz isso sozinho) e re-rode o check';

const execPadrao = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });

function nivelDe(conferencias) {
  const acesas = conferencias.filter((c) => c.estado === 'acendeu');
  if (acesas.some((c) => DE_ALTO.has(c.id) && !c.alcance)) return 'alto';
  return acesas.length ? 'médio' : 'baixo';
}

// Colisão de migration com a MASTER reprova; com PR ainda ABERTO é aviso, porque o robô de
// migration renumera sozinho depois que o outro entra. Reprovar os dois deixava um PR verde por
// vez, e alguém renumerava à mão a cada merge (5 PRs na mesma 0223, 28/10/2026).
const NA_MASTER_RE = /na master/;

function estadoDaMigration(conferencias) {
  if (!conferencias) return 'nao-avaliou';
  const c = conferencias.find((x) => x.id === 'migration') || { estado: 'na' };
  if (c.estado !== 'acendeu') return c.estado;
  return NA_MASTER_RE.test(String(c.fato || '')) ? 'master' : 'aviso';
}

function corpoDoComentario({ sha, nivel, conferencias, erro }) {
  const mig = estadoDaMigration(conferencias);
  const marca = `<!-- ${MARCA} head=${sha} nivel=${nivel} migration=${mig} -->`;
  const pe = `<sub>Publicado sozinho pelo \`sinais-pr.cjs\` (pre-push ou \`gh pr create\`) para \`${sha.slice(0, 7)}\`. São fatos da máquina, não veredito: o veredito é da triagem \`pruma-pr-review\`.</sub>`;
  if (!conferencias) {
    return `${marca}\n### Triagem automática: não avaliou\n\nO \`sinais.cjs\` não conseguiu avaliar este commit: ${erro}\n\nO check do PR fica vermelho até a triagem rodar: ${INSTRUCAO}.\n\n${pe}`;
  }
  const icone = { acendeu: '⚠️', limpo: '✅', na: '➖' };
  const linhas = conferencias.map((c) => `| ${icone[c.estado] || '❔'} | ${c.nome} | ${String(c.fato || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
  const acesas = conferencias.filter((c) => c.estado === 'acendeu').length;
  return [marca, `### Triagem automática: risco ${nivel}`, '',
    `${acesas} de ${conferencias.length} conferências acenderam. ⚠️ acendeu: quem revisa olha · ✅ limpo · ➖ não se aplica.`, '',
    '| | Conferência | O que a máquina viu |', '|---|---|---|', ...linhas, '', pe].join('\n');
}

function lerMarca(corpo) {
  const m = String(corpo || '').match(MARCA_RE);
  return m ? { head: m[1], nivel: m[2], migration: m[3] } : null;
}

// ── publicar ────────────────────────────────────────────────────────────────

function repoDoOrigin(exec) {
  const url = exec('git', ['remote', 'get-url', 'origin']).trim();
  const m = url.match(/Pruma-ia\/([\w.-]+?)(?:\.git)?$/);
  return m ? m[1] : null;
}

function caminhoDoSinais(raiz) {
  // Plataforma: a skill. Satélite: a cópia que o `bootstrap.sh` deixa ao lado deste arquivo.
  for (const p of [path.join(raiz, '.claude/skills/pruma-pr-review/sinais.cjs'), path.join(__dirname, 'sinais.cjs')]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function rodarSinais(exec, sinais) {
  try {
    const saida = exec('node', [sinais, '--local', '--json'], { timeout: TEMPO_SINAIS_MS, stdio: ['ignore', 'pipe', 'pipe'] });
    const [r] = JSON.parse(saida);
    return { conferencias: r.conferencias };
  } catch (e) {
    const motivo = String(e.stderr || e.message || e).trim().split('\n')[0] || 'sem mensagem';
    return { erro: motivo };
  }
}

function aplicarLabel(gh, alvo, pr, nivel, atuais) {
  for (const l of Object.values(LABELS)) {
    gh(['label', 'create', l.name, '-R', alvo, '--color', l.color, '--description', l.description, '--force']);
  }
  const quero = nivel && LABELS[nivel] ? LABELS[nivel].name : null;
  for (const nome of atuais) {
    if (nome.startsWith('risco: ') && nome !== quero) gh(['api', '-X', 'DELETE', `repos/${alvo}/issues/${pr}/labels/${encodeURIComponent(nome)}`]);
  }
  if (quero && !atuais.includes(quero)) gh(['api', '-X', 'POST', `repos/${alvo}/issues/${pr}/labels`, '-f', `labels[]=${quero}`]);
}

function comentariosDe(gh, alvo, pr) {
  return JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${alvo}/issues/${pr}/comments?per_page=100`])).flat();
}

// `conferencias`: arquivo com a saída de `sinais.cjs --local --json` já calculada. O robô de
// migration roda a triagem antes do push e só publica depois — o check do PR espera 40 s.
function triagemPronta(arquivo) {
  try {
    const [r] = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    if (!Array.isArray(r && r.conferencias)) return { erro: `${arquivo} não traz conferências` };
    return { conferencias: r.conferencias };
  } catch (e) {
    return { erro: `a triagem pronta não abriu (${String(e.message).split('\n')[0]})` };
  }
}

function publicar({ exec = execPadrao, sha: shaPedido, conferencias: arquivo, log = console.log } = {}) {
  // Teto por chamada: no `pre-push`, GitHub pendurado seguraria o push (o `|| true` cobre falha,
  // não travamento). Achado da verificação, rodada 1.
  const gh = (args, opts = {}) => exec('gh', args, { timeout: TEMPO_GH_MS, ...opts });
  let raiz;
  let repo;
  let branch;
  let sha;
  try {
    raiz = exec('git', ['rev-parse', '--show-toplevel']).trim();
    repo = repoDoOrigin(exec);
    branch = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    sha = exec('git', ['rev-parse', 'HEAD']).trim();
  } catch (e) {
    log(`[pruma sinais] não publiquei: fora de um repositório git (${String(e.message).split('\n')[0]})`);
    return { feito: 'erro' };
  }
  if (!repo) {
    log('[pruma sinais] não publiquei: o origin não é um repositório da Pruma-ia');
    return { feito: 'fora-da-org' };
  }
  if (shaPedido && shaPedido !== sha) {
    log(`[pruma sinais] não publiquei: o push leva ${shaPedido.slice(0, 7)}, e a triagem lê o HEAD (${sha.slice(0, 7)}) — publique à mão depois: node scripts/pruma/sinais-pr.cjs publicar`);
    return { feito: 'outro-sha' };
  }
  const alvo = `${ORG}/${repo}`;
  try {
    const prs = JSON.parse(gh(['pr', 'list', '-R', alvo, '--head', branch, '--state', 'open', '--json', 'number,labels']));
    if (!prs.length) {
      log(`[pruma sinais] ${branch} ainda não tem PR aberto — nada a publicar (o hook do \`gh pr create\` publica na abertura)`);
      return { feito: 'sem-pr' };
    }
    const pr = prs[0].number;
    const sinais = arquivo ? null : caminhoDoSinais(raiz);
    const r = arquivo ? triagemPronta(arquivo) : sinais ? rodarSinais(exec, sinais) : { erro: 'sinais.cjs ausente neste checkout' };
    const nivel = r.conferencias ? nivelDe(r.conferencias) : 'nao-avaliou';
    const corpo = corpoDoComentario({ sha, nivel, conferencias: r.conferencias, erro: r.erro });
    const existente = comentariosDe(gh, alvo, pr).find((c) => lerMarca(c.body));
    const entrada = JSON.stringify({ body: corpo });
    if (existente) gh(['api', '-X', 'PATCH', `repos/${alvo}/issues/comments/${existente.id}`, '--input', '-'], { input: entrada });
    else gh(['api', '-X', 'POST', `repos/${alvo}/issues/${pr}/comments`, '--input', '-'], { input: entrada });
    aplicarLabel(gh, alvo, pr, r.conferencias ? nivel : null, (prs[0].labels || []).map((l) => l.name));
    log(r.conferencias
      ? `[pruma sinais] ${alvo}#${pr}: triagem de ${sha.slice(0, 7)} publicada — risco ${nivel}`
      : `[pruma sinais] ${alvo}#${pr}: a triagem NÃO avaliou (${r.erro}); o comentário diz isso e o check do PR vai ficar vermelho`);
    return { feito: r.conferencias ? 'publicado' : 'nao-avaliou', pr, nivel };
  } catch (e) {
    log(`[pruma sinais] não publiquei: ${String(e.stderr || e.message || e).trim().split('\n')[0]} — o check do PR vai ficar vermelho; ${INSTRUCAO}`);
    return { feito: 'erro' };
  }
}

// ── conferir ────────────────────────────────────────────────────────────────

function julgar(marca) {
  if (marca.nivel === 'nao-avaliou') return { rc: 1, msg: `a triagem deste commit não avaliou (veja o comentário "Triagem automática" no PR); ${INSTRUCAO}` };
  // `acendeu` é a marca de antes do aviso: vem do pre-push de branch atrasada e não separa master de
  // PR aberto. Na dúvida, reprova como colisão com a master.
  if (marca.migration === 'master' || marca.migration === 'acendeu') return { rc: 1, msg: 'migration com o número de uma que já está na master (conferência "Migration repetida" no comentário da triagem): mergeie a master na branch e rode `npm run db:renumerar` em apps/web' };
  if (marca.migration === 'aviso') {
    return { rc: 0, msg: `triagem do commit conferida — risco ${marca.nivel}; aviso: migration colide com outro PR aberto, e o robô renumera depois que o primeiro entrar` };
  }
  return { rc: 0, msg: `triagem do commit conferida — risco ${marca.nivel}` };
}

async function conferir({ repo, pr, head, baseRef, espera = 40, exec = execPadrao, dormir, log = console.log } = {}) {
  const pausa = dormir || ((ms) => new Promise((ok) => setTimeout(ok, ms)));
  if (!repo || !pr || !head) {
    log('[pruma sinais] conferir: faltam --repo, --pr ou --head');
    return 2;
  }
  if (baseRef === 'production') {
    log('[pruma sinais] promoção master → production: a triagem automática não se aplica');
    return 0;
  }
  const gh = (args) => exec('gh', args);
  const fim = Date.now() + espera * 1000;
  for (let volta = 0; ; volta += 1) {
    let comentarios;
    try {
      comentarios = comentariosDe(gh, repo, pr);
    } catch (e) {
      log(`[pruma sinais] NÃO avaliei: a API do GitHub falhou (${String(e.stderr || e.message || e).trim().split('\n')[0]}). Isto não é reprovação do PR — re-rode o check.`);
      return 2;
    }
    const marca = comentarios.map((c) => lerMarca(c.body)).find((m) => m && m.head === head);
    if (marca) {
      const { rc, msg } = julgar(marca);
      log(`[pruma sinais] ${msg}`);
      return rc;
    }
    if (Date.now() >= fim) break;
    await pausa(5000);
  }
  log(`[pruma sinais] o PR não tem a triagem automática do commit ${head.slice(0, 7)} (esperei ${espera} s): ${INSTRUCAO}.`);
  return 1;
}

function argumento(args, nome) {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const [modo, ...args] = process.argv.slice(2);
  if (modo === 'publicar') {
    publicar({ sha: argumento(args, '--sha'), conferencias: argumento(args, '--conferencias') });
    return 0;
  }
  if (modo === 'conferir') {
    return conferir({
      repo: argumento(args, '--repo'), pr: argumento(args, '--pr'), head: argumento(args, '--head'),
      baseRef: argumento(args, '--base-ref'), espera: Number(argumento(args, '--espera') || 40),
    });
  }
  console.error('uso: node sinais-pr.cjs publicar [--sha <sha>] [--conferencias <json pronto>] | conferir --repo <org/repo> --pr <n> --head <sha> [--base-ref <b>] [--espera <s>]');
  return 2;
}

if (require.main === module) main().then((rc) => process.exit(rc), (e) => { console.error(`[pruma sinais] falha: ${e.message}`); process.exit(2); });

module.exports = { nivelDe, corpoDoComentario, lerMarca, publicar, conferir, LABELS, DE_ALTO };
