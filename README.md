# Talk slides — AI Telephone

This folder is **gitignored on purpose**: it's the meetup deck, not part of the
shared repo (the repo, minus these slides, is the open-source part).

## Run it
Open `index.html` in any browser (works from `file://`, no server needed).

- `←` `→` `Space` `PgUp/PgDn` — move
- `Home` / `End` — first / last
- `F` — fullscreen
- `O` — overview grid
- `R` — replay current slide (re-nudge gifs/videos)
- click advances

## Structure
```
slides/
  index.html      the deck (all slide markup)
  deck.css        styles
  deck.js         navigation
  make-qr.mjs     regenerator for the closing-page QR codes
  assets/
    qr/*.png      generated QR codes (repo, aiclaritynetwork.com, afterthat.chat…)
    memes/        drop funny gifs/images here
    videos/       drop mp4s here
    (optional compiled hyperframes composition folders)
```
Every slide is `<section class="slide" data-title="…" data-tone="…">`.
`data-tone` picks a background wash: `green | violet | pink | blue`.

## Hyperframes
HeyGen's web player component (`@hyperframes/player`) can play a local
composition. Uncomment this in `index.html` `<head>`:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@hyperframes/player"></script>
```

then on a slide:

```html
<hyperframes-player class="frames" src="assets/comp-x/index.html" controls autoplay muted></hyperframes-player>
```

(Compositions are built with the Hyperframes pipeline — `npx hyperframes …` —
and can also render to `mp4`, which just becomes a normal `<video>`.)

## QR codes
Edit the `links` array in `make-qr.mjs`, then `node make-qr.mjs`. PNGs land in
`assets/qr/`. Reference them on the closing slide by file name.