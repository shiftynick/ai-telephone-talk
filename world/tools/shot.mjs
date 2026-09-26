// Screenshot a page of the world (needs `python3 -m http.server 8931` in slides/).
//   node world/tools/shot.mjs <path-or-url> <out.png> [waitMs] [key:ArrowRight ...] [wait:500 ...] [eval:js ...]
// Steps after waitMs run in order; the shot is taken at the end.
import { chromium } from 'playwright';

const [, , target = 'world/', out = '/tmp/world.png', wait = '1500', ...steps] = process.argv;
const url = target.startsWith('http') ? target : `http://localhost:8931/${target}`;
const browser = await chromium.launch({
  args: ['--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(+wait);
for (const s of steps) {
  const [kind, ...rest] = s.split(':');
  const arg = rest.join(':');
  if (kind === 'key') await page.keyboard.press(arg);
  else if (kind === 'down') await page.keyboard.down(arg);
  else if (kind === 'up') await page.keyboard.up(arg);
  else if (kind === 'wait') await page.waitForTimeout(+arg);
  else if (kind === 'eval') console.log('eval →', JSON.stringify(await page.evaluate(arg)));
  else if (kind === 'shot') await page.screenshot({ path: arg });
}
await page.screenshot({ path: out });
if (logs.length) console.log(logs.slice(-30).join('\n'));
await browser.close();
console.log('saved', out);
