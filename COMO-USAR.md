# Como abrir e como colocar a mídia

## Abrir o site

**http://localhost:4173** — já está rodando, é só colar no navegador.

Se o link não abrir (o servidor cai quando o computador reinicia), reabra assim:

```bash
cd ~/pruma_dev/tiradentes-site
python3 -m http.server 4173
```

E deixe essa janela do terminal aberta enquanto estiver olhando o site.

## Colocar as fotos e vídeos do Instagram

Você **não precisa renomear nem redimensionar nada**.

1. Baixe do Instagram o que fizer sentido — umas 6 peças resolvem
   (fachada, serviço no elevador, balcão de peças, equipe, um reel, uma moto pronta).
2. Jogue **todos os arquivos** dentro de `assets/incoming/`.
3. Rode:

```bash
cd ~/pruma_dev/tiradentes-site
python3 scripts/importar-midia.py
```

4. Recarregue http://localhost:4173

O script escolhe qual arquivo vai em cada lugar, redimensiona, renomeia e liga
tudo no site sozinho. Ele guarda um backup do HTML na primeira vez, então rodar
de novo com outra seleção é seguro.

### Como ele decide

| Espaço | O que recebe |
|---|---|
| Fundo do hero | a foto mais larga de todas |
| Galeria 1 e 6 (largos) | fotos em paisagem |
| Galeria 3 e 4 (quadrados) | fotos quadradas ou em pé |
| Galeria 2 e 5 | os vídeos |

Se sobrar espaço sem arquivo, ele continua mostrando a tarja listrada dizendo o
que falta — nada quebra.

## Trocar o logo

Salve o arquivo original por cima de `assets/img/logo-mark.svg`. Se for PNG,
salve como `assets/img/logo-mark.png` e troque a extensão nas 2 linhas com
`brand__mark` no `index.html`.
