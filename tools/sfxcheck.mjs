// Plays the cold open in a real browser and samples the deck's sound level at each moment.
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file:///home/shifty/Work/ai-telephone/slides/index.html#cold-open');
await p.waitForTimeout(1200);
await p.keyboard.press(' ');
const peaks = [];
for (let t = 0; t < 70; t++) {
  let m = 0;
  for (let k = 0; k < 8; k++) { m = Math.max(m, await p.evaluate(() => window.SFX?.level?.() ?? -1)); await p.waitForTimeout(110); }
  const step = await p.evaluate(() => document.querySelector('.co-step')?.textContent ?? '');
  const titled = await p.evaluate(() => document.getElementById('cold-open').classList.contains('titled'));
  peaks.push(`${t}s ${titled ? 'TITLE' : step.padEnd(16)} ${m.toFixed(3)}`);
  if (titled && t > 5) { for (let k = 0; k < 4; k++) { await p.waitForTimeout(1000); peaks.push(`   +${k + 1}s after title ${(await p.evaluate(() => window.SFX.level())).toFixed(3)}`); } break; }
}
await p.keyboard.press('m');
await p.waitForTimeout(300);
console.log(peaks.filter((_, i) => i % 3 === 0 || i < 4 || peaks[i].includes('TITLE') || peaks[i].includes('+')).join('\n'));
console.log('muted with M → level', (await p.evaluate(() => window.SFX.level())).toFixed(3), '| page errors:', errs.length ? errs : 'none');
await b.close();
