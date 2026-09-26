import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file:///home/shifty/Work/ai-telephone/slides/index.html#ad-afterthat');
await p.keyboard.press('Shift'); // a user gesture so audio can start
const t0 = Date.now(), rows = [];
while (Date.now() - t0 < 21000) {
  let m = 0; for (let k = 0; k < 6; k++) { m = Math.max(m, await p.evaluate(() => window.SFX?.level?.() ?? 0)); await p.waitForTimeout(60); }
  const phase = await p.evaluate(() => { const el = document.getElementById('ad-afterthat'); return el.classList.contains('aged') ? 'ghost town' : document.querySelector('.aft-skip.on') ? 'TIME SKIP' : 'chat'; });
  rows.push([((Date.now() - t0) / 1000).toFixed(0), phase, m]);
}
await p.keyboard.press(' ');
let rev = 0; for (let k = 0; k < 20; k++) { rev = Math.max(rev, await p.evaluate(() => window.SFX.level())); await p.waitForTimeout(60); }
const byPhase = {}; for (const [, ph, m] of rows) (byPhase[ph] ??= []).push(m);
for (const [ph, v] of Object.entries(byPhase)) console.log(ph.padEnd(11), 'peak', Math.max(...v).toFixed(3), '| typical', v.sort((a, c) => a - c)[Math.floor(v.length / 2)].toFixed(3));
console.log('reveal chime peak', rev.toFixed(3), '| page errors:', errs.length ? errs : 'none');
await b.close();
