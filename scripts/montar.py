#!/usr/bin/env python3
"""
Monta as páginas do site a partir dos pedaços em src/.

  python3 scripts/montar.py

Por que existe: cabeçalho, rodapé e <head> ficam em UM lugar só. Sem isso,
trocar o telefone significaria editar cinco arquivos e esquecer um.

  src/_header.html      cabeçalho + menu mobile
  src/_footer.html      rodapé + botão flutuante
  src/_secoes/*.html    cada seção da página
  PAGINAS (abaixo)      qual página tem quais seções

Rodar de novo é seguro: as páginas na raiz são sempre reescritas do zero.
"""
import json, pathlib, re, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SRC  = RAIZ / 'src'
BASE = 'https://pruma-ia.github.io/tiradentes-site/'

# ─────────────────────────────────────────────────────────────────────────
# Menu: 4 itens, todos ÂNCORAS da home. A v2 voltou para página única porque
# a navegação entre cinco arquivos não era fluida (cada clique recarregava a
# página e perdia o lugar). O que é consulta longa — tabela de intervalos,
# original × alternativa, óleo — ficou em dois GUIAS, ligados a partir da seção
# correspondente: conteúdo de referência, que segura busca e IA sem pesar a home.
#
#   (âncora, rótulo, guia que acende este item)
MENU = [
    ('servicos', 'Serviços',  'servicos.html'),
    ('oficina',  'A oficina', None),
    ('pecas',    'Peças',     'pecas.html'),
    ('contato',  'Contato',   None),
]

PAGINAS = {
 'index.html': {
   'titulo': 'Tiradentes Moto Peças — oficina de moto e loja de peças em Contagem/MG',
   'desc': 'Oficina de moto e loja de peças no mesmo balcão, no Bairro Industrial, em '
           'Contagem/MG. Preço e prazo antes de encostar na moto. WhatsApp (31) 98324-7256.',
   'secoes': ['hero', 'fatos', 'faixa', 'servicos', 'oficina', 'galeria', 'pecas',
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
    return f'#{id_}' if atual == 'index.html' else f'index.html#{id_}'


def menu_html(atual, mobile=False):
    linhas = []
    for id_, rotulo, guia in MENU:
        href = ancora(atual, id_)
        ativo = ' is-active' if guia == atual else ''
        aria = ' aria-current="page"' if guia == atual else ''
        if mobile:
            linhas.append(f'  <a class="mobile-nav__link{ativo}" href="{href}"{aria}>{rotulo}</a>')
        else:
            linhas.append(f'      <a class="nav__link{ativo}" href="{href}"{aria}>{rotulo}</a>')
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
    return '\n'.join(f'<script type="application/ld+json">\n{b}\n</script>' for b in out)


def montar():
    faltando = [(a, s) for a, c in PAGINAS.items() for s in c['secoes']
                if not (SRC / '_secoes' / f'{s}.html').exists()]
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
        corpo = '\n'.join(ler(f'_secoes/{s}.html') for s in cfg['secoes'])
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
    return 0


if __name__ == '__main__':
    sys.exit(montar())
