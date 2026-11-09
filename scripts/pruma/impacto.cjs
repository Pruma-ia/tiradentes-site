// Impacto real de uma mudança no núcleo: as linhas que mudaram chegam aos outros clientes?
//
// O núcleo é compartilhado, então "mexeu no núcleo" acendia `risco: alto` em quase todo PR
// (SPEC-2026-10-27-triagem-risco-de-verdade). O #1072 mudou `settings/organization/page.tsx` — a
// tela de todos — e toda linha mudada estava sob `isMakOrg(org?.slug) ? … : null`: para os outros
// clientes nada mudava. Aqui se lê cada linha mudada, com o arquivo em volta, e se decide:
//
//   cita      a linha nomeia o cliente (`cardWhatsappMak`, `isMakOrg`, `lib/mak/…`)
//   guardada  um bloco que a envolve (pela indentação) nomeia o cliente — `if (isMak) {`,
//             `{whatsappMak && (`, `function cardWhatsappMak(`
//   neutra    em branco, comentário, import, só fechamento (`}`, `)}`, `</Card>`)
//
// Arquivo cujas linhas mudadas são todas cita/guardada/neutra: isolado no cliente. Arquivo que
// só o cliente importa (pasta do cliente, ou arquivo do PR já isolado): isolado também. O resto
// chega a todos. Na dúvida (arquivo não lido, linha sem número) chega a todos: a máquina acusa a
// mais, nunca esconde (Pedro, 27/10/2026).
//
// Limite aceito: a leitura é por linha e indentação, não por árvore de sintaxe. Ternário numa
// linha só (`isMak ? 'A' : 'B'`) conta como do cliente mesmo quando o ramo mudado é o do senão.
//
// Isolado não quer dizer "pode": lógica de cliente dentro do núcleo continua sendo desvio de
// arquitetura (o código do cliente mora na pasta dele, apps/web/CLAUDE.md), e a conferência
// `nucleo` segue acesa dizendo isso. Muda o nível do risco, não o aviso.
'use strict';

/** Identificadores da linha, quebrados em palavras: `cardWhatsappMak` → card, whatsapp, mak. */
function palavras(linha) {
  return String(linha)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** A linha nomeia o cliente? `nomes` = o cliente e as grafias dele (sem hífen). */
function citaCliente(linha, nomes) {
  const ps = palavras(linha);
  // nome composto (`tiradentes-motos` → tiradentesmotos) também casa colado
  const colado = String(linha).toLowerCase().replace(/[^a-z0-9]/g, '');
  return nomes.some((n) => ps.includes(n) || (n.length >= 6 && colado.includes(n)));
}

// Citar não basta: `if (!isMak(org))` e `o.slug !== 'mak'` rodam para todos MENOS o cliente, e
// `slug === 'mak' || slug === 'meyer'` vale para outro cliente junto (verificação, 27/10/2026).
// `||`/`or` também: `if (isMak(org) || flag)` vale para quem tem `flag` (verificação, rodada 2).
const NEGA = /!==|!=|!\s*[\w$(.[]|\bnot\b|\belse\b|\bexcept\b|\|\||\bor\b/;

/** A linha restringe ao cliente: nomeia, sem negar e sem nomear outro cliente. */
function soDoCliente(linha, nomes, outros) {
  return citaCliente(linha, nomes) && !NEGA.test(linha) && !citaCliente(linha, outros);
}

// Ancestral que restringe: condição (`if`, `&&`, `?`, `case`, `when`, `elif`) ou declaração cujo
// NOME é do cliente (`function cardWhatsappMak(`, `const mak = {`, chave `mak: {`). Parâmetro com
// o nome do cliente (`function formatar(mak)`) não restringe nada.
const CONDICAO = /\b(if|elif|when|case|switch)\b|&&|\?(?!\.)/;
const DECLARACAO = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|def|async\s+def)\s+([\w$]+)|^\s*["'`]?([\w$-]+)["'`]?\s*:\s*[{[(]/;

function ancestralDoCliente(linha, nomes, outros) {
  if (!soDoCliente(linha, nomes, outros)) return false;
  if (CONDICAO.test(linha)) return true;
  const d = linha.match(DECLARACAO);
  return Boolean(d && citaCliente(d[1] || d[2], nomes));
}

const COMENTARIO_JS = /^\s*(\/\/|\/\*|\{\/\*)/;
const COMENTARIO_PY = /^\s*(#(?!!)|""")/;
// Import novo COM nome não muda nada até ser usado (e o uso é linha que se confere). Import
// removido, trocado de módulo ou de efeito colateral (`import 'x'`) muda — conta como linha.
const IMPORT_COM_NOME = /^\s*(import\s+(type\s+)?[\w${*]|export\s+\{[^}]*\}\s+from\s|from\s+\S+\s+import\s|\}\s+from\s+["'`])/;
const SO_FECHA = /^\s*([)\]}>;,]|<\/[\w.]*>|\/>)+\s*$/;

/** Dentro de bloco `/* … *\/`? A linha `* 2` só é comentário se estiver num. */
function emBlocoDeComentario(linhas, n) {
  for (let i = n - 2; i >= 0; i--) {
    if (linhas[i].includes('*/')) return false;
    if (linhas[i].includes('/*')) return true;
  }
  return false;
}

// Docstring do Python: só a string que ABRE a linha logo depois de `def`/`class …:` ou no topo do
// módulo, antes de qualquer código (eloca#96, trakx#36). String atribuída, retornada ou passada
// (SQL, prompt) é comportamento, e aspa tripla perdida em comentário ou string de uma linha não
// abre nada (verificação, rodada 4). Abertura sem fechamento: nada é docstring — na dúvida, acusa.
const ABRE_DOCSTRING = /^\s*[rRuU]?("""|\'\'\')/;
const docstrings = new WeakMap();
function linhasDeDocstring(linhas) {
  if (docstrings.has(linhas)) return docstrings.get(linhas);
  const dentro = new Set();
  let anterior = null; // última linha de código (sem branco e sem comentário)
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (!l.trim() || /^\s*#/.test(l)) continue;
    const m = l.match(ABRE_DOCSTRING);
    const lugar = anterior === null || /^\s*(async\s+)?(def|class)\b.*:\s*(#.*)?$/.test(anterior);
    if (m && lugar) {
      const aspas = m[1];
      const resto = l.slice(l.indexOf(aspas) + 3);
      let fim = resto.includes(aspas) ? i : -1;
      for (let j = i + 1; fim < 0 && j < linhas.length; j++) if (linhas[j].includes(aspas)) fim = j;
      if (fim < 0) break;
      for (let k = i; k <= fim; k++) dentro.add(k + 1);
      i = fim;
      anterior = linhas[fim];
      continue;
    }
    anterior = l;
  }
  docstrings.set(linhas, dentro);
  return dentro;
}

function neutra(linha, { python = false, adicionada = true, linhas = null, n = 0 } = {}) {
  if (!String(linha).trim() || SO_FECHA.test(linha)) return true;
  if ((python ? COMENTARIO_PY : COMENTARIO_JS).test(linha)) return true;
  if (python && linhas && linhasDeDocstring(linhas).has(n)) return true;
  if (!python && /^\s*\*/.test(linha) && linhas && emBlocoDeComentario(linhas, n)) return true;
  return adicionada && IMPORT_COM_NOME.test(linha);
}

const indentacao = (l) => l.match(/^\s*/)[0].replace(/\t/g, '  ').length;

/** As linhas que abrem os blocos em volta da linha `n` (1-based), da mais próxima para fora. */
function ancestrais(linhas, n) {
  const out = [];
  let teto = indentacao(linhas[n - 1] || '');
  for (let i = n - 2; i >= 0 && teto > 0; i--) {
    const l = linhas[i];
    if (!l.trim() || COMENTARIO_JS.test(l) || emBlocoDeComentario(linhas, i + 1)) continue;
    const ind = indentacao(l);
    if (ind < teto) {
      out.push(l);
      teto = ind;
    }
  }
  return out;
}

/** A linha `n` só roda (ou só existe) para o cliente: ela restringe, ou um bloco em volta dela. */
function linhaDoCliente(linhas, n, nomes, outros) {
  const l = linhas[n - 1];
  // A própria linha restringe se for condição ou declaração do cliente, ou import do código dele.
  // Só citar não basta: `return mak * 2` num `formatar(mak)` genérico roda para todos.
  if (ancestralDoCliente(l, nomes, outros) || (/^\s*(import|from)\s/.test(l) && soDoCliente(l, nomes, outros))) return true;
  // o primeiro ancestral que restringe decide; um `else`/negação no caminho já não restringe
  for (const a of ancestrais(linhas, n)) {
    if (ancestralDoCliente(a, nomes, outros)) return true;
    if (NEGA.test(a) && citaCliente(a, nomes)) return false;
  }
  return false;
}

/**
 * Isolamento pelas linhas. `cabeca`/`base`: o arquivo depois/antes (string, ou null se não existe).
 * `novas`/`velhas`: números das linhas adicionadas/removidas. `outros`: os nomes dos outros
 * clientes. Devolve { isolado, fora }, com `fora` a primeira linha que chega a todos.
 */
function isoladoPorLinhas({ cabeca, base, novas, velhas, nomes, outros = [], python = false }) {
  if (!novas.length && !velhas.length) return { isolado: false, fora: 'sem linha lida (rename ou binário)' };
  const lados = [[cabeca, novas, true], [base, velhas, false]];
  for (const [texto, nums, adicionada] of lados) {
    if (!nums.length) continue;
    if (texto == null) return { isolado: false, fora: 'arquivo não lido' };
    const linhas = texto.split('\n');
    for (const n of nums) {
      const l = linhas[n - 1];
      if (l === undefined) return { isolado: false, fora: `linha ${n} fora do arquivo` };
      if (neutra(l, { python, adicionada, linhas, n }) || linhaDoCliente(linhas, n, nomes, outros)) continue;
      return { isolado: false, fora: `l.${n}: ${l.trim().slice(0, 90)}` };
    }
  }
  return { isolado: true };
}

/** Números das linhas adicionadas e removidas por arquivo, lidos dos cabeçalhos `@@` do diff. */
function linhasMudadas(diff) {
  const out = {};
  let atual = null;
  let nova = 0;
  let velha = 0;
  // O `gh pr diff --exclude` cola o `diff --git` seguinte no fim da última linha do arquivo
  // excluído ou sem newline final — o mesmo conserto do `removidasPorArquivo` do sinais.cjs.
  const normalizado = String(diff).replace(/([^\n])(diff --git a\/\S+ b\/\S+\n(?:index |new file|deleted file|similarity|rename |old mode))/g, '$1\n$2');
  for (const l of normalizado.split('\n')) {
    const arq = l.match(/^diff --git a\/\S+ b\/(\S+)/);
    if (arq) {
      atual = { novas: [], velhas: [] };
      out[arq[1]] = atual;
      continue;
    }
    const h = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) {
      velha = Number(h[1]);
      nova = Number(h[2]);
      continue;
    }
    if (!atual || l.startsWith('+++') || l.startsWith('---')) continue;
    if (l.startsWith('+')) atual.novas.push(nova++);
    else if (l.startsWith('-')) atual.velhas.push(velha++);
    else if (l.startsWith(' ') || l === '') {
      nova++;
      velha++;
    }
  }
  return out;
}

const ENTRADA_DO_NEXT = new Set(['page', 'layout', 'route', 'loading', 'error', 'not-found', 'template', 'default', 'middleware', 'proxy']);

/** Como o código importa o arquivo: `@/lib/x/y` (alias do apps/web) e o nome sem extensão. */
function especificadores(caminho) {
  const m = caminho.match(/^apps\/web\/src\/(.+?)(\/index)?\.(tsx?|jsx?|mjs|cjs)$/);
  if (!m) return null;
  const nome = m[1].split('/').pop();
  // Ponto de entrada do Next ninguém importa: decide só pelas linhas (e `./page` acharia de tudo).
  if (ENTRADA_DO_NEXT.has(nome)) return null;
  return { alias: `@/${m[1]}`, nome };
}

const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * O importador usa o arquivo só dentro do bloco do cliente? Lê a linha de import que aponta para
 * `esp`, tira os nomes locais (`X`, `{ A, B as C }`, `* as N`) e confere cada linha que os usa:
 * tem de nomear o cliente ou estar num bloco dele. Import sem nome (efeito colateral) ou nenhum
 * uso achado: não isola — não dá para provar.
 */
function usoIsolado(texto, esp, nomes, outros = []) {
  if (texto == null) return false;
  const linhas = texto.split('\n');
  const alvo = new RegExp(`["'\`](${escapar(esp.alias)}|\\.{1,2}/([^"'\`]*/)?${escapar(esp.nome)})(\\.[jt]sx?)?["'\`]`);
  const locais = [];
  const linhasDoImport = new Set();
  for (let i = 0; i < linhas.length; i++) {
    if (!alvo.test(linhas[i])) continue;
    // import de várias linhas: junta para trás até o `import`
    let j = i;
    while (j > 0 && !/^\s*import\b/.test(linhas[j])) j--;
    const bloco = linhas.slice(j, i + 1).join(' ');
    for (let k = j; k <= i; k++) linhasDoImport.add(k);
    const m = bloco.match(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s/);
    if (!m) return false;
    const partes = m[1];
    const padrao = partes.match(/^([A-Za-z_$][\w$]*)/);
    if (padrao) locais.push(padrao[1]);
    const ns = partes.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (ns) locais.push(ns[1]);
    const chaves = partes.match(/\{([^}]*)\}/);
    if (chaves) for (const it of chaves[1].split(',')) {
      const nome = it.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      if (nome) locais.push(nome);
    }
  }
  if (!locais.length) return false;
  const usa = new RegExp(`(^|[^\\w$.])(${locais.map(escapar).join('|')})\\b`);
  const usos = [];
  linhas.forEach((l, i) => { if (!linhasDoImport.has(i) && !COMENTARIO_JS.test(l) && usa.test(l)) usos.push(i + 1); });
  if (!usos.length) return false;
  return usos.every((n) => linhaDoCliente(linhas, n, nomes, outros));
}

/**
 * Classifica cada arquivo do núcleo. `ler(lado, caminho)` devolve o texto (ou null);
 * `importadores(caminho)` devolve quem o importa fora do PR (ou null se não deu para buscar);
 * `prImporta(caminho)` quem o importa dentro do PR; `deCliente(caminho)` se o caminho é da pasta
 * do cliente. Devolve { isolados: [{arquivo, como}], todos: [{arquivo, motivo}] }.
 */
function classificar({ arquivos, mudadas, nomes, outros = [], ler, importadores, prImporta, deCliente, novos }) {
  const isolados = new Map();
  const todos = new Map();
  const inteiros = new Set(); // arquivo que só o cliente alcança — o uso dele não precisa de bloco
  for (const a of arquivos) {
    const m = mudadas[a];
    if (!m) {
      todos.set(a, 'diff sem números de linha');
      continue;
    }
    // Arquivo novo que se importa decide por quem importa, abaixo. Rota, página ou arquivo fora do
    // apps/web ninguém importa: decide pelas linhas, como o resto — rota nova é endereço para todos.
    if (novos.has(a) && especificadores(a)) continue;
    if (novos.has(a) && /^apps\/web\/src\/app\//.test(a)) {
      todos.set(a, 'rota ou página nova: endereço novo na área de todos');
      continue;
    }
    const r = isoladoPorLinhas({ cabeca: ler('cabeca', a), base: ler('base', a), novas: m.novas, velhas: m.velhas, nomes, outros,
      python: /\.py$/.test(a) });
    if (r.isolado) isolados.set(a, 'toda linha mudada nomeia o cliente ou está num bloco dele');
    else todos.set(a, r.fora);
  }
  // Quem importa: arquivo novo, e arquivo cujas linhas chegam a todos mas que só o cliente usa.
  // Até parar de mudar: um arquivo só fica `inteiro` depois de quem o importa ficar.
  for (let antes = -1; antes !== inteiros.size;) {
    antes = inteiros.size;
    for (const a of arquivos) {
      if (inteiros.has(a) || !mudadas[a] || (todos.has(a) && !especificadores(a))) continue;
      const fora = novos.has(a) ? [] : importadores(a);
      if (fora === null) {
        if (novos.has(a)) todos.set(a, 'não deu para buscar quem importa');
        continue;
      }
      const usam = [...new Set([...fora, ...prImporta(a)])].filter((u) => u !== a);
      if (!usam.length) {
        if (novos.has(a)) {
          inteiros.add(a);
          isolados.set(a, 'arquivo novo que ninguém importa');
          todos.delete(a);
        }
        continue;
      }
      // Importador da pasta do cliente, ou que só usa o arquivo dentro do bloco do cliente. Ser
      // "isolado" pelas linhas MUDADAS não basta: a tela pode usar o componente fora do bloco
      // numa linha que o PR não tocou.
      const esp = especificadores(a);
      // Importador que é ele mesmo só do cliente (`inteiros`) também conta: o componente da MAK na
      // pasta de todos usa o modelo dele sem bloco nenhum — e só a MAK chega ao componente.
      const deFora = usam.filter((u) => !deCliente(u) && !inteiros.has(u) && !(esp && usoIsolado(ler('cabeca', u), esp, nomes, outros)));
      if (!deFora.length) {
        inteiros.add(a);
        isolados.set(a, `só o cliente usa (${usam.length} arquivo(s))`);
        todos.delete(a);
      } else if (!isolados.has(a) && (novos.has(a) || !todos.has(a))) {
        // isolado pelas linhas continua isolado: quem importa não muda o que a linha faz
        todos.set(a, `usado por ${deFora.slice(0, 2).join(', ')}`);
      }
    }
  }
  return {
    isolados: [...isolados].map(([arquivo, como]) => ({ arquivo, como })),
    todos: [...todos].map(([arquivo, motivo]) => ({ arquivo, motivo })),
  };
}

module.exports = { usoIsolado, palavras, citaCliente, soDoCliente, neutra, ancestrais, isoladoPorLinhas, linhasMudadas, especificadores, classificar };
