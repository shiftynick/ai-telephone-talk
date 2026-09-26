// All of the world's sound, synthesised live with WebAudio — no files, works offline.
// Music: a soft generative loop (pad + electric piano + kalimba melody + bass) that
// darkens with the sunset and ducks away while slides are open or the window loses
// focus. Ambience: wind, birds (day), crickets (dusk), waterfalls by distance.
// SFX: footsteps per surface, chimes, whooshes, jingle, fireworks, gate bell, phone ring, oink.

const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const SAVE = 'ai-telephone-world-audio';

export function createAudio() {
  let ctx = null, started = false;
  let master, comp, musicBus, musicFilter, ambBus, sfxBus, verb, verbIn, noiseBuf;
  let muted = false, musicLevel = 0.55, duckK = 1, focusK = 1, day = 0, finale = 0;
  try { const s = JSON.parse(localStorage.getItem(SAVE) || '{}'); muted = !!s.muted; if (s.music != null) musicLevel = s.music; } catch {}
  const save = () => { try { localStorage.setItem(SAVE, JSON.stringify({ muted, music: musicLevel })); } catch {} };

  // ---------------------------------------------------------------- graph
  function build() {
    ctx = new AudioContext({ latencyHint: 'playback' });
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(comp); comp.connect(ctx.destination);
    // reverb from a generated impulse response
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
    }
    verb.buffer = ir;
    verbIn = ctx.createGain(); verbIn.gain.value = 0.5;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.55;
    verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(master);
    musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 5200; musicFilter.Q.value = 0.4;
    musicBus = ctx.createGain(); musicBus.gain.value = 0;
    const musicHp = ctx.createBiquadFilter(); musicHp.type = 'highpass'; musicHp.frequency.value = 85; musicHp.Q.value = 0.5;
    const musicHp2 = ctx.createBiquadFilter(); musicHp2.type = 'highpass'; musicHp2.frequency.value = 85; musicHp2.Q.value = 0.5;
    musicBus.connect(musicHp); musicHp.connect(musicHp2); musicHp2.connect(musicFilter); musicFilter.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  // ---------------------------------------------------------------- tiny helpers
  const T = () => ctx.currentTime;
  const gainNode = (v = 0, ...outs) => { const g = ctx.createGain(); g.gain.value = v; outs.forEach((o) => g.connect(o)); return g; };
  const osc = (type, f, t0, t1, out) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(out); o.start(t0); o.stop(t1); return o; };
  const noise = (t0, dur, out, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate; s.connect(out); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur); return s; };
  const filt = (type, f, q, out) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(out); return b; };
  const pan = (p, out) => { const s = ctx.createStereoPanner(); s.pan.value = p; s.connect(out); return s; };
  // attack / exponential decay envelope on a gain param
  const ad = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };

  // ---------------------------------------------------------------- instruments
  function kalimba(f, t, vel, out = musicBus, send = 0.6) {
    const g = gainNode(0, out); if (send) g.connect(gainNode(send, verbIn));
    ad(g, t, vel, 0.004, 1.4);
    osc('sine', f, t, t + 1.6, g);
    const g2 = gainNode(0, g); ad(g2, t, 0.35, 0.002, 0.12);
    osc('sine', f * 4.02, t, t + 0.2, g2);
    const g3 = gainNode(0, g); ad(g3, t, 0.12, 0.001, 0.05);
    osc('triangle', f * 6.9, t, t + 0.08, g3);
  }
  function epiano(f, t, vel, dur) {
    const g = gainNode(0, musicBus, gainNode(0.35, verbIn));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    const car = osc('sine', f, t, t + dur + 0.7, g);
    const mg = gainNode(0);
    mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.6);
    const mod = ctx.createOscillator(); mod.frequency.value = f; mod.connect(mg); mg.connect(car.frequency);
    mod.start(t); mod.stop(t + dur + 0.7);
  }
  function pad(freqs, t, dur, vel) {
    const f = filt('lowpass', 700 + (1 - day) * 700 + finale * 900, 0.6, musicBus);
    f.connect(gainNode(0.6, verbIn));
    const g = gainNode(0, f);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 1.6);
    g.gain.setValueAtTime(vel, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 2.2);
    for (const fr of freqs) for (const det of [-8, 7]) {
      const o = osc('sawtooth', fr, t, t + dur + 2.3, g);
      o.detune.value = det;
    }
  }
  function bass(f, t, vel, dur) {
    const g = gainNode(0, musicBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.04);
    g.gain.exponentialRampToValueAtTime(vel * 0.5, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc('sine', f, t, t + dur + 0.05, g);
    const g2 = gainNode(0.18, g); osc('triangle', f * 2, t, t + dur, g2);
  }
  function glock(f, t, vel, out = musicBus) {
    const g = gainNode(0, out, gainNode(0.7, verbIn));
    ad(g, t, vel, 0.002, 1.8);
    osc('sine', f, t, t + 2, g);
    const g2 = gainNode(0.3, g); osc('sine', f * 2.76, t, t + 0.6, g2);
  }

  // ---------------------------------------------------------------- the music
  // D major, 84 bpm: Dmaj7 · Bm9 · Gmaj7 · Asus — with a generated kalimba motif
  const BPM = 84, BEAT = 60 / BPM, BAR = BEAT * 4;
  const CHORDS = [
    { bass: 38, pad: [57, 61, 62, 66], ep: [62, 66, 69, 73], tones: [62, 66, 69, 73, 74] },
    { bass: 35, pad: [54, 57, 61, 62], ep: [61, 62, 66, 69], tones: [59, 62, 66, 69, 71] },
    { bass: 31, pad: [55, 59, 62, 66], ep: [59, 62, 66, 67], tones: [62, 67, 71, 74, 66] },
    { bass: 33, pad: [52, 57, 59, 64], ep: [57, 59, 64, 66], tones: [64, 69, 71, 76, 66] },
  ];
  const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
  let motif = [], bar = 0, nextBarT = 0, schedTimer = 0;
  function newMotif() {
    motif = [];
    let idx = 3 + Math.floor(Math.random() * 3);
    for (let s = 0; s < 16; s++) { // 2 bars of 8ths
      const strong = s % 4 === 0;
      if (Math.random() < (strong ? 0.7 : 0.3)) {
        idx = Math.max(0, Math.min(PENTA.length - 1, idx + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
        motif.push({ s, idx, vel: strong ? 0.26 : 0.17 });
      }
    }
  }
  function scheduleBar(t) {
    const ch = CHORDS[bar % 4];
    const dusk = day;
    pad(ch.pad.map(midi), t, BAR, 0.016);
    bass(midi(ch.bass + 12), t, 0.06, BEAT * 1.8);
    bass(midi(ch.bass + 12), t + BEAT * 2, 0.04, BEAT * 1.6);
    // electric piano: beat 1 and the "and" of 2
    ch.ep.forEach((m, i) => epiano(midi(m), t + i * 0.012, 0.035, BEAT * 1.4));
    if (Math.random() < 0.8) ch.ep.slice(1).forEach((m, i) => epiano(midi(m), t + BEAT * 1.5 + i * 0.01, 0.022, BEAT));
    // kalimba motif, mutating a little each pass; sparser at dusk
    if (bar % 8 === 0) newMotif();
    const half = bar % 2;
    for (const n of motif) {
      if (Math.floor(n.s / 8) !== half) continue;
      if (Math.random() < dusk * 0.35) continue;
      let m = PENTA[n.idx];
      if (Math.random() < 0.15) m = PENTA[Math.max(0, n.idx - 1)];
      kalimba(midi(m), t + (n.s % 8) * BEAT / 2 + (Math.random() - 0.5) * 0.012, n.vel);
    }
    // sparkle at the finale
    if (finale > 0.5) ch.tones.forEach((m, i) => glock(midi(m + 12), t + BEAT * 2 + i * BEAT / 4, 0.05));
    bar++;
  }
  function scheduler() {
    if (!ctx) return;
    while (nextBarT < T() + 0.6) { scheduleBar(nextBarT); nextBarT += BAR; }
  }

  // ---------------------------------------------------------------- ambience
  let windG, birdsT = 0, crickT = 0, falls = null;
  function startAmbience() {
    // wind: slowly breathing band-passed noise
    windG = gainNode(0.0, ambBus);
    const bp = filt('bandpass', 420, 0.6, windG);
    noise(T(), 60 * 60 * 3, bp, 0.5);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = gainNode(0.035); lfo.connect(lg); lg.connect(windG.gain); lfo.start();
    windG.gain.value = 0.05;
    // waterfalls: a rumble whose level follows distance
    falls = gainNode(0, ambBus);
    const lp = filt('lowpass', 1400, 0.3, falls);
    noise(T(), 60 * 60 * 3, lp, 0.8);
  }
  function bird() {
    const t = T() + 0.05, p = pan(Math.random() * 1.6 - 0.8, ambBus);
    const n = 2 + Math.floor(Math.random() * 4), base = 2600 + Math.random() * 1800;
    for (let i = 0; i < n; i++) {
      const s = t + i * (0.09 + Math.random() * 0.05);
      const g = gainNode(0, p); ad(g, s, 0.05, 0.005, 0.07);
      const o = osc('sine', base, s, s + 0.1, g);
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.03);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.08);
    }
  }
  function cricket() {
    const t = T() + 0.05, p = pan(Math.random() * 1.4 - 0.7, ambBus);
    const g = gainNode(0, p);
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 4; i++) { g.gain.setValueAtTime(0.018 * day, t + i * 0.045); g.gain.setValueAtTime(0, t + i * 0.045 + 0.025); }
    osc('sine', 4400 + Math.random() * 300, t, t + 0.25, g);
  }

  // ---------------------------------------------------------------- mix control
  function applyMix(ramp = 0.8) {
    if (!ctx) return;
    const t = T();
    const on = muted ? 0 : 1;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(1.0 * on * focusK, t, ramp / 3);
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(musicLevel * duckK, t, ramp / 3);
    ambBus.gain.cancelScheduledValues(t);
    ambBus.gain.setTargetAtTime(0.8 * duckK, t, ramp / 3);
  }

  // pause everything while the window isn't the one being shown (e.g. the live demo app)
  function watchFocus() {
    setInterval(() => {
      const active = document.visibilityState === 'visible' && document.hasFocus();
      const k = active ? 1 : 0;
      if (k !== focusK) { focusK = k; applyMix(active ? 1.5 : 0.6); }
    }, 400);
  }

  // ---------------------------------------------------------------- API
  const api = {
    get muted() { return muted; },
    get debug() { return { ctx, out: comp }; },
    get started() { return started; },
    start() {
      if (started) { ctx?.resume(); return; }
      started = true;
      build();
      ctx.resume();
      nextBarT = T() + 0.15;
      schedTimer = setInterval(scheduler, 100);
      scheduler();
      startAmbience();
      watchFocus();
      applyMix(2.5);
    },
    toggleMute() { muted = !muted; save(); applyMix(0.3); return muted; },
    musicUp(d) { musicLevel = Math.max(0, Math.min(1.2, musicLevel + d)); save(); applyMix(0.2); return musicLevel; },
    duck(on) { duckK = on ? 0 : 1; applyMix(on ? 0.9 : 2.2); },
    setDay(k) {
      day = k;
      if (!ctx) return;
      musicFilter.frequency.setTargetAtTime(5200 - k * 2600 + finale * 2500, T(), 1);
    },
    setFinale(on) { finale = on ? 1 : 0; api.setDay(day); },
    setWaterfall(v) { if (falls) falls.gain.setTargetAtTime(Math.min(0.12, v * 0.12), T(), 0.3); },
    update(dt) {
      if (!ctx || muted || duckK === 0) return;
      birdsT -= dt; crickT -= dt;
      if (birdsT <= 0) { birdsT = 3 + Math.random() * 7; if (Math.random() > day * 1.1) bird(); }
      if (crickT <= 0) { crickT = 0.5 + Math.random() * 1.4; if (day > 0.35) cricket(); }
    },

    step(surface = 'grass') {
      if (!ctx) return;
      const t = T() + 0.005, v = 0.8 + Math.random() * 0.4;
      if (surface === 'wood') {
        const g = gainNode(0, sfxBus); ad(g, t, 0.16 * v, 0.002, 0.12);
        const o = osc('triangle', 150 + Math.random() * 40, t, t + 0.15, g);
        o.frequency.exponentialRampToValueAtTime(90, t + 0.1);
        const n = gainNode(0, sfxBus); ad(n, t, 0.05 * v, 0.001, 0.03);
        noise(t, 0.05, filt('bandpass', 2500, 1.5, n));
      } else {
        const f = surface === 'path' ? 2200 : surface === 'stone' ? 3200 : 1100;
        const g = gainNode(0, sfxBus); ad(g, t, (surface === 'grass' ? 0.07 : 0.06) * v, 0.003, surface === 'stone' ? 0.035 : 0.07);
        noise(t, 0.12, filt('bandpass', f * (0.85 + Math.random() * 0.3), surface === 'grass' ? 0.8 : 1.4, g), 0.9 + Math.random() * 0.3);
      }
    },
    arrive() {
      if (!ctx) return;
      const t = T() + 0.02;
      kalimba(midi(81), t, 0.14, sfxBus, 0.8);
      kalimba(midi(86), t + 0.13, 0.12, sfxBus, 0.8);
    },
    whooshUp(dur = 0.9, vol = 0.14) {
      if (!ctx) return;
      const t = T() + 0.01;
      const g = gainNode(0, sfxBus, gainNode(0.4, verbIn));
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const bp = filt('bandpass', 300, 1.2, g);
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3200, t + dur);
      noise(t, dur + 0.05, bp);
    },
    whooshDown(dur = 0.8, vol = 0.12) {
      if (!ctx) return;
      const t = T() + 0.01;
      const g = gainNode(0, sfxBus, gainNode(0.4, verbIn));
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const bp = filt('bandpass', 3000, 1.2, g);
      bp.frequency.setValueAtTime(3000, t); bp.frequency.exponentialRampToValueAtTime(250, t + dur);
      noise(t, dur + 0.05, bp);
    },
    open() { // into the slides: whoosh + a rising shimmer
      if (!ctx) return;
      api.whooshUp(1.0, 0.13);
      const t = T() + 0.25;
      [74, 78, 81, 86].forEach((m, i) => glock(midi(m), t + i * 0.08, 0.06, sfxBus));
    },
    close(end) {
      if (!ctx) return;
      api.whooshDown(0.8, 0.12);
      if (end) api.jingle(0.55);
    },
    jingle(delay = 0) {
      if (!ctx) return;
      const t = T() + delay;
      [[74, 0], [78, 0.1], [81, 0.2], [86, 0.3], [90, 0.45]].forEach(([m, d]) => glock(midi(m), t + d, 0.09, sfxBus));
      kalimba(midi(62), t + 0.45, 0.12, sfxBus);
      kalimba(midi(69), t + 0.45, 0.1, sfxBus);
      // confetti crackle
      for (let i = 0; i < 26; i++) {
        const s = t + 0.1 + Math.random() * 0.9;
        const g = gainNode(0, pan(Math.random() * 1.6 - 0.8, sfxBus)); ad(g, s, 0.03 + Math.random() * 0.03, 0.001, 0.02);
        noise(s, 0.03, filt('highpass', 3000 + Math.random() * 4000, 0.7, g));
      }
    },
    firework(dist = 10) {
      if (!ctx) return;
      const t = T() + 0.02, v = Math.max(0.15, 1 - dist / 40);
      const g = gainNode(0, pan(Math.random() * 1.2 - 0.6, sfxBus), gainNode(0.6, verbIn));
      ad(g, t, 0.22 * v, 0.003, 0.5);
      noise(t, 0.6, filt('lowpass', 900, 0.7, g), 0.6);
      const b = gainNode(0, g); ad(b, t, 0.5, 0.002, 0.25);
      osc('sine', 70, t, t + 0.3, b).frequency.exponentialRampToValueAtTime(40, t + 0.25);
      for (let i = 0; i < 18; i++) {
        const s = t + 0.25 + Math.random() * 1.1;
        const c = gainNode(0, pan(Math.random() * 1.6 - 0.8, sfxBus)); ad(c, s, 0.035 * v, 0.001, 0.025);
        noise(s, 0.03, filt('highpass', 2500 + Math.random() * 3000, 0.8, c));
      }
    },
    gate(open) {
      if (!ctx) return;
      const t = T() + 0.02;
      // clack
      const k = gainNode(0, sfxBus); ad(k, t + (open ? 0.6 : 0.5), 0.18, 0.002, 0.09);
      osc('triangle', 220, t, t + 1.2, k).frequency.exponentialRampToValueAtTime(110, t + 1);
      if (!open) {
        // railroad-crossing bell: ding… ding… ding…
        for (let i = 0; i < 4; i++) {
          const s = t + i * 0.36;
          const g = gainNode(0, sfxBus, gainNode(0.3, verbIn)); ad(g, s, 0.07, 0.002, 0.32);
          osc('sine', 1180, s, s + 0.4, g); const g2 = gainNode(0.5, g); osc('sine', 1180 * 2.4, s, s + 0.2, g2);
        }
      } else {
        const g = gainNode(0, sfxBus); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.1); g.gain.linearRampToValueAtTime(0.0001, t + 0.6);
        const o = osc('sawtooth', 90, t, t + 0.65, filt('lowpass', 500, 1, g)); o.frequency.linearRampToValueAtTime(140, t + 0.6);
      }
    },
    ring(vol = 1) { // an old bell phone: brrring… brrring
      if (!ctx || vol < 0.03) return;
      const t = T() + 0.02;
      for (const off of [0, 0.55]) {
        const g = gainNode(0, sfxBus, gainNode(0.25, verbIn));
        g.gain.setValueAtTime(0.0001, t + off); g.gain.linearRampToValueAtTime(0.045 * vol, t + off + 0.02);
        g.gain.setValueAtTime(0.045 * vol, t + off + 0.38); g.gain.linearRampToValueAtTime(0.0001, t + off + 0.45);
        const am = gainNode(0, g);
        const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 22;
        const lg = gainNode(0.5); lfo.connect(lg); lg.connect(am.gain); am.gain.value = 0.5;
        lfo.start(t + off); lfo.stop(t + off + 0.5);
        osc('sine', 980, t + off, t + off + 0.5, am); osc('sine', 1470, t + off, t + off + 0.5, gainNode(0.6, am));
      }
    },
    oink() {
      if (!ctx) return;
      const t = T() + 0.02;
      for (const [off, f0] of [[0, 170], [0.2, 190]]) {
        const s = t + off;
        const g = gainNode(0, sfxBus); ad(g, s, 0.16, 0.015, 0.13);
        const bp = filt('bandpass', 750, 3.5, g);
        const o = osc('sawtooth', f0, s, s + 0.18, bp);
        o.frequency.setValueAtTime(f0, s); o.frequency.linearRampToValueAtTime(f0 * 1.25, s + 0.05); o.frequency.linearRampToValueAtTime(f0 * 0.8, s + 0.15);
        const n = gainNode(0, g); ad(n, s, 0.4, 0.01, 0.1);
        noise(s, 0.15, filt('bandpass', 1200, 1, n));
      }
    },
    swell() { // the fly-in
      if (!ctx) return;
      api.whooshDown(2.4, 0.09);
      const t = T() + 0.4;
      const g = gainNode(0, sfxBus, gainNode(0.8, verbIn));
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 1.6); g.gain.linearRampToValueAtTime(0.0001, t + 4);
      for (const m of [50, 57, 62, 66, 69]) { const o = osc('triangle', midi(m), t, t + 4.1, g); o.detune.value = (Math.random() - 0.5) * 10; }
    },
  };
  return api;
}
