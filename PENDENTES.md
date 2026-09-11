# O que falta — v1

**Atualizado em 09/09/2026.**

## ✅ Feito

| Item | Como ficou |
|---|---|
| **Logo real** | extraído do post de 27/08 do Instagram (`ig-grade-02`), recortado e com fundo transparente. Está no cabeçalho, rodapé e favicon |
| **Paleta** | vermelho `#E02826` + preto `#0B0B0C`, tirados do próprio logo |
| **WhatsApp** | (31) 98324-7256 em todos os botões, com mensagem pré-preenchida |
| **Galeria** | 6 fotos reais da oficina, baixadas do perfil público |
| **Hero** | duas colunas, com foto do mecânico na oficina |

### As 6 fotos da galeria

| # | Foto | Origem |
|---|---|---|
| 1 | mecânico atendendo no elevador | `ig-grade-05` |
| 2 | balcão de peças com a placa da loja | `ig-grade-07` |
| 3 | XRE 300 após revisão geral | `ig-grade-12` |
| 4 | motor da XTZ aberto | `ig-grade-03` |
| 5 | Ninja verde na porta da oficina | `ig-grade-09` |
| 6 | moto vermelha com serviço concluído | `ig-grade-10` |

Os originais ficaram em `assets/incoming/` (11 arquivos). Para trocar a seleção,
edite a lista `ESCOLHA` e rode de novo — ou use `scripts/importar-midia.py`.

## ⚠️ Falta

### 1. Fotos em resolução maior — melhora, não bloqueia

O Instagram entrega no máximo **640px**. Na v2 isso deixou de ser problema
porque as fotos vivem em molduras de ~460px, não em fundo de tela inteira.

Ainda assim, foto tirada direto no celular do Thales (sem passar pelo Instagram,
que comprime) deixaria tudo mais nítido — principalmente **a fachada**, que não
existe em nenhuma foto do perfil.

### 2. Vídeo — não veio

O perfil tem 6 reels, mas o Instagram bloqueia o arquivo de vídeo sem login, e a
janela de login não pegou sessão. Se o Thales mandar 1 ou 2 vídeos direto, eles
entram na galeria pelo mesmo importador.

### 3. Dois textos ainda genéricos

`grep -n data-pendente index.html`

- **garantia** — prazo de garantia de mão de obra e de peça
- **pagamento** — formas de pagamento e parcelamento

## ❌ Fora de propósito

- **Preço.** A tabela da POC é pesquisa de mercado (27 confirmados, ~55 de
  snippet, resto estimativa sem fonte), não a tabela da Tiradentes.
- **Avaliações do Google** e **anos de mercado** — nada confirmado.

## ⚠️ Confirmar com o Thales — a copy virou promessa

A reescrita de 09/09 trocou descrição por **posicionamento e autoridade**. Isso
significa que o site agora **promete** coisas que o balcão vai ter que honrar.
Nenhuma credencial foi inventada (não há "X anos de mercado" nem "mecânico
certificado", porque não sabemos), mas estes quatro pontos precisam de um sim:

| Afirmação no site | De onde saiu | Precisa confirmar |
|---|---|---|
| "preço e prazo **antes de encostar na moto**" | política que já estava no site | a oficina consegue orçar antes em todo caso? |
| "prazo dito na entrada e **cumpre o que falou**" | mesma origem | é promessa forte; o Thales assina? |
| "Motul, Mobil e **Ipiranga**" | post do próprio Instagram (27/08) sobre tipos de óleo | são as marcas que ele realmente mantém? |
| "a loja e a oficina são o mesmo lugar, **com o mesmo responsável**" | bio do Instagram ("Peças • Manutenção • Oficina") | confere? |
| "peça **original e paralela**, original sob pedido" | base da POC do agente, montada **sem dado do cliente** | é a política real? |
| FAQ: "peça avulsa no balcão, instalada na hora" | derivado das afirmações acima | confere? |

⚠️ **O FAQ agora é resposta de IA.** As 7 perguntas viraram dado estruturado
(`FAQPage`) e entraram no `llms.txt`. Isso significa que ChatGPT, Perplexity e o
AI Overview do Google podem **citar essas respostas como fato** quando alguém
perguntar sobre a oficina. Uma resposta errada ali se propaga sozinha — por isso
todas precisam do aval do Thales antes de virar verdade na internet.

Se algum for não, é troca de uma frase — todos estão na seção
`#porque` e no hero.

## Confirmar com o Thales

Horário de sábado: **Instagram diz 08h–13h** (é o que está no site); a base da
POC dizia 08h–12h. A base foi montada sem dado do cliente, então o Instagram
venceu — mas vale confirmar.
