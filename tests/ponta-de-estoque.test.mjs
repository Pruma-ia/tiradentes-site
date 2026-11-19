// Provas P2–P5, P8 e P11 do SPEC-2026-11-19-catalogo-lojistas (pruma-plataform).
// Rodar: node --test tests/ponta-de-estoque.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const L = createRequire(import.meta.url)('../assets/js/ponta-de-estoque-logica.js');

const LISTA = {
  lista: 'teste',
  atualizada_em: '2026-11-19T03:00:00-03:00',
  pecas: [
    { codigo: 'LOC512', nome: 'Pastilha de freio dianteira CG 160 Titan/Fan', quantidade: 3, preco: 38 },
    { codigo: 'LOC300', nome: 'Câmara de ar traseira aro 18', quantidade: 2, preco: 17.85 },
    { codigo: 'LOC001', nome: 'Bobina de ignição CG 160', quantidade: 1, preco: 0 },
    { codigo: 'LOC999', nome: 'Amortecedor traseiro (vendido)', quantidade: 0, preco: 159 },
    { codigo: 'LOC998', nome: 'Peça com quantidade quebrada', quantidade: 1.5, preco: 10 },
    { codigo: '', nome: 'Sem código', quantidade: 1, preco: 10 },
  ],
};

test('lista mostra só o que veio com quantidade', () => {
  const l = L.prepararLista(LISTA);
  assert.deepEqual(l.pecas.map((p) => p.codigo), ['LOC001', 'LOC300', 'LOC512']);
  assert.equal(L.prepararLista({}), null);
});

test('busca ignora acento e maiúscula', () => {
  const { pecas } = L.prepararLista(LISTA);
  assert.deepEqual(L.filtrar(pecas, 'pastilha cg 160').map((p) => p.codigo), ['LOC512']);
  assert.deepEqual(L.filtrar(pecas, 'CAMARA').map((p) => p.codigo), ['LOC300']);
  assert.deepEqual(L.filtrar(pecas, 'ignicao').map((p) => p.codigo), ['LOC001']);
  assert.equal(L.filtrar(pecas, '').length, 3);
});

test('busca acha pelo código', () => {
  const { pecas } = L.prepararLista(LISTA);
  assert.deepEqual(L.filtrar(pecas, 'loc512').map((p) => p.codigo), ['LOC512']);
});

test('50% arredonda ao centavo', () => {
  assert.equal(L.precoPor(48.9, 0.5), 24.45);
  assert.equal(L.precoPor(17.85, 0.5), 8.93);
  assert.equal(L.reais(L.precoPor(48.9, 0.5)), 'R$ 24,45');
  assert.equal(L.reais(1234.5), 'R$ 1.234,50');
});

test('sem preço vira preço a combinar', () => {
  assert.equal(L.precoPor(0, 0.5), null);
  assert.equal(L.precoPor(null, 0.5), null);
  const { pecas } = L.prepararLista(LISTA);
  const bobina = pecas.find((p) => p.codigo === 'LOC001');
  const pastilha = pecas.find((p) => p.codigo === 'LOC512');
  const r = L.resumir([{ peca: bobina, quantidade: 1 }, { peca: pastilha, quantidade: 2 }], 0.5);
  assert.equal(r.total, 38);
  assert.equal(r.semPreco, 1);
  assert.equal(r.unidades, 3);
  assert.equal(r.pecas, 2);
});

test('quantidade entre 1 e o disponível', () => {
  assert.equal(L.limitarQuantidade(4, 3), 3);
  assert.equal(L.limitarQuantidade(0, 3), 1);
  assert.equal(L.limitarQuantidade(-2, 3), 1);
  assert.equal(L.limitarQuantidade('2', 3), 2);
  assert.equal(L.limitarQuantidade(2.7, 3), 2);
});

test('valida nome, telefone e e-mail', () => {
  assert.deepEqual(L.validarContato({ nome: 'Marcos', telefone: '(31) 9 9871-4420', email: 'm@loja.com.br' }), {});
  assert.deepEqual(L.validarContato({ nome: 'Marcos', telefone: '+55 31 3333-4444', email: 'm@loja.com' }), {});
  const e = L.validarContato({ nome: '  ', telefone: '98714420', email: 'm.loja.com' });
  assert.deepEqual(Object.keys(e).sort(), ['email', 'nome', 'telefone']);
});

test('link de WhatsApp leva o pedido', () => {
  const lista = L.prepararLista(LISTA);
  const pastilha = lista.pecas.find((p) => p.codigo === 'LOC512');
  const bobina = lista.pecas.find((p) => p.codigo === 'LOC001');
  const r = L.resumir([{ peca: pastilha, quantidade: 2 }, { peca: bobina, quantidade: 1 }], 0.5);
  const contato = { nome: 'Marcos', telefone: '(31) 99871-4420', email: 'm@loja.com.br' };
  const texto = L.textoDoPedido(r, contato, lista);
  assert.match(texto, /LOC512 · Pastilha de freio dianteira CG 160 Titan\/Fan · 2 un\. · R\$ 19,00 cada/);
  assert.match(texto, /LOC001 · Bobina de ignição CG 160 · 1 un\. · preço a combinar/);
  assert.match(texto, /Total: R\$ 38,00 \+ 1 peça\(s\) com preço a combinar/);
  assert.match(texto, /lista de 19\/11/);
  const link = L.linkWhatsApp('5531983247256', texto);
  assert.ok(link.startsWith('https://wa.me/5531983247256?text='));
  assert.equal(decodeURIComponent(link.split('?text=')[1]), texto);
});

test('corpo do pedido leva telefone só com dígitos e o preço por de cada item', () => {
  const lista = L.prepararLista(LISTA);
  const pastilha = lista.pecas.find((p) => p.codigo === 'LOC512');
  const r = L.resumir([{ peca: pastilha, quantidade: 2 }], 0.5);
  const corpo = L.corpoDoPedido(r, { nome: ' Marcos ', telefone: '(31) 99871-4420', email: 'm@loja.com.br' }, lista);
  assert.deepEqual(corpo, {
    nome: 'Marcos', telefone: '31998714420', email: 'm@loja.com.br',
    lista_atualizada_em: '2026-11-19T03:00:00-03:00',
    itens: [{ codigo: 'LOC512', nome: 'Pastilha de freio dianteira CG 160 Titan/Fan', quantidade: 2, preco_por: 19 }],
  });
});

test('dia da lista sai no fuso de Brasília', () => {
  // 02:30 UTC do dia 20 ainda é dia 19 em Brasília
  assert.equal(L.diaDaLista('2026-11-20T02:30:00Z'), '19/11');
});

test('paginação de 20', () => {
  const itens = Array.from({ length: 45 }, (_, i) => i);
  const p = L.paginar(itens, 3, 20);
  assert.deepEqual([p.de, p.ate, p.total, p.paginas, p.itens.length], [41, 45, 45, 3, 5]);
  assert.equal(L.paginar(itens, 9, 20).pagina, 3);
});
