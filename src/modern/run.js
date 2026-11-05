/* =============================================================================
   run.js  (isolated world)   MODERN.md M2b: the Testcase / Test Result panel and Run.
   Run = Codeforces' Custom invocation through the page's own jQuery (bridge.js, MAIN world), one case at a time.
   Rules (the user's, M1 review):
   - a SAMPLE run is compared with the sample's output and says "Accepted" or "Wrong Answer"
     (many problems accept any valid answer), never Accepted / Wrong Answer;
   - your own input has no expected answer: "Output" and the runtime, nothing compared;
   - trailing whitespace on each line and the final newline do not count (src/modern/compare.js).
   Editing a sample's input makes it a custom case (its expected output no longer applies).
============================================================================= */
(() => {
  'use strict';
  const CFM = globalThis.CFM; if (!CFM) return;
  let c = null, st = null;
  const MAX_CASES = 12;

  function preText(pre) {
    const k = pre.cloneNode(true);
    k.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
    const lines = k.querySelectorAll('.test-example-line');
    const t = lines.length ? [...lines].map((l) => l.textContent).join('\n') : k.textContent;
    return t.replace(/\r/g, '').replace(/\s+$/, '') + '\n';
  }
  const dot = (r) => (!r ? 'n' : r.state === 'running' ? 'n' : r.kind === 'match' ? '' : r.kind === 'differs' ? 'w' : r.kind === 'fail' ? 'x' : 'n');
  const parseStat = (s) => { const m = String(s || '').match(/(\d+)\s*ms,\s*(\d+)\s*KB/); return m ? { ms: +m[1], kb: +m[2] } : null; };
  const nice = (e) => /No CSRF/.test(e) ? 'Sign in to Codeforces to run code (Codeforces only runs custom tests for signed-in users).'
    : /jQuery is not/.test(e) ? "Codeforces' own page script is not ready. Reload the page and try again." : e;

  function mount(ctx) {
    c = ctx;
    st = { cases: [], cur: 0, tab: 'case', busy: false, seq: 0, pending: null, poll: 0 };
    chrome.storage.local.get(['cfmPollMs'], (r) => { if (st && r && +r.cfmPollMs) st.poll = +r.cfmPollMs; });
    const tests = [...c.app.host.querySelectorAll('.sample-test')];
    tests.forEach((t, i) => {
      const inp = t.querySelector('.input pre'), out = t.querySelector('.output pre');
      if (!inp) return;
      const input = preText(inp);
      st.cases.push({ name: `Sample ${i + 1}`, input, orig: input, expected: out ? preText(out) : '', sample: true, res: null });
    });
    if (!st.cases.length) st.cases.push({ name: 'Custom 1', input: '', orig: '', expected: '', sample: false, res: null });
    st.listen = (e) => { try { onRun(JSON.parse(e.detail)); } catch (x) { /* not ours */ } };
    document.addEventListener('cfm:run-state', st.listen);
    render();
  }
  function unmount() { if (st) { document.removeEventListener('cfm:run-state', st.listen); clearTimeout(st.first); } st = null; c = null; }

  const body = () => c && c.$('rbody');
  function render() {
    const b = body(); if (!b || !st) return;
    const esc = c.esc, cur = st.cases[st.cur];
    const chips = st.cases.map((k, i) => `<span class="case${i === st.cur ? ' on' : ''}" data-act="case:${i}" tabindex="0" role="button"><i class="d ${dot(k.res)}"></i>${esc(k.name)}</span>`).join('')
      + (st.cases.length < MAX_CASES ? '<span class="case add" data-act="case-add" tabindex="0" role="button" title="Add your own case">+</span>' : '');
    let main = '';
    if (st.tab === 'case') {
      const edited = cur.sample && cur.input !== cur.orig;
      main = `<div class="lbl2" style="margin-top:0">Input${cur.sample ? (edited ? ' (edited: now your own case, nothing is compared)' : '') : ''}</div>
        <textarea class="cta" id="cta" spellcheck="false" aria-label="Input of ${esc(cur.name)}">${esc(cur.input)}</textarea>
        ${cur.sample && cur.expected ? `<div class="lbl2">Sample output</div><div class="field">${esc(cur.expected.replace(/\n$/, ''))}</div>` : ''}
        ${!cur.sample ? '<div style="margin-top:8px"><a class="link" data-act="case-del" tabindex="0" role="button" style="font-weight:400">Remove this case</a></div>' : ''}`;
    } else main = resultHTML(cur);
    b.innerHTML = `<div class="cases" style="margin-top:0">${chips}</div>${main}`;
    const ta = c.app.sh.getElementById('cta');
    const grow = () => { if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.max(96, ta.scrollHeight + 2) + 'px'; };   // grows with its text, as LeetCode's: no inner scrollbar
    grow();
    if (ta) ta.addEventListener('input', () => { grow(); cur.input = ta.value; cur.res = null; const lab = b.querySelector('.lbl2'); if (lab && cur.sample) lab.textContent = 'Input' + (cur.input !== cur.orig ? ' (edited: now your own case, nothing is compared)' : ''); const d = b.querySelector('.case.on .d'); if (d) d.className = 'd n'; });
  }
  function resultHTML(k) {
    const esc = c.esc, r = k.res;
    if (!r) return `<div class="hint" style="margin-top:12px">Press Run (or Ctrl+') to run ${st.cases.length > 1 ? 'every case' : 'this case'}.</div>`;
    if (r.state === 'running') return `<div class="progress" style="margin-top:12px"><span class="spin"></span><span style="color:var(--t2)">Running ${esc(k.name)}…</span></div>`;
    if (r.state === 'blocked') return `<div><span class="verdict bad">${esc(r.title)}</span></div><div class="hint">${esc(r.msg)}</div>`;
    const stat = parseStat(r.stat), sub = stat ? `<span class="subtle">Runtime: ${stat.ms} ms${stat.kb ? ` · ${stat.kb} KB` : ''}</span>` : '';
    const out = String(r.output == null ? '' : r.output).replace(/\r\n?/g, '\n');
    const inp = `<div class="lbl2" style="margin-top:12px">Input</div><div class="field">${esc(k.input.replace(/\n$/, ''))}</div>`;
    const vword = (v) => String(v || 'Error').replace(/_/g, ' ').toLowerCase().replace(/^./, (x) => x.toUpperCase());   // COMPILATION_ERROR -> Compilation error
    if (r.kind === 'fail') return `<div><span class="verdict bad">${esc(vword(r.verdict))}</span>${/COMPIL/i.test(r.verdict || '') ? '' : sub}</div>${inp}<div class="lbl2">Message</div><div class="field bad">${esc(out.replace(/\n$/, '')) || '&nbsp;'}</div>`;
    const outBox = (cls) => `<div class="lbl2">Output</div><div class="field${cls}">${esc(out.replace(/\n$/, '')) || '&nbsp;'}</div>`;
    if (r.kind === 'match') return `<div><span class="verdict ok">Accepted</span>${sub}</div>${inp}${outBox('')}<div class="lbl2">Sample output</div><div class="field">${esc(k.expected.replace(/\n$/, ''))}</div>`;
    if (r.kind === 'differs') return `<div><span class="verdict bad">Wrong Answer</span>${sub}</div><div class="hint">Your output differs from the sample's. Some problems accept more than one answer; Submit to be sure.</div>${inp}${outBox(' warn')}<div class="lbl2">Sample output</div><div class="field">${esc(k.expected.replace(/\n$/, ''))}</div>`;
    return `<div><span class="verdict run">Output</span>${sub}</div><div class="hint">Your own input has no expected answer, so nothing is compared.</div>${inp}${outBox('')}`;
  }

  /* ---- running ---------------------------------------------------------------------------------------------------- */
  function setBusy(on) { st.busy = on; const b = c.$('btn-run'); if (b) b.classList.toggle('busy', on); }
  function runOne(code, k) {
    return new Promise((resolve) => {
      const id = 'm' + (++st.seq);
      st.pending = { id, resolve };
      st.first = setTimeout(() => { if (st && st.pending && st.pending.id === id) { st.pending = null; resolve({ state: 'error', fatal: true, error: 'Codeforces did not answer. Is this page signed in? Reload it and try again.' }); } }, 15000);
      document.dispatchEvent(new CustomEvent('cfm:run', { detail: JSON.stringify({ id, programTypeId: c.app.lang, sourceCode: code, input: k.input, pollMs: st.poll || undefined }) }));
    });
  }
  function onRun(m) {
    if (!st || !st.pending || m.id !== st.pending.id) return;
    clearTimeout(st.first);
    if (m.state === 'sent' || m.state === 'waiting') { st.first = setTimeout(() => {}, 0); return; }
    const p = st.pending; st.pending = null; p.resolve(m);
  }
  const normSame = (a, b) => (globalThis.cfmCompare ? globalThis.cfmCompare.sameOutput(a, b) : String(a).trim() === String(b).trim());
  async function runAll() {
    if (!st || st.busy) return;
    const k0 = st.cases;
    if (!c.app.lang) { st.tab = 'result'; c.rpOpen('result', true); k0[st.cur].res = { state: 'blocked', title: 'Choose a language first', msg: 'Pick a language above the editor. Nothing was run.' }; return render(); }
    setBusy(true); st.tab = 'result'; c.rpOpen('result', true);
    k0.forEach((k) => { k.res = null; });
    const code = await new Promise((r) => c.getCode(r));
    if (!st) return;
    if (!String(code).trim()) { setBusy(false); k0[st.cur].res = { state: 'blocked', title: 'No code yet', msg: 'Write a solution first. Nothing was run.' }; return render(); }
    for (let i = 0; i < k0.length; i++) {
      if (!st) return;
      st.cur = i; k0[i].res = { state: 'running' }; render();
      const r = await runOne(code, k0[i]);
      if (!st) return;
      if (r.state === 'error') { k0[i].res = { state: 'blocked', title: 'Could not run', msg: nice(r.error) }; render(); break; }
      const ok = r.verdict === 'OK';
      const edited = k0[i].sample && k0[i].input !== k0[i].orig;
      k0[i].res = ok
        ? { state: 'done', kind: k0[i].sample && !edited ? (normSame(r.output, k0[i].expected) ? 'match' : 'differs') : 'out', output: r.output, stat: r.stat }
        : { state: 'done', kind: 'fail', verdict: r.verdict, output: r.output, stat: r.stat };
      render();
    }
    if (st) { setBusy(false); /* land on the first case that did not match, else the first */ const bad = k0.findIndex((k) => k.res && (k.res.kind === 'differs' || k.res.kind === 'fail')); if (bad >= 0) st.cur = bad; render(); }
  }

  CFM.debug = CFM.debug || {};
  CFM.debug.run = () => (st ? { busy: st.busy, tab: st.tab, current: st.cur, cases: st.cases.map((k) => ({ name: k.name, sample: k.sample, edited: k.sample && k.input !== k.orig, result: k.res && { state: k.res.state, kind: k.res.kind, verdict: k.res.verdict, title: k.res.title, msg: k.res.msg && String(k.res.msg).slice(0, 160), stat: k.res.stat } })) } : null);

  CFM.use({
    mount, unmount,
    act(a, el) {
      if (!st) return;
      if (a === 'run') return runAll();
      if (a.startsWith('case:')) { st.cur = +a.slice(5); return render(); }
      if (a === 'case-add') { const n = st.cases.filter((k) => !k.sample).length + 1; st.cases.push({ name: `Custom ${n}`, input: '', orig: '', expected: '', sample: false, res: null }); st.cur = st.cases.length - 1; st.tab = 'case'; c.rpOpen('case', true); return render(); }
      if (a === 'case-del') { st.cases.splice(st.cur, 1); if (!st.cases.length) st.cases.push({ name: 'Custom 1', input: '', orig: '', expected: '', sample: false, res: null }); st.cur = Math.max(0, st.cur - 1); return render(); }
    },
    shortcut(k) { if (k === 'run') runAll(); },
    rp(which) { if (st) { st.tab = which === 'result' ? 'result' : 'case'; render(); } },
  });
})();
