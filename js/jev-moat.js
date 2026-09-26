/* Does Jev have a moat? Facts as researched 2026-09-26: madewithjev.com/open-source-jev (35 listed, Sep 22),
   github.com/ikermoel/open-alternative-jev (73.7% vs 72.7%, "within noise"), pinggy.io's open-source Jev
   alternatives post (jabr/classifier-benchmark: Jev 0.966 vs von 0.704; NanoJev 128/128 vs 56/128), Laya's
   86.5 vs 3.2 decisions/sec via madewithjev.com.
   Beat 1 plays by itself: Jev launches Sep 15 → within a week the open clones pop in, the count climbs to 35.
   Space → beat 2: three clones' own claims to beat it, each with its caveat.
   Space → beat 3: the independent 49-task benchmark, then the moat thins and the drawbridge drops.
   Space → jev-axi. */
(() => {
  const el = document.getElementById('jev-moat');
  if (!el) return;
  const $ = (s) => el.querySelector(s);
  const CLONES = [
    ['Simple Jev', 'Featherless AI · Apache-2.0'],
    ['OpenJev', 'self-hosted decision server'],
    ['Laya', '421M params · Apache-2.0'],
    ['kev', 'Qwen3.5 LoRAs · speaks Jev’s API'],
    ['NanoJev', '0.6B · for control loops'],
    ['open-alternative-jev', 'any open LLM, zero-shot'],
    ['von', 'runs locally · <15 ms'],
  ];
  const LISTED = 35;
  // [project, what, them, jev, bar fractions [them, jev], caveat]
  const CLAIMS = [
    ['open-alternative-jev', 'accuracy · 2,000 typed decisions', '73.7%', '72.7%', [0.737, 0.727], 'their README: “within noise”'],
    ['Laya', 'decisions per second', '86.5', '3.2', [1, 0.037], 'speed, not accuracy'],
    ['NanoJev', 'ViZDoom Basic · wins', '128/128', '56/128', [1, 0.4375], 'one video game'],
  ];
  let alive = false, beat = 1, run = 0;

  const ok = (r) => alive && r === run;

  async function clones(r, instant = false) {
    const box = $('.jm-clones'), n = $('.jm-count b');
    box.innerHTML = CLONES.map(([name, what]) => `<div class="jm-clone${name.length > 14 ? ' wide' : ''}"><b>${name}</b><span>${what.replace(/</g, '&lt;')}</span></div>`).join('');
    const cards = [...box.children];
    if (instant) { el.classList.add('week'); cards.forEach((c) => c.classList.add('on')); n.textContent = String(LISTED); return; }
    el.classList.remove('week');
    n.textContent = '0';
    await Deck.sleep(1400);
    if (!ok(r)) return;
    el.classList.add('week');
    window.SFX?.timeSkip();
    await Deck.sleep(700);
    let shown = 0;
    for (let k = 0; k < cards.length && ok(r); k++) {
      cards[k].classList.add('on');
      window.SFX?.pop(k);
      // the counter runs ahead of the cards: there are far more clones than fit on a slide
      const to = Math.round(((k + 1) / cards.length) * LISTED);
      for (; shown < to && ok(r); shown++) { n.textContent = String(shown + 1); await Deck.sleep(28); }
      await Deck.sleep(160);
    }
    if (ok(r)) window.SFX?.chime();
  }

  async function claims(r) {
    const box = $('.jm-claims');
    box.innerHTML = CLAIMS.map(([name, what, them, jev, , but]) =>
      `<div class="jm-claim"><h3>${name}</h3><p class="what mono">${what}</p>` +
      `<div class="jm-vs"><div class="them"><span>them</span><b>${them}</b><i><u></u></i></div>` +
      `<div class="jev"><span>Jev</span><b>${jev}</b><i><u></u></i></div></div>` +
      `<p class="but">${but}</p></div>`).join('');
    const cards = [...box.children];
    for (let k = 0; k < cards.length && ok(r); k++) {
      await Deck.sleep(k ? 700 : 400);
      if (!ok(r)) return;
      const [a, b] = CLAIMS[k][4];
      const us = cards[k].querySelectorAll('u');
      us[0].style.width = `${a * 100}%`; us[1].style.width = `${b * 100}%`;
      window.SFX?.blip(k + 1);
    }
    await Deck.sleep(1300);
    for (let k = 0; k < cards.length && ok(r); k++) {
      cards[k].classList.add('caveat');
      window.SFX?.tap();
      await Deck.sleep(450);
    }
  }

  async function verdict(r) {
    el.classList.remove('thin', 'down');
    window.SFX?.chatter(1.2);
    await Deck.sleep(2600);
    if (!ok(r)) return;
    el.classList.add('thin');
    window.SFX?.drop(100, 40); // the moat shrinks
    await Deck.sleep(1700);
    if (!ok(r)) return;
    el.classList.add('down');
    window.SFX?.boom();
  }

  function setBeat(n, back = false) {
    beat = n;
    el.dataset.beat = String(n);
    const r = ++run;
    if (n === 1) clones(r, back);
    else if (n === 2) claims(r);
    else verdict(r);
  }

  Deck.on('jev-moat', {
    enter() { alive = true; el.classList.remove('week', 'thin', 'down'); setBeat(1); },
    leave() { alive = false; run++; },
    next() {
      if (beat < 3) { setBeat(beat + 1); return true; }
      return false;
    },
    prev() {
      if (beat > 1) { setBeat(beat - 1, true); return true; }
      return false;
    },
  });
})();
