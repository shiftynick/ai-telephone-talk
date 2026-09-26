// Regenerates the QR pngs the closing slide links to.
//   node make-qr.mjs
// Uses the repo's `qrcode` package. Add/remove links here, then re-run.
import QRCode from 'qrcode';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'assets', 'qr');
const links = [
  { file: 'ai-clarity', url: 'https://aiclaritynetwork.com', label: 'AI Clarity' },
  { file: 'afterthat', url: 'https://afterthat.chat', label: 'AfterThat' },
  // AfterThat ad: TONIGHT's meetup chat. Swap in the real invite link from Nick, then re-run.
  { file: 'afterthat-tonight', url: 'https://afterthat.chat', label: 'AfterThat · tonight', dark: '#183d32' },
  { file: 'repo', url: 'https://github.com/shiftynick/ai-telephone', label: 'ai-telephone' },
  // { file: 'omarchy', url: 'https://omarchy.org', label: 'Omarchy' },
  // { file: 't3code', url: 'https://t3.chat', label: 'T3 Code' },
  // { file: 'jev', url: 'https://placeholder.invalid', label: 'Jev' },
];

for (const l of links) {
  await QRCode.toFile(path.join(outDir, `${l.file}.png`), l.url, {
    width: 512,
    margin: 2,
    color: { dark: l.dark ?? '#0b0b0d', light: '#ffffff' },
  });
  console.log(`generated ${l.file}.png -> ${l.url}`);
}
console.log(`\n${links.length} QR codes written to ${outDir}`);