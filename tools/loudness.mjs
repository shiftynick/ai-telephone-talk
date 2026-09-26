// Compares the world's music level with the slide effects on one scale: every connection to an
// AudioContext destination (in any frame) also feeds a meter.
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript(() => {
  const orig = AudioNode.prototype.connect;
  window.__meters = [];
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode && !dest.__tapped) {
      dest.__tapped = true;
      const a = dest.context.createAnalyser(); a.fftSize = 2048;
      orig.call(this, a); // meter what reaches this context's speakers
      window.__meters.push(a);
    } else if (dest instanceof AudioDestinationNode) {
      const a = window.__meters.find((m) => m.context === dest.context); if (a) orig.call(this, a);
    }
    return orig.call(this, dest, ...rest);
  };
  window.__level = () => { let best = 0; for (const a of window.__meters) { const buf = new Float32Array(a.fftSize); a.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; best = Math.max(best, Math.sqrt(s / buf.length)); } return best; };
});
await p.goto('http://localhost:8931/world/?at=teaser&play=1');
await p.waitForTimeout(1500);
await p.keyboard.press('h'); await p.keyboard.press('h'); // wake the world's audio without opening anything
const measure = async (frame, ms) => { const vals = []; const t0 = Date.now(); while (Date.now() - t0 < ms) { vals.push(await frame.evaluate(() => window.__level?.() ?? 0)); await p.waitForTimeout(80); } vals.sort((a, c) => a - c); return { median: vals[Math.floor(vals.length / 2)], p90: vals[Math.floor(vals.length * 0.9)] }; };
const world = await measure(p.mainFrame(), 6000);
console.log(`world music (no stop open): median ${world.median.toFixed(3)}  p90 ${world.p90.toFixed(3)}`);
await p.keyboard.press('Space'); await p.waitForTimeout(2500);
const deck = p.frames().find((f) => f.url().includes('index.html'));
await p.keyboard.press('Space'); // start the teaser
const slide = await (async () => { const vals = []; const t0 = Date.now(); while (Date.now() - t0 < 20000) { vals.push(await deck.evaluate(() => window.SFX?.level?.() ?? 0)); await p.waitForTimeout(80); } vals.sort((a, c) => a - c); return { median: vals[Math.floor(vals.length / 2)], p90: vals[Math.floor(vals.length * 0.9)] }; })();
console.log(`teaser effects (first 20s):   median ${slide.median.toFixed(3)}  p90 ${slide.p90.toFixed(3)}`);
await b.close();
