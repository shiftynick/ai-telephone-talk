// Reproduces "teaser silent inside the world": default autoplay rules, keys forwarded from the world page.
import { chromium } from 'playwright';
const b = await chromium.launch(); // no autoplay flag: real browser rules
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8931/world/?at=teaser&play=1');
await p.waitForTimeout(2500);
await p.keyboard.press('Space'); // open the stop (a real key press in the world: the world gets activation)
await p.waitForTimeout(2500);
const deck = () => p.frames().find((f) => f.url().includes('index.html'));
console.log('teaser frame open:', !!deck());
await p.evaluate(() => { document.activeElement?.blur?.(); window.focus(); }); // focus back on the world → keys get forwarded
await p.keyboard.press('Space'); // start the teaser (forwarded as a deck:key message)
let peak = 0;
for (let k = 0; k < 40; k++) { peak = Math.max(peak, await deck().evaluate(() => window.SFX?.level?.() ?? -1)); await p.waitForTimeout(100); }
const state = await deck().evaluate(() => { const c = window.SFX; return { started: document.getElementById('cold-open').classList.contains('standby') === false }; });
console.log('teaser started:', state.started, '| peak sound level in the slide:', peak.toFixed(3), '| page errors:', errs.length ? errs : 'none');
await b.close();
