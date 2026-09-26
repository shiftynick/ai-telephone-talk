// Render a walkthrough video of the world, frame by frame at a fixed 60 fps.
//   node world/tools/tour.mjs [out.mp4]                 walk the whole route (no slides)
//   node world/tools/tour.mjs out.mp4 --slides          …and open each stop, flipping through its slides
//        --teaser     include the cold open even though it has a <video>
//        --linger=S   seconds to rest on each beat after its animation settles (default 1.4)
//        --max=S      cap on how long one beat may animate before moving on (default 22)
// Needs the slides server on :8931 and ffmpeg. Stops with a live page (the projector) are
// walked past, and slides containing <video> are skipped.
//
// The page's clock (performance.now, Date.now, requestAnimationFrame, timers, CSS animations,
// <video> playback) is virtualised in the world AND in the slide iframe, so every frame is
// exactly 1/60 s apart no matter how long each screenshot takes.
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (name, def) => { const a = args.find((x) => x === `--${name}` || x.startsWith(`--${name}=`)); return a ? (a.includes('=') ? +a.split('=')[1] : true) : def; };
const out = args.find((a) => !a.startsWith('--')) || 'world/shots/world-tour.mp4';
const SLIDES = flag('slides', false), TEASER = flag('teaser', false), LINGER = flag('linger', 1.4), MAXBEAT = flag('max', 22);
const FPS = 60, DT = 1000 / FPS;
const dir = '/tmp/world-tour-frames';
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript(() => {
  // every frame (world + same-origin slide iframes) gets a virtual clock; the top frame drives children
  let vnow = performance.now();
  const v0 = vnow, d0 = Date.now();
  performance.now = () => vnow;
  Date.now = () => d0 + (vnow - v0);
  let raf = [], rafId = 0, timers = [], tid = 0;
  window.requestAnimationFrame = (cb) => { raf.push({ id: ++rafId, cb }); return rafId; };
  window.cancelAnimationFrame = (id) => { raf = raf.filter((r) => r.id !== id); };
  window.setTimeout = (fn, ms = 0, ...a) => { timers.push({ id: ++tid, t: vnow + (+ms || 0), fn, a }); return tid; };
  window.setInterval = (fn, ms = 0, ...a) => { const iv = Math.max(4, +ms || 0); timers.push({ id: ++tid, t: vnow + iv, fn, a, iv }); return tid; };
  window.clearTimeout = window.clearInterval = (id) => { timers = timers.filter((t) => t.id !== id); };
  window.__pending = () => timers.filter((t) => !t.iv).length;
  window.__advance = (dt) => {
    vnow += dt;
    for (let guard = 0; guard < 2000; guard++) {
      let next = null;
      for (const t of timers) if (t.t <= vnow && (!next || t.t < next.t)) next = t;
      if (!next) break;
      if (next.iv) next.t += next.iv; else timers = timers.filter((x) => x !== next);
      try { if (typeof next.fn === 'function') next.fn(...next.a); } catch (e) { console.error(e); }
    }
    const q = raf; raf = [];
    for (const r of q) try { r.cb(vnow); } catch (e) { console.error(e); }
    for (const a of document.getAnimations()) {
      if (a.__v0 === undefined) { a.__v0 = vnow; a.pause(); }
      a.currentTime = vnow - a.__v0;
    }
    // videos step with the virtual clock instead of playing in real time
    for (const v of document.querySelectorAll('video')) {
      if (!v.paused) { v.pause(); v.__vplay = true; }
      if (v.__vplay && v.readyState >= 2) {
        let t = v.currentTime + dt / 1000;
        if (v.duration && t >= v.duration) t = v.loop ? t % v.duration : v.duration;
        v.currentTime = t;
      }
    }
    for (const f of document.querySelectorAll('iframe')) { try { f.contentWindow.__advance?.(dt); } catch { /* cross-origin */ } }
  };
});

await page.goto('http://localhost:8931/world/?fresh&fly');
await page.waitForTimeout(3000); // real time: textures, fonts
const cdp = await page.context().newCDPSession(page);

let n = 0;
async function frame() {
  await page.evaluate((dt) => window.__advance(dt), DT);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93 });
  writeFileSync(`${dir}/f${String(++n).padStart(5, '0')}.jpg`, Buffer.from(data, 'base64'));
  if (n % 600 === 0) console.log(`${n} frames (${(n / FPS).toFixed(0)} s)`);
}
const hold = async (s) => { for (let i = 0; i < s * FPS; i++) await frame(); };
const state = () => page.evaluate(() => window.world.state);
async function until(fn, maxS) { for (let i = 0; i < maxS * FPS; i++) { await frame(); if (fn(await state())) return true; } return false; }
async function walkTo(i, pause = 1.4) {
  await page.evaluate((i) => { window.world.goToStop(window.world.stops[i]); }, i);
  await frame();
  await until((s) => !s.walking, 40);
  await page.evaluate((i) => { window.world.stops[i].visited = true; }, i);
  await hold(pause);
}
// let the current beat's animation finish: no pending one-shot timers in the slide for a moment
async function settle() {
  let quiet = 0;
  for (let i = 0; i < MAXBEAT * FPS; i++) {
    await frame();
    const p = await page.evaluate(() => { try { return document.querySelector('#slides').contentWindow.__pending?.() ?? 0; } catch { return 0; } });
    quiet = p === 0 ? quiet + 1 : 0;
    if (quiet > 0.5 * FPS) return;
  }
}
async function flipThrough(i) {
  await page.evaluate((i) => { window.world.openStop(window.world.stops[i]); }, i); // not awaited: our clock drives it
  if (!(await until((s) => s.open, 20))) { console.log('  (did not open)'); return; }
  const seen = [];
  for (let press = 0; press < 40; press++) {
    const s = await state();
    if (!s.open) break;
    if (s.slide && seen.at(-1) !== s.slide) { seen.push(s.slide); }
    await settle();
    await hold(LINGER);
    await page.keyboard.press('ArrowRight');
    await frame();
  }
  await until((s) => !s.open && !s.busy, 15);
  console.log('  slides:', seen.join(' → '));
  await hold(1.6);
}

// warm up a few frames so the first captured frame is fully drawn
for (let i = 0; i < 20; i++) await page.evaluate((dt) => window.__advance(dt), DT);

const videoSlides = SLIDES ? await page.evaluate(async () => {
  const doc = new DOMParser().parseFromString(await (await fetch('../index.html')).text(), 'text/html');
  return [...doc.querySelectorAll('.slide')].filter((s) => s.querySelector('video')).map((s) => s.id);
}) : [];
if (SLIDES) console.log('video slides skipped:', videoSlides.filter((id) => !(TEASER && id === 'cold-open')).join(', ') || 'none');

await hold(4.5);                       // title over the whole map
await page.keyboard.press('Space');    // fly in
await hold(4.2);
const count = await page.evaluate(() => window.world.stops.length);
for (let i = 0; i < count; i++) {
  if (i > 0) await walkTo(i, SLIDES ? 0.9 : 1.6);
  if (!SLIDES) continue;
  const plan = await page.evaluate(({ i, skip }) => {
    const st = window.world.stops[i];
    if (st.url) return { id: st.id, open: false, why: 'live page' };
    st.slides = st.slides.filter((id) => !skip.includes(id));
    return { id: st.id, open: st.slides.length > 0, why: st.slides.length ? '' : 'only video slides' };
  }, { i, skip: videoSlides.filter((id) => !(TEASER && id === 'cold-open')) });
  console.log(`${i + 1}. ${plan.id}${plan.open ? '' : ` — walked past (${plan.why})`}`);
  if (plan.open) await flipThrough(i);
  else { await page.evaluate((i) => { window.world.stops[i].visited = true; }, i); await hold(1.2); }
}
await page.keyboard.press('x');        // dance under the fireworks
await hold(5);
await page.keyboard.press('x');
await page.keyboard.press('o');        // pull back to the whole map
await hold(5.5);

await browser.close();
console.log(`${n} frames (${(n / FPS).toFixed(1)} s) → encoding ${out}`);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/f%05d.jpg`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log('done', out);
