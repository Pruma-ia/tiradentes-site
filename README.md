# Site — Tiradentes Moto Peças

Site institucional da **Tiradentes Moto Peças**, oficina de motos e loja de peças
na Rua Tiradentes, 2980 — Bairro Industrial, Contagem/MG.

🔗 **https://pruma-ia.github.io/tiradentes-site/**

Site estático: HTML, CSS e JavaScript, sem build e sem dependência. Publicar =
subir a pasta. O GitHub Pages serve direto da branch `main`.

## Rodar localmente

```bash
python3 -m http.server 4173      # http://localhost:4173
```

## Estrutura

```
index.html            página única, seções ancoradas
assets/css/style.css  tokens de design + componentes
assets/js/main.js     comportamento (CONFIG no topo: WhatsApp e horário)
assets/img/           logo e fotos
scripts/              utilitários (ver abaixo)
PENDENTES.md          o que falta de conteúdo  ← leia antes de mexer
```

## Onde editar o que muda

| O que | Onde |
|---|---|
| WhatsApp e horário de funcionamento | `CONFIG`, no topo de `assets/js/main.js` |
| Cores e tipografia | bloco `:root` em `assets/css/style.css` |
| Textos | `index.html` |

## Scripts

```bash
python3 scripts/importar-midia.py            # fotos/vídeos de assets/incoming/ para o site
python3 scripts/usar-logo.py <arquivo>       # troca o logo em todos os lugares
python3 scripts/gerar-para-compartilhar.py   # HTML único, tudo embutido, para revisão
node    scripts/baixar-instagram.mjs         # baixa a mídia pública do @tiradentesmotopecas
```

## Design

Direção gerada e verificada com a skill [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
(não versionada aqui; instale localmente se for mexer no visual).

| Decisão | Valor |
|---|---|
| Paleta | vermelho `#E02826` + preto `#0B0B0C`, extraídos do logo |
| Tipografia | Outfit (títulos) / Rubik (texto) |
| Estrutura | hero em duas colunas, blocos foto+texto alternando lado |

Duas regras que nasceram de erro real e valem manter:

- **Cada foto aparece uma vez só.** A primeira versão repetiu a mesma imagem do
  balcão em três lugares.
- **Vermelho tem dois tokens.** `--c-accent` (`#E02826`) para preenchimento e
  `--c-accent-ink` (`#C81E1E`) para texto sobre fundo claro — o tom de
  preenchimento como texto dava 4,43:1 e reprovava no contraste mínimo.

O conteúdo é visível sem JavaScript: a animação de entrada só esconde depois que
o próprio JS marca `<html class="js-anim">`.

---

Feito pela [Pruma IA](https://pruma.io).
