/* T3 deck — tiny zero-dependency slideshow. Open slides/index.html in a browser.
   Keys: ←/→ or Space/PageUp/PageDown move, Home/End jump, F fullscreen,
         O overview grid, R restart the current slide (re-play gifs/animations). */
(() => {
  const canvas = document.querySelector('.canvas');
  const slides = [...document.querySelectorAll('.slide')];
  const overview = document.getElementById('overview');
  const HUD = {
    bar: document.querySelector('.hud .bar i'),
    count: document.querySelector('.hud .count'),
    title: document.querySelector('.hud .title'),
  };
  let i = 0;

  const size = () => {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    canvas.style.transform = `scale(${s})`;
  };
  window.addEventListener('resize', size);

  function set(iNext) {
    i = Math.max(0, Math.min(slides.length - 1, iNext));
    const cur = slides[i];
    slides.forEach((s) => {
      s.classList.remove('active', 'is-leaving');
      pauseMedia(s);
    });
    cur.classList.add('active');
    history.replaceState(null, '', `#${i + 1}`);
    HUD.bar.style.width = `${((i + 1) / slides.length) * 100}%`;
    HUD.count.textContent = `${i + 1}/${slides.length}`;
    HUD.title.textContent = cur.dataset.title || '';
    playMedia(cur);
    markOverview();
  }

  function next() { set(i + 1); }
  function prev() { set(i - 1); }

  function playMedia(s) {
    s.querySelectorAll('video, hyperframes-player').forEach((m) => {
      if ('play' in m && typeof m.play === 'function') m.play().catch(() => {});
    });
  }
  function pauseMedia(s) {
    s.querySelectorAll('video, hyperframes-player').forEach((m) => {
      if ('pause' in m && typeof m.pause === 'function') m.pause();
    });
  }

  function restartCurrent() {
    const cur = slides[i];
    cur.classList.remove('active');
    void cur.offsetWidth; // force reflow so CSS animations replay
    pauseMedia(cur);
    ['video', 'img.gif'].forEach(() => {});
    [...cur.querySelectorAll('video')].forEach((v) => {
      v.currentTime = 0;
      const p = v.play();
      if (p) p.catch(() => {});
    });
    cur.classList.add('active');
  }

  // ---- overview grid (thumbnails that reuse the real slides) -----
  function buildOverview() {
    overview.innerHTML = '';
    slides.forEach((s, n) => {
      const t = document.createElement('div');
      t.className = 'thumb';
      t.title = s.dataset.title || `slide ${n + 1}`;
      const can = document.createElement('div');
      can.className = 't-canvas';
      const clone = s.cloneNode(true);
      clone.classList.remove('active');
      clone.style.visibility = 'visible';
      clone.style.opacity = '1';
      clone.style.transform = 'none';
      can.appendChild(clone);
      const c = document.createElement('div');
      c.className = 't-count';
      c.textContent = n + 1;
      t.append(can, c);
      t.addEventListener('click', () => { overview.classList.remove('on'); set(n); });
      overview.appendChild(t);
    });
  }
  function markOverview() {
    overview.querySelectorAll('.thumb').forEach((t, n) => t.classList.toggle('active-t', n === i));
  }

  document.addEventListener('keydown', (e) => {
    if (overview.classList.contains('on')) {
      if (e.key === 'Escape' || e.key === 'o') overview.classList.remove('on');
      return;
    }
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') { e.preventDefault(); set(0); }
    else if (k === 'End') { e.preventDefault(); set(slides.length - 1); }
    else if (k === 'f' || k === 'F') { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
    else if (k === 'o' || k === 'O') { e.preventDefault(); overview.classList.toggle('on'); }
    else if (k === 'r' || k === 'R') restartCurrent();
  });
  // click anywhere advances (except on links)
  document.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (overview.classList.contains('on')) return;
    next();
  });
  // wheel: trackpads nudge
  let wheelAt = 0;
  document.addEventListener('wheel', (e) => {
    if (Date.now() - wheelAt < 350) return;
    if (Math.abs(e.deltaY) < 8) return;
    wheelAt = Date.now();
    e.deltaY > 0 ? next() : prev();
  });

  size();
  buildOverview();
  set(parseInt(location.hash.replace('#', ''), 10) - 1 || 0);
  window.addEventListener('hashchange', () => set(parseInt(location.hash.replace('#', ''), 10) - 1 || 0));
})();