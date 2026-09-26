// Scenery: trees, rocks, flowers, lamps, telephone line, bridges, clouds,
// birds, fireflies, confetti. Everything static is instanced.
import * as THREE from 'three';
import { Vox, voxGeometry, voxMaterial, rng, noise2, hash3 } from './vox.js';
import { S } from './terrain.js';
import { STOPS, toWorld, landmarkAt } from './map.js';

const V = 0.125;
const TOWARD_CAM = new THREE.Vector3(1, 0, 1).normalize();

// ---------- voxel models ----------
function treeRound(seed, leaf, leaf2) {
  const r = rng(seed), v = new Vox();
  const h = 7 + Math.floor(r() * 5);
  v.box(-1, 0, 0, h, -1, 0, (x, y) => (y % 3 === 0 ? 0x6b4a33 : 0x7a5539));
  const R = 6 + r() * 2.5;
  v.blob(-0.0, h + R * 0.55, 0, R, R * 0.85, R, (x, y, z) => (y > h + R * 0.9 || hash3(x, y, z) > 0.8 ? leaf2 : leaf));
  v.blob(R * 0.55, h + R * 0.2, R * 0.2, R * 0.6, R * 0.55, R * 0.6, leaf);
  v.blob(-R * 0.5, h + R * 0.35, -R * 0.3, R * 0.55, R * 0.5, R * 0.55, leaf2);
  return v;
}
function treePine(seed) {
  const r = rng(seed), v = new Vox();
  const tiers = 4 + Math.floor(r() * 2);
  v.box(-1, 0, 0, 5, -1, 0, 0x6b4a33);
  let y = 4;
  for (let t = 0; t < tiers; t++) {
    const w = 7 - t * 1.4;
    for (let yy = 0; yy < 4; yy++) {
      const ww = Math.max(1, Math.round(w - yy * 1.1));
      v.box(-ww, ww - 1, y + yy, y + yy, -ww, ww - 1, (x, yv, z) => (hash3(x, yv, z) > 0.85 ? 0x4f8f55 : yy === 3 ? 0x3f7d4b : 0x356d43));
    }
    y += 3;
  }
  return v;
}
function rock(seed) {
  const r = rng(seed), v = new Vox();
  v.blob(0, 1, 0, 2.5 + r() * 2, 2 + r() * 1.5, 2.5 + r() * 2, (x, y) => (y > 2 ? 0x9a94a3 : 0x857f8e), (x, y) => y >= 0);
  return v;
}
function bush(seed, c) {
  const r = rng(seed), v = new Vox();
  v.blob(0, 1.5, 0, 3 + r(), 2.2, 3 + r(), (x, y, z) => (hash3(x, y, z) > 0.75 ? 0x8cc860 : c), (x, y) => y >= 0);
  return v;
}
function lamp() {
  const v = new Vox();
  v.box(-1, 0, 0, 1, -1, 0, 0x2d2a33);
  v.box(0, 0, 0, 18, 0, 0, 0x34303b);
  v.box(-1, 1, 19, 19, -1, 1, 0x2d2a33);
  v.box(-1, 1, 23, 23, -1, 1, 0x2d2a33);
  return v;
}
function pole() {
  const v = new Vox();
  v.box(-1, 0, 0, 30, -1, 0, (x, y) => (y % 5 === 0 ? 0x6f5236 : 0x7d5d3d));
  v.box(-5, 4, 27, 27, -1, 0, 0x6f5236);
  for (const x of [-5, 4]) v.set(x, 28, 0, 0xd9d2c3);
  return v;
}
function cloud(seed) {
  const r = rng(seed), v = new Vox();
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const cx = (i - n / 2) * 5 + r() * 3, rr = 4 + r() * 4;
    v.blob(cx, rr * 0.4, r() * 4 - 2, rr, rr * 0.7, rr * 0.9, (x, y) => (y < 1 ? 0xe9d6e6 : 0xfff5ef), (x, y) => y >= 0);
  }
  return v;
}

function instanced(geo, mat, list, { shadow = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  im.count = list.length;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  list.forEach((o, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rot || 0);
    s.setScalar(o.scale || 1);
    m.compose(o.pos, q, s);
    im.setMatrixAt(i, m);
  });
  im.castShadow = shadow;
  im.receiveShadow = true;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}

export function buildProps(scene, terrain, graph) {
  const R = rng(1234);
  const fn = noise2(99);
  const root = new THREE.Group();
  scene.add(root);
  const stopPos = STOPS.map((s) => toWorld(...s.at));
  const lmPos = STOPS.map(landmarkAt);
  const nearLandmark = (x, z, r) => lmPos.some((p) => Math.hypot(p.x - x, p.z - z) < r);
  const updaters = [];

  // ---------- where can things grow? ----------
  const blocked = (x, z, reach = 3) => {
    // would something tall here hide the road/pig (the camera looks along -TOWARD_CAM)?
    for (let t = 0.5; t <= reach; t += 0.5) {
      const c = terrain.cellAt(x - TOWARD_CAM.x * t, z - TOWARD_CAM.z * t);
      if (c && (c.path || c.pad)) return true;
    }
    return false;
  };
  const nearStop = (x, z, r) => stopPos.some((p) => Math.hypot(p.x - x, p.z - z) < r);
  const frontOfStop = (x, z) => stopPos.some((p) => {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    return d < 8 && (dx * TOWARD_CAM.x + dz * TOWARD_CAM.z) > -1.5;
  });

  const trees = { round: [], dark: [], autumn: [], blossom: [], pine: [] }, rocks = [], bushes = [], flowers = [], tufts = [];
  for (const c of terrain.cells.values()) {
    if (c.path || c.pad || c.bridge) continue;
    const { x, z } = c;
    const y = c.top;
    const edge = c.land < 0.12;
    const forest = fn(x * 0.13, z * 0.13);
    const h = hash3(c.i, c.k, 77);
    if (!edge && c.pd > 1.6 && !nearStop(x, z, 4.2) && !nearLandmark(x, z, 3.4) && (c.i + c.k) % 2 === 0) {
      const p = forest > 0.56 ? 0.34 : forest > 0.45 ? 0.08 : 0.015;
      if (h < p && !blocked(x, z, 3.5) && !frontOfStop(x, z)) {
        const kind = forest > 0.62 && hash3(c.i, c.k, 5) > 0.45 ? 'pine' : hash3(c.i, c.k, 6) > 0.93 ? 'blossom' : hash3(c.i, c.k, 6) > 0.8 ? 'autumn' : hash3(c.i, c.k, 6) > 0.45 ? 'dark' : 'round';
        trees[kind].push({ pos: new THREE.Vector3(x + (R() - 0.5) * 0.3, y, z + (R() - 0.5) * 0.3), rot: Math.floor(R() * 4) * Math.PI / 2, scale: 0.8 + R() * 0.45, ph: R() * 6 });
        continue;
      }
    }
    if (c.pd > 1.2 && !nearStop(x, z, 2.6) && !nearLandmark(x, z, 2.4) && h > 0.985) { rocks.push({ pos: new THREE.Vector3(x, y, z), rot: R() * 6, scale: 0.7 + R() * 0.8 }); continue; }
    if (c.pd > 1.3 && !nearStop(x, z, 3) && !nearLandmark(x, z, 2.4) && h > 0.955 && !blocked(x, z, 1)) { bushes.push({ pos: new THREE.Vector3(x, y, z), rot: R() * 6, scale: 0.8 + R() * 0.5 }); continue; }
    if (c.pd > 0.9 && hash3(c.i, c.k, 12) > 0.86) flowers.push({ pos: new THREE.Vector3(x + (R() - 0.5) * 0.4, y, z + (R() - 0.5) * 0.4), rot: R() * 6, c: [0xfff3f0, 0xffd34d, 0xff7aa2, 0xa98bff, 0xff8a4d][Math.floor(R() * 5)] });
    else if (hash3(c.i, c.k, 13) > 0.9) tufts.push({ pos: new THREE.Vector3(x + (R() - 0.5) * 0.4, y, z + (R() - 0.5) * 0.4), rot: R() * 6 });
  }

  const treeGeos = {
    round: [treeRound(1, 0x6fae4a, 0x86c35a), treeRound(2, 0x6fae4a, 0x86c35a)],
    dark: [treeRound(3, 0x4f8f3e, 0x62a24a), treeRound(4, 0x4f8f3e, 0x62a24a)],
    autumn: [treeRound(5, 0xe08a3a, 0xf0a94c)],
    blossom: [treeRound(6, 0xf2a3bf, 0xffc3d6)],
    pine: [treePine(7), treePine(8)],
  };
  const sways = [];
  for (const [kind, list] of Object.entries(trees)) {
    const geos = treeGeos[kind].map((v) => voxGeometry(v, V, [0, 0, 0]));
    geos.forEach((g, gi) => {
      const sub = list.filter((_, i) => i % geos.length === gi);
      if (!sub.length) return;
      const im = instanced(g, voxMaterial, sub);
      root.add(im);
      sways.push({ im, list: sub });
    });
  }
  const swayM = new THREE.Matrix4(), swayQ = new THREE.Quaternion(), swayE = new THREE.Euler(), swayS = new THREE.Vector3();
  updaters.push((dt, t) => {
    for (const { im, list } of sways) {
      list.forEach((o, i) => {
        swayE.set(Math.sin(t * 1.3 + o.ph) * 0.025, o.rot, Math.sin(t * 1.1 + o.ph * 1.7) * 0.03);
        swayQ.setFromEuler(swayE);
        swayS.setScalar(o.scale);
        swayM.compose(o.pos, swayQ, swayS);
        im.setMatrixAt(i, swayM);
      });
      im.instanceMatrix.needsUpdate = true;
    }
  });

  const rockG = [rock(11), rock(12), rock(13)].map((v) => voxGeometry(v, V));
  rockG.forEach((g, gi) => { const sub = rocks.filter((_, i) => i % 3 === gi); if (sub.length) root.add(instanced(g, voxMaterial, sub)); });
  const bushG = [bush(21, 0x6aa84a), bush(22, 0x5f9a44)].map((v) => voxGeometry(v, V));
  bushG.forEach((g, gi) => { const sub = bushes.filter((_, i) => i % 2 === gi); if (sub.length) root.add(instanced(g, voxMaterial, sub)); });

  // flowers + grass tufts: tiny instanced boxes with per-instance colour
  {
    const fg = new THREE.BoxGeometry(V * 1.1, V * 1.1, V * 1.1); fg.translate(0, V * 1.6, 0);
    const stem = new THREE.BoxGeometry(V * 0.5, V * 1.4, V * 0.5); stem.translate(0, V * 0.7, 0);
    const fm = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    const im = instanced(fg, fm, flowers, { shadow: false });
    flowers.forEach((f, i) => im.setColorAt(i, new THREE.Color(f.c)));
    root.add(im, instanced(stem, new THREE.MeshStandardMaterial({ color: 0x4f8f3e }), flowers, { shadow: false }));
    const tg = new Vox();
    tg.box(0, 0, 0, 1, 0, 0, 0x6fb24c); tg.box(1, 1, 0, 2, 1, 1, 0x7cbd55); tg.box(-1, -1, 0, 1, 1, 1, 0x74b650);
    root.add(instanced(voxGeometry(tg, V * 0.8, [0, 0, 0]), voxMaterial, tufts, { shadow: false }));
  }

  // ---------- lamps along the roads (glow + bloom, no real lights) ----------
  const lamps = [];
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffc27a, emissive: 0xffa24a, emissiveIntensity: 3 });
  for (const e of graph.edges) {
    const n = Math.floor(e.len / 5.5);
    for (let i = 1; i <= n; i++) {
      const u = i / (n + 1);
      const p = e.curve.getPointAt(u), tan = e.curve.getTangentAt(u);
      const side = (i % 2 ? 1 : -1);
      const off = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(1.25 * side);
      const q = p.clone().add(off);
      const cell = terrain.cellAt(q.x, q.z);
      if (!cell || cell.path || cell.bridge || cell.pad) continue;
      // keep lamps off the camera side so they never stand in front of the pig
      if (off.dot(TOWARD_CAM) > 0.3) q.sub(off.multiplyScalar(2));
      const c2 = terrain.cellAt(q.x, q.z);
      if (!c2 || c2.path || c2.bridge || c2.pad || nearLandmark(q.x, q.z, 2.6)) continue;
      lamps.push({ pos: new THREE.Vector3(q.x, c2.top, q.z), rot: 0 });
    }
  }
  root.add(instanced(voxGeometry(lamp(), V, [0, 0, 0]), voxMaterial, lamps));
  const bulb = new THREE.BoxGeometry(V * 3, V * 3, V * 3); bulb.translate(V * 0.5, V * 21.5, V * 0.5);
  root.add(instanced(bulb, glowMat, lamps, { shadow: false }));

  // ---------- rope bridges: posts + sagging ropes on both sides ----------
  {
    const postV = new Vox(); postV.box(-1, 0, -4, 6, -1, 0, 0x6b4a2e); postV.box(-1, 0, 7, 7, -1, 0, 0x57391f);
    const posts = [], ropes = [];
    for (const e of graph.edges) {
      // find runs of samples that are over the sky
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          for (const side of [-1, 1]) {
            const pts = run.map(({ p, tan }) => p.clone().add(new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(0.95 * side)));
            const first = pts[0], last = pts[pts.length - 1];
            for (const q of [first, last]) posts.push({ pos: new THREE.Vector3(q.x, -0.1, q.z) });
            const mid = pts.length > 2 ? pts[Math.floor(pts.length / 2)] : first.clone().lerp(last, 0.5);
            const curve = new THREE.CatmullRomCurve3([first.clone().setY(0.9), mid.clone().setY(0.45), last.clone().setY(0.9)]);
            ropes.push(new THREE.TubeGeometry(curve, 20, 0.035, 4, false));
            const low = new THREE.CatmullRomCurve3([first.clone().setY(0.35), mid.clone().setY(0.05), last.clone().setY(0.35)]);
            ropes.push(new THREE.TubeGeometry(low, 20, 0.03, 4, false));
          }
        }
        run = [];
      };
      const N = Math.ceil(e.len * 3);
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const p = e.curve.getPointAt(u);
        const c = terrain.cellAt(p.x, p.z);
        if (c && c.bridge) run.push({ p, tan: e.curve.getTangentAt(u) });
        else if (run.length) {
          run.push({ p, tan: e.curve.getTangentAt(u) });
          flush();
        }
        if (c?.bridge && run.length === 1 && i > 0) {
          const pu = (i - 1) / N;
          run.unshift({ p: e.curve.getPointAt(pu), tan: e.curve.getTangentAt(pu) });
        }
      }
      flush();
    }
    root.add(instanced(voxGeometry(postV, V, [0, 0, 0]), voxMaterial, posts));
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xcdb58a, roughness: 1 });
    for (const g of ropes) { const m = new THREE.Mesh(g, ropeMat); m.castShadow = true; root.add(m); }
  }

  // ---------- the telephone line: poles along the main road, a pulse runs along the wire ----------
  const wirePts = [];
  {
    const poles = [];
    const main = STOPS.filter((s) => !s.tech).map((s) => s.id);
    let last = null;
    const add = (p) => {
      if (last && p.distanceTo(last) < 3.5) return;
      const cell = terrain.cellAt(p.x, p.z);
      if (!cell || cell.path || cell.bridge || cell.pad) return;
      if (nearLandmark(p.x, p.z, 3.2)) return;
      poles.push({ pos: new THREE.Vector3(p.x, cell.top, p.z), rot: Math.PI / 4 });
      wirePts.push(new THREE.Vector3(p.x, cell.top + 3.45, p.z));
      last = p;
    };
    // walk the main route in order, offset to the far side of the road
    for (let s = 0; s < main.length - 1; s++) {
      const a = graph.nodes.get(main[s]);
      const steps = [];
      // edges between consecutive main stops (via junctions)
      const seq = [];
      let cur = a;
      const target = graph.nodes.get(main[s + 1]);
      const visit = (n, prev, path) => {
        if (n === target) { seq.push(...path); return true; }
        for (const e of n.edges) {
          if (e.tech) continue;
          const o = e.A === n ? e.B : e.A;
          if (o === prev) continue;
          if (o.stop && o !== target) continue;
          if (visit(o, n, [...path, { e, fwd: e.A === n }])) return true;
        }
        return false;
      };
      visit(cur, null, []);
      for (const { e, fwd } of seq) steps.push({ e, fwd });
      for (const { e, fwd } of steps) {
        const N = Math.ceil(e.len / 0.5);
        for (let i = 0; i <= N; i++) {
          const u = fwd ? i / N : 1 - i / N;
          const p = e.curve.getPointAt(u), tan = e.curve.getTangentAt(u);
          const back = new THREE.Vector3(-tan.z, 0, tan.x);
          if (back.dot(TOWARD_CAM) > 0) back.negate(); // the side away from the camera
          add(p.clone().addScaledVector(back, 2.1));
        }
      }
    }
    root.add(instanced(voxGeometry(pole(), V, [0, 0, 0]), voxMaterial, poles));
  }
  // sagging wires between poles (two wires, at the crossarm ends)
  const wireCurves = [];
  {
    const wm = new THREE.MeshStandardMaterial({ color: 0x2a2530, roughness: 0.6 });
    for (let i = 0; i < wirePts.length - 1; i++) {
      const a = wirePts[i], b = wirePts[i + 1];
      const dir = b.clone().sub(a).setY(0).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      for (const s of [-0.55, 0.55]) {
        const a2 = a.clone().addScaledVector(new THREE.Vector3(1, 0, -1).normalize(), s);
        const b2 = b.clone().addScaledVector(new THREE.Vector3(1, 0, -1).normalize(), s);
        const mid = a2.clone().lerp(b2, 0.5); mid.y -= 0.5;
        const c = new THREE.QuadraticBezierCurve3(a2, mid, b2);
        if (s > 0) wireCurves.push(c);
        const m = new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.022, 3, false), wm);
        root.add(m);
      }
      void side;
    }
  }
  // signal pulses riding the wire, start → finale, forever
  {
    const pm = new THREE.MeshBasicMaterial({ color: 0xffb070 });
    const pulses = [];
    const lens = wireCurves.map((c) => c.getLength());
    const total = lens.reduce((a, b) => a + b, 0);
    for (let n = 0; n < 3; n++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), pm);
      m.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5b1f).multiplyScalar(4) });
      root.add(m);
      pulses.push({ m, off: n / 3 });
    }
    updaters.push((dt, t) => {
      if (!wireCurves.length) return;
      for (const p of pulses) {
        let d = ((t * 7 / total + p.off) % 1) * total;
        let i = 0;
        while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
        wireCurves[i].getPointAt(Math.min(1, d / lens[i]), p.m.position);
      }
    });
  }

  // ---------- clouds drifting around and under the islands ----------
  {
    const cm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, transparent: true, opacity: 0.92 });
    const geos = [1, 2, 3, 4].map((s) => voxGeometry(cloud(s), 0.5, [0, 0, 0], { ao: true, jitter: 0.03 }));
    const b = terrain.bounds;
    const clouds = [];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(geos[i % 4], cm);
      const low = i % 3 !== 0;
      if (low) {
        // low clouds drift below the islands on the camera's side, never behind them (they'd rise up the screen)
        const along = (R() - 0.5) * 100, front = -4 + R() * 26;
        m.position.copy(terrain.center).addScaledVector(new THREE.Vector3(1, 0, -1).normalize(), along).addScaledVector(TOWARD_CAM, front);
        m.position.y = -12 - R() * 14;
      }
      else {
        // high clouds only behind the islands (as seen from the camera), never in front of them
        // keep them out from behind the title (screen centre)
        const along = (R() < 0.5 ? -1 : 1) * (24 + R() * 26), back = 16 + R() * 22;
        m.position.copy(terrain.center).addScaledVector(new THREE.Vector3(1, 0, -1).normalize(), along).addScaledVector(TOWARD_CAM, -back);
        m.position.y = -1 + R() * 6;
        m.scale.setScalar(0.4 + R() * 0.45);
      }
      if (low) m.scale.setScalar(0.5 + R() * 0.8);
      m.rotation.y = R() * 6;
      m.castShadow = false;
      root.add(m);
      clouds.push({ m, v: 0.25 + R() * 0.4 });
    }
    updaters.push((dt) => {
      for (const c of clouds) {
        c.m.position.x += c.v * dt;
        c.m.position.z -= c.v * dt;
        // drift along the screen's right-hand direction and wrap around
        const sx = (c.m.position.x - c.m.position.z) * Math.SQRT1_2 - (terrain.center.x - terrain.center.z) * Math.SQRT1_2;
        if (sx > 50) { c.m.position.x -= 100 * Math.SQRT1_2; c.m.position.z += 100 * Math.SQRT1_2; }
      }
    });
  }

  // ---------- birds: little flocks circling ----------
  {
    const bm = new THREE.MeshStandardMaterial({ color: 0x2b2733, roughness: 0.9, side: THREE.DoubleSide });
    const wingG = new THREE.BoxGeometry(0.34, 0.03, 0.12); wingG.translate(0.17, 0, 0);
    const bodyG = new THREE.BoxGeometry(0.12, 0.09, 0.26);
    const birds = [];
    const flocks = [toWorld(-18, -6), toWorld(8, -4), toWorld(30, 2), toWorld(45, -4)];
    flocks.forEach((c, fi) => {
      for (let i = 0; i < 4; i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(bodyG, bm);
        const l = new THREE.Mesh(wingG, bm), r = new THREE.Mesh(wingG, bm);
        r.rotation.y = Math.PI;
        g.add(body, l, r);
        root.add(g);
        birds.push({ g, l, r, c, rad: 6 + R() * 4, h: 7 + R() * 3 + fi * 0.5, sp: 0.35 + R() * 0.1, ph: R() * 6 + i * 0.35, dir: fi % 2 ? 1 : -1 });
      }
    });
    updaters.push((dt, t) => {
      for (const b of birds) {
        const a = t * b.sp * b.dir + b.ph;
        b.g.position.set(b.c.x + Math.cos(a) * b.rad, b.h + Math.sin(t * 0.7 + b.ph) * 0.6, b.c.z + Math.sin(a) * b.rad);
        b.g.rotation.y = -a * 1 + (b.dir > 0 ? 0 : Math.PI);
        const f = Math.sin(t * 11 + b.ph * 3) * 0.7;
        b.l.rotation.z = f; b.r.rotation.z = -f;
      }
    });
  }

  // ---------- fireflies / sparkles ----------
  {
    const N = 260, pos = new Float32Array(N * 3), base = [];
    const b = terrain.bounds;
    const cells = [...terrain.cells.values()].filter((c) => !c.bridge);
    for (let i = 0; i < N; i++) {
      const c = cells[Math.floor(R() * cells.length)];
      base.push({ x: c.x, y: c.top + 0.4 + R() * 2.4, z: c.z, ph: R() * 6, sp: 0.3 + R() * 0.5 });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const spr = document.createElement('canvas'); spr.width = spr.height = 32;
    const sg = spr.getContext('2d');
    const gr = sg.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,200,120,.6)'); gr.addColorStop(1, 'rgba(255,180,90,0)');
    sg.fillStyle = gr; sg.fillRect(0, 0, 32, 32);
    const pm = new THREE.PointsMaterial({ size: 0.28, map: new THREE.CanvasTexture(spr), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.6, 1.3, 0.9) });
    const pts = new THREE.Points(g, pm);
    pts.frustumCulled = false;
    root.add(pts);
    updaters.push((dt, t) => {
      for (let i = 0; i < N; i++) {
        const o = base[i];
        pos[i * 3] = o.x + Math.sin(t * o.sp + o.ph) * 0.6;
        pos[i * 3 + 1] = o.y + Math.sin(t * o.sp * 1.7 + o.ph * 2) * 0.3;
        pos[i * 3 + 2] = o.z + Math.cos(t * o.sp * 0.8 + o.ph) * 0.6;
      }
      g.attributes.position.needsUpdate = true;
      pm.opacity = 0.65 + Math.sin(t * 2) * 0.15;
    });
    void b;
  }

  // ---------- confetti burst when a stop is finished ----------
  const confetti = (() => {
    const N = 220;
    const g = new THREE.BoxGeometry(0.09, 0.09, 0.02);
    const m = new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(g, m, N);
    im.count = 0;
    im.frustumCulled = false;
    const cols = [0xff5b1f, 0x5ce1e6, 0xffd34d, 0xff7aa2, 0xffffff, 0xa98bff].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) im.setColorAt(i, cols[i % cols.length]);
    root.add(im);
    let parts = [];
    const M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), E = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    updaters.push((dt) => {
      if (!parts.length) return;
      parts = parts.filter((p) => (p.life -= dt) > 0);
      parts.forEach((p, i) => {
        p.v.y -= 9 * dt; p.v.multiplyScalar(1 - 1.6 * dt);
        p.p.addScaledVector(p.v, dt);
        p.r.x += p.w.x * dt; p.r.y += p.w.y * dt;
        E.set(p.r.x, p.r.y, 0); Qn.setFromEuler(E);
        M.compose(p.p, Qn, one);
        im.setMatrixAt(i, M);
      });
      im.count = parts.length;
      im.instanceMatrix.needsUpdate = true;
    });
    return (at) => {
      for (let i = 0; i < N; i++) {
        const a = R() * Math.PI * 2, s = 2 + R() * 4;
        parts.push({ p: at.clone().add(new THREE.Vector3(0, 1.2, 0)), v: new THREE.Vector3(Math.cos(a) * s * 0.6, 5 + R() * 5, Math.sin(a) * s * 0.6), r: new THREE.Vector3(R() * 6, R() * 6, 0), w: new THREE.Vector3(R() * 12, R() * 12, 0), life: 2.2 + R() * 1.2 });
      }
      parts = parts.slice(-N);
    };
  })();

  // ---------- waterfalls off the camera-facing cliffs ----------
  const waterfalls = [];
  {
    const wc = document.createElement('canvas'); wc.width = 64; wc.height = 256;
    const wg = wc.getContext('2d');
    wg.fillStyle = '#7fd3f0'; wg.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 70; i++) {
      wg.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.55})`;
      wg.fillRect(Math.floor(Math.random() * 16) * 4, Math.random() * 256, 4, 10 + Math.random() * 40);
    }
    const tex = new THREE.CanvasTexture(wc);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const fallTex = tex.clone(); fallTex.needsUpdate = true; fallTex.repeat.set(1, 3);
    const flowTex = tex.clone(); flowTex.needsUpdate = true; flowTex.repeat.set(1, 1);
    // alpha fade toward the bottom of the fall
    const ac = document.createElement('canvas'); ac.width = 4; ac.height = 64;
    const ag = ac.getContext('2d'); const agr = ag.createLinearGradient(0, 0, 0, 64);
    agr.addColorStop(0, '#fff'); agr.addColorStop(0.6, '#bbb'); agr.addColorStop(1, '#000');
    ag.fillStyle = agr; ag.fillRect(0, 0, 4, 64);
    const alpha = new THREE.CanvasTexture(ac);
    const fallMat = new THREE.MeshStandardMaterial({ map: fallTex, alphaMap: alpha, transparent: true, depthWrite: false, roughness: 0.2, emissive: 0x2a6f8a, emissiveIntensity: 0.6, side: THREE.DoubleSide });
    const flowMat = new THREE.MeshStandardMaterial({ map: flowTex, roughness: 0.15, emissive: 0x2a6f8a, emissiveIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
    const picks = [];
    const cand = [...terrain.cells.values()].filter((c) => !c.bridge && !c.path && !c.pad && c.pd > 3 && c.sd > 5 && !c.hill);
    for (const c of cand) {
      for (const [di, dk, nx, nz] of [[1, 0, 1, 0], [0, 1, 0, 1]]) {
        if (terrain.cells.has(`${c.i + di},${c.k + dk}`)) continue;
        // needs solid ground behind it for the stream
        let ok = true;
        for (let t = 1; t <= 5; t++) { const b = terrain.cells.get(`${c.i - di * t},${c.k - dk * t}`); if (!b || b.path || b.pad || b.hill) { ok = false; break; } }
        if (!ok) continue;
        if (picks.some((p) => Math.hypot(p.c.x - c.x, p.c.z - c.z) < 14)) continue;
        if (nearLandmark(c.x, c.z, 4) || blocked(c.x, c.z, 2)) continue;
        picks.push({ c, nx, nz });
      }
    }
    picks.sort((a, b) => hash3(a.c.i, a.c.k, 3) - hash3(b.c.i, b.c.k, 3));
    const mist = [];
    for (const { c, nx, nz } of picks.slice(0, 5)) {
      const edgeX = (c.i + (nx ? 1 : 0.5)) * S, edgeZ = (c.k + (nz ? 1 : 0.5)) * S;
      const W = 1.35, H = 14;
      // the stream across the top, 2.5 units long
      const flow = new THREE.Mesh(new THREE.PlaneGeometry(W, 2.5), flowMat);
      flow.rotation.x = -Math.PI / 2;
      flow.rotation.z = nx ? Math.PI / 2 : 0;
      flow.position.set(edgeX - nx * 1.25, c.top + 0.02, edgeZ - nz * 1.25);
      flow.receiveShadow = true;
      // the fall, hugging the cliff
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.1, H, 1, 8), fallMat);
      const pa = fall.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setZ(i, Math.max(0, (H / 2 - y) / H) ** 2 * 1.4); }
      fall.geometry.computeVertexNormals();
      fall.rotation.y = nx ? Math.PI / 2 : 0;
      fall.position.set(edgeX + nx * 0.06, c.top - H / 2, edgeZ + nz * 0.06);
      // a lip of rocks at the source
      const rv = new Vox();
      rv.blob(0, 1, 0, 4, 2.2, 4, (x, y, z) => (hash3(x, y, z) > 0.5 ? 0x8f8a99 : 0x7b7686), (x, y) => y >= 0);
      const rocks = new THREE.Mesh(voxGeometry(rv, V), voxMaterial);
      rocks.position.set(edgeX - nx * 2.6, c.top, edgeZ - nz * 2.6);
      rocks.castShadow = true;
      root.add(flow, fall, rocks);
      mist.push(new THREE.Vector3(edgeX + nx * 0.8, c.top - H * 0.75, edgeZ + nz * 0.8));
    }
    waterfalls.push(...mist);
    updaters.push((dt, t) => {
      fallTex.offset.y = t * 1.6;
      flowTex.offset.y = -t * 0.9;
    });
  }

  // ---------- barrier gates on the technical detour (T opens / closes them) ----------
  const gates = [];
  {
    const stripes = document.createElement('canvas'); stripes.width = 128; stripes.height = 8;
    const sg = stripes.getContext('2d');
    for (let i = 0; i < 8; i++) { sg.fillStyle = i % 2 ? '#f4efe6' : '#e3322e'; sg.fillRect(i * 16, 0, 16, 8); }
    const st = new THREE.CanvasTexture(stripes); st.colorSpace = THREE.SRGBColorSpace;
    const armG = new THREE.BoxGeometry(2.3, 0.13, 0.13); armG.translate(-1.15, 0, 0);
    const armM = new THREE.MeshStandardMaterial({ map: st, roughness: 0.6 });
    const pv = new Vox(); pv.box(-1, 0, 0, 8, -1, 0, 0x3a3440); pv.box(-2, 1, 0, 0, -2, 1, 0x3a3440);
    const postG = voxGeometry(pv, V, [0, 0, 0]);
    for (const e of graph.edges) {
      if (!e.tech || !(e.A.junction || e.B.junction)) continue;
      const u = e.A.junction ? Math.min(0.5, 1.9 / e.len) : Math.max(0.5, 1 - 1.9 / e.len);
      const p = e.curve.getPointAt(u), tan = e.curve.getTangentAt(u);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      if (side.dot(TOWARD_CAM) > 0) side.negate(); // post on the far side of the road
      const base = p.clone().addScaledVector(side, 1.15);
      const post = new THREE.Mesh(postG, voxMaterial);
      post.position.copy(base); post.castShadow = true;
      const pivot = new THREE.Group();
      pivot.position.set(base.x, 1.0, base.z);
      pivot.rotation.y = Math.atan2(-side.z, side.x);
      const arm = new THREE.Mesh(armG, armM); arm.castShadow = true;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      lamp.position.set(-2.2, 0.12, 0);
      arm.add(lamp);
      pivot.add(arm);
      root.add(post, pivot);
      gates.push({ arm, lamp, a: -1.35 });
    }
  }
  let techOpen = true;
  updaters.push((dt, t) => {
    for (const g of gates) {
      const want = techOpen ? -1.35 : 0;
      g.a += (want - g.a) * (1 - Math.exp(-dt * 5));
      g.arm.rotation.z = g.a + (techOpen ? 0 : Math.sin(t * 18) * 0.02 * Math.max(0, 1 - Math.abs(g.a) * 5));
      const blink = !techOpen && Math.floor(t * 2.5) % 2 === 0;
      g.lamp.material.color.setRGB(blink ? 4 : 0.4, blink ? 0.3 : 0.1, blink ? 0.2 : 0.1);
    }
  });

  return {
    root,
    waterfalls,
    setTechOpen(on) { techOpen = on; },
    update(dt, t, ctx) { for (const u of updaters) u(dt, t, ctx); },
    celebrate(stop, reason) { if (reason === 'end') confetti(stop.node.pos); },
    confetti,
  };
}
