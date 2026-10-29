#!/usr/bin/env python3
"""
Monta as páginas do site a partir dos pedaços em src/.

  python3 scripts/montar.py

Por que existe: cabeçalho, rodapé e <head> ficam em UM lugar só. Sem isso,
trocar o telefone significaria editar cinco arquivos e esquecer um.

  src/_header.html      cabeçalho + menu mobile
  src/_footer.html      rodapé + botão flutuante
  src/_secoes/*.html    cada seção da página
  src/_revisoes.json    tabela de revisões do Thales (vira a página revisoes.html,
                        o resumo da home, o schema e o bloco do llms.txt)
  PAGINAS (abaixo)      qual página tem quais seções

Rodar de novo é seguro: as páginas na raiz são sempre reescritas do zero.
"""
import html, json, pathlib, re, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SRC  = RAIZ / 'src'
BASE = 'https://www.tiradentesmoto.com.br/'

# ─────────────────────────────────────────────────────────────────────────
# Menu: 4 itens, todos ÂNCORAS da home. A v2 voltou para página única porque
# a navegação entre cinco arquivos não era fluida (cada clique recarregava a
# página e perdia o lugar). O que é consulta longa — tabela de intervalos,
# original × alternativa, óleo — ficou em dois GUIAS, ligados a partir da seção
# correspondente: conteúdo de referência, que segura busca e IA sem pesar a home.
#
#   (âncora, rótulo, guia que acende este item)
# Exceção: Revisões é PÁGINA, não âncora — é o carro-chefe da loja e o catálogo
# (10 grupos de moto × 3 revisões) não cabe na home. Alvo terminado em .html
# vira link direto, e DESTAQUE pinta o item de vermelho no menu.
MENU = [
    ('servicos',      'Serviços',  'servicos.html'),
    ('revisoes.html', 'Revisões',  'revisoes.html'),
    ('oficina',       'A oficina', None),
    ('pecas',         'Peças',     'pecas.html'),
    ('contato',       'Contato',   None),
]
DESTAQUE = {'revisoes.html'}

PAGINAS = {
 'index.html': {
   'titulo': 'Tiradentes Moto Peças — oficina de moto e loja de peças em Contagem/MG',
   'desc': 'Oficina de moto e loja de peças no mesmo balcão, no Bairro Industrial, em '
           'Contagem/MG. Preço e prazo antes de encostar na moto. WhatsApp (31) 98324-7256.',
   'secoes': ['hero', 'fatos', 'faixa', 'chamada-revisoes', 'servicos', 'oficina', 'galeria', 'pecas',
              'porque', 'banda', 'duvidas', 'contato', 'cta'],
   'schema': ['negocio', 'faq'],
 },
 'servicos.html': {
   'titulo': 'Guia de manutenção da moto — Tiradentes Moto Peças, Contagem/MG',
   'desc': 'O que entra numa revisão, a tabela de intervalos de manutenção, os sinais '
           'de que a moto pede oficina e o que perguntamos na entrada.',
   'h1': 'Guia de manutenção',
   'h1sub': 'O que entra numa revisão, quando trocar cada item e os sinais de que a moto pede oficina.',
   'secoes': ['revisao', 'intervalos', 'sinais', 'na-entrada', 'cta'],
   'schema': [],
 },
 'revisoes.html': {
   'titulo': 'Revisão de moto com preço por modelo — Tiradentes Moto Peças, Contagem/MG',
   'desc': 'Revisão Preventiva, Intermediária e Premium Tiradentes, com o preço da mão de obra '
           'para cada moto: CG, Bros, Fazer, Twister, XRE, Lander, Ninja, MT-03, PCX e mais. '
           'Escolha no site e agende pelo WhatsApp.',
   'h1': 'Revisão Tiradentes',
   'h1sub': 'Escolha a sua moto e veja o que entra em cada revisão, com o preço da mão de obra. '
            'Agendamento direto no WhatsApp.',
   'secoes': ['catalogo-revisoes', 'revisao-como', 'cta'],
   'schema': ['negocio', 'revisoes'],
 },
 'pecas.html': {
   'titulo': 'Guia de peças de moto: original, alternativa e óleo — Tiradentes Moto Peças',
   'desc': 'Diferença entre peça genuína, original e alternativa, qual óleo usar na sua moto '
           'e o que ter em mãos para comprar a peça certa no balcão.',
   'h1': 'Guia de peças',
   'h1sub': 'Genuína, original ou alternativa, qual óleo usar e como comprar a peça certa de primeira.',
   'secoes': ['original-alternativa', 'oleo', 'como-comprar', 'cta'],
   'schema': [],
 },
}
# ─────────────────────────────────────────────────────────────────────────


def ler(p):
    return (SRC / p).read_text()


def ancora(atual, id_):
    """Na home, o link só rola a página; nos guias, volta para a home já na seção."""
    if id_.endswith('.html'):
        return id_
    return f'#{id_}' if atual == 'index.html' else f'index.html#{id_}'


def menu_html(atual, mobile=False):
    linhas = []
    for id_, rotulo, guia in MENU:
        href = ancora(atual, id_)
        ativo = ' is-active' if guia == atual else ''
        aria = ' aria-current="page"' if guia == atual else ''
        if mobile:
            dest = ' mobile-nav__link--destaque' if id_ in DESTAQUE else ''
            linhas.append(f'  <a class="mobile-nav__link{dest}{ativo}" href="{href}"{aria}>{rotulo}</a>')
        else:
            dest = ' nav__link--destaque' if id_ in DESTAQUE else ''
            linhas.append(f'      <a class="nav__link{dest}{ativo}" href="{href}"{aria}>{rotulo}</a>')
    return '\n'.join(linhas)


def cabecalho(atual):
    h = ler('_header.html')
    h = re.sub(r'(<nav class="nav"[^>]*>\n).*?(\n    </nav>)',
               lambda m: m.group(1) + menu_html(atual) + m.group(2), h, flags=re.S)
    h = re.sub(r'(<nav class="mobile-nav"[^>]*>\n).*?(\n  <a class="btn btn--primary)',
               lambda m: m.group(1) + menu_html(atual, mobile=True) + m.group(2), h, flags=re.S)
    return h


def rodape(atual):
    r = ler('_footer.html')
    itens = [f'          <li><a href="{ancora(atual, i)}">{r}</a></li>' for i, r, _ in MENU]
    itens += ['          <li><a href="servicos.html">Guia de manutenção</a></li>',
              '          <li><a href="pecas.html">Guia de peças</a></li>']
    itens = '\n'.join(itens)
    r = re.sub(r'(<h4>Navegação</h4>\n\s*<ul class="footer__links">\n).*?(\n\s*</ul>)',
               lambda m: m.group(1) + itens + m.group(2), r, flags=re.S)
    return r


def schemas(quais):
    dados = json.loads((SRC / '_schema-negocio.json').read_text())
    out = []
    if 'negocio' in quais:
        out.append(json.dumps(dados, ensure_ascii=False, indent=2))
    if 'faq' in quais:
        out.append(json.dumps(json.loads((SRC / '_schema-faq.json').read_text()),
                              ensure_ascii=False, indent=2))
    if 'revisoes' in quais:
        out.append(json.dumps(schema_revisoes(), ensure_ascii=False, indent=2))
    return '\n'.join(f'<script type="application/ld+json">\n{b}\n</script>' for b in out)


# ─────────────────────────────────────────────────────────────────────────
# Revisões. Tudo sai de src/_revisoes.json: a página, o resumo "a partir de"
# da home, o schema de ofertas e o bloco do llms.txt. Preço mudou? Edita o JSON
# e roda de novo — os quatro lugares andam juntos, nenhum fica para trás.
# ─────────────────────────────────────────────────────────────────────────
CHECK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>')
RASTRO = '<span class="rastro" aria-hidden="true"><span></span><span></span><span></span></span>'
WA_ICONE = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-1.7-.9-2.9-1.6-4-3.5-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.6s-.7-1.6-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.7 5.9 5.2 2.2.9 3 1 4.1.8.7-.1 2.1-.8 2.4-1.7.3-.9.3-1.6.2-1.7-.1-.2-.3-.3-.6-.4Z"/>'
            '<path d="M12 2A10 10 0 0 0 3.5 17.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm0 18.1c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.1 8.1 0 1 1 12 20.1Z"/></svg>')


def revisoes():
    return json.loads((SRC / '_revisoes.json').read_text())


def reais(v, centavos=True):
    inteiro = f'{v:,}'.replace(',', '.')
    return f'R$ {inteiro},00' if centavos else f'R$ {inteiro}'


def msg_revisao(nivel, preco, moto):
    # O JS troca "moto" pelo modelo que o cliente escolheu. Sem JS, vai a lista
    # do grupo — o balcão sabe qual tabela é, e o cliente completa o modelo.
    return ('Olá! Vim pelo site e quero agendar uma revisão.\n'
            f'• Revisão: {nivel}\n'
            f'• Moto: {moto}\n'
            f'• Mão de obra: {reais(preco)}\n'
            'Qual o melhor dia para levar?')


def niveis_resumo():
    """Os três níveis com o menor preço de cada um — usado na chamada da home."""
    d = revisoes()
    linhas = []
    for n in d['niveis']:
        minimo = min(g[n['id']]['preco'] for g in d['grupos'])
        premium = n['id'] == 'premium'
        selo = '<span class="rev-nivel__selo">A mais completa</span>' if premium else ''
        linhas.append(
            f'        <li class="rev-nivel{" rev-nivel--premium" if premium else ""}">\n'
            f'          <span class="rev-nivel__txt"><strong>{n["nome"]}</strong>{selo}'
            f'<span>{n["resumo"]}</span></span>\n'
            f'          <span class="rev-nivel__preco"><small>a partir de</small>{reais(minimo, False)}</span>\n'
            f'        </li>')
    return '\n'.join(linhas)


def catalogo_revisoes():
    d = revisoes()
    niveis = d['niveis']

    # ── passo 1: escolher a moto ──
    cards = []
    for g in d['grupos']:
        minimo = g['preventiva']['preco']
        if g.get('foto'):
            foto = (f'<span class="moto-grupo__foto"><img src="assets/img/{g["foto"]}" alt="{html.escape(g["foto_alt"])}" '
                    f'loading="lazy" width="400" height="300"></span>')
        else:
            # sem foto real do modelo ainda: arte da marca no lugar, nunca foto de outra moto
            foto = (f'<span class="moto-grupo__foto moto-grupo__foto--arte" aria-hidden="true">{RASTRO}'
                    f'<b>{html.escape(g["modelos"][0])}</b></span>')
        cards.append(
            f'      <a class="moto-grupo" href="#grupo-{g["id"]}" data-grupo="{g["id"]}" '
            f'data-modelos="{html.escape("|".join(g["modelos"]))}">\n'
            f'        {foto}\n'
            f'        <span class="moto-grupo__txt">\n'
            f'          <strong class="moto-grupo__titulo">{html.escape(g["titulo"])}</strong>\n'
            f'          <span class="moto-grupo__modelos">{" · ".join(html.escape(m) for m in g["modelos"])}</span>\n'
            f'          <span class="moto-grupo__preco">a partir de <b>{reais(minimo, False)}</b></span>\n'
            f'        </span>\n'
            f'      </a>')

    # ── passo 2: as três revisões de cada grupo ──
    paineis = []
    for g in d['grupos']:
        moto = ' / '.join(g['modelos'])
        planos = []
        for i, n in enumerate(niveis):
            p = g[n['id']]
            premium = n['id'] == 'premium'
            base = (f'          <p class="rev-plano__base">Tudo da {niveis[i-1]["curto"]}, e mais:</p>\n'
                    if i else '          <p class="rev-plano__base">O que é feito:</p>\n')
            itens = '\n'.join(f'            <li>{CHECK}<span>{html.escape(t)}</span></li>' for t in p['itens'])
            planos.append(
                f'      <article class="rev-plano{" rev-plano--premium" if premium else ""}" data-nivel="{n["id"]}" '
                f'data-curto="{html.escape(n["curto"])}" data-resumo="{html.escape(n["resumo"])}" data-valor="{reais(p["preco"])}">\n'
                f'        <span class="rev-plano__foto"><img src="assets/img/{n["foto"]}" alt="{html.escape(n["foto_alt"])}" '
                f'loading="lazy" width="400" height="220"></span>\n'
                f'        <div class="rev-plano__corpo">\n'
                + ('          <span class="rev-plano__selo">A mais completa</span>\n' if premium else '') +
                f'          <h4 class="rev-plano__nome">{n["nome"]}</h4>\n'
                f'          <p class="rev-plano__preco">{reais(p["preco"], False)}<small>,00</small></p>\n'
                f'          <p class="rev-plano__mo">mão de obra · peças à parte</p>\n'
                f'          <a class="btn btn--primary btn--block" data-wa data-revisao="{n["nome"]}" '
                f'data-preco="{reais(p["preco"])}" data-wa-msg="{html.escape(msg_revisao(n["curto"], p["preco"], moto))}" '
                f'href="index.html#contato">{WA_ICONE} Agendar esta revisão</a>\n'
                f'{base}'
                f'          <ul class="rev-plano__itens">\n{itens}\n          </ul>\n'
                f'        </div>\n'
                f'      </article>')
        paineis.append(
            f'    <div class="rev-grupo" id="grupo-{g["id"]}" data-grupo="{g["id"]}">\n'
            f'      <div class="rev-grupo__topo">\n'
            f'        <div>\n'
            f'          <h3 class="rev-grupo__titulo">Revisões para <span data-moto-escolhida>{html.escape(g["titulo"])}</span></h3>\n'
            f'          <p class="rev-grupo__modelos">{" · ".join(html.escape(m) for m in g["modelos"])}</p>\n'
            f'        </div>\n'
            f'        <a class="rev-grupo__trocar" href="#escolha">Trocar a moto</a>\n'
            f'      </div>\n'
            f'      <div class="rev-planos">\n' + '\n'.join(planos) + '\n      </div>\n'
            f'    </div>')

    nao_achou = 'Olá! Vim pelo site e quero agendar uma revisão. Minha moto é: '
    return f"""<!-- ══════════════════════════ CATÁLOGO DE REVISÕES ══════════════════════════
     GERADO por scripts/montar.py a partir de src/_revisoes.json — não editar no
     revisoes.html. Sem JS, todos os grupos aparecem um embaixo do outro e cada
     cartão de moto é âncora para o seu grupo; com JS vira escolha em dois passos. -->
<section class="section section--muted" id="escolha">
  <div class="wrap">
    <div class="section-head">
      {RASTRO}
      <p class="passo" style="margin-top:1.25rem;">Revisão por modelo</p>
      <h2>Qual é a sua moto?</h2>
      <p class="lead">Digite o modelo ou toque no grupo dela: abre a revisão da sua moto, com o preço,
        o que entra em cada nível e a data para agendar.</p>
    </div>

    <div class="moto-busca" data-busca hidden>
      <label class="sr-only" for="busca-moto">Modelo da sua moto</label>
      <div class="moto-busca__campo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="busca-moto" type="search" placeholder="Ex.: CG 160, Bros, PCX, MT-03" autocomplete="off" enterkeyhint="search">
      </div>
      <div class="moto-busca__resultados" id="busca-resultados" aria-live="polite"></div>
    </div>

    <div class="moto-grupos">
{chr(10).join(cards)}
    </div>

    <p class="nota">Não achou a sua moto na lista?
      <a class="link-inline" data-wa data-wa-msg="{html.escape(nao_achou)}" href="index.html#contato">Manda o modelo no WhatsApp</a>
      que a gente diz qual revisão serve.</p>
  </div>
</section>

<!-- Com JS esta seção some e a escolha acontece na janela (#rev-modal), que lê
     os dados daqui mesmo. Sem JS, é a tabela completa, grupo por grupo. -->
<section class="section section--dark textura" id="revisoes">
  <div class="wrap">
    <div class="section-head">
      {RASTRO}
      <h2 style="margin-top:1.25rem;">As revisões de cada moto</h2>
      <p class="lead">Cada nível inclui tudo do anterior. O valor é da <strong>mão de obra</strong>;
        as peças que precisarem de troca são cobradas à parte.</p>
    </div>

{chr(10).join(paineis)}
  </div>
</section>

<dialog class="rev-modal" id="rev-modal" aria-labelledby="rev-modal-titulo">
  <div class="rev-modal__caixa">
    <header class="rev-modal__topo">
      <div>
        <p class="passo">Agendar revisão</p>
        <h2 class="rev-modal__titulo" id="rev-modal-titulo"></h2>
      </div>
      <button class="rev-modal__fechar" type="button" aria-label="Fechar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </header>

    <div class="rev-modal__corpo">
      <div class="rev-modal__escolha">
        <fieldset class="rev-opcoes">
          <legend class="rev-modal__rotulo">1. Escolha a revisão</legend>
          <div class="rev-opcoes__lista" data-opcoes></div>
        </fieldset>

        <div class="rev-campos">
          <p class="rev-modal__rotulo">2. Sua moto e a data</p>
          <div class="rev-campos__linha">
            <div class="rev-campo">
              <label for="rev-modelo">Modelo</label>
              <select id="rev-modelo" data-modelo></select>
              <input id="rev-outro" type="text" data-outro hidden placeholder="Qual é o modelo?" autocomplete="off"
                     aria-label="Modelo da moto, se não estiver na lista">
              <small class="rev-campo__nota" data-outro-nota hidden>Fora da lista o preço pode mudar; a loja confirma.</small>
            </div>
            <div class="rev-campo">
              <label for="rev-data">Data da revisão</label>
              <input id="rev-data" type="date" data-data>
              <small class="rev-campo__nota">Pode mudar conforme a disponibilidade da loja.</small>
            </div>
          </div>
          <p class="rev-campos__erro" data-erro role="alert"></p>
          <p class="rev-campos__aviso">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            <span>Tempo médio na oficina: <strong>de 1 a 2 dias</strong>. Seg a sex 8h–18h · sáb 8h–13h.</span>
          </p>
        </div>
      </div>

      <div class="rev-inclui">
        <p class="rev-modal__rotulo" data-inclui-titulo></p>
        <p class="rev-plano__base" data-inclui-base></p>
        <ul class="rev-plano__itens" data-inclui-itens></ul>
      </div>
    </div>

    <footer class="rev-modal__rodape">
      <div class="rev-modal__resumo">
        <span data-resumo-nome></span>
        <strong data-resumo-valor></strong>
        <small>mão de obra · peças à parte</small>
      </div>
      <a class="btn btn--primary btn--lg" data-enviar href="index.html#contato" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/></svg>
        Agendar revisão
      </a>
    </footer>
  </div>
</dialog>
"""


def schema_revisoes():
    d = revisoes()
    ofertas = []
    for g in d['grupos']:
        for n in d['niveis']:
            p = g[n['id']]
            ofertas.append({
                '@type': 'Offer',
                'name': f'{n["nome"]} — {", ".join(g["modelos"])}',
                'price': f'{p["preco"]:.2f}',
                'priceCurrency': 'BRL',
                'description': 'Preço da mão de obra; peças cobradas à parte.',
                'itemOffered': {'@type': 'Service', 'name': n['nome']},
            })
    return {
        '@context': 'https://schema.org',
        '@type': 'OfferCatalog',
        'name': 'Revisões de moto — Tiradentes Moto Peças',
        'url': BASE + 'revisoes.html',
        'itemListElement': ofertas,
    }


def llms_revisoes():
    d = revisoes()
    linhas = ['Tabela de revisões publicada em https://www.tiradentesmoto.com.br/revisoes.html.',
              'Valores de **mão de obra**; as peças são cobradas à parte. Cada nível inclui tudo do anterior:',
              '']
    for n in d['niveis']:
        linhas.append(f'- **{n["nome"]}:** {n["resumo"]}')
    linhas.append('')
    linhas.append('| Motos | ' + ' | '.join(n['curto'] for n in d['niveis']) + ' |')
    linhas.append('|---|' + '---|' * len(d['niveis']))
    for g in d['grupos']:
        linhas.append(f'| {", ".join(g["modelos"])} | '
                      + ' | '.join(reais(g[n["id"]]["preco"]) for n in d['niveis']) + ' |')
    linhas.append('')
    return '\n'.join(linhas)


GERADAS = {'catalogo-revisoes': catalogo_revisoes}


def secao(nome):
    if nome in GERADAS:
        return GERADAS[nome]()
    return ler(f'_secoes/{nome}.html')


def montar():
    faltando = [(a, s) for a, c in PAGINAS.items() for s in c['secoes']
                if s not in GERADAS and not (SRC / '_secoes' / f'{s}.html').exists()]
    if faltando:
        print('Seção declarada em PAGINAS que não existe em src/_secoes/:')
        for a, s in faltando:
            print(f'  {a}  ->  {s}.html')
        print('\nArquivos disponíveis:',
              ', '.join(sorted(p.stem for p in (SRC / '_secoes').glob('*.html'))))
        return 1

    gabarito = ler('_layout.html')
    for arquivo, cfg in PAGINAS.items():
        url = BASE + ('' if arquivo == 'index.html' else arquivo)
        corpo = '\n'.join(secao(s) for s in cfg['secoes'])
        corpo = corpo.replace('{{REV_NIVEIS}}', niveis_resumo())
        # Toda página precisa de exatamente um <h1>. Na home ele vive no hero;
        # nas internas, este cabeçalho é quem o carrega.
        if 'h1' in cfg:
            corpo = (f'<section class="pagina-topo textura">\n'
                     f'  <div class="wrap">\n'
                     f'    <span class="rastro" aria-hidden="true"><span></span><span></span><span></span></span>\n'
                     f'    <h1>{cfg["h1"]}</h1>\n'
                     f'    <p class="lead">{cfg["h1sub"]}</p>\n'
                     f'  </div>\n'
                     f'</section>\n\n') + corpo
        pagina = gabarito
        if arquivo != 'index.html':   # só a home tem a capa com vídeo
            pagina = re.sub(r'<link rel="preload" as="image" href="assets/img/capa-poster[^>]*>\n', '', pagina)
        html = (pagina
                .replace('{{TITULO}}', cfg['titulo'])
                .replace('{{DESC}}', cfg['desc'])
                .replace('{{URL}}', url)
                .replace('{{SCHEMA}}', schemas(cfg['schema']))
                .replace('{{HEADER}}', cabecalho(arquivo))
                .replace('{{CORPO}}', corpo)
                .replace('{{FOOTER}}', rodape(arquivo)))
        (RAIZ / arquivo).write_text(html)
        print(f'  {arquivo:16} {len(cfg["secoes"])} seções, {len(html)//1024} KB')

    # sitemap sempre em sincronia com PAGINAS
    urls = '\n'.join(
        f'  <url>\n    <loc>{BASE + ("" if a == "index.html" else a)}</loc>\n'
        f'    <lastmod>2026-09-11</lastmod>\n    <changefreq>monthly</changefreq>\n'
        f'    <priority>{"1.0" if a == "index.html" else "0.8"}</priority>\n  </url>'
        for a in PAGINAS)
    (RAIZ / 'sitemap.xml').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'{urls}\n</urlset>\n')
    print(f'  sitemap.xml      {len(PAGINAS)} URLs')

    llms = RAIZ / 'llms.txt'
    texto = llms.read_text()
    novo = re.sub(r'(<!-- revisoes:inicio -->\n).*?(<!-- revisoes:fim -->)',
                  lambda m: m.group(1) + llms_revisoes() + m.group(2), texto, flags=re.S)
    if '<!-- revisoes:inicio -->' in texto:
        llms.write_text(novo)
        print('  llms.txt         tabela de revisões atualizada')
    else:
        print('  llms.txt         AVISO: sem os marcadores <!-- revisoes:inicio/fim -->, tabela não entrou')
    return 0


if __name__ == '__main__':
    sys.exit(montar())
