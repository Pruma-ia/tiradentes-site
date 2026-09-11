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
# Menu: 4 itens. A regra da skill de UI é nav ≤ 5 — a versão de página única
# tinha 7 e foi o que motivou esta separação.
MENU = [
    ('servicos.html', 'Serviços'),
    ('pecas.html',    'Peças'),
    ('oficina.html',  'A oficina'),
    ('contato.html',  'Contato'),
]

PAGINAS = {
 'index.html': {
   'titulo': 'Tiradentes Moto Peças — oficina de moto e loja de peças em Contagem/MG',
   'desc': 'Oficina de moto e loja de peças no mesmo balcão, no Bairro Industrial, em '
           'Contagem/MG. Preço e prazo antes de encostar na moto. WhatsApp (31) 98324-7256.',
   'secoes': ['hero', 'fatos', 'frentes', 'porque', 'cta'],
   'schema': ['negocio'],
 },
 'servicos.html': {
   'titulo': 'Serviços e revisão de moto — Tiradentes Moto Peças, Contagem/MG',
   'desc': 'Revisão por checklist, óleo, relação, freios, suspensão, elétrica, pneus e '
           'válvulas. Tabela de intervalos de manutenção e os sinais de que a moto pede oficina.',
   'h1': 'Serviços e revisão',
   'h1sub': 'O que a oficina faz, e o que entra numa revisão programada.',
   'secoes': ['servicos', 'revisao', 'intervalos', 'sinais', 'cta'],
   'schema': [],
 },
 'pecas.html': {
   'titulo': 'Loja de peças de moto em Contagem/MG — Tiradentes Moto Peças',
   'desc': 'Peça de moto no balcão em Contagem/MG. Diferença entre genuína, original e '
           'paralela, qual óleo usar na sua moto e o que ter em mãos para comprar certo.',
   'h1': 'Loja de peças',
   'h1sub': 'Peça de moto no balcão, com a aplicação conferida antes da venda.',
   'secoes': ['pecas', 'original-paralela', 'oleo', 'como-comprar', 'cta'],
   'schema': [],
 },
 'oficina.html': {
   'titulo': 'A oficina — Tiradentes Moto Peças, Bairro Industrial, Contagem/MG',
   'desc': 'Oficina de moto para quem depende dela para trabalhar. Como funciona o '
           'atendimento, o que perguntamos na entrada e o serviço que sai daqui.',
   'h1': 'A oficina',
   'h1sub': 'Como a gente trabalha, e o serviço que sai daqui todo dia.',
   'secoes': ['oficina', 'na-entrada', 'galeria', 'cta'],
   'schema': [],
 },
 'contato.html': {
   'titulo': 'Contato, endereço e horário — Tiradentes Moto Peças, Contagem/MG',
   'desc': 'Rua Tiradentes, 2980 — Bairro Industrial, Contagem/MG. Seg a sex 8h–18h, '
           'sáb 8h–13h. WhatsApp (31) 98324-7256. Dúvidas frequentes respondidas.',
   'h1': 'Contato e dúvidas',
   'h1sub': 'Onde fica, que horas abre e as perguntas que a gente mais ouve.',
   'secoes': ['contato', 'duvidas', 'cta'],
   'schema': ['negocio', 'faq'],
 },
}
# ─────────────────────────────────────────────────────────────────────────


def ler(p):
    return (SRC / p).read_text()


def menu_html(atual, mobile=False):
    linhas = []
    for href, rotulo in MENU:
        ativo = ' is-active' if href == atual else ''
        aria = ' aria-current="page"' if href == atual else ''
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
    itens = '\n'.join(f'          <li><a href="{h}">{t}</a></li>' for h, t in MENU)
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
        html = (gabarito
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
