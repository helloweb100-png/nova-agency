/* =====================================================================
   NOVA AGENCY — script.js
   Todo lo esencial es JavaScript propio (sin dependencias). anime.js (cdnjs,
   v3.2.1) solo añade la ola de puntos del hero: si la CDN falla, la página
   se ve y funciona completa.

   Índice: 0 configuración · 1 utilidades · 2 cargador · 3 revelado a prueba
   de fallos · 4 titulares · 5 hero (partículas, 3D, rotor, puntos) · 6 motor de
   scroll (manifiesto, servicios, método, impacto, bandas, parallax) ·
   7 interacción (menú, tarjetas, botones, cursor) · 8 formulario/WhatsApp
   ===================================================================== */
(() => {
  'use strict';

  /* ---------- 0. CONFIGURACIÓN ---------- */
  // Número de WhatsApp del negocio: 10 dígitos con lada, sin +52 (ej. '5512345678').
  // Vacío = el negocio aún no entregó su número: el botón flotante y el envío del formulario se ocultan solos.
  const WHATSAPP_NUMBER = '3317483951';
  const WA_SALUDO = 'Hola NOVA Agency 👋';

  /* ---------- 1. UTILIDADES ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const safe = (fn) => { try { fn(); } catch (err) { console.warn('[NOVA]', err); } };

  const waNumber = () => {
    const d = String(WHATSAPP_NUMBER).replace(/\D/g, '');
    if (d.length === 10) return '52' + d;
    if (d.length === 12 && d.startsWith('52')) return d;
    if (d.length === 13 && d.startsWith('521')) return d;
    return '';
  };
  const WA = waNumber();

  /* ---------- 2. CARGADOR ("ignición") ---------- */
  const loaderEl = $('#loader');
  let loaderDone = false;

  function finishLoader() {
    if (loaderDone) return;
    loaderDone = true;
    if (loaderEl) {
      loaderEl.classList.add('is-done');
      setTimeout(() => loaderEl.remove(), 900);
    }
    root.classList.add('is-ready');
    safe(startReveal);
    safe(buildDotGrid);
    safe(startHeroCanvas);
    safe(update);
  }

  function runLoader() {
    const count = $('#loaderCount');
    const bar = $('#loaderBar');
    const dur = reduce ? 500 : 1500;
    const t0 = performance.now();
    const tick = (now) => {
      const t = clamp((now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      if (count) count.textContent = Math.round(e * 100);
      if (bar) bar.style.transform = 'scaleX(' + e.toFixed(3) + ')';
      if (t < 1) requestAnimationFrame(tick);
      else setTimeout(finishLoader, 160);
    };
    requestAnimationFrame(tick);
  }
  // Tope duro: el cargador nunca pasa de ~2 s (si rAF se pausa, este temporizador lo cierra).
  setTimeout(finishLoader, 2000);
  safe(runLoader);

  /* ---------- 3. REVELADO A PRUEBA DE FALLOS ---------- */
  let revealEls = [];
  let io = null;

  function show(el) {
    el.classList.add('is-in');
    if (io) io.unobserve(el);
  }

  // Respaldo por geometría: revela todo lo que ya esté dentro de la ventana, aunque el observador falle.
  function geometryReveal() {
    const vh = window.innerHeight;
    for (const el of revealEls) {
      if (el.classList.contains('is-in')) continue;
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.94 && r.bottom > 0) show(el);
    }
  }

  function startReveal() {
    revealEls = $$('[data-reveal], .split');
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        for (const en of entries) if (en.isIntersecting) show(en.target);
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      revealEls.forEach((el) => io.observe(el));
    }
    geometryReveal();
    window.__novaOK = true; // avisa al respaldo del <head> que el script principal sí arrancó
    setTimeout(geometryReveal, 2000);
    setTimeout(geometryReveal, 4500);
  }

  /* ---------- 4. TITULARES: cada palabra sube desde una máscara ---------- */
  function splitWords(el) {
    let i = 0;
    const walk = (node, cls) => {
      Array.from(node.childNodes).forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const s = document.createElement('span');
            s.textContent = part;
            if (cls) s.className = cls;
            s.style.setProperty('--i', i++);
            w.appendChild(s);
            frag.appendChild(w);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1) {
          walk(ch, ch.classList.contains('hl') ? 'hlw' : cls);
        }
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el, '');
    el.classList.add('split-ready');
  }
  safe(() => $$('.split').forEach(splitWords));

  /* ---------- 5. HERO ---------- */
  // 5a. Campo de partículas: flujo ascendente (la flecha del logo), cometas y reacción al cursor
  let heroCanvasCtl = null;
  function startHeroCanvas() {
    const cv = $('#heroCanvas');
    if (!cv || heroCanvasCtl) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const hero = cv.closest('.hero');
    const COLORS = [[74, 163, 255], [139, 92, 246], [92, 200, 255], [176, 117, 255]];
    let w = 0, h = 0, parts = [], comets = [], running = false, raf = 0, last = 0, lastComet = 0;
    const mouse = { x: -9999, y: -9999 };

    const spawn = (init) => {
      const c = COLORS[(Math.random() * COLORS.length) | 0];
      return {
        x: Math.random() * w, y: init ? Math.random() * h : h + 10,
        vx: 0.12 + Math.random() * 0.4, vy: -(0.15 + Math.random() * 0.5),
        r: 0.7 + Math.random() * 1.8, c, a: 0.35 + Math.random() * 0.6, ph: Math.random() * 6.28
      };
    };
    const size = () => {
      const r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp((w * h) / 13000, 34, 130));
      parts = Array.from({ length: n }, () => spawn(true));
    };
    const addComet = () => {
      const sp = 5 + Math.random() * 4;
      comets.push({ x: Math.random() * w * 0.6, y: h * (0.55 + Math.random() * 0.4), vx: sp, vy: -sp * 0.78, life: 0, max: 80 + Math.random() * 40 });
    };
    const draw = (t) => {
      const dt = Math.min(2.5, (t - last) / 16.67 || 1);
      last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.ph += 0.02 * dt;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 22500) {
          const d = Math.sqrt(d2) || 1, f = (150 - d) / 150;
          p.x += (dx / d) * f * 1.8; p.y += (dy / d) * f * 1.8;
        }
        if (p.x > w + 10 || p.y < -10) Object.assign(p, spawn(false));
        const tw = 0.6 + 0.4 * Math.sin(p.ph);
        ctx.fillStyle = 'rgba(' + p.c[0] + ',' + p.c[1] + ',' + p.c[2] + ',' + (p.a * tw).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      const maxD = w < 760 ? 90 : 120;
      ctx.lineWidth = 0.6;
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        for (let j = i + 1; j < parts.length; j++) {
          const b = parts[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
          if (d < maxD * maxD) {
            ctx.strokeStyle = 'rgba(120,150,255,' + ((1 - Math.sqrt(d) / maxD) * 0.22).toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const mx = a.x - mouse.x, my = a.y - mouse.y, md = Math.sqrt(mx * mx + my * my);
        if (md < 170) {
          ctx.strokeStyle = 'rgba(92,200,255,' + ((1 - md / 170) * 0.4).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.x += c.vx * dt; c.y += c.vy * dt; c.life++;
        const ang = Math.atan2(c.vy, c.vx), tx = c.x - Math.cos(ang) * 100, ty = c.y - Math.sin(ang) * 100;
        const g = ctx.createLinearGradient(tx, ty, c.x, c.y);
        g.addColorStop(0, 'rgba(92,200,255,0)'); g.addColorStop(1, 'rgba(190,170,255,.95)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(c.x, c.y); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        ctx.beginPath(); ctx.arc(c.x, c.y, 1.9, 0, 6.283); ctx.fill();
        if (c.life > c.max || c.x > w + 120 || c.y < -120) comets.splice(i, 1);
      }
      if (t - lastComet > 2600 && comets.length < 2) { addComet(); lastComet = t; }
    };
    const loop = (t) => { if (!running) return; raf = requestAnimationFrame(loop); draw(t); };
    const start = () => { if (running || reduce) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    size();
    if (reduce) { draw(performance.now()); }
    if (hero) {
      hero.addEventListener('pointermove', (e) => {
        const r = cv.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      }, { passive: true });
      hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    }
    let inView = true;
    if ('IntersectionObserver' in window && hero) {
      new IntersectionObserver((en) => { inView = en[0].isIntersecting; if (inView) start(); else stop(); }, { threshold: 0 }).observe(hero);
    } else { start(); }
    document.addEventListener('visibilitychange', () => { if (document.hidden || !inView) stop(); else start(); });
    heroCanvasCtl = { resize: () => { size(); if (reduce) draw(performance.now()); } };
  }

  // 5b. Rejilla de puntos con ola (anime.js; sin la librería quedan puntos quietos)
  function buildDotGrid() {
    const host = $('#dotGrid');
    if (!host) return;
    const step = window.innerWidth < 760 ? 46 : 58;
    const cols = Math.max(4, Math.floor(host.clientWidth / step));
    const rows = Math.max(4, Math.floor(host.clientHeight / step));
    if (window.anime) window.anime.remove('#dotGrid i');
    host.textContent = '';
    host.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    host.style.gridTemplateRows = 'repeat(' + rows + ', 1fr)';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < cols * rows; i++) frag.appendChild(document.createElement('i'));
    host.appendChild(frag);
    if (window.anime && !reduce) {
      window.anime({
        targets: '#dotGrid i',
        scale: [{ value: 2.4, duration: 700, easing: 'easeOutQuad' }, { value: 1, duration: 1000, easing: 'easeInOutQuad' }],
        opacity: [{ value: 0.95, duration: 700 }, { value: 0.22, duration: 1000 }],
        delay: window.anime.stagger(75, { grid: [cols, rows], from: 'center' }),
        loop: true,
        loopDelay: 700
      });
    }
  }

  // 5c. Inclinación 3D de la escena con el cursor
  safe(() => {
    const hero = $('.hero'), tilt = $('#stageTilt');
    if (!hero || !tilt || reduce) return;
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty('--ry', (x * 24).toFixed(2) + 'deg');
      tilt.style.setProperty('--rx', (-y * 18).toFixed(2) + 'deg');
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { tilt.style.setProperty('--ry', '0deg'); tilt.style.setProperty('--rx', '0deg'); });
  });

  // 5d. Palabra que rota en el hero (la primera ya está en el HTML)
  safe(() => {
    const items = $$('.rotor span');
    if (items.length < 2 || reduce) return;
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      const cur = items[i];
      i = (i + 1) % items.length;
      const next = items[i];
      cur.classList.remove('is-on'); cur.classList.add('is-out');
      next.classList.remove('is-out'); next.classList.add('is-on');
      setTimeout(() => cur.classList.remove('is-out'), 750);
    }, 2400);
  });

  /* ---------- 6. MOTOR DE SCROLL ---------- */
  const heroInner = $('#heroInner');
  const navEl = $('#nav');
  const navProgress = $('#navProgress');

  // Manifiesto: las palabras se encienden con el scroll
  const mani = $('.manifesto');
  let maniWords = [];
  safe(() => {
    const el = $('#manifestoText');
    if (!el) return;
    const txt = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', txt);
    el.textContent = '';
    txt.split(' ').forEach((word, i, arr) => {
      const s = document.createElement('span');
      s.className = 'mw';
      s.textContent = word;
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    maniWords = $$('.mw', el);
  });
  function updateManifesto() {
    if (!mani || !maniWords.length) return;
    if (reduce) { maniWords.forEach((w) => { w.style.opacity = 1; }); return; }
    const r = mani.getBoundingClientRect();
    const total = Math.max(1, r.height - window.innerHeight);
    const p = clamp((-r.top + window.innerHeight * 0.15) / (total * 0.9));
    const n = maniWords.length;
    maniWords.forEach((w, i) => {
      const t = (i / n) * 0.88 + 0.02;
      const o = clamp((p - t) / 0.06);
      w.style.opacity = (0.16 + 0.84 * o).toFixed(2);
      w.classList.toggle('is-hot', o > 0.35 && o < 0.98);
    });
  }

  // Servicios: carril horizontal fijado al scroll (escritorio); en móvil es un carrusel con snap
  const svc = $('#servicios'), svcPin = $('.svc__pin'), svcVp = $('#svcViewport'), svcTrack = $('#svcTrack'), svcBar = $('#svcProgress');
  const mqPin = window.matchMedia('(min-width: 960px)');
  let pinned = false, hmax = 0;
  function layoutServices() {
    if (!svc || !svcTrack || !svcVp) return;
    if (mqPin.matches && !reduce) {
      svc.classList.add('is-pinned');
      svc.style.height = '';
      hmax = Math.max(0, svcTrack.getBoundingClientRect().width - svcVp.clientWidth);
      svc.style.height = Math.round(hmax + svcPin.offsetHeight) + 'px';
      pinned = true;
    } else {
      svc.classList.remove('is-pinned');
      svc.style.height = '';
      svcTrack.style.transform = '';
      pinned = false;
    }
  }
  function updateServices() {
    if (!svc || !svcBar) return;
    if (!pinned) return;
    const r = svc.getBoundingClientRect();
    const total = Math.max(1, r.height - svcPin.offsetHeight);
    const p = clamp(-r.top / total);
    svcTrack.style.transform = 'translate3d(' + (-p * hmax).toFixed(1) + 'px,0,0)';
    svcBar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
  }
  safe(() => {
    if (!svcVp || !svcBar) return;
    svcVp.addEventListener('scroll', () => {
      if (pinned) return;
      const m = svcVp.scrollWidth - svcVp.clientWidth;
      svcBar.style.transform = 'scaleX(' + (m > 0 ? svcVp.scrollLeft / m : 0).toFixed(3) + ')';
    }, { passive: true });
  });

  // Método: la trayectoria se dibuja y cada paso se enciende
  const method = $('#metodo'), stepsEl = $('#steps'), mpLive = $('#mpLive');
  const stepItems = $$('.step');
  let litAt = [0.1, 0.36, 0.62, 0.86]; // en escritorio se recalcula según dónde cae cada paso sobre el trazo
  function updateMethod() {
    if (!stepsEl) return;
    const vh = window.innerHeight;
    const r = stepsEl.getBoundingClientRect();
    const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.2));
    if (method) method.style.setProperty('--p', p.toFixed(3));
    if (mpLive) {
      mpLive.style.strokeDashoffset = (1 - p).toFixed(4);
      mpLive.style.opacity = p > 0.004 ? 1 : 0;
    }
    stepsEl.classList.toggle('is-done', p > 0.97);
    stepItems.forEach((s, i) => s.classList.toggle('is-lit', p >= litAt[i]));
  }

  // Método (escritorio): el zigzag se construye con la posición REAL de cada nodo, así siempre pasa por los 4 pasos
  // y nunca queda tapado por las tarjetas (usa offsetLeft/Top: no le afectan las animaciones de entrada).
  const mqPath = window.matchMedia('(min-width: 1080px)');
  function layoutMethod() {
    const svgEl = stepsEl && $('.method__path', stepsEl);
    const list = stepsEl && $('.steps__list', stepsEl);
    const head = $('#mpHead');
    if (!svgEl || !list || !mpLive || !head || !mqPath.matches || stepItems.length < 2) { litAt = [0.1, 0.36, 0.62, 0.86]; return; }
    const W = stepsEl.offsetWidth, H = stepsEl.offsetHeight;
    const pts = stepItems.map((s) => {
      const n = $('.step__node', s);
      return { x: list.offsetLeft + s.offsetLeft + n.offsetLeft + n.offsetWidth / 2, y: list.offsetTop + s.offsetTop + n.offsetTop + n.offsetHeight / 2 };
    });
    const path = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      path.push({ x: a.x + (b.x - a.x) * 0.48, y: b.y - Math.abs(b.y - a.y) * 0.55 - 34 }); // cima
      path.push({ x: b.x - 38, y: b.y + 26 });                                            // valle (el quiebre del logo)
      path.push(b);                                                                         // nodo del siguiente paso
    }
    const last = pts[pts.length - 1];
    const E = { x: last.x + Math.min(240, W - last.x - 20), y: Math.max(18, last.y - 150) };
    path.push({ x: last.x + 60, y: last.y - 62 }, { x: last.x + 96, y: last.y - 34 }, E);
    let len = 0;
    const cum = [0];
    for (let i = 1; i < path.length; i++) { len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); cum.push(len); }
    const f = (v) => v.toFixed(1);
    const d = 'M' + path.map((p) => f(p.x) + ' ' + f(p.y)).join(' L');
    svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    $$('.mp-ghost, .mp-live', svgEl).forEach((el) => el.setAttribute('d', d));
    const prev = path[path.length - 2];
    const ang = Math.atan2(E.y - prev.y, E.x - prev.x), L = 36, sp = 0.52;
    head.setAttribute('d', 'M' + f(E.x - Math.cos(ang - sp) * L) + ' ' + f(E.y - Math.sin(ang - sp) * L) + ' L' + f(E.x) + ' ' + f(E.y) + ' L' + f(E.x - Math.cos(ang + sp) * L) + ' ' + f(E.y - Math.sin(ang + sp) * L));
    litAt = pts.map((_, i) => Math.max(0.05, cum[i * 3] / len - 0.012));
  }

  // Impacto: el marco se abre hasta ocupar toda la pantalla
  const expand = $('#impacto'), frame = $('#expandFrame'), copy = $('#expandCopy'), expandStick = $('.expand__stick'), expandLogo = $('.expand__logo');
  function updateExpand() {
    if (!expand || !frame || !expandStick || reduce) return;
    const r = expand.getBoundingClientRect();
    const total = Math.max(1, r.height - window.innerHeight);
    const p = clamp(-r.top / total);
    const e = easeInOut(clamp(p / 0.7));
    const vw = expandStick.clientWidth, vh = expandStick.clientHeight;
    const portrait = vw < 760;
    frame.style.width = lerp(portrait ? vw * 0.78 : vw * 0.5, vw, e).toFixed(1) + 'px';
    frame.style.height = lerp(portrait ? vh * 0.46 : vh * 0.54, vh, e).toFixed(1) + 'px';
    frame.style.borderRadius = lerp(40, 0, e).toFixed(1) + 'px';
    if (expandLogo) expandLogo.style.transform = 'scale(' + lerp(1.04, 1, e).toFixed(3) + ')';
    if (copy) {
      const c = clamp((e - 0.55) / 0.4);
      copy.style.opacity = c.toFixed(3);
      copy.style.transform = 'translate3d(0,' + ((1 - c) * 34).toFixed(1) + 'px,0)';
      copy.style.pointerEvents = c < 0.3 ? 'none' : 'auto';
    }
  }

  // Bandas tipográficas: se desplazan con el scroll además de su marquesina constante
  const bands = $$('.band');
  safe(() => {
    $$('.band__track').forEach((tr) => {
      Array.from(tr.children).forEach((n) => tr.appendChild(n.cloneNode(true)));
    });
  });
  function updateBands() {
    if (reduce) return;
    const vh = window.innerHeight;
    bands.forEach((b) => {
      const row = $('.band__row', b);
      if (!row) return;
      const dir = parseFloat(b.dataset.dir) || 1;
      const r = b.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const c = r.top + r.height / 2 - vh / 2;
      row.style.transform = 'translate3d(' + (c * 0.45 * dir).toFixed(1) + 'px,0,0)';
    });
  }

  // Parallax suave en elementos decorativos
  const parallaxEls = $$('[data-parallax]');
  function updateParallax() {
    if (reduce) return;
    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      const host = el.parentElement;
      if (!host) return;
      const r = host.getBoundingClientRect();
      if (r.bottom < -300 || r.top > vh + 300) return;
      const c = r.top + r.height / 2 - vh / 2;
      el.style.transform = 'translate3d(0,' + (-c * parseFloat(el.dataset.parallax)).toFixed(1) + 'px,0)';
    });
  }

  // Sección activa (menú y riel lateral)
  const navLinks = $$('.nav__links a'), railLinks = $$('.rail a');
  const secIds = ['inicio', 'manifiesto', 'servicios', 'metodo', 'impacto', 'porque', 'faq', 'contacto'];
  const secEls = secIds.map((id) => document.getElementById(id)).filter(Boolean);
  const railAlias = { manifiesto: 'inicio', impacto: 'metodo', faq: 'porque' };
  let lastSec = '';
  function updateActive() {
    const mid = window.innerHeight * 0.45;
    let cur = '';
    for (const s of secEls) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { cur = s.id; break; }
    }
    if (!cur || cur === lastSec) return;
    lastSec = cur;
    navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + cur));
    const railId = railAlias[cur] || cur;
    railLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + railId));
  }

  // Un solo bucle de scroll (rAF) que reparte el trabajo
  let ticking = false, lastY = 0;
  function update() {
    ticking = false;
    const y = window.scrollY, vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    if (navProgress) navProgress.style.transform = 'scaleX(' + clamp(y / max).toFixed(4) + ')';
    if (heroInner && y < vh * 1.4) heroInner.style.setProperty('--hp', clamp(y / (vh * 0.9)).toFixed(3));
    if (navEl) {
      navEl.classList.toggle('is-scrolled', y > 24);
      if (!document.body.classList.contains('menu-open')) {
        if (y > lastY + 6 && y > 240) navEl.classList.add('is-hidden');
        else if (y < lastY - 6 || y < 160) navEl.classList.remove('is-hidden');
      }
    }
    lastY = y;
    safe(updateManifesto);
    safe(updateServices);
    safe(updateMethod);
    safe(updateExpand);
    safe(updateBands);
    safe(updateParallax);
    safe(updateActive);
    if (revealEls.length) safe(geometryReveal);
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });

  let resizeT = 0;
  const onResize = () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      safe(layoutServices);
      safe(layoutMethod);
      if (heroCanvasCtl) safe(heroCanvasCtl.resize);
      if (loaderDone) safe(buildDotGrid);
      update();
    }, 150);
    onScroll();
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('load', () => { safe(layoutServices); safe(layoutMethod); update(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { safe(layoutServices); safe(layoutMethod); update(); });
  if (mqPin.addEventListener) mqPin.addEventListener('change', () => { safe(layoutServices); safe(layoutMethod); update(); });
  if (mqPath.addEventListener) mqPath.addEventListener('change', () => { safe(layoutMethod); update(); });

  /* ---------- 7. INTERACCIÓN ---------- */
  // Menú móvil
  safe(() => {
    const burger = $('#burger'), menu = $('#menu');
    if (!burger || !menu) return;
    const setOpen = (open) => {
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.classList.toggle('menu-open', open);
    };
    burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    mqPin.addEventListener && mqPin.addEventListener('change', () => setOpen(false));
  });

  // Foco de luz en tarjetas
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const t = e.target.closest && e.target.closest('.spot');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
    t.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
  }, { passive: true });

  // Botones magnéticos
  safe(() => {
    if (reduce || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('[data-magnetic]').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.transform = 'translate3d(' + (dx * 0.18).toFixed(1) + 'px,' + (dy * 0.28).toFixed(1) + 'px,0)';
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  });

  // Cursor luminoso (solo con ratón)
  safe(() => {
    const glow = $('#cursorGlow');
    if (!glow || reduce || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const loop = () => {
      x = lerp(x, tx, 0.12); y = lerp(y, ty, 0.12);
      glow.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      glow.classList.add('is-on');
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerleave', () => glow.classList.remove('is-on'));
  });

  // Imágenes de stock: si alguna no carga, se oculta y queda la composición de fondo
  safe(() => {
    $$('img[data-stock]').forEach((img) => {
      const bad = () => img.classList.add('is-broken');
      img.addEventListener('error', bad);
      if (img.complete && img.naturalWidth === 0) bad();
    });
  });

  // Año del pie
  safe(() => { const y = $('#year'); if (y) y.textContent = new Date().getFullYear(); });

  /* ---------- 8. FORMULARIO + WHATSAPP ---------- */
  safe(() => {
    const form = $('#leadForm');
    const float = $('#waFloat');
    if (!WA) {
      root.classList.add('no-wa'); // oculta botón flotante y envío; la página sigue completa
      return;
    }
    if (float) {
      float.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(WA_SALUDO + ' Quiero conocer más sobre sus servicios de marketing.');
      float.hidden = false;
    }
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const nombre = String(fd.get('nombre') || '').trim();
      const negocio = String(fd.get('negocio') || '').trim();
      const meta = String(fd.get('meta') || '').trim();
      const interes = fd.getAll('interes').map(String);
      let msg = WA_SALUDO + '\nSoy ' + (nombre || 'un futuro cliente') + (negocio ? ' de ' + negocio : '') + '.';
      if (interes.length) msg += '\nMe interesa: ' + interes.join(', ') + '.';
      if (meta) msg += '\nMi meta: ' + meta;
      msg += '\nEstoy listo para crecer, ¿platicamos?';
      window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    });
  });

  /* ---------- ARRANQUE ---------- */
  safe(layoutServices);
  safe(layoutMethod);
  safe(update);
})();
