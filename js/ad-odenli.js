/* Ad #3 · Odenli — a movie-trailer teaser, no link. Wording from odenli.com; look from its own palette and OG image.
   Beat 1 plays by itself: "In a world…" → "…where software makes you pick two." → three checkboxes that keep
   unticking each other ("The old rule says pick two.").
   Space → beat 2: "One company…" → all three tick → why: most apps start 80% built (Nick's line).
   Space → beat 3: particles build the lattice → Odenli. Space → back to the world. */
(() => {
  const el = document.getElementById('ad-odenli');
  if (!el) return;
  const $ = (s) => el.querySelector(s);
  const card = $('.od-card'), rule = $('.od-rule'), cursor = $('.od-cursor'), gl = $('.od-gl'), tags = $('.od-tags'), pct = $('.od-fill b');
  const FOUNDATION = ['sign-in', 'roles & permissions', 'data model', 'email', 'file uploads', 'billing', 'audit trail', 'background jobs', 'admin screens', 'deployment', 'monitoring', 'backups'];
  const boxes = [...el.querySelectorAll('.od-box')];
  const g = gl.getContext('2d');
  const LIME = [184, 255, 93], BLUE = [110, 145, 255];
  let alive = false, beat = 1, run = 0, raf = 0;

  const ok = (r) => alive && r === run;
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  async function title(html, ms, r) {
    card.innerHTML = html;
    card.classList.add('on');
    window.SFX?.boom();
    await Deck.sleep(ms);
    card.classList.remove('on');
    await Deck.sleep(550);
    return ok(r);
  }

  // stage-space centre of a box's checkbox (layout offsets ignore the stage's scale)
  function at(box) {
    const i = box.querySelector('i');
    let x = i.offsetWidth / 2, y = i.offsetHeight / 2;
    for (let n = i; n && n !== el; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return [x, y];
  }
  async function click(k, r) {
    const [x, y] = at(boxes[k]);
    cursor.style.setProperty('--cx', `${x - 8}px`);
    cursor.style.setProperty('--cy', `${y - 6}px`);
    await Deck.sleep(650);
    if (!ok(r)) return false;
    cursor.classList.remove('click'); void cursor.getBoundingClientRect(); cursor.classList.add('click');
    window.SFX?.tap();
    boxes[k].classList.add('on');
    return true;
  }
  async function untick(k, r) {
    await Deck.sleep(380);
    if (!ok(r)) return false;
    boxes[k].classList.remove('on');
    boxes[k].classList.add('no');
    window.SFX?.glitch(0.3);
    Deck.after(450, () => boxes[k].classList.remove('no'));
    await Deck.sleep(700);
    return ok(r);
  }

  function reset() {
    cancelAnimationFrame(raf);
    g.clearRect(0, 0, 1920, 1080);
    el.classList.remove('picking', 'all', 'found', 'stamped', 'brand');
    tags.innerHTML = ''; pct.textContent = '0%';
    card.classList.remove('on');
    boxes.forEach((b) => b.classList.remove('on', 'no'));
    rule.textContent = '';
    cursor.style.setProperty('--cx', '1500px');
    cursor.style.setProperty('--cy', '900px');
  }

  async function pickTwo(r) {
    reset();
    window.SFX?.humOn();
    await Deck.sleep(400);
    if (!await title('In a world…', 1900, r)) return;
    if (!await title('…where software makes you <br>pick two.', 2300, r)) return;
    el.classList.add('picking');
    await Deck.sleep(500);
    // tick two, then every third tick knocks another one off
    for (const [k, off] of [[0], [1], [2, 0], [0, 1], [1, 2]]) {
      if (!await click(k, r)) return;
      if (off != null && !await untick(off, r)) return;
      await Deck.sleep(250);
    }
    rule.textContent = 'The old rule says pick two.';
    window.SFX?.drop(100, 50);
  }

  async function allThree(r) {
    reset();
    window.SFX?.humOn();
    window.SFX?.humSwell();
    if (!await title('One company…', 1700, r)) return;
    el.classList.add('picking', 'all');
    boxes.forEach((b) => b.classList.add('on'));
    rule.textContent = 'We built Odenli around all three.';
    window.SFX?.chime();
    await Deck.sleep(2800);
    if (ok(r)) foundation(r);
  }

  // why all three: the foundation fills 80% of the bar, its pieces pop in as it goes
  async function foundation(r, instant = false) {
    tags.innerHTML = FOUNDATION.map((t) => `<span>${t}</span>`).join('');
    el.classList.add('found');
    const chips = [...tags.children];
    if (instant) { chips.forEach((c) => c.classList.add('on')); pct.textContent = '80%'; el.classList.add('stamped'); return; }
    window.SFX?.humOff(1.5);
    window.SFX?.start();
    const t0 = performance.now();
    const count = () => {
      if (!ok(r)) return;
      const k = Math.min(1, (performance.now() - t0) / 3200);
      pct.textContent = `${Math.round(80 * (1 - Math.pow(1 - k, 2.2)))}%`;
      if (k < 1) requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
    for (const c of chips) {
      await Deck.sleep(240);
      if (!ok(r)) return;
      c.classList.add('on'); window.SFX?.blip(chips.indexOf(c));
    }
    await Deck.sleep(700);
    if (!ok(r)) return;
    el.classList.add('stamped');
    window.SFX?.boom();
  }

  function brand(r) {
    el.classList.add('picking', 'all', 'found', 'stamped', 'brand');
    window.SFX?.humOff(0.5);
    window.SFX?.chime();
    lattice(r);
  }

  // ---- the lattice (after odenli.com's OG image): lime dust on the left, blue nodes snap into a hexagon ----
  function lattice(r) {
    const cx = 1440, cy = 560, R = 340, s = 68, apo = R * Math.cos(Math.PI / 6);
    const inHex = (x, y) => [0, 1, 2].every((k) => Math.abs((x - cx) * Math.cos(k * Math.PI / 3) + (y - cy) * Math.sin(k * Math.PI / 3)) <= apo + 1);
    const nodes = [];
    for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
      const x = cx + (i + j / 2) * s, y = cy + j * s * Math.sin(Math.PI / 3);
      if (!inHex(x, y)) continue;
      const sx = 960 + Math.random() * 260, sy = cy + (Math.random() - 0.5) * (sx - 860) * 1.2;
      nodes.push({ x, y, sx, sy, d: 0.15 + ((x - (cx - R)) / (2 * R)) * 1.1 + Math.random() * 0.35 });
    }
    const edges = [];
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) < s * 1.05) edges.push([nodes[a], nodes[b]]);
    }
    const dust = Array.from({ length: 260 }, () => {
      const x = 940 + Math.random() * 300;
      return { x, y: cy + (Math.random() - 0.5) * (x - 880) * 1.6 * Math.random(), r: 1 + Math.random() * 2, ph: Math.random() * 6.3 };
    });
    const ease = (k) => 1 - Math.pow(1 - k, 3);
    const t0 = performance.now();
    const frame = (now) => {
      if (!ok(r)) return;
      const t = (now - t0) / 1000;
      g.clearRect(0, 0, 1920, 1080);
      // frame lines + corner marks
      g.strokeStyle = 'rgba(110,145,255,.14)'; g.lineWidth = 1;
      g.strokeRect(40.5, 40.5, 1839, 999);
      // dust
      const fadeIn = Math.min(1, t / 1.2);
      for (const p of dust) {
        const k = (p.x - 940) / 300;
        g.fillStyle = rgba(mix(LIME, BLUE, k * 0.7), fadeIn * (0.35 + 0.35 * Math.sin(t * 2 + p.ph)));
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.29); g.fill();
      }
      // nodes travel from the dust into the lattice, turning from lime to blue
      for (const n of nodes) {
        n.k = ease(Math.max(0, Math.min(1, (t - n.d) / 1.5)));
        const sw = Math.sin(n.k * Math.PI) * 30;
        n.px = n.sx + (n.x - n.sx) * n.k; n.py = n.sy + (n.y - n.sy) * n.k - sw;
      }
      g.lineWidth = 1.4;
      for (const [a, b] of edges) {
        const k = Math.min(a.k, b.k);
        if (k < 0.85) continue;
        g.strokeStyle = rgba(BLUE, (k - 0.85) / 0.15 * 0.45);
        g.beginPath(); g.moveTo(a.px, a.py); g.lineTo(b.px, b.py); g.stroke();
      }
      for (const n of nodes) {
        const c = mix(LIME, BLUE, n.k);
        g.fillStyle = rgba(c, 0.18); g.beginPath(); g.arc(n.px, n.py, 11, 0, 6.29); g.fill();
        g.fillStyle = rgba(c, 1); g.beginPath(); g.arc(n.px, n.py, n.k > 0.95 ? 5 : 3.5, 0, 6.29); g.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function setBeat(n, back = false) {
    beat = n;
    el.dataset.beat = String(n);
    const r = ++run;
    if (n === 1) pickTwo(r);
    else if (n === 2 && back) { reset(); el.classList.add('picking', 'all'); foundation(r, true); }
    else if (n === 2) allThree(r);
    else brand(r);
  }

  Deck.on('ad-odenli', {
    enter() { alive = true; setBeat(1); },
    leave() { alive = false; run++; cancelAnimationFrame(raf); window.SFX?.humOff(0.3); },
    next() {
      if (beat < 3) { setBeat(beat + 1); return true; }
      return false;
    },
    prev() {
      if (beat > 1) { window.SFX?.humOff(0.3); setBeat(beat - 1, true); return true; }
      return false;
    },
  });
})();
