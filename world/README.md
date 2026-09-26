# The world — AI Telephone talk opener

A 3D voxel "world map" of floating islands. The mascot walks between stops; each
stop opens slides from the deck (`../index.html`) in a full-screen iframe.

## Run it

ES modules don't load from `file://`, so serve the `slides/` folder:

```sh
cd slides && python3 -m http.server 8931
# → http://localhost:8931/world/
```

Everything is local (three.js is vendored in `vendor/three/`), so venue Wi-Fi doesn't matter.
Press **F** for fullscreen and **H** for the key list.

## Keys

| key | does |
|---|---|
| any key | fly in from the title |
| ← → ↑ ↓ / WASD | walk the roads (hold to keep going) |
| Space / Enter | open this stop's slides |
| PageDown / N | smart next: open this stop, or walk to the next one (clicker-friendly) |
| PageUp / P | walk back to the previous stop |
| 1–9, 0, - | walk to stop 1–9, 10, 11 |
| T | technical detour on/off (the barrier drops; T3 Code, OpenCode and jev-axi are skipped) |
| O | whole-map overview |
| X | make the pig dance |
| F · B | fullscreen · black screen |
| Esc (in slides) | back to the world (→ past the last slide also returns) |
| Shift+R | reset progress (progress otherwise survives a reload) |

URL flags: `?play=1` skips the title, `?at=<stop id>` starts at a stop,
`?express` starts with the tech detour closed, `?fresh` ignores saved progress,
`?dusk=1` forces the evening sky, `?ao=0` / `?q=low` for slower machines.

## Files

```
index.html, world.css   page, HUD, labels, slide overlay
js/main.js              renderer + post (AO, bloom, tilt-shift), camera, walking, input, slide overlay
js/map.js               the stops (talk order, slide ids, positions), junctions, roads
js/terrain.js           floating islands grown around stops/roads; bridges where roads cross the sky
js/props.js             trees, rocks, lamps, telephone line + signal pulse, bridges, gates, clouds, birds, waterfalls, confetti
js/landmarks.js         one voxel diorama per stop (phone booth, cottage, monitor, arcade, crate, tent, billboard, chain, stage, cinema, tower)
js/vox.js               voxel mesher (exposed faces + per-vertex AO) and noise helpers
mascot/mascot.js        the pig — dependency-free module, also used by the AI Telephone projector
mascot/preview.html     mascot turntable: ?clip=dance, ?grid=1
tools/shot.mjs          headless screenshots: node world/tools/shot.mjs "world/?play=1&at=jev" out.png 3000
```

## Changing stops

Edit `STOPS` in `js/map.js`: `slides` are deck slide ids (opened as
`../index.html?embed=1&only=a,b#a`), `techSlides` replaces them when the tech route is on,
`tech: true` puts a stop on the optional detour, `at: [u, v]` is the screen-space position
(u = right, v = toward the viewer), `kind` picks the landmark in `js/landmarks.js`.

## Deck embed mode (in `../deck.js`)

`?embed=1&only=id,id#id` hides the HUD and keeps navigation inside the list. Esc, or "next" on the
last listed slide (when the slide doesn't consume it), posts `{ type: 'deck:exit', slide, reason }`
to the parent. `&hold=1` waits for `{ type: 'deck:start' }` so the world can preload invisibly.
Without `embed=1` the deck behaves exactly as before.
