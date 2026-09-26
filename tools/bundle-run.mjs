// Inlines a replayed run into js/run-data.js so WebGL can read it even from file:// (plain <img>
// sources are "tainted" there). Media → data: URLs in window.RUN_DATA; texts/code in window.RUN_STORY.
//   node tools/bundle-run.mjs [run3]     (reads assets/<run>/ + assets/<run>/story.json)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
const RUN = process.argv[2] ?? 'run3';
const dir = new URL(`../assets/${RUN}/`, import.meta.url);
const mime = { jpg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', mp3: 'audio/mpeg' };
const media = {};
for (const f of readdirSync(dir)) {
  const ext = f.split('.').pop();
  if (mime[ext]) media[`assets/${RUN}/${f}`] = `data:${mime[ext]};base64,${readFileSync(new URL(f, dir)).toString('base64')}`;
}
const story = existsSync(new URL('story.json', dir)) ? JSON.parse(readFileSync(new URL('story.json', dir), 'utf8')) : {};
writeFileSync(new URL('../js/run-data.js', import.meta.url), `window.RUN_DATA = ${JSON.stringify(media)};\nwindow.RUN_STORY = ${JSON.stringify(story)};\n`);
console.log(Object.keys(media), Object.keys(story));
