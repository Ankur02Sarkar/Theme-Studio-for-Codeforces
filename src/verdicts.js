/* =============================================================================
   verdicts.js  (isolated world, Codeforces) -- PLAN.md phase 5.5

   A verdict that gets stuck until a refresh is Codeforces' bug; this fixes it.
   Codeforces subscribes to its push stream only if a waiting row exists when
   the page loads, never retries when the stream drops, and never updates rows
   that appear later (the problem page's "Last submissions"). So:

   TRIGGER   one of MY rows is waiting (the cfts-verdict-run animation,
             themes/fx.css) and Codeforces hasn't changed it for 8 s.
   POLL      GET /api/user.status?handle=<me>&from=1&count=10, no cookies;
             every 3 s (the API allows 1 call per 2 s; cfApiAt keeps every
             tab of this browser to that), only while the tab is visible, for
             at most 3 minutes, stopping once my waiting rows are final.
   WRITE     what Codeforces' own updateVerdictByKey would: its verdict
             markup (preparedVerdictFormats, in the page's language, handed
             over by relayout.js in the main world), "on test N" =
             passedTestCount + 1 for a rejected verdict, time, memory, then
             waiting="false", so the moment plays through the usual path.
             While still TESTING, "Running on test N" moves so the combo ticks.
             A later stream update for the same verdict plays nothing
             (cf-moments.js dedupes by submission id and verdict).
   REFRESH   my waiting submission ids are kept in cfWaiting (last 20, dropped
             after 30 min). A later page that shows one already final plays
             its moment once and forgets it.
   FAILING   silently: an error, an empty answer or a submission the API hides
             (during a contest) leaves the page as Codeforces left it.
   Off: nothing runs (no theme, no trigger, no request).
============================================================================= */
(() => {
  const root = document.documentElement;
  const on = () => root.hasAttribute('data-cf-theme');
  const STALL = 8000, EVERY = 3000, MAX = 180000, MIN_GAP = 2000;
  const KEY = 'cfWaiting', KEEP = 20, TTL = 30 * 60 * 1000;
  const mine = () => globalThis.CFTSMine;

  /* ---- Codeforces' verdict markup ---------------------------------------------- */
  let formats = null;
  document.addEventListener('cfts:formats-data', (e) => { try { formats = e.detail ? JSON.parse(e.detail) : null; } catch (x) { formats = null; } });
  const getFormats = () => { if (!formats) document.dispatchEvent(new CustomEvent('cfts:formats')); return formats || {}; };
  /* the code's digits: testset (1 pretests, 2 tests, 3 hacks), verdict type, then
     000, or 010 when the text names a test (preparedVerdictFormats-en.js) */
  const TYPE = { FAILED: 0, OK: 1, PARTIAL: 2, COMPILATION_ERROR: 3, RUNTIME_ERROR: 4, WRONG_ANSWER: 5, PRESENTATION_ERROR: 6,
    TIME_LIMIT_EXCEEDED: 7, MEMORY_LIMIT_EXCEEDED: 8, IDLENESS_LIMIT_EXCEEDED: 9, SECURITY_VIOLATED: 10, CRASHED: 11,
    INPUT_PREPARATION_CRASHED: 12, CHALLENGED: 13, SKIPPED: 14, TESTING: 15, REJECTED: 16 };
  const NAMES_TEST = new Set([4, 5, 6, 7, 8, 9, 10, 12, 15, 16]);
  const setOf = (testset) => (/^PRETESTS$/.test(testset || '') ? 1 : /^CHALLENGES$/.test(testset || '') ? 3 : 2);
  /* English fallbacks, the same markup as Codeforces' en formats */
  const EN = { 0: ['failed', 'Judgement failed'], 1: ['accepted', 'Accepted'], 2: ['', 'Partial'], 3: ['', 'Compilation error'], 4: ['rejected', 'Runtime error'],
    5: ['rejected', 'Wrong answer'], 6: ['rejected', 'Presentation error'], 7: ['rejected', 'Time limit exceeded'], 8: ['rejected', 'Memory limit exceeded'],
    9: ['rejected', 'Idleness limit exceeded'], 10: ['rejected', 'Security violated'], 11: ['failed', 'Judgement crashed'], 12: ['failed', 'Input preparation failed'],
    13: ['failed', 'Hacked'], 14: ['', 'Skipped'], 15: ['waiting', 'Running'], 16: ['rejected', 'Rejected'] };
  function markup(s, n) {
    const type = TYPE[s.verdict];
    if (type === undefined) return null;
    const set = setOf(s.testset), named = NAMES_TEST.has(type) && n > 0;
    const f = getFormats();
    let html = f[`${set}${type}${named ? '010' : '000'}`] || f[`2${type}${named ? '010' : '000'}`];
    if (!html) {
      const [cls, word] = EN[type];
      const text = type === 1 && set === 1 ? 'Pretests passed' : word;
      const on = named ? ` on ${set === 1 ? 'pretest' : set === 3 ? 'hack' : 'test'} <span class="verdict-format-judged">${n}</span>` : '';
      html = cls ? `<span class='verdict-${cls}'>${text}${on}</span>` : text + on;
    }
    return html;
  }
  /* the formats carry placeholder numbers; Codeforces' update then writes the
     real ones (judged test, passed tests) into these spans, and so do we */
  function fill(el, n) {
    const j = el.querySelector('.verdict-format-judged'); if (j && n > 0) j.textContent = n;
  }
  /* the units this page writes ("ms" / "KB", or the Russian page's own), read from a row */
  function units() {
    const t = document.querySelector('.time-consumed-cell'), m = document.querySelector('.memory-consumed-cell');
    const u = (c, d) => { const x = c && /\d\s*([^\d\s]+)\s*$/.exec(c.textContent.replace(/ /g, ' ')); return x ? x[1] : d; };
    return { ms: u(t, 'ms'), kb: u(m, 'KB') };
  }

  /* ---- my waiting rows ------------------------------------------------------------ */
  const tracked = new Map();        // id -> { el, last, mo }
  let writing = false;
  const isWaiting = (el) => (el.matches('td') ? el.getAttribute('waiting') === 'true' : /^(TESTING|SUBMITTED)$/.test(el.getAttribute('submissionVerdict') || ''));
  const idOf = (el) => el.getAttribute('submissionId') || '';
  function track(el) {
    const id = idOf(el), M = mine();
    if (!on() || !id || !M || !M.handle() || !M.isMine(el)) return;
    const old = tracked.get(id);
    if (old && old.el === el) return;
    if (old) old.mo.disconnect();
    const t = { el, last: Date.now(), mo: null };
    /* any change Codeforces makes counts as life; ours doesn't (records of our
       own writes are taken off the observer as soon as we make them) */
    t.mo = new MutationObserver(() => {
      if (writing) return;
      t.last = Date.now();
      if (!isWaiting(el)) done(id);
    });
    t.mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['waiting', 'submissionverdict'] });
    tracked.set(id, t);
    remember(id, t.last);
    loop();
  }
  function done(id) {
    const t = tracked.get(id);
    if (t) { t.mo.disconnect(); tracked.delete(id); }
    forget(id);                         // judged in front of me: the moment plays live
  }
  document.addEventListener('animationstart', (e) => { if (e.animationName === 'cfts-verdict-run') track(e.target); }, true);

  /* ---- storage: the refresh path -------------------------------------------------- */
  const load = () => new Promise((r) => chrome.storage.local.get(KEY, (x) => r((Array.isArray(x && x[KEY]) ? x[KEY] : []).filter((w) => w && w.id && Date.now() - w.at < TTL))));
  let queue = Promise.resolve();
  const edit = (fn) => (queue = queue.then(async () => { const l = await load(); const n = fn(l); if (n) await chrome.storage.local.set({ [KEY]: n.slice(-KEEP) }); }).catch(() => {}));
  const remember = (id, at) => edit((l) => (l.some((w) => w.id === id) ? null : l.concat({ id, at: at || Date.now() })));
  const forget = (id) => edit((l) => (l.some((w) => w.id === id) ? l.filter((w) => w.id !== id) : null));

  /* ---- the poll ----------------------------------------------------------------------- */
  let timer = 0, pollStart = 0, lastCall = 0, busy = false;
  function loop() { if (!timer) timer = setInterval(tick, 1000); }
  function stop() { clearInterval(timer); timer = 0; }
  async function tick() {
    if (!tracked.size || !on()) { stop(); return; }
    const now = Date.now();
    const stalled = [...tracked.values()].some((t) => now - t.last >= STALL);
    if (!stalled || busy || document.visibilityState !== 'visible') return;
    if (!pollStart) pollStart = now;
    if (now - pollStart > MAX) { stop(); return; }                  // 3 minutes of help on this page, then Codeforces' page as it is
    if (now - lastCall < EVERY) return;
    busy = true;
    try { await call(); } finally { busy = false; }
  }
  async function call() {
    /* every tab of this browser shares the API's limit: 1 call per 2 s */
    const r = await chrome.storage.local.get('cfApiAt');
    if (Date.now() - ((r && r.cfApiAt) || 0) < MIN_GAP) return;
    lastCall = Date.now();
    await chrome.storage.local.set({ cfApiAt: lastCall });
    const handle = mine() && mine().handle();
    if (!handle) return;
    let list = null;
    try {
      const res = await fetch(`/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=10`, { credentials: 'omit' });
      const j = await res.json();
      if (j && j.status === 'OK' && Array.isArray(j.result)) list = j.result;
    } catch (e) {}
    if (!list) return;                                              // failing silently
    for (const s of list) {
      const t = tracked.get(String(s.id));
      if (t && s.verdict) apply(t, s, String(s.id));
    }
  }
  /* write one API submission into its row, as Codeforces' updateVerdictByKey does */
  function apply(t, s, id) {
    const el = t.el, running = s.verdict === 'TESTING' || s.verdict === 'SUBMITTED';
    const passed = Number.isFinite(s.passedTestCount) ? s.passedTestCount : 0;
    if (running) {
      const n = passed + 1, j = el.querySelector('.verdict-format-judged');
      if (j && parseInt(j.textContent, 10) >= n) return;           // Codeforces shows as much or more
      const html = markup({ verdict: 'TESTING', testset: s.testset }, n);
      if (!html) return;
      writing = true;
      try { if (j) j.textContent = n; else { el.innerHTML = html; fill(el, n); } } finally { writing = false; t.mo.takeRecords(); }
      return;
    }
    const type = TYPE[s.verdict];
    const html = markup(s, type === 1 ? 0 : passed + 1);
    if (!html) return;
    const u = units(), tr = el.closest('tr');
    writing = true;
    try {
      el.innerHTML = html;                                          // Codeforces' own markup, numbers only from us
      fill(el, type === 1 ? 0 : passed + 1);
      if (el.matches('td') && tr) {
        const tc = tr.querySelector('.time-consumed-cell'), mc = tr.querySelector('.memory-consumed-cell');
        if (tc) tc.textContent = Number.isFinite(s.timeConsumedMillis) ? `${s.timeConsumedMillis} ${u.ms}` : '';
        if (mc) mc.textContent = Number.isFinite(s.memoryConsumedBytes) ? `${Math.floor(s.memoryConsumedBytes / 1024)} ${u.kb}` : '';
      }
      if (el.matches('td')) el.setAttribute('waiting', 'false');   // cf-moments.js plays it from here
      else el.setAttribute('submissionVerdict', s.verdict);
    } finally { writing = false; t.mo.takeRecords(); }
    done(id);
    /* a sidebar row has no final trigger: hand it to the moments directly */
    if (!el.matches('td') && globalThis.CFTSMoments) globalThis.CFTSMoments.replay(el);
  }

  /* ---- on load: a submission I saw waiting, now final -------------------------------- */
  async function onLoad() {
    if (!on()) return;
    const list = await load();
    if (!list.length) return;
    const find = (id) => document.querySelector(`td.status-verdict-cell[submissionid="${id}"], #sidebar .submissionVerdictWrapper[submissionid="${id}"]`);
    let played = false;
    const keep = [];
    for (const w of list) {
      const el = /^\d+$/.test(w.id) ? find(w.id) : null;
      if (!el) { keep.push(w); continue; }                          // not on this page: maybe the next one
      if (isWaiting(el)) { keep.push(w); continue; }                // still judging: tracked by the trigger
      if (!played && globalThis.CFTSMoments) { played = true; globalThis.CFTSMoments.replay(el); }
      /* final here: forgotten either way (one moment per page; the others were old news) */
    }
    await chrome.storage.local.set({ [KEY]: keep.slice(-KEEP) });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(onLoad, 0), { once: true });
  else setTimeout(onLoad, 0);
  addEventListener('pagehide', () => { stop(); tracked.forEach((t) => t.mo.disconnect()); tracked.clear(); });
  document.addEventListener('cfts:theme', () => { if (!on()) { stop(); tracked.forEach((t) => t.mo.disconnect()); tracked.clear(); } });
})();
