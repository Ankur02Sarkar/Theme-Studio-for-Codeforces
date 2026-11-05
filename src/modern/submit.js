/* =============================================================================
   submit.js  (isolated world)   MODERN.md M2b: Submit, the Result tab, the Submissions tab, Solved / Solved by.
   Submit (Oct 28 2026, FASTLAP's way, proven live): Codeforces' own Submit form is fetched, filled and POSTed; its answer is
   your submissions page (the newest row = this submission) or its own refusal message. The verdict is then read from your
   submissions in a hidden frame that Codeforces keeps live itself, re-read if it stalls. No API polling (the old way waited
   on user.status, which lists new submissions late: the 10-second waits and "Nothing came back").
   Failures are said plainly, never an endless spinner. The local duplicate check refuses before anything is sent.
   Failing-test details: one POST /data/submitSource per opened non-Accepted submission (bridge.js, the page's own jQuery).
============================================================================= */
(() => {
  'use strict';
  const CFM = globalThis.CFM; if (!CFM) return;
  const SUBS = 'cfmSubmissions', LAST = 300, WATCH_MS = 120000, SQUARES_MAX = 50;
  let c = null, S = null;

  const WORD = { OK: 'Accepted', COMPILATION_ERROR: 'Compilation error', WRONG_ANSWER: 'Wrong answer', RUNTIME_ERROR: 'Runtime error', TIME_LIMIT_EXCEEDED: 'Time limit exceeded', MEMORY_LIMIT_EXCEEDED: 'Memory limit exceeded', IDLENESS_LIMIT_EXCEEDED: 'Idleness limit exceeded', PRESENTATION_ERROR: 'Presentation error', CHALLENGED: 'Hacked', SKIPPED: 'Skipped', REJECTED: 'Rejected', FAILED: 'Judgement failed', PARTIAL: 'Partial result', CRASHED: 'Judgement failed', INPUT_PREPARATION_CRASHED: 'Judgement failed', SECURITY_VIOLATED: 'Security violated' };
  const NOTEST = /^(OK|COMPILATION_ERROR|SKIPPED|REJECTED|FAILED|CHALLENGED|CRASHED|INPUT_PREPARATION_CRASHED|PARTIAL|SECURITY_VIOLATED)$/;
  const word = (v) => WORD[v] || String(v).toLowerCase().replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());
  const onTest = (x) => (NOTEST.test(x.verdict) ? '' : ` on test ${(x.passedTestCount || 0) + 1}`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nl = (t) => String(t == null ? '' : t).replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const fmtDate = (sec) => new Date(sec * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const rowToSub = (r) => ({ id: r[0], creationTimeSeconds: r[1], problem: { contestId: r[2], index: r[3] }, verdict: r[4], programmingLanguage: r[5], timeConsumedMillis: r[6], memoryConsumedBytes: r[7], passedTestCount: r[8] });
  const limits = () => {
    const d = c.app.d, t = /([\d.]+)\s*(s|ms)/.exec(d.time || ''), m = /([\d.]+)\s*(MB|KB|GB)/.exec(d.mem || '');
    return { ms: t ? +t[1] * (t[2] === 's' ? 1000 : 1) : 0, kb: m ? +m[1] * ({ KB: 1, MB: 1024, GB: 1048576 }[m[2]]) : 0 };
  };
  const myLink = () => `/submissions/${encodeURIComponent(c.app.d.handle || '')}`;

  /* ---- mount ------------------------------------------------------------------------------------------------------- */
  function mount(ctx) {
    c = ctx;
    S = { handle: c.app.d.handle, view: null, busy: false, token: 0, trace: [], sink: null, restore: null, rows: [], limited: false, prow: null, total: 0, srcWait: {}, tests: {}, srcSeq: 0 };
    S.onSrc = (e) => { try { const m = JSON.parse(e.detail); const w = S.srcWait[m.id]; if (w) { delete S.srcWait[m.id]; w(m); } } catch (x) { /* not ours */ } };
    document.addEventListener('cfm:src-state', S.onSrc);
    loadData();
  }
  function unmount() {
    if (!S) return;
    S.token++; endSink(); if (CFM.state) { CFM.state.solved = undefined; CFM.state.tried = undefined; CFM.state.rows = undefined; }
    document.removeEventListener('cfm:src-state', S.onSrc);
    S = null; c = null;
  }
  const alive = (t) => S && c && t === S.token;

  /* Solved / Tried chip and "Solved by": from the compact caches (api.js), never blocking the page */
  function loadData() {
    const t = S.token, A = globalThis.CFM_API; if (!A) return;
    if (S.handle) A.statusRows(S.handle).then(({ rows, limited }) => { if (!alive(t)) return; S.rows = rows; S.limited = limited; recompute(); paintChip(); refreshOpen(); c.fire('status'); }).catch((e) => { if (alive(t)) { S.apiErr = e.message; refreshOpen(); } });
    A.problemRow(c.CID, c.IDX).then((r) => { if (!alive(t) || !r) return; S.prow = r; paintFooter(); }).catch(() => {});
  }
  const mine = () => S.rows.filter((r) => String(r[2]) === String(c.CID) && r[3] === c.IDX);
  function recompute() {
    const ok = mine().filter((r) => r[4] === 'OK'); S.total = ok.reduce((m, r) => Math.max(m, r[8] || 0), 0); S.solved = ok.length > 0; S.tried = mine().length > 0;
    CFM.state = CFM.state || {}; CFM.state.solved = S.solved; CFM.state.tried = S.tried; CFM.state.rows = S.rows;   // read by rich.js (spoiler rules) and strip.js (solved letters)
  }
  function paintChip() {
    const m = c.app.sh.getElementById('stm'); if (!m) return;   // LeetCode's mark: plain green text right of the title
    m.className = 'stm' + (S.solved ? ' st-chip ok' : S.tried ? ' st-chip try' : '');
    m.innerHTML = S.solved ? `<span>Solved</span>${c.ic('cok')}` : S.tried ? `<span>Attempted</span>${c.ic('clock')}` : '';
  }
  function paintFooter() {
    const f = c.app.sh.querySelector('.foot'); if (!f || f.querySelector('#solvedby') || !S.prow) return;
    f.insertAdjacentHTML('afterbegin', `<span class="fb" id="solvedby" title="Solved by ${S.prow[4].toLocaleString('en-US')} people">${c.ic('users')}<span>Solved by ${S.prow[4].toLocaleString('en-US')}</span></span>`);
  }

  /* ---- views ------------------------------------------------------------------------------------------------------- */
  function show(view) { S.view = view; const t = c.$('tab-result'); if (t) t.hidden = false; c.showTab('result'); }
  function repaint() { if (!S) return; if (c.app.sh.querySelector('[data-tab="result"].on')) renderResult(c.$('pane-other')); }
  function setView(view) { S.view = view; const t = c.$('tab-result'); if (t) t.hidden = false; repaint(); }

  function progressHTML(total, passed, bad, running) {
    if (!total) return '';
    if (total <= SQUARES_MAX) {
      const cells = Array.from({ length: total }, (_, i) => `<b class="${i < passed ? 'p' : bad && i + 1 === bad ? 'f' : running && i + 1 === running ? 'r' : ''}"></b>`).join('');
      return `<div class="ticks" data-m="progress">${cells}</div>`;
    }
    const pw = (passed / total) * 100;
    const mark = bad ? `<i class="f" style="left:${pw.toFixed(2)}%"></i>` : running ? `<i class="r" style="left:${pw.toFixed(2)}%"></i>` : '';
    const cap = bad ? `Test ${bad} of ${total} · ${passed} passed before it` : running ? `Running on test ${running} of ${total}` : `All ${total} tests passed`;
    return `<div class="segbar" data-m="progress"><i class="p" style="width:${(bad || running ? pw : 100).toFixed(2)}%"></i>${mark}</div><div class="segcap">${cap}</div>`;
  }
  function metaRow(x, extra) {
    return `<div class="rs-meta"><span>${c.esc(x.programmingLanguage)}</span><i class="sep"></i><span>Submission ${x.id}</span><i class="sep"></i><span>${extra || fmtDate(x.creationTimeSeconds)}</span></div>`;
  }
  const link = (href, t) => `<a class="link" href="${href}" style="font-weight:400">${t}</a>`;
  const subHref = (x) => `/${/^\d{6,}$/.test(String(x.problem.contestId)) && x.problem.contestId >= 100000 ? 'gym' : 'contest'}/${x.problem.contestId}/submission/${x.id}`;

  function renderResult(el) {
    if (!el || !S) return;
    const v = S.view, esc = c.esc;
    if (!v) { el.innerHTML = '<div class="stub"><b>No result yet</b>Press Submit to send your code to Codeforces. The verdict appears here.</div>'; return; }
    if (v.k === 'msg') {
      el.innerHTML = `<div class="rs-head"><span class="big ${v.tone || ''}">${esc(v.title)}</span></div><p style="margin-top:12px;color:var(--t2)">${esc(v.msg).replace(/\n/g, '<br>')}</p>${v.link ? `<p style="margin-top:12px">${v.link}</p>` : ''}${v.diag ? `<details style="margin-top:16px;color:var(--t3)"><summary style="cursor:pointer">Details for a bug report</summary><pre style="white-space:pre-wrap;font:12px/18px var(--mono);margin-top:8px">${esc(v.diag)}</pre></details>` : ''}`;
      return;
    }
    if (v.k === 'working') {
      el.innerHTML = `<div class="rs-head"><span class="big">${esc(v.title)}</span></div><div class="progress"><span class="spin"></span><span style="color:var(--t2)">${esc(v.msg)}</span></div>`;
      return;
    }
    const x = v.sub, fin = x.verdict && x.verdict !== 'TESTING';
    if (!fin) {
      const n = x.verdict === 'TESTING' ? (x.passedTestCount || 0) + 1 : 0;
      el.innerHTML = `<div class="rs-head"><span class="big">${n ? 'Running on test ' + n : 'In the queue'}</span></div>${metaRow(x, 'just now')}
        <div class="progress"><span class="spin"></span><span style="color:var(--t2)">Judging…${x.passedTestCount ? ` ${x.passedTestCount} tests passed so far` : ''}</span></div>
        ${S.total ? `<div style="margin-top:14px">${progressHTML(S.total, x.passedTestCount || 0, 0, n)}</div>` : ''}`;
      return;
    }
    if (v.k === 'lost') { /* handled above through msg */ }
    const ok = x.verdict === 'OK', neu = /COMPILATION_ERROR|SKIPPED|REJECTED/.test(x.verdict);
    const L = limits(), ms = x.timeConsumedMillis || 0, kb = Math.floor((x.memoryConsumedBytes || 0) / 1024);
    const det = S.tests[x.id], tests = det && det.tests, bad = tests && (tests.find((t) => t.bad) || [...tests].reverse().find((t) => !t.ok));
    const passed = ok ? (x.passedTestCount || S.total) : (x.passedTestCount || 0);
    let prog = '';
    if (!neu) {
      if (ok) prog = progressHTML(x.passedTestCount || S.total, x.passedTestCount || S.total, 0, 0);
      else if (S.total) prog = progressHTML(S.total, passed, passed + 1, 0);
      else if (tests && tests.length) prog = progressHTML(tests.length, tests.filter((t) => t.ok).length, bad ? bad.n : 0, 0);
    }
    const stats = neu ? '' : `<div class="stats" data-m="stats"><div class="stat"><div class="k2">${c.ic('clock')}Time</div><div class="val">${ms} ms${L.ms ? `<small>of ${L.ms >= 1000 ? L.ms / 1000 + ' s' : L.ms + ' ms'} limit</small>` : ''}</div>${L.ms ? `<div class="bar"><i style="width:${Math.min(100, Math.max(2, ms / L.ms * 100)).toFixed(1)}%"></i></div>` : ''}</div>
      <div class="stat"><div class="k2">${c.ic('clock')}Memory</div>${!kb ? '<div class="val" title="Codeforces reports 0 KB for this run: it did not measure it">—<small>not reported</small></div></div></div>' : `<div class="val">${kb} KB${L.kb ? `<small>of ${L.kb >= 1024 ? L.kb / 1024 + ' MB' : L.kb + ' KB'} limit</small>` : ''}</div>${L.kb ? `<div class="bar"><i style="width:${Math.min(100, Math.max(2, kb / L.kb * 100)).toFixed(1)}%"></i></div>` : ''}</div></div>`}`;
    let detail = '';
    if (!ok && !neu) {
      if (det && det.state === 'loading') detail = '<div class="progress"><span class="spin"></span><span style="color:var(--t2)">Loading the failing test…</span></div>';
      else if (bad) {
        const box = (lab, t, cls) => (t === '' || t == null ? '' : `<div class="lbl2">${lab}</div><div class="field${cls || ''}">${esc(t) || '&nbsp;'}</div>`);
        detail = `<div class="ftest" data-m="failtest"><div class="fh"><b>Test ${bad.n}</b><span style="flex:1"></span>${link(subHref(x), 'View on Codeforces')}</div>
          ${bad.interaction ? '<div class="hint">This is an interactive problem: Codeforces shows the interaction log on its own page.</div>' : box('Input', bad.input) + box('Your output', bad.output, ' bad') + box('Answer', bad.answer)}${box('Checker comment', bad.checker, ' chk')}</div>`;
      } else if (det && det.state === 'none') detail = `<p style="margin-top:16px;color:var(--t2)">Codeforces did not give the failing test for this submission. ${link(subHref(x), 'See it on Codeforces')}</p>`;
    }
    const stored = v.code != null ? v.code : det && det.source;
    const code = stored != null ? `<div class="codeblk" style="margin-top:20px"><div class="hd"><span>${esc(x.programmingLanguage)}</span><span class="sp"></span></div><pre>${esc(nl(stored))}</pre></div>`
      : `<p style="margin-top:20px;color:var(--t2)">This code was not sent from here, so it is not stored. ${link(subHref(x), 'View on Codeforces')}</p>`;
    el.innerHTML = `<div class="rs-head"><span class="big ${ok ? 'ok' : neu ? '' : 'bad'}">${esc(word(x.verdict))}</span> <span style="color:var(--t2)">${esc(onTest(x).trim())}${ok && (x.passedTestCount || S.total) ? `Passed all ${x.passedTestCount || S.total} tests` : ''}</span></div>${metaRow(x)}${stats}${prog}${detail}${code}`;
  }

  /* ---- failing-test details: ONE POST /data/submitSource per opened non-Accepted submission -------------------------- */
  function parseTests(d) {
    return Object.keys(d).map((k) => /^accepted#(\d+)$/.exec(k)).filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b).map((n) => ({
      n, ok: d['accepted#' + n] === 'true', bad: d['rejected#' + n] === 'true', input: nl(d['input#' + n]), output: nl(d['output#' + n]), answer: nl(d['answer#' + n]),
      checker: nl(d['checkerStdoutAndStderr#' + n]), interaction: !!d['interactionLog#' + n],
    }));
  }
  function loadDetails(x) {
    if (!S || x.verdict === 'OK' || S.tests[x.id]) return;
    const t = S.token, id = 'd' + (++S.srcSeq);
    S.tests[x.id] = { state: 'loading' };
    const to = setTimeout(() => { if (S && S.srcWait[id]) { delete S.srcWait[id]; S.tests[x.id] = { state: 'none' }; repaint(); } }, 20000);
    S.srcWait[id] = (m) => {
      clearTimeout(to); if (!alive(t)) return;
      if (!m.ok || !m.data) S.tests[x.id] = { state: 'none', error: m.error };
      else S.tests[x.id] = { state: 'ok', tests: parseTests(m.data), source: m.data.source != null ? String(m.data.source).replace(/\r\n?/g, '\n') : null };
      repaint();
    };
    document.dispatchEvent(new CustomEvent('cfm:src', { detail: JSON.stringify({ id, submissionId: String(x.id) }) }));
    repaint();
  }

  /* ---- Submissions tab --------------------------------------------------------------------------------------------- */
  function renderSubs(el) {
    const esc = c.esc;
    if (!S.handle) { el.innerHTML = '<div class="stub"><b>Sign in to see your submissions</b>Your submissions for this problem appear here once you are signed in to Codeforces.</div>'; return; }
    const rows = mine();
    if (!S.rows.length && !S.apiErr) { el.innerHTML = '<div class="progress"><span class="spin"></span><span style="color:var(--t2)">Loading your submissions…</span></div>'; return; }
    if (S.apiErr && !S.rows.length) { el.innerHTML = `<div class="stub"><b>Couldn't load your submissions</b>Codeforces' API did not answer (${esc(S.apiErr)}). ${link(myLink(), 'Open My submissions')}</div>`; return; }
    if (!rows.length) { el.innerHTML = `<div class="stub"><b>No submissions for this problem yet</b>Write a solution and press Submit.${S.limited ? ' (Showing your latest 1,000 submissions.)' : ''}</div>`; return; }
    const item = rows.map((r) => {
      const x = rowToSub(r), ok = x.verdict === 'OK', neu = /COMPILATION_ERROR|SKIPPED/.test(x.verdict), cls = ok ? 'ok' : neu ? 'neu' : 'bad';
      const icn = ok ? 'cok' : neu ? 'calert' : 'cbad';
      return `<a class="r" data-act="sub:${x.id}" tabindex="0" role="button"><span class="ic ${cls}">${c.ic(icn)}</span><span class="st ${cls}">${esc(word(x.verdict))}${esc(onTest(x))}<small>${esc(fmtDate(x.creationTimeSeconds))}</small></span><span><span class="lg">${esc(x.programmingLanguage)}</span></span><span class="nm">${neu ? '—' : x.timeConsumedMillis + ' ms'}</span><span class="nm">${neu || !(x.memoryConsumedBytes >= 1024) ? '—' : Math.floor(x.memoryConsumedBytes / 1024) + ' KB'}</span></a>`;
    }).join('');
    el.innerHTML = `<div class="sl" data-m="sublist"><div class="hd"><span></span><span>Status</span><span>Language</span><span style="text-align:right">Time</span><span style="text-align:right">Memory</span></div>${item}</div>${S.limited ? '<p style="margin-top:12px;color:var(--t3);font-size:12px">Showing your latest 1,000 submissions.</p>' : ''}`;
  }
  const refreshOpen = () => { if (S && c.app.sh.querySelector('[data-tab="subs"].on')) renderSubs(c.$('pane-other')); };

  /* ---- Submit ------------------------------------------------------------------------------------------------------- */
  const trace = (m) => { S.trace.push(((performance.now() / 1000) | 0) + 's ' + m); };
  function endSink() {
    if (!S) return;
    if (S.restore) { try { S.restore(); } catch (e) { /* gone */ } S.restore = null; }
    if (S.timer) { clearTimeout(S.timer); S.timer = 0; }
    if (S.sink) { S.sink.remove(); S.sink = null; }
  }
  function busy(on) { if (!S) return; S.busy = on; const b = c.$('btn-sub'); if (b) b.classList.toggle('off', on); }
  const fail = (title, msg, extra) => { busy(false); show(Object.assign({ k: 'msg', title, msg, tone: 'bad' }, extra || {})); };

  /* ---- the language check: code that is plainly another language than the one picked is not sent ----------------------
     (Go code under Python 3 gave "Compilation error" while the same code had been Accepted as Go, user Oct 30 2026). Only
     unmistakable markers count; anything unsure is sent as it is. C and C++ are one family (a C file compiles as C++). */
  const FAM = [
    ['Go', /^\s*package\s+main\b/m, /^Go\b/i],
    ['Kotlin', /\bfun\s+main\s*\(/, /Kotlin/i],
    ['Java', /\bpublic\s+(?:final\s+)?class\s+\w+|\bimport\s+java\.|\bSystem\.out\.print/, /^Java\b/i],
    ['C#', /\busing\s+System\s*;|\bstatic\s+void\s+Main\s*\(/, /C#|\.NET|Mono/i],
    ['Rust', /\bfn\s+main\s*\(\s*\)|\buse\s+std::/, /Rust/i],
    ['C++', /#\s*include\s*[<"]|\busing\s+namespace\s+std\b/, /C\+\+|G\+\+|Clang|\bGNU C\b|\bC1[1-9]\b|^C\b/i],
    ['JavaScript', /\bconsole\.log\s*\(|require\(\s*['"](?:readline|fs)['"]\s*\)/, /JavaScript|Node/i],
    ['Python', /^\s*def\s+\w+\s*\([^)]*\)\s*(?:->[^:]+)?:\s*$|^\s*(?:from\s+\w+(?:\.\w+)*\s+)?import\s+\w+(?:\s*,\s*\w+)*\s*$|^\s*\w+\s*=\s*(?:int\()?input\(\)/m, /Python|PyPy/i],
  ];
  const famOfName = (name) => (FAM.find((f) => f[2].test(name || '')) || [])[0] || '';
  const famOfCode = (code) => (FAM.find((f) => f[1].test(code)) || [])[0] || '';
  /* the language to offer: the one you last submitted in that family, else the newest-looking one Codeforces lists */
  function langFor(fam) {
    const L = c.app.d.langs.filter((l) => famOfName(l.name) === fam); if (!L.length) return null;
    for (const r of S.rows || []) { const hit = L.find((l) => l.name === r[5]); if (hit) return hit; }
    const num = (l) => +((l.name.match(/(\d+)(?!.*\d)/) || [])[1] || 0);
    return L.slice().sort((x, y) => (/G\+\+|Python 3|PyPy 3/i.test(y.name) - /G\+\+|Python 3|PyPy 3/i.test(x.name)) || num(y) - num(x))[0];
  }

  async function submit(opt = {}) {
    if (!S || S.busy) return c && c.flash('A submit is already in progress.');
    const a = c.app;
    busy(true);
    if (!S.handle) return fail('Sign in to submit', 'Codeforces only takes submissions from signed-in users. Sign in, then come back to this problem.');
    if (!a.lang) return fail('Choose a language first', 'Pick a language above the editor. Nothing was sent.');
    show({ k: 'working', title: 'Checking…', msg: 'Reading your code and your latest submission.' });
    const code = await new Promise((r) => c.getCode(r));
    if (!S) return;
    if (!String(code).trim()) return fail('No code yet', 'Write a solution first. Nothing was sent.');
    const store = await new Promise((r) => chrome.storage.local.get([SUBS], (x) => r((x && x[SUBS]) || {})));
    if (!S) return;
    const prev = Object.entries(store).find(([, v]) => v && v.p === c.PID && String(v.code).trim() === String(code).trim());
    if (prev) return fail('Already sent', `This exact code was already sent to this problem (submission ${prev[0]}). Codeforces refuses an identical resubmission, so nothing was sent.`, { link: link(subHref({ id: prev[0], problem: { contestId: c.CID } }), 'See that submission') });
    const sel = c.langName(a.lang), want = famOfName(sel), got = famOfCode(String(code));
    if (!opt.force && want && got && want !== got) {
      const alt = langFor(got);
      return fail('Language mismatch', `This code looks like ${got}, but ${sel} is selected. Codeforces would compile it as ${want} and answer Compilation error, so nothing was sent.`,
        { link: `${alt ? `<button type="button" class="lmfix" data-act="sublang:${c.esc(alt.id)}">Switch to ${c.esc(alt.name)} and submit</button>` : ''}<button type="button" class="lmfix ghost" data-act="subforce">Submit as ${c.esc(sel)} anyway</button>` });
    }
    doSubmit(code, a.lang);
  }

  /* ---- sending: Codeforces' own Submit form, read from its page and POSTed with fetch (FASTLAP's pit wall, which the user
     found flawless live, Oct 28 2026). Codeforces answers the POST with your submissions page (it went in, the newest row is
     it) or with the Submit page and its message (refused: "You have submitted exactly the same code before"). Nothing waits
     on the API, so there is no 10-second window and no "Nothing came back". ---------------------------------------------- */
  const SEL = { form: 'form.submit-form, form[action*="submit"]', lang: 'select[name="programTypeId"]', source: 'textarea[name="source"]', problem: 'select[name="submittedProblemIndex"]', error: '.error, span.error, .for__source', row: 'table.status-frame-datatable tr[data-submission-id]', cell: 'td.status-verdict-cell' };
  const signedOut = (d) => !!d.querySelector('a[href*="/enter"]') && !d.querySelector('a[href*="logout"]');
  const csrfOf = (d) => (d.querySelector('.csrf-token[data-csrf]') || {}).dataset?.csrf || (d.querySelector('meta[name="X-Csrf-Token"]') || {}).content || (d.querySelector('input[name="csrf_token"]') || {}).value || '';
  async function page(url, init, ms = 15000) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(url, Object.assign({ credentials: 'include', signal: ctl.signal }, init || {}));
      if (/^\/enter\/?$/.test(new URL(res.url, location.href).pathname)) throw new Error('Sign in to Codeforces first');
      return { d: new DOMParser().parseFromString(await res.text(), 'text/html'), url: res.url, status: res.status };
    } catch (e) { if (e.name === 'AbortError') throw new Error('Codeforces did not answer in time'); throw e; } finally { clearTimeout(to); }
  }
  const submitUrl = () => (/^\/gym\//.test(location.pathname) ? `/gym/${c.CID}/submit/${c.IDX}` : /^\/contest\//.test(location.pathname) ? `/contest/${c.CID}/submit/${c.IDX}` : `/problemset/submit/${c.CID}/${c.IDX}`);
  /* a status-table row -> the submission object the Result view draws (the API's shape) */
  const VTEXT = [[/^accepted|pretests passed/i, 'OK'], [/^wrong answer/i, 'WRONG_ANSWER'], [/^time limit/i, 'TIME_LIMIT_EXCEEDED'], [/^memory limit/i, 'MEMORY_LIMIT_EXCEEDED'], [/^runtime error/i, 'RUNTIME_ERROR'], [/^compilation error/i, 'COMPILATION_ERROR'], [/^idleness/i, 'IDLENESS_LIMIT_EXCEEDED'], [/^presentation/i, 'PRESENTATION_ERROR'], [/^hacked/i, 'CHALLENGED'], [/^skipped/i, 'SKIPPED'], [/^denial|^judgement failed|^failed/i, 'FAILED'], [/^partial/i, 'PARTIAL'], [/^security/i, 'SECURITY_VIOLATED']];
  function readRow(d) {
    const tr = d.querySelector(SEL.row), td = tr && tr.querySelector(SEL.cell); if (!tr || !td) return null;
    const text = (td.textContent || '').replace(/\s+/g, ' ').trim(), j = td.querySelector('.verdict-format-judged'), n = j ? parseInt(j.textContent, 10) || 0 : 0;
    const waiting = td.getAttribute('waiting') === 'true' || /^(in queue|running|testing|judging|compiling)/i.test(text) || !text;
    const attr = (td.querySelector('[submissionverdict]') || { getAttribute: () => '' }).getAttribute('submissionverdict');
    const code = waiting ? 'TESTING' : (attr && attr !== 'TESTING' ? attr : (VTEXT.find(([re]) => re.test(text)) || [0, 'FAILED'])[1]);
    const num = (cls) => parseInt(((tr.querySelector('.' + cls) || {}).textContent || '').replace(/\D+/g, ''), 10) || 0;
    const lang = ((tr.querySelectorAll('td')[4] || {}).textContent || '').trim();
    const passed = code === 'TESTING' ? Math.max(0, n - 1) : code === 'OK' ? (n || 0) : Math.max(0, n - 1);
    return { id: +tr.getAttribute('data-submission-id'), creationTimeSeconds: Math.floor(Date.now() / 1000), problem: { contestId: +c.CID, index: c.IDX }, verdict: code, passedTestCount: passed, programmingLanguage: lang || (c.app.d.langs.find((l) => l.id === c.app.lang) || {}).name || '', timeConsumedMillis: num('time-consumed-cell'), memoryConsumedBytes: num('memory-consumed-cell') * 1024, text };
  }

  async function doSubmit(code, lang) {
    const t = ++S.token, pid = c.PID;
    S.trace = []; setView({ k: 'working', title: 'Sending…', msg: 'Sending your code to Codeforces.' });
    let sp;
    try { sp = await page(submitUrl()); trace('submit page ' + sp.status + ' ' + new URL(sp.url).pathname); }
    catch (e) { return fail('Nothing was sent', `Couldn't open Codeforces' Submit page (${e.message}). Try again in a moment.`); }
    if (!alive(t)) return;
    const form = sp.d.querySelector(SEL.form);
    if (!form || !form.querySelector(SEL.lang)) {
      if (signedOut(sp.d)) return fail('Sign in to submit', 'Codeforces only takes submissions from signed-in users. Sign in, then come back to this problem.');
      return fail('Codeforces wants a check first', 'Codeforces did not show its Submit form (it may be checking your browser). Open the Submit page once, then press Submit here again. Nothing was sent.', { link: link(submitUrl(), 'Open the Submit page') });
    }
    const body = new FormData();
    for (const el of form.elements) {
      if (!el.name || el.disabled || /^(submit|button|file|reset|image)$/.test(el.type) || (/^(checkbox|radio)$/.test(el.type) && !el.checked)) continue;
      body.set(el.name, el.value);
    }
    body.set('programTypeId', lang); body.set('source', code);
    if (!body.get('tabSize')) body.set('tabSize', '4');
    if (form.querySelector(SEL.problem)) body.set('submittedProblemIndex', c.IDX);
    if (!body.get('csrf_token')) body.set('csrf_token', csrfOf(sp.d) || csrfOf(document));
    let r;
    try { r = await page(new URL(form.getAttribute('action') || sp.url, sp.url).href, { method: 'POST', body }, 30000); trace('POST answered ' + r.status + ' ' + new URL(r.url).pathname); }
    catch (e) { return fail("Can't tell whether it was sent", `The connection broke while sending (${e.message}). Check My submissions before trying again; nothing was retried.`, { link: link(myLink(), 'Open My submissions') }); }
    if (!alive(t)) return;
    const back = r.d;
    if (!back.querySelector(SEL.row) && (/\/submit/.test(new URL(r.url).pathname) || (back.querySelector(SEL.form) && back.querySelector(SEL.source)))) {
      const err = [...back.querySelectorAll(SEL.error)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)[0];
      return fail('Codeforces says no', (err || (r.status !== 200 ? `Codeforces answered ${r.status}` : 'Codeforces did not accept the submission')) + '\n(Nothing new was created.)');
    }
    const mineUrl = new URL(sp.url).pathname.replace(/^\/problemset\/submit.*$/, '/problemset/status?my=on').replace(/^\/(contest|gym)\/(\d+)\/submit.*$/, '/$1/$2/my');
    const statusUrl = /\/submit/.test(new URL(r.url).pathname) ? mineUrl : r.url;
    const first = readRow(back);
    if (!first) return fail('Sent', "Codeforces took the code but its answer had no submissions table. Open My submissions to see the verdict.", { tone: '', link: link(myLink(), 'Open My submissions') });
    trace('submission ' + first.id + ' ' + first.text);
    storeCode(String(first.id), code, lang);
    watchLive(t, statusUrl, first, code, pid);
  }

  /* the verdict, live: your submissions in a hidden frame, where Codeforces' own stream updates the row; read every 400 ms.
     If the frame stalls (6 s without a change) the page is re-read, at most every 5 s, for 2 minutes. */
  function watchLive(t, statusUrl, first, code) {
    endSink();
    const f = S.sink = document.createElement('iframe'); f.setAttribute('data-cfm', ''); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0;visibility:hidden';
    document.documentElement.appendChild(f); f.src = statusUrl;
    const t0 = Date.now(); let last = '', changed = Date.now(), reload = 0, reading = false;
    const seen = (x) => {
      if (!x || x.id !== first.id || !alive(t)) return false;
      const key = x.verdict + '|' + x.passedTestCount + '|' + x.timeConsumedMillis;
      if (key !== last) { last = key; changed = Date.now(); }
      if (x.verdict !== 'TESTING') {
        S.token++; busy(false); endSink();
        S.view = { k: 'final', sub: x, code }; show(S.view); mergeRow(x); recompute(); paintChip(); c.fire('status');
        if (x.verdict !== 'OK') loadDetails(x);
        const A = globalThis.CFM_API; if (A && S.handle) A.latest(S.handle, 5).catch(() => {});   // the caches catch up (Problems page, profile)
        return true;
      }
      setView({ k: 'run', sub: x });
      return false;
    };
    if (seen(first)) return;
    const tick = () => {
      if (!alive(t)) return;
      let x = null; try { x = f.contentDocument ? readRow(f.contentDocument) : null; } catch (e) { x = null; }
      if (seen(x)) return;
      if (Date.now() - changed > 6000 && Date.now() - reload > 5000 && !reading) {
        reload = Date.now(); reading = true;
        page(statusUrl).then((p) => { reading = false; seen(readRow(p.d)); }).catch(() => { reading = false; });
      }
      if (Date.now() - t0 > WATCH_MS) { S.token++; busy(false); endSink(); return setView({ k: 'msg', title: 'Still running', tone: '', msg: `Submission ${first.id} is still being judged after 2 minutes. It was sent: open My submissions to follow it.`, link: link(myLink(), 'Open My submissions') }); }
      S.timer = setTimeout(tick, 400);
    };
    S.timer = setTimeout(tick, 400);
  }
  function mergeRow(x) { const row = globalThis.CFM_API.pack(x); S.rows = [row, ...S.rows.filter((r) => r[0] !== x.id)]; }
  function storeCode(sid, code, lang) {
    chrome.storage.local.get([SUBS], (r) => {
      const m = (r && r[SUBS]) || {}; m[sid] = { code, lang, p: c ? c.PID : '', at: Date.now() };
      const keys = Object.keys(m).sort((a, b) => m[a].at - m[b].at);
      while (keys.length > LAST) delete m[keys.shift()];
      chrome.storage.local.set({ [SUBS]: m });
    });
  }
  function openSub(id) {
    const r = S.rows.find((x) => String(x[0]) === String(id)); if (!r) return;
    const x = rowToSub(r);
    chrome.storage.local.get([SUBS], (st) => {
      if (!S) return;
      const rec = st && st[SUBS] && st[SUBS][x.id];
      S.view = { k: 'final', sub: x, code: rec ? rec.code : null }; show(S.view);
      if (x.verdict !== 'OK') loadDetails(x);
    });
  }

  CFM.debug = CFM.debug || {};
  CFM.debug.submit = () => {
    if (!S) return null;
    const v = S.view, sub = v && v.sub;
    return { handle: S.handle || '(nobody)', busy: S.busy, view: v && { kind: v.k, title: v.title, msg: v.msg && String(v.msg).slice(0, 220), verdict: sub && sub.verdict, submissionId: sub && sub.id }, solved: S.solved, tried: S.tried, totalTestsKnown: S.total,
      statusRows: S.rows.length, limitedToLatest1000: S.limited, statusError: S.apiErr || null, solvedBy: S.prow ? S.prow[4] : null, details: Object.entries(S.tests).map(([id, d]) => id + ':' + d.state), trace: S.trace.slice(-40) };
  };

  CFM.use({
    mount, unmount,
    act(a) {
      if (!S) return; if (a === 'submit') return submit(); if (a === 'subforce') return submit({ force: true });
      if (a.startsWith('sublang:')) { const id = a.slice(8); return c.getCode((code) => { c.setLang(id, code); setTimeout(() => submit(), 300); }); } if (a.startsWith('sub:')) return openSub(a.slice(4)); },
    shortcut(k) { if (k === 'submit') submit(); },
    pane(k, el) {
      if (!S) return false;
      if (k === 'subs') { renderSubs(el); return true; }
      if (k === 'result') { renderResult(el); return true; }
      return false;
    },
  });
})();
