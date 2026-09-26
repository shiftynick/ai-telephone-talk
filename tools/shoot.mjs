import { chromium } from 'playwright';
const [,, hash, ...times] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', m => m.type() === 'error' && console.log('ERR', m.text()));
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(`file:///home/shifty/Work/ai-telephone/slides/index.html#${hash}`);
let last = 0;
for (const t of times) {
  if (t.startsWith('key:')) { await p.keyboard.press(t.slice(4)); continue; }
  await p.waitForTimeout(+t - last); last = +t;
  await p.screenshot({ path: `/tmp/peek/${hash}-${t}.png` });
}
await b.close();
