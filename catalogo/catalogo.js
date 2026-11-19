/* ============================================================================
   Catálogo de ponta de estoque — a tela.
   As regras (preço, busca, validação, mensagem) moram em logica.js; aqui só se
   desenha e se reage ao clique. Todo texto da lista entra por textContent.
   ========================================================================== */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────────
     CONFIGURAÇÃO
     ───────────────────────────────────────────────────────────────────────── */
  var CONFIG = {
    // Endereço da lista do dia (JSON, formato na spec). Fica FORA deste repo,
    // que é público. Vazio = página mostra "fora do ar".
    // [pendente: central, com a entrega do estoque]
    lista: '',
    // Fluxo do n8n que posta o pedido no grupo de vendas da loja.
    pedido: 'https://n8n.pruma.io/webhook/tiradentes-catalogo-pedido',
    // Reserva quando o envio falha: o WhatsApp do site (assets/js/main.js).
    whatsapp: '5531983247256',
    // Desconto sobre o preço do sistema. O título lê daqui também.
    desconto: 0.5,
    porPagina: 20
  };

  // Só na máquina de quem testa: ?lista=…&pedido=… apontam para dado inventado e
  // para o n8n de laboratório. No ar, ninguém troca a lista nem o destino por link.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    var q = new URLSearchParams(location.search);
    if (q.get('lista')) CONFIG.lista = q.get('lista');
    if (q.get('pedido')) CONFIG.pedido = q.get('pedido');
  }

  var L = window.CatalogoLogica;
  var $ = function (id) { return document.getElementById(id); };

  var estado = {
    lista: null,        // { lista, atualizadaEm, pecas }
    busca: '',
    pagina: 1,
    escolha: {},        // código → quantidade
    ordem: [],          // códigos na ordem em que foram escolhidos
    enviando: false
  };

  /* ── montagem de elemento ──────────────────────────────────────────────── */
  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function botao(texto, classe, rotulo, aoClicar) {
    var b = el('button', classe, texto);
    b.type = 'button';
    if (rotulo) b.setAttribute('aria-label', rotulo);
    b.addEventListener('click', aoClicar);
    return b;
  }

  function pecaPorCodigo(codigo) {
    var p = estado.lista && estado.lista.pecas;
    for (var i = 0; p && i < p.length; i++) if (p[i].codigo === codigo) return p[i];
    return null;
  }

  function escolhidos() {
    return estado.ordem.map(function (c) { return { peca: pecaPorCodigo(c), quantidade: estado.escolha[c] }; })
      .filter(function (e) { return e.peca; });
  }

  function resumo() { return L.resumir(escolhidos(), CONFIG.desconto); }

  /* ── escolha ───────────────────────────────────────────────────────────── */
  function definir(codigo, quantidade) {
    var peca = pecaPorCodigo(codigo);
    if (!peca) return;
    if (quantidade <= 0) {
      delete estado.escolha[codigo];
      estado.ordem = estado.ordem.filter(function (c) { return c !== codigo; });
    } else {
      if (!(codigo in estado.escolha)) estado.ordem.push(codigo);
      estado.escolha[codigo] = L.limitarQuantidade(quantidade, peca.quantidade);
    }
    desenhar();
  }

  /* − / quantidade / +, com o limite à vista. O "−" na quantidade 1 não tira a
     peça: tirar é o "Remover" (no resumo) ou o "−" da lista, que mostra a lixeira. */
  function seletor(peca, naLista) {
    var q = estado.escolha[peca.codigo];
    var caixa = el('div', 'cat-qtd');
    var menos = botao(naLista && q === 1 ? '×' : '−', 'cat-qtd-b', naLista && q === 1 ? 'Tirar ' + peca.nome : 'Diminuir', function () {
      definir(peca.codigo, q - 1);
    });
    if (!naLista && q === 1) menos.disabled = true;
    var mais = botao('+', 'cat-qtd-b cat-qtd-b--mais', 'Aumentar', function () { definir(peca.codigo, q + 1); });
    if (q >= peca.quantidade) mais.disabled = true;
    caixa.appendChild(menos);
    caixa.appendChild(el('span', 'cat-qtd-n', String(q)));
    caixa.appendChild(mais);
    return caixa;
  }

  function preco(peca, classe) {
    var caixa = el('div', classe || 'cat-preco');
    var por = L.precoPor(peca.preco, CONFIG.desconto);
    if (por == null) {
      caixa.appendChild(el('span', 'cat-preco-combinar', 'preço no WhatsApp'));
      return caixa;
    }
    caixa.appendChild(el('s', 'cat-preco-de', 'de ' + L.reais(peca.preco)));
    caixa.appendChild(el('strong', 'cat-preco-por', 'por ' + L.reais(por)));
    return caixa;
  }

  /* ── lista ─────────────────────────────────────────────────────────────── */
  function linha(peca) {
    var li = el('li', 'cat-linha');
    if (estado.escolha[peca.codigo]) li.classList.add('is-escolhida');
    li.appendChild(el('span', 'cat-linha-nome', peca.nome));
    var meta = el('span', 'cat-linha-meta');
    meta.appendChild(el('span', 'cat-linha-codigo', peca.codigo));
    meta.appendChild(el('span', 'cat-linha-disp', 'disponível: ' + peca.quantidade));
    li.appendChild(meta);
    li.appendChild(preco(peca));
    var acao = el('div', 'cat-linha-acao');
    if (estado.escolha[peca.codigo]) acao.appendChild(seletor(peca, true));
    else {
      var add = botao('Adicionar', 'cat-btn cat-btn--contorno', 'Adicionar ' + peca.nome, function () { definir(peca.codigo, 1); });
      // O pedido vai até 60 peças diferentes (o fluxo recusa acima): passou disso, outro pedido.
      if (estado.ordem.length >= L.MAX_ITENS) { add.disabled = true; add.title = 'No máximo ' + L.MAX_ITENS + ' peças por pedido'; }
      acao.appendChild(add);
    }
    li.appendChild(acao);
    return li;
  }

  function mostrarEstado(titulo, texto, comWhats) {
    var caixa = $('estado');
    caixa.textContent = '';
    caixa.appendChild(el('h2', null, titulo));
    caixa.appendChild(el('p', null, texto));
    if (comWhats) {
      var a = el('a', 'cat-btn cat-btn--escuro', 'Chamar a loja no WhatsApp');
      a.href = L.linkWhatsApp(CONFIG.whatsapp, 'Olá! Vim pelo catálogo de ponta de estoque e quero saber das peças.');
      a.target = '_blank';
      a.rel = 'noopener';
      caixa.appendChild(a);
    } else {
      caixa.appendChild(botao('Limpar busca', 'cat-btn cat-btn--contorno', null, function () { $('busca').value = ''; aoBuscar(); }));
    }
    caixa.hidden = false;
  }

  function desenharLista() {
    var ul = $('lista');
    ul.textContent = '';
    $('estado').hidden = true;
    $('paginas').hidden = true;
    if (!estado.lista) return;

    var todas = estado.lista.pecas;
    if (!todas.length) {
      $('contagem').textContent = '';
      mostrarEstado('Nenhuma peça na ponta de estoque agora', 'A loja ainda não publicou uma lista nova. Pergunte pelo WhatsApp quando sai a próxima.', true);
      return;
    }
    var achadas = L.filtrar(todas, estado.busca);
    if (!achadas.length) {
      $('contagem').textContent = '';
      mostrarEstado('Nenhuma peça com “' + estado.busca.trim() + '”', 'Confira a escrita ou busque só por parte do nome ou pelo código.', false);
      return;
    }
    var p = L.paginar(achadas, estado.pagina, CONFIG.porPagina);
    estado.pagina = p.pagina;
    $('contagem').textContent = estado.busca.trim()
      ? achadas.length + (achadas.length === 1 ? ' peça' : ' peças') + ' com “' + estado.busca.trim() + '” · de ' + todas.length + ' na lista'
      : todas.length + ' peças na lista';
    p.itens.forEach(function (peca) { ul.appendChild(linha(peca)); });
    if (p.paginas > 1) {
      $('faixa').textContent = p.de + '–' + p.ate + ' de ' + p.total;
      $('anterior').disabled = p.pagina === 1;
      $('proxima').disabled = p.pagina === p.paginas;
      $('paginas').hidden = false;
    }
  }

  /* ── pedido: painel (computador), barra (celular) e resumo ─────────────── */
  function textoDaConta(r) {
    return r.pecas + (r.pecas === 1 ? ' peça' : ' peças') + ' · ' + r.unidades + ' un.';
  }

  function desenharItens(ul, r, comRemover) {
    ul.textContent = '';
    r.itens.forEach(function (i) {
      var peca = pecaPorCodigo(i.codigo);
      var li = el('li', 'cat-item');
      var info = el('div', 'cat-item-info');
      info.appendChild(el('span', 'cat-item-nome', i.nome));
      info.appendChild(el('small', null, i.codigo + ' · ' + (i.preco_por == null ? 'preço a combinar' : L.reais(i.preco_por) + ' cada') + ' · máx. ' + i.disponivel));
      li.appendChild(info);
      var linhaQtd = el('div', 'cat-item-qtd');
      linhaQtd.appendChild(seletor(peca, false));
      if (comRemover) linhaQtd.appendChild(botao('Remover', 'cat-remover', 'Remover ' + i.nome, function () { definir(i.codigo, 0); }));
      linhaQtd.appendChild(el('b', 'cat-item-valor', i.preco_por == null ? 'a combinar' : L.reais(i.preco_por * i.quantidade)));
      li.appendChild(linhaQtd);
      ul.appendChild(li);
    });
  }

  function desenharTotal(caixa, r) {
    caixa.textContent = '';
    var linhaT = el('div', 'cat-total-linha');
    linhaT.appendChild(el('span', null, 'Total · ' + textoDaConta(r)));
    linhaT.appendChild(el('strong', null, L.reais(r.total)));
    caixa.appendChild(linhaT);
    if (r.semPreco) caixa.appendChild(el('small', null, '+ ' + r.semPreco + (r.semPreco === 1 ? ' peça' : ' peças') + ' com preço a combinar'));
  }

  function desenharPedido() {
    var r = resumo();
    var tem = r.pecas > 0;
    $('painel-vazio').hidden = tem;
    $('painel-total').hidden = !tem;
    $('painel-confirmar').hidden = !tem;
    desenharItens($('painel-itens'), r, true);
    if (tem) desenharTotal($('painel-total'), r);

    $('barra').hidden = !tem || !$('vista-resumo').hidden || !$('vista-enviado').hidden;
    var conta = $('barra-conta');
    conta.textContent = '';
    conta.appendChild(el('b', null, textoDaConta(r)));
    conta.appendChild(el('span', null, L.reais(r.total)));

    desenharItens($('resumo-itens'), r, true);
    desenharTotal($('resumo-total'), r);
    if (!tem && !$('vista-resumo').hidden) ver('lista');
  }

  function desenhar() {
    desenharLista();
    desenharPedido();
  }

  /* ── etapas ────────────────────────────────────────────────────────────── */
  function ver(qual) {
    $('vista-lista').hidden = qual !== 'lista';
    $('vista-resumo').hidden = qual !== 'resumo';
    $('vista-enviado').hidden = qual !== 'enviado';
    desenharPedido();
    window.scrollTo(0, 0);
  }

  function contato() {
    return { nome: $('nome').value, telefone: $('telefone').value, email: $('email').value };
  }

  function mostrarErros(erros) {
    ['nome', 'telefone', 'email'].forEach(function (campo) {
      var p = $('erro-' + campo);
      p.textContent = erros[campo] || '';
      p.hidden = !erros[campo];
      $(campo).setAttribute('aria-invalid', erros[campo] ? 'true' : 'false');
    });
    var primeiro = ['nome', 'telefone', 'email'].filter(function (c) { return erros[c]; })[0];
    if (primeiro) $(primeiro).focus();
    return !primeiro;
  }

  function falhou() {
    var r = resumo();
    var a = $('whats-reserva');
    a.href = L.linkWhatsApp(CONFIG.whatsapp, L.textoDoPedido(r, contato(), estado.lista));
    a.hidden = false;
    $('falha').hidden = false;
    $('enviar').textContent = 'Tentar enviar de novo';
    $('enviar').className = 'cat-btn cat-btn--contorno cat-btn--cheio';
    $('falha').scrollIntoView({ block: 'start' });
  }

  function enviar(evento) {
    evento.preventDefault();
    if (estado.enviando) return;
    if (!mostrarErros(L.validarContato(contato()))) return;
    var r = resumo();
    if (!r.pecas) return ver('lista');

    estado.enviando = true;
    var b = $('enviar');
    b.disabled = true;
    b.textContent = 'Enviando…';
    ['nome', 'telefone', 'email'].forEach(function (c) { $(c).disabled = true; });

    // Formulário simples (sem cabeçalho próprio): o navegador não faz a pré-consulta
    // de CORS, que o webhook do n8n não responde.
    var corpo = new URLSearchParams();
    corpo.set('pedido', JSON.stringify(L.corpoDoPedido(r, contato(), estado.lista)));
    corpo.set('contato_url_2', $('contato_url_2').value);

    fetch(CONFIG.pedido, { method: 'POST', body: corpo })
      .then(function (resp) { return resp.ok; }, function () { return false; })
      .then(function (ok) {
        // Só o envio decide entre "enviado" e "falhou": erro ao desenhar depois do 200 não pode
        // oferecer o WhatsApp, senão o lojista manda o mesmo pedido duas vezes.
        if (!ok) return falhou();
        var c = contato();
        $('enviado-detalhe').textContent = textoDaConta(r) + ' · ' + L.reais(r.total) +
          ' · enviado às ' + L.horaDeBrasilia(new Date()) + '. Em nome de ' + c.nome.trim() + ', ' + L.telefoneLegivel(c.telefone) + '.';
        estado.escolha = {};
        estado.ordem = [];
        $('falha').hidden = true;
        $('whats-reserva').hidden = true;
        b.className = 'cat-btn cat-btn--principal cat-btn--cheio';
        ver('enviado');
      })
      .then(function () {
        estado.enviando = false;
        b.disabled = false;
        if (b.textContent === 'Enviando…') b.textContent = 'Enviar pedido';
        ['nome', 'telefone', 'email'].forEach(function (c) { $(c).disabled = false; });
      });
  }

  /* ── busca e páginas ───────────────────────────────────────────────────── */
  var espera;
  function aoBuscar() {
    clearTimeout(espera);
    espera = setTimeout(function () {
      estado.busca = $('busca').value;
      estado.pagina = 1;
      $('limpar').hidden = !estado.busca;
      desenharLista();
    }, 120);
  }

  function irPara(pagina) {
    estado.pagina = pagina;
    desenharLista();
    $('busca').scrollIntoView({ block: 'start' });
  }

  /* ── carregar a lista ──────────────────────────────────────────────────── */
  function foraDoAr() {
    $('contagem').textContent = '';
    mostrarEstado('O catálogo está fora do ar agora', 'Não conseguimos carregar a lista. Fale com a loja pelo WhatsApp que ela te passa as peças.', true);
  }

  function carregar() {
    if (!CONFIG.lista) return foraDoAr();
    fetch(CONFIG.lista, { cache: 'no-cache' })
      .then(function (resp) { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
      .then(function (dados) {
        var lista = L.prepararLista(dados);
        if (!lista) throw new Error('lista fora do formato');
        estado.lista = lista;
        var dia = L.diaDaLista(lista.atualizadaEm);
        $('data-lista').textContent = (dia ? 'Lista de ' + dia + '. ' : '') + 'A loja confirma a disponibilidade.';
        $('busca').disabled = false;
        desenhar();
      })
      .catch(foraDoAr);
  }

  function iniciar() {
    var pct = Math.round(CONFIG.desconto * 100) + '%';
    Array.prototype.forEach.call(document.querySelectorAll('[data-desconto]'), function (s) { s.textContent = pct; });

    $('busca').addEventListener('input', aoBuscar);
    $('limpar').addEventListener('click', function () { $('busca').value = ''; aoBuscar(); $('busca').focus(); });
    $('anterior').addEventListener('click', function () { irPara(estado.pagina - 1); });
    $('proxima').addEventListener('click', function () { irPara(estado.pagina + 1); });
    $('painel-confirmar').addEventListener('click', function () { ver('resumo'); });
    $('barra-confirmar').addEventListener('click', function () { ver('resumo'); });
    $('voltar').addEventListener('click', function () { ver('lista'); desenharLista(); });
    $('outro').addEventListener('click', function () { ver('lista'); desenharLista(); });
    $('form').addEventListener('submit', enviar);
    carregar();
  }

  iniciar();
})();
