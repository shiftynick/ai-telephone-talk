// Exports the talk as a shareable PDF: one 16:9 page per slide beat, in the order of the world's stops,
// with a cover (the world), a page for the live game, and a clickable links page at the end.
//   node tools/export-pdf.mjs [out.pdf]      (needs the slides served on :8931, which the world uses anyway)
// Beats are captured after their animations settle; videos show a representative frame.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] ?? path.join(here, '..', 'export', 'ai-telephone-talk.pdf'));
const BASE = 'http://localhost:8931';
const SHOTS = path.join(path.dirname(OUT), 'pages');
fs.mkdirSync(SHOTS, { recursive: true });

// [slide id, ...steps]; a number waits (ms since the previous step), 'Space' presses it, 'shot' captures a page,
// 'beat:N' waits until the slide reaches beat N by itself (and presses Space if it hasn't within 20 s)
const PLAN = [
  ['cold-open', 'Space', 14000, 'shot', 'Space', 3500, 'shot'],
  ['ad-afterthat', 21000, 'shot', 'Space', 5500, 'shot'],
  ['opencode', 12500, 'shot', 'Space', 1500, 'shot', 'Space', 1500, 'shot'],
  ['t3code', 6500, 'shot', 'Space', 3200, 'shot', 'Space', 4500, 'shot'],
  ['jev', 8500, 'shot', 'Space', 2500, 'shot', 'Space', 7000, 'shot', 'Space', 12000, 'shot', 'Space', 400, 'Space', 22000, 'shot'], // Space skips the Doom clip, the next one starts the explainer
  ['jev-moat', 6500, 'shot', 'Space', 6000, 'shot', 'Space', 6500, 'shot'],
  ['jev-axi', 6500, 'shot', 'Space', 9000, 'shot', 'Space', 3000, 'shot'],
  ['omarchy', 3500, 'shot', 'Space', 8000, 'shot', 'Space', 2000, 'shot'],
  ['ad-aiclarity', 9000, 'shot', 'beat:2', 7000, 'shot', 'Space', 3500, 'shot'],
  ['LIVE'],
  ['ad-odenli', 15500, 'shot', 'Space', 11000, 'shot', 'Space', 6000, 'shot'],
  ['closing', 10000, 'shot'],
];

const LINKS = [
  ['The meetup chat (everything from tonight)', 'https://afterthat.chat/join/DSAI-072626'],
  ['AI Telephone (the game)', 'https://github.com/shiftynick/ai-telephone'],
  ['jev-axi (a CLI for Jev)', 'https://github.com/shiftynick/jev-axi'],
  ['AI Clarity Network', 'https://aiclaritynetwork.com'],
  ['AfterThat', 'https://afterthat.chat'],
  ['Omarchy', 'https://omarchy.org'],
  ['Agent Quota Bar (Omarchy plugin)', 'https://github.com/shiftynick/omarchy-agent-quota-bar'],
  ['kbrgb Keyboard Lighting (Omarchy plugin)', 'https://github.com/shiftynick/omarchy-kbrgb'],
  ['OpenCode', 'https://opencode.ai'],
  ['T3 Code', 'https://t3.codes'],
  ['Jev by TypeSafe AI', 'https://typesafe.ai'],
  ['Open-source Jev alternatives', 'https://madewithjev.com/open-source-jev'],
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('  page error:', e.message));
const pages = [];
const shot = async (name) => {
  // freeze what is still moving for the capture (heavy blurs never settle in a software renderer), then resume
  await page.evaluate(() => { window.__frozen = document.getAnimations().filter((a) => a.playState === 'running'); window.__frozen.forEach((a) => a.pause()); });
  const png = await page.screenshot({ timeout: 120000 });
  await page.evaluate(() => window.__frozen?.forEach((a) => a.play()));
  const file = path.join(SHOTS, `${String(pages.length + 1).padStart(2, '0')}-${name}.jpg`);
  await sharp(png).jpeg({ quality: 86 }).toFile(file);
  pages.push(file);
  console.log('  page', pages.length, name);
};

// cover: the world, as it sits behind the intro
await page.goto(`${BASE}/world/index.html`);
await page.waitForTimeout(9000);
await shot('world');

for (const [id, ...steps] of PLAN) {
  if (id === 'LIVE') { pages.push('LIVE'); console.log('  page', pages.length, 'live game'); continue; }
  console.log(id);
  await page.goto('about:blank');
  await page.goto(`${BASE}/index.html#${id}`);
  let beat = 0;
  for (const s of steps) {
    if (typeof s === 'number') await page.waitForTimeout(s);
    else if (s === 'Space') await page.keyboard.press('Space');
    else if (s.startsWith('beat:')) {
      const want = s.slice(5);
      await page.waitForFunction(([sid, n]) => document.getElementById(sid)?.dataset.beat === n, [id, want], { timeout: 20000 }).catch(() => page.keyboard.press('Space'));
    }
    else if (s === 'shot') await shot(`${id}-${++beat}`);
  }
}

// assemble: one page per image, the live game as its own page, links last
const img = (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const body = pages.map((p) => p === 'LIVE'
  ? `<section class="card"><div class="k">stop 8 · live</div><h1>The AI Telephone game</h1>
     <p>A photo from the room is described, drawn, described, drawn… by a different AI model each time, on the big screen.
     The meter shows how much of the original survives.</p><p class="u">github.com/shiftynick/ai-telephone</p></section>`
  : `<section><img src="${img(p)}"></section>`).join('\n');
const html = `<!doctype html><meta charset="utf-8"><style>
  @page { size: 1920px 1080px; margin: 0; }
  html, body { margin: 0; background: #0c0b0a; }
  section { width: 1920px; height: 1080px; page-break-after: always; overflow: hidden; position: relative; }
  section img { width: 1920px; height: 1080px; display: block; }
  .card, .links { box-sizing: border-box; padding: 150px 160px; color: #f2ece1; font-family: Georgia, serif; background: radial-gradient(1200px 800px at 70% 30%, #2a160e, #0c0b0a 65%); }
  .k { font: 600 26px monospace; letter-spacing: .2em; text-transform: uppercase; color: #ff5b1f; }
  h1 { font-size: 150px; font-weight: 400; margin: 40px 0 50px; line-height: 1; }
  .card p { font: 40px/1.45 sans-serif; color: #cfc7ba; max-width: 1400px; margin: 0 0 30px; }
  .card .u { font: 36px monospace; color: #5ce1e6; margin-top: 60px; }
  .links h1 { font-size: 110px; margin-bottom: 50px; }
  .links ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 80px; }
  .links li { break-inside: avoid; margin-bottom: 30px; font: 30px sans-serif; color: #a39b8f; }
  .links a { display: block; font: 30px monospace; color: #5ce1e6; text-decoration: none; margin-top: 6px; }
</style>
${body}
<section class="links"><div class="k">links</div><h1>Everything from tonight</h1><ul>
${LINKS.map(([t, u]) => `<li>${esc(t)}<a href="${u}">${esc(u.replace(/^https:\/\//, ''))}</a></li>`).join('\n')}
</ul></section>`;
const doc = await browser.newPage();
await doc.setContent(html, { waitUntil: 'load' });
await doc.pdf({ path: OUT, width: '1920px', height: '1080px', printBackground: true });
await browser.close();
console.log(`${OUT} · ${pages.length + 1} pages · ${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB`);
