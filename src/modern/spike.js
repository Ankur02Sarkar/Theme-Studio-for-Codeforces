/* =============================================================================
   spike.js  (isolated world, DEV SPIKE for Gate M0; MODERN.md "M0 (b)")
   Behind storage { cfmDev: true }. A floating box on a problem page: a textarea,
   a language select, Run (custom invocation via bridge.js) and Submit (the
   page's own sidebar form, sent into a hidden same-origin iframe). It shows
   what came back; no polish. Removes itself (and every node it added) when
   cfmDev goes false.
   Never: fetches a page, handles cookies, retries a submit, touches a challenge.
============================================================================= */
(() => {
  if (!/^\/(problemset\/problem\/\d+\/\w+|(contest|gym)\/\d+\/problem\/\w+)/.test(location.pathname)) return;
  /* errors from OUR scripts, kept for the report (this file loads first in the Modern group): uncaught errors, unhandled rejections,
     and console.error/warn calls made by our code (the isolated world's console is ours alone) */
  const ERR = (globalThis.__cfmErrors = globalThis.__cfmErrors || []);
  if (!globalThis.__cfmErrHooked) {
    globalThis.__cfmErrHooked = true;
    const push = (k, m) => { ERR.push(new Date().toISOString().slice(11, 19) + ' ' + k + ': ' + String(m).replace(/\s+/g, ' ').slice(0, 300)); if (ERR.length > 30) ERR.shift(); };
    window.addEventListener('error', (e) => push('error', (e.message || 'error') + ' @ ' + String(e.filename || '').replace(/^.*\//, '') + ':' + e.lineno));
    window.addEventListener('unhandledrejection', (e) => push('unhandled rejection', (e.reason && (e.reason.stack || e.reason.message)) || e.reason));
    for (const k of ['error', 'warn']) { const o = console[k].bind(console); console[k] = (...a) => { try { push('console.' + k, a.map((x) => (x && (x.message || x.stack)) || x).join(' ')); } catch (x) { /* never break logging */ } o(...a); }; }
  }
  let lastIframe = '';
  const KEY = 'cfmDev', SUBS = 'cfmSubmissions', LAST = 300, TIMEOUT_KEY = 'cfmSinkMs';   // TIMEOUT_KEY: a dev override, for tests only
  let SINK_MS = 0;
  let box = null, sink = null, runSeq = 0, submitting = false;
  const $ = (s, r = box) => r.querySelector(s);
  const form = () => document.querySelector('form.submitFrameForm');
  const pid = () => (location.pathname.match(/problem\/(\d+)\/(\w+)/) || location.pathname.match(/(?:contest|gym)\/(\d+)\/problem\/(\w+)/) || []).slice(1, 3).join('');

  function mount() {
    if (box) return;
    box = document.createElement('div');
    box.id = 'cfm-spike'; box.setAttribute('data-cfm', '');
    box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483000;width:420px;max-height:92vh;overflow:auto;background:#fff;color:#111;border:2px solid #36c;border-radius:8px;padding:10px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 24px #0006';
    box.innerHTML = `
      <b>cfm spike (dev)</b> <span style="color:#666">· ${pid()}</span>
      <button data-a="close" style="float:right">×</button><button data-a="min" style="float:right;margin-right:4px" title="Collapse">–</button>
      <div style="margin:6px 0"><button data-a="modern">Modern view</button> <button data-a="iframe">Iframe check</button> <button data-a="report" title="Copies a summary of what this page and the extension are doing. It contains no source code, cookies, tokens or CSRF values.">Copy report</button></div>
      <div data-f="devbody">
      <div style="margin:6px 0"><select data-f="lang" style="max-width:100%"></select></div>
      <div style="margin:4px 0">
        <button data-a="py">Python echo</button> <button data-a="cpp">C++ echo</button>
        <button data-a="sample">Sample 1 → input</button></div>
      <textarea data-f="code" rows="9" spellcheck="false" style="width:100%;font:12px monospace" placeholder="source code"></textarea>
      <textarea data-f="input" rows="3" spellcheck="false" style="width:100%;font:12px monospace" placeholder="stdin for Run"></textarea>
      <div style="margin:6px 0"><button data-a="run">Run</button> <button data-a="submit">Submit</button>
        <span data-f="busy" style="color:#666"></span></div>
      <pre data-f="out" style="white-space:pre-wrap;max-height:220px;overflow:auto;background:#f4f4f4;padding:6px;margin:0"></pre>
      <div data-f="sinkhost"></div></div>`;
    document.documentElement.appendChild(box);
    const f = form();
    syncLang();
    window.addEventListener('load', syncLang);
    if (f) {} else log('No form.submitFrameForm on this page (signed out, or the problem is not open to you). Run may still work.');
    box.addEventListener('click', onClick);
    if (document.documentElement.getAttribute('data-cf-ui') === 'modern') { const bd = $('[data-f=devbody]'); bd.hidden = true; box.style.width = '220px'; }   // out of the way of the Modern app
    box.addEventListener('keydown', (e) => e.stopPropagation(), true);
  }
  /* the language list is copied from the page's own select. It can be empty or unselected when we mount (the page
     fills it later), so it is re-copied on every click and on load, and nothing is sent without a chosen language. */
  function syncLang() {
    if (!box) return;
    const f = form(), src = f && f.querySelector('select[name=programTypeId]'), sel = $('[data-f=lang]');
    if (!src || !src.options.length) return;
    if (sel.options.length !== src.options.length + 1) {
      const keep = sel.value;
      sel.innerHTML = '<option value="">Choose a language…</option>' + src.innerHTML;
      sel.value = keep || src.value;
    }
    if (sel.selectedIndex < 0) sel.value = '';
  }
  function unmount() {
    clearTimeout(sinkTimer); sinkTimer = 0; runToken++;
    if (restoreTarget) { restoreTarget(); restoreTarget = null; }
    if (sink) { sink.remove(); sink = null; }
    if (box) { box.remove(); box = null; }
  }
  const log = (s) => { if (box) $('[data-f=out]').textContent = s; };
  const set = (s) => { if (box) $('[data-f=busy]').textContent = s; };
  const pickLang = (re, last) => { const o = [...$('[data-f=lang]').options].filter((x) => re.test(x.textContent)); const p = last ? o[o.length - 1] : o[0]; if (p) $('[data-f=lang]').value = p.value; return !!p; };

  function onClick(e) {
    const a = e.target.closest('[data-a]'); if (!a) return;
    syncLang();
    switch (a.dataset.a) {
      case 'modern': chrome.storage.local.set({ cfUI: 'modern', cfThemeStudio: 'leetcode' }); break;   // the LeetCode theme is the Modern layout
      case 'min': { const b = $('[data-f=devbody]'); b.hidden = !b.hidden; box.style.width = b.hidden ? '220px' : '420px'; break; }
      case 'iframe': iframeCheck(); break;
      case 'report': report(); break;
      case 'close': chrome.storage.local.set({ [KEY]: false }); break;
      case 'py': pickLang(/Python 3|PyPy 3/); $('[data-f=code]').value = 'import sys\nprint(sys.stdin.read(), end="")\n'; break;
      case 'cpp': pickLang(/GNU G\+\+\d+/, true); $('[data-f=code]').value = '#include <bits/stdc++.h>\nint main(){std::string s,t;while(std::getline(std::cin,s))t+=s+"\\n";std::cout<<t;}\n'; break;
      case 'sample': { const p = document.querySelector('.sample-test .input pre'); if (p) $('[data-f=input]').value = p.dataset.content || p.innerText; break; }
      case 'run': run(); break;
      case 'submit': submit(); break;
    }
  }

  /* ---- the iframe check (MODERN.md M2): may a Codeforces tab embed an extension page? ---- */
  function iframeCheck() {
    log('Trying to embed ' + chrome.runtime.getURL('src/modern/ping.html') + ' …');
    const seen = []; const onV = (e) => seen.push(`${e.violatedDirective} blocked ${e.blockedURI}`);
    document.addEventListener('securitypolicyviolation', onV);
    const f = document.createElement('iframe'); f.style.cssText = 'width:1px;height:1px;border:0;position:fixed;left:-9px;top:-9px'; f.setAttribute('data-cfm', '');
    let done = false;
    const finish = (txt) => { if (done) return; done = true; lastIframe = txt; window.removeEventListener('message', onM); document.removeEventListener('securitypolicyviolation', onV); f.remove(); log(txt); };
    const onM = (e) => { if (e.source === f.contentWindow && e.data && e.data.cfm === 'ping') finish('IFRAME OK: the extension page loaded inside this Codeforces tab and answered (origin ' + e.origin + ').'); };
    window.addEventListener('message', onM);
    f.addEventListener('load', () => setTimeout(() => finish('IFRAME LOADED but did not answer.' + (seen.length ? ' CSP: ' + seen.join('; ') : '')), 1500));
    f.src = chrome.runtime.getURL('src/modern/ping.html');
    document.documentElement.appendChild(f);
    setTimeout(() => finish('IFRAME BLOCKED or never loaded within 4 s.' + (seen.length ? ' CSP: ' + seen.join('; ') : ' (no CSP violation reported)')), 4000);
  }

  /* ---- "Copy report": one block to paste back after a live pass. Counts and states only: NEVER source code, cookies, tokens, CSRF values ---- */
  async function report() {
    const L = [], add = (k, v) => L.push(k + ': ' + (typeof v === 'string' ? v : JSON.stringify(v))), hd = (t) => L.push('', '== ' + t + ' ==');
    const root = document.documentElement, man = chrome.runtime.getManifest();
    hd('Theme Studio for Codeforces, live report (no source code, cookies or tokens)');
    add('when', new Date().toString()); add('extension', man.version); add('browser', navigator.userAgent);
    add('page', location.pathname + ' (readyState ' + document.readyState + ')');
    add('html attributes', { 'data-cf-ui': root.getAttribute('data-cf-ui'), 'data-cf-theme': root.getAttribute('data-cf-theme'), 'data-cf-layout': root.getAttribute('data-cf-layout'), 'data-cf-live': root.hasAttribute('data-cf-live') });
    hd('Iframe check'); add('last result in this tab', lastIframe || '(not run in this tab: press "Iframe check")');
    hd('Codeforces page scripts (through bridge.js)');
    const aa = await new Promise((r) => askAa(r));
    add('answer', 'jq' in aa ? aa : 'NO ANSWER from bridge.js (not loaded on this page, or Modern and the dev box are both unmounted)');
    hd('Storage (counts and ages only)');
    const st = await new Promise((r) => chrome.storage.local.get(['cfUI', 'cfThemeStudio', 'cfmStatus', 'cfmProblems', 'cfmBlog', 'cfmUsers', 'cfmContests', 'cfmSubmissions', 'cfmCode', 'cfmLayout'], r));
    const age = (t) => (t ? Math.round((Date.now() - t) / 60000) + ' min ago' : 'never');
    add('cfUI / theme', [st.cfUI || '(classic)', st.cfThemeStudio || '(default)']);
    add('submissions cache', st.cfmStatus ? { handle: st.cfmStatus.handle, rows: (st.cfmStatus.rows || []).length, latest1000Only: !!st.cfmStatus.limited, fetched: age(st.cfmStatus.at) } : 'none');
    add('problem list cache', st.cfmProblems ? { rows: (st.cfmProblems.rows || []).length, fetched: age(st.cfmProblems.at) } : 'none');
    add('blog cache', st.cfmBlog ? Object.keys(st.cfmBlog) : 'none'); add('handle ranks cache', st.cfmUsers ? Object.keys(st.cfmUsers).length + ' handles' : 'none'); add('contest cache', st.cfmContests ? Object.keys(st.cfmContests) : 'none');
    add('code saved for', st.cfmCode ? Object.keys(st.cfmCode).length + ' problem/language pairs' : 'none'); add('submissions sent from here', st.cfmSubmissions ? Object.keys(st.cfmSubmissions).length : 0); add('saved layout', st.cfmLayout || {});
    const dbg = (globalThis.CFM && globalThis.CFM.debug) || {};
    for (const [k, title] of [['app', 'Modern app'], ['run', 'Run and test cases'], ['submit', 'Submit, Result, Submissions'], ['rich', 'Editorial and Discussion'], ['strip', 'Contest strip']]) {
      hd(title); try { const v = dbg[k] ? dbg[k]() : undefined; add('state', v === undefined ? '(module not loaded)' : v === null ? '(not mounted)' : v); } catch (e) { add('state', 'ERROR reading it: ' + e.message); }
    }
    hd('Recent API calls (this tab)');
    try { (globalThis.CFM_API ? globalThis.CFM_API.log() : []).forEach((x) => L.push('  ' + x.m + '  ' + (x.ok ? 'ok' : 'FAILED: ' + x.err) + '  ' + x.ms + ' ms')); if (!(globalThis.CFM_API && globalThis.CFM_API.log().length)) L.push('  (none yet)'); } catch (e) { L.push('  (unreadable)'); }
    hd('Network requests to Codeforces APIs seen by the page (paths only)');
    try { const r = performance.getEntriesByType('resource').filter((e) => /\/(api|data)\//.test(e.name)).slice(-12); r.forEach((e) => L.push('  ' + new URL(e.name).pathname + '  ' + Math.round(e.duration) + ' ms' + (e.responseStatus ? '  HTTP ' + e.responseStatus : ''))); if (!r.length) L.push('  (none)'); } catch (e) { L.push('  (unreadable)'); }
    hd('Errors from the extension in this tab'); if (ERR.length) ERR.forEach((x) => L.push('  ' + x)); else L.push('  none');
    const text = L.join('\n');
    try { await navigator.clipboard.writeText(text); log('Report copied (' + L.length + ' lines). Paste it into the chat.\n(It contains no source code, cookies, tokens or CSRF values.)\n\n' + text); }
    catch (e) {
      const bd = $('[data-f=devbody]'); bd.hidden = false; box.style.width = '420px';
      log(text); const o = $('[data-f=out]'); const rg = document.createRange(); rg.selectNodeContents(o); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rg);
      o.insertAdjacentText('afterbegin', 'The clipboard was not available: the report is selected below, press Ctrl+C.\n\n');
    }
  }

  /* ---- Run ---- */
  let onState = null;
  function run() {
    if (!$('[data-f=lang]').value) return log('Choose a language first (the list above the code). Nothing was sent.');
    const id = 'r' + (++runSeq);
    set('running…'); log('Sending to /data/customtest…');
    onState = (st) => {
      if (st.id !== id) return;
      if (st.state === 'sent') log('Started: customTestSubmitId ' + st.customTestSubmitId + '\nPolling every 2.5 s…');
      else if (st.state === 'waiting') log('Waiting… (' + st.n + ')');
      else { set(''); log(st.state === 'done' ? `${st.verdict || '(no verdict)'}\nUsed: ${st.stat || '?'}\n---\n${st.output}` : 'ERROR: ' + st.error + (st.raw ? '\n' + JSON.stringify(st.raw) : '')); onState = null; }
    };
    document.dispatchEvent(new CustomEvent('cfm:run', { detail: JSON.stringify({
      id, programTypeId: $('[data-f=lang]').value, sourceCode: $('[data-f=code]').value, input: $('[data-f=input]').value }) }));
  }
  document.addEventListener('cfm:run-state', (e) => { try { if (onState) onState(JSON.parse(e.detail)); } catch (x) {} });

  /* ---- Submit: the page's own form, into a hidden same-origin iframe; the RESULT comes from user.status ----
     Found live (Oct 27 2026, the user's account): a Codeforces page loaded into the hidden frame never fires `load`
     and its body is a stub, so the frame can't be read. The POST itself works (4 test sends were judged). So:
       1. read the newest submission id with the public API (user.status, credentials omitted) BEFORE sending;
       2. send the form into the frame; keep its target aimed at the frame until we know (or 30 s pass);
       3. poll user.status (>= 2.5 s apart) for a newer submission of THIS problem; then for its verdict.
     The frame is only a sink: if it does load and is readable, a challenge or an .error text is shown; nothing else it
     says is trusted. Exactly one POST per click, never retried. */
  const SINK_TIMEOUT_MS = 30000, POLL_DEFAULT_MS = 2500, WATCH_MS = 120000;
  let sinkTimer = 0, restoreTarget = null, trace = [], runToken = 0;
  let POLL_MS = 0;
  const tr = (m) => { trace.push(((performance.now() / 1000) | 0) + 's ' + m); };
  const myHandle = () => { const a = document.querySelector('#header a[href^="/profile/"], .lang-chooser a[href^="/profile/"]'); return a ? decodeURIComponent(a.getAttribute('href').split('/profile/')[1].split(/[?#/]/)[0]) : ''; };
  async function apiStatus(handle, count) {
    const r = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=${count}`, { credentials: 'omit' });
    const j = await r.json(); if (j.status !== 'OK') throw new Error(j.comment || 'API said ' + j.status);
    return j.result;
  }
  const WORD = { OK: 'Accepted', COMPILATION_ERROR: 'Compilation error', WRONG_ANSWER: 'Wrong answer', RUNTIME_ERROR: 'Runtime error', TIME_LIMIT_EXCEEDED: 'Time limit exceeded', MEMORY_LIMIT_EXCEEDED: 'Memory limit exceeded', IDLENESS_LIMIT_EXCEEDED: 'Idleness limit exceeded', PRESENTATION_ERROR: 'Presentation error', CHALLENGED: 'Hacked', SKIPPED: 'Skipped', REJECTED: 'Rejected', FAILED: 'Judgement failed' };
  const verdictText = (x) => { const w = WORD[x.verdict] || x.verdict.toLowerCase().replace(/_/g, ' '); return /OK|COMPILATION_ERROR|SKIPPED|REJECTED|FAILED|CHALLENGED/.test(x.verdict) ? w : `${w} on test ${(x.passedTestCount || 0) + 1}`; };
  function endSubmit() {
    clearTimeout(sinkTimer); sinkTimer = 0; runToken++;
    if (restoreTarget) { restoreTarget(); restoreTarget = null; }
    if (sink) { sink.remove(); sink = null; }
    submitting = false; set('');
  }
  function submit() {
    if (submitting) return log('A submit is already in flight.');
    const f = form();
    if (!f) return log('No submit form on this page. Open the problem signed in.');
    const code = $('[data-f=code]').value, lang = $('[data-f=lang]').value;
    if (!code.trim()) return log('Empty code.');
    if (!lang) return log('Choose a language first (the list above the code). Nothing was sent.');
    const btn = f.querySelector('input[type=submit]');
    if (btn && btn.disabled) return log('Codeforces disabled its Submit button for a few seconds after the last send. Wait 10 s and press Submit again.');
    if (!myHandle()) return log("Can't tell who is signed in (no profile link in the header). Nothing was sent.");
    submitting = true; set('checking…');     // blocks a second click while we ask the stored list, the page checks and the API
    chrome.storage.local.get([SUBS], (r) => {
      if (!box) { submitting = false; return; }
      const prev = Object.entries(r[SUBS] || {}).find(([, v]) => v && v.p === pid() && String(v.code).trim() === code.trim());
      if (prev) { submitting = false; set(''); return log('This exact code was already sent to this problem (submission ' + prev[0] + '). Codeforces refuses an identical resubmission, so nothing was sent.'); }
      askAa((aa) => {
        if (!box) { submitting = false; return; }
        if (!(aa.ftaa && aa.bfaa)) { submitting = false; set(''); return log("Codeforces' page checks (ftaa/bfaa) are not ready yet, so its handler would send them empty. Wait a few seconds and press Submit again."); }
        doSubmit(f, code, lang);
      });
    });
  }
  let aaCb = null;
  function askAa(cb) {
    aaCb = cb; document.dispatchEvent(new CustomEvent('cfm:aa'));
    setTimeout(() => { if (aaCb === cb) { aaCb = null; cb({ ftaa: false, bfaa: false }); } }, 1500);   // no bridge answered
  }
  document.addEventListener('cfm:aa-state', (e) => { try { const cb = aaCb; aaCb = null; if (cb) cb(JSON.parse(e.detail)); } catch (x) {} });

  /* what the hidden frame shows, if it is readable: a challenge, or Codeforces' own error text next to the form
     (e.g. "You have submitted exactly the same code before"). Read-only; never touches the frame. */
  function peekFrame(fr) {
    try {
      const d = fr.contentDocument; if (!d || !d.body || !d.documentElement) return {};
      const title = d.title || '';
      const challenge = /just a moment/i.test(title) || !!d.querySelector('#challenge-form, [id^=cf-chl]');
      const errs = [...d.querySelectorAll('.error, span.for__source, .field-error')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t && t !== '\u00a0');
      const txt = (d.body.innerText || d.body.textContent || '').replace(/\s+/g, ' ');
      const dup = txt.match(/[^.]{0,60}(exactly the same code|submitted[^.]{0,40}before)[^.]{0,40}/i);
      if (dup) errs.push(dup[0].trim());
      else { const h = d.documentElement.innerHTML.match(/[^<>"']{0,60}(exactly the same code|submitted[^<>"']{0,40}before)[^<>"']{0,40}/i); if (h) errs.push(h[0].trim()); }
      const hit = [...d.querySelectorAll('[class*=error i], [class*=for__source]')].map((e) => e.tagName + '.' + e.className + ':' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)).slice(0, 4);
      return { challenge, error: errs[0], sig: `title=${title.slice(0, 40)}, children=${d.body.children.length}, errors=${JSON.stringify(errs).slice(0, 160)}, errorish=${JSON.stringify(hit).slice(0, 200)}, text=${txt.slice(0, 120)}` };
    } catch (e) { return { sig: 'unreadable: ' + e.name }; }
  }

  async function doSubmit(f, code, lang) {
    const token = ++runToken, handle = myHandle(), pr = pid();
    trace = []; set('submitting…'); log('Reading your latest submission, then sending the sidebar form…');
    let baseline = 0;
    try { const r = await apiStatus(handle, 1); baseline = r.length ? r[0].id : 0; tr('baseline submission id ' + baseline); }
    catch (e) { submitting = false; set(''); return log("Couldn't read your latest submission from the Codeforces API (" + e.message + '). Nothing was sent.'); }
    if (token !== runToken || !box) return;
    f.querySelector('[name=source]').value = code;
    f.querySelector('[name=programTypeId]').value = lang;
    const file = f.querySelector('input[type=file]'); if (file) file.value = '';
    if (sink) sink.remove();
    sink = document.createElement('iframe'); sink.name = 'cfm-sink'; sink.setAttribute('data-cfm', '');
    sink.style.cssText = 'width:0;height:0;border:0;position:absolute;left:-9999px';
    $('[data-f=sinkhost]').appendChild(sink);
    const mine = sink, btn = f.querySelector('input[type=submit]');
    mine.addEventListener('load', () => {          // a bonus: it does not fire for Codeforces pages in a frame
      if (mine !== sink || token !== runToken) return;
      let h = ''; try { h = mine.contentWindow.location.href; } catch (e) { h = '(unreadable)'; }
      tr('sink load event, href=' + h); if (h === 'about:blank') return;
      let doc; try { doc = mine.contentDocument; } catch (e) { return; }
      if (!doc) return;
      if (/just a moment/i.test(doc.title || '') || doc.querySelector('#challenge-form') || doc.querySelector('[id^=cf-chl]')) {
        runToken++; clearTimeout(sinkTimer); sinkTimer = 0; if (restoreTarget) { restoreTarget(); restoreTarget = null; }
        mine.style.cssText = 'width:100%;height:320px;border:1px solid #c00;position:static'; submitting = false; set('');
        return log('Codeforces wants to check you are human. Complete it in the frame below, then press Submit again. (We do not touch it.)');
      }
      const err = doc.querySelector('.error, span.for__source, .field-error');
      if (err && err.textContent.trim()) { const m = err.textContent.trim(); endSubmit(); log('Codeforces says: ' + m + '\n(Not resubmitted.)'); }
    });
    const oldTarget = f.getAttribute('target');
    restoreTarget = () => { if (oldTarget == null) f.removeAttribute('target'); else f.setAttribute('target', oldTarget); };
    f.target = 'cfm-sink';
    f.addEventListener('submit', (e) => { tr('submit event, target=' + f.target + ', enctype=' + f.getAttribute('enctype')); setTimeout(() => tr('after Codeforces handlers: defaultPrevented=' + e.defaultPrevented + ', enctype=' + f.getAttribute('enctype') + ', button disabled=' + (btn && btn.disabled)), 0); }, { once: true });
    const t0 = Date.now(), limit = +SINK_MS || SINK_TIMEOUT_MS;
    sinkTimer = setTimeout(() => { sinkTimer = 0; }, limit);     // marks the end of the "did it arrive" window
    try { f.requestSubmit(); } catch (e) { endSubmit(); return log('requestSubmit failed: ' + e); }
    tr('requestSubmit() sent');
    /* did it arrive? */
    let found = null, lastSig = '';
    while (token === runToken && !found) {
      await new Promise((r) => setTimeout(r, POLL_MS || POLL_DEFAULT_MS));
      if (token !== runToken || !box) return;
      try { const r = await apiStatus(handle, 3); const hit = r.find((x) => x.id > baseline && (x.problem.contestId + x.problem.index) === pr); tr('poll: newest id ' + (r[0] && r[0].id) + (hit ? ', NEW ' + hit.id : '')); if (hit) found = hit; }
      catch (e) { tr('poll failed: ' + e.message); }
      if (!found) {                                   // the frame is readable when Codeforces answers with a normal page
        const pk = peekFrame(mine);
        if (pk.sig && pk.sig !== lastSig) { lastSig = pk.sig; tr('frame: ' + pk.sig); }
        if (pk.challenge) {
          runToken++; clearTimeout(sinkTimer); sinkTimer = 0; if (restoreTarget) { restoreTarget(); restoreTarget = null; }
          mine.style.cssText = 'width:100%;height:320px;border:1px solid #c00;position:static'; submitting = false; set('');
          return log('Codeforces wants to check you are human. Complete it in the frame below, then press Submit again. (We do not touch it.)');
        }
        if (pk.error) { const m = pk.error; endSubmit(); return log('Codeforces says: ' + m + '\n(Not resubmitted. Nothing new was created.)'); }
      }
      if (!found && Date.now() - t0 >= limit) {
        let st = '(none)'; try { const d = mine.contentDocument; st = 'readyState=' + (d && d.readyState) + ', title=' + (d && d.title) + ', body children=' + (d && d.body && d.body.children.length); } catch (e) { st = 'unreadable: ' + e.name; }
        tr('window over. frame: ' + st + '; form.target=' + f.target);
        const diag = trace.join('\n'); endSubmit();
        return log('Nothing came back. Check My submissions before trying again; nothing was retried.\n--- diagnostics (send me these) ---\n' + diag + '\n(If this is the same code you sent before, Codeforces refuses duplicates and may not say so here.)');
      }
    }
    if (!found) return;
    /* it arrived: the form may go back, the frame is no longer needed */
    if (restoreTarget) { restoreTarget(); restoreTarget = null; } if (sink) { sink.remove(); sink = null; }
    store(String(found.id), code, lang);
    await watchVerdict(handle, found, token, t0);
  }
  async function watchVerdict(handle, first, token, t0) {
    let cur = first; const w0 = Date.now();
    for (;;) {
      if (token !== runToken || !box) return;
      const fin = cur.verdict && cur.verdict !== 'TESTING';
      if (fin) {
        const ms = cur.timeConsumedMillis, kb = Math.floor((cur.memoryConsumedBytes || 0) / 1024);
        log(`Submission ${cur.id}  (${cur.problem.contestId}${cur.problem.index}, ${cur.programmingLanguage})\n${verdictText(cur)}\nUsed: ${ms} ms, ${kb} KB\nFINAL`);
        runToken++; submitting = false; set(''); return;
      }
      log(`Submission ${cur.id}  (${cur.problem.contestId}${cur.problem.index}, ${cur.programmingLanguage})\n${cur.verdict === 'TESTING' ? 'Running on test ' + ((cur.passedTestCount || 0) + 1) : 'In queue'}…`);
      if (Date.now() - w0 > WATCH_MS) { log(`Submission ${cur.id}\nStill running after 2 min: open My submissions to see it.`); runToken++; submitting = false; set(''); return; }
      await new Promise((r) => setTimeout(r, POLL_MS || POLL_DEFAULT_MS));
      if (token !== runToken || !box) return;
      try { const r = await apiStatus(handle, 3); const x = r.find((y) => y.id === first.id); if (x) cur = x; } catch (e) { tr('verdict poll failed: ' + e.message); }
    }
  }
  function store(sid, code, lang) {
    chrome.storage.local.get([SUBS], (r) => {
      const m = r[SUBS] || {}; m[sid] = { code, lang, p: pid(), at: Date.now() };
      const keys = Object.keys(m).sort((a, b) => m[a].at - m[b].at);
      while (keys.length > LAST) delete m[keys.shift()];
      chrome.storage.local.set({ [SUBS]: m });
    });
  }

  const apply = (on) => { if (on) { if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true }); } else unmount(); };
  chrome.storage.local.get([KEY, TIMEOUT_KEY, 'cfmPollMs'], (r) => { SINK_MS = r[TIMEOUT_KEY] || 0; POLL_MS = r.cfmPollMs || 0; apply(!!r[KEY]); });
  chrome.storage.onChanged.addListener((c, a) => { if (a === 'local' && c[KEY]) apply(!!c[KEY].newValue); });
})();
