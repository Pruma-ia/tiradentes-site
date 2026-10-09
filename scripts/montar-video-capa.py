#!/usr/bin/env python3
"""
Monta o vídeo de fundo da capa a partir do material bruto do Thales.

  python3 scripts/montar-video-capa.py

Lê de assets/incoming/thales-v2/ (não versionado) e grava:

  assets/video/capa-desktop.mp4   1280x720, para tela larga
  assets/video/capa-mobile.mp4    540x960,  para celular (o material é vertical)
  assets/img/capa-poster-*.jpg    primeiro quadro, mostrado enquanto o vídeo carrega

Por que duas versões: os vídeos vieram gravados em pé, com 464 px de largura.
No celular eles entram inteiros; no computador só cabe uma faixa horizontal
deles. As fotos têm resolução de sobra, então seguram a nitidez na versão larga.

Sem som, sem texto gravado na imagem — o título fica no HTML, por cima.
"""
import pathlib, subprocess, tempfile

RAIZ = pathlib.Path(__file__).resolve().parent.parent
BRUTO = RAIZ / 'assets' / 'incoming' / 'thales-v2'
FPS = 30
FADE = 0.45

# (arquivo, tipo, início, duração, posição vertical do recorte 0..1, zoom/pan)
# posição = onde fica a faixa horizontal no quadro em pé (só vale no desktop).
CENAS = [
    ('img13.mp4',  'video', 4.0,  3.4, 0.42, None),        # tanque da Lander, latas de óleo ao fundo
    ('img7.jpeg',  'foto',  0,    3.0, 0.40, 'zoom'),      # mecânico na suspensão
    ('img16.mp4',  'video', 3.0,  3.4, 0.40, None),        # tanque e motor da CG
    ('img17.mp4',  'video', 0.0,  0.9, 0.50, 'lento'),     # mão apertando o garfo
    ('img8.jpeg',  'foto',  0,    3.0, 0.38, 'pan'),       # mecânico na bancada
    ('img13.mp4',  'video', 15.5, 3.8, 0.38, None),        # farol da Lander acendendo
    ('img6.jpeg',  'foto',  0,    3.0, 0.45, 'zoom'),      # Ninja no elevador
    ('img3.jpeg',  'foto',  0,    3.0, 0.55, 'pan'),       # CB 300F na loja
    ('img13.mp4',  'video', 26.6, 2.8, 0.35, None),        # logo LANDER
]

FORMATOS = {
    'desktop': (1280, 720),
    'mobile':  (540, 960),
}


def run(cmd):
    subprocess.run(cmd, check=True)


def cena(origem, tipo, ini, dur, pos, mov, w, h, saida):
    """Normaliza uma cena: mesmo tamanho, mesma taxa de quadros, sem som."""
    larga = w > h
    # recorte na proporção de saída: no desktop uma faixa horizontal na altura `pos`
    if larga:
        recorte = f"crop=iw:iw*{h}/{w}:0:(ih-iw*{h}/{w})*{pos}"
    else:
        recorte = f"crop='min(iw,ih*{w}/{h})':'min(ih,iw*{h}/{w})'"
    if tipo == 'video':
        lento = ',setpts=1.35*PTS' if mov == 'lento' else ''
        vf = f"{recorte},scale={w}:{h}:flags=lanczos,fps={FPS}{lento},setsar=1,format=yuv420p"
        dur_saida = dur * (1.35 if mov == 'lento' else 1)
        run(['ffmpeg', '-v', 'error', '-y', '-ss', str(ini), '-t', str(dur), '-i', str(origem),
             '-an', '-vf', vf, '-t', str(dur_saida), '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', str(saida)])
        return dur_saida
    # foto: movimento lento de câmera (zoom ou deslize), a partir de uma versão 2x maior
    quadros = int(dur * FPS)
    if mov == 'zoom':
        zp = f"zoompan=z='1+0.07*on/{quadros}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={quadros}:s={w}x{h}:fps={FPS}"
    else:
        zp = f"zoompan=z=1.08:x='(iw-iw/zoom)*on/{quadros}':y='ih/2-ih/zoom/2':d={quadros}:s={w}x{h}:fps={FPS}"
    vf = f"{recorte},scale={w*2}:{h*2}:flags=lanczos,{zp},setsar=1,format=yuv420p"
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(origem), '-vf', vf, '-frames:v', str(quadros),
         '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', str(saida)])
    return dur


def montar(nome, w, h):
    with tempfile.TemporaryDirectory() as tmp:
        partes, duracoes = [], []
        for i, (arq, tipo, ini, dur, pos, mov) in enumerate(CENAS):
            p = pathlib.Path(tmp) / f'c{i}.mp4'
            duracoes.append(cena(BRUTO / arq, tipo, ini, dur, pos, mov, w, h, p))
            partes.append(p)

        # encadeia com transição de fade entre as cenas
        filtro, atual, t = [], '[0:v]', duracoes[0]
        for i in range(1, len(partes)):
            rot = f'[v{i}]'
            filtro.append(f"{atual}[{i}:v]xfade=transition=fade:duration={FADE}:offset={t - FADE:.3f}{rot}")
            atual, t = rot, t + duracoes[i] - FADE
        # leve escurecida e menos saturação: o vídeo é fundo, o título é o protagonista
        filtro.append(f"{atual}eq=saturation=0.85:contrast=1.05,format=yuv420p[out]")

        entradas = sum((['-i', str(p)] for p in partes), [])
        destino = RAIZ / 'assets' / 'video' / f'capa-{nome}.mp4'
        run(['ffmpeg', '-v', 'error', '-y', *entradas, '-filter_complex', ';'.join(filtro),
             '-map', '[out]', '-c:v', 'libx264', '-crf', '28' if nome == 'desktop' else '27',
             '-preset', 'slow', '-movflags', '+faststart', '-an', str(destino)])
        run(['ffmpeg', '-v', 'error', '-y', '-i', str(destino), '-frames:v', '1', '-q:v', '4',
             str(RAIZ / 'assets' / 'img' / f'capa-poster-{nome}.jpg')])
        print(f'  {destino.name:20} {t:.1f}s  {destino.stat().st_size // 1024} KB')


if __name__ == '__main__':
    for nome, (w, h) in FORMATOS.items():
        montar(nome, w, h)
