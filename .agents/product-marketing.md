# Tiradentes Moto Peças: contexto de marca para quem escreve

> **Provisório (05/11/2026).** A Tiradentes ainda não passou um tom de voz oficial à Pruma. Este
> arquivo foi montado a partir do texto que já está no site e no Instagram, e das decisões do
> Gabriel. Quando a loja ou a agência mandarem o guia delas, **ele substitui este**.
>
> Lido pelas skills `copywriting`, `copy-editing`, `content-strategy` e `ai-seo` (instaladas em
> `~/.claude/skills/`) antes de escrever qualquer texto deste site.

## Quem é

Oficina de motos e loja de peças no mesmo balcão: Rua Tiradentes, 2980, Bairro Industrial,
Contagem/MG. Seg a sex 8h–18h, sáb 8h–13h. WhatsApp (31) 98324-7256. Instagram @tiradentesmotopecas.
Quem cuida da oficina são os irmãos **Thales e Denis**.

## Para quem escreve

Quem usa a moto para trabalhar: entregador, motoboy, quem vai e volta do serviço de moto. Moto
de baixa cilindrada na maioria (CG, Biz, Pop, Bros, Factor, Fazer). Para essa pessoa, moto parada
é dia sem ganhar, e cada real conta. Lê no celular, com pressa.

## Como a marca fala

- **"A gente" e "você".** Nunca "a empresa", "nossos clientes", "o usuário".
- **Frase curta e direta**, com o fato na frente. Quem fala é o balcão: alguém que conhece moto e
  explica sem enrolar e sem esnobar.
- **Concreto.** Modelo de moto, quilometragem, litro, prazo. Nada de "qualidade", "excelência",
  "soluções".
- **Sem gíria forçada** e sem tom de vendedor. Nada de ponto de exclamação.
- Frases que já são da marca: "Moto parada é dia sem ganhar." "Preço e prazo antes de encostar na
  moto." "A oficina de quem trabalha em cima da moto."

## Palavras do cliente (usar as dele)

- "Titan 160", "Fan 160" e "CG 160" são a mesma moto: escrever **CG 160** e citar Fan/Titan/Start.
- "Óleo de bengala" (fluido da suspensão), "relação" (corrente, coroa e pinhão), "retificador"
  (regulador de voltagem).
- **Peça "alternativa", nunca "paralela"** (Thales, 09/10). Exceção do blog (Gabriel, 05/11): pode
  explicar **uma vez** por post que a alternativa é "conhecida como paralela", para quem busca assim.

## O que pode e o que não pode prometer

Pode (está no site ou foi liberado):
- Orçamento e prazo antes de mexer na moto; nada é feito sem o ok do cliente no valor.
- Peça original e alternativa; aplicação conferida por modelo, ano e versão.
- Tabela de revisões com preço de **mão de obra** (`revisoes.html`), peças à parte.
- Troca de óleo no mesmo dia, sem agendar (liberado pelo Gabriel em 05/11 para o blog).
- Tempo médio na oficina por nível de revisão: Preventiva 1 dia, Intermediária 2, Premium 2 a 3,
  com aviso antes se algo mudar o prazo (Denis, 12/11).
- Recomendação de troca de óleo da oficina: 1.500 km a ar (semissintético ou melhor), 2.500 km com
  radiador de óleo, até 5.000 km a líquido (100% sintético), filtro de papel/cartucho em toda troca
  (Denis, 12/11). Mais curta que o manual: escrever os dois, o manual como limite e a oficina como
  recomendação.

Não pode (sem prova ainda):
- Preço de peça ou de outro serviço. Estoque, faturamento, conversa do atendimento.
- "X anos de mercado", "mecânico certificado", avaliações do Google, prazo de garantia.
- Óleo a granel por litro e manutenção de moto elétrica: perguntar ao Thales antes.
- Qualquer dado ou exemplo de outro cliente da Pruma.

## Blog (`/blog/`)

- **Informar, não converter** (Gabriel, 05/11). A loja aparece uma vez, no fim, com discrição.
  Sem faixa de venda, sem urgência.
- Assinam **Thales e Denis**. A lista do que o Thales precisa aprovar fica no campo `conferir` do
  JSON de cada post e vai junto da versão para compartilhar.
- **Todo número técnico tem fonte** (manual do proprietário, tabela da loja, fabricante). O que não
  tiver fonte sai do texto ou vira pergunta para o Thales.
- Cada post traz algo que os primeiros resultados do Google não trazem: o cruzamento manual ×
  tabela, o caso real do balcão, a conta feita para quem roda 100 km por dia.

## Learnings

- 13/11: a oficina recomenda prazos mais curtos que os manuais. Post que só cita o manual contradiz
  quem assina. Antes de publicar número de manutenção, perguntar o que a oficina pratica.
- Respostas da loja ficam em `.agents/fontes/`, como vieram; são a fonte do que vai ao site.

- 05/11: primeira versão do post do óleo tinha "AI tells" (contraste armado, pergunta que o próprio
  texto responde, repetição de efeito). A agência de marketing da loja vai ler: cortar todos.
- 05/11, banca de 5 personas no post do óleo (6,6 → 7,6 → ~8,2 projetado):
  - Abrir pelo que a pessoa buscou (a tabela por moto), não pela explicação.
  - A mesma regra uma vez só no texto. A loja aparece uma vez, no fim.
  - Título de seção afirma algo ("O prazo de troca é o do manual"), não é rótulo ("Prazo").
  - Afirmação técnica sem número também precisa de fonte; sem fonte, ficar no que se vê
    ("na prateleira, o sintético é o mais caro").
  - Conferir cada prazo do FAQ contra a tabela: um prazo errado derruba a confiança no post todo.
  - O que mais subiria a nota é a voz do Thales: uma frase dele, citada com o nome. Placeholder não
    vai ao ar; o pedido fica no `conferir`.
