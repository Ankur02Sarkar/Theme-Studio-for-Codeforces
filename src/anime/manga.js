/* =============================================================================
   anime/manga.js  (content script)   Accepted: your page goes to print (ANIME.md)

   The dark interface snaps to WHITE PAPER: the real screen, redrawn from the DOM, inverted and printed in true screentone. Then the
   win is told in panels, on that page, in black ink and one spot colour. The arc picks the format, so the same page never prints twice:
     koma    Daily Life    四コマ  a deadpan four-panel strip. The joke is how easy it was
     mont    Training      a montage of slanted panels slamming in from both sides
     spread  Battle        a double-page spread: black page, the hero breaks out of the frame
     colour  Final Battle  ink flickers to its negative, then the one colour page in the book
   Every format ends on 完 and the credits: the real facts of the run. Then the page turns and your screen is back.
   The print arrives as a wave of ink across the real page; every panel lands with a kick and a spray (sakuga.js's FX).
   One stage of plain DOM timed by CSS; nothing else runs. Any key or click skips. am:finish-seek jumps there (tests).
============================================================================= */
(() => {
  const Z = 2147482600, END = 5700, CARD = 2850;
  const MODES = ['koma', 'mont', 'spread', 'colour'];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const preload = (urls) => urls.forEach((u) => { if (u) new Image().src = u; });

  /* print the screen: the dark UI inverts onto paper (a light glass is printed as it is) and every tone becomes dots on a 45 degree lattice. A tile, so 1.3 M pixels stay cheap */
  function print(src, W, H, negative) {
    const P = 6, tile = new Float32Array(P * P), light = document.documentElement.getAttribute('data-cf-mode') === 'light';
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) tile[y * P + x] = .5 + .25 * (Math.cos(2 * Math.PI * (x + y) / P) + Math.cos(2 * Math.PI * (x - y) / P));
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#08070c'; c.fillRect(0, 0, W, H);
    c.drawImage(src, 0, 0, W, H);
    const im = c.getImageData(0, 0, W, H), d = im.data;
    const paper = negative ? [12, 10, 16] : [245, 243, 238], ink = negative ? [245, 243, 238] : [12, 10, 16];
    for (let i = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) {
      const l0 = (.2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]) / 255, l = light ? 1 - l0 : l0;
      const a = Math.max(0, Math.min(1, (l - .1) / .52));        // near-black is bare paper, bright text is solid ink
      const k = a > tile[(y % P) * P + (x % P)] ? ink : paper;
      d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2];
    }
    c.putImageData(im, 0, 0);
    return cv;
  }

  const crop = (u, cls) => `<i class="crop ${cls}" style="background-image:url('${u}')"></i>`;
  const LAYOUT = {
    koma: (o) => `<div class="koma"><div class="pn p1" style="--at:260ms">${crop(o.stand, 'bust')}<span class="bub">Submitting.</span></div>
      <div class="pn p2" style="--at:720ms"><b class="jp foe">${o.seal}</b><span class="bub r">……</span></div>
      <div class="pn p3" style="--at:1180ms"><i class="speed"></i>${crop(o.strike, 'lunge')}<b class="sfx jp">ズバッ</b></div>
      <div class="pn p4" style="--at:1640ms"><b class="jp foe cut">${o.seal}</b>${crop(o.stand, 'bust back')}<span class="bub won">Accepted.</span></div>
      <b class="side jp">${o.tech[0]}</b></div>`,
    mont: (o) => `<div class="mont"><div class="pn m1" style="--at:220ms">${crop(o.strike, 'eye')}</div>
      <div class="pn m2" style="--at:480ms">${crop(o.strike, 'edge')}<b class="sfx jp">ドドド</b></div>
      <div class="pn m3" style="--at:740ms"><b class="jp foe">${o.seal}</b><span class="nm">${esc(o.rival)}</span></div>
      <div class="pn m4" style="--at:1000ms"><i class="speed"></i>${crop(o.strike, 'all')}<b class="sfx jp">ズバッ</b></div>
      <div class="acc" style="--at:1420ms"><b>Accepted</b><span class="jp">${o.tech[0]}</span></div></div>`,
    spread: (o) => `<div class="spread" style="--at:220ms"><i class="speed"></i><div class="box"></div>${crop(o.strike, 'all')}<b class="sfx jp">ズドン</b>
      <div class="acc" style="--at:1100ms"><b>Accepted</b><span class="jp">${o.tech[0]}</span></div></div>`,
    colour: (o) => `<div class="flick" style="--at:120ms"></div><div class="colour" style="--at:900ms"><div class="plate" style="background-image:url('${o.wall}')"></div>${crop(o.strike, 'all')}<b class="v jp">${o.tech[0]}</b>
      <div class="acc" style="--at:1300ms"><b>Accepted</b></div></div>`,
  };

  let live = null;
  function play(o) {
    if (live || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const W = innerWidth, H = innerHeight, mode = o.mode || MODES[o.land] || 'koma';
    const t0p = performance.now();
    const rp = globalThis.__cftsPixelShatter.repaint(W, H, 1, o.paint);
    const page = document.createElement('canvas');
    page.width = W; page.height = H;
    const pc = page.getContext('2d');
    pc.drawImage(rp.pg, 0, 0); pc.drawImage(rp.tx, 0, 0);
    const paper = print(page, W, H);
    paper.className = 'paper';
    const printMs = performance.now() - t0p;

    /* the end card: the run in numbers, each against its limit; the numbers count up and the bars fill to where you landed */
    const ms = parseInt(o.time, 10) || 0, kb = parseInt(o.mem, 10) || 0;
    const stat = (k, v, unit, lim) => `<div class="st"><span>${k}</span><b data-n="${v}">0</b><em>${unit}</em>${lim ? `<i class="bar"><u style="--v:${Math.min(1, v / lim).toFixed(3)}"></u></i><small>${Math.round(v / lim * 100)}% of the limit</small>` : ''}</div>`;
    const stage = document.createElement('div');
    stage.id = 'am-page'; stage.setAttribute('aria-hidden', 'true'); stage.setAttribute('data-cfts', ''); stage.dataset.mode = mode;
    stage.style.cssText = `z-index:${Z};--acc:${o.accent};--foe:${o.ink}`;
    stage.innerHTML = `${LAYOUT[mode](o)}<div class="turn" style="--at:${CARD}ms"><div class="ec-art" style="background-image:url('${o.wall}')"></div><img class="ec-hero" src="${o.strike}" alt="">
      <div class="ec"><div class="ec-h"><b class="jp kan">完</b><div><span>Episode cleared</span><h3>${esc(o.name || '')}</h3></div></div>
        <div class="ec-st">${ms ? stat('Time', ms, 'ms', o.limitMs) : ''}${kb ? stat('Memory', kb, 'KB', o.limitKb) : ''}<div class="st try"><span>Attempt</span><b>${o.first ? 'First try' : `No. ${(o.tries || 0) + 1}`}</b></div></div>
        <p class="ec-f"><b class="jp">${o.tech[0]}</b>${esc(o.tech[2])}${o.handle ? `<span>Starring ${esc(o.handle)}</span>` : ''}</p></div></div>`;
    stage.prepend(paper);
    if (mode === 'colour') { const n = print(page, W, H, true); stage.querySelector('.flick').append(n); }
    document.documentElement.append(stage);

    const S = { done: false, timers: [] };
    live = S;
    /* the ink has weight: every panel lands with a kick and a spray, and the heavy hits take the frame with them */
    const K = globalThis.__cftsSakuga, fx = K.overlay(stage, 6);
    const ink = '#0c0a10', at = (ms, f) => S.timers.push(setTimeout(f, ms));
    const kick = (px) => stage.animate([{ transform: `translate(${px}px,${px * .6}px) scale(1.012)` }, { transform: `translate(${-px * .7}px,${-px * .5}px) scale(1.012)` }, { transform: `translate(${px * .4}px,${px * .2}px) scale(1.006)` }, { transform: 'none' }], { duration: 240 });
    const hit = (x, y, px, col = ink, n = 26) => { fx.splat(x, y, n, col, px / 11); fx.ring(x, y, col, .5 + px / 26, 14); kick(px); };
    const big = (x, y, px) => { hit(x, y, px, ink, 60); fx.lines(x, y, ink, .22); fx.flash(.7); fx.sparks(x, y, 50, o.accent, 1.2); };
    fx.flash(.85); fx.ring(W * .5, H * .5, ink, 1.6, 22); kick(10);
    const cx = W / 2, rows = H / 4;
    ({
      koma: () => { at(260, () => hit(cx, rows * .5, 7)); at(720, () => hit(cx, rows * 1.5, 7)); at(1180, () => big(cx, rows * 2.5, 18)); at(1640, () => hit(cx, rows * 3.5, 12)); },
      mont: () => { at(220, () => hit(W * .8, H * .13, 10)); at(480, () => hit(W * .2, H * .36, 10)); at(740, () => hit(W * .8, H * .6, 10)); at(1000, () => big(W * .3, H * .84, 22)); at(1420, () => hit(W * .8, H * .9, 12, o.accent, 40)); },
      spread: () => { at(220, () => big(W * .62, H * .4, 30)); at(520, () => hit(W * .18, H * .2, 16, o.accent, 40)); at(1100, () => hit(W * .8, H * .88, 12, o.accent, 40)); for (let t = 300; t < 2800; t += 110) at(t, () => fx.sparks(W * K.rnd(.5, .98), H * K.rnd(.28, .42), 5, '#fff', .9)); },
      colour: () => { at(900, () => { fx.flash(1); kick(26); fx.sparks(W * .7, H * .36, 90, '#ffd27a', 1.5); fx.lines(W * .7, H * .36, '#fff', .28); }); for (let t = 940; t < 2850; t += 60) at(t, () => { fx.embers(3, '#ff8a3c', W, H); if (t % 5 === 0) fx.sparks(W * .68, H * .36, 4, '#fff', .7); }); at(1120, () => kick(14)); at(1300, () => hit(W * .8, H * .9, 12, o.accent, 30)); },
    })[mode]();
    const CUES = { koma: [[0, 'inkslam'], [260, 'panel'], [720, 'panel'], [1180, 'smash'], [1640, 'panel']], mont: [[0, 'inkslam'], [220, 'panel'], [480, 'panel'], [740, 'panel'], [1000, 'smash'], [1420, 'slam']], spread: [[0, 'inkslam'], [220, 'smash'], [520, 'slam'], [1100, 'slam']], colour: [[0, 'inkslam'], [120, 'smash'], [280, 'panel'], [440, 'panel'], [900, 'smash'], [1120, 'slam'], [1300, 'slam']] }[mode];
    for (const [t, k] of CUES) S.timers.push(setTimeout(() => o.sound(k), t));
    S.timers.push(setTimeout(() => o.sound('pageturn'), CARD));
    at(CARD + 420, () => o.sound('eyecatch'));
    at(CARD + 220, () => {
      const r = stage.querySelector('.kan').getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      fx.ring(x, y, o.accent, 1.2, 14); fx.sparks(x, y, 60, '#fff', 1); fx.splat(x, y, 30, o.accent, 1); o.sound('slam');
      const run = [...stage.querySelectorAll('[data-n]')], s0 = performance.now();
      const count = setInterval(() => { const p = Math.min(1, (performance.now() - s0) / 620), e = 1 - (1 - p) ** 3; run.forEach((n) => { n.textContent = Math.round(+n.dataset.n * e).toLocaleString('en-US'); }); if (p >= 1) clearInterval(count); }, 33);
      S.timers.push(count);
    });
    for (let t = CARD + 300; t < END - 300; t += 90) at(t, () => { fx.embers(2, o.accent, W, H); if (t % 3 === 0) fx.petals(1, W, H); });
    function finish() {
      if (S.done) return;
      S.done = true; S.timers.forEach(clearTimeout); clearTimeout(S.end);
      removeEventListener('keydown', finish, true); removeEventListener('pointerdown', finish, true); document.removeEventListener('am:finish-seek', seek);
      /* the page fades back through the card, never a hard cut */
      stage.style.pointerEvents = 'none';
      const f = stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: S.seeking ? 40 : 520, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' });
      f.onfinish = () => {
        fx.stop(); stage.remove(); live = null;
        document.dispatchEvent(new CustomEvent('am:finish-done', { detail: JSON.stringify({ mode, printMs }) }));
        if (o.onEnd) o.onEnd();
      };
    }
    const seek = (e) => { S.seeking = true; S.timers.forEach(clearTimeout); clearTimeout(S.end); fx.clear(); fx.stop(); stage.getAnimations({ subtree: true }).forEach((a) => { a.pause(); a.currentTime = +e.detail; }); if (+e.detail >= END) finish(); };
    addEventListener('keydown', finish, true); addEventListener('pointerdown', finish, true);
    document.addEventListener('am:finish-seek', seek);
    S.end = setTimeout(finish, END);
    return S;
  }
  globalThis.__cftsAnimeManga = { play, preload, MODES };
})();
