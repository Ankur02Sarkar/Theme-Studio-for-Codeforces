/* =============================================================================
   cf-fx.js -- the Codeforces moments: every visual (PLAN.md phase 3R).

   Codeforces is a contest arena, so every submission is a fight. The sister's
   moments are not used on Codeforces any more; this file draws Codeforces' own,
   per theme, and themes/fx.css choreographs them:

     Anime Studio = shonen battle     VS screen, combo counter, finisher (撃破！),
                                      guard stance, broken counter (light / heavy),
                                      time stop, overload, ambush, shatter, 覚醒
     Pixel Art    = arcade fighter    ROUND N - FIGHT!, pixel combo, K.O.! /
                                      PERFECT!, CONTINUE? 9..8..7, SYNTAX ERROR
     Vintage Paper = the press        EXTRA! EXTRA! front page, CORRECTION slip,
                                      PROMOTED TO <RANK>

   THE PLUMBING IS THE SISTER'S (its moments-ui.js mount, carried over as it
   was; that file and its visuals are no longer shipped here): one
   overlay at a time, removed by its OWN animation's end, a 3 s deadline behind
   that, any key or a click skips it (the key still reaches the page), a
   hidden tab ends it at once. Added here: page effects (a shake, a grey page,
   a knocked row, recoloured handles) are classes that the overlay's end always
   takes back, and each moment is <= 2.2 s.

   REDUCED MOTION: the overlay gets .is-still: everything marked .m (motion
   only) is hidden, the rest shows at rest (each element's base style IS its
   final look; animations only come FROM elsewhere), and the overlay fades.

   PAGE PIECES (the shards; the finisher's two halves are a view transition,
   see slice()): a content script can't photograph the page. A piece can be a clipped copy of #body over a copy of
   the scene layer, but at Gate 3Rb one copy of a Status page cost 20-61 ms of
   style and layout (cloning itself < 2 ms; 1,104 nodes, rows under the fold
   removed), over the 30 ms budget, and the trial copy dropped frames. So
   pieces are CUT-OUTS by default: the scene picture and the page's own
   surfaces (masthead, menu, card, sidebar boxes, row rules), no text.
   COPIES = true brings the measured copy path back (24 shards, 12 if that
   fits, cut-outs if not). MLE needs no piece: it moves the real page.
   The numbers are left on the overlay (data-piece-*) for the harness.

   Data comes from the driver (cf-moments.js): only what the page shows, the
   cached rating, and the rows already on the page. Page text is only ever set
   with textContent.
============================================================================= */
(function (root) {
  'use strict';
  const html = document.documentElement;
  let jp = true;
  const theme = () => html.getAttribute('data-cf-theme') || '';
  const still = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const JP = (word, en) => (jp ? word : en);

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  const put = (parent, ...kids) => { kids.forEach((k) => k && parent.append(k)); return parent; };
  const vp = () => ({ w: root.innerWidth || html.clientWidth, h: root.innerHeight || html.clientHeight });
  function box(node) {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }
  /* a point on screen for a node: its centre, kept inside the view */
  function onScreen(b) {
    const { w, h } = vp();
    if (!b) return { x: w / 2, y: h / 2 };
    return { x: Math.min(w - 40, Math.max(40, b.cx)), y: Math.min(h - 40, Math.max(40, b.cy)) };
  }

  /* ---- mount: the sister's overlay engine (moments-ui.js mount) + skip/cleanup */
  let current = null;
  function mount(node, o) {
    if (current) current();
    node.classList.add('cfts-fx');
    node.dataset.theme = theme();
    if (still()) node.classList.add('is-still');
    node.style.setProperty('--dur', o.dur + 'ms');
    node.setAttribute('aria-hidden', 'true');
    const page = o.page || [];                                     // classes on <html> for page effects
    const undo = [];
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      if (current === end) current = null;
      document.removeEventListener('keydown', leave, true);
      document.removeEventListener('visibilitychange', hidden);
      page.forEach((c) => html.classList.remove(c));
      undo.forEach((f) => { try { f(); } catch (e) {} });
      node.remove();
    };
    const leave = () => {
      if (node.classList.contains('is-leaving')) return;
      node.classList.add('is-leaving');
      if (root.LCTSSounds && root.LCTSSounds.stop) root.LCTSSounds.stop();
    };
    const hidden = () => { if (document.visibilityState === 'hidden') end(); };
    node.__undo = undo;
    node.addEventListener('animationend', (e) => { if (e.target === node) end(); });
    node.addEventListener('click', leave);
    document.addEventListener('keydown', leave, true);            // any key skips it; the key still reaches the page
    document.addEventListener('visibilitychange', hidden);
    setTimeout(end, 3000);                                          // every moment is over by 2.2 s
    if (!node.classList.contains('is-still')) page.forEach((c) => html.classList.add(c));
    (document.body || html).appendChild(node);
    current = end;
    return node;
  }
  const later = (node, ms, f) => { const t = setTimeout(f, ms); node.__undo.push(() => clearTimeout(t)); };

  /* ---- the 5x7 bitmap face (Pixel Art's big words and digits) -------------- */
  const GLYPHS = {
    A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01111100001000010000100001000001111',
    D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
    G: '01111100001000010011100011000101111', H: '10001100011000111111100011000110001', I: '11111001000010000100001000010011111',
    J: '00111000010000100001000011000101110', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
    M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110',
    P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
    S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
    V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
    Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
    0: '01110100111010110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100110010001000011111',
    3: '11110000010000101110000010000111110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000010000111110',
    6: '01110100001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
    9: '01110100011000101111000010000101110', '!': '00100001000010000100001000000000100', '?': '01110100010000100110001000000000100',
    '.': '00000000000000000000000000000000100', '-': '00000000000000011111000000000000000', ':': '00000001000000000000000000010000000',
  };
  let gid = 0;
  /* SVG squares: an outline and a hard shadow (fractions of a cell), then a
     two-tone fill (light top rows, the colour below), like an arcade title */
  function pix(text, px, fill, light) {
    const cells = [];
    let x = 0;
    for (const ch of String(text).toUpperCase()) {
      if (ch === ' ') { x += 4; continue; }
      const g = GLYPHS[ch];
      if (!g) continue;
      for (let i = 0; i < 35; i++) if (g[i] === '1') cells.push([x + (i % 5), Math.floor(i / 5)]);
      x += 6;
    }
    const W = Math.max(1, x - 1), H = 7, o = Math.max(2, Math.round(px * 0.16)), sh = Math.max(3, Math.round(px * 0.3));
    const id = 'cftsg' + (++gid);
    const r = (dx, grow, col) => cells.map(([cx, cy]) => `<rect x="${cx * px + o + dx - grow}" y="${cy * px + o + dx - grow}" width="${px + 2 * grow}" height="${px + 2 * grow}"${col ? ` fill="${col}"` : ''}/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * px + 2 * o + sh}" height="${H * px + 2 * o + sh}" viewBox="0 0 ${W * px + 2 * o + sh} ${H * px + 2 * o + sh}" shape-rendering="crispEdges">` +
      `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${o}" x2="0" y2="${o + H * px}"><stop offset="0" stop-color="${light || '#f4f4f4'}"/><stop offset=".29" stop-color="${light || '#f4f4f4'}"/><stop offset=".29" stop-color="${fill}"/><stop offset="1" stop-color="${fill}"/></linearGradient></defs>` +
      r(sh, o, '#1a1c2c') + r(0, o, '#1a1c2c') + `<g fill="url(#${id})">${r(0, 0, '')}</g></svg>`;
    const n = el('span', 'px-word');
    n.innerHTML = svg;                                             // built from the constant glyph table only
    n.style.setProperty('--w', (W * px + 2 * o + sh) + 'px');      // its natural width; fx.css caps it to the window
    return n;
  }

  /* ---- page pieces ---------------------------------------------------------- */
  const BUDGET = 30;                                               // ms for copying the pieces (Gate 3Rb)
  const COPIES = false;                                            // see PAGE PIECES above
  let pieceMode = COPIES ? 'clone' : 'cutout';                     // 'cutout' once a page proves too slow
  const lastCost = { ms: 0, one: 0, mode: '', pieces: 0 };
  function sceneLayer() {
    const s = el('div', 'pc-scene');
    return s;
  }
  /* the page's surfaces as boxes, read once per moment: masthead, menu, the
     card, sidebar boxes, and a rule under each table row in view */
  let flatCache = null;
  function flats() {
    if (flatCache) return flatCache;
    const out = [], { h } = vp();
    ['#header', '#body > .menu-box', '#pageContent', '#sidebar .roundbox'].forEach((sel) => document.querySelectorAll(sel).forEach((n) => {
      const b = box(n); if (b && b.w > 2 && b.y < h && b.y + b.h > 0) out.push(['pc-flat', b]);
    }));
    document.querySelectorAll('#pageContent table tr').forEach((tr) => {
      const b = box(tr); if (b && b.y + b.h > 0 && b.y < h) out.push(['pc-rule', { x: b.x, y: b.y + b.h - 1, w: b.w, h: 1 }]);
    });
    setTimeout(() => { flatCache = null; }, 0);
    return (flatCache = out);
  }
  function cutoutLayer() {
    const f = document.createDocumentFragment();
    f.append(sceneLayer());
    flats().forEach(([cls, b]) => {
      const d = el('div', cls);
      d.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
      f.append(d);
    });
    return f;
  }
  /* one copy of what is on screen: #body as it stands, minus what is below
     the view (removing rows under the fold shifts nothing above it), iframes
     and the footer (a copy must never load anything) */
  function pageCopy() {
    const src = document.getElementById('body');
    if (!src) return null;
    const b = box(src), { h } = vp();
    const c = src.cloneNode(true);
    c.removeAttribute('id');
    c.classList.add('pc-body');
    c.querySelectorAll('iframe, video, audio, #footer, script, .cfts-combo').forEach((n) => n.remove());
    const rows = src.querySelectorAll('table tr'), copies = c.querySelectorAll('table tr');
    if (rows.length === copies.length) {
      for (let i = rows.length - 1; i >= 0; i--) { if (rows[i].getBoundingClientRect().top > h) copies[i].remove(); else break; }
    }
    c.inert = true;
    c.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;margin:0;`;
    return c;
  }
  /* polys: CSS clip-path values; host: the overlay node, already in the page */
  function pieces(host, polys, fewer) {
    const layer = el('div', 'pc-layer m');
    const under = host.querySelector('.pc-void');                  // above the void, under every word and flash
    if (under) under.after(layer); else host.prepend(layer);
    /* each piece is only as big as its polygon (small layers, not 24 full screens);
       its contents are shifted back so they line up with the page */
    const { w: VW, h: VH } = vp();
    const bboxOf = (clip) => {
      const pts = [...clip.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map((m) => [+m[1], +m[2]]);
      if (!pts.length) return { x: 0, y: 0, w: VW, h: VH, clip };
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const x = Math.max(0, Math.floor(Math.min(...xs))), y = Math.max(0, Math.floor(Math.min(...ys)));
      const r = Math.min(VW, Math.ceil(Math.max(...xs))), bt = Math.min(VH, Math.ceil(Math.max(...ys)));
      return { x, y, w: Math.max(1, r - x), h: Math.max(1, bt - y), clip: `polygon(${pts.map((q) => `${(q[0] - x).toFixed(0)}px ${(q[1] - y).toFixed(0)}px`).join(', ')})` };
    };
    const mk = (clip, withCopy) => {
      const b = bboxOf(clip);
      const p = el('div', 'pc');
      p.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;clip-path:${b.clip}`;
      const inner = el('div', 'pc-in');
      inner.style.cssText = `left:${-b.x}px;top:${-b.y}px;width:${VW}px;height:${VH}px`;
      if (withCopy) { inner.append(sceneLayer()); const c = pageCopy(); if (c) inner.append(c); } else inner.append(cutoutLayer());
      p.append(inner);
      layer.append(p);
      p.__box = b;
      return p;
    };
    void host.offsetWidth;                                          // the overlay's own layout is not the copy's cost
    const t0 = performance.now();
    let mode = pieceMode, list = polys;
    if (mode === 'clone') {
      const first = mk(list[0], true);
      void first.offsetWidth;                                       // the copy's style and layout, timed
      const one = performance.now() - t0;
      lastCost.one = +one.toFixed(1);
      if (one * list.length > BUDGET && fewer && one * fewer.length <= BUDGET) { first.remove(); list = fewer; mk(list[0], true); }
      else if (one * list.length > BUDGET) { mode = 'cutout'; pieceMode = 'cutout'; first.remove(); }
      if (mode === 'clone') for (let i = 1; i < list.length; i++) mk(list[i], true);
    }
    /* cut-outs each draw the scene picture: 12 shards paint at speed where 24 dropped ~11% of frames (Gate 3Rb) */
    if (mode === 'cutout' && fewer) list = fewer;
    if (mode === 'cutout') list.forEach((clip) => mk(clip, false));
    void layer.offsetWidth;
    const ms = performance.now() - t0;
    if (mode === 'clone' && ms > BUDGET) pieceMode = 'cutout';      // the next moment on this page uses cut-outs
    Object.assign(lastCost, { ms: +ms.toFixed(1), mode, pieces: list.length });
    host.dataset.pieceMs = lastCost.ms; host.dataset.pieceOne = lastCost.one; host.dataset.pieceMode = mode; host.dataset.pieces = list.length;
    return [...layer.children];
  }

  /* ---- the slice: the real page cut in two, with no copy ------------------------
     A view transition gives the page two images of itself for free: the snapshot
     taken when it starts (::view-transition-old(root)) and the live page
     (::view-transition-new(root)). fx.css clips the snapshot to the half above the
     blade and the live page to the half below and slides them apart for 440 ms;
     the gap between them is the transition's own dark backdrop. The overlay has
     its own transition name, so the blade and the words stay live on top.
     The capture (Chrome pauses rendering ~2-4 frames for it) happens before the
     overlay exists, so the pause falls where nothing on screen has changed yet.
     Without view transitions the page simply stays whole under the blade.
     A browser whose capture pause (call to ready) ever measures over 80 ms is
     counted in cfSliceSlow { streak, ms, at }; after TWO slow captures in a row
     (a normal one in between resets the count) it keeps the page whole from
     then on. */
  const SLOW_CAPTURE = 80;
  let sliceSlow = false;
  try {
    const slow = (v) => !!(v && v.streak >= 2);
    chrome.storage.local.get('cfSliceSlow', (r) => { sliceSlow = slow(r && r.cfSliceSlow); });
    chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.cfSliceSlow) sliceSlow = slow(c.cfSliceSlow.newValue); });
  } catch (e) {}
  /* The Firefox build keeps the page whole for now. Firefox runs view transitions,
     but its screenshots don't draw them, so no automated check has seen the slice
     there; `WATCH=1 node harness/firefox.mjs` plays it for a person to judge.
     Only the Firefox manifest carries browser_specific_settings (scripts/package.py). */
  const FIREFOX_BUILD = (() => { try { return !!chrome.runtime.getManifest().browser_specific_settings; } catch (e) { return false; } })();
  function slice(n, show) {
    if (FIREFOX_BUILD || sliceSlow || typeof document.startViewTransition !== 'function' || document.visibilityState !== 'visible') return false;
    const { w, h } = vp();
    html.style.setProperty('--cfts-cut-a', `polygon(0 0, ${w}px 0, ${w}px ${(h * 0.18).toFixed(0)}px, 0 ${(h * 0.82).toFixed(0)}px)`);
    html.style.setProperty('--cfts-cut-b', `polygon(0 ${(h * 0.82).toFixed(0)}px, ${w}px ${(h * 0.18).toFixed(0)}px, ${w}px ${h}px, 0 ${h}px)`);
    n.style.viewTransitionName = 'cfts-fx';
    html.classList.add('cfts-fx-slice');
    let off = false;
    const done = () => {
      if (off) return; off = true;
      html.classList.remove('cfts-fx-slice');
      html.style.removeProperty('--cfts-cut-a'); html.style.removeProperty('--cfts-cut-b');
      n.style.viewTransitionName = '';
    };
    const t0 = performance.now();
    let vt;
    /* the snapshot is taken of the page as it is (no overlay yet); the overlay then
       appears in the live image, and the halves part at 120 ms (fx.css) */
    try { vt = document.startViewTransition(() => { show(); if (n.__undo) n.__undo.push(() => { try { vt.skipTransition(); } catch (e) {} done(); }); }); }
    catch (e) { done(); return false; }
    vt.ready.then(() => {
      const ms = performance.now() - t0;
      n.dataset.pieceMode = 'snapshot'; n.dataset.pieces = 2; n.dataset.pieceMs = ms.toFixed(1);
      try {
        chrome.storage.local.get('cfSliceSlow', (r) => {
          const was = (r && r.cfSliceSlow) || null;
          if (ms > SLOW_CAPTURE) chrome.storage.local.set({ cfSliceSlow: { streak: ((was && was.streak) || 0) + 1, ms: Math.round(ms), at: Date.now() } });
          else if (was && was.streak) chrome.storage.local.set({ cfSliceSlow: null });   // a normal capture: the count starts again
        });
      } catch (e) {}
    }, () => {});
    vt.finished.then(done, done);
    return true;
  }

  /* ---- shared bits ------------------------------------------------------------ */
  const rankVar = (col) => `var(--cf-rank-${col || 'gray'})`;
  function dangerMarks(n, col) {
    const m = el('span', 'dz');
    m.style.setProperty('--c', rankVar(col));
    for (let i = 0; i < 5; i++) { const k = el('i', i < n ? 'on' : ''); k.style.setProperty('--i', i); m.append(k); }
    return m;
  }
  function skipHint(text) { return el('div', 'fx-skip m', text || 'CLICK OR PRESS ANY KEY'); }
  /* the counter's place: beside my row in the right margin, or above its verdict cell */
  function counterSpot(row, cell) {
    const pc = box(document.getElementById('pageContent')), r = box(row), v = box(cell) || r, { w } = vp();
    if (!r) return null;
    const margin = pc ? w - (pc.x + pc.w) : 0;
    if (margin >= 120) return { x: pc.x + pc.w + margin / 2, y: r.cy, side: true };
    return { x: v.cx, y: r.y - 34, side: false };
  }

  /* ======================================================================== */
  /* 1. title card: VS (Anime) / ROUND N - FIGHT! (Pixel)                       */
  /* info: { handle, rating, col, rankName, letter, pid, title, prating, pcol, word, dz, arc:[jp,en], round } */
  function vs(info) {
    const t = theme();
    if (t === 'pixel') return fight(info);
    if (t !== 'anime') return null;
    const boss = info.prating >= 2400;
    const n = el('div', 'fx-vs' + (boss ? ' is-boss' : ''));
    n.style.setProperty('--me', rankVar(info.col));
    n.style.setProperty('--foe', rankVar(info.pcol));
    const me = put(el('div', 'vs-me s'), el('div', 'vs-tag', 'YOU'), el('div', 'vs-handle', info.handle || 'You'),
      info.rating ? put(el('div', 'vs-stat'), document.createTextNode(String(info.rating)), el('span', null, (info.rankName || '').toUpperCase())) : null);
    const foe = put(el('div', 'vs-foe s'), el('div', 'vs-tag', 'PROBLEM ' + (info.pid || '')), el('div', 'vs-letter', info.letter || '?'),
      el('div', 'vs-name', info.title || ''),
      info.prating ? put(el('div', 'vs-rate'), document.createTextNode('*' + info.prating), el('span', 'w', (info.word || '').toUpperCase())) : el('div', 'vs-rate', 'NOT RATED YET'),
      info.dz ? put(el('div', 'vs-dz'), el('span', 'jp', JP('危険度', 'DANGER')), dangerMarks(info.dz, info.pcol)) : null,
      info.arc ? put(el('div', 'vs-arc'), jp ? el('span', 'jp', info.arc[0]) : null, document.createTextNode(info.arc[1])) : null);
    put(n, el('div', 'fx-dim'), put(el('div', 'vs-l s'), me), put(el('div', 'vs-r s'), foe), el('div', 'vs-seam m'),
      put(el('div', 'vs-mid s'), el('div', 'v', 'VS'), el('div', 'j', JP('勝負！', 'SHOWDOWN'))));
    if (boss) put(n, el('div', 'vs-boss s', 'BOSS'), el('div', 'vs-bolt a m'), el('div', 'vs-bolt b m'));
    for (let i = 0; i < 6; i++) { const s = el('div', 'vs-streak m'); s.style.setProperty('--i', i); n.append(s); }
    n.append(skipHint());
    return { node: mount(n, { dur: 2200 }), sound: boss ? 'vs-boss' : 'vs' };
  }
  function fight(info) {
    const n = el('div', 'fx-fight');
    n.append(el('div', 'px-dim'), hud(info, '100%'));
    put(n, put(el('div', 'fx-center px-round m'), pix('ROUND ' + (info.round || 1), 16, '#ffcd75')),
      put(el('div', 'fx-center px-fight s'), pix('FIGHT!', 30, '#ef7d57')), skipHint('PRESS ANY KEY'));
    return { node: mount(n, { dur: 2000 }), sound: 'fight' };
  }
  function hud(info, foeFill) {
    const side = (cls, name, sub, col, fill) => {
      const s = put(el('div', 'hud-side ' + cls), put(el('div', 'hud-name'), document.createTextNode(name), el('small', null, sub)),
        put(el('div', 'hud-bar'), el('i')));
      s.style.setProperty('--c', col); s.style.setProperty('--f', fill);
      return s;
    };
    const left = side('l', (info.handle || 'YOU').toUpperCase(), info.rating ? info.rating + ' ' + (info.rankName || '').toUpperCase() : '', rankVar(info.col), '100%');
    const right = side('r', info.pid || 'PROBLEM', info.prating ? '*' + info.prating : '', rankVar(info.pcol || 'gray'), foeFill);
    if (info.dz) {
      const hearts = el('div', 'hud-hearts');
      for (let i = 0; i < 5; i++) hearts.append(el('i', i < info.dz ? 'on' : ''));
      right.append(hearts);
    }
    return put(el('div', 'hud s'), left, right);
  }

  /* ======================================================================== */
  /* 2. the combo counter: one element in the page beside my row               */
  const combo = {
    node: null, n: 0, row: null, cell: null, col: 'gray',
    start(row, cell, col, n) {
      const t = theme();
      if (t !== 'anime' && t !== 'pixel') return;
      this.stop();
      this.row = row; this.cell = cell; this.col = col || 'gray';
      const c = el('div', 'cfts-combo');
      c.dataset.theme = t;
      c.setAttribute('aria-hidden', 'true');
      c.style.setProperty('--me', rankVar(this.col));
      c.append(el('div', 'lab', 'TEST'), el('div', 'n'), t === 'anime' ? el('div', 'j', JP('連撃', 'COMBO')) : el('div'));
      (document.body || html).append(c);
      this.node = c;
      if (row) row.classList.add('cfts-combo-row');
      this.tick(n || 0, true);
    },
    tick(n, quiet) {
      const c = this.node;
      if (!c || !(n > 0)) return false;
      this.n = n;
      const num = c.querySelector('.n');
      if (c.dataset.theme === 'pixel') { num.textContent = ''; num.append(pix(String(n), 6, '#f4f4f4')); } else num.textContent = String(n);
      const heat = Math.min(1, n / 40);                              // my rank colour -> white-gold as N climbs
      c.style.setProperty('--heat', `color-mix(in srgb, #ffe08a ${Math.round(heat * 100)}%, var(--me))`);
      const s = counterSpot(this.row, this.cell);
      if (s) { c.style.left = (s.x + root.scrollX) + 'px'; c.style.top = (s.y + root.scrollY) + 'px'; c.classList.toggle('above', !s.side); }
      if (!quiet && !still() && c.animate) {
        c.querySelector('.n').animate(c.dataset.theme === 'pixel'
          ? [{ transform: 'translateY(-6px)' }, { transform: 'none' }]
          : [{ transform: 'scale(1.3)', filter: 'brightness(1.6)' }, { transform: 'none', filter: 'none' }],
        { duration: c.dataset.theme === 'pixel' ? 120 : 160, easing: c.dataset.theme === 'pixel' ? 'steps(2)' : 'ease-out' });
      }
      return true;
    },
    /* hands the counter over to the verdict moment: its number and where it was on screen */
    take() {
      const c = this.node;
      if (!c) return null;
      const r = box(c.querySelector('.n')), n = this.n;
      this.stop();
      return { n, r };
    },
    stop() {
      if (this.node) this.node.remove();
      if (this.row) this.row.classList.remove('cfts-combo-row');
      this.node = null; this.row = null; this.cell = null; this.n = 0;
    },
  };

  /* ======================================================================== */
  /* 3. verdicts. v: { kind, label, n (last test seen), judged (test in the
     verdict), facts: { handle, col, pid, name, time, mem, lang, id, rating,
     rankName, earlier: [verdict texts] }, first, row, cell, counter: {n, r} } */
  function verdict(v) {
    const t = theme();
    if (t === 'anime') return animeVerdict(v);
    if (t === 'pixel') return pixelVerdict(v);
    if (t === 'paper') return paperVerdict(v);
    if (t === 'fastlap') return fastlapVerdict(v);
    return null;
  }

  /* ---- FASTLAP: race control. The verdict arrives as a broadcast lower third:
     a flag in the verdict's colour, the call, a slanted bar, a white number
     plate (the time on an Accepted, the test it stopped on otherwise). Colours
     follow sector logic, never rank meaning: green accepted, purple first try,
     red wrong / error, yellow limits, grey compile. Every word is a fact.
     A soft scrim rises from the bottom edge under it, as under a TV lower third. */
  const FLAG_CHQ = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 4v33" stroke="#0B0B0D" stroke-width="3"/><defs><pattern id="fl-chq" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#0B0B0D"/><rect x="4" y="4" width="4" height="4" fill="#0B0B0D"/></pattern></defs><path d="M9 5c8-3 13 4 26 0v17c-13 4-18-3-26 0z" fill="url(#fl-chq)" stroke="#0B0B0D" stroke-width="1.5"/></svg>';
  const FLAG = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 4v33" stroke="#0B0B0D" stroke-width="3"/><path d="M9 5c8-3 13 4 26 0v17c-13 4-18-3-26 0z" fill="#0B0B0D"/></svg>';
  function raceControl(o) {
    const n = el('div', 'fx-race fx-race-' + o.kind);
    n.style.setProperty('--c', o.c);
    const flag = el('div', 'rc-flag');
    flag.innerHTML = o.chq ? FLAG_CHQ : FLAG;                        // static markup, no data in it
    const txt = put(el('div', 'rc-txt'), el('b', null, o.head), o.sub ? el('span', null, o.sub) : null);
    const num = o.num ? put(el('div', 'rc-num'), el('b', null, o.num), el('span', null, o.numLab || '')) : null;
    if (o.first) n.append(el('div', 'rc-chq m'));
    put(n, el('div', 'rc-scrim'), el('div', 'rc-streak m'), put(el('div', 'rc-ci s'), flag, txt, el('div', 'rc-bar'), num));
    return n;
  }
  function fastlapVerdict(v) {
    const f = v.facts || {}, N = v.n || v.judged || 0;
    const what = [f.pid, f.name].filter(Boolean).join(' · ').toUpperCase();
    const test = (lab) => (v.judged ? { num: String(v.judged), numLab: (v.unit === 'pretest' ? 'ON PRETEST' : 'ON TEST') } : { num: '', numLab: lab || '' });
    let o;
    if (v.kind === 'ac') {
      o = { kind: 'ac', c: v.first ? '#A855F7' : '#22C55E', chq: true, first: v.first, head: 'ACCEPTED', sub: [v.first ? 'FIRST TRY' : '', what].filter(Boolean).join(' · '),
        num: f.time ? f.time.toUpperCase() : N ? String(N) : '', numLab: f.time ? 'TIME' : N ? 'TESTS PASSED' : '' };
      return { node: mount(raceControl(o), { dur: 2200 }), sound: v.first ? 'fastest' : 'pass' };
    }
    if (v.kind === 'pretests') {
      o = { kind: 'pre', c: '#22C55E', chq: false, head: 'PRETESTS PASSED', sub: 'SYSTEM TEST PENDING' + (what ? ' · ' + what : ''), num: N ? String(N) : '', numLab: N ? 'PRETESTS' : '' };
      return { node: mount(raceControl(o), { dur: 2000 }), sound: 'pretests' };
    }
    if (v.kind === 'ce') {
      o = { kind: 'ce', c: '#8C8C97', head: 'COMPILATION ERROR', sub: what, num: '', numLab: '' };
      return { node: mount(raceControl(o), { dur: 1800 }), sound: 'pit' };
    }
    if (v.kind === 'tle' || v.kind === 'mle') {
      o = Object.assign({ kind: v.kind, c: '#FACC15', head: v.kind === 'tle' ? (/^Idleness/i.test(v.label) ? 'IDLENESS LIMIT' : 'TIME LIMIT') : 'MEMORY LIMIT', sub: what }, test());
      return { node: mount(raceControl(o), { dur: 2200 }), sound: v.kind === 'tle' ? 'limit' : 'memory' };
    }
    const head = v.kind === 'wa' ? 'WRONG ANSWER' : v.kind === 'hacked' ? 'HACKED' : v.kind === 'fst' ? 'FAILED SYSTEM TEST'
      : (v.label || 'RUNTIME ERROR').replace(/\s+ON\s+(PRE)?TEST\s+\d+.*$/, '');
    o = Object.assign({ kind: 'no', c: '#E10A1E', head, sub: v.kind === 'fst' ? (v.label + (what ? ' · ' + what : '')) : what }, v.kind === 'hacked' ? { num: '', numLab: '' } : test());
    return { node: mount(raceControl(o), { dur: 2200 }), sound: v.kind === 'wa' ? 'flag' : v.kind === 'hacked' || v.kind === 'fst' ? 'review' : 'crash' };   // each call its own sound
  }
  function placeVars(n, v) {
    const r = box(v.row), c = box(v.cell) || r, p = onScreen(c);
    n.style.setProperty('--vx', p.x + 'px'); n.style.setProperty('--vy', p.y + 'px');
    if (r) { n.style.setProperty('--rl', r.x + 'px'); n.style.setProperty('--rt', r.y + 'px'); n.style.setProperty('--rw', r.w + 'px'); n.style.setProperty('--rh', r.h + 'px'); }
    const k = v.counter && v.counter.r;
    const spot = k ? { x: k.cx, y: k.cy } : (counterSpot(v.row, v.cell) || p);
    n.style.setProperty('--kx', spot.x + 'px'); n.style.setProperty('--ky', spot.y + 'px');
    return { r, c, p, spot };
  }
  const testsLine = (n, unit) => (n === 2 ? `1 ${unit || 'test'} survived` : n > 2 ? `${n - 1} ${unit || 'test'}s survived` : '');

  function animeVerdict(v) {
    const n = el('div', 'fx-a');
    n.style.setProperty('--me', rankVar(v.facts.col));
    const { p, r } = placeVars(n, v);
    const N = v.n || v.judged || 0;
    const kind = v.kind;
    /* --- Accepted: the finisher ---------------------------------------------- */
    if (kind === 'ac') {
      n.classList.add('fx-finisher');
      /* the blade runs exactly along the cut: from (0, 82% h) to (w, 18% h) */
      { const { w, h } = vp(); n.style.setProperty('--by', (h * 0.82).toFixed(0) + 'px'); n.style.setProperty('--bl', Math.hypot(w, h * 0.64).toFixed(0) + 'px');
        n.style.setProperty('--ba', (-Math.atan2(h * 0.64, w) * 180 / Math.PI).toFixed(2) + 'deg'); }
      put(n, el('div', 'fx-flash m'), el('div', 'fx-ring m'));
      if (v.counter) put(n, put(el('div', 'fx-count m'), el('div', 'n', v.counter.n)));
      put(n, el('div', 'fx-blade m'), el('div', 'fx-dim2 m'), el('div', 'fx-rays m'),
        put(el('div', 'fx-big m'), el('div', 'gekiha jp', JP('撃破！', 'FINISH!')), N ? el('div', 'alln', `ALL ${N} TESTS`) : null,
          el('div', 'subl', ['ACCEPTED', v.facts.pid && v.facts.pid + (v.facts.name ? ' ' + v.facts.name.toUpperCase() : ''), v.facts.time].filter(Boolean).join(' · '))),
        put(el('div', 'fx-stamp s'), el('span', 'jp', JP('撃破！', 'FINISH!')), N ? el('small', null, `ALL ${N} TESTS`) : el('small', null, 'ACCEPTED')));
      /* the slice's capture comes FIRST, before anything changes on screen: the overlay
         is mounted in the view transition's update callback (see slice()) */
      if (still() || !slice(n, () => mount(n, { dur: 2200 }))) mount(n, { dur: 2200 });
      return { node: n, sound: 'finisher' };
    }
    /* --- Pretests passed: the guard stance -------------------------------------- */
    if (kind === 'pretests') {
      n.classList.add('fx-guard');
      put(n, el('div', 'fx-dim3 s'), el('div', 'brk l s'), el('div', 'brk r s'), el('div', 'shield s'),
        put(el('div', 'guardbar s'), el('span', 'j jp', JP('構え', 'GUARD')), el('span', 't', 'PRETESTS PASSED'), put(el('span', 'p'), el('i'), document.createTextNode('system test pending'))));
      return { node: mount(n, { dur: 2000 }), sound: 'guard' };
    }
    /* --- Wrong answer / runtime error on test 1, compilation error: a stumble ---- */
    const reject = /^(wa|err)$/.test(kind);
    if (kind === 'ce' || (reject && N <= 1)) {
      n.classList.add('fx-stumble');
      if (v.counter) put(n, put(el('div', 'fx-count tip m'), el('div', 'n', v.counter.n)), el('div', 'fx-crack-s m'));
      const hint = kind === 'ce' ? 'COMPILATION ERROR · check the compiler log' : `${v.label} · check the sample`;
      put(n, put(el('div', 'fx-chip s'), el('span', 'jp', JP('つまずき', 'STUMBLE')), el('span', null, hint.split(' · ')[0] + ' · '), el('b', null, hint.split(' · ')[1])));
      return { node: mount(n, { dur: 1400, page: ['cfts-fx-nudge'] }), sound: 'stumble' };
    }
    /* --- a heavy hit: the counter breaks at N ------------------------------------- */
    if (reject) {
      n.classList.add('fx-hit');
      put(n, el('div', 'fx-edge m'), el('div', 'fx-flash small m'));
      /* cracks from my verdict cell */
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'fx-cracks m');
      const { w, h } = vp();
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.3 * Math.sin(i * 7), len = 160 + ((i * 97) % 220);
        let d = `M${p.x} ${p.y}`, x = p.x, y = p.y;
        for (let s = 1; s <= 4; s++) { const j = (s % 2 ? 1 : -1) * 0.22; x = p.x + Math.cos(a + j) * len * s / 4; y = p.y + Math.sin(a + j) * len * s / 4; d += ` L${x.toFixed(0)} ${y.toFixed(0)}`; }
        for (const g of [true, false]) {                            // the glow, then the line
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', d); path.setAttribute('pathLength', '1'); path.style.setProperty('--i', i);
          if (g) path.setAttribute('class', 'g');
          svg.append(path);
        }
      }
      n.append(svg);
      /* the counter's digits split and fly */
      const digits = put(el('div', 'fx-digits m'));
      String(v.counter ? v.counter.n : N || '').split('').forEach((d, i, all) => {
        const s = el('span', null, d);
        s.style.setProperty('--dx', ((i - (all.length - 1) / 2) * 2 || (i ? 1 : -1)) * 90 + 'px');
        s.style.setProperty('--dy', (i % 2 ? 70 : -90) + 'px'); s.style.setProperty('--rot', (i % 2 ? 1 : -1) * 120 + 'deg');
        digits.append(s);
      });
      n.append(digits);
      put(n, el('div', 'fx-dim2 s'), put(el('div', 'fx-hold s'), el('div', 'j jp', JP('被弾', 'HIT')), el('div', 't', v.label), N > 1 ? el('div', 'sub', testsLine(N, v.unit)) : null));
      return { node: mount(n, { dur: 2000, page: ['cfts-fx-shake'] }), sound: 'hit' };
    }
    /* --- TLE: time stop ------------------------------------------------------------- */
    if (kind === 'tle') {
      n.classList.add('fx-timestop');
      for (let i = 0; i < 3; i++) { const g = el('div', 'fx-ripple m'); g.style.setProperty('--i', i); n.append(g); }
      const clock = el('div', 'fx-clock s');
      clock.innerHTML = '<svg viewBox="0 0 320 320"><circle cx="160" cy="160" r="148"/>' +
        Array.from({ length: 12 }, (_, i) => `<line x1="160" y1="${i % 3 ? 30 : 20}" x2="160" y2="44" transform="rotate(${i * 30} 160 160)" class="${i % 3 ? '' : 'big'}"/>`).join('') +
        '<line class="hand" x1="160" y1="160" x2="160" y2="52"/><line class="hand2" x1="160" y1="160" x2="232" y2="190"/><circle class="hub" cx="160" cy="160" r="12"/></svg>';   // constant markup
      clock.append(el('div', 'ms', v.facts.time || ''));
      put(n, el('div', 'fx-cold s'), clock, el('div', 'fx-tstop s jp', JP('時間停止', 'TIME STOP')), put(el('div', 'fx-under s'), document.createTextNode(v.label), v.facts.time ? el('small', null, 'stopped at ' + v.facts.time) : null));
      mount(n, { dur: 2000 });
      if (!n.classList.contains('is-still')) later(n, 220, () => html.classList.add('cfts-fx-gray'));
      else html.classList.add('cfts-fx-gray');
      n.__undo.push(() => html.classList.remove('cfts-fx-gray'));
      return { node: n, sound: 'timestop' };
    }
    /* --- MLE: overload ---------------------------------------------------------------- */
    if (kind === 'mle') {
      n.classList.add('fx-overload');
      put(n, el('div', 'fx-vign s'), put(el('div', 'fx-memlab s'), el('span', null, 'MEMORY'), el('span', null, v.facts.mem || '')), put(el('div', 'fx-mem s'), el('i')),
        put(el('div', 'fx-ovl s'), el('div', 'j jp', JP('過負荷', 'OVERLOAD'))), put(el('div', 'fx-under low s'), document.createTextNode(v.label)));
      /* the real page swells (0-300 ms) and tears sideways in hard steps (300-1200 ms): no copy needed */
      mount(n, { dur: 2000, page: ['cfts-fx-bulge'] });
      return { node: n, sound: 'overload' };
    }
    /* --- Hacked: the ambush --------------------------------------------------------------- */
    if (kind === 'hacked') {
      n.classList.add('fx-ambush');
      put(n, el('div', 'fx-blade2 m'), el('div', 'fx-excl m', '!'), el('div', 'fx-dim2 s'),
        put(el('div', 'fx-hacked s'), el('div', 'j jp', JP('奇襲', 'AMBUSH')), el('div', 't', 'HACKED'), el('div', 'sub', `A hacker found a test that breaks ${v.facts.pid || 'it'} · fix it and resubmit`)));
      mount(n, { dur: 2000 });
      if (v.row && !n.classList.contains('is-still')) { v.row.classList.add('cfts-fx-knock'); n.__undo.push(() => v.row.classList.remove('cfts-fx-knock')); }
      return { node: n, sound: 'ambush' };
    }
    /* --- Failed system test: the shatter ------------------------------------------------------ */
    if (kind === 'fst') {
      n.classList.add('fx-shatter');
      const { w, h } = vp();
      /* 12 rim points; each wedge from my verdict cell splits into an inner and an outer shard (24) */
      const rim = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.18 * Math.sin(i * 3.1), R = Math.hypot(w, h);
        rim.push([Math.max(-20, Math.min(w + 20, p.x + Math.cos(a) * R)), Math.max(-20, Math.min(h + 20, p.y + Math.sin(a) * R))]);
      }
      const polys = [], fewer = [], dirs = [];
      const pt = (q) => `${q[0].toFixed(0)}px ${q[1].toFixed(0)}px`;
      for (let i = 0; i < 12; i++) {
        const a = rim[i], b = rim[(i + 1) % 12], fa = 0.3 + (i * 7 % 5) * 0.04, fb = 0.3 + ((i + 1) * 7 % 5) * 0.04;
        const ia = [p.x + (a[0] - p.x) * fa, p.y + (a[1] - p.y) * fa], ib = [p.x + (b[0] - p.x) * fb, p.y + (b[1] - p.y) * fb];
        polys.push(`polygon(${pt([p.x, p.y])}, ${pt(ia)}, ${pt(ib)})`, `polygon(${pt(ia)}, ${pt(a)}, ${pt(b)}, ${pt(ib)})`);
        const mx = (a[0] + b[0]) / 2 - p.x, my = (a[1] + b[1]) / 2 - p.y, d = Math.hypot(mx, my) || 1;
        dirs.push([mx / d, my / d, 0.35, i], [mx / d, my / d, 1, i]);
      }
      for (let i = 0; i < 12; i++) {                                  // 12 shards: the same wedges, unsplit
        const a = rim[i], b = rim[(i + 1) % 12];
        fewer.push(`polygon(${pt([p.x, p.y])}, ${pt(a)}, ${pt(b)})`);
      }
      const cracks = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      cracks.setAttribute('class', 'fx-web m'); cracks.setAttribute('viewBox', `0 0 ${w} ${h}`);
      rim.forEach((q, i) => {
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const fa = 0.3 + (i * 7 % 5) * 0.04, nb = rim[(i + 1) % 12], fb = 0.3 + ((i + 1) * 7 % 5) * 0.04;
        l.setAttribute('d', `M${p.x} ${p.y} L${q[0].toFixed(0)} ${q[1].toFixed(0)} M${(p.x + (q[0] - p.x) * fa).toFixed(0)} ${(p.y + (q[1] - p.y) * fa).toFixed(0)} L${(p.x + (nb[0] - p.x) * fb).toFixed(0)} ${(p.y + (nb[1] - p.y) * fb).toFixed(0)}`);
        l.setAttribute('pathLength', '1'); l.style.setProperty('--i', i);
        const g = l.cloneNode(); g.setAttribute('class', 'g');
        cracks.append(g, l);
      });
      put(n, el('div', 'pc-void m'), cracks, el('div', 'fx-flash small m'),
        put(el('div', 'fx-fst s'), el('div', 'bgj jp', JP('崩壊', '')), el('div', 't', 'FAILED SYSTEM TEST'), el('div', 'sub', v.label), el('div', 'm2', 'Pretests passed. The full tests did not.')));
      mount(n, { dur: 2200 });
      if (!n.classList.contains('is-still')) {
        const list = pieces(n, polys, fewer);
        const use = list.length === polys.length ? dirs : dirs.filter((_, k) => k % 2 === 1);   // the outer shard's direction for each wedge
        list.forEach((pc, i) => {
          const [dx, dy, k, j] = use[i];
          const dist = (70 + (j * 37) % 80) * k + 20;
          pc.classList.add('shard');
          pc.style.setProperty('--tx', (dx * dist).toFixed(0) + 'px'); pc.style.setProperty('--ty', (dy * dist).toFixed(0) + 'px');
          pc.style.setProperty('--rot', (((j * 53) % 13) - 6) * (k < 1 ? 0.5 : 1) + 'deg');
          pc.style.transformOrigin = `${p.x + dx * 200 - pc.__box.x}px ${p.y + dy * 200 - pc.__box.y}px`;
        });
      }
      return { node: n, sound: 'shatter' };
    }
    return null;
  }

  /* the fight itself: my hero and THIS problem's monster on its land (PIXEL.md) */
  function arena(n, v, won) {
    const P = globalThis.__cftsPixel;
    if (!P) return;
    const { m, hero, land } = P.fighters(v.facts);
    const t = document.createElement('template');
    t.innerHTML = `<div class="px-duel s ${won ? 'won' : 'lost'} land-${land}"><div class="px-arena"><div class="px-foe">${P.sprite(m, 48)}<i class="pad"></i></div><div class="px-ally">${P.heroSprite(hero, 48)}<i class="pad"></i></div></div></div>`;
    const duel = t.content.firstElementChild;
    if (won) {
      /* it bursts into its own pixels: six by six pieces of its sprite */
      const foe = duel.querySelector('.px-foe');
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
        const s = el('i', 'px-shard m' + (m.unknown ? ' unk' : ''));
        s.style.cssText = `--x:${x * 36}px;--y:${y * 36}px;--bx:${-(m.v * 2 * 216 + x * 36)}px;--by:${-(m.sp * 216 + y * 36)}px;--dx:${(x - 2.5) * (70 + (x * 7 + y * 13) % 50)}px;--dy:${(y - 4.5) * (40 + (x * 11 + y * 5) % 30)}px`;
        foe.append(s);
      }
    }
    n.append(duel);
  }
  function pixelVerdict(v) {
    const n = el('div', 'fx-p');
    placeVars(n, v);
    const N = v.n || v.judged || 0;
    if (v.kind === 'ac') {
      n.classList.add(v.first ? 'fx-perfect' : 'fx-ko');
      n.append(el('div', 'px-dim s'));
      arena(n, v, true);
      put(n, el('div', 'px-flash m'), hud(v.hud || { handle: v.facts.handle, col: v.facts.col, rating: v.facts.rating, rankName: v.facts.rankName, pid: v.facts.pid }, '0%'));
      for (let i = 0; i < 6; i++) { const b = el('div', 'px-burst m'); b.style.setProperty('--i', i); n.append(b); }
      put(n, put(el('div', 'fx-center px-word-big s'), v.first ? pix('PERFECT!', 24, '#ffcd75') : pix('K.O.!', 34, '#b13e53')),
        el('div', 'fx-center px-msg s', (v.first ? 'FIRST TRY · ' : 'ACCEPTED · ') + (N ? `ALL ${N} TESTS` : v.facts.pid || '')));
      return { node: mount(n, { dur: 2000 }), sound: v.first ? 'perfect' : 'ko' };
    }
    if (v.kind === 'pretests') {
      n.classList.add('fx-pretests');
      put(n, el('div', 'px-dim s'), put(el('div', 'fx-center px-word-big s'), pix('PRETESTS OK', 12, '#73eff7')), el('div', 'fx-center px-msg s', 'SYSTEM TEST PENDING'));
      return { node: mount(n, { dur: 1600 }), sound: 'pretests' };
    }
    if (v.kind === 'ce') {
      n.classList.add('fx-syntax');
      put(n, put(el('div', 'px-chip s'), document.createTextNode('SYNTAX ERROR · COMPILATION ERROR')));
      return { node: mount(n, { dur: 1400 }), sound: 'syntax' };
    }
    n.classList.add('fx-continue');
    const label = v.kind === 'fst' ? 'FAILED SYSTEM TEST · ' + v.label : v.kind === 'hacked' ? 'HACKED' : v.label;
    n.append(el('div', 'px-dim deep s'));
    arena(n, v, false);
    put(n, el('div', 'fx-center px-msg top s', label), put(el('div', 'fx-center px-cont s'), pix('CONTINUE?', 16, '#f4f4f4')));
    ['9', '8', '7'].forEach((d, i) => { const k = put(el('div', 'fx-center px-count' + (i ? ' m' : ' s') + (i === 2 ? ' last' : '')), pix(d, 26, '#ffcd75')); k.style.setProperty('--i', i); n.append(k); });
    n.append(el('div', 'fx-center px-blink m', 'PRESS ANY KEY'));
    return { node: mount(n, { dur: 2200 }), sound: 'continue' };
  }

  /* ---- Vintage Paper: the press. Every sentence is built from facts: the row,
     the cached rating, my other rows for the same problem on this page. The
     templates vary the wording, never the facts. ------------------------------- */
  const pick = (seed, list) => list[Math.abs(seed) % list.length];
  const seedOf = (s) => { let h = 7; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };
  const DATE = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  function frontPage(o) {
    const np = el('div', 'np s');
    put(np, el('div', 'mast', 'The Daily Verdict'),
      put(el('div', 'date'), el('span', null, DATE()), el('span', null, o.edition || ''), el('span', null, o.right || '')),
      el('div', 'extra', o.kicker), el('div', 'head', o.head), el('div', 'deck', o.deck));
    const cols = el('div', 'cols');
    o.body.forEach((p, i) => { if (i === 2 && o.fig) cols.append(el('div', 'fig', o.fig)); cols.append(el('p', null, p)); });
    np.append(cols);
    return np;
  }
  function earlierLine(f) {
    const e = f.earlier || [];
    if (!e.length) return `It is the only submission to ${f.pid} by ${f.handle} on this page.`;
    const tally = {};
    e.forEach((x) => { tally[x] = (tally[x] || 0) + 1; });
    const parts = Object.entries(tally).map(([k, c]) => (c > 1 ? `${k} (${c}×)` : k));
    return `This page also shows ${e.length} earlier submission${e.length > 1 ? 's' : ''} by ${f.handle} to ${f.pid}: ${parts.join(', ')}.`;
  }
  function paperVerdict(v) {
    const f = v.facts, s = seedOf(f.id), N = v.n || v.judged || 0, u = v.unit || 'test', U = u.charAt(0).toUpperCase() + u.slice(1);
    const n = el('div', 'fx-r');
    placeVars(n, v);
    if (v.kind === 'ac' || v.kind === 'pretests') {
      const pre = v.kind === 'pretests';
      const who = f.handle || 'You', lang = f.lang ? `${f.lang} ` : '';
      const body = [
        pre ? pick(s, [`${who}'s ${lang}solution to ${f.pid}${f.name ? `, “${f.name}”,` : ''} passed its pretests.`, `The pretests for ${f.pid}${f.name ? `, “${f.name}”,` : ''} were passed by ${who}'s ${lang}submission.`])
            : pick(s, [`${who}'s ${lang}solution to ${f.pid}${f.name ? `, “${f.name}”,` : ''} was accepted.`, `The judges accepted ${who}'s ${lang}submission for ${f.pid}${f.name ? `, “${f.name}”` : ''}.`]),
        [f.time && `It ran in ${f.time}`, f.mem && `used ${f.mem}`].filter(Boolean).join(' and ') + (f.time || f.mem ? '.' : ''),
        N ? pick(s >> 3, [`This page watched it pass ${N} tests.`, `${N} tests were seen passing on this page.`]) : '',
        pre ? 'The system test has not run yet.' : '',
        earlierLine(f),
        f.rating ? `${who} is rated ${f.rating}${f.rankName ? ` (${f.rankName})` : ''}.` : '',
      ].filter(Boolean);
      n.classList.add('fx-extra');
      put(n, el('div', 'sdim s'), frontPage({ kicker: pre ? 'EXTRA!' : 'EXTRA! EXTRA!', head: `${who} ${pre ? 'holds' : 'cracks'} ${f.pid || 'the problem'}`,
        deck: [f.name && `“${f.name}”`, pre ? 'system test pending' : f.time, !pre && N ? `all ${N} tests` : ''].filter(Boolean).join(' · '),
        edition: f.id ? `Submission ${f.id}` : '', right: f.lang || '', body, fig: [pre ? 'Pretests passed' : 'Accepted', f.time, f.mem].filter(Boolean).join(' · ') }));
      return { node: mount(n, { dur: 2200 }), sound: pre ? 'pretests' : 'extra' };
    }
    /* a rejected verdict: the correction slip under my row */
    const what = {
      wa: [`CORRECTION: ${u} ${N || '?'}`, `${f.handle}'s ${f.pid} gives a wrong answer on ${u} ${N || '?'}.`],
      tle: [`CORRECTION: time limit, ${u} ${N || '?'}`, `${f.handle}'s ${f.pid} exceeds the time limit on ${u} ${N || '?'}${f.time ? ` (${f.time})` : ''}.`],
      mle: [`CORRECTION: memory limit, ${u} ${N || '?'}`, `${f.handle}'s ${f.pid} exceeds the memory limit on ${u} ${N || '?'}${f.mem ? ` (${f.mem})` : ''}.`],
      err: [`CORRECTION: ${v.label.toLowerCase().replace(/ on (pre)?test \d+/, '')}${N ? `, ${u} ${N}` : ''}`, `${f.handle}'s ${f.pid}: ${v.label.charAt(0) + v.label.slice(1).toLowerCase()}.`],
      ce: ['CORRECTION: compilation error', `${f.handle}'s ${f.pid} did not compile${f.lang ? ` (${f.lang})` : ''}.`],
      hacked: ['CORRECTION: hacked', `${f.handle}'s ${f.pid} was hacked: another participant's test breaks it.`],
      fst: [`CORRECTION: system test ${N || ''}`.trim(), `${f.handle}'s ${f.pid} passed its pretests but not the system test: ${v.label.charAt(0) + v.label.slice(1).toLowerCase()}.`],
    }[v.kind] || ['CORRECTION', `${f.handle}'s ${f.pid}: ${v.label}.`];
    const extra = v.kind === 'wa' || v.kind === 'tle' || v.kind === 'mle' || v.kind === 'err'
      ? (N > 1 ? (N === 2 ? `${U} 1 stood.` : `${U}s 1–${N - 1} stood.`) : N === 1 ? 'It fails the first example. Check the sample.' : '') : '';
    n.classList.add('fx-correction');
    const slip = put(el('div', 'slip s'), el('h4', null, what[0]), put(el('div', 'txt'), document.createTextNode([what[1], extra].filter(Boolean).join(' ') + ' '), el('i', null, '— The Daily Verdict')));
    put(n, slip, el('div', 'rstamp s', 'CORRECTED'));
    return { node: mount(n, { dur: 2200 }), sound: 'correction' };
  }

  /* ======================================================================== */
  /* 4. level up. d: { handle, oldRating, newRating, col, oldCol, rank, oldRank, rankChange, contest } */
  function levelup(d) {
    const t = theme();
    const n = el('div', 'fx-l');
    if (t === 'anime') {
      n.classList.add('fx-awaken');
      n.style.setProperty('--a1', rankVar(d.oldCol)); n.style.setProperty('--a2', rankVar(d.col));
      const flames = (cls) => { const w = el('div', 'aw-flames m ' + cls); for (let i = 0; i < 7; i++) { const f = el('i'); f.style.setProperty('--i', i); w.append(f); } return w; };
      put(n, el('div', 'fx-dim2 s'), flames('old'), flames('new'), el('div', 'aw-aura old m'), el('div', 'aw-aura new s'), el('div', 'aw-motes m'),
        put(el('div', 'aw-card s'), el('div', 'j jp', JP('覚醒', 'AWAKENING')), el('div', 'h', d.handle),
          el('div', 'r', `${d.oldRating} → ${d.newRating}  (+${d.newRating - d.oldRating})`),
          d.rankChange ? put(el('div', 'rk'), el('span', 'o', d.oldRank.toUpperCase()), document.createTextNode(' → '), el('span', 'nw', d.rank.toUpperCase())) : null));
      mount(n, { dur: 2200 });
      /* my handles on the page take the new rank colour during the transform, then go back (Codeforces shows the new rank itself once its cache updates) */
      if (d.rankChange && !n.classList.contains('is-still')) later(n, 700, () => recolour(n, d));
      return { node: n, sound: 'awaken' };
    }
    if (t === 'pixel') {
      n.classList.add('fx-plevel');
      put(n, el('div', 'px-dim s'), put(el('div', 'fx-center px-word-big s'), pix('LEVEL UP!', 20, '#a7f070')),
        el('div', 'fx-center px-msg s', (d.rankChange ? `${d.oldRank} → ${d.rank} · ` : '').toUpperCase() + `${d.oldRating} → ${d.newRating}`));
      return { node: mount(n, { dur: 2200 }), sound: 'levelup' };
    }
    if (t === 'paper') {
      n.classList.add('fx-extra');
      const body = [`${d.handle}'s rating moves from ${d.oldRating} to ${d.newRating} (+${d.newRating - d.oldRating})${d.contest ? ` after ${d.contest}` : ''}.`,
        d.rankChange ? `The new rank is ${d.rank}; the old one was ${d.oldRank}.` : `The rank stays ${d.rank}.`];
      put(n, el('div', 'sdim s'), frontPage({ kicker: 'BY ORDER OF THE RATING BOARD', head: d.rankChange ? `Promoted to ${d.rank}` : `Rating rises to ${d.newRating}`,
        deck: `${d.handle} · ${d.oldRating} → ${d.newRating}`, edition: d.contest || '', right: '', body, fig: `${d.oldRating} → ${d.newRating}` }));
      n.querySelector('.np').style.setProperty('--ink', rankVar(d.col));
      return { node: mount(n, { dur: 2200 }), sound: 'promoted' };
    }
    if (t === 'fastlap') {
      const up = d.newRating - d.oldRating;
      const o = { kind: 'up', c: rankVar(d.col), chq: false, head: d.rankChange ? 'RANK UP · ' + String(d.rank).toUpperCase() : 'RATING UP',
        sub: [d.handle, d.contest].filter(Boolean).join(' · ').toUpperCase(), num: '+' + up, numLab: `${d.oldRating} → ${d.newRating}` };
      return { node: mount(raceControl(o), { dur: 2200 }), sound: 'promoted' };
    }
    return null;
  }
  function recolour(n, d) {
    const me = String(d.handle || '').toLowerCase();
    const links = [...document.querySelectorAll('a.rated-user[href^="/profile/"]')].filter((a) => (a.getAttribute('href').split('/')[2] || '').toLowerCase() === me);
    links.forEach((a) => {
      const was = [...a.classList].filter((c) => /^user-/.test(c));
      was.forEach((c) => a.classList.remove(c));
      a.classList.add('user-' + d.col, 'cfts-fx-recolour');
      n.__undo.push(() => { a.classList.remove('user-' + d.col, 'cfts-fx-recolour'); was.forEach((c) => a.classList.add(c)); });
    });
  }

  root.CFTSFx = { vs, combo, verdict, levelup, setJapanese: (on) => { jp = on !== false; }, cost: lastCost, pix,
    end: () => { if (current) current(); } };
})(globalThis);
