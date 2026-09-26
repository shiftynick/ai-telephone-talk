/* Cold open: replays a real AI Telephone run (assets/run2/, bundled into js/run-data.js) through every
   medium: photo → words → speech → emoji → SVG → ASCII → 3D → coded animation, with a WebGL "signal
   dissolve" between pictures, then lands the title over the final video.
   Starts on the first →/space (standby until then), second skips to the title. */
(() => {
  const el = document.getElementById('cold-open');
  const cv = el.querySelector('.gl');
  const video = el.querySelector('.src-video');
  const $ = (s) => el.querySelector(s);
  if (window.RUN_DATA) video.src = RUN_DATA[video.getAttribute('src')] || video.src;

  // ---- the run: "Cold open · meetup photo (long)" — a past Dirty South AI meetup photo + the logo, no audio:
  //      3 rounds of describe → draw, then emoji → decode → SVG → ASCII → three.js → coded animation ----
  // fid = the app's resemblance meter for that step (judge: gemini-2.5-flash vs the original), filled by the bundler
  const STORY = window.RUN_STORY || { text: {}, src: {}, fid: {} };
  const FID = STORY.fid || {};
  const T = (i, n = 999) => { const t = (STORY.text[i] || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, t.lastIndexOf(' ', n)) + '…' : t; };
  const FLASH = 'google/gemini-2.5-flash', DRAW = 'google/gemini-3.1-flash-lite-image', OPUS = 'claude opus · via claude -p';
  const RUN_DIR = 'assets/run4/';
  const HOPS = [
    { kind: 'photo', src: RUN_DIR + '00-source.jpg', label: 'photo', model: 'a photo from a past meetup', fid: 100 },
    { kind: 'text', label: 'describe', model: FLASH, text: T(0, 190), fid: FID[0] },
    { kind: 'image', label: 'draw', model: DRAW, src: RUN_DIR + '02.jpg', fid: FID[1] },
    { kind: 'text', label: 'describe', model: FLASH, text: T(2, 120), fast: true, fid: FID[2] },
    { kind: 'image', label: 'draw', model: DRAW, src: RUN_DIR + '04.jpg', fid: FID[3] },
    { kind: 'text', label: 'describe', model: FLASH, text: T(4, 120), fast: true, fid: FID[4] },
    { kind: 'image', label: 'draw', model: DRAW, src: RUN_DIR + '06.jpg', fid: FID[5] },
    { kind: 'text', label: 'describe', model: FLASH, text: T(6, 120), fast: true, fid: FID[6] },
    { kind: 'emoji', label: 'emoji only', model: OPUS, text: STORY.text[7] || '', fid: FID[7] },
    { kind: 'text', label: 'decode', model: OPUS, text: T(8, 150), fid: FID[8] },
    { kind: 'code', label: 'svg', model: OPUS + ' → SVG', src: RUN_DIR + '10.jpg', code: 9, fid: FID[9] },
    { kind: 'text', label: 'describe', model: FLASH, text: T(10, 110), fast: true, fid: FID[10] },
    { kind: 'code', label: 'ascii', model: OPUS + ' → ASCII', src: RUN_DIR + '12.jpg', code: 11, fid: FID[11] },
    { kind: 'text', label: 'describe', model: FLASH, text: T(12, 110), fast: true, fid: FID[12] },
    { kind: 'code', label: '3d', model: OPUS + ' → three.js', src: RUN_DIR + '14.jpg', code: 13, fid: FID[13] },
    { kind: 'text', label: 'describe', model: FLASH, text: T(14, 110), fast: true, fid: FID[14] },
    { kind: 'video', label: 'animate', model: OPUS + ' → coded animation', code: 15, fid: FID[15] },
  ];

  // ---- chain list on the right ----
  const chain = $('.co-chain');
  chain.innerHTML = HOPS.map((h) => `<li>${h.label}</li>`).join('');
  const lis = [...chain.children];

  // ---- WebGL ----
  const gl = cv.getContext('webgl', { premultipliedAlpha: false, antialias: false });
  const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
  const FS = `
    precision highp float;
    varying vec2 uv;
    uniform sampler2D A, B;
    uniform float aA, aB, zA, zB, prog, time, dim, screen;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
    // cover-fit a texture of aspect ta into the screen, biased up for portraits (faces)
    vec2 cover(vec2 u, float ta, float z){
      vec2 s = ta > screen ? vec2(screen/ta, 1.) : vec2(1., ta/screen);
      vec2 c = vec2(.5, ta < screen ? min(.62, 1.-s.y*.5) : .5);
      return (u-.5)*s/z + c;
    }
    vec3 tap(sampler2D t, vec2 u, float split){
      return vec3(texture2D(t, u+vec2(split,0.)).r, texture2D(t, u).g, texture2D(t, u-vec2(split,0.)).b);
    }
    void main(){
      float n = fbm(uv*vec2(screen,1.)*2.2 + time*.05);
      float w = sin(prog*3.14159);                 // 0 → 1 → 0 across the transition
      vec2 d = (vec2(fbm(uv*4.+3.), fbm(uv*4.+7.))-.5) * w * .14;
      float band = floor(uv.y*60.)/60.;             // horizontal tear lines
      d.x += (hash(vec2(band, floor(time*18.)))-.5) * w * w * .06;
      vec3 a = tap(A, cover(uv+d, aA, zA), w*.012);
      vec3 b = tap(B, cover(uv-d, aB, zB), w*.012);
      float m = clamp((prog*1.4 - n - .2)/.2, 0., 1.);
      vec3 col = mix(a, b, m);
      col += vec3(1., .36, .12) * m*(1.-m)*4. * 1.3; // hot edge on the dissolve front
      float lum = dot(col, vec3(.299,.587,.114));
      col = mix(col, vec3(lum)*vec3(.9,.95,1.), dim*.55) * (1.-dim*.55);
      col *= .92 + .08*sin(uv.y*1080.*1.2);         // scanlines
      col *= smoothstep(1.25, .35, length((uv-.5)*vec2(screen*.8,1.)));
      gl_FragColor = vec4(col, 1.);
    }`;
  // WebGL renderer, or a plain 2D-canvas crossfade if WebGL is unavailable
  const R = gl ? glRenderer() : canvasRenderer();
  const black = R.texture();
  const texs = HOPS.map((h) => (h.src ? R.texture(h.src) : null));
  const vtex = R.texture();
  vtex.el = video;
  video.addEventListener('loadedmetadata', () => { vtex.aspect = video.videoWidth / video.videoHeight; });
  const load = (tex, src) => { const img = new Image();
    img.onload = () => { tex.aspect = img.width / img.height; tex.el = img; tex.upload?.(img); };
    img.src = window.RUN_DATA?.[src] || src; };
  HOPS.forEach((h, n) => h.src && load(texs[n], h.src));

  // ---- render state ----
  const S = { a: black, b: black, prog: 0, dim: 0, zStartA: 0, zStartB: 0, raf: 0 };
  function frame(now) {
    S.raf = requestAnimationFrame(frame);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; R.resize?.(w, h); }
    const t = now / 1000;
    const zoom = (t0) => 1 + Math.min(12, t - t0) * 0.006; // slow ken-burns push
    R.draw(t, w, h, zoom(S.zStartA), zoom(S.zStartB));
  }

  function glRenderer() {
    const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['A', 'B', 'aA', 'aB', 'zA', 'zB', 'prog', 'time', 'dim', 'screen'].forEach((k) => U[k] = gl.getUniformLocation(prog, k));
    gl.uniform1i(U.A, 0); gl.uniform1i(U.B, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    return {
      texture() {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((p) => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        return { t, aspect: 16 / 9, upload(img) {
          gl.bindTexture(gl.TEXTURE_2D, t);
          try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { console.error(e); }
        } };
      },
      resize(w, h) { gl.viewport(0, 0, w, h); },
      draw(t, w, h, zA, zB) {
        if (video.readyState >= 2 && (S.a === vtex || S.b === vtex)) vtex.upload(video);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.a.t);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, S.b.t);
        gl.uniform1f(U.aA, S.a.aspect); gl.uniform1f(U.aB, S.b.aspect);
        gl.uniform1f(U.zA, zA); gl.uniform1f(U.zB, zB);
        gl.uniform1f(U.prog, S.prog); gl.uniform1f(U.dim, S.dim);
        gl.uniform1f(U.time, t); gl.uniform1f(U.screen, w / h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  function canvasRenderer() {
    console.warn('cold-open: WebGL unavailable, using 2D crossfade');
    const c = cv.getContext('2d');
    const cover = (tex, w, h, z) => {
      if (!tex.el || (tex.el === video && video.readyState < 2)) return;
      const sa = w / h, ta = tex.aspect;
      let dw = w * z, dh = h * z;
      if (ta > sa) dw = dh * ta; else dh = dw / ta;
      const oy = ta < sa ? (h - dh) * 0.38 : (h - dh) / 2;
      c.drawImage(tex.el, (w - dw) / 2, oy, dw, dh);
    };
    return {
      texture() { return { aspect: 16 / 9, el: null }; },
      draw(t, w, h, zA, zB) {
        c.globalAlpha = 1; c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
        cover(S.a, w, h, zA);
        c.globalAlpha = S.prog; cover(S.b, w, h, zB);
        c.globalAlpha = S.dim * 0.55; c.fillRect(0, 0, w, h);
      },
    };
  }

  const gen = {}; // a newer tween on the same key cancels the older one
  const tween = (key, to, ms, ease = (x) => x) => new Promise((res) => {
    const from = S[key], start = performance.now(), id = gen[key] = (gen[key] || 0) + 1;
    const tick = (now) => {
      if (!running || gen[key] !== id) return res();
      const k = Math.min(1, (now - start) / ms);
      S[key] = from + (to - from) * ease(k);
      k < 1 ? requestAnimationFrame(tick) : res();
    };
    requestAnimationFrame(tick);
  });
  const inOut = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  async function show(tex, ms = 1600) {
    S.b = tex; S.zStartB = performance.now() / 1000; S.prog = 0;
    await tween('prog', 1, ms, inOut);
    S.a = tex; S.zStartA = S.zStartB; S.prog = 0;
  }

  // ---- captions ----
  const cap = $('.co-caption'), capText = $('.co-text'), capStep = $('.co-step'), capModel = $('.co-model');
  const fidEl = $('.co-fid'), fidN = $('.co-fid-n'), fidBar = $('.co-fid u');
  function mark(n) {
    const h = HOPS[n];
    lis.forEach((li, k) => { li.classList.toggle('done', k < n); li.classList.toggle('now', k === n); });
    capStep.textContent = `${String(n).padStart(2, '0')} · ${h.label}`;
    capModel.textContent = h.model;
    if (h.fid != null) fidelity(h.fid);
  }
  function fidelity(v) {
    fidBar.style.width = `${v}%`;
    fidEl.classList.toggle('low', v < 40);
    const from = parseInt(fidN.textContent, 10) || 100, t0 = performance.now();
    const tick = (now) => { const k = Math.min(1, (now - t0) / 1200);
      fidN.textContent = `${Math.round(from + (v - from) * (1 - Math.pow(1 - k, 3)))}%`; if (k < 1 && running) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  async function type(text, cps = 70) {
    capText.textContent = '';
    for (let k = 0; k < text.length && running; k++) {
      capText.textContent = text.slice(0, k + 1);
      await Deck.sleep(1000 / cps * (text[k] === ',' || text[k] === '.' ? 5 : 1));
    }
  }

  // ---- title: scramble-decode each word ----
  const GLYPHS = '▓▒░#$%&@*<>/\\|=+ABCDEFGHJKLMNPRSTUVWXYZ01';
  function scramble(node, ms = 1400) {
    const target = node.dataset.text || (node.dataset.text = node.textContent);
    const t0 = performance.now();
    const tick = (now) => {
      const k = (now - t0) / ms;
      node.innerHTML = [...target].map((ch, j) => {
        const settle = j / target.length * .7 + .3;
        return k >= settle ? ch : `<span class="glitch">${GLYPHS[(Math.random() * GLYPHS.length) | 0]}</span>`;
      }).join('');
      if (k < 1 && running) requestAnimationFrame(tick); else node.textContent = target;
    };
    requestAnimationFrame(tick);
  }

  // ---- special overlays: emoji, generated code, speech ----
  const emojiEl = $('.co-emoji'), codeEl = $('.co-code'), ring = $('.co-ring'), audio = $('.co-audio');
  if (window.RUN_DATA) audio.src = RUN_DATA[audio.getAttribute('src')] || audio.src;

  async function showEmoji(str) {
    const glyphs = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)].map((g) => g.segment).filter((g) => g.trim());
    emojiEl.innerHTML = glyphs.map((g, k) => `<span style="--k:${k}">${g}</span>`).join('');
    emojiEl.classList.add('on');
    await Deck.sleep(900 + glyphs.length * 110 + 1600);
    emojiEl.classList.remove('on');
  }

  /** the model's actual generated source, scrolling past fast before the render resolves */
  async function flashCode(i, ms = 1700) {
    const src = (STORY.src[i] || '').replace(/```\w*|```/g, '').split('\n').slice(0, 90).join('\n');
    codeEl.innerHTML = `<pre>${src.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`;
    codeEl.classList.add('on');
    const pre = codeEl.firstChild, t0 = performance.now();
    const scroll = (now) => { const k = Math.min(1, (now - t0) / ms); pre.style.transform = `translateY(${-k * Math.max(0, pre.scrollHeight - 700)}px)`; if (k < 1 && running) requestAnimationFrame(scroll); };
    requestAnimationFrame(scroll);
    await Deck.sleep(ms);
    codeEl.classList.remove('on');
  }

  /** play the real TTS output with a frequency ring; fade out after `ms` */
  async function speak(ms) {
    const g = ring.getContext('2d');
    let ac = null, an = null;
    try { ac = new AudioContext(); an = ac.createAnalyser(); an.fftSize = 256; ac.createMediaElementSource(audio).connect(an); an.connect(ac.destination); } catch { /* file:// or no WebAudio: plain audio */ }
    audio.currentTime = 0; audio.volume = 1;
    await audio.play().catch(() => {});
    ring.classList.add('on');
    const bins = new Uint8Array(128), t0 = performance.now();
    const draw = (now) => {
      if (!running || now - t0 > ms + 800) return;
      requestAnimationFrame(draw);
      const w = ring.width = ring.clientWidth, h = ring.height = ring.clientHeight;
      if (an) an.getByteFrequencyData(bins); else for (let i = 0; i < 128; i++) bins[i] = 90 + 80 * Math.sin(now / 90 + i * 0.7) * Math.sin(now / 400);
      g.translate(w / 2, h / 2);
      const r0 = Math.min(w, h) * 0.2, n = 120;
      for (let i = 0; i < n; i++) {
        const v = bins[Math.floor((i < n / 2 ? i : n - i) / (n / 2) * 90)] / 255;
        g.rotate((Math.PI * 2) / n);
        g.fillStyle = `hsla(${18 + v * 170}, 95%, ${55 + v * 15}%, ${0.3 + v * 0.7})`;
        g.fillRect(-3, r0, 6, 10 + v * r0 * 1.1);
      }
    };
    requestAnimationFrame(draw);
    await Deck.sleep(ms);
    for (let k = 10; k >= 0; k--) { audio.volume = k / 10; await Deck.sleep(60); }
    audio.pause();
    ring.classList.remove('on');
    ac?.close();
  }

  // ---- timeline ----
  let running = false, titled = false;
  async function run() {
    const alive = () => running && !titled;
    mark(0); await show(texs[0], 2200); if (!alive()) return;
    await Deck.sleep(1600);
    for (let n = 1; n < HOPS.length && alive(); n++) {
      const h = HOPS[n];
      mark(n);
      if (h.kind === 'text') {
        cap.classList.add('on'); tween('dim', 1, 600);
        await type(h.text, h.fast ? 150 : 85); if (!alive()) return;
        await Deck.sleep(h.fast ? 450 : 900);
      } else if (h.kind === 'audio') {
        cap.classList.add('on'); tween('dim', 1.4, 600);
        capText.textContent = h.text;
        await speak(7000);
      } else if (h.kind === 'emoji') {
        cap.classList.remove('on'); tween('dim', 1.6, 500);
        await showEmoji(h.text);
      } else {
        cap.classList.add('on'); capText.textContent = '';
        tween('dim', 1.6, 400);
        if (h.code != null) { await flashCode(h.code); if (!alive()) return; } // only steps that wrote code
        cap.classList.remove('on'); tween('dim', 0, 900);
        if (h.kind === 'video') { video.currentTime = 0; video.loop = false; await video.play().catch(() => {}); await show(vtex, 1400); }
        else await show(texs[n], 1500);
        if (!alive()) return;
        await Deck.sleep(h.kind === 'video' ? 3200 : 1800);
      }
    }
    if (alive()) toTitle();
  }

  function toTitle() {
    if (titled) return;
    titled = true;
    cap.classList.remove('on'); emojiEl.classList.remove('on'); codeEl.classList.remove('on'); ring.classList.remove('on');
    audio.pause();
    lis.forEach((li) => li.classList.add('done'));
    video.loop = true; video.play().catch(() => {});
    if (S.a !== vtex) show(vtex, 1400);
    tween('dim', .75, 1500);
    el.classList.add('titled');
    el.querySelectorAll('.scramble').forEach((s, k) => Deck.after(250 + k * 350, () => scramble(s)));
  }

  // waits on a standby screen; first → starts, second skips to title, third moves on
  let started = false;
  Deck.on('cold-open', {
    enter() {
      running = true; titled = false; started = false;
      el.classList.remove('titled'); el.classList.add('standby'); cap.classList.remove('on');
      lis.forEach((li) => li.classList.remove('done', 'now'));
      Object.assign(S, { a: black, b: black, prog: 0, dim: 0 });
      fidBar.style.width = '100%'; fidN.textContent = '100%'; fidEl.classList.remove('low');
      cancelAnimationFrame(S.raf); S.raf = requestAnimationFrame(frame);
    },
    leave() { running = false; cancelAnimationFrame(S.raf); video.pause(); audio.pause(); },
    next() {
      if (!started) { started = true; el.classList.remove('standby'); run(); return true; }
      if (!titled) { toTitle(); return true; }
      return false;
    },
  });
})();
