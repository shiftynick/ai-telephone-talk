/* OpenCode + $0 builds.
   Beat 1 plays by itself: the free-model picker (the real list from `opencode models` on this laptop, 2026-09-26),
   a prompt, a few lines of work, and a cost meter whose token count climbs while the cost stays at $0.00.
   Space → beat 2 (two roads to $0) → Space → beat 3 (the meme) → Space → leave. */
(() => {
  const el = document.getElementById('opencode');
  if (!el) return;
  const $ = (s) => el.querySelector(s);
  const FREE = ['big-pickle', 'nemotron-3-ultra-free', 'nemotron-3.5-lightning-free', 'mimo-v2.6-flash-free', 'ling-3.0-flash-fin-free', 'muse-spark-1.3-contributor-free', 'space-bunny-free'];
  const PICK = 1; // nemotron-3-ultra-free
  const ASK = 'build a telephone game where every player is a model';
  const LOG = [
    ['✓', 'read 14 files'],
    ['✓', 'planned: photo → describe → draw → … → video'],
    ['✓', 'wrote server/runner.ts, shared/types.ts'],
    ['✓', 'tests: 172 passing'],
  ];
  let alive = false, beat = 1, tokenRaf = 0;

  function setBeat(n) {
    beat = n;
    el.dataset.beat = String(n);
  }

  function countTokens(to, ms) {
    const node = $('.oc-tokens'), from = Number(node.dataset.v || 0), t0 = performance.now();
    cancelAnimationFrame(tokenRaf);
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const v = Math.round(from + (to - from) * k);
      node.dataset.v = String(v);
      node.textContent = v.toLocaleString('en-US');
      if (k < 1 && alive) tokenRaf = requestAnimationFrame(tick);
    };
    tokenRaf = requestAnimationFrame(tick);
  }

  async function play() {
    const list = $('.oc-models');
    list.innerHTML = FREE.map((m) => `<li><span>${m}</span><b>free</b></li>`).join('');
    const items = [...list.children];
    await Deck.sleep(700);
    // the cursor walks down the free models and picks one
    for (let k = 0; k <= PICK + 3 && alive; k++) {
      const i = k <= PICK + 2 ? Math.min(k, FREE.length - 1) : PICK;
      items.forEach((li, j) => li.classList.toggle('sel', j === i));
      window.SFX?.blip(k);
      await Deck.sleep(k === PICK + 3 ? 500 : 260);
    }
    if (!alive) return;
    $('.oc-model').textContent = FREE[PICK];
    $('.oc-picker').classList.add('gone');
    await Deck.sleep(400);
    // the prompt types in
    const typed = $('.oc-typed');
    for (let k = 0; k < ASK.length && alive; k++) {
      typed.textContent = ASK.slice(0, k + 1);
      if (k % 2 === 0 && ASK[k] !== ' ') window.SFX?.tick();
      await Deck.sleep(42);
    }
    if (!alive) return;
    await Deck.sleep(400);
    // the agent works; tokens climb, the cost does not
    const log = $('.oc-log');
    let total = 0;
    for (const [mark, line] of LOG) {
      if (!alive) return;
      total += 18000 + Math.round(Math.random() * 40000);
      countTokens(total, 900);
      const li = document.createElement('li');
      li.innerHTML = `<b>${mark}</b> ${line}`;
      log.appendChild(li);
      window.SFX?.blip(3);
      await Deck.sleep(1100);
    }
    if (!alive) return;
    el.classList.add('stamped');
    window.SFX?.pop(2);
  }

  Deck.on('opencode', {
    enter() {
      alive = true;
      setBeat(1);
      el.classList.remove('stamped');
      $('.oc-picker').classList.remove('gone');
      $('.oc-typed').textContent = '';
      $('.oc-log').innerHTML = '';
      $('.oc-model').textContent = 'big-pickle';
      const t = $('.oc-tokens'); t.dataset.v = '0'; t.textContent = '0';
      play();
    },
    leave() { alive = false; cancelAnimationFrame(tokenRaf); },
    next() {
      if (beat < 3) {
        setBeat(beat + 1);
        if (beat === 3) window.SFX?.boom();
        return true;
      }
      return false;
    },
  });
})();
