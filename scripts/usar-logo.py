#!/usr/bin/env python3
"""
Coloca o logo real da Tiradentes no site.

USO
  python3 scripts/usar-logo.py ~/caminho/do/logo.png

Aceita png, jpg, jpeg, webp ou svg. Ele grava o arquivo no lugar certo,
gera o favicon e ajusta o index.html — cabeçalho, rodapé e aba do navegador.
"""
import pathlib, re, shutil, subprocess, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
IMG  = RAIZ / 'assets' / 'img'
HTML = RAIZ / 'index.html'
OK   = {'.png', '.jpg', '.jpeg', '.webp', '.svg'}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    origem = pathlib.Path(sys.argv[1]).expanduser()
    if not origem.is_file():
        print(f'Não achei o arquivo: {origem}')
        return 1
    ext = origem.suffix.lower()
    if ext not in OK:
        print(f'Formato {ext} não serve. Aceito: {", ".join(sorted(OK))}')
        return 1

    IMG.mkdir(parents=True, exist_ok=True)
    destino = IMG / f'logo-mark{ext}'

    # limpa versões anteriores para não sobrar logo velho servindo
    for antigo in IMG.glob('logo-mark.*'):
        if antigo != destino:
            antigo.unlink()

    if ext == '.svg':
        shutil.copy2(origem, destino)
    else:
        # 256px basta para cabeçalho (42px) e favicon, em telas retina
        r = subprocess.run(['sips', '-s', 'format', ext.lstrip('.').replace('jpg', 'jpeg'),
                            '--resampleHeightWidthMax', '256',
                            str(origem), '--out', str(destino)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            shutil.copy2(origem, destino)
        # favicon a partir do mesmo arquivo
        subprocess.run(['sips', '-s', 'format', 'png', '--resampleHeightWidthMax', '64',
                        str(origem), '--out', str(IMG / 'favicon.png')],
                       capture_output=True, text=True)

    s = HTML.read_text()
    novo_src = f'assets/img/{destino.name}'
    s, n = re.subn(r'(<img class="brand__mark" src=")[^"]*(")', rf'\1{novo_src}\2', s)

    if ext != '.svg' and (IMG / 'favicon.png').exists():
        s = s.replace('<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">',
                      '<link rel="icon" href="assets/img/favicon.png" type="image/png">')
    HTML.write_text(s)

    print(f'Logo instalado: {destino.relative_to(RAIZ)}')
    print(f'Trocado em {n} lugar(es) do HTML (cabeçalho e rodapé).')
    print('Recarregue http://localhost:4173')
    return 0


if __name__ == '__main__':
    sys.exit(main())
