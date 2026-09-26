/* AI Telephone deck — tiny zero-dependency slide engine.
   Canvas is a fixed 1920x1080 stage, scaled to fit.

   Keys: →/Space/PgDn next · ←/PgUp prev · Home/End · F fullscreen · O overview
         R replay current slide · B black screen · N notes window

   Slides are <section class="slide" id="…">. Scripts register behaviour with:

     Deck.on('slide-id', {
       enter(el) {},   // slide became active (start timelines here)
       leave(el) {},   // slide lost focus (stop timers, pause media)
       next(el) {},    // return true to consume a "next" press (e.g. skip / step)
     });

   Simple steps without JS: give elements class="step"; each "next" reveals the
   next one (adds .on) before moving to the following slide.

   Embed mode (used by the world map, world/index.html, which shows the deck in
   an iframe): ?embed=1&only=id,id#id — the HUD is hidden, navigation stays
   inside the `only` list, and Esc, or "next" on the last listed slide (when
   the slide doesn't consume it), posts { type: 'deck:exit', slide, reason }
   to the parent. &hold=1 waits for { type: 'deck:start' } before the first
   slide enters, so the parent can preload the deck invisibly. */
(() => {
  const W = 1920, H = 1080;
  const canvas = document.querySelector('.canvas');
  const params = new URLSearchParams(location.search);
  const EMBED = params.get('embed') === '1';
  const ONLY = (params.get('only') || '').split(',').filter(Boolean);
  const all = [...document.querySelectorAll('.slide')];
  const slides = EMBED && ONLY.length ? ONLY.map((id) => all.find((s) => s.id === id)).filter(Boolean) : all;
  const exit = (reason) => parent.postMessage({ type: 'deck:exit', slide: slides[i]?.id, reason }, '*');
  if (EMBED) {
    document.documentElement.classList.add('embed');
    document.querySelector('.hud').style.display = 'none';
  }
  const overview = document.getElementById('overview');
  const bar = document.querySelector('.hud .bar i');
  const count = document.querySelector('.hud .count');
  const handlers = {};
  let i = -1;

  const Deck = {
    on(id, h) { handlers[id] = h; if (slides[i]?.id === id) h.enter?.(slides[i]); },
    get index() { return i; },
    go: (n) => set(n),
    next, prev,
    // setTimeout that is cancelled automatically when the slide is left
    after(ms, fn) { const t = setTimeout(fn, ms); timers.push(t); return t; },
    sleep(ms) { return new Promise((r) => Deck.after(ms, r)); },
  };
  window.Deck = Deck;
  let timers = [];

  const size = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    canvas.style.transform = `translate(-50%, -50%) scale(${s})`;
  };
  addEventListener('resize', size);

  function media(s, play) {
    s.querySelectorAll('video[data-autoplay]').forEach((v) => {
      if (play) { v.currentTime = 0; v.play().catch(() => {}); } else v.pause();
    });
  }

  function set(n, { replay = false } = {}) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === i && !replay) return;
    const old = slides[i];
    if (old) {
      timers.forEach(clearTimeout); timers = [];
      handlers[old.id]?.leave?.(old);
      media(old, false);
      old.classList.remove('active');
      old.querySelectorAll('.step').forEach((e) => e.classList.remove('on'));
    }
    i = n;
    const cur = slides[i];
    void cur.offsetWidth; // restart CSS animations
    cur.classList.add('active');
    document.body.dataset.slide = cur.id || '';
    history.replaceState(null, '', `#${cur.id || i + 1}`);
    bar.style.width = `${((i + 1) / slides.length) * 100}%`;
    count.textContent = `${i + 1} / ${slides.length}`;
    media(cur, true);
    handlers[cur.id]?.enter?.(cur);
    markOverview();
    notes();
  }

  function next() {
    const cur = slides[i];
    if (handlers[cur.id]?.next?.(cur)) return;
    const step = cur.querySelector('.step:not(.on)');
    if (step) { step.classList.add('on'); return; }
    if (EMBED && i === slides.length - 1) { exit('end'); return; }
    set(i + 1);
  }
  function prev() { set(i - 1); }
  function replay() { const n = i; i = -1; slides[n].classList.remove('active'); set(n, { replay: true }); }

  // ---- presenter notes: <aside class="notes"> inside a slide, press N ----
  let notesWin = null;
  function notes() {
    if (!notesWin || notesWin.closed) return;
    const cur = slides[i], nx = slides[i + 1];
    notesWin.document.body.innerHTML =
      `<h3>${i + 1}/${slides.length} · ${cur.dataset.title || cur.id}</h3>` +
      `<div>${cur.querySelector('.notes')?.innerHTML || '<em>no notes</em>'}</div>` +
      `<p style="opacity:.5">next → ${nx ? nx.dataset.title || nx.id : 'end'}</p>`;
  }

  // ---- overview grid ----
  function buildOverview() {
    slides.forEach((s, n) => {
      const t = document.createElement('button');
      t.className = 'thumb';
      t.innerHTML = `<b>${n + 1}</b><span>${s.dataset.title || s.id}</span>`;
      t.onclick = (e) => { e.stopPropagation(); overview.classList.remove('on'); set(n); };
      overview.appendChild(t);
    });
  }
  function markOverview() {
    overview.querySelectorAll('.thumb').forEach((t, n) => t.classList.toggle('cur', n === i));
  }

  function onKey(e) {
    if (e.target.closest?.('input, textarea')) return;
    const k = e.key;
    if (overview.classList.contains('on')) {
      if (k === 'Escape' || k === 'o' || k === 'O') overview.classList.remove('on');
      return;
    }
    if (EMBED && k === 'Escape') { exit('esc'); return; }
    if (EMBED && (k === 'f' || k === 'F')) { parent.postMessage({ type: 'deck:key', key: 'f' }, '*'); return; }
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') set(0);
    else if (k === 'End') set(slides.length - 1);
    else if (k === 'f' || k === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    else if (k === 'o' || k === 'O') overview.classList.toggle('on');
    else if (k === 'r' || k === 'R') replay();
    else if (k === 'b' || k === 'B' || k === '.') document.body.classList.toggle('blackout');
    else if (k === 'n' || k === 'N') {
      notesWin = open('', 'deck-notes', 'width=640,height=480');
      notesWin.document.title = 'Notes';
      notesWin.document.body.style.cssText = 'font:20px/1.5 system-ui;background:#111;color:#eee;padding:20px';
      notes();
    }
  }
  addEventListener('keydown', onKey);
  addEventListener('click', (e) => {
    if (e.target.closest('a, button, video[controls], .no-advance') || overview.classList.contains('on')) return;
    next();
  });

  size();
  buildOverview();
  const fromHash = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    const byId = slides.findIndex((s) => s.id === h);
    return byId >= 0 ? byId : (parseInt(h, 10) || 1) - 1;
  };
  // let per-slide scripts (loaded after this one) register before the first enter
  let started = false;
  const start = () => { if (!started) { started = true; set(fromHash()); } };
  if (EMBED) {
    // the world forwards keys it caught while the deck was open but unfocused
    addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type === 'deck:start') { if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start(); }
      else if (d.type === 'deck:key' && started) onKey({ key: d.key, target: document.body, preventDefault() {} });
    });
  }
  if (!(EMBED && params.get('hold') === '1')) addEventListener('DOMContentLoaded', start);
  addEventListener('hashchange', () => { const n = fromHash(); if (n !== i) set(n); });
})();
