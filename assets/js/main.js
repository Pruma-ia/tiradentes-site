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

      ['h1', 'h2', '.lead', '.hero__sub'].forEach(function (sel) {
        var el = cab ? cab.querySelector(sel) : sec.querySelector(sel);
        if (el && !el.hasAttribute('data-mov')) { el.setAttribute('data-mov', 'sobe'); fila.push(el); }
      });

      // listas e grades: entram em cascata curta
      var itens = $$('.servico, .motivo, .card, .frente, .faq__item, .checklist li, .pacote li, .info-item, .fatos__item', sec);
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
        fila.forEach(function (el, i) {
          // 34ms por item, teto de 8 passos: lista longa não pode ficar lenta
          setTimeout(function () { el.classList.add('mov-in'); }, Math.min(i, 8) * 34);
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
    var camadas = $$('.janela img, .frente img');
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

  /* ── boot ───────────────────────────────────────────────────────────────── */
  function iniciar() {
    montarLinksWhatsApp();
    headerScroll();
    menuMobile();
    if (prepararMovimento()) sequenciaSecoes();
    barraProgresso();
    parallax();
    contador();
    statusHorario();
    navAtiva();
    whatsappFlutuante();
    ano();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
