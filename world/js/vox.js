// Voxel kit for the world: a sparse voxel map -> one mesh of exposed faces,
// with per-vertex ambient occlusion and a little per-voxel colour noise.
import * as THREE from 'three';

export class Vox {
  constructor() { this.m = new Map(); }
  k(x, y, z) { return ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024); }
  set(x, y, z, c) { this.m.set(this.k(x, y, z), [x, y, z, c]); }
  get(x, y, z) { return this.m.get(this.k(x, y, z)); }
  has(x, y, z) { return this.m.has(this.k(x, y, z)); }
  del(x, y, z) { this.m.delete(this.k(x, y, z)); }
  box(x0, x1, y0, y1, z0, z1, c) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    return this;
  }
  // filled ellipsoid centred on (cx, cy, cz) in voxel units
  blob(cx, cy, cz, rx, ry, rz, c, keep = () => true) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2;
          if (d <= 1 && keep(x, y, z, d)) this.set(x, y, z, typeof c === 'function' ? c(x, y, z, d) : c);
        }
    return this;
  }
  // vertical cylinder
  cyl(cx, cz, r, y0, y1, c) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        if ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 <= r * r)
          for (let y = y0; y <= y1; y++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    return this;
  }
  paint(x, y, z, c) { const v = this.get(x, y, z); if (v) v[3] = c; }
  each(fn) { for (const v of this.m.values()) fn(v); }
}

const DIRS = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] }, { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] }, { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
];
const AO = [0.52, 0.7, 0.86, 1];

export const hash3 = (x, y, z) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** Build a BufferGeometry. size = voxel edge; origin = voxel-space point mapped to 0.
 *  opts.jitter = colour noise amount; opts.emissive(hex) -> true marks glow voxels
 *  (written to a second 'glow' attribute, used by shaders that want it). */
export function voxGeometry(vox, size = 1, origin = [0, 0, 0], { jitter = 0.1, ao = true } = {}) {
  const pos = [], nor = [], col = [], idx = [];
  const c = new THREE.Color();
  const [ox, oy, oz] = origin;
  for (const [x, y, z, hex] of vox.m.values()) {
    c.set(hex);
    const j = 1 - jitter / 2 + hash3(x, y, z) * jitter;
    for (const d of DIRS) {
      const [nx, ny, nz] = d.n;
      if (vox.has(x + nx, y + ny, z + nz)) continue;
      const base = pos.length / 3, a4 = [];
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const ux = d.u[0] * su, uy = d.u[1] * su, uz = d.u[2] * su;
        const vx = d.v[0] * sv, vy = d.v[1] * sv, vz = d.v[2] * sv;
        let a = 3;
        if (ao) {
          const s1 = vox.has(x + nx + ux, y + ny + uy, z + nz + uz) ? 1 : 0;
          const s2 = vox.has(x + nx + vx, y + ny + vy, z + nz + vz) ? 1 : 0;
          const cc = vox.has(x + nx + ux + vx, y + ny + uy + vy, z + nz + uz + vz) ? 1 : 0;
          a = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
        }
        a4.push(a);
        pos.push(
          (x + 0.5 + 0.5 * (nx + ux + vx) - ox) * size,
          (y + 0.5 + 0.5 * (ny + uy + vy) - oy) * size,
          (z + 0.5 + 0.5 * (nz + uz + vz) - oz) * size,
        );
        nor.push(nx, ny, nz);
        const f = AO[a] * j;
        col.push(c.r * f, c.g * f, c.b * f);
      }
      if (a4[0] + a4[2] < a4[1] + a4[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export const voxMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });

export function voxMesh(vox, size, origin, opts) {
  const m = new THREE.Mesh(voxGeometry(vox, size, origin, opts), opts?.material || voxMaterial);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- small value noise ----------
export function noise2(seed = 1) {
  const h = (x, y) => hash3(x, y, seed);
  const sm = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 3) => {
    let s = 0, amp = 1, f = 1, tot = 0;
    for (let o = 0; o < oct; o++) { s += n(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
    return s / tot;
  };
}

export const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
