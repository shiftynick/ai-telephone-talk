// One little diorama per stop. Each builder returns { group, anchor, update? }.
// Local frame: y up, +z faces the camera, origin on the ground behind the
// stop's pad. V = voxel size (8 voxels per world unit; the mascot is 1 unit).
import * as THREE from 'three';
import { Vox, voxGeometry, voxMaterial, hash3 } from './vox.js';

export const V = 0.125;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- helpers
const loader = new THREE.TextureLoader();
const img = (url) => { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.redraw = (...a) => { draw(g, w, h, ...a); t.needsUpdate = true; };
  t.redraw(0);
  return t;
}
const solid = (vox, origin = [0, 0, 0]) => {
  const m = new THREE.Mesh(voxGeometry(vox, V, origin), voxMaterial);
  m.castShadow = true; m.receiveShadow = true;
  return m;
};
const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
function glow(vox, k = 2.2, origin = [0, 0, 0]) {
  const g = voxGeometry(vox, V, origin, { ao: false, jitter: 0.04 });
  const c = g.attributes.color.array;
  for (let i = 0; i < c.length; i++) c[i] *= k;
  return new THREE.Mesh(g, glowMat);
}
function screen(w, h, map, k = 1.15) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, color: new THREE.Color(k, k, k), toneMapped: true }));
  return m;
}
const FONT = (px, w = 700, fam = '"Space Grotesk", system-ui, sans-serif') => `${w} ${px}px ${fam}`;
const MONO = (px, w = 600) => `${w} ${px}px "JetBrains Mono", ui-monospace, monospace`;
const SERIF = (px, it = false) => `${it ? 'italic ' : ''}400 ${px}px "Instrument Serif", Georgia, serif`;
// voxel line between two points (for braces, wires)
function line(v, a, b, c) {
  const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])));
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    v.set(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), c);
  }
}
// rising voxel smoke from a point (local), returns update fn
function smoke(group, at, { n = 6, color = 0xd9d3cf, size = 0.16, rise = 0.5, life = 3.2, spread = 0.25 } = {}) {
  const g = new THREE.BoxGeometry(size, size, size);
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, emissive: 0x6a6460, transparent: true, opacity: 0, roughness: 1, depthWrite: false }));
    group.add(m);
    puffs.push({ m, age: (i / n) * life, vx: 0, vz: 0 });
  }
  return (dt) => {
    for (const p of puffs) {
      p.age += dt;
      if (p.age > life) { p.age -= life; p.m.position.copy(at); p.vx = (Math.random() - 0.5) * spread; p.vz = (Math.random() - 0.5) * spread; }
      const k = p.age / life;
      p.m.position.x += (p.vx + 0.12) * dt; p.m.position.z += p.vz * dt; p.m.position.y += rise * dt;
      p.m.scale.setScalar(0.6 + k * 2.2);
      p.m.rotation.y += dt * 0.7;
      p.m.material.opacity = 0.7 * (1 - k) * Math.min(1, p.age * 4);
    }
  };
}
const pick = (arr, x, y, z) => arr[Math.floor(hash3(x, y, z) * arr.length) % arr.length];

// ---------------------------------------------------------------- 1 · phone booth (start)
function phonebooth() {
  const group = new THREE.Group();
  const v = new Vox(), gl = new Vox();
  const RED = 0xc9232d, RED2 = 0xb01f28, DARK = 0x8e1a20;
  v.box(-7, 6, 0, 0, -7, 6, 0x9a938a);           // stone step
  v.box(-6, 5, 1, 1, -6, 5, DARK);
  v.box(-5, 4, 2, 19, -5, 4, (x, y) => (y % 6 === 1 ? RED2 : RED));
  // windows on all four faces: 3 x 4 panes
  const pane = (a, y) => (a + 4) % 3 !== 2 && (y - 6) % 3 !== 2;
  for (let y = 6; y <= 15; y++) for (let a = -4; a <= 3; a++) {
    if (!pane(a, y)) continue;
    for (const [x, z] of [[a, 4], [a, -5], [4, a], [-5, a]]) { v.del(x, y, z); gl.set(x, y, z, 0xffdc9c); }
  }
  // sign band, roof, crown
  v.box(-5, 4, 17, 18, -5, 4, 0x1c1a1f);
  v.box(-6, 5, 20, 20, -6, 5, RED2);
  v.box(-5, 4, 21, 21, -5, 4, RED);
  v.box(-4, 3, 22, 22, -4, 3, RED);
  v.box(-3, 2, 23, 23, -3, 2, RED2);
  v.box(-1, 0, 24, 25, -1, 0, 0xe0b44c);
  v.box(-2, -2, 13, 13, 5, 5, 0xe0b44c); // door handle
  const body = new THREE.Group();
  body.add(solid(v), glow(gl, 1.9));
  const sign = canvasTex(256, 40, (g, w, h) => {
    g.fillStyle = '#1c1a1f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff6e4'; g.font = FONT(26, 700); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('TELEPHONE', w / 2, h / 2 + 1);
  });
  for (const [x, z, ry] of [[0, 0.64, 0], [0.64, 0, Math.PI / 2], [-0.64, 0, -Math.PI / 2]]) {
    const s = screen(1.1, 0.2, sign, 1.6);
    s.position.set(x - 0.06 * (ry ? 0 : 1) + 0.0, 18.5 * V, z);
    s.position.set(x ? x : -0.06, 18.5 * V, z ? z : -0.06);
    s.rotation.y = ry;
    body.add(s);
  }
  group.add(body);
  // a small "START" pennant on a pole
  const flag = new Vox();
  flag.box(12, 12, 0, 22, 0, 0, 0x5a4a3a);
  group.add(solid(flag));
  const pennant = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#ff5b1f'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h / 2); g.lineTo(0, h); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = FONT(20, 700); g.textBaseline = 'middle'; g.fillText('START', 8, h / 2 + 1);
  });
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45, 8, 1), new THREE.MeshStandardMaterial({ map: pennant, transparent: true, side: THREE.DoubleSide, roughness: 0.8 }));
  pf.position.set(12.5 * V + 0.45, 21 * V, 0.06);
  pf.castShadow = true;
  group.add(pf);
  // the meetup's logo on a round sign, left of the booth
  {
    const sv = new Vox();
    sv.box(-19, -18, 0, 14, 1, 2, 0x5a4a3a);
    group.add(solid(sv));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.78, 40), new THREE.MeshStandardMaterial({ map: img('../assets/dirtysouthailogo.png'), roughness: 0.7 }));
    disc.position.set(-18 * V, 19 * V, 2 * V + 0.14);
    disc.rotation.y = 0.3;
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.08, 40), new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.8 }));
    back.rotation.x = Math.PI / 2;
    back.position.set(0, 0, -0.05);
    disc.add(back);
    back.castShadow = true;
    group.add(disc);
  }
  const pos = pf.geometry.attributes.position, base = pos.array.slice();
  let lastPh = 99;
  // it rings every few seconds (it's the cold open: "incoming signal")
  return {
    group, anchor: new THREE.Vector3(0, 3.9, 0),
    update(dt, t, ctx) {
      const ph = t % 4.5;
      if (ph < lastPh && ctx?.ringVol > 0) ctx.audio?.ring(ctx.ringVol);
      lastPh = ph;
      const ring = ph < 0.9 ? Math.sin(ph * 60) * 0.03 * (1 - ph / 0.9) : 0;
      body.rotation.z = ring;
      body.position.y = ring ? Math.abs(ring) * 0.3 : 0;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3] + 0.45;
        pos.array[i * 3 + 2] = Math.sin(t * 5 + x * 5) * 0.06 * x;
      }
      pos.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- 2 · cottage (who am I)
function house() {
  const group = new THREE.Group();
  const v = new Vox(), gl = new Vox();
  const WALL = [0xf0e3c6, 0xeadcbc], BEAM = 0x6b4a33, ROOF = [0xb4553c, 0xa64c35, 0xbd5d42];
  const X0 = -12, X1 = 11, Z0 = -8, Z1 = 7, TOP = 13;
  v.box(X0, X1, 0, TOP, Z0, Z1, (x, y, z) => (y < 2 ? pick([0x9d948a, 0x8f877d], x, y, z) : pick(WALL, x, y, z)));
  for (const x of [X0, X1]) for (const z of [Z0, Z1]) v.box(x, x, 2, TOP, z, z, BEAM);
  for (let x = X0; x <= X1; x++) { v.paint(x, 7, Z1, BEAM); v.paint(x, TOP, Z1, BEAM); }
  for (let z = Z0; z <= Z1; z++) { v.paint(X0, 7, z, BEAM); v.paint(X1, 7, z, BEAM); v.paint(X0, TOP, z, BEAM); v.paint(X1, TOP, z, BEAM); }
  // door + windows on the front
  v.box(-2, 1, 1, 9, Z1, Z1, 0x7a4f30);
  v.set(1, 5, Z1 + 1, 0xe0b44c);
  for (const [a, b] of [[-9, -5], [4, 8]]) {
    for (let x = a; x <= b; x++) for (let y = 4; y <= 10; y++) {
      const bar = x === a + 2 || y === 7;
      v.del(x, y, Z1);
      if (bar) v.set(x, y, Z1, BEAM); else gl.set(x, y, Z1, 0xffcf85);
    }
    v.box(a - 1, b + 1, 3, 3, Z1 + 1, Z1 + 1, BEAM);           // sill
    for (let x = a; x <= b; x++) v.set(x, 4, Z1 + 1, pick([0xff6f91, 0xffd34d, 0xff8a4d], x, 4, 1)); // flower box
  }
  // side window
  for (let z = -4; z <= 2; z++) for (let y = 4; y <= 10; y++) { v.del(X1, y, z); if (z === -1 || y === 7) v.set(X1, y, z, BEAM); else gl.set(X1, y, z, 0xffcf85); }
  // gable roof, ridge running front-to-back
  for (let L = 0; L <= 12; L++) {
    const y = TOP + 1 + L, xa = X0 - 1 + L, xb = X1 + 1 - L;
    if (xa > xb) break;
    for (let z = Z0 - 1; z <= Z1 + 1; z++) {
      for (const x of [xa, xa + 1, xb, xb - 1]) if (x >= xa && x <= xb) v.set(x, y, z, pick(ROOF, x, y, L % 2));
    }
    for (let x = xa + 2; x <= xb - 2; x++) { v.set(x, y, Z1, pick(WALL, x, y, 0)); v.set(x, y, Z0, pick(WALL, x, y, 1)); }
  }
  // round attic window
  for (const [x, y] of [[-1, 17], [0, 17], [-1, 18], [0, 18]]) { v.del(x, y, Z1); gl.set(x, y, Z1, 0xffcf85); }
  // chimney
  v.box(5, 7, 16, 26, -4, -2, (x, y) => (y % 2 ? 0x9b4e3c : 0x8c4535));
  v.box(4, 8, 27, 27, -5, -1, 0x6f3a2d);
  // front step + mailbox
  v.box(-3, 2, 0, 0, Z1 + 1, Z1 + 2, 0xa39a8e);
  v.box(15, 15, 0, 7, 10, 10, 0x6b4a33);
  v.box(14, 16, 8, 10, 8, 12, 0x3d5a99);
  v.set(17, 10, 11, 0xff5b1f); v.set(17, 11, 11, 0xff5b1f);
  // picket fence along the front edge
  for (let x = X0 - 2; x <= X1 + 2; x++) {
    if (x >= -4 && x <= 3) continue;
    if (x % 2 === 0) v.box(x, x, 0, 4, Z1 + 6, Z1 + 6, 0xf4efe6);
    v.set(x, 3, Z1 + 6, 0xe6dfd2);
  }
  group.add(solid(v), glow(gl, 1.8));
  const up = smoke(group, new THREE.Vector3(6 * V + 0.06, 28 * V, -3 * V + 0.06), { n: 7 });
  return { group, anchor: new THREE.Vector3(0, 4.4, 0), update: (dt) => up(dt) };
}

// ---------------------------------------------------------------- 3 · Omarchy: giant monitor, tiling windows
function omarchy() {
  const group = new THREE.Group();
  const v = new Vox();
  const BZ = 0x1d1c24;
  v.box(-16, 15, 7, 28, -1, 0, BZ);
  v.box(-2, 1, 2, 6, -2, -1, 0x2a2932);
  v.box(-8, 7, 0, 1, -5, 2, 0x2a2932);
  v.box(-1, 0, 7, 7, 1, 1, 0x5ce1e6); // power led
  group.add(solid(v));
  const logo = new Image(); logo.src = '../assets/omarchy.png';
  const W = 768, H = 480;
  let layout = [];
  const tex = canvasTex(W, H, (g, w, h, t = 0) => {
    const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1a1b26'); bg.addColorStop(1, '#2a2440');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // waybar
    g.fillStyle = '#16161e'; g.fillRect(0, 0, w, 26);
    g.font = MONO(14, 700); g.textBaseline = 'middle';
    ['1', '2', '3', '4', '5'].forEach((n, i) => { g.fillStyle = i === 0 ? '#7aa2f7' : '#565f89'; g.fillText(n, 12 + i * 22, 14); });
    g.fillStyle = '#c0caf5'; g.textAlign = 'center'; g.fillText('Sat 21:37', w / 2, 14); g.textAlign = 'left';
    g.fillStyle = '#9ece6a'; g.fillText('▮▮▮▯ 87%', w - 110, 14);
    for (const [i, r] of layout.entries()) {
      const [x, y, ww, hh] = r;
      if (ww < 12 || hh < 12) continue;
      g.save();
      g.beginPath(); g.roundRect(x, y, ww, hh, 9); g.fillStyle = '#1a1b26'; g.fill();
      g.lineWidth = 3; g.strokeStyle = i === layout.length - 1 ? '#7aa2f7' : '#414868'; g.stroke();
      g.clip();
      const kind = i % 4;
      if (kind === 0) {
        g.fillStyle = '#9ece6a'; g.font = MONO(15);
        const lines = ['~ ❯ omarchy-update', ':: synchronizing…', ':: 42 packages', '~ ❯ hyprctl dispatch', '~ ❯ btop', '~ ❯ ▍'];
        lines.forEach((l, n) => { g.fillStyle = n % 3 === 0 ? '#9ece6a' : '#a9b1d6'; g.fillText(l, x + 14, y + 26 + n * 21); });
      } else if (kind === 1) {
        if (logo.complete && logo.naturalWidth) {
          const s = Math.min((ww - 30) / logo.naturalWidth, (hh - 30) / logo.naturalHeight);
          g.drawImage(logo, x + (ww - logo.naturalWidth * s) / 2, y + (hh - logo.naturalHeight * s) / 2, logo.naturalWidth * s, logo.naturalHeight * s);
        }
      } else if (kind === 2) {
        for (let n = 0; n < 12; n++) {
          const bw = (Math.sin(t * 2 + n * 1.3) * 0.5 + 0.5) * (ww - 40);
          g.fillStyle = ['#f7768e', '#e0af68', '#9ece6a', '#7dcfff'][n % 4];
          g.fillRect(x + 16, y + 16 + n * 16, bw, 9);
        }
      } else {
        g.font = MONO(14);
        const code = ['def tile(ws)', '  master = ws.first', '  stack.each do |w|', '    w.gaps = 10', '  end', 'end'];
        code.forEach((l, n) => { g.fillStyle = ['#bb9af7', '#c0caf5', '#7dcfff', '#e0af68', '#bb9af7', '#bb9af7'][n]; g.fillText(l, x + 14, y + 26 + n * 21); });
      }
      g.restore();
    }
  });
  const scr = screen(3.8, 2.4, tex, 1.2);
  scr.position.set(-0.0625, 17.5 * V + 0.06, V + 0.012);
  group.add(scr);
  // dwindle tiling that grows 1 → 5 windows and back
  const G = 12, top = 34;
  const tile = (n) => {
    const out = [];
    let x = G, y = top, w = W - 2 * G, h = H - top - G;
    for (let i = 0; i < n; i++) {
      if (i === n - 1) { out.push([x, y, w, h]); break; }
      if (w >= h) { const ww = (w - G) / 2; out.push([x, y, ww, h]); x += ww + G; w = ww; }
      else { const hh = (h - G) / 2; out.push([x, y, w, hh]); y += hh + G; h = hh; }
    }
    return out;
  };
  let cur = tile(1), tgt = cur, lastN = 1;
  return {
    group, anchor: new THREE.Vector3(0, 3.9, 0),
    update(dt, t) {
      const n = [1, 2, 3, 4, 5, 4, 3, 2][Math.floor(t / 1.6) % 8];
      if (n !== lastN) { tgt = tile(n); while (cur.length < tgt.length) cur.push([...(cur[cur.length - 1] || [W / 2, H / 2, 0, 0])]); lastN = n; }
      const k = 1 - Math.exp(-dt * 9);
      cur = cur.map((r, i) => { const g = tgt[i] || [r[0] + r[2] / 2, r[1] + r[3] / 2, 0, 0]; return r.map((a, j) => a + (g[j] - a) * k); }).filter((r, i) => i < tgt.length || r[2] > 4);
      layout = cur;
      if (Math.floor(t * 20) !== Math.floor((t - dt) * 20)) tex.redraw(t);
    },
  };
}

// ---------------------------------------------------------------- 4 · T3 Code: arcade cabinet
function t3code() {
  const group = new THREE.Group();
  const v = new Vox(), gl = new Vox();
  const BODY = 0x2a1f45, SIDE = 0x6b3fd4, TRIM = 0x191526;
  // side panels + body
  for (let y = 0; y <= 30; y++) {
    const front = y < 11 ? 3 : y < 14 ? 6 : 1;
    v.box(-8, 7, y, y, -6, front, (x) => (x === -8 || x === 7 ? SIDE : BODY));
  }
  // control panel: joystick + buttons
  v.box(-6, 5, 14, 14, 3, 6, TRIM);
  v.box(-4, -4, 15, 17, 5, 5, 0x222222); v.box(-5, -3, 18, 19, 4, 6, 0xff3b3b);
  for (const [x, c] of [[0, 0xffd34d], [2, 0x5ce1e6], [4, 0xff5b1f]]) gl.set(x, 15, 5, c);
  // marquee
  for (let x = -7; x <= 6; x++) for (let y = 27; y <= 30; y++) { v.del(x, y, 1); }
  v.box(-8, 7, 31, 31, -6, 2, SIDE);
  // coin door
  v.box(-2, 1, 4, 7, 4, 4, TRIM); gl.set(-1, 6, 5, 0xff5b1f); gl.set(0, 6, 5, 0xff5b1f);
  group.add(solid(v), glow(gl, 2.5));
  const shot = img('../assets/t3code.webp');
  const scr = screen(1.6, 1.0, shot, 1.1);
  scr.position.set(-0.0625, 20.5 * V, 2 * V + 0.012);
  group.add(scr);
  const mq = canvasTex(256, 72, (g, w, h, t = 0) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#6b3fd4'); gr.addColorStop(1, '#ff5b9a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = FONT(40, 700); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#fff'; g.shadowBlur = 8 + Math.sin(t * 3) * 4;
    g.fillText('T3 CODE', w / 2, h / 2 + 2);
  });
  const mqs = screen(1.75, 0.5, mq, 1.7);
  mqs.position.set(-0.0625, 29 * V, 2 * V + 0.012);
  group.add(mqs);
  // "insert coin" blinker under the screen
  const coin = canvasTex(256, 40, (g, w, h, on = 1) => {
    g.clearRect(0, 0, w, h);
    if (!on) return;
    g.fillStyle = '#ffd34d'; g.font = MONO(22, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PRESS START', w / 2, h / 2);
  });
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.17), new THREE.MeshBasicMaterial({ map: coin, transparent: true, color: new THREE.Color(1.8, 1.8, 1.8) }));
  cs.position.set(-0.0625, 13.2 * V, 3.0 * V + 0.02);
  group.add(cs);
  // a second, smaller cabinet for company
  const v2 = v; void v2;
  let lastOn = 1;
  return {
    group, anchor: new THREE.Vector3(0, 4.3, 0),
    update(dt, t) {
      const on = Math.floor(t * 1.6) % 2;
      if (on !== lastOn) { coin.redraw(on); lastOn = on; }
      if (Math.floor(t * 10) !== Math.floor((t - dt) * 10)) mq.redraw(t);
    },
  };
}

// ---------------------------------------------------------------- 5 · OpenCode: open crate, $0
function opencode() {
  const group = new THREE.Group();
  const v = new Vox();
  const PL = [0xc0925a, 0xb3854f], EDGE = 0x7c5a34;
  const X0 = -9, X1 = 8, Z0 = -7, Z1 = 6, TOP = 12;
  v.box(X0, X1, 0, TOP, Z0, Z1, (x, y, z) => ((x === X0 || x === X1) && (z === Z0 || z === Z1)) || y === 0 || y === TOP ? EDGE : pick(PL, Math.floor(y / 3), 0, 0));
  v.box(X0 + 1, X1 - 1, 2, TOP, Z0 + 1, Z1 - 1, null);
  for (const [x, y, z] of [...v.m.values()]) if (x > X0 && x < X1 && z > Z0 && z < Z1 && y >= 2) v.del(x, y, z);
  // diagonal brace on the front
  line(v, [X0 + 1, 1, Z1 + 1], [X1 - 1, TOP - 1, Z1 + 1], EDGE);
  // lid leaning on the right
  const lid = new Vox();
  lid.box(0, 17, 0, 1, 0, 13, (x, y, z) => (z === 0 || z === 13 || x === 0 || x === 17 ? EDGE : pick(PL, Math.floor(x / 3), 1, 0)));
  const lidM = solid(lid);
  lidM.position.set(X1 * V + 0.2, 0, Z0 * V);
  lidM.rotation.z = 1.25;
  group.add(solid(v), lidM);
  // glowing blocks floating out of the crate
  const blocks = [];
  const cols = [0x5ce1e6, 0x9ece6a, 0xffffff, 0xffd34d];
  for (let i = 0; i < 14; i++) {
    const s = 0.14 + Math.random() * 0.14;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[i % 4]).multiplyScalar(2.2) }));
    group.add(m);
    blocks.push({ m, x: (Math.random() - 0.5) * 1.6, z: (Math.random() - 0.5) * 1.2 - 0.1, ph: Math.random() * 5, sp: 0.35 + Math.random() * 0.3 });
  }
  // "$0" coin spinning above
  const face = canvasTex(256, 256, (g, w) => {
    const r = w / 2;
    const gr = g.createRadialGradient(r * 0.7, r * 0.6, 10, r, r, r); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(1, '#d9a21b');
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r - 2, 0, TAU); g.fill();
    g.lineWidth = 10; g.strokeStyle = '#b7860f'; g.beginPath(); g.arc(r, r, r - 18, 0, TAU); g.stroke();
    g.fillStyle = '#7a5608'; g.font = FONT(120, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$0', r, r + 6);
  });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 28), [
    new THREE.MeshStandardMaterial({ color: 0xd9a21b, metalness: 0.8, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ map: face, metalness: 0.5, roughness: 0.35, emissive: 0x6b4a00, emissiveIntensity: 0.4 }),
    new THREE.MeshStandardMaterial({ map: face, metalness: 0.5, roughness: 0.35, emissive: 0x6b4a00, emissiveIntensity: 0.4 }),
  ]);
  coin.rotation.x = Math.PI / 2;
  const coinG = new THREE.Group(); coinG.add(coin); coinG.position.set(0, 3.1, 0);
  coin.castShadow = true;
  group.add(coinG);
  // sign with the opencode screenshot, on two posts
  const sv = new Vox();
  sv.box(15, 15, 0, 13, -1, -1, EDGE); sv.box(29, 29, 0, 13, -1, -1, EDGE);
  sv.box(14, 30, 6, 16, -2, -2, 0x2a2730);
  group.add(solid(sv));
  const sh = screen(1.95, 1.2, img('../assets/opencode.png'), 1.1);
  sh.position.set(22.5 * V, 11.5 * V, -V + 0.012);
  group.add(sh);
  return {
    group, anchor: new THREE.Vector3(0, 4.2, 0),
    update(dt, t) {
      coinG.rotation.y = t * 1.6;
      coinG.position.y = 3.0 + Math.sin(t * 1.8) * 0.12;
      for (const b of blocks) {
        const k = ((t * b.sp + b.ph) % 2.4) / 2.4;
        b.m.position.set(b.x * (1 + k * 0.4), 1.1 + k * 2.2, b.z * (1 + k * 0.4));
        b.m.rotation.set(t + b.ph, t * 0.7, 0);
        b.m.scale.setScalar(k < 0.1 ? k * 10 : k > 0.8 ? (1 - k) * 5 : 1);
      }
    },
  };
}

// ---------------------------------------------------------------- 6 · Jev: fortune-teller tent, crystal ball of probabilities
function jev() {
  const group = new THREE.Group();
  const v = new Vox();
  const P = 0xef6fa3, C = 0xfbe9d9;
  const stripe = (x, z) => Math.floor((Math.atan2(z + 0.5, x + 0.5) / TAU + 1) * 18) % 2;
  // round striped walls
  for (let y = 0; y <= 10; y++) for (let x = -12; x <= 11; x++) for (let z = -12; z <= 11; z++) {
    const r = Math.hypot(x + 0.5, z + 0.5);
    if (r > 11.5 || r < 10.3) continue;
    v.set(x, y, z, y === 10 ? 0xe0b44c : stripe(x, z) ? P : C);
  }
  // scalloped trim + cone roof
  for (let y = 11; y <= 26; y++) {
    const R = 12.6 * (1 - (y - 11) / 16);
    for (let x = -13; x <= 12; x++) for (let z = -13; z <= 12; z++) {
      const r = Math.hypot(x + 0.5, z + 0.5);
      if (r > R || r < R - 1.6) continue;
      v.set(x, y, z, y === 11 && stripe(x, z) ? 0xe0b44c : stripe(x, z) ? P : C);
    }
  }
  // doorway (dark interior)
  for (let x = -3; x <= 2; x++) for (let y = 0; y <= 8 - Math.max(0, Math.abs(x + 0.5) - 1.5); y++) for (let z = 8; z <= 12; z++) v.del(x, y, z);
  v.box(-3, 2, 0, 8, 7, 7, 0x3a1f33);
  // pennant on top
  v.box(0, 0, 26, 32, 0, 0, 0x5a4a3a);
  v.box(1, 5, 30, 32, 0, 0, 0x5ce1e6);
  // table in front of the door
  v.box(-5, 4, 0, 5, 13, 17, (x, y) => (y === 5 ? 0x6b3f8f : 0x7d4ca3));
  v.box(-6, 5, 5, 5, 12, 18, 0x6b3f8f);
  v.box(-1, 0, 6, 6, 14, 15, 0xe0b44c);
  group.add(solid(v));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0x9ff4f7, emissive: 0x2bb7c4, emissiveIntensity: 0.8, roughness: 0.05, transparent: true, opacity: 0.9, clearcoat: 1 }));
  ball.position.set(0, 7 * V + 0.42, 15 * V);
  group.add(ball);
  const light = new THREE.PointLight(0x5ce1e6, 1.2, 2.5, 2);
  light.position.copy(ball.position);
  group.add(light);
  // floating probability read-out
  const probs = [0.73, 0.12, 0.91, 0.58, 0.34, 0.87, 0.06];
  const tex = canvasTex(256, 110, (g, w, h, p = 0.73, label = 'refund?') => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(12,10,20,.78)'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 18); g.fill();
    g.fillStyle = '#5ce1e6'; g.font = MONO(18, 600); g.textAlign = 'center'; g.fillText(label, w / 2, 32);
    g.fillStyle = '#fff'; g.font = MONO(46, 800); g.fillText(`p = ${p.toFixed(2)}`, w / 2, 82);
  });
  const read = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  read.renderOrder = 5;
  read.scale.set(1.3, 0.56, 1);
  read.position.set(0, 3.1, 15 * V);
  group.add(read);
  const Qs = ['refund?', 'escalate?', 'is it spam?', 'churn risk?', 'needs human?', 'fraud?', 'urgent?'];
  // sign
  const sign = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#2a1830'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e0b44c'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#ef6fa3'; g.font = SERIF(64, true); g.textAlign = 'center'; g.fillText('Jev', w / 2, 68);
    g.fillStyle = '#fbe9d9'; g.font = MONO(18, 600); g.fillText('(not Jeff)', w / 2, 102);
  });
  const sv = new Vox(); sv.box(-17, -17, 0, 14, 4, 4, 0x5a4a3a);
  group.add(solid(sv));
  const sg = screen(1.1, 0.55, sign, 1.05);
  sg.position.set(-17 * V + 0.06, 12 * V, 4 * V + 0.14);
  sg.rotation.y = 0.35;
  group.add(sg);
  let idx = -1;
  return {
    group, anchor: new THREE.Vector3(0, 4.1, 0),
    update(dt, t) {
      const n = Math.floor(t / 2.2);
      if (n !== idx) { idx = n; tex.redraw(probs[n % probs.length], Qs[n % Qs.length]); }
      const k = (t / 2.2) % 1;
      read.material.opacity = k < 0.1 ? k * 10 : k > 0.9 ? (1 - k) * 10 : 1;
      read.position.y = 3.05 + Math.sin(t * 1.5) * 0.06;
      ball.material.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.25;
      light.intensity = 1.1 + Math.sin(t * 3) * 0.4;
    },
  };
}

// ---------------------------------------------------------------- 7 · AI Clarity: infomercial billboard
function billboard() {
  const group = new THREE.Group();
  const v = new Vox(), gl = new Vox();
  v.box(-11, -10, 0, 13, -1, 0, 0x5a4a3a); v.box(9, 10, 0, 13, -1, 0, 0x5a4a3a);
  v.box(-16, 15, 12, 30, -2, -1, 0x26222e);
  v.box(-16, 15, 12, 12, -2, 3, 0x3a3440); // catwalk
  for (const x of [-10, 9]) { v.box(x, x, 31, 32, -1, -1, 0x26222e); v.box(x, x, 32, 32, 0, 3, 0x26222e); gl.set(x, 31, 3, 0xfff1c9); gl.set(x + 1, 31, 3, 0xfff1c9); }
  group.add(solid(v), glow(gl, 3));
  const W = 768, H = 432;
  const qr = new Image(); qr.src = '../assets/qr/ai-clarity.png';
  const tex = canvasTex(W, H, (g, w, h, t = 0) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#1e3fb8'); bg.addColorStop(1, '#0b1a5c');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // starburst
    g.save(); g.translate(w - 150, 120); g.rotate(t * 0.8);
    g.fillStyle = '#ffe23d'; g.beginPath();
    for (let i = 0; i < 24; i++) { const r = i % 2 ? 62 : 92; const a = (i / 24) * TAU; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill();
    g.rotate(-t * 0.8 - 0.2); g.fillStyle = '#d4141e'; g.font = FONT(30, 800); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('CALL', 0, -14); g.fillText('NOW!', 0, 18); g.restore();
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#ffe23d'; g.font = FONT(30, 800); g.fillText('AS SEEN ON TV', 40, 64);
    g.fillStyle = '#fff'; g.font = FONT(78, 800); g.fillText('AI CLARITY', 40, 150);
    g.fillStyle = '#9fd3ff'; g.font = FONT(40, 700); g.fillText('NETWORK', 44, 196);
    g.fillStyle = '#fff'; g.font = SERIF(40, true); g.fillText('“Your CEO asked what an', 40, 270); g.fillText(' agent is. Again.”', 40, 312);
    g.fillStyle = '#ffe23d'; g.font = MONO(30, 800); g.fillText('1-800-CLARITY', 40, 386);
    if (qr.complete && qr.naturalWidth) { g.fillStyle = '#fff'; g.fillRect(w - 214, h - 214, 184, 184); g.drawImage(qr, w - 208, h - 208, 172, 172); }
    // VHS: scanlines + a rolling tracking band
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
    const by = ((t * 90) % (h + 80)) - 40;
    g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, by, w, 18);
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, by + Math.random() * 18, 30, 1);
    g.fillStyle = '#fff'; g.font = MONO(18, 700); g.fillText(`▶ PLAY  SP  0:${String(Math.floor(t) % 60).padStart(2, '0')}`, w - 250, 34);
  });
  const face = screen(3.8, 2.14, tex, 1.05);
  face.position.set(-0.0625, 21 * V + 0.06, 0.012);
  group.add(face);
  return {
    group, anchor: new THREE.Vector3(0, 4.5, 0),
    update(dt, t) { if (Math.floor(t * 15) !== Math.floor((t - dt) * 15)) tex.redraw(t); },
  };
}

// ---------------------------------------------------------------- 8 · The game: a chain of modalities passing a signal
function poles() {
  const group = new THREE.Group();
  const N = 5;
  const spots = [...Array(N)].map((_, i) => {
    const a = (i / (N - 1) - 0.5) * 2.2;
    return new THREE.Vector3(Math.sin(a) * 3.1, 0, -Math.cos(a) * 1.7 + 1.0);
  });
  const icons = [];
  const mk = (fn) => { const v = new Vox(); fn(v); return solid(v, [0, 0, 0]); };
  const iconBuilders = [
    (v) => { // photo: a polaroid
      v.box(-3, 2, 0, 7, 0, 0, 0xf7f3ea);
      v.box(-2, 1, 3, 6, 0, 0, (x, y) => (y >= 5 ? 0x7cc7f0 : 0x6fbf5a)); v.set(1, 6, 0, 0xffd34d);
      v.box(-2, 1, 3, 6, -1, -1, 0xf7f3ea);
    },
    (v) => { // speech bubble with "…"
      v.box(-4, 3, 2, 6, 0, 1, 0xffffff); v.box(-3, 2, 1, 7, 0, 1, 0xffffff); v.box(-3, -2, 0, 0, 0, 1, 0xffffff); v.set(-4, -1, 0, 0xffffff);
      for (const x of [-2, 0, 2]) v.set(x, 4, 2, 0x3a3a44);
    },
    (v) => { v.blob(0, 2.5, 0, 3, 3, 1.5, 0xffd34d); v.set(-1, 3, 2, 0x3a2a1a); v.set(1, 3, 2, 0x3a2a1a); v.box(-1, 1, 1, 1, 2, 2, 0x3a2a1a); v.set(-2, 2, 2, 0x3a2a1a); v.set(2, 2, 2, 0x3a2a1a); }, // emoji
    (v) => { for (let y = 0; y < 5; y++) v.box(-4 + y, 4 - y - 1, y, y, 0, 0, 0xff5b1f); v.blob(0, 6, 1, 1.6, 1.6, 1, 0x5ce1e6); }, // svg shapes
    (v) => { v.box(-2, 1, 0, 3, -2, 1, 0xa98bff); v.box(-1, 0, 1, 2, -2, 2, 0xc3b0ff); }, // 3d cube
  ];
  const pv = new Vox();
  spots.forEach((p, i) => {
    const h = 5 + (i % 2) * 3;
    const cx = Math.round(p.x / V), cz = Math.round(p.z / V);
    pv.box(cx - 3, cx + 2, 0, h, cz - 3, cz + 2, (x, y) => (y === h ? 0xe9dfca : y % 3 === 0 ? 0xa39a8e : 0xb5ac9f));
    const icon = mk(iconBuilders[i]);
    icon.scale.setScalar(1.7);
    const holder = new THREE.Group();
    holder.position.set(p.x - V * 0.5, (h + 1) * V + 0.3, p.z - V * 0.5);
    holder.add(icon);
    group.add(holder);
    icons.push({ holder, icon, top: new THREE.Vector3(p.x, (h + 1) * V + 0.15, p.z), base: holder.position.y, hit: 0 });
  });
  group.add(solid(pv));
  // wires between neighbours
  const wires = [];
  const wm = new THREE.MeshStandardMaterial({ color: 0x2a2530 });
  for (let i = 0; i < N - 1; i++) {
    const a = icons[i].top, b = icons[i + 1].top;
    const mid = a.clone().lerp(b, 0.5); mid.y -= 0.35;
    const c = new THREE.QuadraticBezierCurve3(a.clone().setY(a.y - 0.05), mid, b.clone().setY(b.y - 0.05));
    wires.push(c);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.025, 4, false), wm));
  }
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5b1f).multiplyScalar(4) }));
  group.add(pulse);
  const plight = new THREE.PointLight(0xff7a3a, 3, 2.5, 2);
  pulse.add(plight);
  let lastSeg = -1;
  return {
    group, anchor: new THREE.Vector3(0, 3.9, -0.4),
    update(dt, t) {
      const T = 1.1, cyc = (t / T) % (N - 1 + 1.2);
      const seg = Math.floor(cyc);
      if (seg < N - 1) { wires[seg].getPointAt(cyc - seg, pulse.position); pulse.visible = true; }
      else pulse.visible = false;
      if (seg !== lastSeg) { const arrived = Math.min(seg, N - 1); icons[arrived].hit = 1; lastSeg = seg; }
      for (const ic of icons) {
        ic.hit = Math.max(0, ic.hit - dt * 1.6);
        ic.holder.position.y = ic.base + Math.sin(ic.hit * Math.PI) * 0.35;
        ic.icon.rotation.y = Math.sin(t * 0.8 + ic.base * 7) * 0.45 + (1 - ic.hit) * (ic.hit > 0 ? TAU : 0);
        ic.holder.scale.setScalar(1 + ic.hit * 0.25);
      }
    },
  };
}

// ---------------------------------------------------------------- 9 · Live demo: stage, spotlights, ON AIR
function stage() {
  const group = new THREE.Group();
  const v = new Vox(), gl = new Vox();
  const X0 = -16, X1 = 15;
  v.box(X0, X1, 0, 3, -9, 4, (x, y, z) => (y === 3 ? pick([0x9a6a43, 0x8d5f3b], x, 0, 0) : z === 4 ? 0x3a2a24 : 0x5a3f30));
  v.box(-3, 2, 0, 1, 5, 7, 0x6b4a33); v.box(-3, 2, 0, 0, 8, 9, 0x6b4a33); // steps
  v.box(X0, X1, 4, 30, -10, -9, 0x201b29);
  for (const [a, b] of [[X0, X0 + 4], [X1 - 4, X1]]) {
    v.box(a, b, 4, 28, -8, -6, (x, y, z) => ((x + z) % 2 ? 0xb0203a : 0x8f1830));
  }
  v.box(X0, X1, 29, 30, -8, -6, 0x8f1830); // valance
  v.box(X0 - 1, X1 + 1, 31, 31, -10, -5, 0x3a3a44); // truss
  // mic stand
  v.box(0, 0, 4, 13, 0, 0, 0x2a2a2a); v.box(-1, 1, 4, 4, -1, 1, 0x2a2a2a); v.box(0, 0, 13, 14, 1, 1, 0x555555);
  // ON AIR box
  v.box(-5, 4, 32, 36, -10, -9, 0x1a1a1a);
  group.add(solid(v));
  const onair = canvasTex(256, 96, (g, w, h, on = 1) => {
    g.fillStyle = on ? '#e3122f' : '#4a0a14'; g.fillRect(0, 0, w, h);
    g.fillStyle = on ? '#fff' : '#8a4a55'; g.font = FONT(56, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ON AIR', w / 2, h / 2 + 2);
  });
  const oa = screen(1.2, 0.46, onair, 1.6);
  oa.position.set(-0.0625, 34.2 * V, -8 * V + 0.012);
  group.add(oa);
  // big screen at the back
  const big = canvasTex(512, 288, (g, w, h, t = 0) => {
    g.fillStyle = '#0c0b0a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff5b1f'; g.beginPath(); g.arc(70, 70, 18 + Math.sin(t * 4) * 3, 0, TAU); g.fill();
    g.fillStyle = '#f2ece1'; g.font = MONO(34, 700); g.fillText('LIVE · AI TELEPHONE', 100, 82);
    g.font = SERIF(92, true); g.fillStyle = '#f2ece1'; g.fillText('Your turn.', 44, 210);
    g.fillStyle = '#5ce1e6'; g.font = MONO(20, 600); g.fillText('upload a photo → watch it drift', 48, 256);
  });
  const bs = screen(2.4, 1.35, big, 1.25);
  bs.position.set(-0.0625, 17 * V, -8 * V + 0.012);
  group.add(bs);
  // spotlights with visible beams
  const beams = [];
  for (const side of [-1, 1]) {
    const pv = new Vox();
    pv.box(0, 0, 0, 30, 0, 0, 0x2a2a32);
    const pole = solid(pv);
    pole.position.set(side * 2.5, 0, 1.2);
    group.add(pole);
    const head = new THREE.Group();
    head.position.set(side * 2.5 + 0.06, 30 * V, 1.26);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a32, roughness: 0.5 }));
    can.rotation.x = Math.PI / 2;
    head.add(can);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe0b0).multiplyScalar(0.5), transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.z = 2; cone.rotation.x = -Math.PI / 2;
    head.add(cone);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 2) }));
    lens.position.z = 0.21;
    head.add(lens);
    group.add(head);
    beams.push({ head, side });
  }
  const target = new THREE.Vector3();
  let lastOn = 1;
  return {
    group, anchor: new THREE.Vector3(0, 5.0, 0),
    update(dt, t) {
      for (const b of beams) {
        target.set(Math.sin(t * 0.7 + b.side) * 1.1, 0.4, 0.1 + Math.cos(t * 0.9 + b.side * 2) * 0.3);
        b.head.lookAt(group.localToWorld(target.clone()));
      }
      const on = Math.floor(t * 1.2) % 2;
      if (on !== lastOn) { onair.redraw(on); lastOn = on; }
      if (Math.floor(t * 8) !== Math.floor((t - dt) * 8)) big.redraw(t);
    },
  };
}

// ---------------------------------------------------------------- 10 · Ad break: a little cinema
function cinema() {
  const group = new THREE.Group();
  const v = new Vox(), gl = new Vox();
  const X0 = -15, X1 = 14, Z0 = -9, Z1 = -1;
  v.box(X0, X1, 0, 26, Z0, Z1, (x, y) => (y < 2 ? 0x6b2530 : y > 24 ? 0xe9dcc2 : pick([0xb8404a, 0xad3a44], x, y, 0)));
  // stepped top
  v.box(-6, 5, 27, 29, Z0, Z1, 0xe9dcc2); v.box(-3, 2, 30, 31, Z0, Z1, 0xe9dcc2);
  // doors
  for (let x = -4; x <= 3; x++) for (let y = 1; y <= 9; y++) { v.del(x, y, Z1); if (x === -1 || x === 0 || y === 9) v.set(x, y, Z1, 0xd8b04a); else gl.set(x, y, Z1, 0xffd9a0); }
  // marquee
  v.box(-13, 12, 12, 18, Z1 + 1, Z1 + 4, 0xf1e6cf);
  v.box(-13, 12, 11, 11, Z1 + 1, Z1 + 5, 0x6b2530);
  v.box(-13, 12, 19, 19, Z1 + 1, Z1 + 5, 0x6b2530);
  group.add(solid(v), glow(gl, 1.6));
  const mq = canvasTex(512, 132, (g, w, h) => {
    g.fillStyle = '#f7eedb'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1416'; g.font = FONT(44, 800); g.textAlign = 'center';
    g.fillText('ODENLI', w / 2, 56);
    g.fillStyle = '#b8404a'; g.font = FONT(36, 800); g.fillText('COMING SOON', w / 2, 108);
  });
  const ms = screen(3.1, 0.8, mq, 0.95);
  ms.position.set(-0.0625, 15.5 * V, (Z1 + 4) * V + V + 0.01);
  group.add(ms);
  // chasing bulbs around the marquee
  const bulbs = [];
  const bg = new THREE.BoxGeometry(V * 0.8, V * 0.8, V * 0.8);
  const bm = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ring = [];
  for (let x = -13; x <= 12; x++) ring.push([x, 11]);
  for (let y = 12; y <= 19; y++) ring.push([12, y]);
  for (let x = 12; x >= -13; x--) ring.push([x, 19]);
  for (let y = 18; y >= 12; y--) ring.push([-13, y]);
  const im = new THREE.InstancedMesh(bg, bm, ring.length);
  const M = new THREE.Matrix4();
  ring.forEach(([x, y], i) => { M.makeTranslation((x + 0.5) * V, (y + 0.5) * V, (Z1 + 5) * V + V * 0.6); im.setMatrixAt(i, M); bulbs.push(i); });
  group.add(im);
  const on = new THREE.Color(2.2, 1.8, 1.1), off = new THREE.Color(0.45, 0.32, 0.2);
  // posters either side of the doors
  const poster = (title, sub, c1, c2) => canvasTex(200, 300, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e0b44c'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = SERIF(46, true); g.fillText(title, w / 2, 130);
    g.font = MONO(15, 700); g.fillText(sub, w / 2, 170);
  });
  const p1 = screen(0.8, 1.2, poster('In a world…', 'the foundation takes 3 weeks', '#3a1c40', '#0b0a12'), 1.05);
  p1.position.set(-9 * V, 6 * V, Z1 * V + V + 0.01);
  const p2 = screen(0.8, 1.2, poster('Odenli', '…eleven minutes.', '#1c2340', '#000'), 1.05);
  p2.position.set(8 * V, 6 * V, Z1 * V + V + 0.01);
  group.add(p1, p2);
  // vertical blade sign
  const blade = canvasTex(80, 300, (g, w, h) => {
    g.fillStyle = '#1a1416'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffcf6a'; g.font = FONT(52, 800); g.textAlign = 'center';
    'AD'.split('').forEach((c, i) => g.fillText(c, w / 2, 110 + i * 90));
  });
  for (const s of [1, -1]) {
    const b = screen(0.5, 1.9, blade, 1.8);
    b.position.set(X1 * V + 0.35, 24 * V, Z1 * V + 0.3);
    b.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    b.position.x += s > 0 ? 0.02 : -0.02;
    group.add(b);
  }
  return {
    group, anchor: new THREE.Vector3(0, 4.6, 0),
    update(dt, t) {
      const k = Math.floor(t * 10);
      for (let i = 0; i < ring.length; i++) im.setColorAt(i, (i + k) % 3 === 0 ? on : off);
      im.instanceColor.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- 11 · Finale: radio tower + fireworks
function tower(stop) {
  const group = new THREE.Group();
  const v = new Vox();
  const H = 60;
  const W = (y) => 7 - y * 0.095;
  const col = (y) => (Math.floor(y / 8) % 2 ? 0xf2ede4 : 0xd8322e);
  const pts = (y) => { const w = W(y); return [[-w, y, -w], [w, y, -w], [w, y, w], [-w, y, w]]; };
  for (let y = 0; y <= H; y++) for (const p of pts(y)) v.set(Math.round(p[0]), y, Math.round(p[2]), col(y));
  for (let y = 0; y < H; y += 8) {
    const a = pts(y), b = pts(Math.min(H, y + 8));
    for (let i = 0; i < 4; i++) {
      line(v, a[i].map(Math.round), a[(i + 1) % 4].map(Math.round), col(y));
      line(v, a[i].map(Math.round), b[(i + 1) % 4].map(Math.round), col(y + 4));
    }
  }
  v.box(-1, 0, H, H + 10, -1, 0, 0xd8322e);
  v.box(-8, 7, 0, 1, -8, 7, 0x9a938a);
  group.add(solid(v));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.4, 0.3) }));
  beacon.position.set(-0.06, (H + 11) * V, -0.06);
  group.add(beacon);
  // signal rings
  const rings = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5b1f).multiplyScalar(2.5), transparent: true, depthWrite: false }));
    m.rotation.x = Math.PI / 2;
    m.position.copy(beacon.position);
    group.add(m);
    return { m, off: i / 3 };
  });
  // fireworks
  const N = 1400;
  const pos = new Float32Array(N * 3), colr = new Float32Array(N * 3);
  const vel = [], life = new Float32Array(N);
  for (let i = 0; i < N; i++) { vel.push(new THREE.Vector3()); pos[i * 3 + 1] = -999; }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  const spr = document.createElement('canvas'); spr.width = spr.height = 32;
  const sg = spr.getContext('2d'); const gr = sg.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = gr; sg.fillRect(0, 0, 32, 32);
  const pts2 = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.6, map: new THREE.CanvasTexture(spr), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts2.frustumCulled = false;
  group.add(pts2);
  let head = 0, next = 0;
  const PAL = [[1, 0.36, 0.12], [0.36, 0.88, 0.9], [1, 0.83, 0.3], [1, 0.48, 0.64], [0.66, 0.55, 1], [1, 1, 1]];
  const burst = () => {
    const c = new THREE.Vector3((Math.random() - 0.5) * 13, 8 + Math.random() * 5, (Math.random() - 0.5) * 6 - 2);
    const p = PAL[Math.floor(Math.random() * PAL.length)];
    for (let n = 0; n < 220; n++) {
      const i = head; head = (head + 1) % N;
      const d = new THREE.Vector3().randomDirection().multiplyScalar(3.5 + Math.random() * 3);
      vel[i].copy(d);
      pos[i * 3] = c.x; pos[i * 3 + 1] = c.y; pos[i * 3 + 2] = c.z;
      life[i] = 1.4 + Math.random() * 0.8;
      colr[i * 3] = p[0] * 4; colr[i * 3 + 1] = p[1] * 4; colr[i * 3 + 2] = p[2] * 4;
    }
  };
  let showUntil = 0;
  return {
    group, anchor: new THREE.Vector3(0, 5.2, 1.2), view: { dist: 40, lift: 3.2 },
    celebrate(sec = 8) { showUntil = performance.now() / 1000 + sec; },
    update(dt, t, ctx) {
      const b = (t % 1.4) < 0.25;
      beacon.material.color.setRGB(b ? 6 : 0.6, b ? 0.5 : 0.05, b ? 0.35 : 0.04);
      for (const r of rings) {
        const k = (t * 0.45 + r.off) % 1;
        r.m.scale.setScalar(0.4 + k * 5);
        r.m.material.opacity = (1 - k) * 0.8;
      }
      const active = (stop?.id && ctx?.here === stop.id) || performance.now() / 1000 < showUntil;
      if (active && t > next) {
        burst();
        next = t + 0.5 + Math.random() * 0.7;
        ctx?.audio?.firework(ctx.pigPos ? group.position.distanceTo(ctx.pigPos) + 8 : 12);
      }
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        vel[i].y -= 2.2 * dt; vel[i].multiplyScalar(1 - 1.4 * dt);
        pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt;
        const f = Math.max(0, Math.min(1, life[i]));
        colr[i * 3] *= 0.985; colr[i * 3 + 1] *= 0.985; colr[i * 3 + 2] *= 0.985;
        if (life[i] <= 0) pos[i * 3 + 1] = -999;
        void f;
      }
      pg.attributes.position.needsUpdate = true;
      pg.attributes.color.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- ad: AfterThat — a giant phone, a chat that goes cold
function phonead() {
  const group = new THREE.Group();
  const v = new Vox();
  const X0 = -9, X1 = 8, Y0 = 3, Y1 = 34;
  v.box(-10, 9, 0, 2, -3, 2, (x, y) => (y === 2 ? 0xa39a8e : 0x8f877d));  // plinth
  v.box(X0, X1, Y0, Y1, -1, 0, 0x17161c);
  for (const [x, y] of [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]]) { v.del(x, y, -1); v.del(x, y, 0); }
  v.box(X1 + 1, X1 + 1, 24, 28, -1, -1, 0x2a2930);                          // side button
  line(v, [-1, 1, -8], [-1, 20, -2], 0x2a2930); line(v, [0, 1, -8], [0, 20, -2], 0x2a2930); // kickstand
  group.add(solid(v));
  const W = 360, H = 640;
  const bubble = (g, text, right, y, a = 1, faded = false) => {
    g.globalAlpha = a;
    g.font = FONT(26, 600);
    const tw = Math.min(250, g.measureText(text).width);
    const x = right ? W - 24 - tw - 32 : 24;
    g.fillStyle = right ? (faded ? '#9fb3ff' : '#4f6cff') : '#ecE8f2';
    g.beginPath(); g.roundRect(x, y, tw + 32, 50, 22); g.fill();
    g.fillStyle = right ? '#fff' : '#1a1622';
    g.fillText(text, x + 16, y + 34, 250);
    g.globalAlpha = 1;
  };
  const tex = canvasTex(W, H, (g, w, h, t = 0) => {
    const T = t % 15;
    g.fillStyle = '#eeebf4'; g.fillRect(0, 0, w, h);
    // header
    g.fillStyle = '#f0ecf7'; g.fillRect(0, 0, w, 86);
    g.fillStyle = '#ff7a59'; g.beginPath(); g.arc(46, 46, 22, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.font = FONT(22, 700); g.textAlign = 'center'; g.fillText('S', 46, 54); g.textAlign = 'left';
    g.fillStyle = '#1a1622'; g.font = FONT(26, 700); g.fillText('Sam', 82, 44);
    g.fillStyle = T < 6 ? '#35b36b' : '#8a8494'; g.font = FONT(17, 500); g.fillText(T < 6 ? 'online' : 'last seen 3 weeks ago', 82, 68);
    const fade = (t0) => Math.max(0, Math.min(1, (T - t0) * 3));
    const cold = T > 6;
    if (T > 0.8) bubble(g, 'great meeting you!!', true, 110, fade(0.8), cold);
    if (T > 1.9) bubble(g, 'you too! coffee soon?', false, 176, fade(1.9));
    if (T > 3.0) bubble(g, '100%! next week?', true, 242, fade(3.0), cold);
    if (T > 4.1) bubble(g, 'yes!! 🙂', false, 308, fade(4.1));
    if (T > 6.4) {
      g.fillStyle = `rgba(20,16,30,${Math.min(0.55, (T - 6.4) * 0.8)})`; g.fillRect(0, 86, w, 330);
      g.globalAlpha = Math.min(1, (T - 6.4) * 1.5);
      g.fillStyle = '#fff'; g.font = SERIF(46, true); g.textAlign = 'center'; g.fillText('3 weeks later…', w / 2, 260); g.textAlign = 'left';
      g.globalAlpha = 1;
    }
    if (T > 8) { bubble(g, 'hey! still on?', true, 440, fade(8)); g.fillStyle = '#8a8494'; g.font = FONT(16, 500); g.fillText('Delivered', w - 110, 512); }
    if (T > 9.2 && T < 11) { // typing… then nothing
      g.fillStyle = '#ecE8f2'; g.beginPath(); g.roundRect(24, 530, 90, 46, 22); g.fill();
      for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(90,84,104,${0.4 + 0.6 * Math.abs(Math.sin(T * 5 + i))})`; g.beginPath(); g.arc(50 + i * 20, 553, 6, 0, TAU); g.fill(); }
    }
    if (T > 11.6) { // the ad card
      const a = Math.min(1, (T - 11.6) * 2);
      g.globalAlpha = a;
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ff7a59'); gr.addColorStop(1, '#6d2a8a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.textAlign = 'center';
      g.font = SERIF(44, true); g.fillText('and then they', w / 2, 250); g.fillText('never talked again.', w / 2, 300);
      g.font = FONT(40, 800); g.fillText('afterthat.chat', w / 2, 420);
      g.textAlign = 'left'; g.globalAlpha = 1;
    }
  });
  const scr = screen(2.02, 3.62, tex, 0.78);
  scr.position.set(-0.0625, 18.5 * V + 0.06, V + 0.012);
  group.add(scr);
  return {
    group, anchor: new THREE.Vector3(0, 4.9, 0),
    update(dt, t) { if (Math.floor(t * 12) !== Math.floor((t - dt) * 12)) tex.redraw(t); },
  };
}

// a flashing "AD BREAK" lightbox that marks the ad stops
function adSign() {
  const group = new THREE.Group();
  const v = new Vox();
  v.box(0, 0, 0, 16, 0, 0, 0x3a3440);
  v.box(-6, 6, 17, 22, -1, 0, 0x1a1720);
  group.add(solid(v));
  const tex = canvasTex(256, 96, (g, w, h, on = 1) => {
    g.fillStyle = on ? '#ffd23f' : '#3a3016'; g.fillRect(0, 0, w, h);
    g.fillStyle = on ? '#1a1416' : '#6a5a2a'; g.font = FONT(46, 800); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('AD BREAK', w / 2, h / 2 + 3);
  });
  const face = screen(1.45, 0.55, tex, 1.6);
  face.position.set(V * 0.5, 19.5 * V + 0.06, V + 0.012);
  group.add(face);
  let last = 1;
  return { group, update(dt, t) { const on = Math.floor(t * 1.4) % 2 ? 1 : 0; if (on !== last) { tex.redraw(on); last = on; } } };
}

export const LANDMARKS = { phonebooth, house, omarchy, t3code, opencode, jev, billboard, poles, stage, cinema, tower, phonead };

export function buildLandmark(stop, ctx) {
  const make = LANDMARKS[stop.kind];
  if (!make) {
    const v = new Vox(); v.box(-2, 1, 0, 14, -2, 1, 0xff5b1f);
    const group = new THREE.Group(); group.add(solid(v));
    return { group, anchor: new THREE.Vector3(0, 2.6, 0) };
  }
  const lm = make(stop, ctx);
  if (stop.ad) {
    // ad stops carry an AD BREAK lightbox beside the landmark
    const sign = adSign();
    sign.group.position.set(2.7, 0, 0.9);
    sign.group.rotation.y = -0.25;
    lm.group.add(sign.group);
    const inner = lm.update;
    lm.update = (dt, t, c) => { inner?.(dt, t, c); sign.update(dt, t); };
  }
  return lm;
}
