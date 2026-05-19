/* =========================================================
   Will Suan — personal research site
   script.js
   - Hero: latent-dynamics particle field (cursor-perturbed)
   - Research: anatomical brain wireframe with anchored region
     labels, drag-to-rotate (no auto-rotate)
   - Footer raster strip
   - Cmd+K palette, scroll-spy nav, reveal-on-scroll
   ========================================================= */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------ NAV scroll-state + active link ------------------ */
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
    sections.forEach((s, i) => { if (s && s.offsetTop <= probe) activeIdx = i; });
    navLinks.forEach((a, i) => a.classList.toggle('active', i === activeIdx));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------ Build stamp ------------------ */
  const stamp = document.getElementById('build-stamp');
  if (stamp) {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    stamp.textContent = `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}`;
  }

  /* ------------------ Reveal-on-scroll ------------------ */
  const revealTargets = document.querySelectorAll('.block, .hero-content > *, .tile, .contrib > li');
  revealTargets.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
  revealTargets.forEach(el => io.observe(el));

  /* ------------------ Command palette (⌘K) — removed in latest pass ------------------ */
  const palette = document.getElementById('palette');
  const paletteInput = document.getElementById('palette-input');
  const paletteList = document.getElementById('palette-list');
  const paletteToggle = document.getElementById('palette-toggle');
  if (!palette || !paletteInput || !paletteList) {
    // palette markup was removed; skip the entire palette block
  } else {

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
  function renderPalette(q='') {
    const query = q.trim().toLowerCase();
    const filtered = navItems.filter(n => !query || n.label.toLowerCase().includes(query) || n.hint.toLowerCase().includes(query));
    selectedIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1));
    paletteList.innerHTML = filtered.map((n, i) => `
      <li role="option" data-idx="${i}" data-id="${n.id}" aria-selected="${i === selectedIdx}">
        <span class="mono">${n.hint}</span><span>${n.label}</span>
      </li>`).join('');
    paletteList._items = filtered;
  }
  function openPalette() {
    palette.dataset.open = 'true';
    palette.setAttribute('aria-hidden', 'false');
    paletteInput.value = ''; selectedIdx = 0; renderPalette();
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
    document.querySelector(item.id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.dataset.open === 'true' ? closePalette() : openPalette();
      return;
    }
    if (palette.dataset.open !== 'true') return;
    if (e.key === 'Escape') closePalette();
    else if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx = Math.min((paletteList._items?.length || 1) - 1, selectedIdx + 1); renderPalette(paletteInput.value); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); selectedIdx = Math.max(0, selectedIdx - 1); renderPalette(paletteInput.value); }
    else if (e.key === 'Enter')     { e.preventDefault(); gotoSelected(); }
  });
  paletteInput?.addEventListener('input', e => { selectedIdx = 0; renderPalette(e.target.value); });
  paletteList?.addEventListener('click', e => {
    const li = e.target.closest('li[data-idx]'); if (!li) return;
    selectedIdx = parseInt(li.dataset.idx, 10); gotoSelected();
  });
  paletteToggle?.addEventListener('click', openPalette);
  palette?.addEventListener('click', e => { if (e.target === palette) closePalette(); });
  } // end palette guard

  /* ------------------ Canvas helper ------------------ */
  function setupCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ctx = canvas.getContext('2d');
    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    return ctx;
  }

  /* =========================================================
     Email obfuscation — reassembles on first interaction
     ========================================================= */
  document.querySelectorAll('a.email-link').forEach(a => {
    const reveal = () => {
      const u = a.dataset.user || '';
      const d = a.dataset.domain || '';
      if (!u || !d) return;
      const addr = u + '@' + d;
      a.textContent = addr;
      a.href = 'mailto:' + addr;
      a.removeAttribute('aria-label');
    };
    a.addEventListener('mouseenter', reveal, { once: true });
    a.addEventListener('focus', reveal, { once: true });
    a.addEventListener('click', e => {
      if (a.getAttribute('href') === '#') { e.preventDefault(); reveal(); }
    });
  });

  /* =========================================================
     Projects pagination
     ========================================================= */
  const projTrack = document.getElementById('proj-track');
  if (projTrack) {
    const slides = projTrack.querySelectorAll('.proj-slide');
    const dots = document.querySelectorAll('.proj-dot');
    const counter = document.getElementById('proj-counter');
    const prevBtn = document.getElementById('proj-prev');
    const nextBtn = document.getElementById('proj-next');
    const prevEdge = document.getElementById('proj-prev-edge');
    const nextEdge = document.getElementById('proj-next-edge');
    const N = slides.length;
    let idx = 0;

    function go(i) {
      idx = ((i % N) + N) % N;
      projTrack.dataset.idx = String(idx);
      projTrack.style.transform = `translateX(${-idx * 100}%)`;
      dots.forEach((d, k) => {
        d.classList.toggle('is-active', k === idx);
        d.setAttribute('aria-selected', k === idx ? 'true' : 'false');
      });
      if (counter) counter.textContent =
        `${String(idx+1).padStart(2,'0')} / ${String(N).padStart(2,'0')}`;
    }
    dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.go)));
    prevBtn?.addEventListener('click', () => go(idx - 1));
    nextBtn?.addEventListener('click', () => go(idx + 1));
    prevEdge?.addEventListener('click', () => go(idx - 1));
    nextEdge?.addEventListener('click', () => go(idx + 1));
    go(0);
  }

  /* =========================================================
     HERO — cycling neuroscience attractors with HUD brief
     ========================================================= */
  const heroCanvas = document.getElementById('hero-canvas');
  const hudN = document.getElementById('hud-n');
  const hudF = document.getElementById('hud-f');
  const hudTau = document.getElementById('hud-tau');
  const hudAttractor = document.getElementById('hud-attractor');
  const briefTitle = document.getElementById('brief-title');
  const briefBody = document.getElementById('brief-body');
  const briefPanel = document.getElementById('attractor-brief');
  const attractorToggle = document.getElementById('attractor-toggle');

  if (heroCanvas) {
    const ctx = setupCanvas(heroCanvas);

    const ATTRACTORS = [
      {
        name: 'Lorenz attractor',
        brief: 'A canonical chaotic system. In neuroscience it is a benchmark for state-space identification and a model of chaotic regimes in recurrent cortical activity.',
        dt: 0.012,
        seedR: 1.0,
        field: (x, y, z) => {
          const s = 10, r = 28, b = 8/3, k = 0.05;
          return [s*(y - x)*k, (x*(r - z) - y)*k, (x*y - b*z)*k];
        },
        scale: 0.04,
        center: [0, 0, 25],
      },
      {
        name: 'Ring attractor',
        brief: 'A circular manifold whose phase encodes a continuous variable. Used to model head-direction cells and working memory for angular quantities.',
        dt: 0.02,
        seedR: 1.6,
        field: (x, y, z) => {
          const r = Math.hypot(x, y) || 1e-6;
          const rad = (1.4 - r);
          const tang = 1.0;
          return [
            rad * (x/r) - tang * (y/r),
            rad * (y/r) + tang * (x/r),
            -0.6 * z
          ];
        },
        scale: 0.9,
        center: [0, 0, 0],
      },
      {
        name: 'Line attractor',
        brief: 'A 1D manifold of stable states. Proposed to support graded persistent activity in neural integrators — classically the oculomotor velocity-to-position integrator.',
        dt: 0.02,
        seedR: 1.8,
        field: (x, y, z) => {
          return [-0.04 * x, -1.0 * y, -1.0 * z];
        },
        scale: 0.8,
        center: [0, 0, 0],
      },
      {
        name: 'Point attractor',
        brief: 'A single stable fixed point. Hopfield-style memory networks store patterns as families of point attractors; decision dynamics relax toward one of several.',
        dt: 0.02,
        seedR: 2.0,
        field: (x, y, z) => {
          return [-0.55 * x, -0.55 * y, -0.55 * z];
        },
        scale: 0.9,
        center: [0, 0, 0],
      },
      {
        name: 'Limit cycle (Van der Pol)',
        brief: 'A closed periodic orbit that attracts nearby trajectories. Models neural oscillators — respiratory rhythm, central pattern generators, gamma rhythms.',
        dt: 0.02,
        seedR: 1.4,
        field: (x, y, z) => {
          const mu = 1.4;
          return [y * 0.7, (mu * (1 - x*x) * y - x) * 0.7, -0.5 * z];
        },
        scale: 0.8,
        center: [0, 0, 0],
      },
      {
        name: 'Saddle (heteroclinic chain)',
        brief: 'Trajectories pass between saddle fixed points in a fixed order. Proposed as a substrate for stable sequence generation in olfactory and motor systems.',
        dt: 0.018,
        seedR: 1.4,
        field: (x, y, z, t) => {
          const a = Math.sin(t * 0.25);
          return [
            (y - a * x) * 0.5,
            (-x - 0.4*y) * 0.5 + 0.4 * Math.sin(z),
            -0.4 * z + 0.3 * Math.cos(x + y)
          ];
        },
        scale: 0.85,
        center: [0, 0, 0],
      },
      {
        name: 'Wilson–Cowan (E/I oscillator)',
        brief: 'A reduced excitatory–inhibitory rate model that bifurcates from a fixed point to a limit cycle. The classical mean-field picture of cortical gamma and balanced-network oscillations.',
        dt: 0.04,
        seedR: 1.2,
        field: (x, y, z) => {
          // x = E rate, y = I rate; sigmoid transfer
          const sig = (u) => 1 / (1 + Math.exp(-u));
          const dx = -x + sig(11*x - 12*y - 2.5);
          const dy = (-y + sig(13*x - 5*y  - 6.0)) * 0.5;
          return [dx * 1.4, dy * 1.4, -0.5 * z];
        },
        scale: 2.4,
        center: [0.30, 0.25, 0],
      },
      {
        name: 'FitzHugh–Nagumo (spiking)',
        brief: 'A 2-D reduction of the Hodgkin–Huxley equations. Captures the spike-and-recover excitability of a neuron — a relaxation oscillator when the input crosses threshold.',
        dt: 0.05,
        seedR: 1.6,
        field: (x, y, z) => {
          const a = 0.7, b = 0.8, eps = 0.08, I = 0.5;
          return [
            (x - x*x*x/3 - y + I) * 0.8,
            eps * (x + a - b*y)   * 0.8,
            -0.5 * z
          ];
        },
        scale: 0.9,
        center: [0, 0, 0],
      },
      {
        name: 'Wong–Wang (decision)',
        brief: 'A two-population mean-field model of perceptual decision-making. Mutual inhibition between competing pools yields two stable high-rate states — the network commits to one choice.',
        dt: 0.04,
        seedR: 1.4,
        field: (x, y, z) => {
          const f = (u) => u / (1 + Math.abs(u));
          const a = 0.9, b = 1.2, I = 0.35;
          return [
            (-x + f(I + a*x - b*y)) * 0.9,
            (-y + f(I + a*y - b*x)) * 0.9,
            -0.4 * z
          ];
        },
        scale: 1.4,
        center: [0, 0, 0],
      },
    ];

    const HERO = {
      N: 320,
      points: [],
      mouse: { x: 0, y: 0, active: false },
      t: 0,
      frame: 0,
      idx: 0,
      phase: 1,            // 0..1, smooth crossfade between attractors
      switchAt: 28.0,      // seconds between attractor switches
      lastSwitch: 0,
    };

    function seed(spread = 1.6) {
      HERO.points = [];
      for (let i = 0; i < HERO.N; i++) {
        const r = Math.cbrt(Math.random()) * spread;
        const theta = Math.acos(2 * Math.random() - 1);
        const phi = Math.random() * Math.PI * 2;
        HERO.points.push({
          x: r * Math.sin(theta) * Math.cos(phi),
          y: r * Math.sin(theta) * Math.sin(phi),
          z: r * Math.cos(theta),
          history: [],
        });
      }
      if (hudN) hudN.textContent = HERO.N;
    }
    seed();

    function setAttractor(i) {
      HERO.idx = (i + ATTRACTORS.length) % ATTRACTORS.length;
      const a = ATTRACTORS[HERO.idx];
      if (hudAttractor) hudAttractor.textContent = a.name;
      if (briefTitle) briefTitle.textContent = a.name;
      if (briefBody) briefBody.textContent = a.brief;
      if (hudTau) hudTau.textContent = a.dt.toFixed(3) + ' s';
      seed(a.seedR || 1.6);
    }
    setAttractor(0);

    const attractorMenu = document.getElementById('attractor-menu');

    function renderAttractorMenu() {
      if (!attractorMenu) return;
      attractorMenu.innerHTML = '';
      ATTRACTORS.forEach((a, i) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'attractor-menu-item';
        btn.setAttribute('role', 'option');
        btn.textContent = a.name;
        if (i === HERO.idx) btn.setAttribute('aria-current', 'true');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          setAttractor(i);
          HERO.lastSwitch = HERO.t;
          renderAttractorMenu();
          closeAttractorMenu();
        });
        li.appendChild(btn);
        attractorMenu.appendChild(li);
      });
    }
    function positionAttractorMenu() {
      if (!attractorMenu || !attractorToggle) return;
      const r = attractorToggle.getBoundingClientRect();
      const menuW = attractorMenu.offsetWidth || 200;
      // Align the menu's right edge with the toggle's right edge, drop it 6px
      // below. Clamp inside the viewport so the bottom items never run off.
      let left = Math.max(8, r.right - menuW);
      let top = r.bottom + 6;
      const maxTop = window.innerHeight - attractorMenu.offsetHeight - 8;
      if (attractorMenu.offsetHeight && top > maxTop) top = maxTop;
      attractorMenu.style.left = left + 'px';
      attractorMenu.style.top  = top + 'px';
    }
    function openAttractorMenu() {
      if (!attractorMenu || !attractorToggle) return;
      renderAttractorMenu();
      attractorMenu.hidden = false;
      attractorMenu.setAttribute('data-open', 'true');
      attractorToggle.setAttribute('aria-expanded', 'true');
      // Position after a paint so offsetHeight reflects the rendered menu.
      positionAttractorMenu();
      requestAnimationFrame(positionAttractorMenu);
      if (briefPanel) briefPanel.hidden = false;
    }
    function closeAttractorMenu() {
      if (!attractorMenu || !attractorToggle) return;
      attractorMenu.removeAttribute('data-open');
      attractorMenu.hidden = true;
      attractorToggle.setAttribute('aria-expanded', 'false');
    }
    window.addEventListener('scroll', () => {
      if (attractorMenu && !attractorMenu.hidden) positionAttractorMenu();
    }, { passive: true });
    window.addEventListener('resize', () => {
      if (attractorMenu && !attractorMenu.hidden) positionAttractorMenu();
    });
    attractorToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const open = attractorToggle.getAttribute('aria-expanded') === 'true';
      if (open) closeAttractorMenu(); else openAttractorMenu();
    });
    // Close on outside click. Use closest() so clicking inside any descendant
    // of the toggle or menu (icon span, on-state, etc.) does not dismiss.
    document.addEventListener('click', (e) => {
      if (!attractorMenu || attractorMenu.hidden) return;
      if (e.target.closest('#attractor-menu')) return;
      if (e.target.closest('#attractor-toggle')) return;
      closeAttractorMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAttractorMenu();
    });

    function project(x, y, z, t, w, h, ctr) {
      const cx = ctr ? ctr[0] : 0, cy = ctr ? ctr[1] : 0, cz = ctr ? ctr[2] : 0;
      const ang = t * 0.06;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const xr = (x - cx) * ca - (z - cz) * sa;
      const zr = (x - cx) * sa + (z - cz) * ca;
      const scale = Math.min(w, h) * 0.28;
      const persp = 1 / (4 - zr * 0.5);
      return [
        w * 0.5 + xr * scale * persp * 1.3,
        h * 0.5 + ((y - cy) * 0.95 + zr * 0.05) * scale * persp,
        persp
      ];
    }

    function drawGrid(w, h, t) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const step = 80;
      for (let x = step; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = step; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
    }

    const PARTICLE_HUES = [0, 28, 50, 140, 210];

    function step() {
      const w = heroCanvas.clientWidth;
      const h = heroCanvas.clientHeight;

      // background trail tinted to match site bg
      ctx.fillStyle = 'rgba(26,58,163,0.10)';
      ctx.fillRect(0, 0, w, h);

      HERO.t += 1/60;
      HERO.frame++;

      drawGrid(w, h, HERO.t);

      // periodic attractor switching
      if (HERO.t - HERO.lastSwitch > HERO.switchAt) {
        HERO.lastSwitch = HERO.t;
        setAttractor(HERO.idx + 1);
      }

      const A = ATTRACTORS[HERO.idx];
      const mx = HERO.mouse.x, my = HERO.mouse.y;

      for (let i = 0; i < HERO.points.length; i++) {
        const p = HERO.points[i];
        const [fx, fy, fz] = A.field(p.x, p.y, p.z, HERO.t);
        p.x += fx * A.dt;
        p.y += fy * A.dt;
        p.z += fz * A.dt;
        p.x += (Math.random() - 0.5) * 0.02;
        p.y += (Math.random() - 0.5) * 0.02;
        p.z += (Math.random() - 0.5) * 0.02;

        const r2 = (p.x*p.x + p.y*p.y + p.z*p.z) * A.scale * A.scale;
        if (r2 > 8) { p.x *= 0.985; p.y *= 0.985; p.z *= 0.985; }

        const sx = p.x * A.scale + A.center[0] * 0;
        const sy = p.y * A.scale;
        const sz = p.z * A.scale;
        const [px, py, persp] = project(sx, sy, sz, HERO.t, w, h, A.center.map(c => c * A.scale));

        if (HERO.mouse.active) {
          const dx = mx - px, dy = my - py;
          const d2 = dx*dx + dy*dy;
          if (d2 < 22000) {
            const f = (1 - d2 / 22000) * 0.0008;
            p.x += dx * f / 30;
            p.y += dy * f / 30;
          }
        }

        p.history.push([px, py]);
        if (p.history.length > 8) p.history.shift();

        const hue = PARTICLE_HUES[i % PARTICLE_HUES.length];

        ctx.strokeStyle = `hsla(${hue},92%,72%,0.30)`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let k = 0; k < p.history.length; k++) {
          const [hx, hy] = p.history[k];
          k === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
        }
        ctx.stroke();

        const size = Math.max(0.7, persp * 1.7);
        ctx.fillStyle = `hsla(${hue},92%,68%,${0.75 * Math.min(1, persp)})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (hudF) hudF.textContent = String(HERO.frame).padStart(6, '0');
      if (!reduceMotion) requestAnimationFrame(step);
    }

    heroCanvas.addEventListener('mousemove', e => {
      const r = heroCanvas.getBoundingClientRect();
      HERO.mouse.x = e.clientX - r.left;
      HERO.mouse.y = e.clientY - r.top;
      HERO.mouse.active = true;
    });
    heroCanvas.addEventListener('mouseleave', () => HERO.mouse.active = false);

    step();
  }

  /* =========================================================
     RASTER strip — white spike trains
     ========================================================= */
  const rasterCanvas = null;
  if (rasterCanvas) {
    const ctx = setupCanvas(rasterCanvas);
    const N_UNITS = 32;
    const WINDOW = 1.2;
    const spikes = Array.from({ length: N_UNITS }, () => []);
    let last = performance.now(), t = 0;

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      for (let i = 0; i < N_UNITS; i++) {
        const baseRate = 1.5 + 2.5 * (0.5 + 0.5 * Math.sin(t * 0.6 + i * 0.4));
        if (Math.random() < baseRate * dt) spikes[i].push(t);
        while (spikes[i].length && t - spikes[i][0] > WINDOW) spikes[i].shift();
      }
      const w = rasterCanvas.clientWidth, h = rasterCanvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const laneH = h / N_UNITS;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w - 1, 0); ctx.lineTo(w - 1, h); ctx.stroke();
      for (let i = 0; i < N_UNITS; i++) {
        const y = (i + 0.5) * laneH;
        for (const s of spikes[i]) {
          const age = t - s;
          const x = w - (age / WINDOW) * w;
          const alpha = 0.35 + 0.55 * (1 - age / WINDOW);
          ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(x, y - laneH * 0.4); ctx.lineTo(x, y + laneH * 0.4);
          ctx.stroke();
        }
      }
      if (!reduceMotion) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* =========================================================
     RESEARCH — clickable anchor labels → expand matching interest
     ========================================================= */
  document.querySelectorAll('.brain-anchor').forEach((a) => {
    a.setAttribute('role', 'button');
    a.setAttribute('tabindex', '0');

    const open = () => {
      const no = a.querySelector('.ba-no')?.textContent?.trim();
      if (!no) return;
      // Match against the corresponding .interest <details>
      const target = [...document.querySelectorAll('.interest')].find((d) => {
        return d.querySelector('.i-no')?.textContent?.trim() === no;
      });
      if (!target) return;
      // Close siblings, open target, scroll into view.
      document.querySelectorAll('.interest[open]').forEach((d) => {
        if (d !== target) d.removeAttribute('open');
      });
      target.setAttribute('open', '');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.querySelector('summary')?.focus({ preventScroll: true });
    };

    a.addEventListener('click', open);
    a.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
})();
