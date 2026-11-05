/* =============================================================================
   cf-moments.js  (isolated world, Codeforces) -- PLAN.md phases 3 and 3R

   Notices the events worth a moment and hands them to cf-fx.js (the visuals)
   and cf-sounds.js (through the sister's sounds.js). Themes with moments:
   Anime Studio (shonen battle), Pixel Art (arcade fighter), Vintage Paper
   (the press), FASTLAP (race control: verdict cut-ins and a rank-up card only). Midnight and Off have none.

   1. TITLE CARD: opening an unsolved problem plays VS (Anime) or ROUND N -
      FIGHT! (Pixel). Solved problems skip it (signed in: an Accepted in
      Codeforces' "Last submissions" box). Never during a live contest.
   2. JUDGING: while MY row reads "Running on test N", a combo counter ticks
      with each update Codeforces writes (Paper draws none; it only keeps N). A CSS animation on
      td.status-verdict-cell[waiting="true"] (themes/fx.css) starts when the
      cell starts running; that attaches a MutationObserver to THAT ONE CELL,
      disconnected when the cell is final (or the page goes away). No page-wide
      observer, no polling, no requests.
   3. VERDICTS: Codeforces' own script replaces the verdict cell's HTML and
      sets waiting="false"; the cfts-verdict-final animation starts and ONE
      delegated animationstart listener reads that row. Cells already final
      when the page was parsed are remembered and ignored.
      Failed system test: my submission ids seen as "Pretests passed" are
      kept in chrome.storage.local (cfPretests, ids only, last 50). The first
      time any page shows one of them rejected (judged in front of you, or
      already final when the page loads), the shatter plays once and the id
      is forgotten (Hacked plays its ambush instead). A row seen as Pretests
      passed on this page that turns rejected plays it too.
      Off during a live contest unless the user turns live moments on.
   4. LEVEL UP: after a rated contest, the first visit: 覚醒 (Anime), LEVEL UP!
      (Pixel), PROMOTED TO <RANK> (Paper), then the share card. Data: the
      official API user.rating for the SIGNED-IN handle only, at most once
      every 6 h (cached), failing silently. A rating loss shows nothing.

   Settings: cfMoments { titleCard, verdicts, liveVerdicts, levelUp, sound,
   volume } (popup, Studio). The harness can play a moment with the document
   event cfts:moment (an overlay only).
============================================================================= */
(() => {
  const root = document.documentElement;
  const FX = globalThis.CFTSFx, SFX = globalThis.LCTSSounds, SHARE = globalThis.LCTSShare;
  if (!FX) return;
  const PATH = location.pathname;

  const DEFAULTS = { titleCard: true, verdicts: true, liveVerdicts: false, levelUp: true, sound: true, volume: 1 };
  let settings = Object.assign({}, DEFAULTS);
  chrome.storage.local.get(['cfMoments', 'cfAnime'], (r) => {
    settings = Object.assign({}, DEFAULTS, r && r.cfMoments);
    FX.setJapanese(!(r && r.cfAnime && r.cfAnime.japanese === false));   // the Studio's "Japanese text"
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local') return;
    if (c.cfMoments) settings = Object.assign({}, DEFAULTS, c.cfMoments.newValue || {});
    if (c.cfAnime) FX.setJapanese(!(c.cfAnime.newValue && c.cfAnime.newValue.japanese === false));
  });

  const THEMES = /^(anime|pixel|paper|fastlap)$/;   // FASTLAP: verdict cut-ins and the rank-up card (no title card, no combo)
  const theme = () => { const t = root.getAttribute('data-cf-theme') || ''; return THEMES.test(t) ? t : ''; };
  const live = () => root.hasAttribute('data-cf-live');
  const sound = (kind) => { if (kind && settings.sound && SFX) SFX.play(kind, { theme: theme(), volume: settings.volume }); };
  const play = (r) => { if (r) sound(r.sound); return r; };
  const whenVisible = () => new Promise((res) => {
    if (document.visibilityState === 'visible') return res();
    const f = () => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', f); res(); } };
    document.addEventListener('visibilitychange', f);
  });
  const clean = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');

  /* ---- who I am: the header (signed in), my rating from the cache or the sidebar */
  function myLink() {
    const links = [...document.querySelectorAll('#header .lang-chooser a')];
    if (!links.some((a) => /\/logout/.test(a.getAttribute('href') || ''))) return null;
    return links.find((a) => /^\/profile\//.test(a.getAttribute('href') || '')) || null;
  }
  const myHandle = () => { const a = myLink(); return a ? a.getAttribute('href').split('/')[2] : ''; };
  let cachedRating = null;
  const ratingReady = new Promise((done) => chrome.storage.local.get('cfRating', (r) => {
    const c = r && r.cfRating;
    if (c && c.result && c.result.length) cachedRating = { handle: c.handle, rating: c.result[c.result.length - 1].newRating };
    done();
  }));
  function myRating() {
    const me = myHandle();
    if (cachedRating && me && cachedRating.handle.toLowerCase() === me.toLowerCase()) return cachedRating.rating;
    const li = [...document.querySelectorAll('#sidebar li')].find((x) => /^\s*Rating\s*:/.test(x.textContent));
    const m = li && /Rating\s*:\s*(\d+)/.exec(li.textContent);
    return m ? +m[1] : 0;
  }
  const RANKS = [[1200, 'Newbie', 'gray'], [1400, 'Pupil', 'green'], [1600, 'Specialist', 'cyan'], [1900, 'Expert', 'blue'], [2100, 'Candidate Master', 'violet'],
    [2300, 'Master', 'orange'], [2400, 'International Master', 'orange'], [2600, 'Grandmaster', 'red'], [3000, 'International Grandmaster', 'red'], [1e9, 'Legendary Grandmaster', 'red']];
  const rankOf = (r) => RANKS.find((x) => r < x[0]);
  const DANGER = (r) => (r < 1200 ? 1 : r < 1600 ? 2 : r < 2000 ? 3 : r < 2500 ? 4 : 5);
  const colOf = (node) => { const m = node && /\buser-(gray|green|cyan|blue|violet|orange|red|legendary|black)\b/.exec(node.className || ''); return m ? (m[1] === 'legendary' ? 'red' : m[1] === 'black' ? 'gray' : m[1]) : ''; };
  /* my colour: Codeforces' own rank class on a link to my profile anywhere on the
     page (the sidebar box, my rows), else the rank of my cached rating; the rating
     is shown only when it is known (the cache, or the sidebar's "Rating:") */
  function myRankLink(handle) {
    const h = handle.toLowerCase();
    return [...document.querySelectorAll('a.rated-user[href*="/profile/"]')]
      .find((a) => (a.getAttribute('href').split('/profile/')[1] || '').split(/[/?#]/)[0].toLowerCase() === h && colOf(a)) || null;
  }
  function me() {
    const handle = myHandle(), rating = myRating(), rk = rating ? rankOf(rating) : null;
    const col = (handle && colOf(myRankLink(handle))) || (rk ? rk[2] : 'gray');
    return { handle, rating, rankName: rk ? rk[1] : '', col };          // the rank's NAME only with a known rating
  }

  /* ---- 1. the title card ------------------------------------------------------ */
  const ARCS = { easy: ['日常編', 'SLICE-OF-LIFE ARC'], medium: ['修行編', 'TRAINING ARC'], hard: ['最終決戦', 'FINAL BATTLE'] };
  function problemInfo() {
    const ps = document.querySelector('.problemindexholder .problem-statement');
    const t = ps && ps.querySelector('.header .title');
    if (!t) return null;
    const m = /^\s*([A-Z]\d?)\.\s*(.+?)\s*$/.exec(t.textContent);
    if (!m) return null;
    const tag = [...document.querySelectorAll('#sidebar .tag-box')].map((x) => x.textContent.trim()).find((x) => /^\*\d+$/.test(x));
    const prating = tag ? +tag.slice(1) : 0;
    const num = /\/(?:problemset\/problem|contest|gym)\/(\d+)/.exec(PATH);
    const d = prating ? (prating <= 1300 ? 'easy' : prating <= 2300 ? 'medium' : 'hard') : '';
    return { letter: m[1], title: m[2], pid: (num ? num[1] : '') + m[1], prating, pcol: prating ? rankOf(prating)[2] : 'gray',
      word: !prating ? '' : prating <= 1300 ? 'Easy' : prating <= 1800 ? 'Medium' : prating < 2400 ? 'Hard' : 'Very hard',
      dz: prating ? DANGER(prating) : 0, arc: d ? ARCS[d] : null };
  }
  /* signed in, Codeforces lists your submissions to this problem in the sidebar
     ("Last submissions"): an Accepted there means solved; rejected ones count the round */
  const lastSubs = () => [...document.querySelectorAll('#sidebar .roundbox')].find((b) => b.querySelector('a[href*="/submission/"]'));
  const solved = () => { const b = lastSubs(); return !!(b && b.querySelector('.verdict-accepted')); };
  const tries = () => { const b = lastSubs(); return b ? b.querySelectorAll('.verdict-rejected').length : 0; };

  function playTitle(info) { return play(FX.vs(Object.assign(me(), info, { round: 1 + tries() }))); }
  async function maybeTitleCard() {
    if (!/^\/(problemset\/problem|contest\/\d+\/problem|gym\/\d+\/problem)\//.test(PATH)) return;
    /* Anime's title card is the broadcast's cold open (onair.js): the old VS screen never plays for it, even where the app is absent */
    if (theme() !== 'pixel' || live() || !settings.titleCard || solved() || document.documentElement.hasAttribute('data-px-app') || document.documentElement.hasAttribute('data-am-app')) return;   // Pixel's battle screen is its own entrance
    const info = problemInfo();
    if (!info) return;
    await ratingReady;
    await whenVisible();
    if (theme() !== 'pixel' || live()) return;
    playTitle(info);
  }

  /* ---- 2 and 3. judging and verdicts ---------------------------------------------- */
  const allowed = () => !!theme() && settings.verdicts && !(live() && !settings.liveVerdicts);
  const MINE_PAGE = () => {
    const h = myHandle().toLowerCase();
    const m = /^\/submissions\/([^/]+)/.exec(PATH);
    return /^\/(contest|gym)\/\d+\/my(\/|$)/.test(PATH) || !!(m && h && m[1].toLowerCase() === h);
  };
  function isMine(td) {
    /* the problem page's "Last submissions" box lists only your own */
    if (td.closest('#sidebar')) return !!myHandle();
    if (MINE_PAGE()) return true;
    const h = myHandle().toLowerCase();
    const tr = td.closest('tr');
    return !!(h && tr && [...tr.querySelectorAll('td.status-party-cell a[href^="/profile/"]')].some((a) => a.getAttribute('href').split('/')[2].toLowerCase() === h));
  }
  const judgedOf = (td) => { const j = td.querySelector('.verdict-format-judged'); const n = j ? parseInt(j.textContent, 10) : 0; return n > 0 ? n : 0; };
  function classify(td) {
    const text = clean(td);
    const v = (kind) => ({ kind, text, label: text.toUpperCase(), judged: judgedOf(td), unit: /\bon pretest\b/i.test(text) ? 'pretest' : 'test' });
    if (/^Pretests (and hacks )?passed/i.test(text)) return v('pretests');
    if (td.querySelector('.verdict-accepted') || /^(Accepted|Perfect result)/i.test(text)) return v('ac');
    if (/^Hacked/i.test(text)) return v('hacked');
    if (/^Wrong answer/i.test(text)) return v('wa');
    if (/^(Time limit exceeded|Idleness limit exceeded)/i.test(text)) return v('tle');
    if (/^Memory limit exceeded/i.test(text)) return v('mle');
    if (/^(Runtime error|Denial of judgement|Judgement failed|Security violated|Presentation error)/i.test(text)) return v('err');
    if (/^Compilation error/i.test(text)) return v('ce');
    return null;                                                    // Skipped, partial, In queue…: no moment
  }
  /* the facts the moments may state: the row, my other rows for this problem on the page */
  /* "187 ms" / "4100 KB" as Codeforces writes them (its update fills these cells
     before it sets waiting="false"); a cell that is empty or 0 is unknown, so
     the moments leave that part of the line out instead of printing 0 */
  const amount = (text, unit) => { const m = new RegExp('^(\\d+)\\s*' + unit + '$', 'i').exec(text || ''); return m && +m[1] > 0 ? `${+m[1]} ${unit}` : ''; };
  function facts(td) {
    const tr = td.closest('tr'), m = me();
    const cell = (sel) => clean(tr && tr.querySelector(sel));
    const pa = tr && tr.querySelector('td[data-problemId] a');
    const href = pa ? pa.getAttribute('href') || '' : '';
    const hm = /\/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([A-Z]\d?)/.exec(href);
    /* "1951D - Buying Jewels" as Codeforces writes it; Guided shows the ID as a chip, so the text is "1951DBuying Jewels" */
    const txt = clean(pa), parts = txt.split(' - ');
    const pid = hm ? hm[1] + hm[2] : parts[0];
    const name = parts.length > 1 ? parts.slice(1).join(' - ') : txt.startsWith(pid) ? txt.slice(pid.length).trim() : '';
    const probId = tr && tr.querySelector('td[data-problemId]') ? tr.querySelector('td[data-problemId]').getAttribute('data-problemId') : '';
    const earlier = [];
    /* a row outside a status table (the sidebar's "Last submissions"): the problem is this page's */
    const here = !pa && problemInfo();
    if (tr && probId) {
      for (let r = tr.nextElementSibling; r; r = r.nextElementSibling) {
        const pc = r.querySelector('td[data-problemId]'), vc = r.querySelector('td.status-verdict-cell');
        if (pc && vc && pc.getAttribute('data-problemId') === probId && isMine(vc)) { const t = clean(vc); if (t) earlier.push(t); }
      }
    }
    const party = tr && tr.querySelector('td.status-party-cell a.rated-user');
    return { handle: m.handle || (party ? clean(party) : ''), col: colOf(party) || m.col, rating: m.rating, rankName: m.rankName,
      pid: here ? here.pid : pid, name: here ? here.title : name, time: amount(cell('.time-consumed-cell'), 'ms'), mem: amount(cell('.memory-consumed-cell'), 'KB'),
      lang: tr && tr.cells[4] ? clean(tr.cells[4]) : '', id: td.getAttribute('submissionId') || '', earlier };
  }

  /* failed-system-test memory: my submission ids seen as Pretests passed (ids only) */
  const PRE_KEY = 'cfPretests', PRE_MAX = 50;
  const pretestsHere = new Set();
  const getPre = () => new Promise((r) => chrome.storage.local.get(PRE_KEY, (x) => r(Array.isArray(x && x[PRE_KEY]) ? x[PRE_KEY] : [])));
  async function editPre(fn) { const list = await getPre(); const next = fn(list.slice()); if (next) await chrome.storage.local.set({ [PRE_KEY]: next.slice(-PRE_MAX) }); }
  const remember_pretests = (id) => editPre((l) => (l.includes(id) ? null : l.concat(id)));
  const forget = (id) => editPre((l) => (l.includes(id) ? l.filter((x) => x !== id) : null));

  /* the combo: one observer on the one running cell of mine */
  const watching = new Map(), lastN = new WeakMap();
  /* Paper draws no counter but watches the same way: the front page names the tests it saw */
  const counted = () => /^(anime|pixel)$/.test(theme());
  function watch(td) {
    if (watching.has(td) || !allowed() || !isMine(td)) return;
    const tr = td.closest('tr'), col = facts(td).col;
    const n0 = judgedOf(td);
    lastN.set(td, n0);
    if (counted()) FX.combo.start(tr, td, col, n0);
    let lastTick = 0;
    const mo = new MutationObserver(() => {
      const n = judgedOf(td);
      if (!n || n === lastN.get(td)) return;
      lastN.set(td, n);
      if (!counted()) return;
      if (FX.combo.row !== tr) FX.combo.start(tr, td, col, n); else FX.combo.tick(n);
      const t = performance.now();
      if (t - lastTick > 120) { lastTick = t; sound('tick-' + Math.min(5, 1 + Math.floor(n / 10))); }
    });
    mo.observe(td, { childList: true, subtree: true, characterData: true });
    watching.set(td, mo);
  }
  const unwatch = (td) => { const mo = watching.get(td); if (mo) { mo.disconnect(); watching.delete(td); } };
  const stopAll = () => { watching.forEach((mo) => mo.disconnect()); watching.clear(); FX.combo.stop(); };
  addEventListener('pagehide', stopAll);
  /* a live switch to a theme without moments (content.js fires cfts:theme) */
  document.addEventListener('cfts:theme', () => { if (!theme()) { stopAll(); FX.end(); } });

  function show(td, v) {
    const tr = td.closest('tr');
    const counter = FX.combo.row === tr ? FX.combo.take() : null;
    const f = facts(td);
    const n = (counter && counter.n) || lastN.get(td) || 0;
    const first = !f.earlier.length;
    return play(FX.verdict({ kind: v.kind, label: v.label, unit: v.unit, judged: v.judged, n: v.kind === 'ac' || v.kind === 'pretests' ? n : v.judged || n,
      facts: f, first, row: tr, cell: td, counter }));
  }

  const seen = new WeakSet();
  /* one moment per submission and verdict: Codeforces' stream may deliver a verdict
     that src/verdicts.js already wrote (or replay a "Running" before it), and a
     cell that runs again comes back here; a new verdict (system test) still plays */
  const played = new Set();
  function final(td) {
    if (seen.has(td)) return;
    seen.add(td);
    /* final while the page is still being parsed: it was final when served (the
       load scan in remember() looks at those, for a failed system test) */
    if (document.readyState === 'loading') return;
    unwatch(td);
    const tr = td.closest('tr');
    if (!allowed() || !isMine(td)) { if (FX.combo.row === tr) FX.combo.stop(); return; }
    const v = classify(td);
    if (!v) { if (FX.combo.row === tr) FX.combo.stop(); return; }
    const id = td.getAttribute('submissionId') || '';
    if (id) { const key = id + '|' + v.label; if (played.has(key)) { if (FX.combo.row === tr) FX.combo.stop(); return; } played.add(key); }
    if (v.kind === 'pretests') { pretestsHere.add(id); if (id) remember_pretests(id); }
    else if (id) {
      getPre().then((l) => {
        const was = pretestsHere.has(id) || l.includes(id);
        if (was) forget(id);
        if (was && v.kind !== 'ac' && v.kind !== 'hacked' && v.kind !== 'ce') v.kind = 'fst';
        show(td, v);
      });
      return;
    }
    show(td, v);
  }
  document.addEventListener('animationstart', (e) => {
    /* a cell that runs again (system testing after Pretests passed) will be news when it is final again */
    if (e.animationName === 'cfts-verdict-run') { seen.delete(e.target); watch(e.target); }
    else if (e.animationName === 'cfts-verdict-final') final(e.target);
  }, true);

  /* the cells already final when the page was parsed are not news, except one
     kind: a submission of mine remembered as Pretests passed that this page
     shows rejected (system testing ran while I was away) */
  async function remember() {
    const cells = document.querySelectorAll('td.status-verdict-cell[waiting="false"]');
    cells.forEach((td) => seen.add(td));
    if (!cells.length || !myHandle()) return;
    const mine = [...cells].filter(isMine);
    if (!mine.length) return;
    const stored = await getPre();
    let list = stored.slice(), shatter = null;
    mine.forEach((td) => {
      const id = td.getAttribute('submissionId') || '', v = id && classify(td);
      if (!v) return;
      if (v.kind === 'pretests') { if (!list.includes(id)) list.push(id); }
      else if (list.includes(id)) {
        if (v.kind !== 'ac' && v.kind !== 'ce' && !shatter && allowed()) shatter = { td, v };
        if (v.kind === 'ac' || v.kind === 'ce' || shatter && shatter.td === td) list = list.filter((x) => x !== id);
      }
    });
    if (list.join() !== stored.join()) await chrome.storage.local.set({ [PRE_KEY]: list.slice(-PRE_MAX) });
    if (shatter) {
      await whenVisible();
      if (!allowed()) return;
      if (shatter.v.kind !== 'hacked') shatter.v.kind = 'fst';
      const sid = shatter.td.getAttribute('submissionId') || '';
      if (sid) played.add(sid + '|' + shatter.v.label);              // the refresh path (verdicts.js) won't play it again
      shatter.td.scrollIntoView({ block: 'nearest' });
      show(shatter.td, shatter.v);
    }
  }

  /* src/verdicts.js (the stalled-stream fallback) shares these: who I am, which
     rows are mine, and a way to play a row that was already final at load (a
     submission it saw waiting before a refresh) */
  globalThis.CFTSMine = { handle: myHandle, isMine };
  globalThis.CFTSMoments = {
    replay(el) { seen.delete(el); final(el); },
  };

  /* ---- 4. level up ---------------------------------------------------------------- */
  const SIX_HOURS = 6 * 3600 * 1000, WEEK = 7 * 86400;
  async function ratingHistory(handle) {
    const r = await chrome.storage.local.get('cfRating');
    const c = r.cfRating;
    if (c && c.handle === handle && Date.now() - c.at < SIX_HOURS) return c.result;
    try {
      const res = await fetch(`/api/user.rating?handle=${encodeURIComponent(handle)}`, { credentials: 'omit' });
      const j = await res.json();
      if (j.status !== 'OK' || !Array.isArray(j.result)) return null;
      await chrome.storage.local.set({ cfRating: { handle, at: Date.now(), result: j.result.slice(-2) } });
      if (j.result.length) cachedRating = { handle, rating: j.result[j.result.length - 1].newRating };
      return j.result.slice(-2);
    } catch (e) { return null; }                                   // failing silently
  }
  async function maybeLevelUp() {
    const handle = myHandle();
    if (!handle || !theme() || live() || !settings.levelUp) return;
    const hist = await ratingHistory(handle);
    const last = hist && hist[hist.length - 1];
    if (!last) return;                                             // an error, or no rated contest yet
    const r = await chrome.storage.local.get('cfLevelSeen');
    const s = r.cfLevelSeen;
    if (s && s.handle === handle && s.contestId === last.contestId) return;
    await chrome.storage.local.set({ cfLevelSeen: { handle, contestId: last.contestId } });
    if (!s && Date.now() / 1000 - last.ratingUpdateTimeSeconds > WEEK) return;   // first run: old news
    if (!(last.newRating > last.oldRating)) return;               // a loss: no moment
    const [, rank, col] = rankOf(last.newRating), [, oldRank, oldCol] = rankOf(last.oldRating);
    const d = { kind: 'levelup', handle, oldRating: last.oldRating, newRating: last.newRating, contest: last.contestName, col, oldCol, rank, oldRank,
      rankChange: oldRank !== rank ? `${oldRank} → ${rank}` : '', title: oldRank !== rank ? `${oldRank} → ${rank}` : `Rating ${last.newRating}`,
      rankColor: getComputedStyle(root).getPropertyValue(`--cf-rank-${col}`).trim() };
    await whenVisible();
    if (!theme() || live()) return;
    play(FX.levelup(d));
    if (SHARE) setTimeout(() => SHARE.offer(d), 2300);             // after the moment, as on LeetCode
  }

  /* ---- start: after the page is parsed and guided.js has settled data-cf-live */
  const start = () => {
    remember();
    setTimeout(() => { maybeTitleCard(); maybeLevelUp(); }, 0);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();

  /* the harness plays a moment by name (an overlay and its sound only):
     detail = 'title' | { verdict: kind, n, label, row, facts?, first? } | { levelup: {...} }
     (facts / first: FASTLAP's pit wall knows them from its own status frame) */
  document.addEventListener('cfts:moment', (e) => {
    if (!theme()) return;
    let d = e.detail || {};
    if (typeof d === 'string' && d.charAt(0) === '{') { try { d = JSON.parse(d); } catch (x) { return; } }   // from the page's world, objects arrive as JSON
    if (d === 'title') { playTitle(problemInfo() || { letter: 'D', title: 'Buying Jewels', pid: '1951D', prating: 2000, pcol: 'violet', word: 'Hard', dz: 4, arc: ARCS.medium }); return; }
    if (d.levelup) { play(FX.levelup(d.levelup)); return; }
    if (d.verdict) {
      const td = document.querySelector(d.cell || 'td.status-verdict-cell');
      const f = Object.assign(td ? facts(td) : { handle: myHandle(), col: 'gray', pid: '', earlier: [] }, d.facts || {});
      const first = typeof d.first === 'boolean' ? d.first : !f.earlier.length;
      play(FX.verdict({ kind: d.verdict, label: d.label || d.verdict.toUpperCase(), judged: d.n || 0, n: d.n || 0, facts: f, first, row: td && td.closest('tr'), cell: td, counter: null }));
    }
  });
})();
