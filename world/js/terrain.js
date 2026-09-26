// Floating voxel islands grown around the stops and roads. Bridges cross the gaps.
import * as THREE from 'three';
import { Vox, voxGeometry, voxMaterial, noise2, hash3 } from './vox.js';
import { STOPS, JUNCTIONS, LAND, toWorld } from './map.js';

export const S = 0.5; // terrain voxel size (the mascot is 1 unit tall)

const DIRT = [0x9a6a43, 0x8d5f3b, 0xa3744b];
const STONE = [0x7c7684, 0x6f6a78, 0x857f8c];
const DEEP = [0x5b5566, 0x524d5d];
const PATH = [0xe6c893, 0xdcbb84, 0xebd3a3, 0xd6b47c];
const TECH = [0x8b87b5, 0x7f7aab, 0x9793c0];
const PAD = [0xe9dfca, 0xe2d6bf];
const PADRING = 0xc4b294;
const PLANK = [0xa8743f, 0x93642f, 0xb07c45];

export function buildTerrain(graph) {
  const nz = noise2(7), nh = noise2(13), nd = noise2(29), nc = noise2(41);
  const pick = (arr, x, z, s = 0) => arr[Math.floor(hash3(x, z, s) * arr.length) % arr.length];

  const stops = STOPS.map((s) => ({ p: toWorld(...s.at), r: s.id === 'finale' ? 6.2 : s.tech ? 4.8 : 5.2, pad: 2.3, isle: s.isle, s }));
  const juncs = JUNCTIONS.map((j) => ({ p: toWorld(...j.at), r: 3.2, pad: 1.1, isle: j.isle }));
  const nodesIsle = [...stops, ...juncs];
  const extra = LAND.map((l) => {
    const p = toWorld(...l.at);
    let best = nodesIsle[0], bd = Infinity;
    for (const o of nodesIsle) { const d = o.p.distanceTo(p); if (d < bd) { bd = d; best = o; } }
    return { p, r: l.r, isle: l.isle || best.isle };
  });
  const isleOf = new Map([...STOPS, ...JUNCTIONS].map((n) => [n.id, n.isle]));

  // road segments with their param range, for distance queries
  const segs = [];
  for (const e of graph.edges) {
    const n = e.samples.length - 1;
    const ia = isleOf.get(e.a), ib = isleOf.get(e.b);
    for (let i = 0; i < n; i++) segs.push({ a: e.samples[i], b: e.samples[i + 1], t: (i + 0.5) / n, e, isle: ia === ib ? ia : null });
  }
  const segDist = (x, z, sg) => {
    const ax = sg.a.x, az = sg.a.z, bx = sg.b.x - ax, bz = sg.b.z - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz || 1)));
    const dx = x - (ax + bx * t), dz = z - (az + bz * t);
    return Math.sqrt(dx * dx + dz * dz);
  };

  // bounds
  const all = [...stops, ...juncs, ...extra].map((o) => o.p).concat(segs.map((s) => s.a));
  const minX = Math.min(...all.map((p) => p.x)) - 9, maxX = Math.max(...all.map((p) => p.x)) + 9;
  const minZ = Math.min(...all.map((p) => p.z)) - 9, maxZ = Math.max(...all.map((p) => p.z)) + 9;
  const i0 = Math.floor(minX / S), i1 = Math.ceil(maxX / S), k0 = Math.floor(minZ / S), k1 = Math.ceil(maxZ / S);

  const vox = new Vox();
  const cells = new Map(); // "i,k" -> { top, land, path, tech, pad }
  const bridgeCells = [];
  for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
    const x = (i + 0.5) * S, z = (k + 0.5) * S;
    // nearest road
    let pd = Infinity, ps = null;
    for (const sg of segs) {
      if (Math.abs(sg.a.x - x) > 6 || Math.abs(sg.a.z - z) > 6) continue;
      const d = segDist(x, z, sg);
      if (d < pd) { pd = d; ps = sg; }
    }
    // land value per island; where two islands meet, open a gap of sky
    const wob = 0.82 + 0.36 * nz(x * 0.17, z * 0.17);
    const val = {};
    const bump = (isle, v) => { if (v > (val[isle] ?? -9)) val[isle] = v; };
    let sd = Infinity, padOf = null;
    for (const o of nodesIsle) {
      const d = Math.hypot(o.p.x - x, o.p.z - z);
      bump(o.isle, 1 - d / (o.r * wob));
      if (d < sd) sd = d;
      if (d < o.pad) padOf = o;
    }
    for (const o of extra) bump(o.isle, 1 - Math.hypot(o.p.x - x, o.p.z - z) / (o.r * wob));
    for (const sg of segs) {
      if (!sg.isle || Math.abs(sg.a.x - x) > 4 || Math.abs(sg.a.z - z) > 4) continue;
      bump(sg.isle, 1 - segDist(x, z, sg) / (2.7 * wob));
    }
    const vs = Object.values(val).sort((a, b) => b - a);
    const land = vs[0] ?? -1, second = vs[1] ?? -9;
    const key = `${i},${k}`;
    if (land <= 0 || land - second < 0.5) {
      if (ps && pd < 0.8) bridgeCells.push({ i, k, x, z, t: ps.t, e: ps.e });
      continue;
    }
    const isPath = pd < 0.8 + (hash3(i, k, 3) - 0.5) * 0.35;
    const tech = isPath && ps.e.tech;
    // hills, kept away from the roads and the stops
    let hill = 0;
    if (pd > 3.2 && sd > 5 && land > 0.25) {
      const hv = nh(x * 0.09 + 3, z * 0.09 - 5);
      hill = Math.max(0, Math.min(4, Math.floor((hv - 0.5) * 12 * Math.min(1, (pd - 3.2) / 3))));
    }
    const top = -1 + hill;
    const depth = 2 + Math.floor(land * 15 + nd(x * 0.3, z * 0.3) * 6);
    const bottom = -1 - depth;
    for (let j = bottom; j <= top; j++) {
      let c;
      if (j === top) {
        if (padOf && !hill) {
          const dd = Math.hypot(padOf.p.x - x, padOf.p.z - z);
          c = dd > padOf.pad - 0.55 ? PADRING : pick(PAD, i, k);
        } else if (isPath && !hill) c = tech ? pick(TECH, i, k) : pick(PATH, i, k);
        else {
          const g = nc(x * 0.1, z * 0.1) + (hash3(i, k, 9) - 0.5) * 0.08;
          c = g > 0.63 ? 0x9ccd68 : g > 0.52 ? 0x8cc35e : g > 0.4 ? 0x7fb957 : 0x71ad4e;
        }
      } else if (j >= top - 2) c = pick(DIRT, i, j * 7 + k);
      else if (j > bottom + 2) c = pick(STONE, i, j * 5 + k);
      else c = pick(DEEP, i, j + k);
      vox.set(i, j, k, c);
    }
    cells.set(key, { i, k, x, z, top: (top + 1) * S, land, path: isPath, pd, sd, tech, pad: !!padOf, hill });
  }
  // plank bridges across the gaps: stripes across the direction of travel
  for (const b of bridgeCells) {
    const stripe = Math.floor(b.t * b.e.len * 2.2);
    vox.set(b.i, -1, b.k, PLANK[stripe % 3]);
    cells.set(`${b.i},${b.k}`, { i: b.i, k: b.k, x: b.x, z: b.z, top: 0, land: 0, path: true, bridge: true, pd: 0, sd: 99 });
  }

  const geo = voxGeometry(vox, S, [0, 0, 0], { jitter: 0.08 });
  const mesh = new THREE.Mesh(geo, voxMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const cellAt = (x, z) => cells.get(`${Math.floor(x / S)},${Math.floor(z / S)}`);
  const heightAt = (x, z) => cellAt(x, z)?.top ?? -Infinity;
  const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  return { mesh, cells, cellAt, heightAt, bounds: { minX, maxX, minZ, maxZ }, center, bridgeCells };
}
