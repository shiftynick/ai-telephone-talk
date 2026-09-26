/* Ad #1 · AfterThat — "the ghosting story".
   Scene A plays by itself: tonight's meetup group chat, then "3 weeks later…", "6 months later…", a tumbleweed.
   Space jumps to scene B (the AfterThat reveal, where the same chat actually leads to coffee); Space again moves on. */
(() => {
  const el = document.getElementById('ad-afterthat');
  if (!el) return;
  const $ = (s) => el.querySelector(s);
  const ghost = $('.aft-ghost .aft-msgs'), skip = $('.aft-skip'), after = $('.aft-msgs-b');

  const COLORS = { P: '#d9534f', M: '#8e6cef', D: '#2a9d8f', S: '#e9a23b', me: '#3b82f6' };
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let alive = false, revealed = false;

  function bubble(box, { who, name, time, text, me }) {
    const m = document.createElement('div');
    m.className = 'aft-m' + (me ? ' me' : '');
    m.innerHTML = `<div class="aft-av" style="background:${COLORS[who] || '#555'}">${me ? 'me' : who}</div>` +
      `<div><span class="aft-meta">${esc(name)} · ${time}</span><div class="aft-b">${esc(text)}</div></div>`;
    box.appendChild(m);
    return m;
  }
  function typing(box, who, me) {
    const m = document.createElement('div');
    m.className = 'aft-m' + (me ? ' me' : '');
    m.innerHTML = `<div class="aft-av" style="background:${COLORS[who] || '#555'}">${me ? 'me' : who}</div><div class="aft-typing"><i></i><i></i><i></i></div>`;
    box.appendChild(m);
    return m;
  }
  function taps(ms) { for (let at = 60; at < ms - 60; at += 110 + Math.random() * 90) Deck.after(at, () => window.SFX?.tap()); }
  async function say(box, msg, typingMs = 700, soft = false) {
    const t = typing(box, msg.who, msg.me);
    if (!msg.me) taps(typingMs);
    await Deck.sleep(typingMs);
    if (!alive) return;
    t.remove();
    bubble(box, msg);
    if (msg.me) window.SFX?.msgOut(); else window.SFX?.msgIn(soft);
    await Deck.sleep(650);
  }

  const TONIGHT = [
    { who: 'P', name: 'Priya', time: '9:14 PM', text: 'so good meeting everyone tonight!!' },
    { who: 'M', name: 'Marcus', time: '9:15 PM', text: 'that telephone demo was unhinged 😂' },
    { who: 'D', name: 'Dee', time: '9:17 PM', text: 'we should grab coffee and talk agents' },
    { me: true, who: 'me', name: 'you', time: '9:17 PM', text: 'YES. next week?' },
    { who: 'S', name: 'Sam', time: '9:18 PM', text: '100%. let’s make it happen 🙌' },
  ];
  const AFTER = [
    { who: 'P', name: 'Priya', time: '9:14 PM', text: 'so good meeting everyone tonight!!' },
    { who: 'D', name: 'Dee', time: 'Tue 8:02 AM', text: 'coffee Thursday at the usual spot?' },
    { who: 'M', name: 'Marcus', time: 'Tue 8:10 AM', text: 'count me in ☕' },
    { me: true, who: 'me', name: 'you', time: 'Tue 8:11 AM', text: 'see you there!' },
    { who: 'S', name: 'Sam', time: 'Thu 9:40 AM', text: 'same time next month? 🙌' },
  ];

  async function timeSkip(text) {
    skip.textContent = text;
    window.SFX?.timeSkip();
    skip.classList.add('on');
    await Deck.sleep(1400);
    skip.classList.remove('on');
    await Deck.sleep(350);
  }

  async function playGhost() {
    await Deck.sleep(500);
    for (const m of TONIGHT) { if (!alive || revealed) return; await say(ghost, m, 650); }
    await Deck.sleep(900);
    if (!alive || revealed) return;
    await timeSkip('3 weeks later…');
    if (!alive || revealed) return;
    bubble(ghost, { me: true, who: 'me', name: 'you', time: 'Wed 11:52 PM', text: 'hey, is anyone still up for that coffee?' });
    window.SFX?.msgOut();
    Deck.after(700, () => window.SFX?.delivered());
    const st = document.createElement('div');
    st.className = 'aft-state';
    st.textContent = 'Delivered';
    ghost.appendChild(st);
    await Deck.sleep(1100);
    const t = typing(ghost, 'D'); // someone starts typing… and stops (the taps just stop too)
    taps(1500);
    await Deck.sleep(1600);
    t.remove();
    await Deck.sleep(700);
    if (!alive || revealed) return;
    await timeSkip('6 months later…');
    if (!alive || revealed) return;
    el.classList.add('aged');
    window.SFX?.ghostTown(5.5);
    await Deck.sleep(6500);
    if (alive && !revealed) reveal();
  }

  async function reveal() {
    if (revealed) return;
    revealed = true;
    el.classList.add('revealed');
    window.SFX?.chime();
    after.innerHTML = '';
    await Deck.sleep(700);
    for (const m of AFTER) { if (!alive) return; await say(after, m, 450, true); }
  }

  Deck.on('ad-afterthat', {
    enter() {
      alive = true; revealed = false;
      el.classList.remove('aged', 'revealed');
      ghost.innerHTML = ''; after.innerHTML = '';
      skip.classList.remove('on');
      playGhost();
    },
    leave() { alive = false; },
    next() {
      if (!revealed) { reveal(); return true; }
      return false;
    },
    prev() {
      if (!revealed) return false;
      Deck.replay();
      return true;
    },
  });
})();
