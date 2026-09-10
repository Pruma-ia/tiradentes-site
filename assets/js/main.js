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

  /* ── boot ───────────────────────────────────────────────────────────────── */
  function iniciar() {
    montarLinksWhatsApp();
    headerScroll();
    menuMobile();
    revelar();
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
