// AI Telephone — the world map. Walk the mascot between stops; Space/Enter
// opens a stop's slides (the real deck, in an iframe); Esc comes back.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { createMascot } from '../mascot/mascot.js';
import { STOPS, buildGraph, route, landmarkAt } from './map.js';
import { buildTerrain } from './terrain.js';
import { buildLandmark } from './landmarks.js';
import { buildProps } from './props.js';

const Q = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------- renderer
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
// keep the internal resolution <= ~2560 px wide (a 4K TV would otherwise cost 4x)
const pixelRatio = () => Math.min(devicePixelRatio, 2, 2560 / innerWidth) * (Q.get('q') === 'low' ? 0.7 : 1);
renderer.setPixelRatio(pixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
// time of day follows the talk: golden hour at the start, dusk by the finale
const DAY = {
  golden: { top: '#27305e', mid: '#8a6fa6', low: '#f2a987', horizon: '#ffd3a8', fog: '#e7a58f', sun: '#ffd6ae', sunI: 3.2, hemi: 1.35 },
  dusk: { top: '#0e1234', mid: '#3a2f6b', low: '#b0607a', horizon: '#f08a6a', fog: '#8a5a78', sun: '#ff9a6a', sunI: 1.9, hemi: 0.95 },
};
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 4; skyCanvas.height = 512;
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
scene.fog = new THREE.Fog(0xe7a58f, 60, 160);
const mixHex = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
let dayK = -1;
function setDay(k) {
  if (Math.abs(k - dayK) < 0.002) return;
  dayK = k;
  const A = DAY.golden, B = DAY.dusk, m = (key) => mixHex(A[key], B[key], k);
  const g = skyCanvas.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, m('top')); gr.addColorStop(0.45, m('mid')); gr.addColorStop(0.8, m('low')); gr.addColorStop(1, m('horizon'));
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  skyTex.needsUpdate = true;
  scene.fog.color.set(m('fog'));
  sun.color.set(m('sun'));
  sun.intensity = THREE.MathUtils.lerp(A.sunI, B.sunI, k);
  hemi.intensity = THREE.MathUtils.lerp(A.hemi, B.hemi, k);
}
// stars in the upper sky, on a dome that travels with the camera
const stars = (() => {
  const N = 700, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.25 + Math.random() * 1.2;
    pos.set([Math.cos(a) * Math.cos(e) * 400, Math.sin(e) * 400, Math.sin(a) * Math.cos(e) * 400], i * 3);
    const b = 0.6 + Math.random() * 1.4;
    col.set([b, b, b * 1.1], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, opacity: 0.8, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.renderOrder = -1;
  p.frustumCulled = false;
  scene.add(p);
  return p;
})();

const camera = new THREE.PerspectiveCamera(24, innerWidth / innerHeight, 0.5, 600);

// lights: warm low sun, cool sky fill
const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x8a5a48, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd6ae, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 2.5;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-0.42, 0.66, 0.62).normalize();
setDay(0);
const rim = new THREE.DirectionalLight(0x9fb4ff, 0.6);
rim.position.set(20, 12, -30);
scene.add(rim);

// ---------------------------------------------------------------- post
const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(pixelRatio());
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
// soft contact shadows where things meet the ground (?ao=0 to disable)
let gtao = null;
if (Q.get('ao') !== '0') {
  gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.5, scale: 1.25, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);
}
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.6, 0.92);
composer.addPass(bloom);
const tilt = (axis) => new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: 1 }, band: { value: 0.2 }, focus: { value: 0.5 }, texel: { value: new THREE.Vector2(1 / innerWidth, 1 / innerHeight) }, dir: { value: axis } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float amount, band, focus; uniform vec2 texel, dir; varying vec2 vUv;
    void main(){
      float d = abs(vUv.y - focus);
      float b = smoothstep(band, band + 0.32, d) * amount * 3.2;
      vec4 s = vec4(0.0);
      float w[5]; w[0]=0.2270270270; w[1]=0.1945945946; w[2]=0.1216216216; w[3]=0.0540540541; w[4]=0.0162162162;
      s += texture2D(tDiffuse, vUv) * w[0];
      for (int i = 1; i < 5; i++) {
        vec2 o = dir * texel * float(i) * b;
        s += texture2D(tDiffuse, vUv + o) * w[i];
        s += texture2D(tDiffuse, vUv - o) * w[i];
      }
      gl_FragColor = s;
    }`,
});
const tiltH = tilt(new THREE.Vector2(1, 0)), tiltV = tilt(new THREE.Vector2(0, 1));
composer.addPass(tiltH);
composer.addPass(tiltV);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio());
  composer.setPixelRatio(pixelRatio());
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  for (const p of [tiltH, tiltV]) p.uniforms.texel.value.set(1 / innerWidth, 1 / innerHeight);
});

// ---------------------------------------------------------------- world
const graph = buildGraph();
const terrain = buildTerrain(graph);
scene.add(terrain.mesh);
const props = buildProps(scene, terrain, graph);

const stops = STOPS.map((s) => {
  const node = graph.nodes.get(s.id);
  const lm = buildLandmark(s, { terrain });
  // landmarks stand behind the pad (away from the camera) and face it
  lm.group.position.copy(landmarkAt(s));
  lm.group.rotation.y = lm.face ?? Math.PI / 4;
  scene.add(lm.group);
  lm.group.updateMatrixWorld(true);
  const el = document.createElement('div');
  el.className = `lbl${s.tech ? ' tech' : ''}`;
  el.innerHTML = `<b>${s.n}</b><span>${s.title}</span>${s.sub ? `<i>${s.sub}</i>` : ''}`;
  $('#labels').appendChild(el);
  return { ...s, node, lm, el, visited: false, anchor: lm.group.localToWorld(lm.anchor.clone()) };
});
// glowing ring on the pad you're standing on ("press enter here")
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5b1f).multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
const padRing = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.75, 48), ringMat);
padRing.rotation.x = -Math.PI / 2;
const padRing2 = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.26, 48), ringMat);
padRing2.rotation.x = -Math.PI / 2;
scene.add(padRing, padRing2);

const signs = [...graph.nodes.values()].filter((n) => n.junction?.sign).map((n) => {
  const el = document.createElement('div');
  el.className = 'lbl sign';
  el.textContent = `↑ ${n.junction.sign}`;
  $('#labels').appendChild(el);
  return { el, anchor: n.pos.clone().add(new THREE.Vector3(0, 1.8, 0)) };
});

// ---------------------------------------------------------------- mascot
const pig = createMascot(THREE, { smoke: true, scale: 1.3 });
scene.add(pig.root);
// a soft key light that follows the pig, so the hero's face always reads
const pigLight = new THREE.PointLight(0xfff0e0, 5, 5, 1.6);
scene.add(pigLight);
// progress survives a reload mid-talk (localStorage); ?fresh or Shift+R starts over
const SAVE_KEY = 'ai-telephone-world';
let saved = null;
try { saved = Q.has('fresh') || Q.has('at') ? null : JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { saved = null; }
const player = {
  node: graph.nodes.get(Q.get('at') || (saved && graph.nodes.has(saved.at) ? saved.at : 'start')),
  pos: new THREE.Vector3(),
  yaw: 0.6, targetYaw: 0.6,
  walk: null, // { steps: [{edge, forward}], k, s }
  held: null,
};
player.pos.copy(player.node.pos);

const SPEED = 3.6;
// little dust puffs kicked up while walking
const dust = [];
{
  const g = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xe8d9bd, transparent: true, opacity: 0, roughness: 1, depthWrite: false }));
    m.visible = false;
    scene.add(m);
    dust.push({ m, age: 9 });
  }
}
let dustT = 0, dustI = 0;
function updateDust(dt) {
  if (player.walk) {
    dustT -= dt;
    if (dustT <= 0) {
      dustT = 0.13;
      const d = dust[dustI++ % dust.length];
      d.age = 0;
      d.m.position.set(player.pos.x + (Math.random() - 0.5) * 0.3, 0.08, player.pos.z + (Math.random() - 0.5) * 0.3);
      d.m.rotation.set(Math.random(), Math.random(), 0);
      d.m.visible = true;
    }
  }
  for (const d of dust) {
    if (d.age > 0.9) { d.m.visible = false; continue; }
    d.age += dt;
    const k = d.age / 0.9;
    d.m.position.y += dt * 0.35;
    d.m.scale.setScalar(0.6 + k * 1.6);
    d.m.material.opacity = 0.55 * (1 - k);
  }
}
function edgePoint(edge, forward, s) {
  const u = THREE.MathUtils.clamp(s / edge.len, 0, 1);
  return edge.curve.getPointAt(forward ? u : 1 - u);
}
function startWalk(steps) {
  if (!steps || !steps.length) return;
  player.walk = { steps, k: 0, s: 0 };
  pig.play('walk', { fade: 0.15 });
  setCard(null);
}
function arrive(node) {
  player.node = node;
  player.walk = null;
  // keep going while an arrow is held
  if (player.held && !node.stop) { if (tryDir(player.held)) return; }
  if (player.held && node.stop == null) { if (tryDir(player.held)) return; }
  pig.play('idle', { fade: 0.25 });
  const st = stopOf(node);
  setCard(st);
  if (st) st.pop = 1;
  save();
  if (st) preload(st);
}
const stopOf = (node) => stops.find((s) => s.node === node) || null;

// arrows pick the road that best matches the screen direction
const SCREEN = {
  right: new THREE.Vector3(1, 0, -1).normalize(), left: new THREE.Vector3(-1, 0, 1).normalize(),
  up: new THREE.Vector3(-1, 0, -1).normalize(), down: new THREE.Vector3(1, 0, 1).normalize(),
};
function tryDir(dirName) {
  const want = SCREEN[dirName];
  const node = player.node;
  let best = null, bestDot = 0.3;
  for (const e of node.edges) {
    if (e.tech && !techRoute) continue; // the barrier is down
    const forward = e.A === node;
    const p = e.curve.getPointAt(forward ? Math.min(1, 1.6 / e.len) : Math.max(0, 1 - 1.6 / e.len));
    const d = p.sub(node.pos).setY(0).normalize();
    const dot = d.dot(want);
    if (dot > bestDot) { bestDot = dot; best = { edge: e, forward }; }
  }
  if (!best) return false;
  startWalk([best]);
  return true;
}

// talk order (optionally skipping the technical detour)
let techRoute = saved ? saved.tech !== false : !Q.has('express');
if (saved) for (const s of stops) s.visited = (saved.visited || []).includes(s.id);
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ at: player.node.id, visited: stops.filter((s) => s.visited).map((s) => s.id), tech: techRoute })); } catch {}
}
const order = () => stops.filter((s) => techRoute || !s.tech);
function goToStop(st) {
  if (!st || player.walk) return;
  if (st.tech && !techRoute) setRoute(true);
  if (st.node === player.node) return;
  startWalk(route(graph, player.node.id, st.node.id));
}
function nextStop(dir = 1) {
  const list = order();
  const here = stopOf(player.node);
  let idx;
  if (here && list.includes(here)) idx = list.indexOf(here) + dir;
  else {
    // from a junction or a skipped stop: nearest stop along the talk order
    const all = STOPS.map((s) => s.id);
    const pos = here ? all.indexOf(here.id) : lastVisitedIndex();
    idx = dir > 0 ? list.findIndex((s) => all.indexOf(s.id) > pos) : list.map((s) => all.indexOf(s.id)).filter((n) => n < pos).length - 1;
  }
  goToStop(list[idx]);
}
function lastVisitedIndex() {
  let n = -1;
  stops.forEach((s, i) => { if (s.visited) n = i; });
  return n;
}
function smartNext() {
  const here = stopOf(player.node);
  if (!player.walk && here && !here.visited) openStop(here);
  else nextStop(1);
}

// ---------------------------------------------------------------- camera
const cam = {
  focus: new THREE.Vector3().copy(player.pos).add(new THREE.Vector3(0, 1.4, 0)),
  dist: 34, el: THREE.MathUtils.degToRad(36), az: Math.PI / 4,
  want: { dist: 34 },
  override: null, // { focus, dist } during the intro / transitions
};
function placeCamera(focus, dist, el, az) {
  camera.position.set(
    focus.x + Math.cos(el) * Math.sin(az) * dist,
    focus.y + Math.sin(el) * dist,
    focus.z + Math.cos(el) * Math.cos(az) * dist,
  );
  camera.lookAt(focus);
}

// ---------------------------------------------------------------- UI
function setCard(st) {
  const card = $('#card');
  if (!st) { card.classList.remove('on'); return; }
  card.querySelector('.card-n').textContent = String(st.n).padStart(2, '0');
  card.querySelector('.card-t').textContent = st.title;
  card.querySelector('.card-s').textContent = st.sub || '';
  card.classList.toggle('tech', !!st.tech);
  card.classList.add('on');
}
function setRoute(on) {
  techRoute = on;
  const r = $('#route');
  r.classList.toggle('express', !on);
  r.querySelector('.v').textContent = on ? 'full route' : 'express route';
  for (const s of stops) s.el.classList.toggle('dim', !on && !!s.tech);
  props.setTechOpen?.(on);
  save();
}
setRoute(techRoute);

const tmpV = new THREE.Vector3();
function toScreen(p) {
  tmpV.copy(p).project(camera);
  return { x: (tmpV.x * 0.5 + 0.5) * innerWidth, y: (-tmpV.y * 0.5 + 0.5) * innerHeight, z: tmpV.z };
}
function updateLabels() {
  const here = player.walk ? null : stopOf(player.node);
  const k = THREE.MathUtils.clamp(34 / camera.position.distanceTo(cam.focus), 0.45, 1.15);
  for (const s of stops) {
    const p = toScreen(s.anchor);
    s.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%) scale(${(s === here ? k * 1.15 : k).toFixed(3)})`;
    s.el.classList.toggle('here', s === here);
    s.el.classList.toggle('visited', s.visited);
    s.el.style.visibility = p.z > 1 ? 'hidden' : '';
  }
  for (const g of signs) {
    const p = toScreen(g.anchor);
    g.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%) scale(${k.toFixed(3)})`;
    g.el.style.opacity = techRoute ? '' : '0.3';
  }
}

// ---------------------------------------------------------------- slides overlay
const frame = $('#slides'), stageEl = $('#stage');
let overlay = { open: false, busy: false, stop: null, loadedSrc: '', ready: false };
const slideIds = (st) => (techRoute && st.techSlides) || st.slides;
const srcFor = (st) => { const ids = slideIds(st); return `../index.html?embed=1&hold=1&only=${ids.join(',')}#${ids[0]}`; };
function preload(st) {
  const src = srcFor(st);
  if (overlay.loadedSrc === src) return;
  overlay.loadedSrc = src; overlay.ready = false;
  frame.onload = () => { if (frame.getAttribute('src') === src) overlay.ready = true; };
  frame.src = src;
}
const waitReady = () => new Promise((res) => {
  const t0 = performance.now();
  const tick = () => (overlay.ready || performance.now() - t0 > 10000 ? res() : setTimeout(tick, 30));
  tick();
});
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
function tween(ms, fn, e = ease) {
  return new Promise((res) => {
    const t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      fn(e(t));
      if (t < 1) requestAnimationFrame(step); else res();
    };
    step();
  });
}
function iris(r, at) { stageEl.style.clipPath = `circle(${r}px at ${at.x}px ${at.y}px)`; }

async function openStop(st) {
  if (overlay.open || overlay.busy || player.walk) return;
  overlay.busy = true;
  overlay.stop = st;
  setCard(null);
  preload(st);
  // the pig turns and walks up to the landmark while the camera zooms toward it
  const home = st.node.pos.clone();
  const dir = st.lm.group.position.clone().sub(home).setY(0).normalize();
  player.targetYaw = Math.atan2(dir.x, dir.z);
  pig.play('walk', { fade: 0.15 });
  tween(850, (t) => player.pos.copy(home).addScaledVector(dir, 1.15 * t), (t) => t).then(() => pig.play('idle', { fade: 0.2 }));
  const from = { f: cam.focus.clone(), d: cam.dist };
  const lmFocus = st.lm.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  const zoom = tween(900, (t) => { cam.override = { focus: from.f.clone().lerp(lmFocus, t), dist: THREE.MathUtils.lerp(from.d, 13, t) }; });
  await waitReady();
  frame.contentWindow?.postMessage({ type: 'deck:start' }, '*');
  await new Promise((r) => setTimeout(r, 420));
  const at = toScreen(lmFocus);
  const R = Math.hypot(Math.max(at.x, innerWidth - at.x), Math.max(at.y, innerHeight - at.y)) + 20;
  iris(0, at);
  stageEl.classList.add('open');
  await tween(850, (t) => iris(R * t, at));
  await zoom;
  stageEl.style.clipPath = 'none';
  overlay.open = true; overlay.busy = false;
  frame.focus();
  frame.contentWindow?.focus();
}

async function closeStop(reason) {
  if (!overlay.open || overlay.busy) return;
  overlay.busy = true;
  const st = overlay.stop;
  st.visited = true;
  save();
  const lmFocus = st.lm.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  const at = toScreen(lmFocus);
  const R = Math.hypot(Math.max(at.x, innerWidth - at.x), Math.max(at.y, innerHeight - at.y)) + 20;
  await tween(700, (t) => iris(R * (1 - t), at));
  stageEl.classList.remove('open');
  frame.src = 'about:blank';
  overlay.loadedSrc = ''; overlay.ready = false;
  window.focus();
  // back out onto the pad, then celebrate
  const home = st.node.pos.clone(), door = player.pos.clone();
  player.targetYaw = Math.atan2(home.x - door.x, home.z - door.z);
  pig.play('walk', { fade: 0.1 });
  const walkOut = tween(700, (t) => player.pos.copy(door).lerp(home, t), (t) => t).then(() => {
    player.targetYaw = Math.PI / 4;
    if (reason === 'end') { pig.play('cheer', { loop: false }); props.celebrate?.(st, reason); st.lm.celebrate?.(); }
    else pig.play('idle', { fade: 0.2 });
  });
  const from = { f: cam.override?.focus.clone() || cam.focus.clone(), d: cam.override?.dist ?? 13 };
  await tween(1100, (t) => { cam.override = { focus: from.f.clone().lerp(cam.focus, t), dist: THREE.MathUtils.lerp(from.d, cam.dist, t) }; });
  await walkOut;
  cam.override = null;
  overlay.open = false; overlay.busy = false; overlay.stop = null;
  setCard(stopOf(player.node));
  preload(st);
}

addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'deck:exit') closeStop(d.reason || 'esc');
  else if (d.type === 'deck:key' && d.key === 'f') toggleFullscreen();
});

// ---------------------------------------------------------------- input
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
}
let playing = Q.has('play');
if (playing) document.body.classList.add('playing');
const ARROWS = { ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down', d: 'right', a: 'left', w: 'up', s: 'down' };
addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'f' || k === 'F') { toggleFullscreen(); return; }
  if (k === 'b' || k === 'B' || k === '.') { document.body.classList.toggle('blackout'); return; }
  if (overlay.open) {
    if (k === 'Escape') closeStop('esc');
    else frame.contentWindow?.postMessage({ type: 'deck:key', key: k }, '*');
    return;
  }
  if (overlay.busy) return;
  if (!playing) { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(k)) startPlaying(); return; }
  if (overviewOn && k !== 'o' && k !== 'O' && k !== 't' && k !== 'T') { toggleOverview(); if (k === 'Escape') return; }
  const dir = ARROWS[k] || ARROWS[k.toLowerCase?.()];
  if (dir) {
    e.preventDefault();
    player.held = dir;
    if (!player.walk) tryDir(dir);
    return;
  }
  if (k === ' ' || k === 'Enter') { e.preventDefault(); const st = stopOf(player.node); if (st && !player.walk) openStop(st); }
  else if (k === 'PageDown' || k === 'n' || k === 'N') { e.preventDefault(); smartNext(); }
  else if (k === 'PageUp' || k === 'p' || k === 'P') { e.preventDefault(); nextStop(-1); }
  else if (k === 't' || k === 'T') setRoute(!techRoute);
  else if (k === 'o' || k === 'O') toggleOverview();
  else if (k === 'h' || k === 'H' || k === '?') document.body.classList.toggle('help');
  else if (k === 'R' && e.shiftKey) { localStorage.removeItem(SAVE_KEY); location.href = location.pathname; }
  else if (k === 'Home') { goToStop(stops[0]); }
  else if (/^[0-9]$/.test(k)) { const n = k === '0' ? 10 : +k; goToStop(stops.find((s) => s.n === n)); }
  else if (k === '-') goToStop(stops.find((s) => s.n === 11));
  else if (k === 'x' || k === 'X') pig.play(pig.current === 'dance' ? 'idle' : 'dance');
});
addEventListener('keyup', (e) => { if (ARROWS[e.key] === player.held || ARROWS[e.key?.toLowerCase?.()] === player.held) player.held = null; });

// ---------------------------------------------------------------- intro
const overview = {
  focus: terrain.center.clone().add(new THREE.Vector3(0, 3, 0)),
  dist: 128,
};
function startPlaying() {
  if (playing) return;
  playing = true;
  document.body.classList.add('playing');
  const from = { f: overview.focus.clone(), d: overview.dist };
  cam.override = { focus: from.f.clone(), dist: from.d };
  tween(3200, (t) => {
    cam.override = { focus: from.f.clone().lerp(cam.focus, t), dist: THREE.MathUtils.lerp(from.d, cam.dist, t) };
  }).then(() => { cam.override = null; setCard(stopOf(player.node)); preload(stopOf(player.node)); });
}
if (!playing) cam.override = { focus: overview.focus.clone(), dist: overview.dist };
else { setCard(stopOf(player.node)); preload(stopOf(player.node)); }

// "where are we?" — pull back to the whole map and glide back in
let overviewOn = false;
function toggleOverview() {
  if (overlay.open || overlay.busy) return;
  overviewOn = !overviewOn;
  document.body.classList.toggle('overview', overviewOn);
  const from = { f: (cam.override?.focus || cam.focus).clone(), d: cam.override?.dist ?? cam.dist };
  const to = overviewOn ? overview : null;
  tween(1800, (t) => {
    const f = to ? to.focus : cam.focus, d = to ? to.dist : cam.dist;
    cam.override = { focus: from.f.clone().lerp(f, t), dist: THREE.MathUtils.lerp(from.d, d, t) };
  }).then(() => { if (!overviewOn) cam.override = null; });
}

// progress dots under the brand
const dots = $('#dots');
for (const s of stops) {
  const d = document.createElement('i');
  d.className = s.tech ? 'tech' : '';
  d.title = s.title;
  dots.appendChild(d);
  s.dot = d;
}
function updateDots() {
  const here = player.walk ? null : stopOf(player.node);
  for (const s of stops) {
    s.dot.classList.toggle('on', s.visited);
    s.dot.classList.toggle('here', s === here);
    s.dot.classList.toggle('off', !!s.tech && !techRoute);
  }
}

// ---------------------------------------------------------------- loop
const timer = new THREE.Timer();
let dayNow = 0;
let t = 0;
const fwd = new THREE.Vector3();
function frameLoop() {
  if (!window.__firstFrame) { window.__firstFrame = performance.now(); document.body.classList.add("ready"); }
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  t += dt;

  // walking
  if (player.walk) {
    const w = player.walk;
    let step = w.steps[w.k];
    w.s += SPEED * dt;
    while (w.s >= step.edge.len) {
      w.s -= step.edge.len;
      const reached = step.forward ? step.edge.B : step.edge.A;
      w.k++;
      if (w.k >= w.steps.length) { player.pos.copy(reached.pos); arrive(reached); break; }
      step = w.steps[w.k];
    }
    if (player.walk) {
      const p = edgePoint(step.edge, step.forward, w.s);
      fwd.copy(edgePoint(step.edge, step.forward, w.s + 0.3)).sub(p);
      if (fwd.lengthSq() > 1e-6) player.targetYaw = Math.atan2(fwd.x, fwd.z);
      player.pos.copy(p);
    }
  } else if (!overlay.open) {
    // idle: turn gently toward the camera-ish
    const st = stopOf(player.node);
    if (st && !overlay.busy) player.targetYaw = Math.PI / 4 + Math.sin(t * 0.3) * 0.15;
  }
  let dy = player.targetYaw - player.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  player.yaw += dy * (1 - Math.exp(-dt * 10));
  pig.root.position.copy(player.pos);
  pig.root.position.y = Math.max(0, terrain.heightAt(player.pos.x, player.pos.z) === -Infinity ? 0 : 0);
  pig.root.rotation.y = player.yaw;
  pigLight.position.set(player.pos.x + 1.3, 1.9, player.pos.z + 1.3);
  pig.update(dt);
  updateDust(dt);

  // pad ring
  {
    const st = !player.walk && !overlay.open ? stopOf(player.node) : null;
    const want = st ? 1 : 0;
    ringMat.opacity += (want * 0.85 - ringMat.opacity) * (1 - Math.exp(-dt * 6));
    if (st) { padRing.position.set(st.node.pos.x, 0.03, st.node.pos.z); padRing2.position.copy(padRing.position); }
    const k = 1 + Math.sin(t * 3) * 0.04;
    padRing.scale.setScalar(k);
    padRing2.scale.setScalar(1 + ((t * 0.6) % 1) * 0.5);
    padRing.visible = padRing2.visible = ringMat.opacity > 0.01;
    ringMat.color.setRGB(2.2, 0.36 * 2.2, 0.12 * 2.2).lerp(new THREE.Color(0.36, 0.88, 0.9).multiplyScalar(2.2), st?.tech ? 1 : 0);
  }

  // camera follows with a little lead
  const lead = player.walk ? fwd.clone().setY(0).normalize().multiplyScalar(2.2) : new THREE.Vector3();
  // at a stop, frame the pig and its landmark together
  const atStop = !player.walk && stopOf(player.node);
  const want = player.pos.clone().add(lead).add(new THREE.Vector3(0, 0.8, 0));
  let wantDist = player.walk ? 36 : 30;
  if (atStop) {
    want.lerp(atStop.lm.group.position, 0.45);
    want.y += 0.6 + (atStop.lm.view?.lift || 0);
    wantDist = atStop.lm.view?.dist || 31;
  }
  cam.focus.lerp(want, 1 - Math.exp(-dt * 2.6));
  cam.dist += (wantDist - cam.dist) * (1 - Math.exp(-dt * 1.2));
  const f = cam.override ? cam.override.focus : cam.focus;
  const d = cam.override ? cam.override.dist : cam.dist;
  const drift = !playing || overviewOn ? 0.16 : 0.04;
  const az = cam.az + Math.sin(t * 0.11) * drift;
  const el = cam.el + Math.sin(t * 0.07) * 0.015;
  placeCamera(f, d, el, az);

  // shadows follow the view; cover more when zoomed out
  const span = THREE.MathUtils.clamp(d * 0.62, 16, 80);
  const sc = sun.shadow.camera;
  if (Math.abs(sc.right - span) > 0.5) {
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
    sc.updateProjectionMatrix();
  }
  sun.target.position.copy(f);
  sun.position.copy(f).addScaledVector(SUN_DIR, 80);
  sc.near = 1; sc.far = 220;

  scene.fog.near = d * 0.9 + 20;
  scene.fog.far = d * 1.6 + 90;
  const tiltAmt = THREE.MathUtils.clamp((d - 10) / 30, 0, 1.2);
  tiltH.uniforms.amount.value = tiltV.uniforms.amount.value = tiltAmt;

  {
    const done = stops.filter((s) => s.visited).length;
    const target = Q.has('dusk') ? 1 : Math.min(1, done / (stops.length - 1)) * 0.9 + (stopOf(player.node)?.id === 'finale' && !player.walk ? 0.1 : 0);
    dayNow += (target - dayNow) * (1 - Math.exp(-dt * 0.6));
    setDay(dayNow);
  }
  props.update?.(dt, t, { camera, player });
  stars.position.copy(camera.position);
  stars.material.opacity = 0.65 + Math.sin(t * 0.8) * 0.1;
  const here = !player.walk ? stopOf(player.node)?.id : null;
  for (const s of stops) {
    s.lm.update?.(dt, t, { here });
    if (s.pop > 0) {
      s.pop = Math.max(0, s.pop - dt * 2.2);
      const k = Math.sin((1 - s.pop) * Math.PI);
      s.lm.group.scale.set(1 + k * 0.05, 1 - k * 0.04 + Math.sin((1 - s.pop) * Math.PI * 2) * 0.03, 1 + k * 0.05);
    }
  }
  updateLabels();
  updateDots();
  composer.render();
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);

// debug handle for screenshots
window.world = {
  stops, player, graph, goToStop, openStop, closeStop, setRoute, pig, cam, startPlaying,
  get state() { return { at: player.node.id, walking: !!player.walk, open: overlay.open, busy: overlay.busy, visited: stops.filter((s) => s.visited).map((s) => s.id), slide: overlay.open ? frame.contentDocument?.body?.dataset.slide : null }; },
};
