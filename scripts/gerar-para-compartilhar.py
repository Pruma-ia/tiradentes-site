#!/usr/bin/env python3
"""
Gera um HTML único e autossuficiente do site — CSS, JS e todas as fotos
embutidas no próprio arquivo. Serve para mandar por e-mail/WhatsApp ou publicar
como link de revisão. Abre offline, sem servidor.

  python3 scripts/gerar-para-compartilhar.py
"""
import base64, mimetypes, pathlib, re, sys

RAIZ  = pathlib.Path(__file__).resolve().parent.parent
HTML  = RAIZ / 'index.html'
SAIDA = RAIZ / 'tiradentes-revisao.html'

def data_uri(rel: str) -> str:
    p = RAIZ / rel
    if not p.is_file():
        print(f'  ! não achei {rel}'); return rel
    mime = mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,{base64.b64encode(p.read_bytes()).decode()}'

s = HTML.read_text()

# ── CSS e JS para dentro ──────────────────────────────────────────────────
css = (RAIZ / 'assets/css/style.css').read_text()
js  = (RAIZ / 'assets/js/main.js').read_text()
s = s.replace('<link rel="stylesheet" href="assets/css/style.css">', f'<style>\n{css}\n</style>')
s = s.replace('<script src="assets/js/main.js" defer></script>', f'<script>\n{js}\n</script>')

# ── imagens para data: URI ────────────────────────────────────────────────
usadas = sorted(set(re.findall(r'(?:src|href)="(assets/img/[^"]+)"', s)))
for rel in usadas:
    s = s.replace(f'"{rel}"', f'"{data_uri(rel)}"')
    print(f'  embutido: {rel}')

# ── o iframe do mapa é bloqueado fora do servidor: vira cartão ────────────
cartao = '''<div class="map-frame" style="display:flex;align-items:center;justify-content:center;
     background:var(--c-ink-800);border-color:rgba(255,255,255,.12);padding:var(--s-6);text-align:center;">
  <div>
    <svg viewBox="0 0 24 24" fill="none" stroke="#E02826" stroke-width="1.8" stroke-linecap="round"
         stroke-linejoin="round" width="40" height="40" aria-hidden="true" style="margin:0 auto var(--s-4);">
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
    <p style="color:#FFFFFF;font-family:var(--f-display);font-weight:700;font-size:1.0625rem;margin-bottom:6px;">
      Rua Tiradentes, 2980</p>
    <p style="color:var(--c-ink-300);font-size:.9375rem;margin:0;">Bairro Industrial · Contagem/MG</p>
    <p style="color:var(--c-ink-400);font-size:.8125rem;margin-top:var(--s-4);">
      O mapa interativo funciona no site publicado.</p>
  </div>
</div>'''
s, n = re.subn(r'<div class="map-frame">.*?</div>\n', cartao + '\n', s, flags=re.S)
print(f'  mapa -> cartão estático ({n})')

# ── nota de revisão para o time, no fim e visualmente separada ────────────
NOTA = '''
<aside style="background:#111113;border-top:4px solid #E02826;padding:40px 24px;
       font-family:'Rubik',system-ui,sans-serif;color:#D4D4D8;">
  <div style="max-width:760px;margin:0 auto;">
    <p style="font-family:'Outfit',system-ui,sans-serif;font-weight:700;letter-spacing:.12em;
       text-transform:uppercase;font-size:.75rem;color:#E02826;margin:0 0 14px;">
      Nota para o time — não faz parte do site</p>
    <h2 style="font-family:'Outfit',system-ui,sans-serif;color:#fff;font-size:1.5rem;margin:0 0 18px;">
      O que já sabemos que falta</h2>
    <ul style="margin:0;padding:0;list-style:none;display:grid;gap:12px;font-size:.9375rem;line-height:1.6;">
      <li><strong style="color:#fff;">Foto da fachada.</strong> Não existe em nenhum post do
        Instagram. É o que mais falta para o site parecer da loja.</li>
      <li><strong style="color:#fff;">Vídeo.</strong> O perfil tem reels, mas o Instagram bloqueia
        o arquivo sem login. Se o Thales mandar 1 ou 2, entram na galeria.</li>
      <li><strong style="color:#fff;">Garantia e formas de pagamento.</strong> Estão no ar com texto
        genérico, esperando a informação real da oficina.</li>
      <li><strong style="color:#fff;">Preço.</strong> Nenhum preço foi publicado de propósito — a
        tabela que temos é pesquisa de mercado, não a tabela da Tiradentes.</li>
      <li><strong style="color:#fff;">Horário de sábado.</strong> O Instagram diz 8h–13h (é o que
        está no site). Confirmar com o Thales.</li>
      <li><strong style="color:#fff;">Fotos em 640px.</strong> É o máximo que o Instagram entrega.
        Fotos tiradas direto no celular deixariam tudo mais nítido.</li>
    </ul>
    <p style="margin:22px 0 0;font-size:.875rem;color:#A1A1AA;">
      Este arquivo é uma cópia para revisão, de 09/09/2026. O mapa interativo e o
      link do WhatsApp funcionam normalmente no site publicado.</p>
  </div>
</aside>
'''
s = s.replace('<a class="wa-float"', NOTA + '\n<a class="wa-float"')

SAIDA.write_text(s)
kb = SAIDA.stat().st_size // 1024
print(f'\n{SAIDA.name} — {kb} KB ({kb/1024:.1f} MB)')
