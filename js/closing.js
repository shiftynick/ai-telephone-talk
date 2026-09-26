/* Closing — Thanks, the three QR codes, and the meetup mascot (the world's voxel pig) waving goodbye.
   Plays by itself; Space → back to the world. The mascot is an ES module loaded on demand: it needs the deck
   served over http (the world does that); opened from file:// the slide simply has no mascot. */
(() => {
  const el = document.getElementById('closing');
  if (!el) return;
  const canvas = el.querySelector('.cl-mascot');
  const cards = [...el.querySelectorAll('.cl-qr')];
  let alive = false, three = null, loading = null, raf = 0, last = 0, t = 0;

  async function load() {
    if (location.protocol === 'file:') throw new Error('modules need http');
    const url = (p) => new URL(p, document.baseURI).href;
    const [THREE, { createMascot }] = await Promise.all([import(url('world/vendor/three/three.module.js')), import(url('world/mascot/mascot.js'))]);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(canvas.width, canvas.height, false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 50);
    camera.position.set(0.3, 0.8, 3.2);
    camera.lookAt(0, 0.52, 0);
    scene.add(new THREE.HemisphereLight(0xfff1e0, 0x2a160e, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 2.5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff5b1f, 2); rim.position.set(-2, 1.5, -2); scene.add(rim);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.1, 40), new THREE.MeshStandardMaterial({ color: 0x1c1512, roughness: 0.9 }));
    base.position.y = -0.05; scene.add(base);
    const mascot = createMascot(THREE, { shadows: false });
    mascot.root.rotation.y = -0.35; // turned a little toward "Thanks."
    scene.add(mascot.root);
    return { renderer, scene, camera, mascot };
  }

  function frame(now) {
    if (!alive || !three) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now; t += dt;
    three.mascot.update(dt);
    three.renderer.render(three.scene, three.camera);
    raf = requestAnimationFrame(frame);
  }

  function choreo() {
    const m = three?.mascot;
    if (!m) return;
    m.play('cheer', { loop: false });
    Deck.after(1800, () => alive && m.play('wave'));
    // then alternate: a little dance, back to waving
    const cycle = (k) => Deck.after(7000, () => { if (!alive) return; m.play(k % 2 ? 'wave' : 'dance'); cycle(k + 1); });
    cycle(0);
  }

  Deck.on('closing', {
    enter() {
      alive = true;
      el.classList.remove('on');
      cards.forEach((c) => c.classList.remove('on'));
      Deck.after(200, () => { el.classList.add('on'); window.SFX?.boom(); });
      cards.forEach((c, k) => Deck.after(1400 + k * 380, () => { c.classList.add('on'); window.SFX?.pop(k + 2); }));
      Deck.after(2700, () => window.SFX?.chime());
      loading ??= load().then((x) => (three = x)).catch(() => null);
      loading.then(() => {
        if (!alive || !three) return;
        last = 0;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
        Deck.after(500, choreo);
      });
    },
    leave() { alive = false; cancelAnimationFrame(raf); },
  });
})();
