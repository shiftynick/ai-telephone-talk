/* T3 Code — product first.
   Beat 1 plays by itself: the agents T3 Code drives (from its README) fly in and wire into the hub.
   Space → beat 2: Nick's desktop screenshot with three callouts.
   Space → beat 3: a phone mock-up (notification → the thread opens) + the end card. Space → leave. */
(() => {
  const el = document.getElementById('t3code');
  if (!el) return;
  const $ = (s) => el.querySelector(s);
  // names as text (no company logos); positions in stage px around the hub at (960, 600)
  const AGENTS = [
    { name: 'Claude Code', x: 430, y: 470, fx: -500, fy: -200 },
    { name: 'Codex', x: 380, y: 640, fx: -600, fy: 0 },
    { name: 'Cursor', x: 560, y: 800, fx: -400, fy: 300 },
    { name: 'Grok Build', x: 1360, y: 800, fx: 400, fy: 300 },
    { name: 'OpenCode', x: 1540, y: 640, fx: 600, fy: 0 },
    { name: 'Antigravity', x: 1490, y: 470, fx: 500, fy: -200 },
  ];
  const HUB = { x: 960, y: 600 };
  let alive = false, beat = 1;

  function setBeat(n) {
    beat = n;
    el.dataset.beat = String(n);
    if (n === 3) phone();
  }

  function wire(a) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const mx = (a.x + HUB.x) / 2;
    p.setAttribute('d', `M${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${HUB.y}, ${HUB.x} ${HUB.y}`);
    $('.t3-wires').appendChild(p);
  }

  async function play() {
    const box = $('.t3-pills');
    box.innerHTML = AGENTS.map((a) => `<div class="t3-pill from" style="--x:${a.x}px;--y:${a.y}px;--fx:${a.fx}px;--fy:${a.fy}px">${a.name}</div>`).join('');
    $('.t3-wires').innerHTML = '';
    const pills = [...box.children];
    await Deck.sleep(900);
    for (let k = 0; k < pills.length && alive; k++) {
      pills[k].classList.remove('from');
      pills[k].classList.add('on');
      window.SFX?.msgOut(); // a soft whoosh as each one snaps in
      await Deck.sleep(260);
      wire(AGENTS[k]);
      pills[k].classList.add('lit');
      await Deck.sleep(140);
    }
    if (alive) window.SFX?.chime();
  }

  async function phone() {
    el.classList.remove('notif', 'opened');
    await Deck.sleep(900);
    if (!alive || beat !== 3) return;
    el.classList.add('notif');
    window.SFX?.msgIn(); // the notification ping
    await Deck.sleep(1700);
    if (!alive || beat !== 3) return;
    el.classList.add('opened'); // tap the notification: the thread opens
    window.SFX?.tap();
  }

  Deck.on('t3code', {
    enter() {
      alive = true;
      el.classList.remove('notif', 'opened');
      setBeat(1);
      play();
    },
    leave() { alive = false; },
    next() {
      if (beat < 3) {
        setBeat(beat + 1);
        if (beat === 2) for (let k = 0; k < 3; k++) Deck.after(500 + k * 500 + 200, () => window.SFX?.tap()); // a click per callout
        return true;
      }
      return false;
    },
  });
})();
