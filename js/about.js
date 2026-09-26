/* Who am I: token–life balance meters. Tokens win. */
(() => {
  const el = document.getElementById('about');
  const $ = (s) => el.querySelector(s);
  const STATUS = ['4 agents running in other tabs', 'reviewing a 2,000-line diff at 1am',
    'rate limited (again)', 'touched grass, briefly', 'asking claude to make my slides'];

  function count(node, to, ms) {
    const t0 = performance.now(), from = parseFloat(node.textContent) || 0;
    const tick = (now) => { const k = Math.min(1, (now - t0) / ms);
      node.textContent = `${Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))}%`; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  function set(tok, life) {
    $('.ab-tok').style.width = `${tok}%`; $('.ab-life').style.width = `${life}%`;
    count($('.ab-tok-n'), tok, 2400); count($('.ab-life-n'), life, 2400);
  }
  async function typeStatus(t) {
    const n = $('.ab-status-t');
    for (let k = 0; k <= t.length; k++) { n.textContent = t.slice(0, k); await Deck.sleep(28); }
  }

  Deck.on('about', {
    async enter() {
      $('.ab-tok').style.width = '0%'; $('.ab-life').style.width = '0%';
      $('.ab-tok-n').textContent = '0%'; $('.ab-life-n').textContent = '0%'; $('.ab-status-t').textContent = '';
      await Deck.sleep(900);  set(50, 50);       // the plan
      await Deck.sleep(2000); set(97, 3);        // the reality
      for (let k = 0; ; k = (k + 1) % STATUS.length) {
        await typeStatus(STATUS[k]); await Deck.sleep(2600);
      }
    },
  });
})();
