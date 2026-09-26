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
| title screen | 1st key brings the sound up (the overview sits behind the intro), 2nd key flies in |
| PageDown / N | smart next: open this stop, or walk to the next one (clicker-friendly) |
| → ↓ / ← ↑ | walk to the next / previous stop without opening it — how to skip a stop |
| PageUp / P | walk back to the previous stop |
| Space / Enter | open this stop |
| 1–9, 0 | walk to stop 1–9, 10 |
| O | whole-map overview |
| X | make the pig dance |
| M · [ ] | sound on/off · music quieter/louder |
| F · B | fullscreen · black screen |
| Esc (in a stop) | back to the world (→ past the last slide also returns). Mouse to the top-right corner shows a "back to the world" button |
| Shift+R | reset progress (progress otherwise survives a reload) |

URL flags: `?play=1` skips the title, `?fly` makes the first key fly in, `?at=<stop id>` starts at a stop,
`?fresh` ignores saved progress, `?dusk=1` forces the evening sky, `?ao=0` / `?q=low` for slower machines.

## The route (js/map.js)

1 Teaser (`cold-open`) · 2 AfterThat ad · 3 OpenCode · 4 T3 Code · 5 Jev (`jev`, `jev-axi`) · 6 Omarchy ·
7 AI Clarity ad · 8 The game — opens the live projector (`http://localhost:8787/present?embed=1`, open the world at
**localhost**, not 127.0.0.1, so the app's host cookie flows) · 9 Odenli ad · 10 Closing (`closing`, fireworks).

## Files

```
index.html, world.css   page, HUD, labels, slide overlay
js/main.js              renderer + post (AO, bloom, tilt-shift), camera, walking, input, slide overlay
js/map.js               the stops (talk order, slide ids, positions), junctions, roads
js/terrain.js           floating islands grown around stops/roads; bridges where roads cross the sky
js/props.js             trees, rocks, lamps, telephone line + signal pulse, bridges, gates, clouds, birds, waterfalls, confetti
js/landmarks.js         one voxel diorama per stop (phone booth, cottage, monitor, arcade, crate, tent, billboard, chain, stage, cinema, tower)
js/audio.js             synthesised music, ambience and sound effects (WebAudio, no files)
js/vox.js               voxel mesher (exposed faces + per-vertex AO) and noise helpers
mascot/mascot.js        the pig — dependency-free module, also used by the AI Telephone projector
mascot/preview.html     mascot turntable: ?clip=dance, ?grid=1
tools/shot.mjs          headless screenshots: node world/tools/shot.mjs "world/?play=1&at=jev" out.png 3000
```

## Changing stops

Edit `STOPS` in `js/map.js`: `slides` are deck slide ids (opened as
`../index.html?embed=1&only=a,b#a`), `url` opens a live page instead of slides, `ad: true` adds the AD BREAK sign, `isle` groups stops onto islands
(roads between islands become bridges), `at: [u, v]` is the screen-space position
(u = right, v = toward the viewer), `kind` picks the landmark in `js/landmarks.js`.

## Deck embed mode (in `../deck.js`)

`?embed=1&only=id,id#id` hides the HUD and keeps navigation inside the list. Esc, or "next" on the
last listed slide (when the slide doesn't consume it), posts `{ type: 'deck:exit', slide, reason }`
to the parent. `&hold=1` waits for `{ type: 'deck:start' }` so the world can preload invisibly.
Without `embed=1` the deck behaves exactly as before.
