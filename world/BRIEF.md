# The isometric world — brief for the world agent

Written 2026-09-26 by the AI Telephone agent (the Claude Code session working in `/home/shifty/Work/ai-telephone`)
for the agent building the world. Nick ("shifty") gives the talk **tonight**, at the Dirty South AI meetup;
we have roughly 5–7 hours and he will steer on time. Build the best version you can, in a way that is
always demo-able: get something walkable early, then polish.

## What we are building

The talk no longer starts as a slide deck. It opens as a **3D isometric "box world"**: a small diorama
island/board with a **character based on the meetup mascot** that Nick walks around with the keyboard.
Think of a game's world-map screen — paths between little locations — but an **original design** made for
this talk (the game reference is about the *navigation idea*, not its art: don't copy any existing game's
look or assets). Each location stands for one of the old slides. Walking up to a location and pressing
**Space/Enter** opens that slide (the existing HTML slides, full screen); **Esc** (or finishing the
location's slides) returns to the world where he left off.

At the start Nick asks the audience how technical they are, and may **skip the technical stops**. So those
stops sit on **optional side paths** the main route can walk past.

Make it look **super cool and impressive** on a big TV: lighting, soft shadows, a camera that glides and
follows, little idle animations in the world, satisfying transitions into and out of slides.

## The mascot

- The meetup logo is `slides/assets/dirtysouthailogo.png` (a cartoon pig in a sailor hat, with piercings).
- Nick has **pixel and box/voxel character studies** of it; he'll give them to you (ask him if they are not
  in `slides/assets/mascot/` yet). Base the character on those studies: a chunky box/voxel style that suits
  the isometric world.
- It needs animations: **idle, walk, dance, think, cheer** (at minimum idle + walk + dance).
- It is reused outside the world (see the mascot module contract below), so build it as its own module.

## Stops (in talk order) → slide ids in `slides/index.html`

| # | Stop | Slide ids opened | Path |
|---|------|------------------|------|
| 1 | Start / cold open | `cold-open` (the replayed telephone chain + title; press Space to start it) | main — **first stop** |
| 2 | Who am I | `about` | main |
| 3 | Omarchy | `omarchy` | main |
| 4 | T3 Code | `t3code` | **optional side path** |
| 5 | OpenCode + $0 builds | `opencode` | **optional side path** |
| 6 | Jev | `jev` (then optionally `jev-axi`) | main; **`jev-axi` is optional** |
| 7 | Ad: AI Clarity | `ad-aiclarity` | main |
| 8 | The game | `game-rules` | main |
| 9 | Live demo | `live` (Nick then switches to the AI Telephone app) | main |
| 10 | Ads: AfterThat, Odenli | `ad-afterthat`, `ad-odenli` | main |
| 11 | Reveal + links | `reveal`, `links` | main — finale |

Most slides are still placeholder cards; Nick and I will fill them in. The ids are stable. The cold open is
being re-recorded with a new run (meetup photo + logo as the source); I'll swap its assets, same slide id.

## Integration with the slides (you own this)

- Put the world in **`slides/world/`** (entry `slides/world/index.html`). The folder is gitignored with the
  rest of `slides/`.
- Open a stop's slides in a **full-screen iframe overlay**: `../index.html?embed=1&only=<id,id>#<first-id>`.
- Add a small **embed mode to `slides/deck.js`**: with `embed=1`, hide the HUD, keep navigation inside the
  `only` list, and when Nick presses Esc, or → past the last listed slide, `postMessage({ type: 'deck:exit', slide })`
  to the parent. Keep the deck working exactly as before without `embed=1`.
- Existing deck behaviour to keep in mind: the stage is 1920×1080 scaled to fit; slides may consume "next"
  presses themselves (the cold open does: first Space starts it, the second skips to the title), so only
  treat → as "exit" when the deck is on the last listed slide *and* the slide didn't consume the press.
- **Offline**: the venue Wi-Fi is not to be trusted. No CDNs: vendor three.js locally (copy from
  `/home/shifty/Work/ai-telephone/node_modules/three/build/` and `examples/jsm/` as needed). ES modules
  don't load from `file://`, so the world is served over HTTP: `cd slides && python3 -m http.server 8931`
  → `http://localhost:8931/world/`.
- Target: Chrome, 1920×1080 on a TV, 60 fps on this laptop (RTX 5070 Ti; keep it smooth anyway).

## Mascot module contract (I will reuse it in the AI Telephone projector)

While a step is generating, the projector will show the mascot dancing. So please expose it as a
dependency-free ES module:

```js
// slides/world/mascot/mascot.js
export function createMascot(THREE, opts = {}) {
  // THREE is passed in (the projector has its own copy); import nothing else, load no files
  // (procedural boxes, or data inlined in the module).
  return {
    root,               // THREE.Object3D to add to a scene, ~1 unit tall, standing on y = 0, facing +z
    names,              // e.g. ['idle', 'walk', 'dance', 'think', 'cheer']
    play(name, { loop = true } = {}),
    update(dt),         // advance animations by dt seconds
    dispose(),
  };
}
```

Please get a **placeholder v1** of this API out early (even crude boxes) and message me, so I can wire it
into the projector while you refine the look. I'll copy it into the app (`web/src/mascot/`) and keep it in
sync when you tell me it changed.

## Ownership (to avoid stepping on each other)

- **You:** `slides/world/**`, the embed mode in `slides/deck.js`, the mascot module.
- **Me:** the AI Telephone app (`server/`, `web/`, `shared/`, tests), the projector's waiting experience,
  `slides/js/cold-open.js` + its run assets, and slide *content* in `slides/index.html` if Nick asks.
  If you need a change in `slides/index.html` / `slides.css`, message me first (or keep it additive).

## Checking in

Message me (SendMessage; find me with ListAgents, the session in `/home/shifty/Work/ai-telephone`) when:
1. the world skeleton walks with a placeholder mascot (send a screenshot path),
2. the mascot module v1 API is ready,
3. every stop opens its slides and returns.

Ask Nick directly for anything that is his call (layout of the world, what each stop looks like,
the mascot studies). Keep him posted with screenshots; he'll steer on time.
