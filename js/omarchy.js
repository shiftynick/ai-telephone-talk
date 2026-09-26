/* Omarchy — Nick's daily driver.
   Beat 1 plays by itself: the "get in loser" meme slams in, then the OMARCHY logo lands beside it.
   Space → beat 2: a mock Omarchy desktop (this laptop's Tokyo Night theme + wallpaper) tiles itself, one real
   shortcut at a time (from its live Hyprland config), while the Agent Quota Bar slowly drains.
   Space → beat 3: Nick's two plugins + omarchy.org. Space → back to the world. */
(() => {
  const el = document.getElementById('omarchy');
  if (!el) return;
  const $ = (s) => el.querySelector(s);
  const area = $('.om-area'), keys = $('.om-keys'), menu = $('.om-menu'), title = $('.om-title'), cl = $('.om-b2 .om-q-cl');
  let alive = false, beat = 1, run = 0, timers = [];

  const later = (ms, fn) => timers.push(Deck.after(ms, fn));
  const ok = (r) => alive && beat === 2 && r === run;
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const LOGO = [
    ' ▄█████▄    ▄███████████▄    ▄███████   ▄███████   ▄███████   ▄█   █▄    ▄█   █▄',
    '███   ███  ███   ███   ███  ███   ███  ███   ███  ███   ███  ███   ███  ███   ███',
    '███   ███  ███   ███   ███ ▄███▄▄▄███ ▄███▄▄▄██▀  ███       ▄███▄▄▄███▄ ███▄▄▄███',
    '███   ███  ███   ███   ███ ▀███▀▀▀███ ▀███▀▀▀▀    ███      ▀▀███▀▀▀███  ▀▀▀▀▀▀███',
    '███   ███  ███   ███   ███  ███   ███ ██████████  ███   █▄   ███   ███  ▄██   ███',
    ' ▀█████▀    ▀█   ███   █▀   ███   █▀   ███   ███  ███████▀   ███   █▀    ▀█████▀',
  ].join('\n');
  const FETCH = [
    ['OS', 'Omarchy 4.0.4'], ['WM', 'Hyprland 0.56.2'], ['Theme', 'tokyo-night'], ['Shell', 'bash'],
  ];
  // the first lines of the Agent Quota Bar's BarWidget.qml (the real file)
  const QML = [
    'import QtQuick', 'import qs.Commons', 'import qs.Ui', '',
    'BarWidget {', '  id: root', '  moduleName: "shifty.agent-quota-bar"', '',
    '  property var panelItem: null', '',
    '  readonly property bool opened: panelItem ? panelItem.opened === true : false',
    '  readonly property var segments: panelItem ? panelItem.segments : []',
    '  readonly property color labelColor: bar ? bar.barForeground : Color.foreground', '',
    '  function levelColor(level) {',
    '    if (!panelItem) return labelColor',
    '    if (level === "ok") return panelItem.okColor',
    '    if (level === "warn") return panelItem.warnColor',
    '    if (level === "low") return panelItem.lowColor',
    '    return labelColor', '  }',
  ];
  const hl = (line) => esc(line)
    .replace(/(&quot;|")(.*?)\1/g, '<span class="st">"$2"</span>')
    .replace(/\b(import|property|readonly|function|return|if|null|false|true)\b/g, '<span class="kw">$1</span>')
    .replace(/\b(bool|var|color|string|BarWidget|QtQuick)\b/g, '<span class="ty">$1</span>')
    .replace(/\b(levelColor)\b/g, '<span class="fn">$1</span>');

  const WIN = {
    term: {
      name: 'Terminal',
      html: () => `<pre class="om-term"><span class="pr">~ ❯</span> <span class="cmd"></span><span class="out"></span></pre>`,
    },
    browser: {
      name: 'omarchy.org',
      html: () => `<div class="om-bro"><div class="om-url">https://<b>omarchy.org</b></div><div class="om-page"><img src="assets/omarchy.avif" alt=""><i style="width:52%"></i><i style="width:40%"></i></div></div>`,
    },
    editor: {
      name: 'BarWidget.qml — nvim',
      html: () => `<div class="om-ed"><div class="om-tab">BarWidget.qml</div><div class="om-code">${QML.map((l, i) => `<span class="ln">${i + 1}</span>${hl(l)}`).join('\n')}</div><div class="om-status"><b>NORMAL</b><span>shifty.agent-quota-bar</span></div></div>`,
    },
  };
  let wins = {};

  function place(id, [x, y, w, h]) {
    const n = wins[id];
    if (!n) return;
    n.style.setProperty('--x', x); n.style.setProperty('--y', y);
    n.style.setProperty('--w', w); n.style.setProperty('--h', h);
  }
  function focus(id) {
    for (const [k, n] of Object.entries(wins)) n.classList.toggle('act', k === id);
    title.textContent = WIN[id]?.name ?? '~';
  }
  function open(id, rect) {
    const n = document.createElement('div');
    n.className = 'om-win new';
    n.innerHTML = WIN[id].html();
    area.appendChild(n);
    wins[id] = n;
    place(id, rect);
    requestAnimationFrame(() => requestAnimationFrame(() => n.classList.remove('new')));
    focus(id);
    window.SFX?.msgOut();
  }
  function close(id) {
    const n = wins[id];
    if (!n) return;
    n.classList.add('gone');
    delete wins[id];
    Deck.after(400, () => n.remove());
    window.SFX?.blip(0);
  }

  // one shortcut at a time: keycaps appear, then the desktop reacts
  async function chord(combo, label, r) {
    keys.innerHTML = combo.map((k, i) => `${i ? '<span>+</span>' : ''}<kbd style="--k:${i}">${k}</kbd>`).join('') + `<span class="lbl">${label}</span>`;
    for (let i = 0; i < combo.length; i++) later(i * 70 + 40, () => ok(r) && window.SFX?.tap());
    await Deck.sleep(combo.length * 70 + 380);
    return ok(r);
  }

  async function typeFetch(r) {
    const t = wins.term?.querySelector('.cmd'), out = wins.term?.querySelector('.out');
    if (!t) return;
    for (const ch of 'fastfetch') { if (!ok(r)) return; t.textContent += ch; window.SFX?.tick(); await Deck.sleep(55); }
    await Deck.sleep(250);
    if (!ok(r)) return;
    out.innerHTML = `\n<div class="logo">${LOGO}</div>` +
      `<span class="pr">shifty</span>@<span class="pr">omarchy-big</span>\n<span class="dim">──────────────────</span>\n` +
      FETCH.map(([k, v]) => `<span class="k">${k}</span>${v}`).join('\n') +
      `\n\n<span class="sw">${['#f7768e', '#9ece6a', '#e0af68', '#7aa2f7', '#bb9af7', '#7dcfff'].map((c) => `<span style="background:${c}"></span>`).join('')}</span>`;
    window.SFX?.blip(2);
  }

  // the quota bar drains a little while you watch (token–life balance)
  function drain(r) {
    let left = 90;
    const step = () => {
      if (!ok(r) || left <= 86) return;
      left -= 1;
      cl.textContent = `${left}%`;
      cl.classList.remove('tick'); void cl.offsetWidth; cl.classList.add('tick');
      later(2600, step);
    };
    later(2600, step);
  }

  async function desktop(r) {
    area.innerHTML = ''; wins = {}; keys.innerHTML = '';
    menu.classList.remove('on');
    cl.textContent = '90%';
    title.textContent = '~';
    drain(r);
    await Deck.sleep(700);
    if (!await chord(['SUPER', 'RETURN'], 'Terminal', r)) return;
    open('term', [0, 0, 100, 100]);
    await Deck.sleep(500);
    await typeFetch(r);
    await Deck.sleep(1100);
    if (!await chord(['SUPER', 'SHIFT', 'B'], 'Browser', r)) return;
    place('term', [0, 0, 50, 100]);
    open('browser', [50, 0, 50, 100]);
    await Deck.sleep(1500);
    if (!await chord(['SUPER', 'SHIFT', 'N'], 'Editor', r)) return;
    place('browser', [50, 0, 50, 50]);
    open('editor', [50, 50, 50, 50]);
    await Deck.sleep(1500);
    if (!await chord(['SUPER', 'J'], 'Toggle split', r)) return;
    place('browser', [50, 0, 25, 100]);
    place('editor', [75, 0, 25, 100]);
    window.SFX?.blip(1);
    await Deck.sleep(1400);
    if (!await chord(['SUPER', 'F'], 'Full screen', r)) return;
    wins.editor.classList.add('full');
    place('editor', [0, 0, 100, 100]);
    window.SFX?.blip(3);
    await Deck.sleep(1500);
    if (!await chord(['SUPER', 'F'], 'Full screen', r)) return;
    place('editor', [75, 0, 25, 100]);
    later(450, () => wins.editor?.classList.remove('full'));
    await Deck.sleep(1100);
    if (!await chord(['SUPER', 'SPACE'], 'Omarchy menu', r)) return;
    menu.classList.add('on');
    window.SFX?.pop(1);
    await Deck.sleep(1800);
    if (!ok(r)) return;
    menu.classList.remove('on');
    await Deck.sleep(500);
    if (!await chord(['SUPER', 'W'], 'Close window', r)) return;
    close('editor');
    place('browser', [50, 0, 50, 100]);
    focus('browser');
    await Deck.sleep(1200);
    if (ok(r)) { keys.innerHTML = ''; window.SFX?.chime(); }
  }

  function intro() {
    el.classList.remove('slammed', 'logo');
    later(350, () => { if (!alive || beat !== 1) return; el.classList.add('slammed'); window.SFX?.boom(); });
    later(2000, () => { if (!alive || beat !== 1) return; el.classList.add('logo'); window.SFX?.chime(); });
  }

  function setBeat(n, back = false) {
    beat = n;
    el.dataset.beat = String(n);
    const r = ++run;
    if (n === 1 && back) el.classList.add('slammed', 'logo');
    else if (n === 1) intro();
    else if (n === 2) desktop(r);
    else window.SFX?.pop(2);
  }

  Deck.on('omarchy', {
    enter() { alive = true; setBeat(1); },
    leave() { alive = false; run++; timers.forEach(clearTimeout); timers = []; },
    next() {
      if (beat === 1 && !el.classList.contains('logo')) { el.classList.add('slammed', 'logo'); }
      if (beat < 3) { setBeat(beat + 1); return true; }
      return false;
    },
    prev() {
      if (beat > 1) { setBeat(beat - 1, true); return true; }
      return false;
    },
  });
})();
