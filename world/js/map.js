// The world map: stops (in talk order), junctions, and the paths between them.
// Positions are authored in SCREEN terms — u = to the right, v = toward the
// viewer (down the screen) — and converted to world x/z for the 45° camera.
import * as THREE from 'three';

const R2 = Math.SQRT1_2;
export const toWorld = (u, v, y = 0) => new THREE.Vector3((u + v) * R2, y, (v - u) * R2);

// The talk, in order. kind picks the landmark (landmarks.js); slides are deck ids
// opened as ../index.html?embed=1&only=…; url opens a live page instead (the projector).
// isle groups stops onto floating islands — a road between two islands becomes a bridge.
export const STOPS = [
  { id: 'teaser', n: 1, title: 'Teaser', sub: 'cold open', slides: ['cold-open'], at: [-24, 1], kind: 'phonebooth', isle: 'A' },
  { id: 'afterthat', n: 2, title: 'AfterThat', sub: 'ad break', ad: true, slides: ['ad-afterthat'], at: [-17, -2.5], kind: 'phonead', isle: 'A' },
  { id: 'opencode', n: 3, title: 'OpenCode', sub: '+ free models', slides: ['opencode'], at: [-10, 1.5], kind: 'opencode', isle: 'A' },
  { id: 't3code', n: 4, title: 'T3 Code', slides: ['t3code'], at: [-2.5, -2], kind: 't3code', isle: 'B' },
  { id: 'jev', n: 5, title: 'Jev', sub: '+ jev-axi', slides: ['jev', 'jev-axi'], at: [4.5, 1.5], kind: 'jev', isle: 'B', lmAt: [0, -3.3] },
  { id: 'omarchy', n: 6, title: 'Omarchy', slides: ['omarchy'], at: [11.5, -2.5], kind: 'omarchy', isle: 'B' },
  { id: 'aiclarity', n: 7, title: 'AI Clarity', sub: 'ad break', ad: true, slides: ['ad-aiclarity'], at: [19, 1], kind: 'billboard', isle: 'C' },
  { id: 'game', n: 8, title: 'The game', sub: 'AI Telephone · live', url: 'http://localhost:8787/present?embed=1', at: [26, -2], kind: 'stage', isle: 'C' },
  { id: 'odenli', n: 9, title: 'Odenli', sub: 'ad break', ad: true, slides: ['ad-odenli'], at: [33.5, 1.5], kind: 'cinema', isle: 'D' },
  { id: 'closing', n: 10, title: 'Closing', slides: ['closing'], at: [41, -2.5], kind: 'tower', isle: 'D', finale: true },
];

// landmarks that are just scenery (no stop, no label)
export const SCENERY = [
  { kind: 'house', at: [-21, -8.5] },
  { kind: 'poles', at: [21.5, -6.8] },
];

export const JUNCTIONS = [];

// one road through every stop; via = extra control points (screen coords)
export const EDGES = [
  { a: 'teaser', b: 'afterthat', via: [[-20.5, 0.2]] },
  { a: 'afterthat', b: 'opencode', via: [[-13.5, -1.2]] },
  { a: 'opencode', b: 't3code', via: [[-6.2, 0.2]] },
  { a: 't3code', b: 'jev', via: [[1, -0.8]] },
  { a: 'jev', b: 'omarchy', via: [[8, -0.5]] },
  { a: 'omarchy', b: 'aiclarity', via: [[15.2, -1]] },
  { a: 'aiclarity', b: 'game', via: [[22.5, -0.3]] },
  { a: 'game', b: 'odenli', via: [[29.8, 0]] },
  { a: 'odenli', b: 'closing', via: [[37.2, -0.3]] },
];

// extra land for scenery (screen coords, radius); the island is the nearest stop's
export const LAND = [
  { at: [-27, -4], r: 5 }, { at: [-21, -8.5], r: 4.6 }, { at: [-20, 4.5], r: 4 }, { at: [-13, -6], r: 4.5 }, { at: [-12.5, 5], r: 3.5 },
  { at: [-1, 5], r: 4 }, { at: [3, -6], r: 4.5 }, { at: [9, 5], r: 4 }, { at: [13, -7], r: 4 },
  { at: [18, -5], r: 4 }, { at: [21.5, -6.8], r: 4.3 }, { at: [24, 4.5], r: 4 },
  { at: [31, -4.5], r: 4 }, { at: [37, 5], r: 4 }, { at: [44.5, 1], r: 5 }, { at: [40, -7], r: 4 },
];

// where a stop's landmark stands: behind the pad, away from the camera
export const landmarkAt = (s) => { const [du, dv] = s.kind && !s.id ? [0, 0] : s.lmAt || [0, -2.7]; return toWorld(s.at[0] + du, s.at[1] + dv); };

export function buildGraph() {
  const nodes = new Map();
  for (const s of STOPS) nodes.set(s.id, { id: s.id, stop: s, pos: toWorld(...s.at), edges: [] });
  for (const j of JUNCTIONS) nodes.set(j.id, { id: j.id, junction: j, pos: toWorld(...j.at), edges: [] });
  const edges = EDGES.map((e) => {
    const A = nodes.get(e.a), B = nodes.get(e.b);
    const pts = [A.pos, ...e.via.map((p) => toWorld(...p)), B.pos];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    const samples = curve.getSpacedPoints(Math.max(8, Math.ceil(len * 4)));
    const edge = { ...e, A, B, curve, len, samples };
    A.edges.push(edge);
    B.edges.push(edge);
    return edge;
  });
  return { nodes, edges };
}

// shortest path (by length) between two node ids -> list of { edge, forward }
export function route(graph, fromId, toId) {
  const dist = new Map([[fromId, 0]]), prev = new Map(), todo = new Set([fromId]);
  while (todo.size) {
    let best = null;
    for (const id of todo) if (best === null || dist.get(id) < dist.get(best)) best = id;
    todo.delete(best);
    if (best === toId) break;
    for (const e of graph.nodes.get(best).edges) {
      const other = e.A.id === best ? e.B.id : e.A.id;
      const d = dist.get(best) + e.len;
      if (d < (dist.get(other) ?? Infinity)) { dist.set(other, d); prev.set(other, { id: best, e }); todo.add(other); }
    }
  }
  if (!prev.has(toId) && fromId !== toId) return null;
  const out = [];
  for (let id = toId; id !== fromId;) { const p = prev.get(id); out.unshift({ edge: p.e, forward: p.e.A.id === p.id }); id = p.id; }
  return out;
}
