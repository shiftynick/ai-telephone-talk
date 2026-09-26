// Render a walkthrough video of the world, frame by frame at a fixed 60 fps.
//   node world/tools/tour.mjs [out.mp4]      (needs the slides server on :8931, and ffmpeg)
// The page's clock (performance.now, requestAnimationFrame, setTimeout, CSS
// animations) is virtualised, so every frame is exactly 1/60 s apart no matter
// how long each screenshot takes.
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const out = process.argv[2] || 'world/shots/world-tour.mp4';
const FPS = 60, DT = 1000 / FPS;
const dir = '/tmp/world-tour-frames';
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript(() => {
  if (window.top !== window) return; // leave the (hidden) deck iframe alone
  let vnow = performance.now();
  const realNow = performance.now.bind(performance);
  void realNow;
  performance.now = () => vnow;
  let raf = [], rafId = 0, timers = [], timerId = 0;
  window.requestAnimationFrame = (cb) => { raf.push({ id: ++rafId, cb }); return rafId; };
  window.cancelAnimationFrame = (id) => { raf = raf.filter((r) => r.id !== id); };
  window.setTimeout = (fn, ms = 0, ...a) => { timers.push({ id: ++timerId, t: vnow + ms, fn, a }); return timerId; };
  window.clearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
  window.__advance = (dt) => {
    vnow += dt;
    const due = timers.filter((t) => t.t <= vnow);
    timers = timers.filter((t) => t.t > vnow);
    for (const t of due) try { t.fn(...t.a); } catch (e) { console.error(e); }
    const q = raf; raf = [];
    for (const r of q) try { r.cb(vnow); } catch (e) { console.error(e); }
    // CSS transitions/animations follow the virtual clock too
    for (const a of document.getAnimations()) {
      if (a.__v0 === undefined) { a.__v0 = vnow; a.pause(); }
      a.currentTime = vnow - a.__v0;
    }
  };
});

await page.goto('http://localhost:8931/world/?fresh');
await page.waitForTimeout(3000); // real time: textures, fonts
const cdp = await page.context().newCDPSession(page);

let n = 0;
async function frame() {
  await page.evaluate((dt) => window.__advance(dt), DT);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93 });
  writeFileSync(`${dir}/f${String(++n).padStart(5, '0')}.jpg`, Buffer.from(data, 'base64'));
  if (n % 300 === 0) console.log(`${n} frames (${(n / FPS).toFixed(0)} s)`);
}
const hold = async (s) => { for (let i = 0; i < s * FPS; i++) await frame(); };
const state = () => page.evaluate(() => window.world.state);
async function walkTo(key, pause = 1.6) {
  await page.keyboard.press(key);
  await frame();
  for (let i = 0; i < 60 * 40; i++) { await frame(); if (!(await state()).walking) break; }
  await page.evaluate(() => { const w = window.world; const s = w.stops.find((x) => x.id === w.state.at); if (s) s.visited = true; });
  await hold(pause);
}

// warm up a few frames so the first captured frame is fully drawn
for (let i = 0; i < 20; i++) await page.evaluate((dt) => window.__advance(dt), DT);

await hold(4.5);                       // title over the whole map
await page.keyboard.press('Space');    // fly in
await hold(4.2);
await page.evaluate(() => { window.world.stops[0].visited = true; });
for (const k of ['2', '3', '4', '5', '6', '7', '8', '9', '0']) await walkTo(k);
await walkTo('-', 1.2);                // finale
await page.keyboard.press('x');        // dance under the fireworks
await hold(5);
await page.keyboard.press('x');
await page.keyboard.press('o');        // pull back to the whole map
await hold(5.5);

await browser.close();
console.log(`${n} frames → encoding ${out}`);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/f%05d.jpg`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log('done', out);
