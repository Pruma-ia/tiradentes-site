#!/usr/bin/env node
// Fatos estruturais dos PRs abertos da org Pruma-ia, observados no diff — sem julgamento.
// O julgamento (cor, impacto, texto leigo) é da skill; este script só diz o que ESTÁ lá.
//
// Uso:
//   node sinais.cjs --abertos                 todos os PRs abertos da org
//   node sinais.cjs 666 pruma-trakx#29        PRs específicos (número sozinho = plataforma)
//   node sinais.cjs --local                   a SUA branch, antes de abrir o PR (o que o
//                                             `gate-pr` e o `run.cjs` mostram ao dev)
// As rotas em produção vêm da API do GitHub (árvore de `production`/`master`), então roda
// de qualquer repo da org sem `git fetch`. Exit: 0 com relatório; 2 quando não avaliou.
'use strict';
const { execFileSync } = require('node:child_process');

const ORG = 'Pruma-ia';
const PLATAFORMA = 'pruma-plataform';
const { linhasMudadas, especificadores, classificar } = require('./impacto.cjs');

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const gh = (args) => sh('gh', args);

// Apelidos de cliente que NÃO são pasta de tela (grafia antiga, satélite, marca). Os clientes em si
// saem das pastas de `(dashboard)/` (clientes(), abaixo): cliente novo entra sozinho — esta lista à
// mão não tinha a Medluz, e a triagem a tratava como núcleo (08/10/2026).
const APELIDOS = ['animatrix', 'engemoura', 'mak', 'meyer', 'minaslocc', 'minasloc', 'pbox',
  'prime', 'raktas', 'tiradentes', 'universal', 'kmarket', 'kmart', 'iris', 'eloca'];

// Pastas de `(dashboard)/` que são produto de todos, não cliente.
const TELAS_TRANSVERSAIS = new Set(['approvals', 'billing', 'conteudos', 'dashboard', 'flows', 'integracoes',
  'marketplaces', 'settings']);
// Grafia antiga → nome da pasta de tela (regra "Onde mora o código de cada cliente", apps/web/CLAUDE.md).
const CANONICO = { medluzline: 'medluz', minasloc: 'minaslocc' };

let telasCache;
/** Os nomes canônicos de cliente: as pastas de tela de `(dashboard)/` na master, menos as transversais. */
function pastasDeTela() {
  if (!telasCache) {
    try {
      telasCache = [...new Set(arvoreDe('master')
        .map((p) => (p.match(/^apps\/web\/src\/app\/\(dashboard\)\/([^/]+)\//) || [])[1])
        .filter(Boolean))].filter((n) => !TELAS_TRANSVERSAIS.has(n));
    } catch {
      telasCache = []; // sem a árvore, vale só a lista de apelidos — o sinal de pasta diz que não avaliou
    }
  }
  return [...new Set([...telasCache, ...telasDoPr])];
}

// Pasta de tela que a master ainda não tem: o cliente que ESTREIA no PR analisado. Sem isto, o PR
// de estreia — justamente o que cria a pasta — tinha o código do cliente lido como "compartilhado
// da plataforma" e não sabia de que cliente era (simulação de cliente novo, 09/10/2026).
// Vale SÓ para o PR que cria a pasta: `sinaisDoPr` troca a lista a cada PR. Global, a pasta nova de
// um PR escondia do "compartilhado" o `lib/<nome>.ts` de outro PR da mesma rodada, sem aviso nenhum
// (achado da revisão). A linha "cliente novo" deixa o palpite à vista: pasta nova que for tela de
// todos entra em TELAS_TRANSVERSAIS.
let telasDoPr = [];
function telasNovasDe(caminhos, telasDaMaster) {
  const novas = new Set();
  for (const p of caminhos) {
    const n = (p.match(/^apps\/web\/src\/app\/\(dashboard\)\/([^/]+)\//) || [])[1];
    if (n && !TELAS_TRANSVERSAIS.has(n) && !telasDaMaster.includes(n)) novas.add(n);
  }
  return [...novas];
}
/** Escopo do PR analisado: as pastas de tela que só ele cria. Devolve a lista, para o relatório. */
function definirTelasDoPr(caminhos) {
  telasDoPr = [];
  pastasDeTela(); // carrega a da master antes de comparar
  telasDoPr = telasCache.length ? telasNovasDe(caminhos, telasCache) : []; // sem a master, nada é "novo"
  return telasDoPr;
}

/** Nomes que identificam cliente num caminho (sem hífen, como o resto do script compara). */
function clientes() {
  return [...new Set([...APELIDOS, ...pastasDeTela().map((n) => n.replace(/-/g, '')), ...Object.keys(CANONICO)])];
}

// Arquivo gerado: não se revisa e não conta tamanho.
const GERADO = /(migrations\/meta\/|package-lock\.json$|poetry\.lock$|uv\.lock$|\.snap$|tests\/e2e\/screenshots\/)/;
const DIFF_SEM_GERADO = ['--exclude', '**/migrations/meta/*', '--exclude', '**/package-lock.json'];

// Arquivo de teste não roda em produção: nenhuma zona abaixo (permissão, rotina agendada,
// ingestão, menu…) se aplica a ele. O #726 (08/10/2026) saiu com "entrada de dado em lote" só
// porque `tests/integration/coleta-snapshot.test.ts` tem "coleta" no nome.
// Exceção: a zona `esteira`. Teste do PRÓPRIO harness (`sinais.test.cjs`, casos de eval) é regra
// do Pruma Gates — PR que só enfraquece esse teste tem de continuar aparecendo.
const ARQUIVO_DE_TESTE = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$/;

const ZONAS = [
  { id: 'perfil-acesso', rotulo: 'perfil, papel ou permissão de usuário',
    re: /(member_role|papeis-por-org|src\/lib\/plataforma\/auth|api\/auth\/|api\/organizations\/|api\/invite|api\/users?\/|settings\/members|impersonat|org-context|proxy\.ts$)/ },
  // Cadastro e login: o #826 (14/10/2026) abria tomada de conta pelo "Crie seu agente" — cadastro
  // com o e-mail da vítima e o 1º "Entrar com Google" assumia a conta. Achado em auditoria, não na triagem.
  { id: 'login', rotulo: 'cadastro, login ou confirmação de e-mail',
    // Só código: `.md`, `.planning/` e `docs/` com "cadastro" no nome acendiam à toa (#891, eloca#83).
    re: /^(?!\.planning\/|docs\/|.*\.md$).*(src\/auth(\.config)?\.ts$|src\/lib\/plataforma\/auth|api\/auth\/|\(auth\)\/|\/comecar\/|signup|criar-conta|verify-request|\botp\b|magic-?link)/i },
  { id: 'agendado', rotulo: 'tarefa agendada / roda sozinha no servidor', codigo: true,
    re: /(infra\/host\/|crontab|api\/maintenance\/|\.github\/workflows\/|scheduler|cron)/i },
  { id: 'ingestao', rotulo: 'entrada de dado em lote (n8n, satélite, API externa)',
    re: /(api\/n8n\/|api\/webhooks\/|-api\.(ts|py)$|_api\.py$|ingestao|ml-leitura|sincroniz|coleta)/ },
  { id: 'infra', rotulo: 'servidor, deploy ou pipeline', codigo: true,
    re: /(^infra\/|Dockerfile|docker-compose|docker-entrypoint|^\.github\/|next\.config|drizzle\.config)/ },
  { id: 'dependencia', rotulo: 'biblioteca nova ou trocada', re: /(package\.json|pyproject\.toml|requirements.*\.txt)$/ },
  { id: 'esteira', rotulo: 'regras do próprio Pruma Gates / da IA', codigo: true,
    re: /(^scripts\/prum[ao]\/|^scripts\/git-hooks\/|^\.claude\/|^REVIEW\.md$|^evals\/|(^|\/)CLAUDE\.md$)/ },
  { id: 'casca', rotulo: 'menu, layout ou componente usado por todos',
    re: /(components\/ui\/|components\/dashboard\/|\(dashboard\)\/layout\.tsx|sidebar)/ },
  { id: 'nucleo-satelite', rotulo: 'código comum do satélite (vale para todos os clientes dele)',
    re: /^src\/[^/]+\/(?!tenants\/)(core|api|comum|common|shared|config)/ },
];

// Zona `codigo`: documento não roda no servidor nem muda o Pruma Gates. `infra/stack/ELOCA-WORKER.md`
// (#1076) e `.claude/rules/clientes/prime.md` (#1074) acendiam `servidor` e o PR saía `risco: alto`
// (SPEC-2026-10-27-triagem-risco-de-verdade). Mesmo recorte da zona `login`.
const DOCUMENTO = /^(\.planning\/|docs\/)|\.md$/;

/** As zonas de um arquivo. Teste fica fora, salvo na `esteira` (ver ARQUIVO_DE_TESTE). */
function zonasDoArquivo(p) {
  return ZONAS.filter((z) => z.re.test(p) && (z.id === 'esteira' || !ARQUIVO_DE_TESTE.test(p)) && !(z.codigo && DOCUMENTO.test(p)));
}

// Núcleo protegido: lista editável pelo dono em references/nucleo-protegido.txt.
const NUCLEO = (() => {
  try {
    return require('node:fs').readFileSync(require('node:path').join(__dirname, 'references', 'nucleo-protegido.txt'), 'utf8')
      .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => new RegExp(l));
  } catch {
    return null; // arquivo ausente: o sinal diz que não avaliou, não que está limpo
  }
})();

// De que cliente é o PR: escopo do título (`feat(prime): …`), senão a pasta de cliente mais tocada.
function clienteDoPr(pr) {
  const escopo = (pr.title.match(/^\w+\(([^)]+)\)/) || [])[1];
  if (escopo && clientes().includes(escopo.toLowerCase().replace(/-/g, ''))) return escopo.toLowerCase();
  const contagem = {};
  for (const f of pr.files) {
    const p = f.path.toLowerCase();
    for (const c of clientes()) if (new RegExp(`(^|[/_.(-])${c}([/_.)-]|$)`).test(p)) contagem[c] = (contagem[c] || 0) + 1;
  }
  const [top] = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  return top ? top[0] : null;
}

// PR de UM cliente que toca o núcleo, e os ramos por cliente que ele escreveu lá dentro.
function nucleoTocado(pr) {
  if (pr.repo !== PLATAFORMA) return { cliente: null, arquivos: [], ramos: [] };
  if (!NUCLEO) return { cliente: null, arquivos: [], ramos: [], semLista: true };
  const cliente = clienteDoPr(pr);
  const arquivos = pr.files.map((f) => f.path)
    .filter((p) => NUCLEO.some((re) => re.test(p)) && !/\.(test|spec)\.tsx?$/.test(p));
  if (!cliente || !arquivos.length) return { cliente, arquivos: [], registro: [], ramos: [] };
  const diff = diffDe(pr);
  const nomes = clientes().join('|');
  const ramoRe = new RegExp(`(slug|Slug|org\\w*)\\s*[!=]==?\\s*["'\`](${nomes})["'\`]|["'\`](${nomes})["'\`]\\s*[!=]==?|SLUG_(${nomes.toUpperCase()})`);
  const ramos = [];
  for (const a of arquivos) {
    for (const l of diff[a] || []) if (ramoRe.test(l) && !/^\s*(\/\/|\*)/.test(l)) ramos.push(`${a}: ${l.trim().slice(0, 110)}`);
  }
  // Registro de tela do cliente (o ponto de extensão que todo cliente usa: menu, lista de telas,
  // rótulos) é diferente de lógica no núcleo. Registro = o arquivo só GANHA linhas, e cada linha
  // nova cita a rota do cliente ou é sintaxe de lista/objeto/ícone. O #671 (só acrescenta
  // `/minaslocc/mensagens` nas 4 listas) é registro; o #666 (if prime no convite) é lógica.
  const rotaCliente = new RegExp(`/${cliente}(/|["'\`]|$)`);
  const estrutural = /^\s*([\]\[{}(),;]+|\w+,|\w+:\s*(true|false|\w+,?|["'`][^"'`]*["'`],?)|import\s+\{[^}]*\}\s+from\s+["'`]lucide-react["'`];?)\s*$/;
  const ehComentarioDeRegistro = (l) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l);
  const ehRegistro = (a) => {
    const f = pr.files.find((x) => x.path === a);
    if (!f) return false;
    // Ramo por cliente nunca é registro, mesmo citando o cliente — é exatamente a lógica que o
    // sinal existe para pegar (o `if prime` do #666).
    if (ramos.some((r) => r.startsWith(`${a}:`))) return false;
    // Apagar só comentário (ajustar a contagem "as oito telas" no #728) não muda comportamento;
    // apagar código só passa quando é o registro do PRÓPRIO cliente (`remocaoDeRegistro`).
    if (f.deletions > 0 && !pr.removidas?.[a]) return false;
    if (!remocaoDeRegistro(pr.removidas?.[a] || [], cliente)) return false;
    return (diff[a] || []).filter((l) => l.trim() && !ehComentarioDeRegistro(l))
      .every((l) => rotaCliente.test(l) || entradaDoCliente(l, cliente) || estrutural.test(l));
  };
  const registro = arquivos.filter(ehRegistro);
  // Remoção genérica: o arquivo do núcleo só PERDE coisa — cada linha nova não-comentário é uma
  // linha apagada encurtada (tirar um item de lista, de enum, uma <option>) — e não há ramo por
  // cliente. Caso do papel `almoxarife` saindo da plataforma no #666 (07/10/2026): é mudança do
  // núcleo para todos, decidida pelo dono, e não lógica de cliente. Vai como 🟡, não 🔴.
  const ehComentario = (l) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l) || !l.trim();
  const ehRemocao = (a) => {
    if (ramos.some((r) => r.startsWith(`${a}:`))) return false;
    const f = pr.files.find((x) => x.path === a);
    if (!f || f.deletions === 0) return false;
    const novas = (diff[a] || []).filter((l) => !ehComentario(l));
    if (novas.length > f.deletions) return false;
    return novas.every((l) => {
      const norm = l.replace(/\s+/g, '');
      return norm.length < 400 && (pr.removidas?.[a] || []).some((r) => {
        const rn = r.replace(/\s+/g, '');
        return rn.length > norm.length && [...norm].every((ch, i, arr) => rn.includes(arr.slice(0, i + 1).join('')) || true) && sequenciaContida(norm, rn);
      });
    });
  };
  const remocao = arquivos.filter((a) => !registro.includes(a) && ehRemocao(a));
  return { cliente, arquivos: arquivos.filter((a) => !registro.includes(a) && !remocao.includes(a)), registro, remocao, ramos };
}

// `curta` é `longa` com trechos tirados (subsequência de caracteres, na ordem).
function sequenciaContida(curta, longa) {
  let j = 0;
  for (let i = 0; i < longa.length && j < curta.length; i += 1) if (longa[i] === curta[j]) j += 1;
  return j === curta.length;
}

// Capacidades que a plataforma já oferece: lista editável em references/padroes-da-plataforma.txt.
const PADROES = (() => {
  try {
    return require('node:fs').readFileSync(require('node:path').join(__dirname, 'references', 'padroes-da-plataforma.txt'), 'utf8')
      .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('||'))
      .map((l) => { const [re, usar] = l.split('||').map((x) => x.trim()); return { re: new RegExp(re), usar }; });
  } catch {
    return [];
  }
})();

// PR de UM cliente que recria por conta própria o que a plataforma já tem (#671: número de
// WhatsApp em variável fixa enquanto existia a conexão por organização do #679).
// ADR 0012 (07/10/2026): só o `pruma-n8n-workflows` publica fluxo no n8n. Satélite ou agente
// que traz o próprio JSON de workflow (`n8n/*.json`, `workflow.json`) recria a esteira de
// publicação — com regras próprias, que foi como os fluxos da Íris saíram sem telemetria.
const REPO_DE_FLUXOS = 'pruma-n8n-workflows';
const ARQUIVO_DE_WORKFLOW = (p) => /(^|\/)workflow\.json$|(^|\/)n8n\/[^/]+\.json$/.test(p) && !/template\.json$/.test(p);
function fluxosForaDoRepo(pr) {
  if (pr.repo === REPO_DE_FLUXOS) return [];
  // Só o que o PR acrescenta ou muda: APAGAR o JSON é justamente a migração que o ADR pede.
  return pr.files.filter((f) => f.additions > 0).map((f) => f.path)
    .filter((p) => ARQUIVO_DE_WORKFLOW(p) && !/(^|\/)(tests?|fixtures?|__fixtures__)\//.test(p))
    .map((arq) => ({ arq, trecho: 'workflow do n8n publicado fora do repo de fluxos', usar: `o \`${REPO_DE_FLUXOS}\` — o único que publica fluxo no n8n (ADR 0012)` }));
}

function duplicacoes(pr) {
  const fora = fluxosForaDoRepo(pr);
  if (pr.repo !== PLATAFORMA || !PADROES.length || !clienteDoPr(pr)) return fora;
  const out = [...fora];
  for (const [arq, linhas] of Object.entries(diffDe(pr))) {
    if (/\.(test|spec)\.|\.md$|(^|\/)tests?\/|\.env\.example$|^\.planning\//.test(arq)) continue;
    for (const l of linhas) {
      if (/^\s*(\/\/|\*|#)/.test(l)) continue;
      const p = PADROES.find((x) => x.re.test(l));
      if (p) out.push({ arq, trecho: l.trim().slice(0, 90), usar: p.usar });
    }
  }
  // um aviso por (arquivo, capacidade): repetir a mesma linha em 10 lugares não informa mais
  const vistos = new Set();
  return out.filter((d) => { const k = `${d.arq}|${d.usar}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
}

// Camada: a `lib` não importa da tela. O lint `pruma/lib-nao-importa-da-tela` já reprova a linha
// nova sozinho; o que sobra para a triagem é a válvula — `eslint-disable` dessa regra no diff —,
// cujo motivo alguém precisa julgar (proposta do SPEC-2026-10-20-skills-com-arquitetura-da-casa,
// aceita por Pedro em nome do Marcelo, 21/10/2026).
function valvulasDeCamada(pr) {
  if (pr.repo !== PLATAFORMA) return [];
  const out = [];
  for (const [arq, linhas] of Object.entries(diffDe(pr))) {
    if (!/^apps\/web\/src\/lib\//.test(arq)) continue;
    for (const l of linhas) if (/eslint-disable.*pruma\/lib-nao-importa-da-tela/.test(l)) out.push(`${arq}: ${l.trim().slice(0, 110)}`);
  }
  return out;
}

function eDeCliente(path) {
  const p = path.toLowerCase();
  return clientes().some((c) => new RegExp(`(^|[/_.(-])${c}([/_.)-]|$)`).test(p));
}

// ERP ou sistema que atende vários clientes: está em APELIDOS para a triagem achar o cliente, mas
// não é dono de caminho no `alcance` — `src/pruma_eloca/robo/x.py` e `lib/eloca/` servem todo
// tenant (verificação, 27/10/2026). `src/pruma_eloca/tenants/meyer/` continua da Meyer.
const SISTEMA_DE_VARIOS = new Set(['eloca', 'universal']);

/** O cliente dono do caminho, ou null quando não há um só (nenhum, ou dois nomes de cliente). */
function clienteDe(path) {
  const p = path.toLowerCase();
  const donos = clientes().filter((c) => !SISTEMA_DE_VARIOS.has(c) && new RegExp(`(^|[/_.(-])${c}([/_.)-]|$)`).test(p));
  return donos.length === 1 ? donos[0] : null;
}

// Alcance de uma conferência acesa (`cliente`, ou `equipe` no servidor): o nível do
// `sinais-pr.cjs` fica em `médio` (o semáforo da triagem: 🔴 é o que afeta todos os clientes).
// Todos os caminhos de UM cliente só → `cliente`. Qualquer caminho compartilhado, ou dois clientes, deixa sem alcance — vale o nível da conferência.
function comAlcance(conf, caminhos) {
  if (conf.estado !== 'acendeu' || !caminhos.length) return conf;
  const donos = new Set(caminhos.map(clienteDe));
  if (donos.size !== 1 || donos.has(null)) return conf;
  const [cliente] = donos;
  return { ...conf, alcance: 'cliente', fato: `${conf.fato} · só do cliente ${cliente}` };
}

// O nível pelo impacto real (impacto.cjs), não pelo caminho: núcleo tocado cujas linhas todas ficam
// no cliente do PR vira `alcance: cliente` (médio). A conferência continua acesa — lógica de
// cliente no núcleo é desvio de arquitetura, e quem revisa pede para mover (Pedro, 27/10/2026).
function comImpacto(conf, s) {
  const imp = s.impacto;
  if (conf.estado !== 'acendeu' || !imp) return conf;
  const cliente = s.nucleo2.cliente || clienteDoPr(s.pr);
  const remocao = s.nucleo2.remocao || [];
  if (imp.todos.length || remocao.length || !imp.isolados.length) {
    const fora = [...imp.todos.map((t) => `${t.arquivo}${t.motivo ? ` (${t.motivo})` : ''}`), ...remocao.map((a) => `${a} (remoção para todos)`)];
    return fora.length ? { ...conf, fato: `chega a todos os clientes: ${lista(fora, 3)}` } : conf;
  }
  const como = imp.isolados.map((i) => `${i.arquivo} (${i.como})`);
  return { ...conf, alcance: 'cliente',
    fato: `núcleo tocado, mas só para o cliente ${cliente}: ${lista(como, 3)} · arquitetura: lógica do cliente mora na pasta dele — mover` };
}

function linhasAdicionadas(bloco) {
  return bloco.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
}

// Divide o diff por arquivo: { caminho: [linhas adicionadas] }.
function removidasPorArquivo(diff) {
  const out = {};
  const normalizado = diff.replace(/([^\n])(diff --git a\/\S+ b\/\S+\n(?:index |new file|deleted file|similarity|rename |old mode))/g, '$1\n$2');
  for (const bloco of normalizado.split(/^diff --git /m).slice(1)) {
    const m = bloco.match(/^a\/\S+ b\/(\S+)/);
    if (m) out[m[1]] = bloco.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1));
  }
  return out;
}

// Arquivos que o diff CRIA (`new file mode`): numstat não separa "arquivo novo" de "só acrescentou
// linhas", e o sinal de cron novo no host só vale para o primeiro.
function novosPorArquivo(diff) {
  const normalizado = diff.replace(/([^\n])(diff --git a\/\S+ b\/\S+\n(?:index |new file|deleted file|similarity|rename |old mode))/g, '$1\n$2');
  const out = new Set();
  for (const bloco of normalizado.split(/^diff --git /m).slice(1)) {
    const m = bloco.match(/^a\/\S+ b\/(\S+)\nnew file mode/);
    if (m) out.add(m[1]);
  }
  return out;
}

function porArquivo(diff) {
  const out = {};
  // Com --exclude, o gh cola o cabeçalho do próximo arquivo na última linha do anterior.
  // Só é cabeçalho se a linha seguinte for `index`/`new file`/`deleted`/`similarity`/`rename`/
  // `old mode` — senão é conteúdo que contém a string (nit da verificação de 07/10/2026).
  const normalizado = diff.replace(/([^\n])(diff --git a\/\S+ b\/\S+\n(?:index |new file|deleted file|similarity|rename |old mode))/g, '$1\n$2');
  for (const bloco of normalizado.split(/^diff --git /m).slice(1)) {
    const m = bloco.match(/^a\/\S+ b\/(\S+)/);
    if (m) out[m[1]] = linhasAdicionadas(bloco);
  }
  return out;
}

function analisarSql(linhas) {
  const tabelas = linhas.map((l) => l.match(/CREATE TABLE (?:IF NOT EXISTS )?(?:"public"\.)?"?(\w+)"?/i)).filter(Boolean).map((m) => m[1]);
  return {
    tabelasNovas: tabelas,
    particionada: linhas.some((l) => /PARTITION BY/i.test(l)),
    allowGrowth: linhas.filter((l) => /prum[ao]:allow-growth/.test(l)).map((l) => l.trim()),
    enumNovo: linhas.filter((l) => /ALTER TYPE .* ADD VALUE/i.test(l)).map((l) => l.trim()),
    destrutivo: linhas.filter((l) => /(DROP (TABLE|COLUMN)|ALTER COLUMN .* TYPE|RENAME |SET NOT NULL)/i.test(l)).map((l) => l.trim()),
    // Índice único em tabela que nasce neste PR é inofensivo (vazia); em tabela antiga, a
    // duplicata que já existe em produção faz o migrate-on-start falhar e a release não sobe.
    indiceUnico: linhas.filter((l) => {
      const m = l.match(/CREATE UNIQUE INDEX .* ON (?:"public"\.)?"?(\w+)"?/i);
      return m && !tabelas.includes(m[1]);
    }).map((l) => l.trim()),
    // Só ALTER/UPDATE/DELETE na própria tabela do núcleo; FK que APONTA para ela é normal.
    tabelasNucleo: [...new Set(linhas
      .map((l) => l.match(/(?:ALTER TABLE|UPDATE|DELETE FROM)\s+(?:"public"\.)?"?(organizations|users|organization_members|accounts|sessions)"?\s/i))
      .filter(Boolean).map((m) => m[1]))],
  };
}

// Workflow do n8n: o JSON é opaco no diff, então o que importa se lê do arquivo inteiro no head
// do PR — cron, para onde chama, credencial sem id, Code node, adoção de workflow da UI.
// Decisão do dono em 07/10/2026: o repo `pruma-n8n-workflows` publica em produção no merge.
function analisarWorkflows(pr) {
  const alvos = pr.files.map((f) => f.path).filter(ARQUIVO_DE_WORKFLOW);
  if (!alvos.length) return [];
  let credenciais = {};
  try {
    const raw = pr.local
      ? require('node:fs').readFileSync(require('node:path').join(pr.raiz, 'credenciais.json'), 'utf8')
      : Buffer.from(gh(['api', `repos/${ORG}/${pr.repo}/contents/credenciais.json?ref=${pr.headRefOid}`, '-q', '.content']), 'base64').toString('utf8');
    credenciais = JSON.parse(raw);
  } catch {
    credenciais = null; // repo sem credenciais.json (satélite com n8n/ próprio)
  }
  const out = [];
  for (const caminho of alvos) {
    let w;
    try {
      const raw = pr.local
        ? require('node:fs').readFileSync(require('node:path').join(pr.raiz, caminho), 'utf8')
        : Buffer.from(gh(['api', `repos/${ORG}/${pr.repo}/contents/${caminho}?ref=${pr.headRefOid}`, '-q', '.content']), 'base64').toString('utf8');
      w = JSON.parse(raw);
    } catch {
      out.push(`${caminho}: não consegui ler o JSON do workflow`);
      continue;
    }
    const nos = Array.isArray(w.nodes) ? w.nodes : [];
    const tipo = (n) => String(n.type || '').split('.').pop();
    const crons = nos.filter((n) => tipo(n) === 'scheduleTrigger')
      .flatMap((n) => (n.parameters?.rule?.interval || []).map((i) => i.expression || `${i.field || 'intervalo'}`));
    const http = nos.filter((n) => tipo(n) === 'httpRequest').map((n) => `${n.parameters?.method || 'GET'} ${String(n.parameters?.url || '').replace(/^=/, '')}`);
    const escreve = http.filter((h) => /^(POST|PUT|PATCH|DELETE)/.test(h) && !/\/api\/n8n\/flows$/.test(h));
    const codeNodes = nos.filter((n) => tipo(n) === 'code');
    const codeInline = codeNodes.filter((n) => typeof n.parameters?.jsCode === 'string').length;
    const creds = JSON.stringify(w).match(/"\$credencial":\s*"([A-Z0-9_]+)"/g) || [];
    const nomes = [...new Set(creds.map((c) => c.match(/"([A-Z0-9_]+)"$/)[1]))];
    const semId = credenciais ? nomes.filter((c) => !credenciais[c]) : [];
    const telemetria = http.some((h) => /\/api\/n8n\/flows$/.test(h));
    const linha = [];
    if (crons.length) linha.push(`agendado: ${crons.join(' | ')} (${w.settings?.timezone || 'fuso não declarado'})`);
    if (escreve.length) linha.push(`escreve em: ${[...new Set(escreve)].join(', ')}`);
    if (!telemetria) linha.push('SEM telemetria em /api/n8n/flows');
    if (semId.length) linha.push(`credencial sem id em credenciais.json: ${semId.join(', ')} (o deploy recusa)`);
    if (codeInline) linha.push(`${codeInline} Code node com código inline (fora de arquivo .js testável)`);
    if (w.adotar) linha.push(`adota o workflow ${w.adotar} que já existe no n8n`);
    if (nos.some((n) => n.retryOnFail)) linha.push('nó com retryOnFail (escrita duplicada se a rota não for idempotente)');
    out.push(`${caminho}: ${linha.join(' · ') || 'sem cron, sem escrita, com telemetria'}`);
  }
  return out;
}

const cache = new Map();
function verPr(repo, n) {
  const k = `${repo}#${n}`;
  if (!cache.has(k)) {
    cache.set(k, { repo, ...JSON.parse(gh(['pr', 'view', String(n), '-R', `${ORG}/${repo}`, '--json',
      'number,title,author,baseRefName,headRefName,headRefOid,files,commits,url,isDraft,state,labels'])) });
  }
  return cache.get(k);
}

// A branch local vista como um PR: diff e commits contra a base de integração do repo.
function prLocal() {
  const raiz = sh('git', ['rev-parse', '--show-toplevel']).trim();
  const remoto = sh('git', ['remote', 'get-url', 'origin']).trim();
  const m = remoto.match(/Pruma-ia\/([\w.-]+?)(?:\.git)?$/);
  if (!m) throw new Error(`origin não é um repo da org ${ORG}: ${remoto}`);
  const repo = m[1];
  const base = repo === PLATAFORMA ? 'master' : 'main';
  let mergeBase;
  try {
    mergeBase = sh('git', ['merge-base', `origin/${base}`, 'HEAD']).trim();
  } catch {
    throw new Error(`origin/${base} não está buscado — rode git fetch origin ${base}`);
  }
  const files = sh('git', ['diff', '--numstat', mergeBase, 'HEAD']).split('\n').filter(Boolean).map((l) => {
    const [a, d, ...resto] = l.split('\t');
    return { path: resto.join('\t'), additions: Number(a) || 0, deletions: Number(d) || 0 };
  });
  const commits = sh('git', ['rev-list', `${mergeBase}..HEAD`]).split('\n').filter(Boolean).map((oid) => ({ oid }));
  const headRefName = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  return {
    local: true, raiz, repo, number: 'local', headRefName, baseRefName: base,
    headRefOid: sh('git', ['rev-parse', 'HEAD']).trim(),
    title: `sua branch ${headRefName} (ainda não é PR)`,
    author: { login: 'você' }, url: `(local, ${commits.length} commit(s) sobre origin/${base})`, isDraft: false, labels: [],
    files, commits,
    ...(() => {
      const bruto = sh('git', ['diff', mergeBase, 'HEAD', '--', '.', ':(exclude)**/migrations/meta/*', ':(exclude)**/package-lock.json']);
      return { diff: porArquivo(bruto), removidas: removidasPorArquivo(bruto), novos: novosPorArquivo(bruto), mudadas: linhasMudadas(bruto) };
    })(),
    mergeBase,
  };
}

// O mesmo texto do `gh pr diff`, montado pela API de arquivos — que vai até 3.000 arquivos. Acima
// de 300 o GitHub recusa o diff (HTTP 406, `too_large`), e a exceção derrubava a triagem de TODOS
// os PRs abertos, com exit 1 em vez de 2 (#891, 16/10/2026). Os mesmos geradores ficam de fora.
const GERADO_NO_DIFF = /(^|\/)migrations\/meta\/|(^|\/)package-lock\.json$/;
function diffSintetico(arquivos) {
  return arquivos.filter((f) => !GERADO_NO_DIFF.test(f.filename)).map((f) => [
    `diff --git a/${f.filename} b/${f.filename}`,
    { added: 'new file mode 100644', removed: 'deleted file mode 100644' }[f.status] || 'index 0000000..0000000 100644',
    `--- a/${f.filename}`, `+++ b/${f.filename}`, f.patch || '',
  ].join('\n')).join('\n');
}

function diffBruto(pr) {
  try {
    return gh(['pr', 'diff', String(pr.number), '-R', `${ORG}/${pr.repo}`, ...DIFF_SEM_GERADO]);
  } catch (e) {
    if (!/too_large|exceeded the maximum number of files/i.test(String(e.stderr || e.message))) throw e;
    const arquivos = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${ORG}/${pr.repo}/pulls/${pr.number}/files?per_page=100`])).flat();
    // A API não traz o `patch` de arquivo grande ou binário: o que estiver nele não foi lido, e
    // "limpo" passa a dizer isso (nit da 2ª rodada da verificação).
    pr.semPatch = arquivos.filter((f) => !f.patch && !GERADO_NO_DIFF.test(f.filename)).map((f) => f.filename);
    return diffSintetico(arquivos);
  }
}

// O arquivo inteiro de um lado do PR (`cabeca` ou `base`), para ler o bloco em volta da linha
// mudada. Local: o git. PR: a API, com a base no merge-base — `master` andou desde então, e o
// número da linha removida é do merge-base. Falhou: null, e o arquivo conta como de todos.
const textos = new Map();
function lerLado(pr, lado, caminho) {
  const k = `${pr.repo}#${pr.number}:${lado}:${caminho}`;
  if (textos.has(k)) return textos.get(k);
  let texto = null;
  try {
    if (pr.local) {
      texto = sh('git', ['show', `${lado === 'cabeca' ? 'HEAD' : pr.mergeBase}:${caminho}`]);
    } else {
      if (lado === 'base' && !pr.mergeBase) {
        pr.mergeBase = JSON.parse(gh(['api', `repos/${ORG}/${pr.repo}/compare/${pr.baseRefName}...${pr.headRefOid}`, '--jq', '{s: .merge_base_commit.sha}'])).s;
      }
      const ref = lado === 'cabeca' ? pr.headRefOid : pr.mergeBase;
      texto = gh(['api', `repos/${ORG}/${pr.repo}/contents/${caminho.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`,
        '-H', 'Accept: application/vnd.github.raw']);
    }
  } catch {
    texto = null;
  }
  textos.set(k, texto);
  return texto;
}

// Quem importa o arquivo FORA do PR: `git grep` na árvore (HEAD na branch local, origin/<base> para
// PR de outro lugar). Sem árvore, null — e o arquivo não se isola por quem importa.
function importadoresNaArvore(pr, caminho) {
  const e = especificadores(caminho);
  if (!e) return null;
  const ref = pr.local ? 'HEAD' : `origin/${pr.baseRefName}`;
  const nome = e.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const saida = sh('git', ['grep', '-l', '-E', '-e', `["'\`]${e.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'\`]`,
      '-e', `["'\`]\\.{1,2}/([^"'\`]*/)?${nome}["'\`]`, ref, '--', 'apps/web/src']);
    return saida.split('\n').filter(Boolean).map((l) => l.slice(ref.length + 1)).filter((p) => !ARQUIVO_DE_TESTE.test(p));
  } catch (err) {
    return err.status === 1 ? [] : null; // 1 = nenhum resultado
  }
}

// Quem importa o arquivo DENTRO do PR: linha adicionada com o alias ou o caminho relativo.
function importadoresNoPr(pr, caminho) {
  const e = especificadores(caminho);
  if (!e) return [];
  const rel = new RegExp(`["'\`](${e.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|\\.{1,2}/([^"'\`]*/)?${e.nome})["'\`]`);
  return Object.entries(pr.diff || {}).filter(([p, ls]) => !ARQUIVO_DE_TESTE.test(p) && ls.some((l) => rel.test(l))).map(([p]) => p);
}

/** As grafias do cliente, para casar no código: `medluz` também é `medluzline`. */
function nomesDoCliente(cliente) {
  const c = cliente.toLowerCase().replace(/-/g, '');
  const canon = CANONICO[c] || c;
  return [...new Set([canon, ...Object.entries(CANONICO).filter(([, v]) => v === canon).map(([k]) => k)])];
}

// Impacto real das mudanças no núcleo (impacto.cjs): isolado no cliente do PR, ou chega a todos.
function impactoDoNucleo(pr, arquivos, cliente) {
  if (!cliente || !arquivos.length) return { isolados: [], todos: arquivos.map((arquivo) => ({ arquivo, motivo: cliente ? '' : 'PR sem cliente: mudança da plataforma' })) };
  diffDe(pr);
  const nomes = nomesDoCliente(cliente);
  return classificar({
    arquivos, nomes, mudadas: pr.mudadas || {}, novos: pr.novos || new Set(),
    outros: clientes().filter((c) => !nomes.includes(c) && !SISTEMA_DE_VARIOS.has(c)),
    ler: (lado, a) => lerLado(pr, lado, a),
    importadores: (a) => importadoresNaArvore(pr, a),
    prImporta: (a) => importadoresNoPr(pr, a),
    deCliente: (u) => nomes.includes(clienteDe(u)),
  });
}

function diffDe(pr) {
  if (!pr.diff) {
    const bruto = diffBruto(pr);
    pr.diff = porArquivo(bruto);
    pr.removidas = removidasPorArquivo(bruto);
    pr.novos = novosPorArquivo(bruto);
    pr.mudadas = linhasMudadas(bruto);
  }
  return pr.diff;
}

// Rotas de ingestão que existem num ref da plataforma — pela API, para rodar de qualquer repo.
const arvores = new Map();
function arvoreDe(ref) {
  if (!arvores.has(ref)) {
    const arvore = JSON.parse(gh(['api', `repos/${ORG}/${PLATAFORMA}/git/trees/${ref}?recursive=1`]));
    if (arvore.truncated) throw new Error(`árvore de ${ref} truncada pela API — não dá para listar as rotas`);
    arvores.set(ref, arvore.tree.map((e) => e.path));
  }
  return arvores.get(ref);
}

// TODAS as rotas de API da plataforma, não só `/api/n8n/*`: o console (conversation-analyzer#15,
// 07/10/2026; hoje o repo é `pruma-console`) chama `/api/console/*`, que nasce no #686 — e passava sem ORDEM DE PUBLICAÇÃO.
// Segmento dinâmico (`[id]`) vira curinga para casar `/api/x/123/y`.
function rotasDe(ref) {
  return new Set(arvoreDe(ref)
    .filter((p) => /^apps\/web\/src\/app\/api\/.*\/route\.ts$/.test(p))
    .map((p) => p.replace('apps/web/src/app', '').replace(/\/route\.ts$/, '')));
}
const casaRota = (padrao, rota) => new RegExp(`^${padrao.replace(/\[[^\]]+\]/g, '[^/]+')}$`).test(rota);
const temRota = (conjunto, rota) => conjunto.has(rota) || [...conjunto].some((p) => p.includes('[') && casaRota(p, rota));

// Rota que só casa pelo segmento dinâmico prova o ENDEREÇO, não o valor: no pruma-gestaoclick#4
// (15/10/2026) `/api/n8n/medluz/bens` saiu "existe em produção" por `[recurso]`, e `bens` só era
// aceito no #835, ainda aberto (a rota devolve 404 para recurso desconhecido). O valor no lugar do
// parâmetro é procurado no código que ainda não chegou em produção.
const padraoPorParametro = (conjunto, rota) => (conjunto.has(rota) ? null
  : [...conjunto].find((p) => p.includes('[') && casaRota(p, rota)) || null);
function valoresDoParametro(padrao, rota) {
  const segs = rota.split('/');
  return padrao.split('/').map((s, i) => (/^\[[^\]]+\]$/.test(s) ? segs[i] : null)).filter(Boolean);
}
// Citar o valor = literal inteiro entre aspas/crase ou chave de objeto. Pedaço de palavra não conta.
function citaValor(linha, valor) {
  const v = valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(["'\`])${v}\\1|(^|[^\\w$.])${v}\\s*:`).test(linha);
}
// Código de produção da plataforma: onde o valor passa a ser aceito. Teste citando o valor não prova nada.
const linhasDeCodigo = (diff) => Object.entries(diff).filter(([p]) => ehCodigo(p)).flatMap(([, ls]) => ls);
// O compare corta em 300 arquivos e omite o `patch` de arquivo grande ou binário: aí não dá para afirmar nada.
const ehCodigo = (p) => /^apps\/web\/src\//.test(p) && !ARQUIVO_DE_TESTE.test(p);
const compareCompleto = (files) => files.length < 300
  && files.filter((f) => ehCodigo(f.filename)).every((f) => f.patch !== undefined || f.status === 'removed');
function estadoPorParametro({ rota, padrao, abertos, promover }) {
  const valores = valoresDoParametro(padrao, rota);
  const cita = (linhas) => linhas.some((l) => valores.some((v) => citaValor(l, v)));
  const aberto = abertos.find((o) => o.linhas && cita(o.linhas));
  if (aberto) return { rota, estado: `o endereço ${padrao} existe em produção, mas o valor ${valores.join(', ')} nasce no PR aberto #${aberto.number} da plataforma`, bloqueia: true };
  if (promover.completo && cita(promover.linhas)) return { rota, estado: `o endereço ${padrao} existe em produção, mas o valor ${valores.join(', ')} está só em master — falta promover para production`, bloqueia: true };
  const ilegiveis = abertos.filter((o) => !o.linhas).map((o) => `#${o.number}`);
  const ressalva = (promover.completo ? '' : ' (não deu para ler o diff inteiro de master para production)')
    + (ilegiveis.length ? ` (não deu para ler o diff de ${ilegiveis.join(', ')})` : '');
  return { rota, estado: `existe em produção pelo parâmetro de ${padrao} — confira que produção aceita ${valores.join(', ')}${ressalva}` };
}

// Migrations que já estão na base. Colisão com PR ABERTO não basta: o #686 trouxe a 0140 depois de
// a 0140 da Animatrix (#684) entrar na master, e o CI dele estava verde porque rodou antes.
function migracoesDaBase(ref) {
  return arvoreDe(ref).filter((p) => /^apps\/web\/db\/migrations\/\d{4}_.*\.sql$/.test(p));
}

const migrationsDe = (pr) => pr.files.map((f) => f.path).filter((p) => /db\/migrations\/\d{4}_.*\.sql$/.test(p));
const numeroMig = (p) => p.match(/migrations\/(\d{4})_/)[1];

// `when` de cada migration do PR, lido do journal da branch. O migrator aplica em ordem de
// `when`, não de número: migration com `when` MENOR que uma já aplicada é pulada em silêncio.
// Medido em 07/10/2026 em dois pares de PRs abertos (#666 < #665, #665 < #668).
function whensDe(pr) {
  if (pr.whens) return pr.whens;
  pr.whens = {};
  const temJournal = pr.files.some((f) => /migrations\/meta\/_journal\.json$/.test(f.path));
  if (!temJournal) return pr.whens;
  try {
    const journal = pr.local
      ? JSON.parse(require('node:fs').readFileSync(require('node:path').join(pr.raiz, 'apps/web/db/migrations/meta/_journal.json'), 'utf8'))
      : JSON.parse(Buffer.from(gh(['api', `repos/${ORG}/${pr.repo}/contents/apps/web/db/migrations/meta/_journal.json?ref=${pr.headRefOid}`, '-q', '.content']), 'base64').toString('utf8'));
    const minhas = new Set(migrationsDe(pr).map((p) => p.split('/').pop().replace(/\.sql$/, '')));
    for (const e of journal.entries || []) if (minhas.has(e.tag)) pr.whens[e.tag] = e.when;
  } catch {
    // journal ilegível: sem `when`, sem sinal — o migration-check pega depois do merge
  }
  return pr.whens;
}

// PR de promoção (master → production): leva o que já está na master. Colisão com PR aberto
// para a master não se aplica a ele — é problema daqueles PRs com a master, não da release.
const ehPromocao = (pr) => pr.repo === PLATAFORMA && pr.baseRefName === 'production' && pr.headRefName === 'master';

function colisoes(pr, abertos, baseMigs) {
  const out = [];
  if (pr.state === 'MERGED') return out; // já está na base: quem colide agora são os outros
  if (ehPromocao(pr)) return out;
  const migs = migrationsDe(pr);
  const meus = new Set(migs.map(numeroMig));
  if (pr.repo === PLATAFORMA && pr.baseRefName === 'master' && baseMigs) {
    for (const p of migs) {
      const daBase = baseMigs.find((b) => numeroMig(b) === numeroMig(p) && b.split('/').pop() !== p.split('/').pop());
      if (daBase) out.push(`migration ${p.split('/').pop()} usa o número que já é de ${daBase.split('/').pop()} na master: atualize a branch com a master e gere a migration de novo`);
    }
  }
  for (const o of abertos) {
    if (o.repo !== pr.repo || o.number === pr.number) continue;
    if (pr.local && (o.headRefName === pr.headRefName || o.headRefOid === pr.headRefOid)) continue; // é o PR desta mesma branch
    const dele = migrationsDe(o);
    const mesmoNumero = dele.filter((p) => meus.has(numeroMig(p)) && !migs.includes(p));
    const mesmoArquivo = dele.filter((p) => migs.includes(p));
    const commitsDele = new Set(o.commits.map((c) => c.oid));
    const herdados = pr.commits.filter((c) => commitsDele.has(c.oid)).length;
    if (mesmoNumero.length) out.push(`migration com o mesmo número do #${o.number}: ${mesmoNumero.map((p) => p.split('/').pop()).join(', ')}`);
    // `when` menor que o de uma irmã aberta: se ela entrar antes, a minha é pulada em produção.
    const meusWhens = Object.entries(whensDe(pr)).filter(([tag]) => !mesmoArquivo.some((p) => p.endsWith(`${tag}.sql`)));
    const delesWhens = Object.entries(whensDe(o)).filter(([tag]) => !migs.some((p) => p.endsWith(`${tag}.sql`)));
    for (const [tag, w] of meusWhens) {
      const maiores = delesWhens.filter(([, w2]) => w2 > w).map(([t]) => t);
      if (maiores.length) out.push(`\`when\` de ${tag} é MENOR que o de ${maiores.join(', ')} (#${o.number}): se o #${o.number} entrar antes, esta migration é pulada em silêncio em produção`);
    }
    if (mesmoArquivo.length) out.push(`carrega a mesma migration do #${o.number} (trabalho embutido de outro PR)`);
    if (herdados) out.push(`${herdados} commit(s) que também estão no #${o.number} — PR embutido/empilhado`);
    // PR embutido já foi dito acima; aqui é o caso de dois PRs INDEPENDENTES no mesmo código.
    // A promoção leva o conteúdo da master (não é concorrente), e PR empilhado tem base diferente.
    const comparavel = !herdados && !ehPromocao(o) && o.baseRefName === pr.baseRefName;
    const comuns = comparavel ? arquivosEmComum(pr, o) : [];
    if (comuns.length) out.push(`mexe nos mesmos arquivos que o #${o.number} (${lista(comuns, 4)}): cada um entra sozinho, mas o segundo a entrar tem de atualizar a branch com a base e refazer o trecho — combine a ordem`);
  }
  return out;
}

// Dois PRs abertos no mesmo arquivo de código. Medido em 07/10/2026: o #680 e o #681 (MAK)
// passavam na triagem um a um e conflitavam entre si — o #680 tirava da rota exatamente o
// trecho que o #681 editava. Fora: o que é gerado, migration (tem sinal próprio) e texto
// (`.md`, `.planning/`), que conflita fácil e se resolve sem risco.
function arquivosEmComum(a, b) {
  const deCodigo = (pr) => new Set(pr.files.map((f) => f.path)
    .filter((p) => !GERADO.test(p) && !/db\/migrations\//.test(p) && !/\.md$|^\.planning\//.test(p)));
  const dele = deCodigo(b);
  return [...deCodigo(a)].filter((p) => dele.has(p));
}

// Satélite: merge na `main` publica em produção, e cada merge dispara um deploy. Decisão do
// dono em 07/10/2026 (trakx#27, #28 e #29): vários PRs prontos do mesmo satélite entram
// juntos, e só o deploy do ÚLTIMO merge roda — os anteriores são cancelados.
function loteDoSatelite(pr, abertos) {
  if (pr.repo === PLATAFORMA || pr.state === 'MERGED') return [];
  return abertos.filter((o) => o.repo === pr.repo && o.number !== pr.number && o.baseRefName === pr.baseRefName && !o.isDraft)
    .map((o) => o.number);
}

// Linhas de código dos PRs abertos da plataforma e do que está em master sem estar em production.
// Lidas só quando alguma rota casa por parâmetro — o diff de cada PR custa uma chamada à API.
// A promoção fica fora dos abertos: o conteúdo dela é o `aPromover`, com a mensagem certa.
function abertosDaPlataforma(ctx) {
  ctx.linhasAbertas ??= ctx.abertos.filter((o) => o.repo === PLATAFORMA && o.state !== 'MERGED' && !ehPromocao(o))
    .map((o) => {
      try {
        return { number: o.number, linhas: linhasDeCodigo(diffDe(o)) };
      } catch {
        return { number: o.number, linhas: null };
      }
    });
  return ctx.linhasAbertas;
}
function aPromover(ctx) {
  if (!ctx.linhasAPromover) {
    const { prod = 'production', master = 'master' } = ctx.refs || {};
    try {
      const files = JSON.parse(gh(['api', `repos/${ORG}/${PLATAFORMA}/compare/${prod}...${master}`])).files || [];
      ctx.linhasAPromover = { completo: compareCompleto(files),
        linhas: files.filter((f) => ehCodigo(f.filename)).flatMap((f) => linhasAdicionadas(f.patch || '')) };
    } catch {
      ctx.linhasAPromover = { completo: false, linhas: [] };
    }
  }
  return ctx.linhasAPromover;
}

// Satélite chamando rota da plataforma: ela existe em produção? senão, qual PR aberto a cria?
function rotasChamadas(pr, ctx) {
  if (pr.repo === PLATAFORMA) return [];
  const chamadas = new Set();
  // Rota montada em pedaços: o robô passa "<cliente>/<recurso>" a um helper que prefixa a base
  // /api/n8n da configuração. O pruma-trakx#7 chamava "minaslocc/extrato", que não existia em
  // produção, e a conferência saía limpa (amostra fora da régua, 16/10/2026). Só texto entre aspas
  // que começa por nome de cliente conhecido conta — "dados/extrato.csv" não é rota.
  const conhecidos = new Set(ctx.clientes || [...clientes(), ...pastasDeTela()]);
  for (const [arquivo, linhas] of Object.entries(diffDe(pr))) {
    // Texto em aspas num teste ou num .md é dado, não chamada: "prime/os/29991" numa asserção do
    // pruma-eloca virava 🔴 de rota inexistente (nit da 6ª rodada). A rota por extenso segue valendo.
    const soDado = ARQUIVO_DE_TESTE.test(arquivo) || /\.md$|(^|\/)tests?\//.test(arquivo);
    for (const l of linhas) {
      for (const m of l.matchAll(/\/api\/[a-zA-Z0-9/_-]+/g)) chamadas.add(m[0].replace(/\/$/, ''));
      if (soDado) continue;
      for (const m of l.matchAll(/["']([a-z0-9-]+)\/([a-z0-9][a-z0-9/_-]*)["']/g)) {
        if (conhecidos.has(m[1]) && !/\.[a-z]+$/.test(m[2])) chamadas.add(`/api/n8n/${m[1]}/${m[2].replace(/\/$/, '')}`);
      }
    }
  }
  const rotaDoPr = (o) => o.files.map((f) => f.path).filter((p) => /^apps\/web\/src\/app\/api\/.*\/route\.ts$/.test(p))
    .map((p) => p.replace('apps/web/src/app', '').replace(/\/route\.ts$/, ''));
  return [...chamadas].map((rota) => {
    const n8n = rota.startsWith('/api/n8n/');
    if (ctx.prod.has(rota)) return { rota, estado: 'existe em produção' };
    const padrao = padraoPorParametro(ctx.prod, rota);
    // Com curinga em produção, só a rota POR EXTENSO em master ou em PR aberto conta como "nasce lá".
    const casa = padrao ? (conj, r) => conj.has(r) : temRota;
    if (casa(ctx.master, rota)) return { rota, estado: 'só em master — falta promover para production', bloqueia: true };
    const criador = ctx.abertos.find((o) => o.repo === PLATAFORMA && casa(new Set(rotaDoPr(o)), rota));
    if (criador) return { rota, estado: `NÃO existe em produção — nasce no PR aberto #${criador.number} da plataforma`, bloqueia: true };
    if (padrao) return estadoPorParametro({ rota, padrao, abertos: abertosDaPlataforma(ctx), promover: aPromover(ctx) });
    // Fora de `/api/n8n/` e sem rota da plataforma que case: é API do próprio satélite ou de
    // terceiro (Coolify, Evolution) — não é dependência da plataforma.
    if (!n8n) return null;
    return { rota, estado: 'NÃO existe em produção nem em PR aberto (rota com parâmetro? conferir)', bloqueia: true };
  }).filter(Boolean);
}

// Rotina de manutenção nova que nenhum script do host chama nunca roda.
function rotinasSemAgenda(pr) {
  if (pr.repo !== PLATAFORMA) return [];
  const novas = pr.files.filter((f) => f.deletions === 0 && /api\/maintenance\/[^/]+\/route\.ts$/.test(f.path))
    .map((f) => f.path.match(/maintenance\/([^/]+)\//)[1]);
  if (!novas.length) return [];
  const agenda = Object.entries(diffDe(pr)).filter(([p]) => /^infra\/host\//.test(p)).flatMap(([, l]) => l).join('\n');
  return novas.filter((ep) => !agenda.includes(ep));
}

// Dispensa de telemetria declarada (decisão do dono, 08/10/2026): `telemetria.json` de um fluxo no
// repo de fluxos, ou `telemetria.dispensa` numa ficha de agente. A máquina só exige o motivo; se
// o fluxo de fato não tem rotina a acompanhar (agente de conversa de teste) é julgamento — a
// Prime tem agente e precisa reportar. Por isso o sinal mostra o motivo para a revisão julgar.
function dispensasDeTelemetria(pr) {
  return Object.entries(diffDe(pr))
    .filter(([p]) => /(^|\/)(telemetria|agente)\.json$/.test(p))
    .flatMap(([p, linhas]) => linhas
      .map((l) => l.match(/"dispensa"\s*:\s*"((?:[^"\\]|\\.)*)"/))
      .filter(Boolean)
      .map((m) => `${p}: «${m[1].slice(0, 160)}${m[1].length > 160 ? '…' : ''}»`));
}

// Cron novo no host compartilhado (#861, 15/10/2026): `infra/host/opt-n8n/<nome>.sh` NOVO. A regra
// `agendado-de-negocio-no-n8n` é de CAMINHO, não de linha: o `duplicacoes()` pula comentário e só
// vê `/opt/n8n/x.sh` no cabeçalho `#`, e a outra via (linha no `deploy.crontab`) justamente o PR
// que esquece a agenda não tem. A máquina não separa infraestrutura (backup, limpeza, ronda) de
// negócio (relatório/tela de cliente), então ACUSA e a revisão julga — mesmo molde da dispensa.
const CRON_DO_HOST = /^infra\/host\/opt-n8n\/[^/]+\.sh$/;
function cronsNovosNoHost(pr) {
  if (pr.repo !== PLATAFORMA) return [];
  diffDe(pr);
  const novos = pr.novos || new Set();
  return pr.files.map((f) => f.path).filter((p) => CRON_DO_HOST.test(p) && novos.has(p));
}

// Variável de ambiente nova some em silêncio em produção se ninguém a cadastrar no Coolify.
function envsNovas(pr) {
  const diff = diffDe(pr);
  const lidas = new Set();
  for (const [p, linhas] of Object.entries(diff)) {
    if (/\.(test|spec)\.|\.md$|(^|\/)tests?\/|apps\/web\/scripts\//.test(p)) continue;
    // Só o que roda no container conta: variável lida por scripts/pruma, hooks ou skills é
    // do harness, não da app, e não mora no .env.example (falso positivo medido na própria
    // branch desta skill, com PRUMA_SEM_IMPACTO).
    if (pr.repo === PLATAFORMA && !/^apps\/web\/src\//.test(p)) continue;
    for (const l of linhas) {
      for (const m of l.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)|os\.environ(?:\.get)?\(?\[?["']([A-Z][A-Z0-9_]+)|getenv\(["']([A-Z][A-Z0-9_]+)/g)) {
        lidas.add(m[1] || m[2] || m[3]);
      }
    }
  }
  if (!lidas.size) return [];
  const exemplo = Object.entries(diff).filter(([p]) => /\.env\.example$/.test(p)).flatMap(([, l]) => l).join('\n')
    + envExemploDaBase(pr);
  return [...lidas].filter((v) => !exemplo.includes(v));
}

// O .env.example que a base já tem — variável antiga não é variável nova.
function envExemploDaBase(pr) {
  const caminho = pr.repo === PLATAFORMA ? 'apps/web/.env.example' : '.env.example';
  try {
    const b64 = gh(['api', `repos/${ORG}/${pr.repo}/contents/${caminho}?ref=${pr.baseRefName}`, '-q', '.content']);
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return ''; // repo sem .env.example: toda variável lida aparece como nova, que é o certo
  }
}

// Arquivo NOVO de um cliente solto onde a regra manda pasta por cliente ("Onde mora o código de cada
// cliente", apps/web/CLAUDE.md, 08/10/2026). Só arquivo que não existe na master: o que já estava
// fora é dívida, não achado deste PR. Rotas de `api/` ficam fora — o caminho é o endereço chamado.
const PASTAS_POR_CLIENTE = ['apps/web/src/lib/', 'apps/web/scripts/', 'apps/web/tests/e2e/', 'apps/web/tests/integration/', 'docs/'];
function foraDaPasta(pr) {
  if (pr.repo !== PLATAFORMA) return { itens: [] };
  const telas = pastasDeTela();
  if (!telas.length) return { itens: [], naoAvaliou: true };
  let base;
  try { base = new Set(arvoreDe('master')); } catch { return { itens: [], naoAvaliou: true }; }
  const itens = [];
  for (const f of pr.files) {
    if (GERADO.test(f.path) || base.has(f.path) || f.additions === 0) continue;
    const raiz = PASTAS_POR_CLIENTE.find((r) => f.path.startsWith(r));
    if (!raiz) continue;
    const resto = f.path.slice(raiz.length);
    if (telas.some((t) => resto.startsWith(`${t}/`))) continue; // já na pasta do cliente
    const achado = clientes().find((c) => new RegExp(`(^|[/_.(-])${c}([/_.)-]|$)`).test(resto.toLowerCase()));
    if (!achado) continue;
    const canon = CANONICO[achado] || telas.find((t) => t.replace(/-/g, '') === achado);
    if (!canon) continue; // apelido sem tela (kmart, iris…): não há pasta para mandar
    const nome = resto.split('/').pop().replace(new RegExp(`^(${achado}|${canon})[-_]`, 'i'), '');
    itens.push(`${f.path} → ${raiz}${canon}/${nome}`);
  }
  return { itens };
}

// Arquivo do apps/web/src que não roda em produção: teste (`.test`, `.spec`, `.e2e` — #970),
// snapshot de teste (#1059), tipo ambiente `.d.ts` (#1003) e texto. Não é núcleo de ninguém: o que
// ele registra (tabela nova, tipo) tem conferência própria ou quebra no build.
const NAO_RODA_EM_PRODUCAO = /\.(test|spec|e2e)\.tsx?$|\.d\.ts$|\.md$|(^|\/)__snapshots__\//;

function sinaisDoPr(pr, ctx) {
  const telasNovas = pr.repo === PLATAFORMA ? definirTelasDoPr(pr.files.filter((f) => f.additions > 0).map((f) => f.path)) : definirTelasDoPr([]);
  const escritos = pr.files.filter((f) => !GERADO.test(f.path));
  const nucleo = pr.repo === PLATAFORMA
    ? escritos.filter((f) => /^apps\/web\/src\//.test(f.path) && !eDeCliente(f.path) && !NAO_RODA_EM_PRODUCAO.test(f.path)).map((f) => f.path)
    : [];
  const migs = migrationsDe(pr);
  const nucleo2 = nucleoTocado(pr);
  return {
    pr,
    telasNovas,
    linhas: escritos.reduce((s, f) => s + f.additions + f.deletions, 0),
    gerados: pr.files.length - escritos.length,
    nucleo,
    zonas: ZONAS.map((z) => ({ ...z, arquivos: escritos.map((f) => f.path).filter((p) => zonasDoArquivo(p).includes(z)) })).filter((z) => z.arquivos.length),
    migs,
    sql: analisarSql(migs.flatMap((p) => diffDe(pr)[p] || [])),
    colisoes: colisoes(pr, ctx.abertos, ctx.baseMigs),
    lote: loteDoSatelite(pr, ctx.abertos),
    rotas: rotasChamadas(pr, ctx),
    semAgenda: rotinasSemAgenda(pr),
    envs: envsNovas(pr),
    workflows: analisarWorkflows(pr),
    dispensas: dispensasDeTelemetria(pr),
    cronsNovos: cronsNovosNoHost(pr),
    nucleo2,
    impacto: (() => {
      // Todo arquivo compartilhado que o PR escreve, menos o registro de tela e a remoção genérica,
      // que já têm leitura própria em `nucleoTocado`.
      const ja = new Set([...(nucleo2.registro || []), ...(nucleo2.remocao || [])]);
      const arquivos = [...new Set([...nucleo2.arquivos, ...nucleo, ...escritos.map((f) => f.path).filter((p) => ZONAS.find((z) => z.id === 'nucleo-satelite').re.test(p) && !ARQUIVO_DE_TESTE.test(p))])]
        // snapshot de teste não roda em produção: o que ele registra (tabela nova) já tem conferência própria
        .filter((a) => !ja.has(a) && !NAO_RODA_EM_PRODUCAO.test(a));
      try {
        return impactoDoNucleo(pr, arquivos, nucleo2.cliente || clienteDoPr(pr));
      } catch (e) {
        return { isolados: [], todos: arquivos.map((arquivo) => ({ arquivo, motivo: `não avaliou: ${String(e.message).split('\n')[0]}` })) };
      }
    })(),
    duplica: duplicacoes(pr),
    pasta: foraDaPasta(pr),
    camada: valvulasDeCamada(pr),
    vermelho: vermelhoAnterior(pr),
    escrita: (() => {
      try {
        return escritaNoCliente(pr);
      } catch {
        return ['não avaliou: diff indisponível'];
      }
    })(),
    variaveis: (() => {
      try {
        return variaveisNovas(pr, envExemploDaBase(pr));
      } catch {
        return ['não avaliou: diff indisponível'];
      }
    })(),
  };
}

const lista = (xs, max = 6) => xs.slice(0, max).join(', ') + (xs.length > max ? ` (+${xs.length - max})` : '');

// As conferências da triagem, SEMPRE todas, na mesma ordem: viram o checklist da revisão
// publicada (`postar.cjs`). Antes só aparecia o que acendia, e "olhei e está limpo" não se
// distinguia de "nem olhei" (decisão do dono, 16/10/2026). Estado é fato da máquina:
//   acendeu — o diff tem o que a conferência procura; quem revisa dá o veredito com evidência
//   limpo   — a conferência se aplica e não achou nada
//   na      — não se aplica a este PR (sem migration, satélite sem n8n…)
// Mudou a lista? Mude a seção "As conferências" do SKILL.md junto. As quatro antes de `servidor`
// vieram da garimpagem dos PRs que deram problema depois de entrar (16/10/2026); as duas depois
// dela (`escrita`, `teste`), da auditoria do pruma-eloca#87 (21/10/2026), e só valem em satélite.
const CONFERENCIAS = [
  ['spec', 'Spec'],
  ['migration', 'Migration repetida'],
  ['crescimento', 'Crescimento do banco'],
  ['sem-volta', 'Mudança sem volta no banco'],
  ['nucleo', 'Núcleo'],
  ['duplica', 'Duplica a plataforma'],
  ['pasta', 'Pasta do cliente'],
  ['camada', 'Camada (lib e tela)'],
  ['acesso', 'Perfil e acesso'],
  ['tela', 'Tela de todos'],
  ['rotina', 'Rotina agendada'],
  ['ordem', 'Ordem entre PRs'],
  ['base', 'Base do PR'],
  ['contrato', 'Contrato de ingestão'],
  ['login', 'Cadastro e login'],
  ['vermelho', 'Vermelho anterior'],
  ['telemetria', 'Telemetria do fluxo'],
  ['variavel', 'Variável de ambiente'],
  ['workflow', 'Workflow n8n'],
  ['servidor', 'Servidor e bibliotecas'],
  ['escrita', 'Escrita no sistema do cliente'],
  ['teste', 'Código sem teste'],
];

const DE_MIGRATION = /^(migration |`when`)/;

// Contrato de ingestão: os quatro casos mais caros da garimpagem de 16/10/2026 foram payload que
// o teste não tinha — #232 (lote com chave repetida, 500 no 1º ciclo real do Trakx), #694 (Medluz:
// o fluxo mandava o campo já desembrulhado, 400 na 1ª coleta), Iris#10 (campo `array` opcional do
// `$fromAI` chegava como '' e derrubou toda demanda nova), #824 (Meyer: um relógio adiantado
// recusou o lote de 3.491 máquinas). O fato é o contrato mudar; o juiz pergunta pela prova com o
// payload real.
const ROTA_DE_INGESTAO = /^apps\/web\/src\/app\/api\/(n8n|webhooks)\//;
const TIPO_ARRISCADO = new Set(['array', 'number', 'boolean', 'json']);

// O 3º argumento de cada `$fromAI(…)` da linha, lido com aspas e parênteses — regex com `[^)]*`
// parava no 1º `)` e a descrição "(padrão 5, máximo 10)" escondia o tipo (Important da 2ª rodada
// da verificação, 16/10/2026). No JSON do workflow as aspas vêm escapadas (`\"`).
function tiposDoFromAI(linha) {
  const texto = linha.replace(/\\"/g, '"');
  const tipos = [];
  let i = texto.indexOf('$fromAI(');
  while (i !== -1) {
    const args = [];
    let atual = '';
    let aspas = null;
    let prof = 0;
    let k = i + '$fromAI('.length;
    for (; k < texto.length; k++) {
      const ch = texto[k];
      if (aspas) {
        if (ch === aspas) aspas = null;
        atual += ch;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        aspas = ch;
        atual += ch;
      } else if (ch === '(') {
        prof++;
        atual += ch;
      } else if (ch === ')' && prof > 0) {
        prof--;
        atual += ch;
      } else if (ch === ')' || (ch === ',' && prof === 0)) {
        args.push(atual.trim());
        atual = '';
        if (ch === ')') break;
      } else {
        atual += ch;
      }
    }
    if (args[2]) tipos.push(args[2].replace(/^["'`]|["'`]$/g, '').toLowerCase());
    i = texto.indexOf('$fromAI(', k);
  }
  return tipos;
}

// O teste empírico de 16/10/2026 mostrou que o contrato mora também na BIBLIOTECA do cliente,
// não só na rota: o #694 mudou `lib/medluz-recursos.ts` e o #824 `lib/meyer/monitor-ingest.ts`,
// e os dois escaparam.
const LIB_DE_INGESTAO = /^apps\/web\/src\/lib\/.*(ingest|recursos|coleta|payload|contrato|webhook|monitor)/i;

function contratoDeIngestao(s) {
  const { pr } = s;
  if (pr.repo === PLATAFORMA) {
    const rotas = pr.files.map((f) => f.path).filter((p) => ROTA_DE_INGESTAO.test(p) && !ARQUIVO_DE_TESTE.test(p));
    // Pelo CAMINHO, sem exigir zod: o #824 mudou a regra do lote num laço, sem linha de validação.
    const libs = pr.files.map((f) => f.path).filter((p) => LIB_DE_INGESTAO.test(p) && !ARQUIVO_DE_TESTE.test(p) && !/\.md$/.test(p));
    const tocados = [...rotas, ...libs];
    if (!tocados.length) return { estado: 'limpo', fato: 'não muda rota nem validação de ingestão' };
    const fixture = pr.files.some((f) => /fixture|payload-real|amostra/i.test(f.path));
    return { estado: 'acendeu', fato: `${lista(tocados, 4)} · teste com payload real no diff: ${fixture ? 'sim' : 'NÃO'}`, caminhos: tocados };
  }
  // Satélite: o workflow pode morar em qualquer repo (Iris#10 estava no pruma-iris, e a 1ª versão
  // só lia o pruma-n8n-workflows).
  let diff;
  try {
    diff = diffDe(pr);
  } catch {
    return { estado: 'acendeu', fato: 'não avaliou: diff indisponível' };
  }
  const tipados = Object.entries(diff).filter(([, ls]) => ls.some((l) => tiposDoFromAI(l).some((t) => TIPO_ARRISCADO.has(t)))).map(([p]) => p);
  return tipados.length ? { estado: 'acendeu', fato: `campo tipado do $fromAI em ${lista(tipados, 4)} — opcional chega como ''?`, caminhos: tipados }
    : { estado: 'limpo', fato: 'sem campo tipado novo do $fromAI' };
}

// Variável nova em relação à BASE — a pergunta do checklist é "alguém cadastra no Coolify?", e o
// PR acrescentar a variável ao próprio `.env.example` não responde isso. O sinal `envsNovas`
// (texto do autor) segue perguntando pela documentação; este, pelo cadastro. Escape do #861 no
// teste empírico de 16/10/2026: três variáveis novas, `variavel` limpo.
// As variáveis que o código que roda no container LÊ nas linhas novas do diff. É a régua do
// pré-voo da central de deploy também (scripts/pruma/pre-voo.cjs): uma regra, dois leitores.
// Leitura pelo nome guardado numa constante (`const ENV_X = "NOME"` + `process.env[ENV_X]`): o
// pré-voo deu "pronto" no #1168 sem CONTA_AZUL_CLIENT_ID e _SECRET, que o oauth.ts lê assim
// (31/10/2026). A constante pode estar noutro arquivo do mesmo diff (exportada). O que ainda escapa:
// nome que chega por parâmetro de função (`lerEnv("X")` → `process.env[nome]`).
const CONSTANTE_COM_NOME = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*["'`]([A-Z][A-Z0-9_]+)["'`]/g;
const LEITURA_POR_INDICE = /process\.env\[\s*(?:["'`]([A-Z][A-Z0-9_]+)["'`]|([A-Za-z_$][\w$]*))\s*\]/g;

const LEITURA_DIRETA = /process\.env\.([A-Z][A-Z0-9_]+)|os\.environ(?:\.get)?\(?\[?["']([A-Z][A-Z0-9_]+)|getenv\(["']([A-Z][A-Z0-9_]+)/g;
// A leitura já diz o que fazer sem a variável — o resto da linha depois do nome lido:
// JS `?? x`, `|| x` ou comparação com valor (`?.trim() === "0"`: ausente cai no outro ramo); Python
// `get("X", x)`, `getenv("X", x)` ou `get("X", "").strip() or x`. Padrão VAZIO (`""`, `null`, `None`) não é
// padrão: é o jeito de ler a variável opcional, e sem ela a função fica desligada ou quebra (o
// `?? ""` de uma credencial). Comparação com `undefined`/`null` é a conferência antes do `throw`.
const VAZIO = /^\s*(?:""|''|``|null\b|undefined\b|None\b)/;
function padraoJs(resto) {
  const m = resto.match(/^(?:\?\.\w+\(\)|\.\w+\(\)|\))*\s*(\?\?|\|\||===?|!==?)/);
  if (!m) return false;
  const depois = resto.slice(m[0].length);
  // Comparação só com literal: `=== process.env.OUTRO` não diz nada sobre a ausência.
  return ['??', '||'].includes(m[1]) ? !VAZIO.test(depois) : /^\s*(?:["'`]|-?\d|true\b|false\b)/.test(depois);
}
function padraoPy(resto, leitura) {
  // `os.environ["X"]` levanta KeyError na ausência: nunca tem padrão, nem com `or` adiante.
  if (leitura.includes('[')) return false;
  const virgula = resto.match(/^["']\s*,\s*(?:default\s*=\s*)?/);
  if (virgula && !VAZIO.test(resto.slice(virgula[0].length))) return true;
  // `get("X", "").strip() or "8000"`: o vazio da leitura vira o valor do `or` (pruma-nfse). O `or`
  // tem de vir logo depois da própria chamada — `foo(get("X")) or y` não é padrão da leitura.
  return /^["']\s*(?:,\s*(?:default\s*=\s*)?(?:""|''|None)\s*)?\)(?:\.\w+\(\))*\s*or\s+(?!""|''|None\b)\S/.test(resto);
}
const EXEMPLO_DE_ENV = /(^|\/)\.env(\.[\w-]+)?\.example$/;

/**
 * Cada variável que o diff faz o container ler: { nome: { arquivos, semPadrao, comPadrao } }.
 * `arquivos` diz ONDE é lida (o pruma-ml-porta só roda o que o pacote dele importa); `semPadrao`,
 * que alguma leitura não tem valor para quando a variável falta — basta uma para a falta valer.
 * No satélite, o nome que o PR acrescenta ao `.env.example` também conta (pruma-eloca#91: a
 * classe de configuração do pydantic lê pelo nome do campo, sem `os.environ`), com padrão quando
 * o campo do mesmo nome em minúsculas tem `= valor` no diff.
 */
function leiturasDeVariavel(pr) {
  const out = new Map();
  const anotar = (nome, arquivo, comPadrao) => {
    const v = out.get(nome) || { arquivos: new Set(), semPadrao: false, comPadrao: false };
    if (arquivo) v.arquivos.add(arquivo);
    if (comPadrao) v.comPadrao = true;
    else v.semPadrao = true;
    out.set(nome, v);
  };
  const constantes = new Map();
  const porIndice = [];
  const exemplo = [];
  const campos = [];
  for (const [p, linhas] of Object.entries(diffDe(pr))) {
    if (EXEMPLO_DE_ENV.test(p)) {
      if (pr.repo !== PLATAFORMA) for (const l of linhas) { const m = l.match(/^\s*([A-Z][A-Z0-9_]+)=/); if (m) exemplo.push(m[1]); }
      continue;
    }
    if (/\.(test|spec)\.|\.md$|(^|\/)tests?\/|apps\/web\/scripts\//.test(p)) continue;
    if (pr.repo === PLATAFORMA && !/^apps\/web\/src\//.test(p)) continue;
    for (const l of linhas) {
      for (const m of l.matchAll(LEITURA_DIRETA)) {
        const resto = l.slice(m.index + m[0].length);
        anotar(m[1] || m[2] || m[3], p, m[1] ? padraoJs(resto) : padraoPy(resto, m[0]));
      }
      for (const m of l.matchAll(CONSTANTE_COM_NOME)) constantes.set(m[1], m[2]);
      for (const m of l.matchAll(LEITURA_POR_INDICE)) {
        const comPadrao = padraoJs(l.slice(m.index + m[0].length));
        if (m[1]) anotar(m[1], p, comPadrao);
        else porIndice.push([m[2], p, comPadrao]);
      }
      const campo = l.match(/^\s+([a-z][a-z0-9_]*)\s*:\s*[^=#]+?(=\s*[^#]*?\S)?\s*(#.*)?$/);
      if (campo) campos.push([campo[1].toUpperCase(), p, Boolean(campo[2]) && !VAZIO.test(campo[2].slice(1))]);
    }
  }
  for (const [id, p, comPadrao] of porIndice) if (constantes.has(id)) anotar(constantes.get(id), p, comPadrao);
  for (const nome of exemplo) {
    if (out.has(nome)) continue;
    const doCampo = campos.filter(([n]) => n === nome);
    if (doCampo.length) for (const [, p, comPadrao] of doCampo) anotar(nome, p, comPadrao);
    else anotar(nome, null, false);
  }
  return out;
}

function variaveisLidas(pr) {
  // Só o que o CÓDIGO lê: o nome do `.env.example` sem leitura no código é do pré-voo, não da triagem.
  return [...leiturasDeVariavel(pr)].filter(([, v]) => v.arquivos.size).map(([n]) => n);
}

function variaveisNovas(pr, exemploDaBase) {
  const novas = new Set(variaveisLidas(pr));
  for (const [p, linhas] of Object.entries(diffDe(pr))) {
    if (!/\.env\.example$/.test(p)) continue;
    for (const l of linhas) { const m = l.match(/^\s*([A-Z][A-Z0-9_]+)=/); if (m) novas.add(m[1]); }
  }
  const base = new Set([...exemploDaBase.matchAll(/^\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
  return [...novas].filter((v) => !base.has(v));
}

// Telemetria do fluxo: 2 dos 6 defeitos reais da amostra fora da régua (16/10/2026) foram rotina
// nova que não aparecia no painel de fluxos — pruma-trakx#7 (a agenda saiu do n8n para um
// `ciclo_loop` e o ciclo deixou de reportar em /api/n8n/flows; conserto #8) e pruma-gestaoclick#4
// (rotina `bens` devolvia só {status}; conserto #5). Regra da casa: todo fluxo reporta em
// /api/n8n/flows. O fato: rotina nova no diff (rota POST, laço agendado, gatilho de agenda do n8n)
// sem nenhuma linha de relato no diff. "relatório" não conta como relato.
const ROTINA_NOVA = /@(app|router)\.(post|api_route)\(|\basync def \w+_loop\(|^\s*while True:|create_task\(|ensure_future\(|AsyncIOScheduler|BackgroundScheduler|BlockingScheduler|\.add_job\(|scheduled_job\(|schedule\.every|cron\.schedule\(|setInterval\(|n8n-nodes-base\.(scheduleTrigger|cron|interval)\b/;
// Só CÓDIGO de relato: a rota, os campos dela ou a chamada de um `_relato…(`. A palavra solta
// "relato" aparece em comentário ("o relato NUNCA…") — o gestaoclick#4 escapou assim na 1ª versão.
const RELATO = /api\/n8n\/flows|prumaFlowId|n8nExecutionId|\b_?relato(?!r)\w*\(/;

function telemetriaDoFluxo(s) {
  const { pr } = s;
  if (pr.repo === PLATAFORMA) return { estado: 'na', fato: 'a plataforma recebe o relato; quem relata é o fluxo' };
  let diff;
  try {
    diff = diffDe(pr);
  } catch {
    return { estado: 'acendeu', fato: 'não avaliou: diff indisponível' };
  }
  const codigo = Object.entries(diff).filter(([p]) => !ARQUIVO_DE_TESTE.test(p) && !/\.md$|(^|\/)tests?\//.test(p));
  const rotinas = codigo.filter(([, ls]) => ls.some((l) => ROTINA_NOVA.test(l))).map(([p]) => p);
  if (!rotinas.length) return { estado: 'limpo', fato: 'sem rotina nova' };
  // Relato só conta em CÓDIGO: citado num teste ou num .md não manda nada ao painel (nit da 6ª rodada).
  const comRelato = codigo.some(([, ls]) => ls.some((l) => RELATO.test(l)));
  return comRelato ? { estado: 'limpo', fato: `rotina nova em ${lista(rotinas, 3)}, com relato no diff` }
    : { estado: 'acendeu', fato: `rotina nova em ${lista(rotinas, 3)} sem relato ao painel de fluxos (/api/n8n/flows) no diff` };
}

// Vermelho anterior: o #666 (07/10/2026) tinha 🔴 publicado — migration repetida e papel sem volta
// — e foi mergeado e promovido 12 minutos depois. A cor sinaliza, não impede (sem proteção de
// branch); esta conferência faz o 🔴 aparecer de novo onde ainda dá para parar: na triagem
// seguinte do mesmo PR e na promoção.
const LABEL_VERMELHO = '🔴 impacto';
function vermelhoAnterior(pr) {
  if (pr.local) return { estado: 'na', fato: 'branch local, ainda sem triagem' };
  if (ehPromocao(pr)) {
    try {
      const desde = JSON.parse(gh(['api', `repos/${ORG}/${PLATAFORMA}/commits/production`])).commit.committer.date;
      const vermelhos = JSON.parse(gh(['pr', 'list', '-R', `${ORG}/${PLATAFORMA}`, '--state', 'merged', '--base', 'master',
        '--label', LABEL_VERMELHO, '--search', `merged:>=${desde.slice(0, 10)}`, '--json', 'number,mergedAt']))
        .filter((p) => p.mergedAt >= desde);
      return vermelhos.length ? { estado: 'acendeu', fato: `entraram na release com 🔴: ${vermelhos.map((p) => `#${p.number}`).join(', ')}` }
        : { estado: 'limpo', fato: 'nenhum PR da release entrou com 🔴' };
    } catch {
      return { estado: 'acendeu', fato: 'não avaliou: não consegui listar os PRs da release com 🔴' };
    }
  }
  const tem = (pr.labels || []).some((l) => l.name === LABEL_VERMELHO);
  return tem ? { estado: 'acendeu', fato: 'a triagem anterior deu 🔴 — confira ponto a ponto se foi resolvido' }
    : { estado: 'limpo', fato: 'sem 🔴 de triagem anterior' };
}

// Escrita no sistema do cliente pelo código do satélite. A regra `escrita-externa` do
// regras.md só via nó HTTP do n8n; o robô que digita e clica Salvar por Playwright passava
// sem sinal nenhum. Caso: pruma-eloca#87 (21/10/2026), lançamento da leitura no tarifador
// da Meyer — a auditoria achou o modo prova liberando toda requisição fora de `exec.cgi`.
// Login preenche senha e é leitura do ponto de vista do cliente: fica de fora pelo caminho.
const CODIGO_SATELITE = /\.(py|ts|js|mjs|cjs)$/;
// Exclui só o ARQUIVO de login, pelo nome — pelo caminho, `workers/login_e_lancar.py` e
// `author_*.py` saíam inteiros da conferência (auditoria de segurança, 21/10/2026).
const ARQUIVO_DE_LOGIN = /(^|\/)(login|login_auto|relogin|auth|captcha|sessao)\.(py|ts|js|mjs|cjs)$/i;
// Login também mora fora de arquivo de login (`navegador.py` do pruma-gestaoclick#4 preenche o
// e-mail): a LINHA que fala de credencial não é escrita no sistema do cliente.
const LINHA_DE_LOGIN = /(e-?mail|senha|password|passwd|login|usuario|username)/i;
const NOME_DE_ESCRITA = /(escrev|escrita|lancar|lancamento|gravar|emitir|romaneio)[^/]*$/i;
const BOTAO_DE_ESCRITA = '(salvar|gravar|confirmar|lan[cç]ar|emitir|enviar|submit|excluir|apagar|deletar)';
const BOTAO_COM_CLIQUE = new RegExp(`${BOTAO_DE_ESCRITA}.*\\.click\\(|\\.click\\([^)]*${BOTAO_DE_ESCRITA}`, 'i');
const LINHA_DE_ESCRITA = [
  /\.(fill|type|press_sequentially|select_option|set_input_files|set_checked|check|dispatch_event)\(/,
  // o texto do botão vem antes (`get_by_role("button", name="Salvar").click()`) ou dentro do clique
  BOTAO_COM_CLIQUE,
  /\.press\(\s*["'`]Enter/,
  /\.submit\(\)|\bevaluate\(.*(submit|fetch\()/,
  // `route.continue_()` NÃO entra: interceptador genérico (bloquear imagem, medir) é leitura,
  // e acendia o pruma-gestaoclick#4 à toa no backtest de 21/10/2026. O do eloca#87 já acende
  // pelo `fill`/`click` e pelo nome do arquivo.
];
// Request não-GET de qualquer cliente HTTP (Playwright, requests, httpx, sessão própria). A ida
// ao núcleo da Pruma fica de fora — pela linha quando ela diz, e pelo ARQUIVO quando a URL vem
// de variável (`client.post(url, …)` em `core/relatorios/ingest.py`, `trakx/…/ingestao.py`:
// todo coletor manda dado assim, e acendia; verificação de 21/10/2026).
const REQUEST_DE_ESCRITA = /\b\w*(request|requests|httpx|client|cliente|session|sessao|http)\.(post|put|patch|delete)\(/i;
const LINHA_PARA_A_PRUMA = /pruma|ingest|api\/n8n|PRUMA_/i;
// Sem `envio`/`carteiro`: `envio_leitura.py` é nome natural de quem GRAVA no ERP por HTTP,
// e sairia calado (verificação e segurança, rodada 2). A lista de clientes HTTP é por nome
// de variável — `s.post(`, `aiohttp`, `urlopen` passam; é triagem, não controle.
const ARQUIVO_PARA_A_PRUMA = /(ingest|coleta|collect|snapshot|apuracao|telemetria)[^/]*$/i;

function escritaNoCliente(pr) {
  if (pr.repo === PLATAFORMA) return [];
  const diff = diffDe(pr);
  const achados = [];
  for (const f of pr.files) {
    const p = f.path;
    if (!CODIGO_SATELITE.test(p) || ARQUIVO_DE_TESTE.test(p) || ARQUIVO_DE_LOGIN.test(p)) continue;
    const paraPruma = ARQUIVO_PARA_A_PRUMA.test(p);
    const linha = (diff[p] || []).find((l) => {
      // linha de credencial é login — salvo se ela mesma clica um botão de escrita
      if (LINHA_DE_LOGIN.test(l) && !BOTAO_COM_CLIQUE.test(l)) return false;
      if (LINHA_DE_ESCRITA.some((re) => re.test(l))) return true;
      return REQUEST_DE_ESCRITA.test(l) && !paraPruma && !LINHA_PARA_A_PRUMA.test(l);
    });
    if (linha) achados.push(`${p}: ${linha.trim().slice(0, 90)}`);
    else if (NOME_DE_ESCRITA.test(p) && f.additions > 0) achados.push(`${p} (nome de escrita)`);
  }
  return achados;
}

// Código do satélite que mudou sem nenhum teste no diff. Na plataforma o gate `tests` cobre;
// no satélite o CI roda a suíte que existe, e suíte verde sem caso novo não prova o código novo.
function codigoSemTeste(pr) {
  if (pr.repo === PLATAFORMA) return { estado: 'na', fato: 'plataforma: o gate tests cobre' };
  const codigo = pr.files.map((f) => f.path)
    .filter((p) => CODIGO_SATELITE.test(p) && !ARQUIVO_DE_TESTE.test(p) && !/(^|\/)(docs|scripts)\//.test(p) && !GERADO.test(p));
  if (!codigo.length) return { estado: 'na', fato: 'sem código' };
  const testes = pr.files.map((f) => f.path).filter((p) => ARQUIVO_DE_TESTE.test(p));
  return testes.length ? { estado: 'limpo', fato: `${testes.length} arquivo(s) de teste no diff` }
    : { estado: 'acendeu', fato: `código sem teste no diff: ${lista(codigo, 4)}` };
}

function conferencias(s) {
  const { pr } = s;
  const plataforma = pr.repo === PLATAFORMA;
  const integracao = plataforma ? 'master' : 'main';
  const zona = (id) => (s.zonas.find((z) => z.id === id) || { arquivos: [] }).arquivos;
  const c = (estado, fato) => ({ estado, fato });
  const acende = (achados, limpo, na) => (achados.length ? c('acendeu', lista(achados, 4)) : na ? c('na', na) : c('limpo', limpo));
  const r = {};

  const temSpec = pr.files.some((f) => /\.planning\/workstreams\/.*SPEC-/.test(f.path));
  r.spec = !plataforma ? c('na', 'satélite: a spec mora na plataforma')
    : ehPromocao(pr) ? c('na', 'promoção master → production')
      : temSpec ? c('limpo', 'SPEC no diff') : c('acendeu', 'sem SPEC- no diff');

  const colMig = s.colisoes.filter((x) => DE_MIGRATION.test(x));
  r.migration = acende(colMig, `${s.migs.length} migration(s), número livre`, s.migs.length ? null : 'sem migration');

  const carga = [...s.sql.tabelasNovas.map((t) => `tabela nova ${t}`), ...s.sql.allowGrowth.map((a) => `válvula de crescimento ${a}`),
    ...zona('ingestao')];
  r.crescimento = acende(carga, 'sem tabela nova nem entrada de dado em lote', s.migs.length || carga.length ? null : 'sem migration nem entrada de dado');
  // Tabela nova e válvula de crescimento são do banco de todos: alcance só quando é só ingestão.
  if (!s.sql.tabelasNovas.length && !s.sql.allowGrowth.length) r.crescimento = comAlcance(r.crescimento, zona('ingestao'));

  const semVolta = [...s.sql.enumNovo, ...s.sql.destrutivo, ...s.sql.indiceUnico, ...s.sql.tabelasNucleo.map((t) => `altera ${t}`)];
  r['sem-volta'] = acende(semVolta, 'nada irreversível nas migrations', s.migs.length ? null : 'sem migration');

  const nucleo = s.nucleo2.semLista ? ['não avaliou: references/nucleo-protegido.txt ausente']
    : [...s.nucleo2.arquivos, ...s.nucleo2.ramos, ...(s.nucleo2.remocao || []), ...zona('nucleo-satelite'),
      ...(s.nucleo2.arquivos.length ? [] : s.nucleo)];
  r.nucleo = acende(nucleo, s.nucleo2.registro && s.nucleo2.registro.length ? 'só registro de tela do cliente' : 'só pastas de cliente');
  r.nucleo = comImpacto(r.nucleo, s);

  r.duplica = acende(s.duplica.map((d) => `${d.arq} → usar ${d.usar}`), 'nada do catálogo de padrões');

  const pasta = s.pasta.naoAvaliou ? ['não avaliou: sem a árvore da master'] : [...s.pasta.itens, ...s.telasNovas.map((t) => `cliente novo: ${t}`)];
  r.pasta = acende(pasta, 'arquivos novos na pasta do cliente', plataforma ? null : 'satélite');

  r.camada = acende(s.camada || [], 'nenhuma válvula do lint de camada', plataforma ? null : 'satélite');

  r.acesso = acende(zona('perfil-acesso'), 'não toca');
  r.tela = acende(zona('casca'), 'não toca');
  r.rotina = acende([...zona('agendado'), ...s.semAgenda.map((e) => `sem agenda: api/maintenance/${e}`), ...s.cronsNovos.map((x) => `cron novo: ${x}`)], 'não toca');

  // Base: trakx#19-#21 (18/09/2026) empilhados mergearam em 11 s, ficaram "Merged" e duas
  // correções do cliente nunca chegaram à main.
  r.base = ehPromocao(pr) ? c('na', 'promoção master → production')
    : pr.baseRefName !== integracao ? c('acendeu', `base ${pr.baseRefName}, não ${integracao} — PR empilhado`) : c('limpo', `base ${integracao}`);

  const ordem = [
    ...s.colisoes.filter((x) => !DE_MIGRATION.test(x)),
    ...s.rotas.filter((x) => x.bloqueia).map((x) => `${x.rota}: ${x.estado}`),
    ...(s.lote.length ? [`satélite com outros PRs abertos: ${s.lote.map((n) => `#${n}`).join(', ')}`] : []),
  ];
  r.ordem = acende(ordem, s.rotas.length ? 'rotas chamadas já em produção' : 'sem dependência de outro PR');

  r.variavel = acende([...new Set([...(s.variaveis || []), ...s.envs])], 'nenhuma variável nova em relação à base');
  const wf = [...s.workflows, ...s.dispensas.map((d) => `dispensa de telemetria: ${d}`)];
  r.workflow = acende(wf, 'nada a apontar', pr.repo === 'pruma-n8n-workflows' || wf.length ? null : 'não é o repo do n8n');
  r.contrato = contratoDeIngestao(s);
  r.contrato = comAlcance(r.contrato, r.contrato.caminhos || []);
  delete r.contrato.caminhos;
  r.login = acende(zona('login'), 'não toca', plataforma ? null : 'satélite');
  r.vermelho = s.vermelho;
  r.telemetria = telemetriaDoFluxo(s);
  r.servidor = acende([...zona('infra'), ...zona('dependencia'), ...zona('esteira')], 'não toca');
  // Só o ferramental da equipe (Pruma Gates, hooks, evals, settings do Claude): não roda em produção e não
  // chega a cliente nenhum — muda o dia a dia de quem desenvolve. Workflow do GitHub fica na `infra`:
  // o CI promove e deploya, e quebra produção (#1067, #1066, #1057, #1044 saíam `alto` por isso).
  if (r.servidor.estado === 'acendeu' && !zona('infra').length && !zona('dependencia').length) {
    r.servidor = { ...r.servidor, alcance: 'equipe', fato: `${r.servidor.fato} · só o ferramental da equipe, não roda em produção` };
  }
  r.escrita = plataforma ? c('na', 'plataforma') : acende(s.escrita || [], 'não grava no sistema do cliente');
  r.escrita = comAlcance(r.escrita, (s.escrita || []).filter((a) => !a.startsWith('não avaliou')).map((a) => a.split(/: | \(/)[0]));
  r.teste = codigoSemTeste(pr);

  const parcial = pr.semPatch && pr.semPatch.length ? ` · ${pr.semPatch.length} arquivo(s) sem diff na API, não lidos: ${lista(pr.semPatch, 3)}` : '';
  return CONFERENCIAS.map(([id, nome]) => ({ id, nome, ...r[id], ...(parcial && r[id].estado === 'limpo' ? { fato: r[id].fato + parcial } : {}) }));
}

function linhasSql(sql) {
  const out = [];
  if (sql.tabelasNovas.length) out.push(`! tabelas novas: ${sql.tabelasNovas.join(', ')}${sql.particionada ? ' (há PARTITION BY)' : ''}`);
  for (const a of sql.allowGrowth) out.push(`! válvula de crescimento usada: ${a}`);
  for (const e of sql.enumNovo) out.push(`! valor novo em enum compartilhado (irreversível): ${e}`);
  for (const d of sql.destrutivo) out.push(`! DDL destrutivo: ${d}`);
  for (const u of sql.indiceUnico) out.push(`! índice único (falha o boot se houver duplicata em produção): ${u}`);
  if (sql.tabelasNucleo.length) out.push(`! migration altera tabela do núcleo: ${sql.tabelasNucleo.join(', ')}`);
  return out;
}

function imprimir(s) {
  const { pr } = s;
  const integracao = pr.repo === PLATAFORMA ? 'master' : 'main';
  const out = [`## ${pr.repo}#${pr.number} — ${pr.title}`,
    `autor: ${pr.author.login} · base: ${pr.baseRefName} · head: ${pr.headRefOid.slice(0, 7)} · ${s.linhas} linhas à mão (+${s.gerados} gerados ignorados)${pr.isDraft ? ' · RASCUNHO' : ''}`,
    `url: ${pr.url}`];
  if (pr.repo === PLATAFORMA) out.push(`spec no diff: ${pr.files.some((f) => /\.planning\/workstreams\/.*SPEC-/.test(f.path)) ? 'sim' : 'NÃO'}`);
  else out.push(`satélite: merge na ${integracao} publica em produção`);
  if (ehPromocao(pr)) out.push('promoção master → production: colisão com PRs abertos não se aplica; o que vale é o conteúdo da release, o prod-sim e a imagem');
  else if (pr.baseRefName !== integracao) out.push(`! base não é ${integracao} (${pr.baseRefName}) — PR empilhado`);
  if (s.nucleo2.semLista) out.push('! NÚCLEO: não avaliei — references/nucleo-protegido.txt ausente');
  if (s.nucleo2.arquivos.length) {
    out.push(`! NÚCLEO TOCADO por PR do cliente ${s.nucleo2.cliente} (🔴 por desenho — a lógica do cliente deveria morar na pasta dele): ${lista(s.nucleo2.arquivos, 10)}`);
    for (const r of s.nucleo2.ramos.slice(0, 8)) out.push(`! RAMO POR CLIENTE no núcleo: ${r}`);
    if (s.nucleo2.ramos.length > 8) out.push(`! … e mais ${s.nucleo2.ramos.length - 8} ramo(s) por cliente no núcleo`);
  }
  // Impacto real (impacto.cjs): o que das mudanças no núcleo chega aos outros clientes.
  for (const t of (s.impacto?.todos || []).slice(0, 6)) out.push(`! CHEGA A TODOS OS CLIENTES: ${t.arquivo}${t.motivo ? ` — ${t.motivo}` : ''}`);
  for (const i of (s.impacto?.isolados || []).slice(0, 6)) out.push(`núcleo só para o cliente do PR: ${i.arquivo} — ${i.como}`);
  if (s.nucleo2.remocao && s.nucleo2.remocao.length) {
    out.push(`! NÚCLEO — só REMOÇÃO genérica (sem ramo por cliente; 🟡, decisão do dono — mudança do núcleo para todos): ${lista(s.nucleo2.remocao, 6)}`);
  }
  if (s.nucleo2.registro && s.nucleo2.registro.length) {
    out.push(`núcleo: só REGISTRO de tela do cliente ${s.nucleo2.cliente} (ponto de extensão que todo cliente usa, sem lógica nova): ${lista(s.nucleo2.registro, 6)}`);
  }
  for (const n of s.telasNovas) out.push(`cliente novo nesta branch: ${n} (pasta de tela que a master não tem) — se for tela de todos, entra em TELAS_TRANSVERSAIS do sinais.cjs`);
  if (s.pasta.naoAvaliou) out.push('! PASTA DO CLIENTE: não avaliei — sem a árvore da master');
  for (const p of s.pasta.itens.slice(0, 8)) out.push(`! FORA DA PASTA DO CLIENTE (🟡 — mover antes do merge, regra em apps/web/CLAUDE.md): ${p}`);
  if (s.pasta.itens.length > 8) out.push(`! … e mais ${s.pasta.itens.length - 8} arquivo(s) fora da pasta do cliente`);
  for (const d of s.duplica.slice(0, 8)) out.push(`! DUPLICA o que a plataforma já tem: ${d.arq}: ${d.trecho} → usar ${d.usar}`);
  if (s.duplica.length > 8) out.push(`! … e mais ${s.duplica.length - 8} duplicação(ões)`);
  for (const c of s.colisoes) out.push(`! COLISÃO: ${c}`);
  if (s.lote.length) out.push(`satélite com outros PRs abertos (${s.lote.map((n) => `#${n}`).join(', ')}): os que estiverem prontos entram juntos e só o deploy do último merge roda — cancele os anteriores (\`gh run cancel\`)`);
  for (const r of s.rotas) out.push(`${r.bloqueia ? '! ORDEM DE PUBLICAÇÃO' : 'rota da plataforma'}: ${r.rota} — ${r.estado}`);
  if (s.migs.length) out.push(`migrations: ${s.migs.map((p) => p.split('/').pop()).join(', ')}`);
  out.push(...linhasSql(s.sql));
  for (const ep of s.semAgenda) out.push(`! rotina nova sem agenda no host: api/maintenance/${ep} não aparece em infra/host/ neste PR`);
  if (s.envs.length) out.push(`! variável de ambiente lida e ausente do .env.example: ${s.envs.join(', ')}`);
  for (const w of s.workflows) out.push(`! workflow n8n — ${w}`);
  for (const d of s.dispensas) out.push(`! DISPENSA DE TELEMETRIA declarada — julgar se o fluxo não tem mesmo rotina a acompanhar (agente de conversa de teste: sim; agente da Prime: não): ${d}`);
  for (const c of s.cronsNovos) out.push(`! CRON NOVO NO HOST compartilhado — julgar se é infraestrutura (backup, limpeza, ronda: sim) ou agendamento de negócio/tela de cliente (não: deveria disparar do n8n, repo pruma-n8n-workflows); o motivo precisa estar no corpo do PR: ${c}`);
  for (const e of (s.escrita || []).slice(0, 6)) out.push(`! ESCRITA NO SISTEMA DO CLIENTE — exige auditoria do pruma-security-auditor em modo satélite antes do merge: ${e}`);
  for (const z of s.zonas) out.push(`! ${z.rotulo}: ${lista(z.arquivos)}`);
  if (s.nucleo.length) out.push(`código compartilhado da plataforma (fora de pasta de cliente): ${s.nucleo.length} arquivo(s) — ${lista(s.nucleo, 8)}`);
  if (!out.some((l) => l.startsWith('!')) && !s.nucleo.length) out.push('nenhum sinal estrutural — mudança restrita a pasta de cliente');
  if (pr.local && out.some((l) => l.startsWith('!'))) {
    out.push('', 'Cada linha com "!" é um fato que vale para TODOS os clientes ou depende de outro PR. Antes de abrir o PR:',
      '  • colisão/`when`: combine a ordem com quem está na frente; quem entra depois mergeia a base e gera a migration de novo',
      '  • ORDEM DE PUBLICAÇÃO: o satélite só mergeia depois de a rota estar em PRODUÇÃO (promovida), não só em master',
      '  • tabela nova com carga, papel/enum, tela ou rotina compartilhada: diga no corpo do PR quanto cresce, quem é afetado e como está protegido',
      '  • leitura completa (com medição em produção e texto para o PR): skill `pruma-pr-review`');
  }
  return out.join('\n');
}

function alvos(args, abertos) {
  if (args[0] === '--abertos') return abertos;
  return args.map((a) => {
    const m = a.match(/^(?:([\w.-]+)#)?(\d+)$/);
    if (!m) throw new Error(`alvo inválido: ${a} (use 123 ou repo#123)`);
    return verPr(m[1] || PLATAFORMA, Number(m[2]));
  });
}

function main() {
  const json = process.argv.includes('--json');
  const args = process.argv.slice(2).filter((a) => a !== '--json');
  if (!args.length) {
    console.error('uso: node sinais.cjs --abertos | --local | <numero> | <repo>#<numero> ... [--json]');
    process.exit(2);
  }
  let ctx;
  let lista_;
  try {
    // No --local, o repositório local primeiro: fora de um repo da org ele falha sem tocar a rede
    // (o hook do `gh pr create` depende disso para responder rápido).
    const local = args[0] === '--local' ? prLocal() : null;
    // gh com files+commits na listagem estoura o teto de nós do GraphQL: lista só números e lê um a um.
    const lidos = JSON.parse(gh(['search', 'prs', '--owner', ORG, '--state', 'open', '--limit', '100', '--json', 'repository,number']));
    const abertos = lidos.map((p) => verPr(p.repository.name, p.number));
    ctx = { abertos, prod: rotasDe('production'), master: rotasDe('master'), baseMigs: migracoesDaBase('master') };
    lista_ = local ? [local] : alvos(args, abertos);
  } catch (e) {
    console.error(`não avaliou: ${e.message.split('\n')[0]}\n(gh autenticado? dentro de um repo da org?)`);
    process.exit(2);
  }
  if (json) {
    // O que o `postar.cjs` lê para montar o checklist: as 14 conferências de cada PR.
    console.log(JSON.stringify(lista_.map((pr) => ({
      repo: pr.repo, pr: pr.number, head: pr.headRefOid, conferencias: conferencias(sinaisDoPr(pr, ctx)),
    }))));
    return;
  }
  console.log(lista_.map((pr) => imprimir(sinaisDoPr(pr, ctx))).join('\n\n'));
}

// Linha de registro que cita o cliente por IDENTIFICADOR, não pela rota por extenso: o menu usa a
// constante (`{ href: CAMINHOS_PBOX.contratos, … }`), e o #728 (08/10/2026) saiu 🔴 por uma linha
// dessas dentro de `itensDaPbox`. Só vale com FORMA de entrada de objeto ou de lista — o nome do
// cliente em qualquer posição aceitaria lógica (`if (isPbox) return null`, `pboxAtivo && <X/>`,
// `const ok = plano !== "free" || isPbox`), que é o que o sinal de núcleo existe para pegar.
// Achado Important da verificação; os casos estão em `sinais.test.cjs`.
// O que faz uma linha DECIDIR em vez de declarar: operador lógico, comparação, chamada, `await`,
// arrow, `if`, `return`. Usado nas linhas acrescentadas (`entradaDoCliente`) e nas apagadas
// (`remocaoDeRegistro`) — uma régua só.
const DECISAO = /(&&|\|\||\?|[!=]==?|!\w|\w\s*\(|\bawait\b|[<>]|=>|\bif\b|\breturn\b)/;

function entradaDoCliente(l, cliente) {
  const forma = /^\s*(\{\s*\w+:.*\}|\[.*\]|[\w.]+|\w+:\s*[\w."'`.\[\]]+)\s*,?\s*$/;
  // Dentro de `{ … }` não pode haver operador de decisão nem JSX: aí deixou de ser dado.
  // `!x`, chamada, `await` e comparação também: `{ ativo: !isPbox }` e `{ ativo: carregarPbox() }`
  // decidem por todos (nit da 2ª rodada).
  return forma.test(l) && !DECISAO.test(l) && new RegExp(`\\b\\w*${cliente}\\w*\\b`, 'i').test(l);
}

// Linhas APAGADAS de um arquivo do núcleo que ainda deixam o arquivo como registro de tela: o
// cliente reordenou ou renomeou a PRÓPRIA entrada. O #734 (09/10/2026) saiu 🔴 por isso: mudou o
// item "Metas" de lugar no menu e o rótulo para "Metas de Venda", e as três listas apagavam linhas.
// Cada linha apagada tem de ser comentário, entrada do cliente ou estrutura (pontuação,
// `chave: valor` simples), e PELO MENOS UMA tem de ser do cliente: estrutura apagada sem entrada
// do cliente junto é mexer no núcleo dos outros. Linha que cita a rota do cliente e DECIDE
// (`if (p === "/x/y") return null`, `redirect("/x")`) não é entrada — achado Important da
// verificação de 09/10/2026; só as duas formas fixas de registro com decisão passam: o `ativo`
// do menu e a lista condicional de `telasDaOrg`. Linha que cita OUTRO cliente nunca passa.
// Limites aceitos: `chave: true,` genérico e `roles: [...]` na própria entrada do cliente.
const REGISTRO_COM_DECISAO = [
  /^\s*ativo:\s*\(p(:\s*string)?\)\s*=>\s*p\.startsWith\(["'`][^"'`]+["'`]\),?\s*$/,
  /^\s*\.\.\.\(is\w+Org\(slug\)\s*\?\s*\[[^\]]*\]\s*:\s*\[\]\),?\s*$/,
];
function remocaoDeRegistro(removidas, cliente, todos = clientes()) {
  const codigo = removidas.filter((l) => l.trim() && !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l));
  if (!codigo.length) return true;
  const rota = new RegExp(`/${cliente}(/|["'\`]|$)`);
  const outros = todos.filter((c) => c !== cliente);
  const outroCliente = outros.length ? new RegExp(`/(${outros.join('|')})(/|["'\`]|$)`) : null;
  const doCliente = (l) => !(outroCliente && outroCliente.test(l)) && (entradaDoCliente(l, cliente)
    || (rota.test(l) && (!DECISAO.test(l) || REGISTRO_COM_DECISAO.some((re) => re.test(l)))));
  const estrutura = /^\s*([\]\[{}(),;]+|\w+,|\w+:\s*(true|false|[\w.]+|["'`][^"'`]*["'`]),?)\s*$/;
  return codigo.some(doCliente) && codigo.every((l) => doCliente(l) || estrutura.test(l));
}

if (require.main === module) main();
module.exports = { NAO_RODA_EM_PRODUCAO, impactoDoNucleo, comImpacto, zonasDoArquivo, conferencias, CONFERENCIAS, escritaNoCliente, codigoSemTeste, valvulasDeCamada, telemetriaDoFluxo, variaveisNovas, variaveisLidas, leiturasDeVariavel, contratoDeIngestao, tiposDoFromAI, vermelhoAnterior, ZONAS, diffSintetico, porArquivo, removidasPorArquivo, cronsNovosNoHost, novosPorArquivo, entradaDoCliente, remocaoDeRegistro, telasNovasDe, definirTelasDoPr, clientes, ARQUIVO_DE_TESTE,
  padraoPorParametro, valoresDoParametro, citaValor, estadoPorParametro, compareCompleto, rotasChamadas, rotasDe, verPr };
