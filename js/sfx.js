/* Deck sound effects, synthesized live with WebAudio: no audio files, nothing to license.
   window.SFX.<effect>() is safe to call any time; nothing plays until the browser allows audio
   (the first key press / click in the deck, or activation handed down from the world page).
   M toggles mute for the whole deck. */
(() => {
  let ctx = null, master = null, noise = null, muted = localStorage.getItem('deck.sfx.muted') === '1';
  let hum = null, meter = null;
  // measured against the world's music (2026-09-26): 0.9 made the teaser sound far quieter on a TV
  const LEVEL = 1.9;

  // Inside the talk's world (a same-origin iframe) keys often arrive as forwarded messages, not real key presses,
  // so this frame may never get the user activation audio needs. The world page does have it (it plays music),
  // so build the context from the world's own AudioContext constructor: it inherits the world's permission.
  function parentAudioContext() {
    try {
      if (window.parent !== window && window.parent.document && window.parent.AudioContext) return window.parent.AudioContext;
    } catch { /* cross-origin parent: fall back to our own */ }
    return null;
  }

  function init() {
    if (ctx) return ctx;
    const AC = parentAudioContext() || window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : LEVEL;
    master.connect(comp).connect(ctx.destination);
    meter = ctx.createAnalyser(); meter.fftSize = 2048; comp.connect(meter); // level tap for checks
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  const ready = () => { const c = init(); if (c && c.state !== 'running') c.resume(); return c && c.state === 'running' ? c : null; };
  addEventListener('keydown', () => ready(), true);
  addEventListener('pointerdown', () => ready(), true);
  addEventListener('message', (e) => { if (e.data?.type === 'deck:key' || e.data?.type === 'deck:start') ready(); });
  // a context made from the world's constructor outlives this frame: close it when the slides go away
  addEventListener('pagehide', () => { try { ctx?.close(); } catch { /* already closed */ } });

  function tone({ type = 'sine', f0, f1 = f0, at = 0, dur = 0.2, vol = 0.2, attack = 0.005, filter = null }) {
    const c = ready(); if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (filter) { const f = c.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.f; f.Q.value = filter.q ?? 1; node = node.connect(f); }
    node.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function hiss({ at = 0, dur = 0.3, vol = 0.2, type = 'bandpass', f0 = 2000, f1 = f0, q = 1 }) {
    const c = ready(); if (!c) return;
    const t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  const SFX = {
    /** power-up sweep + lock-on blips (the teaser starts) */
    start() {
      hiss({ dur: 1.1, vol: 0.18, type: 'bandpass', f0: 300, f1: 5000, q: 2 });
      tone({ type: 'sawtooth', f0: 60, f1: 440, dur: 0.9, vol: 0.08, filter: { type: 'lowpass', f: 1800 } });
      [880, 1320].forEach((f, k) => tone({ type: 'square', f0: f, at: 0.95 + k * 0.09, dur: 0.08, vol: 0.06 }));
    },
    /** a low, slowly pulsing "signal" drone under the whole teaser */
    humOn() {
      const c = ready(); if (!c || hum) return;
      const o1 = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), f = c.createBiquadFilter();
      o1.type = 'sawtooth'; o1.frequency.value = 55; o2.type = 'sawtooth'; o2.frequency.value = 55.6;
      f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 3;
      lfo.frequency.value = 0.18; lg.gain.value = 180; lfo.connect(lg).connect(f.frequency);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 2.5); // a bed under the effects, not a wall
      o1.connect(f); o2.connect(f); f.connect(g).connect(master);
      o1.start(); o2.start(); lfo.start();
      hum = { g, stop: (fade = 1.5) => { const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + fade); [o1, o2, lfo].forEach((o) => o.stop(t + fade + 0.1)); } };
    },
    humSwell() { if (!hum || !ctx) return; const t = ctx.currentTime; hum.g.gain.cancelScheduledValues(t); hum.g.gain.setValueAtTime(Math.max(0.0001, hum.g.gain.value), t); hum.g.gain.exponentialRampToValueAtTime(0.1, t + 0.6); },
    humOff(fade = 1.5) { if (hum) { hum.stop(fade); hum = null; } },
    /** the chain marker moves on to the next player */
    blip(n = 0) { tone({ type: 'square', f0: 660 + (n % 5) * 55, dur: 0.07, vol: 0.05 }); tone({ type: 'sine', f0: 1320 + (n % 5) * 110, at: 0.06, dur: 0.12, vol: 0.05 }); },
    /** one terminal keystroke while a caption types */
    tick() { hiss({ dur: 0.025, vol: 0.05 + Math.random() * 0.03, type: 'highpass', f0: 3500 + Math.random() * 2500, q: 0.7 }); },
    /** glitch/static burst for the picture dissolve */
    glitch(sec = 1.5) {
      hiss({ dur: sec, vol: 0.16, type: 'bandpass', f0: 6000, f1: 500, q: 1.5 });
      for (let k = 0; k < 6; k++) tone({ type: 'square', f0: 200 + Math.random() * 1600, at: Math.random() * sec * 0.7, dur: 0.04 + Math.random() * 0.05, vol: 0.05 });
      tone({ type: 'sine', f0: 180, f1: 60, at: sec * 0.55, dur: 0.35, vol: 0.18 }); // the new picture lands
    },
    /** a bubbly pop per emoji */
    pop(k = 0) { const f = 420 + ((k * 137) % 520); tone({ type: 'sine', f0: f, f1: f * 2.2, dur: 0.12, vol: 0.14 }); },
    /** data chatter while generated code scrolls past */
    chatter(sec = 1.7) {
      const n = Math.floor(sec * 22);
      for (let k = 0; k < n; k++) tone({ type: 'square', f0: 900 + Math.random() * 2400, at: (k / n) * sec, dur: 0.025, vol: 0.035 });
      hiss({ dur: sec, vol: 0.05, type: 'highpass', f0: 5000, q: 0.5 });
    },
    /** the resemblance meter drops: a falling tone, deeper for a bigger drop */
    drop(from, to) {
      if (!(from > to)) return;
      const d = Math.min(1, (from - to) / 60);
      tone({ type: 'triangle', f0: 700 - d * 200, f1: 180 - d * 90, dur: 0.35 + d * 0.5, vol: 0.12 + d * 0.08 });
    },
    /** title hit: sub drop + noise swell + shimmer */
    boom() {
      tone({ type: 'sine', f0: 120, f1: 32, dur: 1.6, vol: 0.5 });
      hiss({ dur: 1.4, vol: 0.14, type: 'lowpass', f0: 3000, f1: 200, q: 0.7 });
      [1568, 2093, 2637, 3136].forEach((f, k) => tone({ type: 'sine', f0: f, at: 0.25 + k * 0.07, dur: 1.2, vol: 0.05, attack: 0.02 }));
    },
    // ---- chat sounds (the AfterThat ad): generic, made from scratch ----
    /** an incoming message: a soft two-step pop */
    msgIn(soft = false) { const v = soft ? 0.15 : 0.24; tone({ type: 'sine', f0: 880, dur: 0.07, vol: v }); tone({ type: 'sine', f0: 1320, at: 0.06, dur: 0.12, vol: v * 0.8 }); },
    /** a message you send: a light upward swoosh */
    msgOut() { hiss({ dur: 0.18, vol: 0.14, type: 'bandpass', f0: 900, f1: 4000, q: 1.2 }); tone({ type: 'sine', f0: 660, f1: 1100, dur: 0.12, vol: 0.16 }); },
    /** a quiet tap while someone is typing */
    tap() { hiss({ dur: 0.02, vol: 0.07 + Math.random() * 0.03, type: 'bandpass', f0: 2500 + Math.random() * 1500, q: 2 }); },
    /** "Delivered" */
    delivered() { tone({ type: 'triangle', f0: 1760, dur: 0.05, vol: 0.1 }); },
    /** time jumps forward: whoosh + a low thud */
    timeSkip() { hiss({ dur: 0.9, vol: 0.16, type: 'bandpass', f0: 400, f1: 3500, q: 1 }); tone({ type: 'sine', f0: 90, f1: 40, at: 0.55, dur: 0.6, vol: 0.35 }); },
    /** a ghost town: wind for `sec` seconds, with a few crickets */
    ghostTown(sec = 5) {
      hiss({ dur: sec, vol: 0.2, type: 'bandpass', f0: 500, f1: 900, q: 0.7 });
      for (let k = 0; k < 4; k++) {
        const at = 0.8 + k * (sec / 4.5);
        for (let j = 0; j < 3; j++) tone({ type: 'sine', f0: 4200 + (k % 2) * 300, at: at + j * 0.09, dur: 0.05, vol: 0.1 });
      }
    },
    /** a bright, warm reveal chime */
    chime() { [523, 659, 784, 1047].forEach((f, k) => tone({ type: 'triangle', f0: f, at: k * 0.06, dur: 1.1, vol: 0.12, attack: 0.01 })); tone({ type: 'sine', f0: 2093, at: 0.25, dur: 0.9, vol: 0.05 }); },
    /** tiny glitch chirp while title letters scramble */
    chirp() { tone({ type: 'square', f0: 1200 + Math.random() * 1800, dur: 0.03, vol: 0.03 }); },
    /** RMS of what is playing right now (0 = silent); used to check the effects in a test browser */
    level() { if (!meter) return 0; const b = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / b.length); },
    get muted() { return muted; },
    setMuted(m) { muted = m; localStorage.setItem('deck.sfx.muted', m ? '1' : '0'); if (master && ctx) master.gain.setTargetAtTime(m ? 0 : LEVEL, ctx.currentTime, 0.05); },
    stopAll() { SFX.humOff(0.3); },
  };
  // Mute must be visible: it persists across reloads, so a forgotten M silences every slide.
  function badge() {
    let el = document.getElementById('sfx-muted');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sfx-muted';
      el.style.cssText = 'position:fixed;right:14px;top:12px;z-index:99;font:14px system-ui;color:#eee;background:rgba(0,0,0,.6);padding:4px 10px;border-radius:999px;pointer-events:none;transition:opacity .3s';
      document.body.appendChild(el);
    }
    return el;
  }
  function showMute(flash) {
    const el = badge();
    el.textContent = muted ? '🔇 slide sound off · M' : '🔊 slide sound on · M';
    el.style.opacity = muted || flash ? '1' : '0';
    if (flash && !muted) setTimeout(() => (el.style.opacity = '0'), 1500);
  }
  addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') { SFX.setMuted(!muted); showMute(true); }
  });
  addEventListener('message', (e) => {
    if (e.data?.type === 'deck:key' && (e.data.key === 'm' || e.data.key === 'M')) { SFX.setMuted(!muted); showMute(true); }
  });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => muted && showMute(false)); else if (muted) showMute(false);
  window.SFX = SFX;
})();
