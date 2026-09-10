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

## Confirmar com o Thales

Horário de sábado: **Instagram diz 08h–13h** (é o que está no site); a base da
POC dizia 08h–12h. A base foi montada sem dado do cliente, então o Instagram
venceu — mas vale confirmar.
