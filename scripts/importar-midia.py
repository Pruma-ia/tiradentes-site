#!/usr/bin/env python3
"""
Importa a mídia do Instagram para dentro do site.

USO
  1. Jogue TUDO que você baixou (fotos e vídeos, qualquer nome, qualquer tamanho)
     dentro de  assets/incoming/
  2. Rode:  python3 scripts/importar-midia.py
  3. Recarregue http://localhost:4173

O script escolhe, redimensiona, renomeia e liga cada arquivo no HTML sozinho.
Não precisa renomear nada à mão. Rodar de novo é seguro — ele refaz do zero.

Regras de escolha:
  - o arquivo mais LARGO (paisagem) vira o fundo do hero
  - vídeos vão para os espaços 2 e 5 da galeria
  - fotos paisagem vão para os espaços largos (1 e 6)
  - fotos quadradas/retrato vão para os espaços 3 e 4
"""
import pathlib, re, shutil, subprocess, sys

RAIZ     = pathlib.Path(__file__).resolve().parent.parent
ENTRADA  = RAIZ / 'assets' / 'incoming'
IMG      = RAIZ / 'assets' / 'img'
VID      = RAIZ / 'assets' / 'video'
HTML     = RAIZ / 'index.html'

EXT_IMG = {'.jpg', '.jpeg', '.png', '.heic', '.webp'}
EXT_VID = {'.mp4', '.mov', '.m4v', '.webm'}


def dimensoes(p: pathlib.Path):
    """Largura e altura via sips (nativo do macOS)."""
    try:
        out = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(p)],
                             capture_output=True, text=True, timeout=30).stdout
        w = int(re.search(r'pixelWidth:\s*(\d+)', out).group(1))
        h = int(re.search(r'pixelHeight:\s*(\d+)', out).group(1))
        return w, h
    except Exception:
        return None, None


def converter(origem: pathlib.Path, destino: pathlib.Path, largura: int):
    """Redimensiona pela maior borda e grava como JPEG de qualidade alta."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        ['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82',
         '--resampleWidth', str(largura), str(origem), '--out', str(destino)],
        capture_output=True, text=True)
    if r.returncode != 0:
        print(f'  ! falhou em {origem.name}: {r.stderr.strip().splitlines()[-1:]}')
        return False
    return True


def main():
    if not ENTRADA.exists() or not any(ENTRADA.iterdir()):
        print(f'Nada em {ENTRADA.relative_to(RAIZ)}/ — jogue os arquivos lá e rode de novo.')
        return 1

    arquivos = [p for p in sorted(ENTRADA.iterdir())
                if p.is_file() and not p.name.startswith('.')]
    fotos, videos = [], []

    for p in arquivos:
        ext = p.suffix.lower()
        if ext in EXT_VID:
            videos.append(p)
        elif ext in EXT_IMG:
            w, h = dimensoes(p)
            if w:
                fotos.append((p, w, h, w / h))
            else:
                print(f'  ? ignorado (não li dimensão): {p.name}')

    print(f'Encontrei {len(fotos)} foto(s) e {len(videos)} vídeo(s).\n')
    if not fotos and not videos:
        print('Nenhum formato reconhecido. Aceito: ' + ', '.join(sorted(EXT_IMG | EXT_VID)))
        return 1

    # paisagem primeiro, da mais larga para a menos larga
    paisagem = sorted([f for f in fotos if f[3] >= 1.25], key=lambda x: -x[3])
    outras   = [f for f in fotos if f[3] < 1.25]

    plano = {}          # destino -> origem
    usadas = set()

    # hero: a mais larga de todas
    if paisagem:
        p = paisagem.pop(0)
        plano['HERO'] = p[0]; usadas.add(p[0])

    # galeria: 1 e 6 largos; 3 e 4 quadrados; 2 e 5 vídeo
    largos    = paisagem
    quadradas = outras
    fila_larga = largos + quadradas          # se faltar paisagem, usa o que tiver
    fila_quad  = quadradas + largos

    def pega(fila):
        while fila:
            c = fila.pop(0)
            if c[0] not in usadas:
                usadas.add(c[0]); return c[0]
        return None

    plano['G1'] = pega(fila_larga)
    plano['G6'] = pega(fila_larga)
    plano['G3'] = pega(fila_quad)
    plano['G4'] = pega(fila_quad)
    plano['G2'] = videos[0] if len(videos) > 0 else None
    plano['G5'] = videos[1] if len(videos) > 1 else None

    # ── grava os arquivos ────────────────────────────────────────────────
    IMG.mkdir(parents=True, exist_ok=True); VID.mkdir(parents=True, exist_ok=True)
    tamanhos = {'HERO': 1920, 'G1': 1200, 'G6': 1200, 'G3': 800, 'G4': 800}
    saidas = {}

    for chave, origem in plano.items():
        if origem is None:
            continue
        if chave in ('G2', 'G5'):
            destino = VID / f'galeria-{chave[1]}{origem.suffix.lower()}'
            shutil.copy2(origem, destino)
            saidas[chave] = f'assets/video/{destino.name}'
            print(f'  {chave}: {origem.name}  ->  {destino.name}  (vídeo, copiado)')
        else:
            nome = 'hero.jpg' if chave == 'HERO' else f'galeria-{chave[1]}.jpg'
            destino = IMG / nome
            if converter(origem, destino, tamanhos[chave]):
                saidas[chave] = f'assets/img/{nome}'
                print(f'  {chave}: {origem.name}  ->  {nome}  ({tamanhos[chave]}px)')

    # ── liga no HTML ─────────────────────────────────────────────────────
    # Backup antes de tocar no arquivo: rodar isto duas vezes com mídia
    # diferente não pode custar o HTML original.
    backup = HTML.with_suffix('.html.bak')
    if not backup.exists():
        shutil.copy2(HTML, backup)
        print(f'\n  backup: {backup.name} (só na primeira vez)')

    s = HTML.read_text()

    if 'HERO' in saidas:
        grafico = re.compile(r'  <div class="hero__media hero__media--graphic".*?  </div>\n', re.S)
        foto = (f'  <div class="hero__media">\n'
                f'    <img src="{saidas["HERO"]}" alt="" loading="eager" fetchpriority="high"\n'
                f'         width="1920" height="1080">\n'
                f'  </div>\n')
        if grafico.search(s):
            s = grafico.sub(foto, s)
            print('\n  hero: grafismo trocado pela foto')

    ordem = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']
    blocos = re.findall(r'<figure class="gallery__item[^"]*">.*?</figure>', s, re.S)
    for i, bloco in enumerate(blocos):
        if i >= len(ordem):
            break
        chave = ordem[i]
        if chave not in saidas:
            continue
        src = saidas[chave]
        if src.endswith(('.mp4', '.mov', '.m4v', '.webm')):
            midia = (f'<video src="{src}" muted loop playsinline autoplay '
                     f'preload="metadata"></video>')
        else:
            midia = f'<img src="{src}" alt="" loading="lazy" width="1200" height="600">'
        novo = re.sub(r'<div class="media-slot">.*?</div>', midia, bloco, flags=re.S)
        s = s.replace(bloco, novo)

    HTML.write_text(s)
    faltando = [k for k in ordem if k not in saidas]
    print(f'\nHTML atualizado. Espaços ainda vazios: {", ".join(faltando) if faltando else "nenhum"}')
    print('Recarregue http://localhost:4173')
    return 0


if __name__ == '__main__':
    sys.exit(main())
