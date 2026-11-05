/* =============================================================================
   pixel/duel.js  (content script)   the problem page's fight (PIXEL.md)
   Read, write and submit on one screen, with the monster watching. Run and Submit are the proven paths of the LeetCode
   theme and FASTLAP: Custom Test through the page's own jQuery (bridge.js), and Codeforces' own Submit form, read from
   its page and POSTed, with the verdict read from your submissions in a hidden frame Codeforces keeps live itself.
   Only on a click. Failures are said plainly. Drafts share cfmCode with the LeetCode theme.
============================================================================= */
(() => {
  const EXT = location.origin === 'null' ? '' : new URL(chrome.runtime.getURL('')).origin;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const WATCH_MS = 180000, CODE_KEY = 'cfmCode', SUBS = 'cfmSubmissions';
  const SEL = { form: 'form.submit-form, form[action*="submit"]', lang: 'select[name="programTypeId"]', source: 'textarea[name="source"]', problem: 'select[name="submittedProblemIndex"]', error: '.error, span.error, .for__source', row: 'table.status-frame-datatable tr[data-submission-id]', cell: 'td.status-verdict-cell' };
  const signedOut = (d) => !!d.querySelector('a[href*="/enter"]') && !d.querySelector('a[href*="logout"]');
  const csrfOf = (d) => (d.querySelector('.csrf-token[data-csrf]') || { dataset: {} }).dataset.csrf || (d.querySelector('meta[name="X-Csrf-Token"]') || {}).content || (d.querySelector('input[name="csrf_token"]') || {}).value || '';
  async function page(url, init, ms = 15000) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(url, Object.assign({ credentials: 'include', signal: ctl.signal }, init || {}));
      if (/^\/enter\/?$/.test(new URL(res.url, location.href).pathname)) throw new Error('Sign in to Codeforces first');
      return { d: new DOMParser().parseFromString(await res.text(), 'text/html'), url: res.url, status: res.status };
    } catch (e) { if (e.name === 'AbortError') throw new Error('Codeforces did not answer in time'); throw e; } finally { clearTimeout(to); }
  }
  /* a verdict's text -> what the fight does */
  function kindOf(t) {
    if (/^Pretests (and hacks )?passed/i.test(t)) return 'pretests';
    if (/^(Accepted|Perfect result)/i.test(t)) return 'ac';
    if (/^Wrong answer/i.test(t)) return 'wa';
    if (/^(Time limit|Idleness limit)/i.test(t)) return 'tle';
    if (/^Memory limit/i.test(t)) return 'mle';
    if (/^Compilation error/i.test(t)) return 'ce';
    if (/^Hacked/i.test(t)) return 'hacked';
    return 'err';
  }
  function readRow(d) {
    const tr = d.querySelector(SEL.row), td = tr && tr.querySelector(SEL.cell);
    if (!tr || !td) return null;
    const text = (td.textContent || '').replace(/\s+/g, ' ').trim(), j = td.querySelector('.verdict-format-judged');
    const cell = (c) => ((tr.querySelector('.' + c) || {}).textContent || '').replace(/\s+/g, ' ').trim();
    return { id: tr.getAttribute('data-submission-id') || '', text, n: j ? parseInt(j.textContent, 10) || 0 : 0, time: cell('time-consumed-cell'), mem: cell('memory-consumed-cell'),
      waiting: td.getAttribute('waiting') === 'true' || /^(in queue|running|testing|judging|compiling)/i.test(text) || !text };
  }
  function preText(pre) {
    const k = pre.cloneNode(true);
    k.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
    const lines = k.querySelectorAll('.test-example-line');
    const t = lines.length ? [...lines].map((l) => l.textContent).join('\n') : k.textContent;
    return t.replace(/\r/g, '').replace(/\s+$/, '') + '\n';
  }
  const same = (a, b) => { const x = String(a).trim().split(/\s+/), y = String(b).trim().split(/\s+/); return x.length === y.length && x.every((t, i) => t === y[i]); };   // checkers compare tokens

  /* ctx: { j, right: the column, arena, cid, idx, submitUrl, handle, langs: [{id,name}], defaultLang, multi, won, tries, samples root } */
  function build(ctx) {
    const { j, arena, log, cmd, edwrap } = ctx;
    const PID = ctx.cid + ctx.idx;
    const S = { lang: ctx.defaultLang, codes: {}, code: '', lastSaved: '', ready: false, busy: false, hp: ctx.won ? 0 : 100, tries: ctx.tries, wait: {}, seq: 0, sound: true, vol: 1, idle: 0, won: ctx.won };
    /* the plumbing is shared, the telling is not (ANIME.md): a theme with a director draws the whole fight itself. Everything below
       that shows a monster, HP or a blow is Pixel's and stands down; Run, Submit, the verdict watch, drafts and the log stay */
    const ST = ctx.stage || {}, D = ST.director, P = ST.prefix || 'px', cn = (c) => (P === 'px' ? c : c.replace(/\bpx-/g, `${P}-`));
    const W = Object.assign({ ko: 'K.O.!', perfect: 'PERFECT!', holding: 'HOLDING', fizzle: 'FIZZLE', ce: 'The spell never left your hands: no test ran and this attempt costs nothing.', log: 'Waiting for a judge. Your hero is charging.', wa: 'MISS!', tle: 'TOO SLOW', mle: 'OVERFLOW', err: 'CRASH', hacked: 'HACKED', hit: 'HIT', miss: 'MISS', ready: 'All samples passed. Ready to strike.', hint: 'Read it, write your answer, Ctrl+Enter to strike.' }, ST.words);
    const q = (s) => arena.querySelector(cn(s));
    const langName = (id) => (ctx.langs.find((l) => l.id === id) || { name: '' }).name;
    const SFX = globalThis.LCTSSounds;
    const sfx = (k) => { try { if (S.sound && SFX) SFX.play((ST.sound && ST.sound[k]) || k, { theme: ctx.theme || 'pixel', volume: S.vol }); } catch (e) { /* no sound is fine */ } };

    /* ---- the stage -------------------------------------------------------------------------------------------- */
    const hpBar = q('.hp.foe'), foeCap = q('.foecap');
    const setHp = (v, cap) => {
      if (D) return;
      S.hp = v; q('.hp.foe i').style.width = Math.round(v) + '%';
      hpBar.classList.toggle('mid', v <= 50 && v > 20); hpBar.classList.toggle('low', v <= 20);
      foeCap.textContent = cap || (v <= 0 ? 'Defeated' : v >= 100 ? 'Full health' : 'Wounded');
    };
    /* HP is the judge's progress, nothing else. "Running on test N" means N - 1 tests are behind you. Codeforces doesn't say how many
       tests a problem has, so: with a known total (you beat it before) the bar is exact; without one it is an estimate from the test
       number that can't reach zero early, and the caption says which. Skipped updates change nothing: only N counts. */
    const hpFor = (n) => (S.total ? Math.max(3, 100 * (1 - (n - 1) / S.total)) : Math.max(3, 100 * 24 / (24 + n - 1)));
    const capFor = (n) => (S.total ? `Test ${n} of ${S.total}` : `Test ${n}, ${n - 1} passed`);
    /* the hero's weapon, by land: arrow, bolt, fireball, beam. The last shot is the same weapon, for real (shatter.js) */
    function shoot(n) {
      const a = arena.getBoundingClientRect(), f = q('.px-foe').getBoundingClientRect(), h = q('.px-ally').getBoundingClientRect();
      const x = h.left - a.left + h.width * .78, y = h.top - a.top + h.height * .66, tx = f.left - a.left + f.width / 2, ty = f.top - a.top + f.height / 2;
      const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy), e = document.createElement('i');
      e.className = cn(`px-shot k${ctx.land}`);
      e.style.cssText = `--x:${x}px;--y:${y}px;--dx:${dx}px;--dy:${dy}px;--d:${d}px;--a:${ctx.land === 2 ? 0 : Math.atan2(dy, dx)}rad`;
      arena.append(e); setTimeout(() => e.remove(), 240);
      setTimeout(() => { const sp = document.createElement('i'); sp.className = cn('px-spark'); sp.style.cssText = `--x:${tx}px;--y:${ty}px`; arena.append(sp); setTimeout(() => sp.remove(), 200); }, 190);
    }
    /* waiting on the judge: a label, the time it has been, a moving bar: never a frozen screen */
    const wait = q('.px-wait');
    let waitT = 0;
    function waiting(label) {
      if (D) return void D.waiting(label);
      if (!label) { clearInterval(waitT); waitT = 0; wait.hidden = true; return; }
      wait.querySelector('b').textContent = label; wait.hidden = false;
      if (waitT) return;
      const t0 = Date.now(), el = wait.querySelector('.el');
      el.textContent = '0 s';
      waitT = setInterval(() => { el.textContent = `${Math.round((Date.now() - t0) / 1000)} s`; }, 1000);
    }
    const pop = (text, side, tone = '') => {
      if (D) return;
      const p = document.createElement('span');
      p.className = cn(`px-pop ${side} ${tone}`); p.textContent = text;
      arena.append(p); setTimeout(() => p.remove(), 900);
    };
    /* every loss ends the same way: the words go, the hero gets back up, the next round is yours */
    const recover = (ms) => {
      if (D) return;
      clearTimeout(S.upT);
      S.upT = setTimeout(() => {
        const v = [...arena.classList].find((c) => /^v-/.test(c));
        clearFx(); S.idle = 0;
        if (v && v !== 'v-ce') { arena.classList.add('v-up'); sfx('getup'); setTimeout(() => arena.classList.remove('v-up'), 500); }
      }, ms);
    };
    const anim = (cls, ms) => { arena.classList.remove(cls); void arena.offsetWidth; arena.classList.add(cls); setTimeout(() => arena.classList.remove(cls), ms); };
    const bubble = (text) => { if (D) return; const b = q('.px-bub'); b.textContent = text; b.hidden = !text; };
    const clearFx = () => { if (D) return void D.clear(); clearTimeout(S.upT); waiting(''); arena.className = arena.className.split(' ').filter((c) => !/^(v-|act-)/.test(c)).join(' '); q('.px-word').textContent = ''; arena.querySelectorAll(cn('.px-shard, .px-coin, .px-clock, .px-crk')).forEach((n) => n.remove()); S.cracks = 0; };
    const word = (t) => { if (D) return; const w = q('.px-word'); w.textContent = t; };
    function shatter() {
      const foe = q('.px-foe'), m = ctx.monster;
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
        const s = document.createElement('i');
        s.className = cn('px-shard' + (m.unknown ? ' unk' : ''));
        s.style.cssText = `--x:${x * 24}px;--y:${y * 24}px;--bx:${-(m.v * 2 * 144 + x * 24)}px;--by:${-(m.sp * 144 + y * 24)}px;--dx:${(x - 2.5) * (44 + (x * 7 + y * 13) % 40)}px;--dy:${(y - 4.5) * (26 + (x * 11 + y * 5) % 24)}px`;
        foe.append(s);
      }
      for (let i = 0; i < 16; i++) {
        const c = document.createElement('i');
        c.className = cn('px-coin');
        c.style.cssText = `left:${6 + (i * 53) % 88}%;--d:${(i * 61) % 420}ms`;
        arena.append(c);
      }
    }
    function rememberTests(n) {
      S.total = Math.max(S.total || 0, n);
      chrome.storage.local.get('cfPxTests', (r) => { const m = r.cfPxTests || {}; m[PID] = S.total; const k = Object.keys(m); if (k.length > 800) delete m[k[0]]; chrome.storage.local.set({ cfPxTests: m }); });
    }
    /* every blow cracks the glass of the arena a little more: the break builds from the first test */
    function arenaCrack() {
      let cv = arena.querySelector(cn('.px-crk'));
      if (!cv) { cv = document.createElement('canvas'); cv.className = cn('px-crk'); cv.width = Math.ceil(arena.clientWidth / 2); cv.height = Math.ceil(arena.clientHeight / 2); arena.append(cv); }
      const c = cv.getContext('2d'), f = q('.px-foe').getBoundingClientRect(), a0 = arena.getBoundingClientRect();
      const n = 1 + (S.cracks = (S.cracks || 0) + 1) % 3;
      for (let k = 0; k < n; k++) {
        let x = (f.left - a0.left + f.width / 2) / 2 + (Math.random() - .5) * 24, y = (f.top - a0.top + f.height / 2) / 2 + (Math.random() - .5) * 24, a = Math.random() * 6.28;
        const len = 12 + Math.min(40, S.cracks * 2) + Math.random() * 20;
        for (let i = 0; i < len; i++) {
          a += (Math.random() - .5) * .7; x += Math.cos(a) * 1.6; y += Math.sin(a) * 1.6;
          c.fillStyle = '#09080f'; c.fillRect(x | 0, y | 0, 1, 1);
          if (i % 2) { c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect((x | 0) - 1, (y | 0) - 1, 1, 1); }
        }
      }
    }
    /* the killing blow: the page breaks from the monster outwards */
    function breakPage(first, facts, onHit) {
      const B = globalThis.__cftsPixelShatter;
      if (!B || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      const r = q('.px-foe').getBoundingClientRect(), hr = q('.px-ally').getBoundingClientRect();
      const heroImg = () => { const i = new Image(); i.src = chrome.runtime.getURL('textures/pixel/heroes-72.png'); return { img: i, sx: ctx.heroT * 72 }; };
      const hero = heroImg();
      const go = (editor) => setTimeout(() => B.play({ x: r.left + r.width / 2, y: r.top + r.height / 2, hx: hr.left + hr.width * .78, hy: hr.top + hr.height * .66, land: ctx.land, mode: document.documentElement.getAttribute('data-px-break-test') || undefined, first, onHit, facts: first ? 'First try' : facts, editor, ink: ctx.ink,
        landUrl: (k) => chrome.runtime.getURL(`textures/pixel/land-${k}.png`), heroImg: () => hero, sound: sfx }), 260);
      editorPaint(go);
      return true;
    }
    /* Monaco sends its own lines (the page is redrawn, never captured); a slow answer goes without them */
    function editorPaint(cb) {
      const id = 'p' + (++S.seq);
      const late = setTimeout(() => { if (S.wait[id]) { delete S.wait[id]; cb(null); } }, 120);
      S.wait[id] = (m) => { delete S.wait[id]; clearTimeout(late); cb(m.paint); };
      toEd({ op: 'paint', id });
    }
    /* the fight's end: one scene per verdict, the facts in the log, nothing hidden behind it */
    function finale(kind, r) {
      if (!D) clearFx();
      const n = r && r.n;
      const facts = [r && r.time, r && r.mem].filter((x) => x && !/^0 (ms|KB)$/.test(x)).join(' · ');
      S.tries += kind === 'ac' || kind === 'ce' ? 0 : 1;
      if (D) {
        const first = kind === 'ac' && S.tries === 0;
        if (kind === 'ac') S.won = true;
        if (kind === 'ce') { say('Compilation error', 'bad', W.ce); compilerMessage(); }
        else if (kind === 'ac' || kind === 'pretests') say(r.text, kind === 'ac' ? 'ok' : 'gold', [first ? 'First try' : kind === 'ac' ? `Attempt ${S.tries + 1}` : '', facts].filter(Boolean).join(' · '));
        else { say(r.text, 'bad', facts); if (r.id) details(r); }
        if (S.fx === false) D.quiet(kind, r); else D.verdict(kind, r, { first, facts, tries: S.tries, editorPaint });
        return undefined;
      }
      if (kind === 'ac' || kind === 'pretests') {
        const first = kind === 'ac' && S.tries === 0;
        S.won = kind === 'ac';
        if (kind !== 'ac') arena.classList.add('v-pre');
        if (kind === 'ac') {
          /* on impact: the HP empties and the monster bursts when the weapon lands */
          const kill = (now) => { arena.classList.add('v-ac'); if (now) arena.classList.add('now'); setHp(0); shatter(); };
          q('.px-round').textContent = 'Defeated';
          /* the blow lands as the hero reaches it (px-dash), and breaks the interface: src/pixel/shatter.js */
          const small = () => { setTimeout(() => word(first ? W.perfect : W.ko), 460); sfx(first ? 'flawless' : 'victory'); };
          if (S.fx === false || !breakPage(first, facts, () => kill(true))) { kill(false); small(); }
          say(r.text, 'ok', [first ? 'First try' : `Round ${S.tries + 1}`, facts].filter(Boolean).join(' · '));
          /* the trophy: the monster you just beat, joining your collection */
          const got = document.createElement('a');
          got.className = cn('px-got'); got.href = ctx.handle ? `/profile/${encodeURIComponent(ctx.handle)}` : '#';
          got.innerHTML = `${globalThis.__cftsPixel.sprite(ctx.monster, 24)}<span><b>${esc(ctx.speciesName)} joined your collection</b><i>See your Monster Collection</i></span>`;
          setTimeout(() => { log.append(got); log.scrollTop = log.scrollHeight; }, 1500);
          return undefined;
        }
        word(W.holding); sfx('pretests');
        return say(r.text, 'gold', facts);
      }
      if (kind === 'ce') {
        arena.classList.add('v-ce');
        word(W.fizzle);
        sfx('fizzle');
        say('Compilation error', 'bad', W.ce);
        compilerMessage();
        recover(2200);
        return undefined;
      }
      const map = { wa: ['v-wa', W.wa], tle: ['v-tle', W.tle], mle: ['v-mle', W.mle], err: ['v-re', W.err], hacked: ['v-wa', W.hacked] }[kind];
      arena.classList.add(map[0]);
      if (kind === 'tle') { const c = document.createElement('i'); c.className = cn('px-clock'); arena.append(c); }
      setTimeout(() => word(map[1]), kind === 'mle' ? 700 : 260);
      sfx({ tle: 'slow', mle: 'overflow', err: 'crash' }[kind] || 'lose');
      foeCap.textContent = /\d/.test(foeCap.textContent) ? `Survived: ${foeCap.textContent.replace(/,.*$/, '').toLowerCase()}` : 'Survived';   // it stays where you left it; the next submit starts it at full health
      recover(kind === 'tle' ? 3000 : 2600);
      q('.px-round').textContent = `Attempt ${S.tries + 1}`;
      say(r.text, 'bad', facts);
      if (r.id) details(r);
      return undefined;
    }

    /* ---- the right column's heights: yours to set, remembered; a failing test never takes the code's room ---------- */
    const R = ctx.right, ED_MIN = 220, AH = D ? 0 : 288, LH = 132;
    /* what the log may have: the editor's 220 px on its own, down to a sliver when you drag it there yourself */
    const room = (ed = ED_MIN) => R.clientHeight - S.ah - cmd.offsetHeight - 12 - 26 - ed;
    const logH = () => (S.logOff ? 0 : Math.max(48, Math.min(S.lh, room(S.setLog ? 44 : ED_MIN))));
    function layout() {
      if (S.mode) return;
      R.style.setProperty('--ah', S.ah + 'px');
      R.style.setProperty('--lh', logH() + 'px');
      arena.classList.toggle('low', S.ah < 230);       // smaller sprites at whole steps, never a scene that runs off its frame
      arena.classList.toggle('mid', S.ah >= 230 && S.ah < 270);
      R.classList.toggle('log-off', !!S.logOff);
    }
    /* Run and Submit answer in the log: it is never left out of sight */
    const showLog = () => { if (S.mode) setMode(S.mode); if (S.logOff || S.lh < 110) { S.logOff = false; S.lh = Math.max(S.lh, LH); layout(); saveLay(); } };
    const saveLay = () => chrome.storage.local.set({ cfPxLay2: { ah: S.ah, lh: S.lh, logOff: !!S.logOff, headOff: !!S.headOff } });
    /* a full view of the code or of the log; Run and Submit bring the fight back */
    const fsCode = R.querySelector(cn('.px-fscode')), fsLog = R.querySelector(cn('.px-fslog'));
    function setMode(m) {
      S.mode = S.mode === m ? '' : m;
      ctx.app.classList.toggle('fs-code', S.mode === 'code');
      ctx.app.classList.toggle('fs-log', S.mode === 'log');
      fsCode.classList.toggle('on', S.mode === 'code'); fsLog.classList.toggle('on', S.mode === 'log');
      fsCode.title = S.mode === 'code' ? 'Back to the fight (Esc)' : 'Full view of the code';
      fsLog.title = S.mode === 'log' ? 'Back to the fight (Esc)' : 'Full view of the log';
      if (!S.mode) layout();
    }
    j.on(fsCode, 'click', () => setMode('code'));
    j.on(fsLog, 'click', () => setMode('log'));
    j.on(document, 'keydown', (e) => { if (e.key === 'Escape' && S.mode) setMode(S.mode); });
    const setHead = (off) => { S.headOff = off; ctx.left.classList.toggle('head-off', off); const b = ctx.left.querySelector(cn('.px-headx')); b.title = off ? 'Show the title' : 'Close the title'; b.setAttribute('aria-label', b.title); };
    j.on(ctx.left.querySelector(cn('.px-headx')), 'click', () => { setHead(!S.headOff); saveLay(); });
    const tall = () => { if (!S.setLog && !S.logOff) { S.lh = Math.max(S.lh, Math.min(280, room())); layout(); } };
    function dragger(el, apply, reset) {
      /* pointer capture: Monaco is another process, and without it every move over the editor goes to the editor */
      j.on(el, 'pointerdown', (e) => {
        e.preventDefault(); R.classList.add('drag'); el.setPointerCapture(e.pointerId);
        const y0 = e.clientY, a0 = S.ah, l0 = logH();   // from what is on screen: the stored height can be larger
        const move = (ev) => { apply(ev.clientY - y0, a0, l0); layout(); };
        const up = () => { R.classList.remove('drag'); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); saveLay(); };
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
      j.on(el, 'dblclick', () => { reset(); layout(); saveLay(); });
    }
    if (!D) dragger(R.querySelector(cn('.px-hsplit.a')), (d, a0) => { S.ah = Math.max(150, Math.min(380, a0 + d)); }, () => { S.ah = AH; });
    dragger(R.querySelector(cn('.px-hsplit.b')), (d, a0, l0) => { S.logOff = false; S.setLog = true; S.lh = Math.max(48, Math.min(l0 - d, room(44))); }, () => { S.lh = LH; S.setLog = false; });
    j.on(R.querySelector(cn('.px-logtog')), 'click', () => { S.logOff = !S.logOff; layout(); saveLay(); });
    j.on(window, 'resize', layout);

    /* ---- the battle log ---------------------------------------------------------------------------------------- */
    function say(text, tone = '', sub = '', keep = false) {
      if (!keep) log.innerHTML = '';
      const p = document.createElement('div');
      p.className = cn('px-line ' + tone);
      p.innerHTML = `<b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
      log.append(p);
      log.scrollTop = log.scrollHeight;
      return p;
    }
    const block = (title, text, tone = '') => {
      const d = document.createElement('div');
      d.className = cn('px-block ' + tone);
      const body = String(text == null ? '' : text).replace(/\s+$/, '');
      d.innerHTML = `<h3><span>${esc(title)}</span><button class="${P}-copy" type="button">Copy</button></h3><pre>${esc(body) || ' '}</pre>`;
      const b = d.querySelector(cn('.px-copy'));
      b.addEventListener('click', () => {
        navigator.clipboard.writeText(body).then(() => { b.textContent = 'Copied'; sfx('press'); }, () => { b.textContent = 'Press Ctrl+C'; const r = document.createRange(); r.selectNodeContents(d.querySelector('pre')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); });
        setTimeout(() => { b.textContent = 'Copy'; }, 1400);
      });
      return d;
    };
    /* the failing test: one POST /data/submitSource, your own submission, through the page's jQuery */
    function details(r) {
      const id = 'd' + (++S.seq);
      S.wait[id] = (m) => {
        if (!m.ok || !m.data) return;
        const d = m.data, bad = Object.keys(d).map((k) => /^rejected#(\d+)$/.exec(k)).filter((x) => x && d[x[0]] === 'true').map((x) => +x[1]).pop();
        const num = bad || Object.keys(d).map((k) => /^accepted#(\d+)$/.exec(k)).filter(Boolean).map((x) => +x[1]).pop();
        if (!num) return;
        const g = document.createElement('div');
        g.className = cn('px-blocks');
        g.append(block(`Test ${num}: input`, d['input#' + num]), block('Your output', d['output#' + num], 'bad'), block('Expected', d['answer#' + num], 'ok'));
        tall();
        log.append(g);
        if (D) D.detail({ num, input: d['input#' + num], output: d['output#' + num], answer: d['answer#' + num] });
        if (d['checkerStdoutAndStderr#' + num]) log.append(block('Checker', d['checkerStdoutAndStderr#' + num]));
      };
      document.dispatchEvent(new CustomEvent('cfm:src', { detail: JSON.stringify({ id, submissionId: String(r.id) }) }));
    }
    j.on(document, 'cfm:src-state', (e) => { try { const m = JSON.parse(e.detail), w = S.wait[m.id]; if (w) { delete S.wait[m.id]; w(m); } } catch (x) { /* not ours */ } });

    /* ---- Run: samples are a practice swing, nothing is judged -------------------------------------------------------- */
    const samples = [...document.querySelectorAll('.problem-statement .sample-test')].flatMap((t) => {
      const ins = [...t.querySelectorAll('.input pre')], outs = [...t.querySelectorAll('.output pre')];
      return ins.map((p, i) => ({ input: preText(p), expected: outs[i] ? preText(outs[i]) : '' }));
    });
    const runOne = (code, input) => new Promise((resolve) => {
      const id = 'r' + (++S.seq);
      const to = setTimeout(() => { delete S.wait[id]; resolve({ state: 'error', error: 'Codeforces did not answer. Are you signed in? Reload and try again.' }); }, 110000);
      S.wait[id] = (m) => { if (m.state === 'done' || m.state === 'error') { clearTimeout(to); delete S.wait[id]; resolve(m); } };
      document.dispatchEvent(new CustomEvent('cfm:run', { detail: JSON.stringify({ id, programTypeId: S.lang, sourceCode: code, input, pollMs: 900 }) }));
    });
    j.on(document, 'cfm:run-state', (e) => { try { const m = JSON.parse(e.detail), w = S.wait[m.id]; if (w) w(m); } catch (x) { /* not ours */ } });
    const getCode = () => new Promise((r) => {
      const id = 'c' + (++S.seq);
      S.wait[id] = (m) => { delete S.wait[id]; r(m.code); };
      toEd({ op: 'getCode', id });
    });
    const guard = (code, verb) => {
      if (S.busy) return false;
      if (!ctx.handle) { say(`Sign in to ${verb}`, 'bad', 'Codeforces only takes code from signed-in users.'); return false; }
      if (!S.lang) { say('Choose a language first', 'bad', 'Nothing was sent.'); return false; }
      if (!String(code).trim()) { say('No code yet', 'bad', 'Write a solution first. Nothing was sent.'); return false; }
      return true;
    };
    const setBusy = (on) => { S.busy = on; cmd.querySelectorAll(cn('.px-run, .px-sub')).forEach((b) => { b.disabled = on; }); };
    async function run() {
      const code = await getCode();
      showLog();
      if (!guard(code, 'run code')) return;
      setBusy(true); clearFx(); bubble('');
      log.innerHTML = '';
      let bad = 0;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        arena.classList.add('act-swing');
        say(`Sample ${i + 1}…`, '', '', true);
        const r = await runOne(code, s.input);
        arena.classList.remove('act-swing');
        log.lastElementChild.remove();
        if (r.state === 'error') { say('Could not run', 'bad', r.error, true); bad++; break; }
        if (r.verdict !== 'OK') {
          bad++;
          const ce = /COMPIL/i.test(r.verdict);
          if (ce) { finaleRun(); say('Compilation error', 'bad', '', true); log.append(block('Compiler', r.output, 'bad')); break; }
          say(`Sample ${i + 1}: ${String(r.verdict).replace(/_/g, ' ').toLowerCase()}`, 'bad', r.stat, true);
          log.append(block('Message', r.output, 'bad'));
          pop(W.miss, 'foe', 'bad');
          continue;
        }
        if (s.expected && same(r.output, s.expected)) { pop(W.hit, 'foe', 'ok'); anim('act-flinch', 300); sfx('coin'); say(`Sample ${i + 1} passed`, 'ok', r.stat, true); }
        else {
          bad++; pop(W.miss, 'foe', 'bad'); sfx('whiff');
          say(`Sample ${i + 1} differs`, 'bad', 'Some problems accept other answers: Submit to be sure.', true);
          const g = document.createElement('div'); g.className = cn('px-blocks');
          g.append(block('Input', s.input), block('Your output', r.output, 'bad'), block('Expected', s.expected, 'ok'));
          tall();
          log.append(g);
        }
      }
      if (samples.length && !bad) { arena.classList.add('act-ready'); say(W.ready, 'gold', '', true); bubble('!'); sfx('ready'); setTimeout(() => { bubble(''); arena.classList.remove('act-ready'); }, 2400); }
      setBusy(false);
    }
    const finaleRun = () => { arena.classList.add('v-ce'); word(W.fizzle); sfx('fizzle'); recover(2200); };

    /* ---- Submit ------------------------------------------------------------------------------------------------------- */
    async function submit() {
      const code = await getCode();
      showLog();
      if (!guard(code, 'submit')) return;
      const store = await new Promise((r) => chrome.storage.local.get([SUBS], (x) => r((x && x[SUBS]) || {})));
      const prev = Object.entries(store).find(([, v]) => v && v.p === PID && String(v.code).trim() === String(code).trim());
      if (prev) { say('Already sent', 'bad', `This exact code is submission ${prev[0]}: Codeforces refuses an identical resubmission, so nothing was sent.`); return; }
      setBusy(true); clearFx(); arena.classList.add('act-cast'); bubble(''); sfx('cast');
      if (D) D.sending(S.fx !== false);
      waiting('Sending your code');
      if (!D) { arena.classList.remove('slain'); setHp(100); q('.px-round').textContent = `Attempt ${S.tries + 1}`; }
      say('Sending…', '', 'Your code is on its way to Codeforces.');
      const stop = (t, s) => { arena.classList.remove('act-cast'); waiting(''); if (D) D.clear(); setBusy(false); say(t, 'bad', s); };
      let sp;
      try { sp = await page(ctx.submitUrl); } catch (e) { return stop('Nothing was sent', `Could not open the Submit page (${e.message}).`); }
      const form = sp.d.querySelector(SEL.form);
      if (!form || !form.querySelector(SEL.lang)) return stop(signedOut(sp.d) ? 'Sign in to submit' : 'Codeforces wants a check first', 'Open the Submit page once, then try again. Nothing was sent.');
      const body = new FormData();
      for (const el of form.elements) {
        if (!el.name || el.disabled || /^(submit|button|file|reset|image)$/.test(el.type) || (/^(checkbox|radio)$/.test(el.type) && !el.checked)) continue;
        body.set(el.name, el.value);
      }
      body.set('programTypeId', S.lang); body.set('source', code);
      if (!body.get('tabSize')) body.set('tabSize', '4');
      if (form.querySelector(SEL.problem)) body.set('submittedProblemIndex', ctx.idx);
      if (!body.get('csrf_token')) body.set('csrf_token', csrfOf(sp.d) || csrfOf(document));
      let r;
      try { r = await page(new URL(form.getAttribute('action') || sp.url, sp.url).href, { method: 'POST', body }, 30000); }
      catch (e) { return stop("Can't tell whether it was sent", `The connection broke (${e.message}). Check your submissions before trying again; nothing was retried.`); }
      const back = r.d;
      if (!back.querySelector(SEL.row) && (/\/submit/.test(new URL(r.url).pathname) || (back.querySelector(SEL.form) && back.querySelector(SEL.source)))) {
        const err = [...back.querySelectorAll(SEL.error)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)[0];
        return stop('Codeforces says no', err || 'It did not accept the submission. Nothing new was created.');
      }
      const mine = new URL(sp.url).pathname.replace(/^\/problemset\/submit.*$/, '/problemset/status?my=on').replace(/^\/(contest|gym)\/(\d+)\/submit.*$/, '/$1/$2/my');
      const statusUrl = /\/submit/.test(new URL(r.url).pathname) ? mine : r.url;
      const first = readRow(back);
      if (!first) return stop('Sent', 'Codeforces took the code. Open your submissions to see the verdict.');
      chrome.storage.local.get([SUBS], (x) => {
        const m = (x && x[SUBS]) || {}; m[first.id] = { code, lang: S.lang, p: PID, at: Date.now() };
        const keys = Object.keys(m).sort((a, b) => m[a].at - m[b].at);
        while (keys.length > 300) delete m[keys.shift()];
        chrome.storage.local.set({ [SUBS]: m });
      });
      watch(statusUrl, first);
      return undefined;
    }
    /* every test Codeforces reports is one blow: the wound can't reach zero before the verdict does */
    function watch(statusUrl, first) {
      ctx.sink.src = statusUrl;
      const t0 = Date.now();
      let last = '', changed = Date.now(), reload = 0, reading = false, done = false, lastN = 0;
      const seen = (x) => {
        if (!x || x.id !== first.id || done) return;
        const key = x.text + '|' + x.time;
        if (key !== last) { last = key; changed = Date.now(); }
        if (!x.waiting) {
          done = true; setBusy(false);
          arena.classList.remove('act-cast'); waiting('');
          if (kindOf(x.text) === 'ac' && lastN) rememberTests(lastN);
          finale(kindOf(x.text), x);
          return;
        }
        if (x.n && x.n !== lastN) {
          lastN = x.n;
          arena.classList.remove('act-cast');
          if (D) D.test(x.n, S.total || 0);
          else {
            waiting('');
            shoot(x.n);
            anim('act-strike', 260);
            setHp(hpFor(x.n), capFor(x.n));
            setTimeout(arenaCrack, 200);
            pop(`TEST ${x.n}`, 'foe');
            sfx('hit-' + Math.min(5, 1 + Math.floor(x.n / 8)));
          }
          say(x.text, '', x.time && !/^0 ms$/.test(x.time) ? x.time : '');
        } else if (!x.n) { waiting(/compil/i.test(x.text) ? 'Compiling' : x.text && !/queue/i.test(x.text) ? x.text : 'In queue'); say(x.text || 'In queue', '', W.log); }
      };
      seen(first);
      const tick = () => {
        if (done || !arena.isConnected) return;
        let x = null;
        try { x = ctx.sink.contentDocument ? readRow(ctx.sink.contentDocument) : null; } catch (e) { x = null; }
        seen(x);
        if (done) return;
        if (Date.now() - changed > 6000 && Date.now() - reload > 5000 && !reading) {
          reload = Date.now(); reading = true;
          page(statusUrl).then((p) => { reading = false; seen(readRow(p.d)); }).catch(() => { reading = false; });
        }
        if (Date.now() - t0 > WATCH_MS) { done = true; setBusy(false); if (D) D.clear(); say('Still being judged', '', `Submission ${first.id} was sent; follow it in your submissions.`); return; }
        setTimeout(tick, 400);
      };
      setTimeout(tick, 400);
    }
    /* the verdict carries no message: one Custom Test of the same code brings the compiler's words, without being asked */
    async function compilerMessage() {
      const wait = say("Reading the compiler's message…", '', '', true);
      const code = await getCode();
      setBusy(true);
      const r = await runOne(code, '');
      setBusy(false);
      wait.remove();
      tall();
      log.append(block('Compiler', r.output || r.error || 'Codeforces gave no message.', 'bad'));
      log.scrollTop = log.scrollHeight;
    }

    /* ---- the editor: Monaco in its extension page, in Pixel's palette -------------------------------------------- */
    const frame = document.createElement('iframe');
    frame.className = cn('px-edf'); frame.title = 'Code editor'; frame.setAttribute('allow', 'clipboard-read; clipboard-write');
    frame.style.visibility = 'hidden';
    frame.src = chrome.runtime.getURL('src/modern/editor.html');
    const toEd = (m) => { if (frame.contentWindow) frame.contentWindow.postMessage(Object.assign({ cfm: 'ed' }, m), EXT); };
    const key = (lang) => `cfmCode:${PID}:${lang}`;
    const CFM = globalThis.CFM || {};
    const starter = (lang) => (CFM.starter ? CFM.starter(langName(lang), ctx.multi) : '');
    const startCode = (lang) => { const s = S.codes[key(lang)]; S.code = s ? s.code : starter(lang); S.fresh = !s; S.lastSaved = S.code; return S.code; };
    const bodyPos = (code) => { const L = String(code).split('\n'), i = L.findIndex((l, k) => k > 0 && /^[ \t]+$/.test(l) && /solve|Solve/.test(L[k - 1])); return i < 0 ? null : { ln: i + 1, col: L[i].length + 1 }; };
    const mode = (lang) => (CFM.modeOf ? CFM.modeOf(langName(lang)) : 'plaintext');
    const saved = cmd.querySelector(cn('.px-saved'));
    function save() {
      if (!S.dirty) return;
      S.dirty = false;
      const k = key(S.lang);
      if (S.code === starter(S.lang)) delete S.codes[k]; else S.codes[k] = { code: S.code, at: Date.now() };
      const keys = Object.keys(S.codes).sort((a, b) => S.codes[a].at - S.codes[b].at);
      while (keys.length > 200) delete S.codes[keys.shift()];
      S.lastSaved = S.code;
      chrome.storage.local.set({ [CODE_KEY]: S.codes }, () => { saved.textContent = 'Saved'; });
    }
    let saveT = 0, lastLines = 0;
    j.on(window, 'message', (e) => {
      if (e.source !== frame.contentWindow || e.origin !== EXT) return;
      const m = e.data;
      if (!m || m.cfm !== 'ed') return;
      if (m.op === 'loaded') toEd({ op: 'init', skin: ctx.theme === 'anime' ? 'anime' : 'pixel', code: startCode(S.lang), lang: mode(S.lang), pos: S.fresh ? bodyPos(S.code) : null });
      else if (m.op === 'ready') { S.ready = true; frame.style.visibility = ''; }
      else if (m.op === 'change') {
        if (m.code === S.lastSaved) return;
        const lines = m.code.split('\n').length;
        if (S.ready && lines - lastLines > 15 && lastLines) { bubble('?!'); setTimeout(() => bubble(''), 1400); }       // a whole template pasted in: the monster noticed
        lastLines = lines;
        S.code = m.code; S.dirty = true; saved.textContent = 'Saving…'; clearTimeout(saveT); saveT = setTimeout(save, 500);
        typing();
      } else if (m.op === 'shortcut') { if (m.key === 'run') run(); else submit(); }
      else if (m.op === 'code' || m.op === 'painted') { const w = S.wait[m.id]; if (w) w(m); }
      else if (m.op === 'error') say('The editor reported a problem', 'bad', m.message);
    });
    /* the monster has a life of its own: your typing has your hero thinking, a long silence sends it to sleep */
    function typing() {
      if (D) return;
      S.idle = 0;
      if (arena.classList.contains('act-sleep')) { pop('!', 'foe'); sfx('bonk'); }
      arena.classList.remove('act-sleep');
      arena.classList.add('act-think');
      clearTimeout(S.tt); S.tt = setTimeout(() => arena.classList.remove('act-think'), 900);
    }
    if (!D) j.every(() => { if (++S.idle >= 12 && !S.busy && !S.won && ![...arena.classList].some((c) => /^v-/.test(c))) arena.classList.add('act-sleep'); }, 5000);
    /* poke them: the fighters answer back */
    const POKES = ['!', '?!', 'Hey', 'Grr', '...'];
    let pokes = 0, lastPoke = 0;
    if (!D) j.on(q('.px-foe'), 'click', () => {
      if (S.busy || S.won || arena.classList.contains('v-ac')) return;
      const now = Date.now(); pokes = now - lastPoke < 1500 ? pokes + 1 : 0; lastPoke = now;
      arena.classList.remove('act-sleep'); S.idle = 0;
      anim('act-flinch', 300); sfx('bonk');
      const b = q('.px-mbub'); b.textContent = pokes > 5 ? 'Submit!' : POKES[pokes % POKES.length]; b.hidden = false;
      clearTimeout(S.mb); S.mb = setTimeout(() => { b.hidden = true; }, 900);
    });
    if (!D) j.on(q('.px-ally'), 'click', () => { if (!S.busy) { anim('act-jump', 380); sfx('jump'); } });
    /* the hero answers the buttons */
    const sub = cmd.querySelector(cn('.px-sub')), rn = cmd.querySelector(cn('.px-run'));
    j.on(sub, 'mouseenter', () => arena.classList.add('act-brace'));
    j.on(sub, 'mouseleave', () => arena.classList.remove('act-brace'));
    j.on(rn, 'mouseenter', () => arena.classList.add('act-brace'));
    j.on(rn, 'mouseleave', () => arena.classList.remove('act-brace'));
    j.on(sub, 'mousedown', () => sfx('press'));
    j.on(rn, 'mousedown', () => sfx('press'));
    if (ST.preload) ST.preload();
    else if (globalThis.__cftsPixelShatter) globalThis.__cftsPixelShatter.preload([0, 1, 2, 3].map((k) => chrome.runtime.getURL(`textures/pixel/land-${k}.png`)).concat(['stone', 'monsters-72', 'monsters-48', 'heroes-72', 'heroes-48'].map((n) => chrome.runtime.getURL(`textures/pixel/${n}.png`))));

    /* signed out: Codeforces shows no language list and takes no code, so the screen says so and opens the door */
    if (!ctx.handle) {
      const back = encodeURIComponent(location.pathname + location.search), door = `/enter?back=${back}`;
      cmd.classList.add('guest');
      cmd.insertAdjacentHTML('afterbegin', cn(`<span class="gnote">Reading is free. Fighting needs a Codeforces account.</span><a class="px-btn gold" href="${door}">Sign in to fight</a>`));
      edwrap.insertAdjacentHTML('beforeend', cn(`<div class="px-locked"><h2>Your hero needs a name</h2><p>Sign in to write your solution here, run it on the samples and submit it. Your code is saved per problem.</p><div class="row"><a class="px-btn gold big" href="${door}">Sign in</a><a class="px-btn big" href="/register">Create an account</a></div></div>`));
    }

    /* ---- controls ---------------------------------------------------------------------------------------------------- */
    const sel = cmd.querySelector(cn('.px-lang'));
    sel.innerHTML = ctx.langs.map((l) => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
    sel.disabled = !ctx.langs.length;
    j.on(sel, 'change', () => {
      save();
      S.lang = sel.value;
      chrome.storage.local.set({ cfmLang: S.lang });
      toEd({ op: 'setLang', lang: mode(S.lang) }); toEd({ op: 'setCode', code: startCode(S.lang) });
      if (S.fresh) toEd({ op: 'setPos', pos: bodyPos(S.code) });
    });
    j.on(cmd.querySelector(cn('.px-run')), 'click', run);
    j.on(cmd.querySelector(cn('.px-sub')), 'click', submit);
    S.ah = AH; S.lh = LH;
    layout();
    chrome.storage.local.get([CODE_KEY, 'cfmLang', 'cfMoments', 'cfPxLay2', 'cfPxTests', 'cfmStatus'], (s) => {
      S.codes = s[CODE_KEY] || {};
      /* the total, if a past Accepted of yours shows it: from this theme, or from the status cache the other themes keep */
      const rows = (s.cfmStatus && s.cfmStatus.rows) || [];
      S.total = Math.max((s.cfPxTests && s.cfPxTests[PID]) || 0, ...rows.filter((r) => r[2] + '' + r[3] === PID && r[4] === 'OK').map((r) => r[8] || 0), 0);
      if (s.cfPxLay2) { S.ah = D ? 0 : s.cfPxLay2.ah || AH; S.lh = s.cfPxLay2.lh || LH; S.logOff = !!s.cfPxLay2.logOff; S.setLog = true; if (s.cfPxLay2.headOff) setHead(true); layout(); }
      const mom = s.cfMoments || {};
      S.sound = mom.sound !== false; S.vol = mom.volume == null ? 1 : mom.volume; S.fx = mom.verdicts !== false;
      const has = (id) => ctx.langs.some((l) => l.id === id), pre = `cfmCode:${PID}:`;
      const mineLang = Object.keys(S.codes).filter((k) => k.startsWith(pre) && has(k.slice(pre.length))).sort((a, b) => S.codes[b].at - S.codes[a].at)[0];
      if (mineLang) S.lang = mineLang.slice(pre.length); else if (has(s.cfmLang)) S.lang = s.cfmLang;
      sel.value = S.lang || '';
      if (ctx.handle) edwrap.append(frame);   // only now: its 'loaded' asks for the draft
    });
    setTimeout(() => arena.classList.remove('wild'), 1000);
    say(ctx.won ? 'You have already beaten this one.' : ST.intro || `A wild ${ctx.speciesName} appeared!`, '', ctx.won ? 'Fight it again if you like: your code is saved per problem.' : ctx.handle ? W.hint : 'Sign in to fight it.');
    j.on(window, 'pagehide', save);
    return { run, submit, finale, setHp, clearFx, hit: (n) => { anim('act-strike', 260); setHp(hpFor(n), capFor(n)); arenaCrack(); pop(`TEST ${n}`, 'foe'); } };
  }
  globalThis.__cftsPixelDuel = { build };
})();
