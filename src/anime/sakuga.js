/* =============================================================================
   anime/sakuga.js  (content script)   the animation engine of the broadcast (ANIME.md)

   作画: what makes anime look expensive is compositing. A held drawing is alive because everything around it moves: a camera that never
   stops, parallax, ink lines redrawn on twos, an aura that boils, embers, grain. An impact is three frames of burnt ink, a colour split
   and a kick. A real judge is slow (60 s for 28 tests), so a shot that only waits for the next test reads as a frozen picture: the
   stage cuts to its own B-roll, and the heat of the fight drives all of it.

   Two canvases: `shot` under the black bars, `fx` over them, so sparks cross the frame. They exist only while the show is on; one rAF loop;
   nothing else on the page changes. FX is also used alone, over the printed page (manga.js).
============================================================================= */
(() => {
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (x) => Math.max(0, Math.min(1, x));
  const out3 = (p) => 1 - (1 - p) ** 3, out5 = (p) => 1 - (1 - p) ** 5, inOut = (p) => (p < .5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
  const DISPLAY = '"Dela Gothic One", "Inter", sans-serif';
  const seeded = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const mkcv = (w, h) => { const k = document.createElement('canvas'); k.width = Math.ceil(w); k.height = Math.ceil(h); return k; };
  const IMG = new Map();
  const load = (u) => { if (!u) return null; let i = IMG.get(u); if (!i) { i = new Image(); i.src = u; IMG.set(u, i); } return i; };
  const ok = (i) => i && i.complete && i.naturalWidth;
  /* a sprite in one flat colour: silhouettes, rim lights and the aura */
  const SIL = new Map();
  function sil(i, col) {
    const k = i.src ? `${i.src}|${col}` : (i.__k = i.__k || `c${Math.random()}`) + col;
    if (SIL.has(k)) return SIL.get(k);
    const v = mkcv(i.naturalWidth || i.width, i.naturalHeight || i.height), x = v.getContext('2d');
    x.drawImage(i, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, v.width, v.height);
    SIL.set(k, v);
    return v;
  }
  function cover(c, i, W, H, zoom, fx, fy) {
    const s = Math.max(W / i.naturalWidth, H / i.naturalHeight) * zoom, w = i.naturalWidth * s, h = i.naturalHeight * s;
    c.drawImage(i, (W - w) * fx, (H - h) * fy, w, h);
  }
  /* manga focus lines: tapered wedges from a ring, redrawn on twos with a fixed seed per frame, thick and thin */
  function focus(c, cx, cy, r0, far, col, n, frame, alpha = 1) {
    const r = seeded(frame * 7919 + 13);
    c.save(); c.fillStyle = col; c.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, wd = (r() < .16 ? .03 : .007) * (.5 + r()), r1 = r0 * (.82 + r() * .5);
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      c.lineTo(cx + Math.cos(a - wd) * far, cy + Math.sin(a - wd) * far); c.lineTo(cx + Math.cos(a + wd) * far, cy + Math.sin(a + wd) * far); c.closePath(); c.fill();
    }
    c.restore();
  }
  /* speed lines along a direction: tapered, never a hairline */
  function streaks(c, W, H, y0, y1, col, n, t, speed, alpha, dir = -1) {
    const r = seeded(77);
    c.save(); c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const y = y0 + r() * (y1 - y0), len = 120 + r() * 620, th = 1 + r() * 5, sp = speed * (.5 + r()), x = ((r() * (W + len) + dir * t * sp) % (W + len) + W + len) % (W + len) - len;
      c.globalAlpha = alpha * (.3 + r() * .7);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y - th / 2); c.lineTo(x + len, y + th / 2); c.closePath(); c.fill();
    }
    c.restore();
  }
  /* cel fire: long licks with sharp tips that lean and rise, three colours deep, redrawn on twos like a hand-drawn effect */
  function flames(c, W, base, h, cols, t, frame) {
    cols.forEach((col, L) => {
      const r = seeded(31 + L * 11 + (frame % 9) * 3), n = 34 - L * 7, hh = h * (1 - L * .26);
      c.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const x = (i + r() * .8) / n * (W + 120) - 60, wd = 26 + r() * 70, ht = hh * (.3 + r() * r() * .9), lean = (r() - .5) * ht * .8 + Math.sin(t * 3 + i) * 22, curl = (r() - .5) * wd * 2.4;
        c.beginPath(); c.moveTo(x - wd, base + 10);
        c.bezierCurveTo(x - wd * 1.1 + curl, base - ht * .34, x - wd * .1 - curl, base - ht * .66, x + lean, base - ht);
        c.bezierCurveTo(x + wd * .52 - curl, base - ht * .62, x + wd * 1.1 + curl, base - ht * .36, x + wd, base + 10);
        c.closePath(); c.fill();
      }
    });
  }
  function glint(c, x, y, r, col = '#fff', a = 1) {
    c.save(); c.globalAlpha = a; c.fillStyle = col; c.globalCompositeOperation = 'lighter';
    const star = (rx, ry) => { c.beginPath(); for (let i = 0; i < 8; i++) { const R = i % 2 ? r * .08 : (i % 4 ? ry : rx), th = i / 8 * TAU; c.lineTo(x + Math.cos(th) * R * (i % 4 === 0 ? 1 : 1), y + Math.sin(th) * R); } c.closePath(); c.fill(); };
    star(r * 4.6, r); star(r * .9, r * 1.8);
    c.restore();
  }
  function fitFont(c, text, size, maxW, face = DISPLAY) {
    c.font = `400 ${size}px ${face}`;
    const w = c.measureText(text).width;
    if (w > maxW) { size = Math.floor(size * maxW / w); c.font = `400 ${size}px ${face}`; }
    return size;
  }
  /* type that lands: stretched in, an echo left behind, then it holds */
  function stamp(c, text, x, y, size, t, o = {}) {
    if (t < 0) return;
    const p = clamp(t / (o.dur || .1)), s = 1 + (1 - out5(p)) * (o.from || 1.9), a = o.align || 'center';
    c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); c.textAlign = a; c.textBaseline = 'middle'; c.font = o.font || `400 ${size}px ${DISPLAY}`; c.lineJoin = 'round';
    if (p >= 1 && t < .28 && o.echo !== false) { const q = (t - (o.dur || .1)) / .18; c.save(); c.scale(1 + q * .32, 1 + q * .32); c.globalAlpha = (1 - q) * .55; c.fillStyle = o.echoCol || o.fill || '#fff'; c.fillText(text, 0, 0); c.restore(); }
    c.scale(s, s);
    if (o.shadow) { c.fillStyle = o.shadow; c.fillText(text, size * .05, size * .05); }
    if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.sw || size * .1; c.strokeText(text, 0, 0); }
    c.fillStyle = o.fill || '#fff'; c.fillText(text, 0, 0);
    c.restore();
  }
  function jag(c, x0, y0, x1, y1, n, amp, frame) {
    const r = seeded(frame * 131 + 3);
    c.beginPath(); c.moveTo(x0, y0);
    for (let i = 1; i < n; i++) { const p = i / n; c.lineTo(x0 + (x1 - x0) * p + (r() - .5) * amp, y0 + (y1 - y0) * p + (r() - .5) * amp * .4); }
    c.lineTo(x1, y1); c.stroke();
  }

  /* ---- FX: everything that flies, over everything ---------------------------------------------- */
  function FX(cv) {
    const c = cv.getContext('2d'), P = [], R = [], L = [], W = () => cv.width, H = () => cv.height;
    let white = 0, ink = 0;
    const api = {
      sparks(x, y, n, col = '#fff', pow = 1) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(260, 1500) * pow; P.push({ k: 0, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1100, l: rnd(.18, .6), a: 0, s: rnd(1.4, 3.6), col }); } },
      splat(x, y, n, col = '#0c0a10', pow = 1) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(120, 1200) * pow; P.push({ k: 1, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1500, l: rnd(.3, .8), a: 0, s: rnd(2, 15), col }); } },
      embers(n, col, W2, H2, y0 = 0) { for (let i = 0; i < n; i++) P.push({ k: 2, x: rnd(0, W2), y: y0 || H2 + rnd(-40, 20), vx: rnd(-50, 50), vy: -rnd(70, 340), g: -30, l: rnd(.7, 2.2), a: 0, s: rnd(1, 3.2), col, ph: rnd(0, 6) }); },
      petals(n, W2, H2) { for (let i = 0; i < n; i++) P.push({ k: 3, x: W2 + rnd(0, 60), y: rnd(-20, H2), vx: -rnd(180, 620), vy: rnd(10, 130), g: 0, l: rnd(1.2, 3), a: 0, s: rnd(4, 9), col: '#ffc4dc', ph: rnd(0, 6), sp: rnd(2, 7) }); },
      ring(x, y, col = '#fff', pow = 1, w = 16) { R.push({ x, y, col, a: 0, l: .34, r: 900 * pow, w }); },
      lines(x, y, col = '#fff', l = .18) { L.push({ x, y, col, a: 0, l }); },
      flash(a = 1) { white = Math.max(white, a); }, black(a = 1) { ink = Math.max(ink, a); },
      get busy() { return P.length || R.length || L.length || white > .01 || ink > .01; }, count: () => P.length,
      clear() { c.clearRect(0, 0, W(), H()); },
      step(dt, tw) {
        c.clearRect(0, 0, W(), H());
        for (let i = L.length - 1; i >= 0; i--) { const b = L[i]; b.a += dt; if (b.a > b.l) { L.splice(i, 1); continue; } focus(c, b.x, b.y, Math.min(W(), H()) * .22, Math.hypot(W(), H()), b.col, 70, tw, 1 - b.a / b.l); }
        for (let i = R.length - 1; i >= 0; i--) { const b = R[i]; b.a += dt; const p = b.a / b.l; if (p >= 1) { R.splice(i, 1); continue; } c.strokeStyle = b.col; c.globalAlpha = 1 - p; c.lineWidth = b.w * (1 - p) + 1; c.beginPath(); c.arc(b.x, b.y, 30 + out3(p) * b.r, 0, TAU); c.stroke(); c.globalAlpha = 1; }
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i]; p.a += dt; if (p.a > p.l) { P.splice(i, 1); continue; }
          p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          const f = 1 - p.a / p.l;
          c.fillStyle = p.col;
          if (p.k === 0) { const sp = Math.hypot(p.vx, p.vy) || 1, l = Math.min(70, sp * .045), nx = p.vx / sp, ny = p.vy / sp; c.globalAlpha = f; c.beginPath(); c.moveTo(p.x + nx * l, p.y + ny * l); c.lineTo(p.x - ny * p.s, p.y + nx * p.s); c.lineTo(p.x - nx * l * .3, p.y - ny * l * .3); c.lineTo(p.x + ny * p.s, p.y - nx * p.s); c.closePath(); c.fill(); }
          else if (p.k === 1) { c.globalAlpha = 1; c.beginPath(); c.ellipse(p.x, p.y, p.s * f, p.s * f * .74, Math.atan2(p.vy, p.vx), 0, TAU); c.fill(); }
          else if (p.k === 2) { c.globalAlpha = f * (.5 + .5 * Math.sin(p.a * 14 + p.ph)); c.fillRect(p.x + Math.sin(p.a * 3 + p.ph) * 12, p.y, p.s, p.s * 1.7); }
          else { c.globalAlpha = Math.min(1, f * 3) * .92; c.save(); c.translate(p.x, p.y + Math.sin(p.a * 2 + p.ph) * 20); c.rotate(p.a * p.sp); c.scale(1, Math.abs(Math.sin(p.a * p.sp + p.ph)) * .8 + .2); c.beginPath(); c.ellipse(0, 0, p.s, p.s * .56, 0, 0, TAU); c.fill(); c.restore(); }
        }
        c.globalAlpha = 1;
        if (P.length > 700) P.splice(0, P.length - 700);
        if (white > .01) { c.fillStyle = `rgba(255,255,255,${white})`; c.fillRect(0, 0, W(), H()); white *= Math.pow(.0009, dt); }
        if (ink > .01) { c.fillStyle = `rgba(0,0,0,${ink})`; c.fillRect(0, 0, W(), H()); ink *= Math.pow(.002, dt); }
      },
    };
    return api;
  }

  /* an FX layer on its own, for the printed page */
  function overlay(host, z) {
    const cv = mkcv(innerWidth, innerHeight);
    cv.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z || 5}`;
    host.append(cv);
    const fx = FX(cv);
    let raf = 0, last = performance.now(), on = true;
    const loop = (now) => { if (!on) return; const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; fx.step(dt, Math.floor(now / 83)); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    fx.stop = () => { on = false; cancelAnimationFrame(raf); };
    return fx;
  }

  /* ---- the stage ---------------------------------------------------------------------------- */
  function create(frame, top, art, ep) {
    const pics = { wall: load(art.wall), calm: load(art.calm), stand: load(art.stand), strike: load(art.strike), down: load(art.down) };
    const cv = document.createElement('canvas'), fxv = document.createElement('canvas');
    cv.className = 'sk-shot'; fxv.className = 'sk-fx';
    frame.append(cv); top.append(fxv);
    const c = cv.getContext('2d'), fx = FX(fxv), snap = mkcv(8, 8), sn = snap.getContext('2d');
    const tA = mkcv(8, 8), tB = mkcv(8, 8), noise = mkcv(220, 220);
    { const x = noise.getContext('2d'), d = x.createImageData(220, 220); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); }
    let W = 0, H = 0, raf = 0, last = 0, on = false, grainP = null, vig = null;
    const S = { shot: null, t0: 0, seed: 1, trans: null, kick: 0, shake: 0, chroma: 0, burn: 0, heat: 0, band: .74, data: {}, grade: 0, auto: false, lastCut: 0, n: 0 };
    const ACC = () => getComputedStyle(document.documentElement).getPropertyValue('--cf-accent').trim() || '#d6b4fb';
    let accent = '#d6b4fb';
    function size() {
      W = innerWidth; H = innerHeight;
      for (const k of [cv, fxv, snap, tA, tB]) { k.width = W; k.height = H; }
      grainP = c.createPattern(noise, 'repeat');
      vig = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .32, W / 2, H / 2, Math.hypot(W, H) * .56);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.66)');
      accent = ACC();
    }
    const B = () => H * S.band, C = () => H / 2;
    const ember = () => (S.heat > .6 ? '#ff7a3c' : accent);
    function heroAt(i, x, y, h, flip) {
      if (!ok(i)) return 0;
      const w = h * i.naturalWidth / i.naturalHeight;
      c.save(); c.translate(x, y); if (flip) c.scale(-1, 1); c.drawImage(i, 0, 0, w, h); c.restore();
      return w;
    }
    function aura(i, x, y, h, col, amp, tw) {
      if (!ok(i)) return;
      const w = h * i.naturalWidth / i.naturalHeight, s = sil(i, col), r = seeded(tw * 37 + 5);
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .34;
      for (let k = 0; k < 5; k++) { const a = r() * TAU, d = amp * (.5 + r()); c.drawImage(s, x + Math.cos(a) * d, y + Math.sin(a) * d * 1.3 - amp * .5, w, h); }
      c.restore();
    }
    /* the rival's kanji is a drawing, not a font: lit from above, shaded into its own ink, halftone in the shadow, a hard rim of light */
    const KAN = new Map();
    function kanji(size) {
      const k = Math.round(size / 24) * 24;
      if (KAN.has(k)) return KAN.get(k);
      const pad = k * .2, v = mkcv(k * 1.3 + pad * 2, k * 1.3 + pad * 2), x = v.getContext('2d'), cx = v.width / 2, cy = v.height / 2;
      x.font = `400 ${k}px ${DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      x.fillStyle = ep.ink; x.fillText(ep.seal, cx, cy);
      x.globalCompositeOperation = 'source-atop';
      const g = x.createLinearGradient(0, cy - k * .55, 0, cy + k * .55);
      g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(.3, 'rgba(255,255,255,0)'); g.addColorStop(.62, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.62)');
      x.fillStyle = g; x.fillRect(0, 0, v.width, v.height);
      x.fillStyle = 'rgba(0,0,0,.42)'; const p = Math.max(6, k / 42);
      for (let yy = cy + k * .04; yy < cy + k * .62; yy += p) for (let xx = (Math.round(yy / p) % 2) * p / 2; xx < v.width; xx += p) { x.beginPath(); x.arc(xx, yy, p * .44 * clamp((yy - cy) / (k * .56) + .24), 0, TAU); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,.82)'; x.save(); x.translate(cx, cy); x.rotate(-.5); x.fillRect(-k, -k * .38, k * 2, k * .022); x.fillRect(-k, -k * .33, k * 2, k * .008); x.restore();
      x.globalCompositeOperation = 'destination-over'; x.strokeStyle = '#000'; x.lineWidth = k * .1; x.strokeText(ep.seal, cx, cy);
      KAN.set(k, v);
      return v;
    }
    const kan = (x, y, size, t, tw, boil) => {
      const r = seeded(tw * 53 + 9), v = kanji(size), s = size / (Math.round(size / 24) * 24), w = v.width * s, h = v.height * s;
      if (boil) { const g = sil(v, ep.ink); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .26; for (let k = 0; k < 5; k++) c.drawImage(g, x - w / 2 + (r() - .5) * boil, y - h / 2 + (r() - .5) * boil - boil * .3, w, h); c.restore(); }
      c.drawImage(v, x - w / 2, y - h / 2, w, h);
    };

    /* ---- the shots. t: seconds since the cut. Every shot is composed on the band that is open, so a tight frame never crops the subject --- */
    const SHOT = {
      hold() { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); },
      /* the standoff: the wide shot of two figures who won't move */
      stance(t, tw) {
        const b = B(), cy = C(), push = 1.1 + t * .014 + S.heat * .1;
        c.fillStyle = '#05040a'; c.fillRect(0, 0, W, H);
        if (ok(pics.wall)) { c.save(); c.translate(W / 2, cy); c.scale(push, push); c.translate(-W / 2, -cy); cover(c, pics.wall, W, H, 1.06, .5 + Math.sin(t * .2) * .03, .42); c.restore(); }
        c.fillStyle = 'rgba(5,4,10,.5)'; c.fillRect(0, 0, W, H);
        streaks(c, W, H, cy - b / 2, cy + b / 2, '#fff', 22, t, 420, .09);
        const h = b * 1.02, hy = cy - b * .47, hx = W * .1 + Math.sin(t * 1.3) * 3 + t * 5;
        if (S.heat > .08) aura(pics.stand, hx, hy, h, accent, 5 + S.heat * 15, tw);
        if (ok(pics.stand)) { const w = h * pics.stand.naturalWidth / pics.stand.naturalHeight; c.drawImage(sil(pics.stand, accent), hx - 2.5, hy, w, h); c.drawImage(sil(pics.stand, '#07060c'), hx, hy, w, h); glint(c, hx + w * .415, hy + h * .08, 5 + 3 * Math.sin(t * 5), accent, .9); }
        kan(W * .76 - t * 5, cy, b * .66, t, tw, 10 + S.heat * 26);
        flames(c, W, cy + b / 2 + 12, b * (.14 + S.heat * .3), ['#0a0810', '#000'], t, tw);
      },
      /* an extreme close-up: the one shot every fight has */
      eye(t, tw) {
        const i = pics.strike, b = B(), cy = C();
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        if (ok(i)) { const s = Math.max(b / 250, W / 900) * (1 + t * .035), x = W * .56 - 785 * s, y = cy - 165 * s; c.drawImage(i, x, y, i.naturalWidth * s, i.naturalHeight * s); glint(c, W * .56, cy - 5 * s, 8 + Math.sin(t * 11) * 3 + S.heat * 12, '#fff', 1); }
        focus(c, W * .56, cy, b * .62, W, '#000', 60, tw, .92);
        streaks(c, W, H, cy - b / 2, cy + b / 2, accent, 10, t, 900, .32);
      },
      /* the edge: a glint runs the length of the blade */
      blade(t, tw) {
        const i = pics.strike, b = B(), cy = C();
        c.fillStyle = accent; c.fillRect(0, 0, W, H);
        c.save(); c.translate(W / 2, cy); c.rotate(-.2); c.fillStyle = 'rgba(0,0,0,.13)'; for (let k = -24; k < 24; k++) c.fillRect(((k * 110 + t * 190) % 2640) - 1320, -H, 48, H * 2); c.restore();
        focus(c, W * .96, cy - 8, b * .2, W * 1.1, '#fff', 44, tw, .4);
        if (ok(i)) { const s = Math.max(b / 410, W / 1160), x = W * .13 - 690 * s - t * 30, y = cy - 340 * s; aura(i, x, y, 900 * s, '#fff', 3 + S.heat * 8, tw); c.drawImage(i, x, y, i.naturalWidth * s, i.naturalHeight * s); const g = (t * .95) % 1, gx = x + (730 + g * 650) * s, gy = y + (350 - g * g * 44) * s; glint(c, gx, gy, 12 + S.heat * 10, '#fff', 1 - g * .4); }
      },
      /* a card: the test number lands like a blow */
      num(t, tw) {
        const k = S.data.k || S.n, tone = k % 3, bg = ['#000', '#f5f3ee', accent][tone], ink = tone === 2 ? '#0c0a10' : tone ? '#0c0a10' : '#fff', b = B(), cy = C();
        c.fillStyle = bg; c.fillRect(0, 0, W, H);
        c.save(); c.translate(W / 2, cy); c.rotate(-.12); c.font = `400 ${b * .17}px ${DISPLAY}`; c.fillStyle = tone ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.09)'; c.textBaseline = 'middle';
        const str = `TEST ${k}   `.repeat(16), tw0 = c.measureText(`TEST ${k}   `).width;
        [-1, 0, 1].forEach((r) => c.fillText(str, -W * 1.2 + (r === 0 ? t * 260 : -t * 200) % tw0 - tw0, r * b * .36));
        c.restore();
        focus(c, W / 2, cy, b * .44, W, tone ? '#0c0a10' : '#fff', 40 + S.heat * 50, tw, .5 + S.heat * .4);
        const sz = fitFont(c, String(k), b * .84, W * .7);
        stamp(c, String(k), W / 2, cy + sz * .02, sz * (1 + t * .03), t, { fill: ink, shadow: tone === 2 ? '#fff' : accent, dur: .07, from: 2.6, echoCol: tone ? '#0c0a10' : accent });
      },
      /* the rival, burning */
      rival(t, tw) {
        const b = B(), cy = C(), s = 1 + t * .05;
        c.fillStyle = '#04030a'; c.fillRect(0, 0, W, H);
        flames(c, W, cy + b / 2 + 20, b * (.8 + S.heat * .4), ['#1b1329', ep.ink, '#fff', '#04030a'], t, tw);
        focus(c, W / 2, cy, b * .5, W, '#000', 54, tw, .8);
        const jit = S.heat * 3;
        kan(W / 2 + rnd(-jit, jit), cy + rnd(-jit, jit), b * .78 * s, t, tw, 16 + S.heat * 34);
        stamp(c, ep.rival, W * .86, cy + b * .36, Math.max(20, b * .06), t - .12, { fill: '#fff', stroke: '#000', dur: .08, from: .9, echo: false });
      },
      /* a dash on twos: afterimages and a world that streaks */
      run(t, tw) {
        const i = pics.strike, b = B(), cy = C(), h = b * .98;
        c.fillStyle = '#07060c'; c.fillRect(0, 0, W, H);
        if (ok(pics.wall)) { c.globalAlpha = .55; const x = -(t * 2200) % W; c.drawImage(pics.wall, x, 0, W, H); c.drawImage(pics.wall, x + W, 0, W, H); c.globalAlpha = 1; c.fillStyle = 'rgba(5,4,10,.55)'; c.fillRect(0, 0, W, H); }
        streaks(c, W, H, cy - b / 2, cy + b / 2, '#fff', 54, t, 2600, .5);
        streaks(c, W, H, cy - b / 2, cy + b / 2, accent, 24, t, 3300, .7);
        if (ok(i)) {
          const w = h * i.naturalWidth / i.naturalHeight, x = W * .2 + out3(clamp(t / .4)) * W * .08 + Math.sin(tw * 1.9) * 7, y = cy - h * .5 + Math.sin(tw * 2.3) * 4;
          [[-250, .12], [-170, .2], [-90, .34]].forEach(([d, a]) => { c.globalAlpha = a; c.drawImage(sil(i, accent), x + d, y, w, h); }); c.globalAlpha = 1;
          c.drawImage(i, x, y, w, h);
        }
        streaks(c, W, H, cy - b / 2, cy + b / 2, '#000', 16, t, 3800, .9);
      },
      /* the clash: two pictures sliding into each other, lightning on the seam */
      clash(t, tw) {
        const i = pics.strike, b = B(), cy = C(), top = cy - b / 2, bot = cy + b / 2, sl = W * .13, mx = W * .5, a = mx + sl - t * 8, e = mx - sl - t * 8;
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        kan(W * .78 - t * 12, cy, b * .74, t, tw, 12 + S.heat * 26);
        c.save(); c.beginPath(); c.moveTo(0, top - 2); c.lineTo(a, top - 2); c.lineTo(e, bot + 2); c.lineTo(0, bot + 2); c.closePath(); c.clip();
        c.fillStyle = '#f5f3ee'; c.fillRect(0, 0, W, H); focus(c, W * .1, cy, b * .4, W, '#0c0a10', 50, tw, .9);
        if (ok(i)) { const h = b * 1.42, w = h * i.naturalWidth / i.naturalHeight; c.drawImage(i, W * .49 - w + t * 16, cy - h * .39, w, h); }
        c.restore();
        c.strokeStyle = accent; c.lineWidth = 12; c.globalAlpha = .55; jag(c, a, top, e, bot, 12, 34, tw); c.globalAlpha = 1; c.strokeStyle = '#fff'; c.lineWidth = 3.5; jag(c, a, top, e, bot, 12, 34, tw);
        if (tw % 2 === 0 && on) { const p = rnd(0, 1); fx.sparks(a + (e - a) * p, top + b * p, 7, '#fff', .55); }
        stamp(c, '対', W * .49, cy, b * .24, t - .05, { fill: '#fff', stroke: '#000', sw: b * .03, dur: .08, from: 1.4 });
      },
      /* the moon: the hero leaps across it, the whole figure, clouds sliding */
      moon(t, tw) {
        const i = pics.strike, b = B(), cy = C(), R = b * .72;
        c.fillStyle = '#040309'; c.fillRect(0, 0, W, H);
        c.fillStyle = accent; c.beginPath(); c.arc(W * .56, cy + b * .08, R, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(W * .56 + R * .14, cy + b * .02, R * .8, 0, TAU); c.fill();
        [[.14, .24, 1], [.82, .12, -.8], [.42, -.26, .6], [.08, -.3, -.5]].forEach(([x, y, v], k) => { const cx = ((x * W + t * 46 * v) % (W + 500) + W + 500) % (W + 500) - 250, cyy = cy + y * b; c.fillStyle = k % 2 ? '#0f0c18' : '#07060c'; c.beginPath(); c.ellipse(cx, cyy, 300, 26 + k * 7, 0, 0, TAU); c.ellipse(cx + 120, cyy - 22, 170, 22, 0, 0, TAU); c.fill(); });
        if (ok(i)) { const h = b * .96, w = h * i.naturalWidth / i.naturalHeight, x = W * .2 + t * 64, y = cy - h * .5 - Math.sin(clamp(t / 4) * Math.PI) * 18; c.drawImage(sil(i, '#fff'), x + 2.5, y - 2, w, h); c.drawImage(sil(i, '#07060c'), x, y, w, h); glint(c, x + w * .995, y + h * .33, 14 + S.heat * 10, '#fff'); }
      },
      /* ---- scenes ------------------------------------------------------------------------------- */
      /* the title card: ink bursts across black and the scene is inside it; the hero lands; the title is cut into the frame; then the card is cut in two and your page is behind it */
      title(t, tw) {
        const d = S.data, EXIT = 2.05;
        if (t >= EXIT) {
          if (!S.split) { S.split = true; S.noPost = true; sn.globalCompositeOperation = 'copy'; sn.drawImage(cv, 0, 0); }
          const e = inOut(clamp((t - EXIT) / .3)), dx = W * .2;
          c.clearRect(0, 0, W, H);
          for (const q of [-1, 1]) { c.save(); c.translate(q * e * W * .7, q * e * H * .9); c.beginPath(); c.moveTo(W * .5 + dx, 0); c.lineTo(W * .5 - dx, H); c.lineTo(q < 0 ? -W : W * 2, H); c.lineTo(q < 0 ? -W : W * 2, 0); c.closePath(); c.clip(); c.drawImage(snap, 0, 0); c.restore(); }
          return;
        }
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        const cx = W * .62, cy = H * .46, R = out3(clamp((t - .04) / .36)) * Math.hypot(W, H) * .8, r = seeded(5);
        const ph = []; for (let k = 0; k < 18; k++) ph.push([r() * 6, 1 + Math.floor(r() * 5)]);
        c.save(); c.beginPath();
        for (let a = 0; a <= TAU + .01; a += .05) { let q = 1; for (const [o, f] of ph) q += Math.sin(a * f + o) * .055; c.lineTo(cx + Math.cos(a) * R * q, cy + Math.sin(a) * R * q * .8); }
        c.closePath(); c.clip();
        if (ok(pics.wall)) cover(c, pics.wall, W, H, 1.2 - t * .05, .6, .42);
        c.fillStyle = 'rgba(4,3,10,.32)'; c.fillRect(0, 0, W, H);
        c.restore();
        const land = clamp((t - .16) / .13), i = pics.strike;
        if (ok(i) && t > .16) {
          const h = H * 1.04, w = h * i.naturalWidth / i.naturalHeight, x = W * .33 + (1 - out5(land)) * W * .9 - t * 20, y = H * .02 + Math.sin(tw * 1.1) * 1.5;
          if (land >= 1) focus(c, W * .66, H * .34, H * .34, W * 1.2, '#000', 62, tw, .7);
          aura(i, x, y, h, accent, 5 + 8 * Math.sin(t * 8) ** 2, tw);
          c.drawImage(i, x, y, w, h);
          glint(c, x + w * .995, y + h * .33, 20 + Math.sin(t * 13) * 7, '#fff');
        }
        const slab = out5(clamp((t - .26) / .16));
        c.fillStyle = '#05040a'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W * .5 * slab, 0); c.lineTo(W * .38 * slab, H); c.lineTo(0, H); c.closePath(); c.fill();
        c.fillStyle = accent; c.beginPath(); c.moveTo(W * .5 * slab, 0); c.lineTo(W * .508 * slab, 0); c.lineTo(W * .388 * slab, H); c.lineTo(W * .38 * slab, H); c.closePath(); c.fill();
        const x0 = W * .05, mw = W * .36;
        stamp(c, `Episode ${d.tag}`, x0, H * .3, 22, t - .36, { align: 'left', font: '700 22px Inter, sans-serif', fill: accent, from: .35, echo: false });
        /* the title: a blade runs along it and leaves the letters behind */
        const lines = []; let size = fitFont(c, d.name, Math.min(H * .1, 76), mw * 2.1), cur = '';
        c.font = `400 ${size}px ${DISPLAY}`;
        for (const wd of d.name.split(' ')) { if (c.measureText(`${cur} ${wd}`).width > mw && cur) { lines.push(cur); cur = wd; } else cur = cur ? `${cur} ${wd}` : wd; }
        lines.push(cur);
        const rev = clamp((t - .44) / .34), ly = size * 1.14, top = H * .36 + ly / 2, wide = Math.max(...lines.map((l) => c.measureText(l).width));
        c.save(); c.beginPath(); c.rect(x0 - 4, top - ly, (wide + 12) * out3(rev), ly * (lines.length + 1)); c.clip();
        c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = accent; lines.forEach((l, k) => c.fillText(l, x0 + 4, top + k * ly + 4)); c.fillStyle = '#fff'; lines.forEach((l, k) => c.fillText(l, x0, top + k * ly));
        c.restore();
        if (rev > 0 && rev < 1) { c.fillStyle = '#fff'; const ex = x0 + (wide + 12) * out3(rev); c.fillRect(ex, top - ly, 3, ly * (lines.length + .6)); glint(c, ex, top - ly / 2, 20, '#fff'); }
        const sweep = (t - 1.24) / .4;
        if (sweep > 0 && sweep < 1) { c.save(); c.beginPath(); c.rect(x0 - 4, top - ly, wide + 12, ly * (lines.length + 1)); c.clip(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,.72)'; const gx = x0 - 90 + sweep * (wide + 180); c.beginPath(); c.moveTo(gx, top + ly * lines.length); c.lineTo(gx + 46, top + ly * lines.length); c.lineTo(gx + 136, top - ly); c.lineTo(gx + 90, top - ly); c.closePath(); c.fill(); c.restore(); }
        const ry = top + lines.length * ly + 8;
        stamp(c, `Tonight's rival: ${d.rival}`, x0, ry - 8, 20, t - .86, { align: 'left', font: '600 20px Inter, sans-serif', fill: '#e6e2ec', from: .25, echo: false });
        if (d.rating) stamp(c, String(d.rating), x0, ry + 30, 36, t - .96, { align: 'left', fill: ep.ink, from: 1, echo: false });
        const sz = Math.min(H * .1, 92), ch = [...d.jp];
        ch.forEach((q, k) => stamp(c, q, W * .92, H * .5 + (k - (ch.length - 1) / 2) * sz * 1.08, sz, t - .62 - k * .08, { fill: '#fff', stroke: '#000', sw: sz * .14, dur: .07, from: 1.5 }));
      },
      launch(t, tw) {
        const b = H * .46, cy = C(), p = out3(clamp(t / .13)), e = clamp((t - .62) / .1);
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        c.save(); c.translate(0, cy); c.scale(1, p * (1 - e)); c.translate(0, -cy);
        c.beginPath(); c.moveTo(0, cy - b / 2 + 34); c.lineTo(W, cy - b / 2 - 34); c.lineTo(W, cy + b / 2 - 34); c.lineTo(0, cy + b / 2 + 34); c.closePath(); c.clip();
        c.fillStyle = accent; c.fillRect(0, 0, W, H);
        streaks(c, W, H, cy - b / 2 - 40, cy + b / 2 + 40, '#fff', 40, t, 3400, .75); streaks(c, W, H, cy - b / 2 - 40, cy + b / 2 + 40, '#0c0a10', 18, t, 4200, .85);
        const i = pics.strike;
        if (ok(i)) { const h = b * 1.5, w = h * i.naturalWidth / i.naturalHeight, x = -w + out5(clamp(t / .24)) * (w + W * .02) + t * 60; c.drawImage(sil(i, '#fff'), x - 90, cy - h * .46, w, h); c.drawImage(i, x, cy - h * .46, w, h); }
        c.restore();
        const sz = fitFont(c, 'いざ勝負', b * .58, W * .42);
        if (e <= 0) stamp(c, 'いざ勝負', W * .73, cy, sz, t - .17, { fill: '#fff', stroke: '#000', sw: sz * .13, shadow: '#000', dur: .07, from: 2.4, rot: -.05 });
      },
      /* iai: a line of light; the two have passed; nothing; then the rival comes apart */
      iai(t, tw) {
        const cy = C(), b = H * .7, cutAt = .92, g = clamp((t - cutAt) / .22);
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        if (t < .2) { const p = out5(t / .2); c.fillStyle = '#fff'; c.fillRect(W / 2 - p * W, cy - 1.5, p * 2 * W, 3); glint(c, W / 2, cy, 12 + p * 20, '#fff'); return; }
        const i = pics.strike, sz = b * .8;
        if (ok(i)) { const h = b * .9, w = h * i.naturalWidth / i.naturalHeight; heroAt(i, W * .46 + t * 14, cy - h * .46, h); }
        const off = g * b * .3, slope = -.34;
        for (const s of [-1, 1]) {
          c.save(); c.beginPath();
          const yy = (x) => cy + (x - W * .3) * slope + s * off;
          c.moveTo(-100, yy(-100)); c.lineTo(W, yy(W)); c.lineTo(W, s < 0 ? -H : H * 2); c.lineTo(-100, s < 0 ? -H : H * 2); c.closePath(); c.clip();
          c.translate(s * off * .8, s * off * .5); kan(W * .3, cy, sz, t, tw, g ? 0 : 6);
          c.restore();
        }
        if (t < cutAt + .1) { c.strokeStyle = '#fff'; c.lineWidth = g ? 6 : 1.4; c.beginPath(); c.moveTo(-10, cy + (-10 - W * .3) * slope); c.lineTo(W * .62, cy + (W * .32) * slope); c.stroke(); }
      },
      /* wrong answer: the frame stops dead and the colour goes out of it */
      tbc(t, tw) {
        const b = B(), cy = C(), d = clamp((t - .1) / .26);
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        if (ok(pics.wall)) { c.save(); c.filter = `grayscale(${d}) sepia(${d * .42}) contrast(${1 + d * .2})`; c.translate(W / 2, cy); c.rotate(-.028 * d); c.scale(1.1, 1.1); c.translate(-W / 2, -cy); cover(c, pics.wall, W, H, 1.1, .5, .4); c.restore(); }
        const i = pics.down;
        if (ok(i)) { c.save(); c.filter = `grayscale(${d}) sepia(${d * .42}) contrast(1.12)`; const h = b * .94, w = h * i.naturalWidth / i.naturalHeight; c.translate(W * .24, cy - h * .48); c.rotate(-.028 * d); c.drawImage(i, 0, 0, w, h); c.restore(); }
        c.fillStyle = `rgba(0,0,0,${.3 * d})`; c.fillRect(0, 0, W, H);
        const r = seeded((tw >> 1) * 19 + 2); c.fillStyle = 'rgba(235,225,200,.5)'; for (let k = 0; k < 7; k++) c.fillRect(r() * W, 0, 1 + r() * 1.6, H);
        const sz = fitFont(c, 'つづく', b * .34, W * .46);
        stamp(c, 'つづく', W * .71, cy + b * .08, sz, t - .34, { fill: '#fff', stroke: '#000', sw: sz * .16, dur: .08, from: 2.2, rot: -.05 });
        stamp(c, 'To be continued', W * .79, cy + b * .33, 22, t - .5, { fill: '#fff', stroke: '#000', sw: 6, font: '800 22px Inter, sans-serif', from: .4, echo: false });
      },
      /* a time lapse: the sun drops, the stars come out, the shadows race */
      lapse(t, tw) {
        const b = B(), cy = C(), p = clamp(t / 1.5), e = inOut(p);
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        if (ok(pics.wall)) { c.save(); c.filter = `brightness(${1 - e * .52}) saturate(${1 - e * .34})`; cover(c, pics.wall, W, H, 1.1 + e * .05, .5, .4); c.restore(); }
        c.fillStyle = `rgba(14,18,64,${e * .46})`; c.fillRect(0, 0, W, H);
        const sx = W * (.12 + e * .8), sy = cy + b * .42 - Math.sin(e * Math.PI) * b * .8;
        c.fillStyle = '#fff6d6'; c.beginPath(); c.arc(sx, sy, 34, 0, TAU); c.fill(); glint(c, sx, sy, 24, '#fff6d6', 1 - e * .4);
        streaks(c, W, H, cy - b / 2, cy, '#fff', 12, t * (1 + e), 2100, .14);
        const r = seeded(9); c.fillStyle = '#fff'; for (let k = 0; k < 120; k++) { const x = r() * W, y = cy - b / 2 + r() * b * .6, a = clamp(e * 2 - r() * 1.2); c.globalAlpha = a * (.5 + .5 * Math.sin(t * 9 + k)); c.fillRect(x, y, 2, 2); } c.globalAlpha = 1;
        const i = pics.stand;
        if (ok(i)) { const h = b, w = h * i.naturalWidth / i.naturalHeight, x = W * .13, y = cy - h * .5; c.drawImage(sil(i, '#b9c6ff'), x + 2.5, y - 1, w, h); c.drawImage(sil(i, '#090812'), x, y, w, h); }
        /* the rival doesn't wait: its kanji drains away while the stars come out */
        c.save(); c.globalAlpha = 1 - clamp((t - .5) / .55); kan(W * .74, cy, b * .5, t, tw, 0); c.restore();
        if (e >= 1) { const q = (t - 1.5) * .9, bx = W * (1.04 - q * .62), by = cy - b * .22 + Math.sin(q * 5) * 14, fl = Math.sin(t * 17) * 8; c.strokeStyle = '#060510'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx - 14, by + fl); c.quadraticCurveTo(bx - 6, by - 3, bx, by); c.quadraticCurveTo(bx + 6, by - 3, bx + 14, by + fl); c.stroke(); }
        const skip = S.data.spent || '';
        if (t < 1.25) { c.save(); c.globalAlpha = clamp(t / .1) * (1 - clamp((t - 1.05) / .2)); stamp(c, '数時間後', W / 2, cy - 20, Math.min(b * .22, 100), t - .02, { fill: '#fff', stroke: '#000', sw: 12, echo: false, from: .6 }); stamp(c, skip, W / 2, cy + Math.min(b * .22, 100) * .72, 24, t - .16, { fill: '#fff', stroke: '#000', sw: 6, font: 'italic 600 24px Inter, sans-serif', from: .3, echo: false }); c.restore(); }
        else { const sz = Math.min(b * .19, 90), wr = ['シ', 'ー', 'ン']; wr.forEach((ch, k) => stamp(c, ch, W * .78, cy - sz * 1.1 + k * sz * 1.1, sz, t - 1.3 - k * .16, { fill: '#f5f3ee', dur: .12, from: .7, echo: false })); }
      },
      /* a power reading: the numbers climb, the lens gives */
      scouter(t, tw) {
        const b = B(), cy = C(), R = b * .44, cx = W / 2, p = clamp(t / 1.1), over = t > 1.1, col = over ? '#ff3c4c' : '#5dffa2', goal = S.data.goal || 262144, sh = over ? rnd(-6, 6) : 0;
        c.fillStyle = '#020806'; c.fillRect(0, 0, W, H);
        c.strokeStyle = col; c.globalAlpha = .13; c.lineWidth = 1; for (let k = 0; k < W; k += 46) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, H); c.stroke(); } for (let k = 0; k < H; k += 46) { c.beginPath(); c.moveTo(0, k); c.lineTo(W, k); c.stroke(); } c.globalAlpha = 1;
        kan(cx + sh, cy, R * 1.25 * (1 + p * p * .55), t, tw, 8 + p * 36);
        c.fillStyle = 'rgba(0,8,6,.62)'; c.fillRect(0, 0, W, H);
        c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(cx + sh, cy, R, 0, TAU); c.stroke(); c.lineWidth = 2;
        c.save(); c.translate(cx + sh, cy); c.rotate(t * (over ? 9 : 1.4)); for (let k = 0; k < 4; k++) { c.rotate(TAU / 4); c.beginPath(); c.arc(0, 0, R * 1.1, .15, .9); c.stroke(); } c.restore();
        c.beginPath(); c.moveTo(cx - R * 1.32, cy); c.lineTo(cx - R * .8, cy); c.moveTo(cx + R * .8, cy); c.lineTo(cx + R * 1.32, cy); c.stroke();
        for (let k = 0; k < 16; k++) { const x = W * .07, y = cy - b * .4 + k * b * .053, v = (tw * (k + 3) * 2731) % 99991; c.font = '500 13px "JetBrains Mono", monospace'; c.fillStyle = col; c.globalAlpha = .5; c.textAlign = 'left'; c.fillText(`0x${(v * 37).toString(16).padStart(5, '0')} ${(v % 1000)}`, x, y); c.fillText(`${(v * 11).toString(36).slice(0, 7)}`, W * .84, y); } c.globalAlpha = 1;
        const val = Math.round(goal * p * p).toLocaleString('en-US'), sz = fitFont(c, val, Math.min(b * .15, 76), R * 1.7);
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 8; c.strokeStyle = '#000'; c.strokeText(val, cx + sh, cy); c.fillStyle = col; c.fillText(val, cx + sh, cy);
        c.font = '700 16px Inter, sans-serif'; c.fillText(over ? 'OVER THE LIMIT' : 'KB', cx + sh, cy + sz * .85);
        if (over) { const r = seeded(21); c.strokeStyle = '#fff'; c.lineWidth = 2.5; for (let k = 0; k < 9; k++) { let x = cx + 24, y = cy - 14, a = r() * TAU; c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 6; q++) { a += (r() - .5) * .9; const l = (28 + r() * 80) * clamp((t - 1.1) * 12); x += Math.cos(a) * l; y += Math.sin(a) * l; c.lineTo(x, y); } c.stroke(); } }
      },
      /* a broadcast accident: the picture tears, then the card every viewer knows */
      glitch(t, tw) {
        const cut = .55, b = B(), cy = C();
        if (t < cut) {
          const i = pics.wall; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
          if (ok(i)) cover(c, i, W, H, 1.1, .5, .4);
          const r = seeded(tw * 17 + 1);
          for (let k = 0; k < 16; k++) { const y = r() * H, h = 6 + r() * 60; c.drawImage(cv, 0, y, W, h, (r() - .5) * 220 * (t / cut + .3), y, W, h); }
          ['#ff0040', '#00ffe0', '#fff200', '#2040ff'].forEach((col) => { c.fillStyle = col; c.globalAlpha = .7; c.fillRect(0, r() * H, W, 3 + r() * 16); }); c.globalAlpha = 1;
          c.globalAlpha = .4 + t; c.fillStyle = grainP || '#888'; c.save(); c.translate(r() * 220, r() * 220); c.scale(2.4, 2.4); c.fillRect(-300, -300, W, H); c.restore(); c.globalAlpha = 1;
          return;
        }
        const T = t - cut, i = pics.calm;
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        const sq = out5(clamp(T / .14));
        c.save(); c.translate(0, cy); c.scale(1, Math.max(.006, sq)); c.translate(0, -cy);
        if (ok(i)) cover(c, i, W, H, 1.05 + T * .012, .5, .45); else { c.fillStyle = '#3a6'; c.fillRect(0, 0, W, H); }
        c.restore();
        if (sq >= .99) { const sz = fitFont(c, 'しばらくお待ちください', Math.min(b * .13, 62), W * .74); stamp(c, 'しばらくお待ちください', W / 2, cy - 12, sz, T - .2, { fill: '#fff', stroke: 'rgba(0,0,0,.8)', sw: 12, dur: .1, from: .3, echo: false }); stamp(c, 'Please stand by', W / 2, cy + sz * .9, 22, T - .34, { fill: '#fff', stroke: 'rgba(0,0,0,.8)', sw: 6, font: '700 22px Inter, sans-serif', from: .2, echo: false }); }
      },
    };
    const KINDS = ['slash', 'shutter', 'whip', 'iris'];
    function drawTrans(tr, now) {
      const p = clamp((now - tr.t0) / tr.d);
      if (p >= 1) { S.trans = null; return; }
      const e = inOut(p);
      if (tr.kind === 'slash') {
        const dx = W * .24;
        for (const q of [-1, 1]) {
          c.save(); c.translate(q * e * W * .55, q * e * H * .75);
          c.beginPath(); c.moveTo(W * .5 + dx, 0); c.lineTo(W * .5 - dx, H); c.lineTo(q < 0 ? -W : W * 2, H); c.lineTo(q < 0 ? -W : W * 2, 0); c.closePath(); c.clip();
          c.drawImage(snap, 0, 0); c.restore();
        }
        c.strokeStyle = '#fff'; c.lineWidth = 9 * (1 - p) + 1; c.beginPath(); c.moveTo(W * .5 + dx * 2, -H); c.lineTo(W * .5 - dx * 2, H * 2); c.stroke();
      } else if (tr.kind === 'shutter') {
        const n = 9, h = H / n;
        for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1, de = inOut(clamp(p * 1.5 - i * .05)); c.drawImage(snap, 0, i * h, W, h + 1, s * de * W * 1.04, i * h, W, h + 1); }
      } else if (tr.kind === 'whip') {
        c.drawImage(snap, -e * W, 0);
        streaks(c, W, H, 0, H, '#fff', 60, now / 1000, 3000, Math.sin(p * Math.PI) * .9);
      } else {
        c.save(); c.beginPath(); c.rect(0, 0, W, H); c.arc(W / 2, H / 2, e * Math.hypot(W, H) * .6, 0, TAU, true); c.clip('evenodd'); c.drawImage(snap, 0, 0); c.restore();
        c.strokeStyle = accent; c.lineWidth = 10; c.beginPath(); c.arc(W / 2, H / 2, e * Math.hypot(W, H) * .6, 0, TAU); c.stroke();
      }
    }
    function chromaPass(a) {
      const dx = 4 + a * 22, ra = tA.getContext('2d'), rb = tB.getContext('2d');
      ra.globalCompositeOperation = 'source-over'; ra.drawImage(cv, 0, 0); ra.globalCompositeOperation = 'multiply'; ra.fillStyle = '#f00'; ra.fillRect(0, 0, W, H);
      rb.globalCompositeOperation = 'source-over'; rb.drawImage(cv, 0, 0); rb.globalCompositeOperation = 'multiply'; rb.fillStyle = '#0ff'; rb.fillRect(0, 0, W, H);
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'lighter'; c.drawImage(tA, -dx, 0); c.drawImage(tB, dx, 0); c.globalCompositeOperation = 'source-over';
    }
    function loop(now) {
      if (!on) return;
      const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now;
      const t = (now - S.t0) / 1000, tw = Math.floor(now / 83);           // ink on twos: 12 drawings a second, the camera at full rate
      /* an un-prompted cut: a slow judge must never leave a frozen picture */
      if (S.auto && now - S.lastCut > 1500 - S.heat * 700) { const k = S.cycle[(S.bro = (S.bro || 0) + 1) % S.cycle.length]; api.cut(k, { soft: true }); if (S.onSoft) S.onSoft(); }
      if (S.auto && Math.random() < .35 + S.heat) fx.embers(1, ember(), W, H);
      if (S.auto && Math.random() < .12) fx.petals(1, W, H);
      c.setTransform(1, 0, 0, 1, 0, 0);
      S.shake *= Math.pow(.003, dt); S.kick *= Math.pow(.0009, dt); S.chroma *= Math.pow(.000012, dt);
      const pulse = S.auto ? Math.max(0, Math.sin(now / 190 * (1 + S.heat))) ** 12 * .012 * (S.heat + .2) : 0;
      const z = 1 + S.kick + pulse + (S.auto ? .02 + Math.sin(now / 1900) * .006 : 0), sx = rnd(-1, 1) * S.shake, sy = rnd(-1, 1) * S.shake;
      c.save();
      c.translate(W / 2 + sx, H / 2 + sy); c.scale(z, z); c.rotate(S.shake * .00028 * rnd(-1, 1)); c.translate(-W / 2, -H / 2);
      if (S.shot && SHOT[S.shot]) SHOT[S.shot](t, tw); else c.clearRect(0, 0, W, H);
      c.restore();
      if (S.trans) drawTrans(S.trans, now);
      if (S.burn > 0 && S.shot) { S.burn--; c.save(); c.filter = S.burn % 2 ? 'grayscale(1) contrast(9) invert(1)' : 'grayscale(1) contrast(9)'; c.drawImage(cv, 0, 0); c.restore(); if (S.burnFocus) { focus(c, W / 2, H / 2, Math.min(W, H) * .2, Math.hypot(W, H), S.burn % 2 ? '#000' : '#fff', 74, tw); } }
      if (S.chroma > .03 && S.shot) chromaPass(S.chroma);
      if (S.shot && !S.noPost) {
        c.fillStyle = vig; c.fillRect(0, 0, W, H);
        if (grainP) { c.save(); c.globalAlpha = .075; c.translate(rnd(0, 220), rnd(0, 220)); c.fillStyle = grainP; c.fillRect(-220, -220, W + 440, H + 440); c.restore(); }
      }
      fx.step(dt, tw);
      raf = requestAnimationFrame(loop);
    }
    const api = {
      fx, get W() { return W; }, get H() { return H; },
      start() { if (on) return; size(); on = true; last = performance.now(); S.lastCut = last; raf = requestAnimationFrame(loop); },
      stop() { on = false; cancelAnimationFrame(raf); c.clearRect(0, 0, W, H); fx.clear(); S.shot = null; S.auto = false; S.trans = null; S.split = false; S.noPost = false; },
      blank() { S.shot = null; S.trans = null; c.clearRect(0, 0, W, H); },
      wall(u) { if (u) pics.wall = load(u); },
      onSoft(f) { S.onSoft = f; },
      heat(v) { S.heat = v; }, band(v) { S.band = v; }, auto(v, cycle) { S.auto = v; if (cycle) S.cycle = cycle; }, data(o) { Object.assign(S.data, o); },
      /* a cut: the old picture is split, shuttered, whipped or irised away */
      cut(name, o = {}) {
        const now = performance.now();
        if (S.shot && on) { sn.globalCompositeOperation = 'copy'; sn.drawImage(cv, 0, 0); S.trans = { kind: o.kind || KINDS[Math.floor(Math.random() * KINDS.length)], t0: now, d: o.soft ? .24e3 : .2e3 }; } else S.trans = null;
        S.shot = name; S.t0 = now; S.lastCut = now;
        cv.dataset.shot = name;
        if (o.k) { S.data.k = o.k; S.n = o.k; }
        if (o.hard) S.trans = null;
      },
      /* a blow: three burnt frames, a colour split, a kick, sparks across the bars */
      impact(pow = 1, o = {}) {
        S.shake = Math.max(S.shake, 26 * pow); S.kick = Math.max(S.kick, .05 * pow); S.chroma = Math.min(1, S.chroma + pow);
        if (o.burn !== false) { S.burn = o.burn || 3; S.burnFocus = o.lines !== false; }
        fx.ring(o.x || W / 2, o.y || H / 2, o.col || '#fff', .9 + pow * .6);
        fx.sparks(o.x || W / 2, o.y || H / 2, Math.round(36 * pow), o.spark || '#fff', 1 + pow * .2);
        fx.sparks(o.x || W / 2, o.y || H / 2, Math.round(18 * pow), accent, .8);
      },
      accent: () => accent,
    };
    return api;
  }
  async function ready() { try { await Promise.all([document.fonts.load(`400 80px ${DISPLAY}`, '対勝負完'), document.fonts.load('600 20px Inter')]); } catch (e) { /* the fallback face will do */ } }
  globalThis.__cftsSakuga = { create, overlay, ready, focus, flames, glint, stamp, load, ok, sil, cover, fitFont, out3, out5, clamp, rnd, streaks };
})();
