# AI Telephone — the talk

The deck from Nick "shifty" Underwood's talk at the Dirty South AI meetup (2026-09-26): a hand-built HTML
slide deck, opened from a walkable 3D voxel world, around the live **AI Telephone** game
([shiftynick/ai-telephone](https://github.com/shiftynick/ai-telephone)).

**Just want the slides?** Read the PDF:
[ai-telephone-talk.pdf](https://github.com/shiftynick/ai-telephone/blob/main/docs/talk/ai-telephone-talk.pdf).

## Run it

The world loads ES modules, so serve the folder over http:

```sh
python3 -m http.server 8931
# the talk as presented (walk between the stops):  http://localhost:8931/world/index.html
# just the deck:                                   http://localhost:8931/index.html
```

- World: arrow keys / WASD to walk (or 1–9, 0 to jump to a stop), Space or Enter opens it, Esc back to the world,
  O overview, M mutes, F fullscreen.
- Deck: `Space` / `→` next beat, `←` back one beat, `R` replays the slide, `O` overview, `F` fullscreen.
- Stop 8 embeds the live game's projector (`http://localhost:8787/present`), so it needs the AI Telephone app
  running and a host login; everything else is self-contained.

**Not included:** three third-party video clips (`assets/videos/My name is Jeff.mp4`, `jev-explained.mp4`,
`jev-doom-clip.mp4`). Those beats still run; they just have no video. Drop your own files in with those names.

## What's here

```
index.html        every slide (sections), in talk order
deck.js           the slide engine (beats, ← steps back a beat, embed mode for the world)
deck.css          shared look; slides.css per-slide styles
js/               one script per slide (animations, sound cues), js/sfx.js synthesized sound effects
assets/           images, QR codes, fonts (all OFL), the recorded telephone runs used by the cold open
world/            the voxel world (three.js, vendored) and the meetup mascot
tools/            screenshot/export helpers: shoot.mjs, export-pdf.mjs, refresh-gh.mjs, bundle-run.mjs
make-qr.mjs       regenerates assets/qr/*.png
```

## Tools

- `node tools/export-pdf.mjs` — the talk as a PDF, one page per beat (needs the folder served on :8931).
- `node tools/refresh-gh.mjs` — refreshes the jev-axi slide's GitHub card numbers (needs the `gh` CLI).
- `node tools/bundle-run.mjs run4` — bundles a recorded run into `js/run-data.js` for the cold open.
- `node make-qr.mjs` — regenerates the QR codes.

Memes, the "My name is Jev" images, and product screenshots belong to their owners and are shown as they
were in the talk.
