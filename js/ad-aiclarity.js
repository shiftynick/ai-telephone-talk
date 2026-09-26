/* Ad #2 · The AI Clarity Network — Nick built it. The curriculum is live; the newsletter isn't launched yet.
   Beat 1 plays by itself: a firehose of (made-up) AI headlines speeds up and blurs, then the CEO asks the question.
   It moves on by itself (or Space) → beat 2: the site's own look; three headlines, each answered by a real
   curriculum concept (titles + summaries from aiclaritynetwork.com/curriculum, 2026-09-26).
   Space → beat 3: the six modules, the three reading depths, the QR (home page). Space → back to the world. */
(() => {
  const el = document.getElementById('ad-aiclarity');
  if (!el) return;
  const $ = (s) => el.querySelector(s);
  const HEADLINES = [
    ['BREAKING', 'New model tops leaderboard (again)'], ['HOT TAKE', 'This changes everything'],
    ['REPLY', 'Actually, it doesn’t'], ['JUST IN', '35 open-source clones in a week'],
    ['OPINION', 'Agents will replace your org chart'], ['THREAD 🧵 1/27', 'Prompt engineering is dead'],
    ['THREAD 🧵 2/27', 'Long live context engineering'], ['EXCLUSIVE', 'Frontier model drops at 11pm on a Friday'],
    ['VIRAL', 'Chatbot cites a court case that doesn’t exist'], ['MEMO', 'Board wants an “AI strategy” by Q4'],
    ['BREAKING', 'Benchmark saturated. New benchmark announced.'], ['JUST IN', 'Every SaaS is now an agent'],
    ['LEAKED', 'Reasoning mode costs 10× more'], ['PODCAST', 'Is your data AI-ready? (No.)'],
    ['HOT TAKE', 'The bubble pops by Friday'], ['BREAKING', 'Your competitor just went “AI-first”'],
  ];
  // headline → the concept on the site that answers it
  const MAP = [
    ['BREAKING', 'New model tops leaderboard (again)', 'How to read AI benchmarks', 'Benchmarks measure progress on a test, not value in your workflow.'],
    ['OPINION', 'Agents will replace your org chart', 'Agents and tool use in practice', 'Autonomy is a dial — permissions plus checkpoints decide what is safe.'],
    ['VIRAL', 'Chatbot cites a court case that doesn’t exist', 'Why AI makes things up', 'AI systems optimize for plausible output, not true output.'],
  ];
  const MODULES = ['Foundations', 'How models work', 'Capabilities and limits', 'Using AI in the enterprise', 'Risk and governance', 'Frontier'];
  const ASK = 'so… what does this mean for us?';
  let alive = false, beat = 1, run = 0;

  const ok = (r) => alive && r === run;
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const anims = () => [...el.querySelectorAll('.aic-col')].flatMap((c) => c.getAnimations());
  const speed = (x) => anims().forEach((a) => (a.playbackRate = x));

  function buildNoise() {
    const cols = $('.aic-cols');
    const card = ([tag, text], k) => `<div class="aic-hl${k % 5 === 0 ? ' hot' : ''}"><i>${esc(tag)}</i>${esc(text)}</div>`;
    cols.innerHTML = [0, 1, 2, 3].map((c) => {
      const mine = HEADLINES.filter((_, k) => k % 4 === c).concat(HEADLINES.filter((_, k) => (k + 2) % 4 === c));
      const html = mine.map((h, k) => card(h, k + c)).join('');
      return `<div class="aic-col" style="--t:${[34, 27, 40, 31][c]}s;margin-top:${[-80, -300, -160, -420][c]}px">${html}${html}</div>`;
    }).join('');
  }

  async function firehose(r) {
    el.classList.remove('fast', 'frozen', 'asked');
    $('.aic-said').textContent = '';
    buildNoise();
    Deck.after(500, () => ok(r) && window.SFX?.chatter(2));
    await Deck.sleep(2400);
    if (!ok(r)) return;
    speed(3); el.classList.add('fast'); window.SFX?.chatter(2.4);
    await Deck.sleep(2300);
    if (!ok(r)) return;
    speed(7); window.SFX?.chatter(1.6);
    await Deck.sleep(1500);
    if (!ok(r)) return;
    speed(0.12); el.classList.add('frozen');
    window.SFX?.drop(100, 30);
    await Deck.sleep(700);
    if (!ok(r)) return;
    el.classList.add('asked');
    window.SFX?.msgIn();
    const said = $('.aic-said');
    for (let k = 0; k < ASK.length && ok(r); k++) {
      said.textContent = ASK.slice(0, k + 1);
      if (k % 2 === 0 && ASK[k] !== ' ') window.SFX?.tick();
      await Deck.sleep(40);
    }
    await Deck.sleep(3200);
    if (ok(r) && beat === 1) setBeat(2);
  }

  async function answers(r, instant = false) {
    const box = $('.aic-map');
    box.innerHTML = MAP.map(([tag, hl, title, line]) =>
      `<div class="aic-row"><div class="hl"><i>${esc(tag)}</i>${esc(hl)}</div><div class="arr">→</div>` +
      `<div class="con"><em>1-min read</em><b>${esc(title)}</b><span>${esc(line)}</span></div></div>`).join('');
    const rows = [...box.children];
    if (instant) { rows.forEach((row) => row.classList.add('on', 'linked')); return; }
    window.SFX?.chime();
    await Deck.sleep(1300);
    for (const row of rows) {
      if (!ok(r)) return;
      row.classList.add('on'); window.SFX?.msgOut();
      await Deck.sleep(800);
      if (!ok(r)) return;
      row.classList.add('linked'); window.SFX?.pop(1);
      await Deck.sleep(700);
    }
  }

  async function curriculum(r) {
    const mods = $('.aic-mods');
    mods.innerHTML = MODULES.map((m) => `<li>${esc(m)}</li>`).join('');
    await Deck.sleep(700);
    for (const li of mods.children) {
      if (!ok(r)) return;
      li.classList.add('on'); window.SFX?.blip(2);
      await Deck.sleep(220);
    }
    if (ok(r)) Deck.after(500, () => ok(r) && window.SFX?.chime());
  }

  function setBeat(n, back = false) {
    beat = n;
    el.dataset.beat = String(n);
    const r = ++run;
    if (n === 1) firehose(r);
    else if (n === 2) answers(r, back);
    else curriculum(r);
  }

  Deck.on('ad-aiclarity', {
    enter() { alive = true; setBeat(1); },
    leave() { alive = false; run++; speed(1); },
    next() {
      if (beat < 3) { setBeat(beat + 1); return true; }
      return false;
    },
    prev() {
      if (beat === 3) { setBeat(2, true); return true; }
      if (beat === 2) { Deck.replay(); return true; }
      return false;
    },
  });
})();
