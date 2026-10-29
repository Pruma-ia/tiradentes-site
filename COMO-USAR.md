# Como mexer no site

## Ver o site

```bash
cd ~/pruma_dev/tiradentes-site
python3 -m http.server 4173      # http://localhost:4173
```

No ar: **https://www.tiradentesmoto.com.br/**

## ⚠️ O site é MONTADO — não edite os .html da raiz

`index.html` (a página única, com o menu rolando até cada parte),
`servicos.html` e `pecas.html` (os dois guias de consulta) e `revisoes.html`
(o catálogo de revisões) são **gerados**. Qualquer coisa escrita neles é perdida na próxima montagem.

Edite em `src/` e rode:

```bash
python3 scripts/montar.py
```

| Quero mudar | Edito |
|---|---|
| Cabeçalho, menu, logo | `src/_header.html` |
| Rodapé | `src/_footer.html` |
| Texto de uma seção | `src/_secoes/<nome>.html` |
| Título e descrição de uma página (SEO) | `PAGINAS`, no topo de `scripts/montar.py` |
| Quais seções cada página tem | `PAGINAS`, no mesmo lugar |
| Endereço, horário, telefone nos dados de busca | `src/_schema-negocio.json` |
| Perguntas frequentes | `src/_schema-faq.json` **e** `src/_secoes/duvidas.html` |
| Preço ou item de revisão, modelo de moto | `src/_revisoes.json` (gera a página Revisões, a faixa da home, o schema e o `llms.txt`) |
| WhatsApp e horário do selo "aberto agora" | `CONFIG`, no topo de `assets/js/main.js` |
| Cores e tipografia | bloco `:root` em `assets/css/style.css` |

O `montar.py` também reescreve o `sitemap.xml` sozinho.

## Publicar

```bash
git add -A && git commit -m "o que mudou" && git push
```

O GitHub Pages atualiza em 1 a 2 minutos.

## Vídeo da capa

Montado a partir do material bruto em `assets/incoming/thales-v2/`:

```bash
python3 scripts/montar-video-capa.py
```

As cenas (qual arquivo, de que segundo, por quanto tempo) ficam na lista
`CENAS`, no topo do script. Saem duas versões: larga para computador e em pé
para celular — o site escolhe sozinho.

## Colocar fotos e vídeos novos

1. Jogue os arquivos em `assets/incoming/` (sem renomear nem redimensionar).
2. `python3 scripts/importar-midia.py`
3. `python3 scripts/montar.py`

## Trocar o logo

```bash
python3 scripts/usar-logo.py ~/caminho/do/logo.png
python3 scripts/montar.py
```

## Gerar um arquivo para revisão

```bash
python3 scripts/gerar-para-compartilhar.py
```

Gera `tiradentes-revisao.html` com tudo embutido, abre offline.
⚠️ Ele empacota **só a home** — as outras páginas ficam de fora.
