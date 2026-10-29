/* ============================================================================
   Tiradentes Moto Peças — comportamento do site
   Sem dependência externa. Tudo degrada: se o JS falhar, o site continua legível.
   ========================================================================== */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────────
     CONFIGURAÇÃO — é o único lugar que precisa ser editado para publicar.
     ───────────────────────────────────────────────────────────────────────── */
  var CONFIG = {
    // (31) 98324-7256 — formato internacional, só dígitos.
    whatsapp: '5531983247256',
    mensagemPadrao: 'Olá! Vim pelo site da Tiradentes Moto Peças e gostaria de um orçamento.',
    // Horário usado pelo selo "aberto agora". Índice = dia da semana (0 = domingo).
    // null = fechado. Horas em formato 24h.
    horario: {
      0: null,
      1: { abre: 8, fecha: 18 },
      2: { abre: 8, fecha: 18 },
      3: { abre: 8, fecha: 18 },
      4: { abre: 8, fecha: 18 },
      5: { abre: 8, fecha: 18 },
      6: { abre: 8, fecha: 13 }
    }
  };

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ── 1. Links de WhatsApp ────────────────────────────────────────────────
     Um só lugar monta todos. Sem número configurado, o link cai no Instagram
     em vez de levar o visitante a um erro do WhatsApp.                     */
  function montarLinksWhatsApp() {
    var alvos = $$('[data-wa]');
    if (!alvos.length) return;

    var temNumero = /^\d{12,13}$/.test(CONFIG.whatsapp);

    alvos.forEach(function (el) {
      if (!temNumero) {
        el.setAttribute('href', 'https://www.instagram.com/tiradentesmotopecas');
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
        el.setAttribute('data-wa-fallback', 'sem-numero');
        return;
      }
      var msg = el.getAttribute('data-wa-msg') || CONFIG.mensagemPadrao;
      el.setAttribute('href', 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(msg));
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
    });

    if (!temNumero && window.console) {
      console.warn('[Tiradentes] WhatsApp não configurado — os botões estão apontando para o Instagram. Defina CONFIG.whatsapp em assets/js/main.js.');
    }
  }

  /* ── 2. Header que reage ao scroll ─────────────────────────────────────── */
  function headerScroll() {
    var header = $('#header');
    if (!header) return;
    var ticking = false;

    function atualizar() {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(atualizar); ticking = true; }
    }, { passive: true });
    atualizar();
  }

  /* ── 3. Menu mobile ─────────────────────────────────────────────────────
     Fecha no Esc, no clique de link e ao voltar para desktop. Trava o scroll
     do body enquanto aberto.                                              */
  function menuMobile() {
    var burger = $('#burger');
    var menu   = $('#mobile-nav');
    if (!burger || !menu) return;

    function definir(aberto) {
      burger.setAttribute('aria-expanded', String(aberto));
      burger.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
      menu.classList.toggle('is-open', aberto);
      document.body.classList.toggle('is-locked', aberto);
    }

    burger.addEventListener('click', function () {
      definir(burger.getAttribute('aria-expanded') !== 'true');
    });

    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { definir(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        definir(false);
        burger.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 860) definir(false);
    });
  }

  /* ── 4. Entrada dos blocos ao rolar ─────────────────────────────────────
     Respeita prefers-reduced-motion: sem animação, tudo já nasce visível.  */
  function revelar() {
    var alvos = $$('.reveal');
    if (!alvos.length) return;

    var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (semMovimento || !('IntersectionObserver' in window)) return;  // conteúdo já visível

    // A partir daqui o JS assume a responsabilidade de revelar. Só agora é
    // seguro esconder — se esta linha não rodar, o conteúdo continua no ar.
    document.documentElement.classList.add('js-anim');

    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        var el = entrada.target;
        var irmaos = Array.prototype.slice.call(el.parentNode.children);
        el.style.transitionDelay = Math.min(irmaos.indexOf(el), 5) * 70 + 'ms';
        el.classList.add('is-in');
        obs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    alvos.forEach(function (el) { obs.observe(el); });
  }

  /* ── 5. Selo "aberto agora" e destaque do dia ──────────────────────────── */
  function statusHorario() {
    var caixa = $('#open-status');
    var agora = new Date();
    var dia   = agora.getDay();
    var faixa = CONFIG.horario[dia];

    // destaca a linha do dia na tabela de horário
    $$('#hours li').forEach(function (li) {
      var dias = (li.getAttribute('data-day') || '').split(' ');
      li.classList.toggle('is-today', dias.indexOf(String(dia)) !== -1);
    });

    if (!caixa) return;

    var minutos = agora.getHours() * 60 + agora.getMinutes();
    var aberto  = !!faixa && minutos >= faixa.abre * 60 && minutos < faixa.fecha * 60;

    function doisDigitos(n) { return (n < 10 ? '0' : '') + n; }

    var texto;
    if (aberto) {
      texto = '<strong>Aberto agora</strong> · fecha às ' + doisDigitos(faixa.fecha) + 'h';
    } else {
      var proximo = null;
      for (var i = 1; i <= 7; i++) {
        var d = (dia + i) % 7;
        if (CONFIG.horario[d]) { proximo = { dia: d, faixa: CONFIG.horario[d], distancia: i }; break; }
      }
      // ainda hoje, antes de abrir
      if (faixa && minutos < faixa.abre * 60) {
        texto = '<strong>Fechado</strong> · abre hoje às ' + doisDigitos(faixa.abre) + 'h';
      } else if (proximo) {
        var nomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
        var quando = proximo.distancia === 1 ? 'amanhã' : nomes[proximo.dia];
        texto = '<strong>Fechado</strong> · abre ' + quando + ' às ' + doisDigitos(proximo.faixa.abre) + 'h';
      } else {
        texto = '<strong>Fechado</strong>';
      }
    }

    var rotulo = document.getElementById('open-label');
    if (rotulo) {
      // o <strong>…</strong> do texto é o estado; o resto vira o rótulo de baixo
      var m = texto.match(/^<strong>(.*?)<\/strong>\s*·?\s*(.*)$/);
      caixa.textContent = m ? m[1] : texto.replace(/<[^>]+>/g, '');
      rotulo.textContent = m && m[2] ? m[2] : 'Agora';
    } else {
      caixa.innerHTML = texto;
    }
  }

  /* ── 6. Link ativo na navegação ─────────────────────────────────────────── */
  function navAtiva() {
    var secoes = $$('main section[id]');
    var links  = $$('.nav__link');
    if (!secoes.length || !links.length || !('IntersectionObserver' in window)) return;

    // O site virou multipágina: o menu aponta para arquivos, não para âncoras.
    // Nesse caso quem marca o item ativo é o montador (scripts/montar.py), e
    // este observador tem de ficar quieto — senão ele apaga a marcação.
    var porAncora = links.some(function (l) {
      return (l.getAttribute('href') || '').charAt(0) === '#';
    });
    if (!porAncora) return;

    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.getAttribute('id');
        links.forEach(function (l) {
          l.classList.toggle('is-active', l.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    secoes.forEach(function (s) { obs.observe(s); });
  }

  /* ── 7. Botão flutuante aparece depois do hero ─────────────────────────── */
  function whatsappFlutuante() {
    var btn  = $('#wa-float');
    var hero = $('#hero');
    if (!btn || !hero) return;

    if (!('IntersectionObserver' in window)) { btn.classList.add('is-visible'); return; }

    var obs = new IntersectionObserver(function (entradas) {
      btn.classList.toggle('is-visible', !entradas[0].isIntersecting);
    }, { threshold: 0 });
    obs.observe(hero);
  }

  /* ── 8. Ano no rodapé ───────────────────────────────────────────────────── */
  function ano() {
    var el = $('#year');
    if (el) el.textContent = String(new Date().getFullYear());
  }


  /* ── 9. Catálogo de revisões (revisoes.html) ─────────────────────────────
     Sem JS a página mostra a tabela inteira, grupo por grupo, e cada cartão
     de moto é âncora para o seu. Com JS a tabela some e a escolha acontece
     numa janela: nível, modelo e dia, sem rolar a página. A janela lê os
     dados dos próprios cartões gerados pelo montar.py — preço só existe lá.  */
  function catalogoRevisoes() {
    var cartoes = $$('.moto-grupo');
    var modal   = $('#rev-modal');
    if (!cartoes.length || !modal || typeof modal.showModal !== 'function') return;

    var busca  = $('[data-busca]');
    var campo  = $('#busca-moto');
    var saida  = $('#busca-resultados');
    var opcoes = $('[data-opcoes]', modal);
    var selModelo = $('[data-modelo]', modal);
    var inOutro = $('[data-outro]', modal);
    var notaOutro = $('[data-outro-nota]', modal);
    var inData = $('[data-data]', modal);
    var erro   = $('[data-erro]', modal);
    var enviar = $('[data-enviar]', modal);
    var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

    // "MT-03", "mt 03" e "mt03" são a mesma moto; "Ténéré" e "tenere" também
    function chave(t) {
      return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    var modelos = [];
    cartoes.forEach(function (c) {
      c.getAttribute('data-modelos').split('|').forEach(function (m) {
        modelos.push({ nome: m, chave: chave(m), grupo: c.getAttribute('data-grupo') });
      });
    });

    function iso(d) {
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    var hoje = new Date();
    var limite = new Date(); limite.setDate(limite.getDate() + 60);
    inData.min = iso(hoje);
    inData.max = iso(limite);

    var atual = { planos: [], nivel: null };

    function escolherNivel(i) {
      var pl = atual.planos[i];
      atual.nivel = i;
      $$('input', opcoes).forEach(function (r, k) { r.checked = k === i; });
      $('[data-inclui-titulo]', modal).textContent = 'O que é feito na ' + pl.curto;
      $('[data-inclui-base]', modal).textContent = $('.rev-plano__base', pl.el).textContent;
      $('[data-inclui-itens]', modal).innerHTML = $('.rev-plano__itens', pl.el).innerHTML;
      $('[data-resumo-nome]', modal).textContent = pl.curto;
      $('[data-resumo-valor]', modal).textContent = pl.valor;
    }

    function abrir(id, modelo) {
      var painel = document.getElementById('grupo-' + id);
      var cartao = $('.moto-grupo[data-grupo="' + id + '"]');
      if (!painel || !cartao) return;

      $('#rev-modal-titulo').textContent = modelo || $('.moto-grupo__titulo', cartao).textContent;

      selModelo.innerHTML = '';
      var vazio = document.createElement('option');
      vazio.value = ''; vazio.textContent = 'Selecione';
      selModelo.appendChild(vazio);
      cartao.getAttribute('data-modelos').split('|').forEach(function (m) {
        var o = document.createElement('option');
        o.value = m; o.textContent = m;
        selModelo.appendChild(o);
      });
      var outro = document.createElement('option');
      outro.value = 'outro'; outro.textContent = 'Outro modelo';
      selModelo.appendChild(outro);
      selModelo.value = modelo || '';
      inOutro.value = '';
      mostrarOutro();
      atual.grupo = $('.moto-grupo__titulo', cartao).textContent;

      atual.planos = $$('.rev-plano', painel).map(function (el) {
        return { el: el, curto: el.getAttribute('data-curto'), resumo: el.getAttribute('data-resumo'),
                 valor: el.getAttribute('data-valor'), premium: el.classList.contains('rev-plano--premium') };
      });
      opcoes.innerHTML = '';
      atual.planos.forEach(function (pl, i) {
        var l = document.createElement('label');
        l.className = 'rev-opcao' + (pl.premium ? ' rev-opcao--premium' : '');
        l.innerHTML = '<input type="radio" name="rev-nivel">' +
          '<span class="rev-opcao__txt"><strong></strong><small></small></span>' +
          '<span class="rev-opcao__valor"></span>' +
          (pl.premium ? '<span class="rev-opcao__selo">A mais completa</span>' : '');
        $('strong', l).textContent = pl.curto;
        $('small', l).textContent = pl.resumo;
        $('.rev-opcao__valor', l).textContent = pl.valor.replace(',00', '');
        $('input', l).addEventListener('change', function () { escolherNivel(i); });
        opcoes.appendChild(l);
      });
      escolherNivel(1);   // começa no meio; o cliente sobe ou desce
      erro.textContent = '';
      $('.rev-modal__corpo', modal).scrollTop = 0;

      document.body.classList.add('is-locked');
      modal.showModal();
      if (window.history && history.replaceState) history.replaceState(null, '', '#grupo-' + id);
    }

    // "Outro modelo": a moto não está na lista, o cliente escreve qual é
    function mostrarOutro() {
      var ligado = selModelo.value === 'outro';
      inOutro.hidden = !ligado;
      notaOutro.hidden = !ligado;
      if (ligado) inOutro.focus();
    }
    selModelo.addEventListener('change', mostrarOutro);

    function fechar() { modal.close(); }
    modal.addEventListener('close', function () {
      document.body.classList.remove('is-locked');
      if (window.history && history.replaceState) history.replaceState(null, '', location.pathname);
    });
    $('.rev-modal__fechar', modal).addEventListener('click', fechar);
    // clique no fundo escuro fecha; clique dentro da caixa não
    modal.addEventListener('click', function (e) { if (e.target === modal) fechar(); });

    function validar() {
      if (!selModelo.value) { erro.textContent = 'Escolha o modelo da sua moto.'; selModelo.focus(); return null; }
      if (selModelo.value === 'outro' && !inOutro.value.trim()) {
        erro.textContent = 'Escreva o modelo da sua moto.'; inOutro.focus(); return null;
      }
      if (!inData.value)    { erro.textContent = 'Escolha a data da revisão.'; inData.focus(); return null; }
      var d = new Date(inData.value + 'T12:00:00');
      if (!CONFIG.horario[d.getDay()]) {
        erro.textContent = 'A loja não abre ' + (d.getDay() === 0 ? 'no domingo' : 'nesse dia') + '. Escolha outro dia.';
        inData.focus(); return null;
      }
      if (inData.value < inData.min) { erro.textContent = 'Escolha um dia a partir de hoje.'; inData.focus(); return null; }
      erro.textContent = '';
      return d;
    }
    [selModelo, inOutro, inData].forEach(function (el) { el.addEventListener('change', function () { erro.textContent = ''; }); });

    enviar.addEventListener('click', function (e) {
      var d = validar();
      if (!d) { e.preventDefault(); return; }
      var pl = atual.planos[atual.nivel];
      var moto = selModelo.value === 'outro'
        ? inOutro.value.trim() + ' (fora da lista; tabela ' + atual.grupo + ')'
        : selModelo.value;
      // Mesmo formato da mensagem gerada pelo montar.py (msg_revisao), com o dia
      var msg = 'Olá! Vim pelo site e quero agendar uma revisão.\n' +
        '• Revisão: ' + pl.curto + '\n' +
        '• Moto: ' + moto + '\n' +
        '• Mão de obra: ' + pl.valor + '\n' +
        '• Data da revisão: ' + DIAS[d.getDay()] + ', ' + ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '\n' +
        'Pode confirmar?';
      enviar.href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(msg);
    });

    function sugerir() {
      var q = chave(campo.value);
      saida.innerHTML = '';
      if (!q) return;

      var achados = modelos.filter(function (m) { return m.chave.indexOf(q) !== -1; }).slice(0, 12);
      if (!achados.length) {
        var p = document.createElement('p');
        p.className = 'moto-busca__vazio';
        p.textContent = 'Não achamos “' + campo.value.trim() + '”. Toque no grupo mais parecido abaixo ou pergunte no WhatsApp.';
        saida.appendChild(p);
        return;
      }
      achados.forEach(function (m) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'moto-sugestao';
        b.textContent = m.nome;
        b.addEventListener('click', function () { abrir(m.grupo, m.nome); });
        saida.appendChild(b);
      });
    }

    $('#revisoes').hidden = true;
    busca.hidden = false;
    campo.addEventListener('input', sugerir);
    campo.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var primeira = $('.moto-sugestao', saida);
      if (primeira) primeira.click();
    });

    cartoes.forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.preventDefault();
        abrir(c.getAttribute('data-grupo'), null);
      });
    });

    // Link de campanha: revisoes.html#grupo-cg-160 ou revisoes.html?moto=CG%20160
    var pedido = new URLSearchParams(location.search).get('moto');
    var doPedido = pedido && modelos.filter(function (m) { return m.chave === chave(pedido); })[0];
    var hash = location.hash.replace('#grupo-', '');
    if (doPedido) abrir(doPedido.grupo, doPedido.nome);
    else if (hash && document.getElementById('grupo-' + hash)) abrir(hash, null);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MOVIMENTO
     Ordem de chegada dentro de cada seção: rastro -> título -> texto ->
     itens -> foto. É UMA sequência orquestrada por seção, não um efeito
     solto em cada elemento — a skill de UI trata "animar tudo que se mexe"
     como anti-padrão de severidade alta, e é isso que dá cara de template.
     ═══════════════════════════════════════════════════════════════════════ */

  var SEM_MOVIMENTO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── marca os alvos e liga o esconder-antes-de-revelar ─────────────────── */
  function prepararMovimento() {
    if (SEM_MOVIMENTO || !('IntersectionObserver' in window)) return false;

    $$('section').forEach(function (sec) {
      var fila = [];
      var cab = sec.querySelector('.section-head, .hero__content, .pagina-topo .wrap, .dupla > div:not(.dupla__foto)');

      var rastro = sec.querySelector('.rastro');
      if (rastro) { rastro.setAttribute('data-mov', 'rastro'); fila.push(rastro); }

      // título da capa: palavra por palavra, cada uma sobe de dentro da sua janela
      var titulo = sec.querySelector('.hero__titulo');
      if (titulo) {
        $$('.palavra > *', titulo).forEach(function (w, i) { w.style.setProperty('--i', i); });
        titulo.setAttribute('data-mov', 'palavras'); fila.push(titulo);
      }

      ['h1', 'h2', '.lead', '.hero__sub', '.banda__frase', '.banda__apoio', '.hero__actions', '.hero__onde', '.link-guia'].forEach(function (sel) {
        var el = cab ? cab.querySelector(sel) : sec.querySelector(sel);
        if (el && !el.hasAttribute('data-mov')) { el.setAttribute('data-mov', 'sobe'); fila.push(el); }
      });

      // listas e grades: entram em cascata curta
      var itens = $$('.servico, .motivo, .card, .frente, .faq__item, .checklist li, .pacote li, .info-item, .fatos__item, .rev-nivel, .moto-grupo', sec);
      itens.forEach(function (el) { el.setAttribute('data-mov', 'sobe'); fila.push(el); });

      // a foto é fundo: chega por último e mais devagar
      $$('.janela, .gallery__item', sec).forEach(function (el) {
        el.setAttribute('data-mov', 'foto'); fila.push(el);
      });

      if (fila.length) sec.__fila = fila;
    });

    document.documentElement.classList.add('mov');
    return true;
  }

  /* ── dispara a sequência quando a seção entra ──────────────────────────── */
  function sequenciaSecoes() {
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        var fila = e.target.__fila || [];
        var f = 0;
        fila.forEach(function (el, i) {
          // 34ms por item, teto de 8 passos: lista longa não pode ficar lenta.
          // Foto tem passo próprio e mais largo: a cortina de uma por vez é o efeito.
          var atraso = el.getAttribute('data-mov') === 'foto'
            ? 120 + Math.min(f++, 8) * 90
            : Math.min(i, 8) * 34;
          setTimeout(function () { el.classList.add('mov-in'); }, atraso);
        });
        obs.unobserve(e.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });

    $$('section').forEach(function (s) { if (s.__fila) obs.observe(s); });

    // a primeira dobra não espera scroll nenhum
    var primeira = $('main section');
    if (primeira && primeira.__fila) {
      primeira.__fila.forEach(function (el, i) {
        setTimeout(function () { el.classList.add('mov-in'); }, 80 + Math.min(i, 8) * 46);
      });
      obs.unobserve(primeira);
    }
  }

  /* ── barra de progresso ────────────────────────────────────────────────── */
  function barraProgresso() {
    if (SEM_MOVIMENTO) return;
    var barra = document.createElement('div');
    barra.className = 'progresso';
    barra.setAttribute('aria-hidden', 'true');
    document.body.appendChild(barra);

    var pronto = false;
    function pintar() {
      var alcance = document.documentElement.scrollHeight - window.innerHeight;
      var p = alcance > 0 ? window.scrollY / alcance : 0;
      barra.style.transform = 'scaleX(' + Math.min(1, Math.max(0, p)) + ')';
      pronto = false;
    }
    window.addEventListener('scroll', function () {
      if (!pronto) { window.requestAnimationFrame(pintar); pronto = true; }
    }, { passive: true });
    pintar();
  }

  /* ── parallax: 8% de deslocamento, só na imagem ────────────────────────── */
  function parallax() {
    if (SEM_MOVIMENTO) return;
    var camadas = $$('.janela img, .banda__foto img');
    if (!camadas.length) return;

    camadas.forEach(function (img) { img.classList.add('parallax'); });

    var pronto = false, parado;
    function mover() {
      var altura = window.innerHeight;
      camadas.forEach(function (img) {
        var pai = img.parentNode;
        var r = pai.getBoundingClientRect();
        if (r.bottom < -200 || r.top > altura + 200) return;
        // -1 a 1 conforme o elemento cruza a tela
        var t = ((r.top + r.height / 2) - altura / 2) / (altura / 2);
        img.style.transform = 'scale(1.12) translate3d(0,' + (t * -4).toFixed(2) + '%,0)';
      });
      pronto = false;
    }
    window.addEventListener('scroll', function () {
      if (!pronto) { window.requestAnimationFrame(mover); pronto = true; }
      // a skill pede tirar o will-change quando o scroll para, para liberar GPU
      clearTimeout(parado);
      parado = setTimeout(function () {
        camadas.forEach(function (i) { i.style.willChange = 'auto'; });
      }, 220);
      camadas.forEach(function (i) { i.style.willChange = 'transform'; });
    }, { passive: true });
    window.addEventListener('resize', mover, { passive: true });
    mover();
  }

  /* ── o número da faixa de fatos conta até o valor ──────────────────────── */
  function contador() {
    var alvo = $('.fatos__num em');
    if (!alvo || SEM_MOVIMENTO || !('IntersectionObserver' in window)) return;
    var texto = alvo.textContent.trim();
    var limite = parseInt(texto.replace(/\D/g, ''), 10);
    if (!limite) return;

    var obs = new IntersectionObserver(function (ent) {
      if (!ent[0].isIntersecting) return;
      obs.disconnect();
      var inicio = null, dur = 1100;
      function passo(agora) {
        if (!inicio) inicio = agora;
        var p = Math.min(1, (agora - inicio) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        alvo.textContent = Math.round(limite * eased).toLocaleString('pt-BR');
        if (p < 1) requestAnimationFrame(passo); else alvo.textContent = texto;
      }
      requestAnimationFrame(passo);
    }, { threshold: 0.5 });
    obs.observe(alvo);
  }

  /* ── vídeo da capa ─────────────────────────────────────────────────────────
     Duas versões: larga (computador) e em pé (celular), porque o material veio
     gravado em pé. Troca se a tela girar. Não baixa nada com "menos movimento"
     nem com economia de dados ligada — aí fica o pôster, que já é do CSS.    */
  function videoCapa() {
    var v = $('.hero__video');
    if (!v || SEM_MOVIMENTO) return;
    var con = navigator.connection;
    if (con && con.saveData) return;

    var alta = window.matchMedia('(max-aspect-ratio: 1/1)');
    function escolher() {
      var src = alta.matches ? v.getAttribute('data-src-alta') : v.getAttribute('data-src-larga');
      if (v.getAttribute('src') === src) return;
      v.classList.remove('is-playing');
      v.setAttribute('src', src);
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    v.addEventListener('playing', function () { v.classList.add('is-playing'); });
    if (alta.addEventListener) alta.addEventListener('change', escolher);
    escolher();

    // fora da tela, pausa: não gasta bateria tocando o que ninguém vê
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      }).observe(v);
    }
  }

  /* ── vídeos da galeria: tocam sem som só enquanto estão na tela ───────── */
  // preload="none" no HTML: nada é baixado até o vídeo aparecer. Quem pede
  // menos movimento fica com a foto de capa e o controle para tocar se quiser.
  function videosGaleria() {
    var videos = $$('video[data-autoplay]');
    if (!videos.length) return;
    if (SEM_MOVIMENTO || !('IntersectionObserver' in window)) {
      videos.forEach(function (v) { v.controls = true; });
      return;
    }
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () { v.controls = true; }); }
        else v.pause();
      });
    }, { threshold: 0.35 });
    videos.forEach(function (v) { obs.observe(v); });
  }

  /* ── boot ───────────────────────────────────────────────────────────────── */
  function iniciar() {
    montarLinksWhatsApp();
    headerScroll();
    menuMobile();
    if (prepararMovimento()) sequenciaSecoes();
    barraProgresso();
    parallax();
    contador();
    videosGaleria();
    videoCapa();
    statusHorario();
    navAtiva();
    catalogoRevisoes();
    whatsappFlutuante();
    ano();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
