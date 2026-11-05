/* =============================================================================
   pixel/shatter.js  (content script)   the killing blow wrecks the interface (PIXEL.md)
   Real damage, not a transition: the page stays standing and gets blasted open. Holes burn through it onto the monster's own
   land, with charred, glowing edges; the words around a blast shake loose and fall, buttons tear off, chunks of the windows fly.
   Then every piece flies home, the holes close and the real page is underneath, never touched.

   THE WEAPON FOLLOWS THE LAND, so the same thing never plays twice:
     glass   The Meadow (to 1300)     an arrow; cracks race out; the wave tears every window into shards; a pile of rubble
     storm   Twilight Woods (to 1800) the sky goes dark; lightning strikes the monster and the page around it; craters
     meteor  Ember Peaks (to 2300)    a rain of fire; holes that keep burning outwards, embers, smoke
     beam    The Dark Keep (2400+)    the hero charges a beam; it cuts the page in two; the halves slide apart and fall

   THE PAGE IS REDRAWN, NOT CAPTURED. A content script can't read tab pixels; the elements and words on screen are painted from
   their computed styles and Range rects, boxes on one canvas and text on another, so a word can leave and the box stay (the idea
   comes from studying destroy.spritefusion.com with REA; no code or asset of it is used). Monaco is another process: it sends its
   lines. The real page stays visible until the first flash, so the repaint is only ever seen damaged.

   COST. Nothing exists between moments. One stage, one rAF loop, removed at the end, a timer removes it if frames stop. Pieces,
   holes, particles and elements are capped; the simulation runs at a fixed step, so it can be seeked (px:shatter-seek, tests).
============================================================================= */
(() => {
  const STEP = 1 / 120, G = 2100, Z = 2147482600, MAX_EL = 5000, MAX_WORDS = 3500, MAX_PIECES = 190, MAX_PARTS = 620, MAX_CHIPS = 150, MAX_HOLES = 12;
  const T = { word: 1.25, rebuild: 3.1, rebuildDur: .62, end: 3.85 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const inOut = (p) => (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const IMG = new Map();
  function preload(urls) { for (const u of urls) if (!IMG.has(u)) { const i = new Image(); i.src = u; IMG.set(u, i); } }
  const skipPaint = /^(SCRIPT|STYLE|LINK|META|HEAD|TITLE|NOSCRIPT|TEMPLATE)$/;

  /* ---- the repaint -------------------------------------------------------------------------------------------- */
  function repaint(W, H, dpr, editor) {
    const cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.imageSmoothingEnabled = false;
    const tv = document.createElement('canvas');
    tv.width = W * dpr; tv.height = H * dpr;
    const t = tv.getContext('2d');
    t.scale(dpr, dpr);
    t.textBaseline = 'alphabetic';
    const found = [];
    const range = document.createRange(), metrics = new Map();
    /* spelled out: canvas ignores a shorthand it can't parse and keeps the last font, without a word */
    const fontOf = (cs) => `${cs.fontStyle === 'normal' ? '' : cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    let els = 0, words = 0;
    const metric = (font) => {
      let m = metrics.get(font);
      if (!m) { c.font = font; const t = c.measureText('Mg'); m = { a: t.fontBoundingBoxAscent || 12, d: t.fontBoundingBoxDescent || 4 }; metrics.set(font, m); }
      return m;
    };
    const urlOf = (s) => { const m = /url\("?([^")]+)"?\)/.exec(s); return m ? m[1] : ''; };
    const imageOf = (u) => { if (!u) return null; let i = IMG.get(u); if (!i) { i = new Image(); i.src = u; IMG.set(u, i); } return i.complete && i.naturalWidth ? i : null; };
    function bgImage(el, cs, r) {
      const img = imageOf(urlOf(cs.backgroundImage));
      if (!img) return;
      const sx = r.width / (el.offsetWidth || r.width || 1), sy = r.height / (el.offsetHeight || r.height || 1);
      const [bw, bh] = cs.backgroundSize.split(' ').map(parseFloat);
      const w = bw || img.naturalWidth, h = bh || (w * img.naturalHeight / img.naturalWidth);
      const pos = cs.backgroundPosition.split(' ');
      const at = (s, box, size) => (s.endsWith('%') ? (box - size) * parseFloat(s) / 100 : parseFloat(s) || 0);
      const x = at(pos[0] || '0', el.offsetWidth, w), y = at(pos[1] || '0', el.offsetHeight, h);
      c.save(); c.beginPath(); c.rect(r.left, r.top, r.width, r.height); c.clip();
      c.translate(r.left, r.top); c.scale(sx, sy);
      const rep = cs.backgroundRepeat;
      const nx = /repeat-y|no-repeat/.test(rep) ? 1 : Math.ceil(el.offsetWidth / w) + 2, ny = /repeat-x|no-repeat/.test(rep) ? 1 : Math.ceil(el.offsetHeight / h) + 2;
      const x0 = nx > 1 ? (x % w) - w : x, y0 = ny > 1 ? (y % h) - h : y;
      for (let i = 0; i < nx; i++) for (let k = 0; k < ny; k++) c.drawImage(img, x0 + i * w, y0 + k * h, w, h);
      c.restore();
    }
    function borders(cs, r) {
      for (const [s, x, y, w, h] of [['Top', 0, 0, 1, 0], ['Bottom', 0, 1, 1, 0], ['Left', 0, 0, 0, 1], ['Right', 1, 0, 0, 1]]) {
        const bw = parseFloat(cs[`border${s}Width`]);
        if (!bw || cs[`border${s}Style`] === 'none') continue;
        c.fillStyle = cs[`border${s}Color`];
        c.fillRect(r.left + x * (r.width - bw), r.top + y * (r.height - bw), w ? r.width : bw, h ? r.height : bw);
      }
    }
    /* the bevels of a window: inset shadows, hard ones only */
    function insets(cs, r) {
      if (cs.boxShadow === 'none' || !cs.boxShadow.includes('inset')) return;
      for (const m of cs.boxShadow.matchAll(/(rgba?\([^)]+\)) (-?\d+)px (-?\d+)px 0px(?: 0px)? inset/g)) {
        const [, col, a, b] = m, x = +a, y = +b;
        c.fillStyle = col;
        if (y) c.fillRect(r.left, y > 0 ? r.top : r.bottom + y, r.width, Math.abs(y));
        if (x) c.fillRect(x > 0 ? r.left : r.right + x, r.top, Math.abs(x), r.height);
      }
    }
    function text(node, cs, clip) {
      const s = node.nodeValue;
      if (!s.trim()) return;
      const font = fontOf(cs), tf = cs.textTransform, m = metric(font);
      t.font = font;
      t.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      t.fillStyle = cs.webkitTextFillColor || cs.color;
      for (const w of s.matchAll(/\S+/g)) {
        if (++words > MAX_WORDS) return;
        range.setStart(node, w.index); range.setEnd(node, w.index + w[0].length);
        const r = range.getClientRects()[0];
        if (!r || r.bottom < clip.t || r.top > clip.b || r.right < clip.l || r.left > clip.r) continue;
        t.fillText(tf === 'uppercase' ? w[0].toUpperCase() : w[0], r.left, r.top + (r.height - (m.a + m.d)) / 2 + m.a);
        found.push({ x: r.left, y: r.top, w: r.width, h: r.height });
      }
    }
    function walk(el, clip, alpha) {
      if (++els > MAX_EL || skipPaint.test(el.tagName)) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      const r = el.getBoundingClientRect();
      const a = alpha * parseFloat(cs.opacity);
      if (a <= .02) return;
      const vis = cs.visibility === 'visible';
      const inView = r.bottom > clip.t && r.top < clip.b && r.right > clip.l && r.left < clip.r;
      c.globalAlpha = a;
      if (vis && inView && r.width && r.height) {
        const bg = cs.backgroundColor;
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') { c.fillStyle = bg; c.fillRect(r.left, r.top, r.width, r.height); }
        if (cs.backgroundImage !== 'none') bgImage(el, cs, r);
        insets(cs, r); borders(cs, r);
        if (el.tagName === 'IMG' && el.complete && el.naturalWidth) { try { c.drawImage(el, r.left, r.top, r.width, r.height); } catch (e) { /* a broken image */ } }
        if (el.tagName === 'CANVAS') { try { c.drawImage(el, r.left, r.top, r.width, r.height); } catch (e) { /* zero size */ } }
        if (el.tagName === 'SELECT' && el.selectedOptions[0]) { c.font = fontOf(cs); c.fillStyle = cs.color; c.fillText(el.selectedOptions[0].textContent.trim(), r.left + 10, r.top + r.height / 2 + 5); }
        if (el.tagName === 'INPUT' && el.value && !/hidden|checkbox|radio|file/.test(el.type)) { c.font = fontOf(cs); c.fillStyle = cs.color; c.fillText(el.value, r.left + 10, r.top + r.height / 2 + 5); }
        if (el.tagName === 'IFRAME' && editor) paintEditor(r);
      }
      if (el.tagName === 'IFRAME') return;
      let inner = clip, clipped = false;
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.clipPath !== 'none') {
        inner = { l: Math.max(clip.l, r.left), t: Math.max(clip.t, r.top), r: Math.min(clip.r, r.right), b: Math.min(clip.b, r.bottom) };
        if (inner.l >= inner.r || inner.t >= inner.b) return;
        for (const x of [c, t]) { x.save(); x.beginPath(); x.rect(inner.l, inner.t, inner.r - inner.l, inner.b - inner.t); x.clip(); }
        clipped = true;
      }
      for (const n of el.childNodes) {
        if (n.nodeType === 1) walk(n, inner, a);
        else if (n.nodeType === 3 && vis && inView) { t.globalAlpha = a; text(n, cs, inner); }
      }
      if (clipped) { c.restore(); t.restore(); }
    }
    /* Monaco's own lines, in its own colours */
    function paintEditor(r) {
      c.save(); c.beginPath(); c.rect(r.left, r.top, r.width, r.height); c.clip();
      c.fillStyle = editor.bg || '#14121e'; c.fillRect(r.left, r.top, r.width, r.height);
      c.restore();
      t.save(); t.beginPath(); t.rect(r.left, r.top, r.width, r.height); t.clip();
      t.font = `${editor.size || 14}px "JetBrains Mono", monospace`;
      t.letterSpacing = '0px';
      for (const s of editor.spans || []) { t.fillStyle = s.c; t.fillText(s.t, r.left + s.x, r.top + s.y); found.push({ x: r.left + s.x, y: r.top + s.y - 14, w: t.measureText(s.t).width, h: 18 }); }
      t.restore();
    }
    const rootCs = getComputedStyle(document.documentElement);
    c.fillStyle = rootCs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? rootCs.backgroundColor : '#14121e';
    c.fillRect(0, 0, W, H);
    if (rootCs.backgroundImage !== 'none') bgImage(document.documentElement, rootCs, { left: 0, top: 0, width: W, height: H });
    const view = { l: 0, t: 0, r: W, b: H };
    for (const n of document.body.children) walk(n, view, 1);
    return { pg: cv, tx: tv, words: found };
  }

  /* ---- the fracture ------------------------------------------------------------------------------------------- */
  /* the windows on screen, smallest wins nothing: each box breaks on its own, the rest of the page is one more box */
  function plates(W, H) {
    const out = [], sel = '#px-hud, .px-head2, .px-scroll, .px-arena, .px-cmd2, .px-edwrap, .px-loghead, .px-log, .px-win, .px-side > .roundbox, #pageContent, #sidebar > .roundbox, #header, .menu-box';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const b = { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(W, r.right) - Math.max(0, r.left), h: Math.min(H, r.bottom) - Math.max(0, r.top) };
      if (b.w < 24 || b.h < 16) continue;
      if (out.some((o) => b.x >= o.x - 1 && b.y >= o.y - 1 && b.x + b.w <= o.x + o.w + 1 && b.y + b.h <= o.y + o.h + 1)) continue;   // inside a window already
      out.push(b);
    }
    return out;
  }
  /* cut a convex polygon by the half plane nearer to a than to b (Sutherland-Hodgman, one edge) */
  function cut(poly, ax, ay, bx, by) {
    const mx = (ax + bx) / 2, my = (ay + by) / 2, nx = bx - ax, ny = by - ay, out = [];
    const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
      if (sp <= 0) out.push(p);
      if (sp < 0 !== sq < 0 && sp !== sq) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  }
  function fracture(boxes, ix, iy, W, H) {
    const polys = [], total = boxes.reduce((a, b) => a + b.w * b.h, 0) + 1;
    for (const b of boxes) {
      const thin = b.h < 72 && b.w > b.h * 5;
      if (thin) {                               // a bar snaps into lengths, hinged at the ends
        const n = Math.max(2, Math.min(5, Math.round(b.w / 280)));
        for (let i = 0; i < n; i++) {
          const x0 = b.x + b.w * i / n, x1 = b.x + b.w * (i + 1) / n, sk = rnd(-14, 14), sk0 = i ? polys.lastSk : 0;
          polys.push({ pts: [[x0 + sk0, b.y], [x1 + sk, b.y], [x1 - sk, b.y + b.h], [x0 - sk0, b.y + b.h]], bar: i === 0 ? 'l' : i === n - 1 ? 'r' : '' });
          polys.lastSk = sk;
        }
        continue;
      }
      const n = Math.max(3, Math.round(MAX_PIECES * .9 * (b.w * b.h) / total));
      const seeds = [];
      for (let i = 0; i < n * 3 && seeds.length < n; i++) {
        const x = b.x + Math.random() * b.w, y = b.y + Math.random() * b.h, d = Math.hypot(x - ix, y - iy) / Math.hypot(W, H);
        if (Math.random() < 1.08 - d * 1.5) seeds.push([x, y]);     // finer near the blow
      }
      for (let i = 0; i < seeds.length; i++) {
        let poly = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
        for (let k = 0; k < seeds.length && poly.length; k++) if (k !== i) poly = cut(poly, seeds[i][0], seeds[i][1], seeds[k][0], seeds[k][1]);
        if (poly.length > 2) polys.push({ pts: poly });
      }
    }
    return polys;
  }
  /* a piece: the bitmap through its polygon, its edges stepped through a 1/3 mask */
  function piece(p, bmp, dpr, ix, iy, mask, mc) {
    const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]);
    const x0 = Math.floor(Math.min(...xs)), y0 = Math.floor(Math.min(...ys)), w = Math.ceil(Math.max(...xs)) - x0 + 1, h = Math.ceil(Math.max(...ys)) - y0 + 1;
    if (w < 3 || h < 3) return null;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    const c = cv.getContext('2d');
    c.drawImage(bmp, x0 * dpr, y0 * dpr, cv.width, cv.height, 0, 0, cv.width, cv.height);
    const mw = Math.ceil(w / 3) + 1, mh = Math.ceil(h / 3) + 1;
    mask.width = mw; mask.height = mh;
    mc.fillStyle = '#000'; mc.beginPath();
    p.pts.forEach((q, i) => { const X = (q[0] - x0) / 3, Y = (q[1] - y0) / 3; if (i) mc.lineTo(X, Y); else mc.moveTo(X, Y); });
    mc.closePath(); mc.fill();
    c.globalCompositeOperation = 'destination-in';
    c.imageSmoothingEnabled = false;
    c.drawImage(mask, 0, 0, mw * 3 * dpr, mh * 3 * dpr);
    const cx = x0 + w / 2, cy = y0 + h / 2, path = new Path2D();
    p.pts.forEach((q, i) => { if (i) path.lineTo(q[0] - cx, q[1] - cy); else path.moveTo(q[0] - cx, q[1] - cy); });
    path.closePath();
    const d = Math.hypot(cx - ix, cy - iy) || 1;
    return { cv, path, w, h, hx: cx, hy: cy, x: cx, y: cy, rot: 0, tx: 0, ty: 0, vx: 0, vy: 0, vr: 0, vtx: 0, vty: 0, d, ux: (cx - ix) / d, uy: (cy - iy) / d, on: false, rest: false, bar: p.bar, area: w * h };
  }
  function cracks(ix, iy, W, H) {
    const segs = [], reach = Math.hypot(Math.max(ix, W - ix), Math.max(iy, H - iy));
    const grow = (x, y, a, len, gen, dist) => {
      while (len > 0) {
        const s = rnd(18, 46); a += rnd(-.34, .34);
        const nx = x + Math.cos(a) * s, ny = y + Math.sin(a) * s;
        segs.push([x, y, nx, ny, dist / reach, gen]);
        dist += s; len -= s; x = nx; y = ny;
        if (gen < 2 && Math.random() < (gen ? .1 : .17)) grow(x, y, a + (Math.random() < .5 ? -1 : 1) * rnd(.5, 1.1), len * rnd(.25, .5), gen + 1, dist);
      }
    };
    const n = 13;
    for (let i = 0; i < n; i++) grow(ix, iy, i / n * Math.PI * 2 + rnd(-.2, .2), reach * rnd(.55, 1.08), 0, 0);
    return segs.sort((a, b) => a[4] - b[4]);
  }

  /* the world behind the interface: the monster's land, the sky running on above it */
  function world(W, H, land, opts) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { alpha: false });
    c.imageSmoothingEnabled = false;
    const img = IMG.get(opts.landUrl(land)), SC = 4, lw = 320 * SC, lh = 72 * SC, y0 = H - lh;
    if (img && img.complete && img.naturalWidth) {
      /* the sky: the scene's own bands, stretched over everything above it */
      c.drawImage(img, 8, 0, 1, 26, 0, 0, W, Math.max(1, y0 + 2));       // one clean column: no moon or cloud smeared up the sky
      for (let x = (W % lw) / 2 - lw; x < W; x += lw) c.drawImage(img, x, y0, lw, lh);
    } else { c.fillStyle = '#1a1533'; c.fillRect(0, 0, W, H); }
    /* the shards fly over it (dimmed); a crater looks straight through to it (vivid) */
    if (opts.dim) { c.fillStyle = 'rgba(9,8,15,.34)'; c.fillRect(0, 0, W, H); }
    return { cv, floor: H - 66 };
  }

  /* ---- damage ------------------------------------------------------------------------------------------------- */
  /* a crater's outline: harmonics, so no two are the same circle, stepped to the grid */
  function outline(h, r) {
    const pts = [], n = Math.max(40, Math.round(r / 3));
    for (let i = 0; i < n; i++) {
      const th = i / n * 6.2832, k = 1 + h.v * (.6 * Math.sin(3 * th + h.a) + .4 * Math.sin(7 * th + h.b) + .25 * Math.sin(13 * th + h.c));
      pts.push([Math.round((h.x + Math.cos(th) * r * k) / 4) * 4, Math.round((h.y + Math.sin(th) * r * k * h.sq) / 4) * 4]);
    }
    return pts;
  }
  const pathOf = (pts) => { const p = new Path2D(); pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); return p; };

  /* the page and its holes, redrawn only when something changed */
  function pageLayer(W, H, dpr) {
    const cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    return { cv, c: cv.getContext('2d') };
  }
  function drawPage(L, S, dpr) {
    const c = L.c;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, L.cv.width, L.cv.height);
    c.drawImage(S.pg, 0, 0); c.drawImage(S.tx, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const h of S.holes) {
      const r = h.r * S.heal;
      if (r < 3) continue;
      const p = pathOf(outline(h, r));
      /* scorched: darkened paper round the hole, on the page only */
      c.globalCompositeOperation = 'source-atop';
      c.strokeStyle = 'rgba(14,8,12,.34)'; c.lineWidth = r * .34; c.stroke(p);
      c.strokeStyle = 'rgba(14,8,12,.62)'; c.lineWidth = 16; c.stroke(p);
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000'; c.fill(p);
      c.globalCompositeOperation = 'source-atop';
      c.strokeStyle = h.rim || '#ff8a2a'; c.lineWidth = 14; c.stroke(p);
      c.strokeStyle = '#ffe9a8'; c.lineWidth = 5; c.stroke(p);
    }
    c.globalCompositeOperation = 'source-over';
  }

  /* ---- the moment ---------------------------------------------------------------------------------------------- */
  let live = null;
  const MODE = ['glass', 'storm', 'meteor', 'beam'];
  function play(o) {
    if (live || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 1.5);
    const ix = o.x, iy = o.y, mode = o.mode || MODE[o.land] || 'glass';
    const t0p = performance.now();
    const rp = repaint(W, H, dpr, o.editor);
    const paintMs = performance.now() - t0p;
    const bg = world(W, H, o.land, Object.assign({ dim: mode === 'glass' }, o));
    const stage = document.createElement('div');
    stage.id = 'px-break'; stage.setAttribute('aria-hidden', 'true'); stage.setAttribute('data-cfts', '');
    stage.dataset.mode = mode;
    stage.style.cssText = `position:fixed;inset:0;z-index:${Z};overflow:hidden;cursor:pointer`;
    const cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    stage.append(cv);
    document.documentElement.append(stage);
    const c = cv.getContext('2d');
    const L = pageLayer(W, H, dpr);
    const props = [...document.querySelectorAll('.px-btn, .px-tabs a, .px-nav a, .px-lang, .px-plate2, .px-logo, .px-frame, .px-tool, .px-mbtn, .px-head2 h1, .px-loghead, #px-hud input.search, .px-flags img')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W).map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
    const S = { t: 0, sim: 0, mode, pg: rp.pg, tx: rp.tx, txc: rp.tx.getContext('2d'), pgc: rp.pg.getContext('2d'), words: rp.words, props, pieces: [], chips: [], parts: [], streaks: [], holes: [], rings: [], bolts: [], rocks: [], smoke: [], heal: 1, dirty: true, wholeGone: false, opened: false, floor: new Float32Array(Math.ceil(W / 16) + 2), trauma: .5, flash: 0, dark: 0, stop: 0, last: performance.now(), raf: 0, done: false, frames: 0, slow: 0, wordAt: 0, sounds: 0, landed: 0, rebuilt: false, halves: null, sched: [] };
    live = S;
    const FLOOR = mode === 'glass' ? bg.floor : H - 6;
    const rock = (x, y, n, col, sp, up = .3) => { for (let i = 0; i < n && S.parts.length < MAX_PARTS; i++) { const a = rnd(0, 6.28), v = rnd(.15, 1) * sp; S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * up, l: rnd(.4, 1.2), a: 0, col: col[(Math.random() * col.length) | 0], s: Math.random() < .22 ? 6 : Math.random() < .6 ? 3 : 2 }); } };
    const SPARK = ['#fff2c2', '#ffcd75', '#ef7d57', o.ink || '#ffffff'], DUST = ['#4e4870', '#2a2640', '#6a6488'], FIRE = ['#fff2c2', '#ffcd75', '#ef7d57', '#b13e53'], ICE = ['#ffffff', '#bfe4ff', '#6ca6ff', '#4a7dff'];
    const at = (t, f) => S.sched.push([t, f]);
    const hero = o.heroImg();

    /* a loose thing: a rectangle of a layer, lifted off it, physical from now on */
    function lift(src, r, kind, power, fromx, fromy) {
      if (S.chips.length >= MAX_CHIPS) return;
      const w = Math.ceil(r.w) + 2, h = Math.ceil(r.h) + 2;
      const k = document.createElement('canvas');
      k.width = Math.ceil(w * dpr); k.height = Math.ceil(h * dpr);
      const x = k.getContext('2d');
      for (const l of src) x.drawImage(l, r.x * dpr, r.y * dpr, k.width, k.height, 0, 0, k.width, k.height);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, d = Math.hypot(cx - fromx, cy - fromy) || 1;
      S.chips.push({ cv: k, w, h, hx: cx, hy: cy, x: cx, y: cy, rot: 0, tx: 0, vx: (cx - fromx) / d * power + rnd(-60, 60), vy: (cy - fromy) / d * power - rnd(80, 300), vr: rnd(-6, 6), vtx: rnd(-5, 5), kind, on: true, rest: false });
    }
    /* a blast: the hole, what it throws out, and what it shakes loose around it */
    function blast(x, y, R, o2 = {}) {
      S.dirty = true;
      if (S.holes.length < MAX_HOLES) {
        const h = { x, y, r: 0, to: R, grow: o2.grow || 9, creep: o2.creep || 0, v: rnd(.14, .24), sq: o2.sq || rnd(.82, 1.05), a: rnd(0, 6), b: rnd(0, 6), c: rnd(0, 6), rim: o2.rim };
        S.holes.push(h);
      }
      /* the rim breaks away: wedges of the window itself, cut from what is on screen now */
      const mask = document.createElement('canvas'), mc = mask.getContext('2d');
      const n = o2.wedges == null ? 12 : o2.wedges;
      drawPage(L, S, dpr);
      for (let i = 0; i < n && S.pieces.length < MAX_PIECES; i++) {
        const a0 = i / n * 6.283 + rnd(-.1, .1), a1 = a0 + 6.283 / n * rnd(.7, 1.1), r0 = R * rnd(.7, .9), r1 = R * rnd(1.08, 1.45);
        const pts = [[x + Math.cos(a0) * r0, y + Math.sin(a0) * r0], [x + Math.cos(a0) * r1, y + Math.sin(a0) * r1], [x + Math.cos(a1) * r1, y + Math.sin(a1) * r1], [x + Math.cos(a1) * r0, y + Math.sin(a1) * r0]];
        const p = piece({ pts }, L.cv, dpr, x, y, mask, mc);
        if (!p) continue;
        p.on = true; const f = rnd(420, 1100);
        p.vx = p.ux * f; p.vy = p.uy * f - rnd(120, 420); p.vr = rnd(-7, 7); p.vtx = rnd(-5, 5); p.vty = rnd(-5, 5);
        S.pieces.push(p);
      }
      if (S.holes.length) S.holes[S.holes.length - 1].to = R * 1.2;
      /* the words: inside the blast they are gone; around it, some shake loose */
      for (const w of S.words) {
        if (w.gone) continue;
        const d = Math.hypot(w.x + w.w / 2 - x, w.y + w.h / 2 - y);
        if (d < R * .95) { w.gone = true; S.txc.clearRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2); }
        else if (d < R * 2.3 && Math.random() < 1.05 - d / (R * 2.3)) { w.gone = true; lift([S.tx], w, 'word', 420 + 900 * R / (d + 40), x, y); S.txc.clearRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2); }
      }
      /* buttons and labels tear off, leaving a gap where they were */
      for (const r of S.props) {
        if (r.gone) continue;
        const d = Math.hypot(r.x + r.w / 2 - x, r.y + r.h / 2 - y);
        if (d < R * 2.1) {
          r.gone = true; lift([S.pg, S.tx], r, 'prop', 500 + 1000 * R / (d + 60), x, y);
          for (const l of [S.pgc, S.txc]) l.clearRect(r.x, r.y, r.w, r.h);
        }
      }
      for (let i = 0; i < 90; i++) { const a = rnd(0, 6.283), r = R * rnd(.9, 1.25); S.streaks.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, a, len: rnd(20, 120) * (1 + R / 200), l: rnd(.18, .5), t: 0, col: o2.ice ? '#bfe4ff' : Math.random() < .3 ? '#ffcd75' : '#b9b3c8' }); }
      rock(x, y, Math.min(120, R), o2.ice ? ICE : FIRE, 1000 + R * 2);
      for (let i = 0; i < 8; i++) S.smoke.push({ x: x + rnd(-R, R) * .6, y: y + rnd(-R, R) * .6, r: rnd(14, 40), vy: rnd(-90, -30), a: 0, l: rnd(.8, 1.8) });
      S.rings.push({ t: S.t, x, y, big: R / 90 });
      S.trauma = Math.min(1, S.trauma + .55); S.flash = Math.max(S.flash, o2.flash == null ? .55 : o2.flash); S.stop = .05;
      o.sound(o2.snd || 'boom');
      S.opened = true;
    }
    /* the monster dies when the weapon arrives, never before */
    let dead = false;
    const kill = () => { if (!dead) { dead = true; if (o.onHit) o.onHit(); } };
    /* ---- the scripts ---- */
    let crackAt = 0, crk = null, arrow = null;
    if (mode === 'glass') {
      arrow = { x0: o.hx, y0: o.hy, t0: 0, t1: .26 };
      o.sound('shoot');
      at(.26, () => { kill(); rock(ix, iy, 90, SPARK, 980); S.flash = .35; S.trauma = .8; S.rings.push({ t: S.t, x: ix, y: iy, big: 1 }); crackAt = S.t; crk = cracks(ix, iy, W, H); o.sound('crackle'); });
      at(.62, () => {
        const mask = document.createElement('canvas'), mc = mask.getContext('2d');
        drawPage(L, S, dpr);
        const polys = fracture(plates(W, H), ix, iy, W, H).slice(0, MAX_PIECES + 40);
        S.pieces = polys.map((p) => piece(p, L.cv, dpr, ix, iy, mask, mc)).filter(Boolean);
        S.wholeGone = true; S.opened = true; S.flash = 1; S.trauma = 1; S.brk = S.t; S.rings.push({ t: S.t, x: ix, y: iy, big: 2 });
        o.sound('smash'); rock(ix, iy, 170, SPARK, 1500);
      });
    } else if (mode === 'storm') {
      o.sound('thunder');
      S.dark = 1;
      const hits = [[ix, iy, 190], [ix - W * .36, iy + H * .28, 130], [ix - W * .12, iy - H * .02 + 300, 110], [Math.max(120, ix - W * .5), H * .2, 120]];
      hits.forEach(([x, y, R], i) => at(.32 + i * .24, () => { if (!i) kill(); S.bolts.push({ x, y, t: S.t, seed: Math.random() }); blast(x, Math.max(60, Math.min(H - 60, y)), R, { ice: true, rim: '#7fb8ff', snd: i ? 'boom' : 'thunderclap', flash: .75 }); }));
    } else if (mode === 'meteor') {
      o.sound('rumble');
      const fall = [[ix, iy, 170, .42], [ix - W * .3, H * .3, 120, .62], [ix - W * .08, H * .72, 130, .78], [ix - W * .5, H * .68, 110, .92], [W * .12, H * .22, 100, 1.04], [ix + 40, H * .85, 105, 1.14]];
      for (const [x, y, R, t] of fall) {
        S.rocks.push({ x, y, t0: t - .3, t1: t, sx: x + 460 + rnd(-40, 80), sy: -80, s: R / 6 });
        at(t, () => { kill(); blast(Math.max(40, Math.min(W - 40, x)), y, R, { creep: 26, rim: '#ff6a2a', snd: 'boom', flash: .4 }); });
      }
    } else {                     // the beam
      o.sound('charge');
      S.beam = { x: o.hx, y: o.hy, on: .46, hit: .58, off: .92 };
      const dx = ix - o.hx, dy = iy - o.hy, len = Math.hypot(dx, dy) || 1;
      S.beam.ux = dx / len; S.beam.uy = dy / len;
      S.beam.len = len;
      at(.46, () => { o.sound('beam'); S.trauma = .7; });
      at(.58, () => { kill(); S.flash = .7; S.trauma = 1; rock(ix, iy, 120, ['#ffffff', '#e4d2ff', '#a56bff'], 1300); S.rings.push({ t: S.t, x: ix, y: iy, big: 1.2 }); });
      at(.74, () => {
        blast(ix, iy, 200, { rim: '#b58cff', snd: 'smash', flash: 1, wedges: 16 });
        drawPage(L, S, dpr);
        /* the cut: the page in two along the beam's line */
        const nx = -S.beam.uy, ny = S.beam.ux, far = W + H;
        const a = [o.hx - S.beam.ux * far, o.hy - S.beam.uy * far], b = [o.hx + S.beam.ux * far, o.hy + S.beam.uy * far];
        const half = (s) => { const p = new Path2D(); p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); p.lineTo(b[0] + nx * s * far, b[1] + ny * s * far); p.lineTo(a[0] + nx * s * far, a[1] + ny * s * far); p.closePath(); return p; };
        const snap = document.createElement('canvas'); snap.width = L.cv.width; snap.height = L.cv.height; snap.getContext('2d').drawImage(L.cv, 0, 0);
        S.halves = [{ path: half(1), cv: snap, s: 1, nx, ny, vx: nx * 180, vy: ny * 180 + 40, x: 0, y: 0, rot: 0, vr: .10 }, { path: half(-1), cv: snap, s: -1, nx, ny, vx: -nx * 180, vy: -ny * 180 + 40, x: 0, y: 0, rot: 0, vr: -.08 }];
        S.opened = true;
      });
    }
    const timeScale = () => (S.stop > 0 ? .04 : mode === 'glass' && S.brk ? (S.t < S.brk + .6 ? .26 : Math.min(1, .26 + (S.t - S.brk - .6) * 2.2)) : 1);
    function fly(p, d, cell) { p.y = FLOOR - S.floor[cell]; }
    function physics(p, d) {
      p.vy += G * d;
      p.x += p.vx * d; p.y += p.vy * d; p.rot += p.vr * d; p.tx += (p.vtx || 0) * d; if (p.ty != null) p.ty += (p.vty || 0) * d;
      if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx) * .4; } else if (p.x > W) { p.x = W; p.vx = -Math.abs(p.vx) * .4; }
      const cell = Math.max(0, Math.min(S.floor.length - 1, (p.x / 16) | 0));
      if (p.y > FLOOR - S.floor[cell]) {
        fly(p, d, cell);
        if (Math.abs(p.vy) > 260 && p.w * p.h > 500) { rock(p.x, p.y, 4, DUST, 140, .5); if (S.landed++ % 7 === 0 && S.sounds < 9) { S.sounds++; o.sound('clack'); } }
        p.vy *= -.28; p.vx *= .6; p.vr *= .5; p.vtx *= .5; if (p.vty) p.vty *= .5;
        if (Math.abs(p.vy) < 90) {
          p.rest = true; p.vx = p.vy = 0; p.rot = rnd(-.25, .25);
          if (p.ty != null) { p.tx = Math.round(p.tx / 6.2832) * 6.2832 + rnd(-.25, .25); p.ty = Math.round(p.ty / 6.2832) * 6.2832 + rnd(.7, 1.15); }
          const add = Math.min(8, Math.sqrt(p.w * p.h) * .08);
          for (let i = -1; i <= 1; i++) if (S.floor[cell + i] !== undefined) S.floor[cell + i] = Math.min(120, S.floor[cell + i] + add * (i ? .55 : 1));
        }
      }
    }
    function step(dt) {
      S.t += dt;
      const t = S.t;
      for (let i = S.sched.length - 1; i >= 0; i--) if (t >= S.sched[i][0]) { const f = S.sched[i][1]; S.sched.splice(i, 1); f(); }
      const k = timeScale(), d = dt * k;
      S.stop = Math.max(0, S.stop - dt);
      S.sim += d;
      S.trauma = Math.max(0, S.trauma - dt * 1.4);
      S.flash = Math.max(0, S.flash - dt * 4.5);
      if (S.dark) S.dark = t < 1.5 ? 1 : Math.max(0, 1 - (t - 1.5) * 2);
      for (const h of S.holes) {
        if (h.r < h.to) { h.r = Math.min(h.to, h.r + (h.to - h.r) * Math.min(1, dt * h.grow * 2) + 2); S.dirty = true; }
        else if (h.creep && !S.rebuilt) { h.r += h.creep * dt; h.to = h.r; S.dirtyT = (S.dirtyT || 0) + dt; if (S.dirtyT > .03 * S.holes.length) { S.dirtyT = 0; S.dirty = true; } if (Math.random() < .5) rock(h.x + Math.cos(t * 9 + h.a) * h.r, h.y + Math.sin(t * 9 + h.a) * h.r, 1, FIRE, 160, 1.2); }
      }
      if (!S.rebuilt) {
        const wave = S.brk ? (t - S.brk) * 2300 : 0;
        for (const p of S.pieces) {
          if (p.rest) continue;
          if (S.wholeGone && !p.on) {
            if (p.d > wave) continue;
            p.on = true;
            const f = 1250 / (1 + p.d / 300) + rnd(0, 240);
            p.vx = p.ux * f + rnd(-90, 90); p.vy = p.uy * f - rnd(140, 420); p.vr = rnd(-5, 5) * (1 + 60 / (p.w + p.h)); p.vtx = rnd(-4.5, 4.5); p.vty = rnd(-4.5, 4.5);
            if (p.bar) { p.hang = rnd(.55, 1.1); p.px = p.bar === 'l' ? p.hx - p.w / 2 : p.hx + p.w / 2; p.py = p.hy - p.h / 2; p.L = Math.hypot(p.hx - p.px, p.hy - p.py); p.th = Math.atan2(p.hy - p.py, p.hx - p.px); p.om = 0; }
            if (S.parts.length < MAX_PARTS - 8) rock(p.x, p.y, 3, DUST, 180);
          }
          if (!p.on) continue;
          if (p.hang > 0) {
            p.hang -= d;
            p.om += (G / (p.L || 1)) * Math.cos(p.th) * d * .9; p.om *= 1 - d * 1.1; p.th += p.om * d;
            p.x = p.px + Math.cos(p.th) * p.L; p.y = p.py + Math.sin(p.th) * p.L;
            p.rot = p.th - Math.atan2(p.hy - p.py, p.hx - p.px);
            if (p.hang <= 0) { p.vx = -Math.sin(p.th) * p.om * p.L * .6; p.vy = Math.cos(p.th) * p.om * p.L * .6; }
            continue;
          }
          physics(p, d);
        }
        for (const p of S.chips) if (!p.rest) physics(p, d);
        if (S.halves) for (const h of S.halves) { const g = t > 1.2 ? G * .5 : 0; h.vy += g * d; h.x += h.vx * d; h.y += h.vy * d; h.rot += h.vr * d; h.vx *= 1 - d * 1.4; }
      }
      if (t >= T.rebuild && !S.rebuilt) {
        S.rebuilt = true; o.sound('rebuild');
        const all = S.pieces.concat(S.chips), far = Math.max(...all.map((p) => p.d || 400), 1);
        for (const p of all) { p.fx = p.x; p.fy = p.y; p.fr = p.rot % 6.2832; p.ftx = p.tx % 6.2832; p.fty = (p.ty || 0) % 6.2832; p.delay = (1 - (p.d || 400) / far) * .22; }
        if (S.halves) for (const h of S.halves) { h.fx = h.x; h.fy = h.y; h.fr = h.rot; }
      }
      if (S.rebuilt) {
        const u = clamp01((t - T.rebuild) / T.rebuildDur);
        S.heal = 1 - inOut(u); S.dirty = true;
        for (const p of S.pieces.concat(S.chips)) {
          const q = inOut(clamp01((t - T.rebuild - p.delay) / (T.rebuildDur - .22)));
          p.x = p.fx + (p.hx - p.fx) * q; p.y = p.fy + (p.hy - p.fy) * q - Math.sin(q * Math.PI) * 70; p.rot = p.fr * (1 - q); p.tx = p.ftx * (1 - q); if (p.ty != null) p.ty = p.fty * (1 - q);
        }
        if (S.halves) for (const h of S.halves) { const q = 1 - inOut(u); h.x = h.fx * q; h.y = h.fy * q; h.rot = h.fr * q; }
      }
      for (const a of S.parts) { a.a += d; a.vy += G * .7 * d; a.x += a.vx * d; a.y += a.vy * d; if (a.y > FLOOR) { a.y = FLOOR; a.vy *= -.3; a.vx *= .5; } }
      if (S.parts.length && S.frames % 12 === 0) S.parts = S.parts.filter((a) => a.a < a.l);
      for (const a of S.streaks) a.t += d;
      if (S.streaks.length && S.frames % 12 === 0) S.streaks = S.streaks.filter((a) => a.t < a.l);
      for (const a of S.smoke) { a.a += d; a.y += a.vy * d; a.r += 26 * d; }
      if (S.smoke.length && S.frames % 12 === 0) S.smoke = S.smoke.filter((a) => a.a < a.l);
      if (t >= T.word && !S.wordAt) { S.wordAt = t; S.trauma = Math.max(S.trauma, .5); o.sound(o.first ? 'flawless' : 'victory'); }
    }
    /* ---- drawing ---- */
    let crDone = 0;
    const crackCv = document.createElement('canvas');
    crackCv.width = W; crackCv.height = H;
    const cc = crackCv.getContext('2d');
    function drawCracks() {
      const reach = clamp01((S.t - crackAt) / .34);
      while (crDone < crk.length && crk[crDone][4] <= reach) {
        const [x0, y0, x1, y1, , gen] = crk[crDone++];
        const q = (v) => Math.round(v / 2) * 2, n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
        for (let i = 0; i <= n; i++) {
          const x = q(x0 + (x1 - x0) * i / n), y = q(y0 + (y1 - y0) * i / n), s = gen ? 2 : 4;
          cc.fillStyle = '#05040a'; cc.fillRect(x, y, s, s);
          cc.fillStyle = 'rgba(255,255,255,.55)'; cc.fillRect(x - 2, y - 2, 2, 2);
        }
      }
    }
    function drawPiece(p, on) {
      const cx = Math.cos(p.tx), cy = Math.cos(p.ty), sx = Math.max(.08, Math.abs(cx)), sy = Math.max(.08, Math.abs(cy));
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      if (on) { const tk = 5 * (1 - sx * sy) + 2; c.save(); c.scale(sx, sy); c.translate(Math.sign(cx) * tk, Math.sign(cy) * tk); c.fillStyle = '#09080f'; c.fill(p.path); c.restore(); }
      c.scale(sx, sy);
      c.drawImage(p.cv, -p.w / 2, -p.h / 2, p.w, p.h);
      const dim = on ? (cx * cy < 0 ? .5 : 0) + (1 - sx * sy) * .3 + (p.rest && !S.rebuilt ? .16 : 0) : 0;
      if (dim > .04) { c.fillStyle = `rgba(9,8,15,${Math.min(.72, dim).toFixed(2)})`; c.fill(p.path); }
      c.restore();
    }
    function drawChip(p) {
      const sx = Math.max(.15, Math.abs(Math.cos(p.tx)));
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(sx, 1);
      if (p.kind === 'prop') { c.fillStyle = '#09080f'; c.fillRect(-p.w / 2 + 3, -p.h / 2 + 3, p.w, p.h); }
      c.drawImage(p.cv, -p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    }
    function bolt(b) {
      const a = S.t - b.t;
      if (a > .22) return;
      const flick = Math.sin(a * 90) > -.2, top = -20;
      if (!flick) return;
      let x = b.x + 120 * (b.seed - .5) + 60, y = top;
      const pts = [[x, y]], n = 14;
      for (let i = 1; i <= n; i++) { y = top + (b.y - top) * i / n; x = b.x + (x - b.x) * .72 + Math.sin((i + b.seed * 40) * 12.9) * 34 * (1 - i / n); pts.push([x, y]); }
      for (const [col, w] of [['rgba(74,125,255,.35)', 26], ['#6ca6ff', 11], ['#bfe4ff', 6], ['#ffffff', 3]]) {
        c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'miter'; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
      }
      /* the orb where it lands */
      const R = 54 * (1 - a * 2.4);
      for (const [col, r] of [['rgba(74,125,255,.5)', 1.5], ['#6ca6ff', 1], ['#e8f3ff', .55]]) { c.fillStyle = col; c.beginPath(); c.arc(b.x, b.y, R * r, 0, 6.3); c.fill(); }
    }
    function meteors(t) {
      for (const m of S.rocks) {
        if (t < m.t0 || t > m.t1) continue;
        const q = (t - m.t0) / (m.t1 - m.t0), x = m.sx + (m.x - m.sx) * q, y = m.sy + (m.y - m.sy) * q;
        for (let i = 0; i < 7; i++) { const b = i / 7, tx = x + (m.sx - m.x) * b * .16, ty = y + (m.sy - m.y) * b * .16; c.fillStyle = ['#fff2c2', '#ffcd75', '#ef7d57', '#b13e53', '#7a2a36', '#4a2a36', '#2a1a2a'][i]; const s = m.s * (1.5 - b) * (.35 + q * 1.15); c.fillRect(tx - s / 2, ty - s / 2, s, s); }
      }
    }
    /* the beam has depth: it leaves the hero's hand wide (near you) and narrows towards the monster (far away), its head crossing
       the distance before anything breaks, and it stops ON the monster */
    function beam(t) {
      const b = S.beam;
      if (t < b.on) {
        const R = 8 + t * 74;
        for (const [col, r] of [['rgba(165,107,255,.5)', 1.6], ['#a56bff', 1], ['#f3e8ff', .5]]) { c.fillStyle = col; c.beginPath(); c.arc(b.x, b.y, R * r, 0, 6.3); c.fill(); }
        for (let i = 0; i < 8; i++) { const a = rnd(0, 6.28), r = rnd(50, 150); c.fillStyle = '#e4d2ff'; c.fillRect(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 3, 3); }
        return;
      }
      if (t > b.off) return;
      const head = clamp01((t - b.on) / (b.hit - b.on)), fade = clamp01((b.off - t) / .14);
      const nx = -b.uy, ny = b.ux, L = b.len * head, near = 74 * fade + 3, far = near * (.2 + .8 * (1 - head) * .5);
      const tip = [b.x + b.ux * L, b.y + b.uy * L];
      for (const [col, m] of [['rgba(165,107,255,.34)', 1.5], ['#a56bff', 1], ['#e4d2ff', .62], ['#ffffff', .3]]) {
        c.fillStyle = col; c.beginPath();
        c.moveTo(b.x + nx * near * m / 2, b.y + ny * near * m / 2); c.lineTo(tip[0] + nx * far * m / 2, tip[1] + ny * far * m / 2);
        c.lineTo(tip[0] - nx * far * m / 2, tip[1] - ny * far * m / 2); c.lineTo(b.x - nx * near * m / 2, b.y - ny * near * m / 2); c.closePath(); c.fill();
      }
      /* rings run down it, shrinking with the distance: this is what sells the depth */
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 6; i++) {
        const q = (t * 3.4 + i / 6) % 1 * head, w = near + (far - near) * (q / (head || 1)), x = b.x + b.ux * b.len * q, y = b.y + b.uy * b.len * q;
        c.beginPath(); c.ellipse(x, y, Math.max(2, w * .16), Math.max(3, w * .78), Math.atan2(b.uy, b.ux), 0, 6.3); c.fill();
      }
      /* the muzzle at the hand, the blow on the monster */
      c.fillStyle = '#f3e8ff'; c.beginPath(); c.arc(b.x, b.y, near * .4, 0, 6.3); c.fill();
      if (head >= 1) {
        const a = t - b.hit, R = 46 + Math.min(1, a * 3) * 90 * fade;
        for (const [col, r] of [['rgba(165,107,255,.42)', 1.5], ['#a56bff', 1], ['#ffffff', .55]]) { c.fillStyle = col; c.beginPath(); c.arc(ix, iy, R * r, 0, 6.3); c.fill(); }
        c.fillStyle = '#ffffff';
        for (let i = 0; i < 8; i++) { const th = i / 8 * 6.283 + t * 3, l = R * rnd(1.5, 2.3); c.save(); c.translate(ix, iy); c.rotate(th); c.fillRect(0, -2, l, 4); c.restore(); }
      }
    }
    /* the arrow arcs away from you: large at the hand, small at the monster, always pointing where it is going */
    function arrowShot(t) {
      const a = arrow; if (!a || t > a.t1) return;
      const pos = (q) => [a.x0 + (ix - a.x0) * q, a.y0 + (iy - a.y0) * q - Math.sin(q * Math.PI) * 90];
      const q = t / a.t1, [x, y] = pos(q), [nx, ny] = pos(Math.min(1, q + .02)), z = 1.9 - 1.45 * q;
      for (let i = 1; i < 6; i++) { const [tx, ty] = pos(Math.max(0, q - i * .035)); c.fillStyle = `rgba(255,255,255,${(.5 - i * .08).toFixed(2)})`; const s2 = (1.9 - 1.45 * Math.max(0, q - i * .035)) * 3; c.fillRect(tx, ty, s2, s2); }
      c.save(); c.translate(x, y); c.rotate(Math.atan2(ny - y, nx - x)); c.scale(z, z); c.fillStyle = '#b9762e'; c.fillRect(-48, -2, 48, 4); c.fillStyle = '#f6f1e3'; c.fillRect(0, -5, 12, 10); c.fillRect(-54, -5, 10, 10); c.restore();
    }
    function draw() {
      const t = S.t;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      const sh = S.trauma * S.trauma;
      c.translate(Math.round(rnd(-1, 1) * 24 * sh), Math.round(rnd(-1, 1) * 24 * sh));
      if (sh > .01) { c.translate(W / 2, H / 2); c.rotate(rnd(-1, 1) * .016 * sh); c.translate(-W / 2, -H / 2); }
      if (S.opened) {
        const ending = S.rebuilt ? clamp01((t - T.rebuild - T.rebuildDur + .1) / .13) : 0;
        c.drawImage(bg.cv, 0, 0);
        if (mode === 'glass' && S.wholeGone && hero && !S.rebuilt) {
          const hx = W / 2 - 108, hy = bg.floor - 216 + 26 - Math.max(...S.floor.subarray(((W / 2) / 16 - 2) | 0, ((W / 2) / 16 + 3) | 0)), drop = clamp01((t - T.word + .2) / .3);
          c.imageSmoothingEnabled = false; c.drawImage(hero.img, hero.sx, 0, 72, 72, hx, hy - (1 - drop) * 620 - Math.abs(Math.sin((t - T.word) * 6)) * 18 * (t > T.word + .3 ? 1 : 0), 216, 216); c.imageSmoothingEnabled = true;
        }
        if (!S.wholeGone) {
          if (S.dirty) { drawPage(L, S, dpr); S.dirty = false; }
          if (S.halves && !(S.rebuilt && S.heal < .02)) {
            for (const h of S.halves) { c.save(); c.translate(h.x, h.y); c.translate(W / 2, H / 2); c.rotate(h.rot); c.translate(-W / 2, -H / 2); c.clip(h.path); c.drawImage(L.cv, 0, 0, W, H); c.restore(); }
          } else c.drawImage(L.cv, 0, 0, W, H);
        }
        for (const a of S.smoke) { const q = a.a / a.l; c.fillStyle = `rgba(40,34,48,${(.5 * (1 - q)).toFixed(2)})`; const s = Math.round(a.r / 6) * 6; c.fillRect(Math.round(a.x / 6) * 6 - s, Math.round(a.y / 6) * 6 - s, s * 2, s * 2); }
        for (const p of S.pieces) drawPiece(p, p.on || S.rebuilt);
        for (const p of S.chips) drawChip(p);
        c.lineWidth = 2;
        for (const a of S.streaks) { const q = a.t / a.l, r = a.len * q; c.fillStyle = a.col; const n = 5; for (let i = 0; i < n; i++) c.fillRect(a.x + Math.cos(a.a) * (r + i * 8), a.y + Math.sin(a.a) * (r + i * 8), 2, 2); }
        for (const a of S.parts) { c.fillStyle = a.col; c.fillRect(a.x | 0, a.y | 0, a.s, a.s); }
        if (ending) { c.fillStyle = `rgba(255,255,255,${(.5 * ending).toFixed(2)})`; c.fillRect(0, 0, W, H); }
      }
      if (S.dark && !S.rebuilt) { c.fillStyle = `rgba(6,6,20,${(.36 * S.dark).toFixed(2)})`; c.fillRect(-40, -40, W + 80, H + 80); }
      if (crk && !S.wholeGone) { drawCracks(); c.drawImage(crackCv, 0, 0); }
      for (const b of S.bolts) bolt(b);
      if (mode === 'meteor') meteors(t);
      if (S.beam) beam(t);
      arrowShot(t);
      if (S.wordAt && !S.rebuilt) word(t - S.wordAt);
      for (const r of S.rings) ring(t - r.t, r);
      if (S.flash > 0) { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = `rgba(255,250,235,${(Math.ceil(S.flash * 4) / 4 * .85).toFixed(2)})`; c.fillRect(0, 0, W, H); }
    }
    /* the shockwave: a stepped ring of squares, thinning as it grows */
    function ring(a, r) {
      const life = .42;
      if (a < 0 || a > life) return;
      const R = (a / life) * Math.min(1, .3 + r.big * .35) * Math.hypot(W, H) * .8, n = Math.ceil(R / 6) + 12, s = r.big > 1.5 ? 6 : 4;
      c.fillStyle = `rgba(255,240,205,${(1 - a / life).toFixed(2)})`;
      for (let i = 0; i < n; i++) { const th = i / n * 6.283; c.fillRect(Math.round(r.x + Math.cos(th) * R), Math.round(r.y + Math.sin(th) * R), s, s); }
    }
    function word(a) {
      const w = o.first ? 'PERFECT!' : 'K.O.!', big = Math.min(W / (w.length * .62), 200);
      const p = clamp01(a / .16), sz = Math.round(big * (1.8 - .8 * p));
      c.font = `${sz}px PX, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const y = H * .3;
      c.fillStyle = '#09080f';
      for (const [dx, dy] of [[-6, 0], [6, 0], [0, -6], [0, 6], [-6, -6], [6, 6], [6, -6], [-6, 6], [12, 12]]) c.fillText(w, W / 2 + dx, y + dy);
      c.fillStyle = o.first ? '#ffe7ae' : '#ffcd75'; c.fillText(w, W / 2, y);
      if (o.facts && a > .2) {
        c.font = '40px PX, monospace'; c.fillStyle = '#09080f';
        for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) c.fillText(o.facts, W / 2 + dx, y + big * .68 + dy);
        c.fillStyle = '#f6f1e3'; c.fillText(o.facts, W / 2, y + big * .68);
      }
      c.textAlign = 'start'; c.textBaseline = 'alphabetic';
    }
    function finish() {
      if (S.done) return;
      S.done = true; cancelAnimationFrame(S.raf); clearTimeout(S.safety);
      kill();          // skipped before the weapon landed: the monster is still dead
      stage.remove();
      document.removeEventListener('keydown', skip, true);
      document.removeEventListener('visibilitychange', vis);
      document.removeEventListener('px:shatter-seek', seek);
      live = null;
      if (o.done) o.done({ paintMs, mode, pieces: S.pieces.length, chips: S.chips.length, holes: S.holes.length, frames: S.frames, slow: S.slow });
    }
    const skip = (e) => { if (e.type === 'keydown' && /^(Shift|Control|Alt|Meta)$/.test(e.key)) return; finish(); };
    const vis = () => { if (document.hidden) finish(); };
    const seek = (e) => { const ms = +e.detail; if (ms < 0) return finish(); cancelAnimationFrame(S.raf); while (S.t < ms / 1000) { S.frames++; step(STEP); } draw(); stage.dataset.state = JSON.stringify({ pieces: S.pieces.length, chips: S.chips.length, holes: S.holes.length }); };
    function loop(now) {
      if (S.done) return;
      const dt = Math.min(.05, (now - S.last) / 1000);
      S.frames++; if (now - S.last > 34) S.slow++;
      S.last = now;
      let a = dt;
      while (a > 0) { step(Math.min(STEP, a)); a -= STEP; }
      draw();
      if (S.t >= T.end) return finish();
      S.raf = requestAnimationFrame(loop);
    }
    stage.addEventListener('click', finish);
    document.addEventListener('keydown', skip, true);
    document.addEventListener('visibilitychange', vis);
    document.addEventListener('px:shatter-seek', seek);
    S.safety = setTimeout(finish, 7500);
    S.raf = requestAnimationFrame((n) => { S.last = n; loop(n); });
    return S;
  }
  globalThis.__cftsPixelShatter = { play, preload, MODE, repaint };   // repaint: Anime's finisher reads the page the same way
})();
