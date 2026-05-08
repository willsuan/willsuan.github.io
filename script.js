/* =========================================================
   Will Suan — personal research site
   script.js
   ========================================================= */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =========================================================
     NAV scroll state + active link
     ========================================================= */
  const nav = document.querySelector('.nav');
  const navLinks = [...document.querySelectorAll('.nav-links a')];
  const sections = navLinks
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  function onScroll() {
    if (window.scrollY > 8) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');

    let activeIdx = 0;
    const probe = window.scrollY + window.innerHeight * 0.35;
    sections.forEach((s, i) => {
      if (s && s.offsetTop <= probe) activeIdx = i;
    });
    navLinks.forEach((a, i) => a.classList.toggle('active', i === activeIdx));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* =========================================================
     Build stamp (footer)
     ========================================================= */
  const stamp = document.getElementById('build-stamp');
  if (stamp) {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    stamp.textContent = `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}`;
  }

  /* =========================================================
     Orbit tag positioning (research interests)
     ========================================================= */
  function placeOrbit() {
    const tags = document.querySelectorAll('.otag');
    const isMobile = window.innerWidth <= 720;
    if (isMobile) {
      tags.forEach(t => { t.style.removeProperty('--x'); t.style.removeProperty('--y'); });
      return;
    }
    tags.forEach(t => {
      const r = parseFloat(t.dataset.r) || 160;
      const a = ((parseFloat(t.dataset.a) || 0) - 90) * Math.PI / 180;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      t.style.setProperty('--x', `${x}px`);
      t.style.setProperty('--y', `${y}px`);
    });
  }
  placeOrbit();
  window.addEventListener('resize', placeOrbit);

  /* =========================================================
     Reveal-on-scroll
     ========================================================= */
  const revealTargets = document.querySelectorAll('.block, .hero-content > *, .tile, .contrib > li');
  revealTargets.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
  revealTargets.forEach(el => io.observe(el));

  /* =========================================================
     Command palette (cmd/ctrl + k)
     ========================================================= */
  const palette = document.getElementById('palette');
  const paletteInput = document.getElementById('palette-input');
  const paletteList = document.getElementById('palette-list');
  const paletteToggle = document.getElementById('palette-toggle');

  const navItems = [
    { id: '#top', label: 'Hero', hint: 'top' },
    { id: '#research', label: 'Research direction', hint: '§ 01' },
    { id: '#contribute', label: 'What I can contribute', hint: '§ 02' },
    { id: '#background', label: 'Technical background', hint: '§ 03' },
    { id: '#wedge', label: 'Current project direction', hint: '§ 04' },
    { id: '#work', label: 'Selected work', hint: '§ 05' },
    { id: '#contact', label: 'Contact', hint: '§ 06' },
  ];

  let selectedIdx = 0;
  function renderPalette(query='') {
    const q = query.trim().toLowerCase();
    const filtered = navItems.filter(n => !q || n.label.toLowerCase().includes(q) || n.hint.toLowerCase().includes(q));
    selectedIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1));
    paletteList.innerHTML = filtered.map((n, i) => `
      <li role="option" data-idx="${i}" data-id="${n.id}" aria-selected="${i === selectedIdx}">
        <span class="mono">${n.hint}</span>
        <span>${n.label}</span>
      </li>
    `).join('');
    paletteList._items = filtered;
  }

  function openPalette() {
    palette.dataset.open = 'true';
    palette.setAttribute('aria-hidden', 'false');
    paletteInput.value = '';
    selectedIdx = 0;
    renderPalette();
    setTimeout(() => paletteInput.focus(), 30);
  }
  function closePalette() {
    palette.dataset.open = 'false';
    palette.setAttribute('aria-hidden', 'true');
  }
  function gotoSelected() {
    const items = paletteList._items || [];
    const item = items[selectedIdx];
    if (!item) return;
    closePalette();
    const target = document.querySelector(item.id);
    if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.dataset.open === 'true' ? closePalette() : openPalette();
      return;
    }
    if (palette.dataset.open !== 'true') return;
    if (e.key === 'Escape')      { closePalette(); }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = Math.min((paletteList._items?.length || 1) - 1, selectedIdx + 1);
      renderPalette(paletteInput.value);
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = Math.max(0, selectedIdx - 1);
      renderPalette(paletteInput.value);
    }
    else if (e.key === 'Enter')   { e.preventDefault(); gotoSelected(); }
  });
  paletteInput?.addEventListener('input', e => { selectedIdx = 0; renderPalette(e.target.value); });
  paletteList?.addEventListener('click', e => {
    const li = e.target.closest('li[data-idx]');
    if (!li) return;
    selectedIdx = parseInt(li.dataset.idx, 10);
    gotoSelected();
  });
  paletteToggle?.addEventListener('click', openPalette);
  palette?.addEventListener('click', e => { if (e.target === palette) closePalette(); });

  /* =========================================================
     HERO ANIMATION
     Neural population latent dynamics + faint manifold attractors.
     - 256 unit particles flowing along a smooth slowly-rotating
       3D vector field, projected to 2D.
     - 2 attractor curves (a knotted loop + a Lissajous) drawn faintly.
     - Subtle gridlines that fade in/out.
     - Cursor adds a small radial perturbation.
     ========================================================= */
  const heroCanvas = document.getElementById('hero-canvas');
  const rasterCanvas = document.getElementById('raster-canvas');
  const hudN = document.getElementById('hud-n');
  const hudF = document.getElementById('hud-f');

  const HERO = {
    N: 280,
    spread: 1.6,
    points: [],
    mouse: { x: 0, y: 0, active: false },
    t: 0,
    frame: 0,
  };

  function setupHeroCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = heroCanvas.getContext('2d');
    const resize = () => {
      const w = heroCanvas.clientWidth;
      const h = heroCanvas.clientHeight;
      heroCanvas.width = w * dpr;
      heroCanvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    return ctx;
  }

  function seedPoints() {
    HERO.points = [];
    for (let i = 0; i < HERO.N; i++) {
      // points scattered roughly inside a ball
      const r = Math.cbrt(Math.random()) * HERO.spread;
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;
      HERO.points.push({
        x: r * Math.sin(theta) * Math.cos(phi),
        y: r * Math.sin(theta) * Math.sin(phi),
        z: r * Math.cos(theta),
        history: [],
        baseHue: 195 + Math.random() * 90,
      });
    }
    if (hudN) hudN.textContent = HERO.N;
  }

  // a smooth vector field — combination of Lorenz-like swirl + sine drift
  // gives soft attractor-like tendency without the harsh chaos
  function field(x, y, z, t) {
    const a = 0.6, b = 1.1;
    const fx =  Math.sin(y * b + t * 0.18) - 0.16 * x + Math.cos(z * 0.7) * 0.18;
    const fy = -Math.sin(x * b + t * 0.12) - 0.16 * y + Math.sin(z * 0.7) * 0.18;
    const fz =  Math.sin((x + y) * 0.6 + t * 0.07) - 0.18 * z;
    return [fx * a, fy * a, fz * a];
  }

  // 3D → 2D projection with a slowly rotating viewing angle
  function project(x, y, z, t, w, h) {
    const ang = t * 0.05;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const xr = x * ca - z * sa;
    const zr = x * sa + z * ca;
    // perspective
    const scale = Math.min(w, h) * 0.18;
    const persp = 1 / (4 - zr * 0.6);
    const px = w * 0.5 + xr * scale * persp * 1.4;
    const py = h * 0.5 + (y * 0.9 + zr * 0.05) * scale * persp;
    return [px, py, persp];
  }

  function drawAttractor(ctx, w, h, t) {
    // Lissajous-like loop traced slowly — represents a "manifold"
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(170, 140, 255, 0.18)';
    ctx.beginPath();
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * Math.PI * 2;
      const x = 1.4 * Math.sin(u * 1) + 0.3 * Math.sin(u * 3 + t * 0.2);
      const y = 1.0 * Math.cos(u * 2) * 0.7;
      const z = 1.2 * Math.cos(u * 1 + t * 0.1);
      const [px, py] = project(x, y, z, t, w, h);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    // a second attractor ring
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.10)';
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * Math.PI * 2;
      const x = 0.9 * Math.cos(u + t * 0.05);
      const y = 0.9 * Math.sin(u + t * 0.05) * Math.cos(u * 2);
      const z = 0.6 * Math.sin(u * 3);
      const [px, py] = project(x, y, z, t, w, h);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function drawGrid(ctx, w, h, t) {
    const fade = 0.04 + 0.02 * Math.sin(t * 0.18);
    ctx.strokeStyle = `rgba(255,255,255,${fade.toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = 80;
    for (let x = step; x < w; x += step) {
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    for (let y = step; y < h; y += step) {
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();

    // axis lines through the centre — barely visible
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
    ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h);
    ctx.stroke();
  }

  function step(ctx) {
    const w = heroCanvas.clientWidth;
    const h = heroCanvas.clientHeight;

    // soft trail
    ctx.fillStyle = 'rgba(7,8,11,0.18)';
    ctx.fillRect(0, 0, w, h);

    HERO.t += 0.012;
    HERO.frame++;

    drawGrid(ctx, w, h, HERO.t);
    drawAttractor(ctx, w, h, HERO.t);

    // mouse-driven perturbation in screen space
    const mx = HERO.mouse.x;
    const my = HERO.mouse.y;

    for (let i = 0; i < HERO.points.length; i++) {
      const p = HERO.points[i];
      const [fx, fy, fz] = field(p.x, p.y, p.z, HERO.t);
      const dt = 0.018;
      p.x += fx * dt;
      p.y += fy * dt;
      p.z += fz * dt;

      // soft confinement
      const r2 = p.x*p.x + p.y*p.y + p.z*p.z;
      if (r2 > 4.5) {
        p.x *= 0.985; p.y *= 0.985; p.z *= 0.985;
      }

      const [px, py, persp] = project(p.x, p.y, p.z, HERO.t, w, h);

      // mouse pull
      if (HERO.mouse.active) {
        const dx = mx - px, dy = my - py;
        const d2 = dx*dx + dy*dy;
        if (d2 < 22000) {
          const f = (1 - d2 / 22000) * 0.0008;
          p.x += dx * f / 30;
          p.y += dy * f / 30;
        }
      }

      // history
      p.history.push([px, py]);
      if (p.history.length > 7) p.history.shift();

      // draw trail
      const hue = p.baseHue;
      ctx.strokeStyle = `hsla(${hue}, 70%, 70%, 0.22)`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let k = 0; k < p.history.length; k++) {
        const [hx, hy] = p.history[k];
        k === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
      }
      ctx.stroke();

      // draw point
      const size = Math.max(0.6, persp * 1.6);
      ctx.fillStyle = `hsla(${hue}, 70%, 75%, ${0.55 * Math.min(1, persp)})`;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }

    if (hudF) hudF.textContent = String(HERO.frame).padStart(6, '0');

    if (!reduceMotion) requestAnimationFrame(() => step(ctx));
  }

  if (heroCanvas) {
    const ctx = setupHeroCanvas();
    seedPoints();

    heroCanvas.addEventListener('mousemove', e => {
      const rect = heroCanvas.getBoundingClientRect();
      HERO.mouse.x = e.clientX - rect.left;
      HERO.mouse.y = e.clientY - rect.top;
      HERO.mouse.active = true;
    });
    heroCanvas.addEventListener('mouseleave', () => HERO.mouse.active = false);

    if (reduceMotion) {
      // single frame so the canvas isn't blank
      step(ctx);
    } else {
      step(ctx);
    }
  }

  /* =========================================================
     RASTER strip — simulated spike trains
     ========================================================= */
  function setupRaster() {
    if (!rasterCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = rasterCanvas.getContext('2d');

    const N_UNITS = 32;
    const WINDOW = 1.2; // s
    const spikes = Array.from({ length: N_UNITS }, () => []);

    let last = performance.now();
    let t = 0;

    function resize() {
      const w = rasterCanvas.clientWidth;
      const h = rasterCanvas.clientHeight;
      rasterCanvas.width = w * dpr;
      rasterCanvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function tickStep(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      // generate poisson-ish spikes
      for (let i = 0; i < N_UNITS; i++) {
        const baseRate = 1.5 + 2.5 * (0.5 + 0.5 * Math.sin(t * 0.6 + i * 0.4));
        if (Math.random() < baseRate * dt) spikes[i].push(t);
        // forget old
        while (spikes[i].length && t - spikes[i][0] > WINDOW) spikes[i].shift();
      }

      const w = rasterCanvas.clientWidth;
      const h = rasterCanvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // background lanes
      ctx.fillStyle = 'rgba(255,255,255,0.018)';
      const laneH = h / N_UNITS;
      for (let i = 0; i < N_UNITS; i += 2) {
        ctx.fillRect(0, i * laneH, w, laneH);
      }

      // playhead
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w - 1, 0); ctx.lineTo(w - 1, h);
      ctx.stroke();

      // spikes
      ctx.lineWidth = 1;
      for (let i = 0; i < N_UNITS; i++) {
        const y = (i + 0.5) * laneH;
        for (const s of spikes[i]) {
          const age = t - s;
          const x = w - (age / WINDOW) * w;
          const alpha = 0.4 + 0.6 * (1 - age / WINDOW);
          ctx.strokeStyle = `hsla(${190 + (i*3)%80}, 75%, 70%, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(x, y - laneH * 0.4);
          ctx.lineTo(x, y + laneH * 0.4);
          ctx.stroke();
        }
      }

      if (!reduceMotion) requestAnimationFrame(tickStep);
    }
    requestAnimationFrame(tickStep);
  }
  setupRaster();
})();
