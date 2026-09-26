// The world map: stops (in talk order), junctions, and the paths between them.
// Positions are authored in SCREEN terms — u = to the right, v = toward the
// viewer (down the screen) — and converted to world x/z for the 45° camera.
import * as THREE from 'three';

const R2 = Math.SQRT1_2;
export const toWorld = (u, v, y = 0) => new THREE.Vector3((u + v) * R2, y, (v - u) * R2);

// kind picks the landmark model (landmarks.js). tech = on the optional side route.
export const STOPS = [
  { id: 'start', n: 1, title: 'Start', sub: 'cold open', slides: ['cold-open'], at: [-24, 1], kind: 'phonebooth', isle: 'A' },
  { id: 'about', n: 2, title: 'Who am I', slides: ['about'], at: [-16.5, -2.5], kind: 'house', isle: 'A' },
  { id: 'omarchy', n: 3, title: 'Omarchy', slides: ['omarchy'], at: [-9, 1.5], kind: 'omarchy', isle: 'A' },
  { id: 't3code', n: 4, title: 'T3 Code', slides: ['t3code'], at: [-3.5, -11], kind: 't3code', isle: 'T', tech: true },
  { id: 'opencode', n: 5, title: 'OpenCode', sub: '+ $0 builds', slides: ['opencode'], at: [4.5, -12.5], kind: 'opencode', isle: 'T', tech: true },
  { id: 'jev', n: 6, title: 'Jev', slides: ['jev'], techSlides: ['jev', 'jev-axi'], at: [12, 2], kind: 'jev', isle: 'A', lmAt: [0, -3.3] },
  { id: 'aiclarity', n: 7, title: 'AI Clarity', sub: 'ad break', slides: ['ad-aiclarity'], at: [18.5, -3], kind: 'billboard', isle: 'A' },
  { id: 'game', n: 8, title: 'The game', slides: ['game-rules'], at: [26, 1.5], kind: 'poles', isle: 'B' },
  { id: 'live', n: 9, title: 'Live demo', slides: ['live'], at: [32.5, -3], kind: 'stage', isle: 'B' },
  { id: 'ads', n: 10, title: 'Ad break', sub: 'AfterThat · Odenli', slides: ['ad-afterthat', 'ad-odenli'], at: [39.5, 1.5], kind: 'cinema', isle: 'C' },
  { id: 'finale', n: 11, title: 'Reveal', sub: '+ links', slides: ['reveal', 'links'], at: [47, -2.5], kind: 'tower', isle: 'C' },
];

// junctions: the fork where the technical detour leaves and rejoins the main road
export const JUNCTIONS = [
  { id: 'j1', at: [-4, 0], sign: 'tech detour', isle: 'A' },
  { id: 'j2', at: [7.5, -1.5], isle: 'A' },
];

// edges; via = extra control points (screen coords). A road between two islands becomes a bridge.
export const EDGES = [
  { a: 'start', b: 'about', via: [[-20.5, 0.5]] },
  { a: 'about', b: 'omarchy', via: [[-13, -1.5]] },
  { a: 'omarchy', b: 'j1', via: [] },
  { a: 'j1', b: 't3code', via: [[-4.5, -4]], tech: true },
  { a: 't3code', b: 'opencode', via: [[0.5, -12.5]], tech: true },
  { a: 'opencode', b: 'j2', via: [[7, -6.5]], tech: true },
  { a: 'j1', b: 'j2', via: [[0, 2], [4, 1.5]] },
  { a: 'j2', b: 'jev', via: [[10, 0]] },
  { a: 'jev', b: 'aiclarity', via: [[15.5, 0]] },
  { a: 'aiclarity', b: 'game', via: [[22, -1]] },
  { a: 'game', b: 'live', via: [[29.5, 0]] },
  { a: 'live', b: 'ads', via: [[36, -1]] },
  { a: 'ads', b: 'finale', via: [[43, 0.5]] },
];

// extra land for scenery (screen coords, radius)
export const LAND = [
  { at: [-27, -4], r: 5 }, { at: [-20, 4], r: 4.5 }, { at: [-12, -6], r: 5.5 }, { at: [-14, 5], r: 4 },
  { at: [-6, 5], r: 4.5 }, { at: [2, 5], r: 4.5 }, { at: [0, -13.5], r: 4 }, { at: [8.5, -11], r: 3.2 },
  { at: [14, -5], r: 4.5 }, { at: [10, 6], r: 4 }, { at: [21, 3], r: 3.5 },
  { at: [29, 5], r: 4 }, { at: [27, -4], r: 3.5 }, { at: [42, -4], r: 4 }, { at: [50, 2], r: 5 }, { at: [45, 4.5], r: 4 },
];

// where a stop's landmark stands: behind the pad, away from the camera
export const landmarkAt = (s) => { const [du, dv] = s.lmAt || [0, -2.7]; return toWorld(s.at[0] + du, s.at[1] + dv); };

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
