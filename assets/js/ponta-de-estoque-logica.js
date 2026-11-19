/* ============================================================================
   Catálogo de ponta de estoque — as regras, sem tela.
   Separado de ponta-de-estoque.js para ser testado em Node (`node --test tests/ponta-de-estoque.test.mjs`):
   preço "por", busca, limite de quantidade, validação e a mensagem do pedido.
   No navegador vira `window.CatalogoLogica`; no Node, `module.exports`.
   Spec: pruma-plataform, .planning/workstreams/tiradentes/SPEC-2026-11-19-catalogo-lojistas.md
   ========================================================================== */
(function (raiz) {
  'use strict';

  var FUSO = 'America/Sao_Paulo';
  var MAX_ITENS = 60;   // o fluxo do n8n recusa acima disso

  /* Texto comparável: sem acento, minúsculo, espaços simples. */
  function normalizar(texto) {
    return String(texto == null ? '' : texto)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /* A lista como a página usa: só peça com código, nome e quantidade inteira
     maior que zero, em ordem alfabética do nome. A página não acrescenta nem
     escolhe peça — quem decide o que entra é a lista (critério 11). */
  function prepararLista(dados) {
    var cruas = dados && Array.isArray(dados.pecas) ? dados.pecas : null;
    if (!cruas) return null;
    var pecas = [];
    cruas.forEach(function (p) {
      if (!p || typeof p.codigo !== 'string' || typeof p.nome !== 'string') return;
      var codigo = p.codigo.trim(), nome = p.nome.trim();
      var quantidade = Number(p.quantidade);
      if (!codigo || !nome || !Number.isInteger(quantidade) || quantidade <= 0) return;
      var preco = Number(p.preco);
      pecas.push({
        codigo: codigo,
        nome: nome,
        quantidade: quantidade,
        preco: preco > 0 ? preco : null,
        busca: normalizar(nome + ' ' + codigo)
      });
    });
    pecas.sort(function (a, b) {
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) || a.codigo.localeCompare(b.codigo);
    });
    return { lista: dados.lista || '', atualizadaEm: dados.atualizada_em || '', pecas: pecas };
  }

  /* Cada palavra digitada tem de estar no nome ou no código ("pastilha cg 160"). */
  function filtrar(pecas, busca) {
    var palavras = normalizar(busca).split(' ').filter(Boolean);
    if (!palavras.length) return pecas;
    return pecas.filter(function (p) {
      return palavras.every(function (w) { return p.busca.indexOf(w) !== -1; });
    });
  }

  /* Preço "por": o desconto sobre o preço do sistema, em centavos, arredondado
     ao centavo mais próximo. A conta é em centavos inteiros: 17.85 * 0.5 em
     ponto flutuante dá 8.924999…, que arredondaria para 8,92. */
  function precoPor(preco, desconto) {
    if (!(preco > 0)) return null;
    var centavos = Math.round(preco * 100);
    return Math.round(centavos * (1 - desconto)) / 100;
  }

  function reais(valor) {
    var partes = valor.toFixed(2).split('.');
    return 'R$ ' + partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + partes[1];
  }

  function limitarQuantidade(quantidade, disponivel) {
    var q = Math.floor(Number(quantidade));
    if (!(q >= 1)) q = 1;
    return Math.min(q, disponivel);
  }

  function paginar(itens, pagina, porPagina) {
    var paginas = Math.max(1, Math.ceil(itens.length / porPagina));
    var atual = Math.min(Math.max(1, pagina), paginas);
    var inicio = (atual - 1) * porPagina;
    return {
      itens: itens.slice(inicio, inicio + porPagina),
      pagina: atual,
      paginas: paginas,
      de: itens.length ? inicio + 1 : 0,
      ate: Math.min(inicio + porPagina, itens.length),
      total: itens.length
    };
  }

  /* Telefone só com dígitos, sem o 55 do país: 10 (fixo) ou 11 (celular). */
  function digitosDoTelefone(telefone) {
    var d = String(telefone || '').replace(/\D/g, '');
    if ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0) d = d.slice(2);
    return d;
  }

  function telefoneLegivel(telefone) {
    var d = digitosDoTelefone(telefone);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return String(telefone || '').trim();
  }

  function validarContato(contato) {
    var erros = {};
    if (!String(contato.nome || '').trim()) erros.nome = 'Escreva seu nome.';
    var tel = digitosDoTelefone(contato.telefone);
    if (tel.length !== 10 && tel.length !== 11) erros.telefone = 'Telefone com DDD: 10 ou 11 números.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contato.email || '').trim())) erros.email = 'Confira o e-mail.';
    return erros;
  }

  /* Os itens escolhidos, com o preço "por" de cada um e as contas do pedido.
     Peça sem preço entra como "a combinar" e fica fora do total. */
  function resumir(escolhidos, desconto) {
    var itens = escolhidos.map(function (e) {
      return {
        codigo: e.peca.codigo,
        nome: e.peca.nome,
        quantidade: e.quantidade,
        disponivel: e.peca.quantidade,
        preco_por: precoPor(e.peca.preco, desconto)
      };
    });
    var total = 0, unidades = 0, semPreco = 0;
    itens.forEach(function (i) {
      unidades += i.quantidade;
      if (i.preco_por == null) semPreco += 1;
      else total += Math.round(i.preco_por * 100) * i.quantidade;
    });
    return { itens: itens, pecas: itens.length, unidades: unidades, semPreco: semPreco, total: total / 100 };
  }

  /* "19/11", no dia de Brasília (o navegador pode estar em outro fuso). */
  function diaDaLista(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO }).format(d);
  }

  function horaDeBrasilia(agora) {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO }).format(agora);
  }

  /* O que vai ao fluxo do n8n. O fluxo confere de novo o que importa
     (campos, tamanho); a página só monta. */
  function corpoDoPedido(resumo, contato, lista) {
    return {
      nome: String(contato.nome).trim(),
      telefone: digitosDoTelefone(contato.telefone),
      email: String(contato.email).trim(),
      lista_atualizada_em: lista.atualizadaEm,
      itens: resumo.itens.slice(0, MAX_ITENS).map(function (i) {
        return { codigo: i.codigo, nome: i.nome, quantidade: i.quantidade, preco_por: i.preco_por };
      })
    };
  }

  /* A mensagem da reserva: o mesmo pedido, escrito pelo lojista para a loja,
     quando o envio ao grupo falha (critério 8). */
  function textoDoPedido(resumo, contato, lista) {
    var linhas = ['Olá! Quero estas peças da ponta de estoque' + (lista.atualizadaEm ? ' (lista de ' + diaDaLista(lista.atualizadaEm) + ')' : '') + ':', ''];
    resumo.itens.forEach(function (i) {
      linhas.push('• ' + i.codigo + ' · ' + i.nome + ' · ' + i.quantidade + ' un. · ' +
        (i.preco_por == null ? 'preço a combinar' : reais(i.preco_por) + ' cada'));
    });
    linhas.push('');
    linhas.push('Total: ' + reais(resumo.total) + (resumo.semPreco ? ' + ' + resumo.semPreco + ' peça(s) com preço a combinar' : ''));
    linhas.push('');
    linhas.push('Nome: ' + String(contato.nome || '').trim());
    linhas.push('Telefone: ' + telefoneLegivel(contato.telefone));
    linhas.push('E-mail: ' + String(contato.email || '').trim());
    return linhas.join('\n');
  }

  function linkWhatsApp(numero, texto) {
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto);
  }

  var api = {
    MAX_ITENS: MAX_ITENS,
    normalizar: normalizar,
    prepararLista: prepararLista,
    filtrar: filtrar,
    precoPor: precoPor,
    reais: reais,
    limitarQuantidade: limitarQuantidade,
    paginar: paginar,
    digitosDoTelefone: digitosDoTelefone,
    telefoneLegivel: telefoneLegivel,
    validarContato: validarContato,
    resumir: resumir,
    diaDaLista: diaDaLista,
    horaDeBrasilia: horaDeBrasilia,
    corpoDoPedido: corpoDoPedido,
    textoDoPedido: textoDoPedido,
    linkWhatsApp: linkWhatsApp
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.CatalogoLogica = api;
})(this);
