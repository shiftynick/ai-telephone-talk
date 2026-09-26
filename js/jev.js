/* Jev.
   Beat 1 plays by itself: the "My name is Jeff" clip → the "My name is Jev" meme slams in → the title.
   Space → beat 2 ("what is Jev?" images). Space → beat 3 (a chatty LLM vs Jev's probabilities; an example).
   Space → beat 4 (the explainer video; Space during it skips to its end). Space → the next slide. */
(() => {
  const el = document.getElementById('jev');
  if (!el) return;
  const $ = (s) => el.querySelector(s);
  const jeff = $('.jv-jeff'), explainer = $('.jv-explainer');
  const CHATTY = 'Great question! Based on the content of the message, it seems the customer may be asking about an invoice, which usually points to a billing issue. However, it could also be an account support request, depending on the context. To be thorough, let’s consider a few possibilities before we decide on the best queue for this message…';
  const ANSWER = [['billing', 0.94], ['support', 0.05], ['sales', 0.01]];
  let alive = false, beat = 1, timers = [];

  const later = (ms, fn) => timers.push(Deck.after(ms, fn));
  const muted = () => !!window.SFX?.muted;
  function stopVideos() { for (const v of [jeff, explainer]) { v.pause(); v.currentTime = 0; } }

  function setBeat(n) {
    beat = n;
    el.dataset.beat = String(n);
  }

  function gag() {
    const slam = () => {
      if (!alive || beat !== 1 || el.classList.contains('slammed')) return;
      el.classList.add('slammed');
      window.SFX?.boom();
      later(1300, () => alive && el.classList.add('titled'));
    };
    jeff.muted = muted();
    jeff.currentTime = 0;
    jeff.onended = slam;
    jeff.play().catch(() => later(600, slam)); // no playable video: go straight to the punchline
    later(6500, slam); // never wait longer than the clip
  }

  function memes() {
    el.classList.remove('fg');
    window.SFX?.msgOut();
    later(1100, () => { if (alive && beat === 2) { el.classList.add('fg'); window.SFX?.pop(1); } });
  }

  async function compare() {
    const text = $('.jv-llm-text'), bars = $('.jv-bars'), llmT = $('.jv-llm-t'), jevT = $('.jv-jev-t');
    text.textContent = ''; bars.innerHTML = ''; jevT.textContent = ''; llmT.textContent = '0.0s';
    const t0 = performance.now();
    const clock = setInterval(() => { if (!alive || beat !== 3) return clearInterval(clock); llmT.textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`; }, 100);
    // Jev answers almost at once, as typed probabilities
    later(420, () => {
      if (!alive || beat !== 3) return;
      jevT.textContent = '0.4s';
      bars.innerHTML = ANSWER.map(([k, p], i) => `<div class="jv-row${i === 0 ? ' top' : ''}"><span>${k}</span><i><u></u></i><b>${p.toFixed(2)}</b></div>`).join('');
      requestAnimationFrame(() => [...bars.querySelectorAll('u')].forEach((u, i) => (u.style.width = `${ANSWER[i][1] * 100}%`)));
      window.SFX?.chime();
    });
    // …while the chatty model is still writing its paragraph
    for (let k = 0; k < CHATTY.length && alive && beat === 3; k++) {
      text.textContent = CHATTY.slice(0, k + 1);
      await Deck.sleep(45);
    }
  }

  function explain() {
    explainer.muted = muted();
    explainer.currentTime = 0;
    explainer.play().catch(() => {});
  }

  Deck.on('jev', {
    enter() {
      alive = true;
      el.classList.remove('slammed', 'titled', 'fg');
      setBeat(1);
      gag();
    },
    leave() { alive = false; stopVideos(); },
    next() {
      if (beat === 1) { jeff.pause(); if (!el.classList.contains('titled')) { el.classList.add('slammed', 'titled'); } setBeat(2); memes(); return true; }
      if (beat === 2) { setBeat(3); compare(); return true; }
      if (beat === 3) { setBeat(4); explain(); return true; }
      // beat 4: first press skips the explainer to its end, the next one moves on
      if (!explainer.paused && !explainer.ended) { explainer.pause(); explainer.currentTime = Math.max(0, (explainer.duration || 1) - 0.05); return true; }
      return false;
    },
    prev() {
      if (beat === 4) { explainer.pause(); setBeat(3); compare(); return true; }
      if (beat === 3) { setBeat(2); el.classList.add('fg'); return true; }
      if (beat === 2) { setBeat(1); el.classList.add('slammed', 'titled'); return true; }
      return false;
    },
  });
})();
