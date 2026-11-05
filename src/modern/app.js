/* =============================================================================
   app.js  (isolated world, problem pages only)   MODERN.md, phase M2a
   Modern mode's problem page: a shadow-DOM shell (top bar, panes, tabs, editor,
   test panel) around the REAL statement nodes, which are moved (journaled) into
   the light DOM of #cfm-app so MathJax's document styles keep applying.
   - On: storage cfUI === 'modern' (dev flag until M5). content.js sets
     html[data-cf-ui="modern"] and drops the Classic theme; themes/modern.css
     hides #body from the first paint. Off / "Classic view": the journal puts
     every moved node back and #cfm-app is removed: zero cfm-* nodes remain.
   - Never fetches a page. No MutationObserver on the page. Idle cost: none.
   - The editor is Monaco in an extension-page iframe (src/modern/editor.html).
   M2a: reading + editing. Run, Submit, Result and the other tabs come in M2b/M2c.
============================================================================= */
(() => {
  'use strict';
  const PATH = /^\/(?:problemset\/problem\/(\d+)\/(\w+)|(?:contest|gym)\/(\d+)\/problem\/(\w+))/.exec(location.pathname);
  if (!PATH) return;
  const CID = PATH[1] || PATH[3], IDX = PATH[2] || PATH[4], PID = CID + IDX;
  const UI_KEY = 'cfUI', LAYOUT_KEY = 'cfmLayout', CODE_KEY = 'cfmCode', LAST = 200;
  const EXT = new URL(chrome.runtime.getURL('')).origin;
  const root = document.documentElement;
  let app = null, wanted = false;
  /* run.js and submit.js plug in here: CFM.use({ mount(ctx), unmount(), act(name, el, ev), shortcut(key), pane(tab, el), rp(which, open) }) */
  const CFM = (globalThis.CFM = globalThis.CFM || {});
  CFM.mods = CFM.mods || [];
  CFM.use = (m) => { CFM.mods.push(m); };
  const fire = (n, ...a) => { for (const m of CFM.mods) { try { if (m[n]) m[n](...a); } catch (e) { try { console.error('[cfm]', n, e); } catch (x) { /* none */ } } } };

  /* ---- icons: Lucide (ISC, licenses/lucide-ISC.txt), 24 px, stroke 2 ---------------------------------------------- */
  const IC = {
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
    list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
    sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    upload: '<path d="M12 13v8"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m8 17 4-4 4 4"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    hist: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    code: '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    max: '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h11"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    sqcheck: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
    term: '<path d="m7 11 2-2-2-2"/><path d="M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    cok: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    cbad: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    calert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  };
  const ic = (n, st = '') => `<svg class="i" viewBox="0 0 24 24"${st ? ` style="${st}"` : ''}>${IC[n]}</svg>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---- languages: the page's own list is the truth (never hard-coded ids) ------------------------------------------ */
  const modeOf = (name) => {
    const n = String(name).toLowerCase();
    if (/c#|\.net|mono/.test(n)) return 'csharp';
    if (/g\+\+|\bgcc\b|clang|\bc\+\+|visual c|msvc/.test(n)) return 'cpp';
    if (/py(thon|py)/.test(n)) return 'python';
    if (/kotlin/.test(n)) return 'kotlin';
    if (/^java\b|\bjava\b/.test(n)) return 'java';
    if (/rust/.test(n)) return 'rust';
    if (/^go\b/.test(n)) return 'go';
    if (/javascript|node\.js|v8/.test(n)) return 'cfm-javascript';   // colouring only: editor.js registers it without the TypeScript service
    return 'plaintext';
  };
  /* starter code: compiles as it is, fast input and output, a solve() and, when the statement's input section speaks of test
     cases ("the number of test cases"), the loop over them; otherwise solve() runs once. No comment to delete (user, Oct 30
     2026: "people don't have to remove or add anything"). The old Go starter did not compile (fmt.Fscan's two results in a
     single-value context) and C got the C++ starter. */
  const TPL = {
    cpp: (m) => `#include <bits/stdc++.h>\nusing namespace std;\n\nvoid solve() {\n    \n}\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n${m ? '    int t;\n    cin >> t;\n    while (t--) {\n        solve();\n    }\n' : '    solve();\n'}    return 0;\n}\n`,
    c: (m) => `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nvoid solve(void) {\n    \n}\n\nint main(void) {\n${m ? '    int t;\n    scanf("%d", &t);\n    while (t--) {\n        solve();\n    }\n' : '    solve();\n'}    return 0;\n}\n`,
    python: (m) => `import sys\ninput = lambda: sys.stdin.readline().rstrip("\\r\\n")\n\n\ndef solve():\n    \n\n\n${m ? 'for _ in range(int(input())):\n    solve()\n' : 'solve()\n'}`,
    java: (m) => `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    static BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n    static PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));\n    static StringTokenizer st;\n\n    static String next() throws IOException {\n        while (st == null || !st.hasMoreTokens()) st = new StringTokenizer(br.readLine());\n        return st.nextToken();\n    }\n    static int nextInt() throws IOException { return Integer.parseInt(next()); }\n    static long nextLong() throws IOException { return Long.parseLong(next()); }\n\n    static void solve() throws IOException {\n        \n    }\n\n    public static void main(String[] args) throws IOException {\n${m ? '        int t = nextInt();\n        while (t-- > 0) solve();\n' : '        solve();\n'}        out.flush();\n    }\n}\n`,
    kotlin: (m) => `import java.io.*\nimport java.util.*\n\nprivate val br = BufferedReader(InputStreamReader(System.\`in\`))\nprivate val out = PrintWriter(BufferedWriter(OutputStreamWriter(System.out)))\nprivate var st = StringTokenizer("")\n\nprivate fun next(): String {\n    while (!st.hasMoreTokens()) st = StringTokenizer(br.readLine())\n    return st.nextToken()\n}\nprivate fun nextInt() = next().toInt()\nprivate fun nextLong() = next().toLong()\n\nprivate fun solve() {\n    \n}\n\nfun main() {\n${m ? '    repeat(nextInt()) { solve() }\n' : '    solve()\n'}    out.flush()\n}\n`,
    go: (m) => `package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nvar in = bufio.NewReader(os.Stdin)\nvar out = bufio.NewWriter(os.Stdout)\n\nfunc readInt() int {\n\tvar x int\n\tfmt.Fscan(in, &x)\n\treturn x\n}\n\nfunc solve() {\n\t\n}\n\nfunc main() {\n\tdefer out.Flush()\n${m ? '\tfor t := readInt(); t > 0; t-- {\n\t\tsolve()\n\t}\n' : '\tsolve()\n'}}\n`,
    rust: (m) => `use std::io::{self, BufWriter, Read, Write};\n\nfn solve<'a>(it: &mut impl Iterator<Item = &'a str>, out: &mut impl Write) {\n    \n}\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n    let mut it = input.split_ascii_whitespace();\n    let mut out = BufWriter::new(io::stdout().lock());\n${m ? '    let t: usize = it.next().unwrap().parse().unwrap();\n    for _ in 0..t {\n        solve(&mut it, &mut out);\n    }\n' : '    solve(&mut it, &mut out);\n'}    out.flush().unwrap();\n}\n`,
    csharp: (m) => `using System;\nusing System.IO;\nusing System.Linq;\n\nclass Program {\n    static StreamReader reader = new StreamReader(Console.OpenStandardInput());\n    static StreamWriter writer = new StreamWriter(Console.OpenStandardOutput());\n\n    static void Solve() {\n        \n    }\n\n    static void Main() {\n${m ? '        int t = int.Parse(reader.ReadLine());\n        while (t-- > 0) Solve();\n' : '        Solve();\n'}        writer.Flush();\n    }\n}\n`,
    'cfm-javascript': (m) => `const data = require('fs').readFileSync(0, 'utf8').split('\\n');\nlet line = 0;\nconst next = () => data[line++].trim();\nconst out = [];\n\nfunction solve() {\n    \n}\n\n${m ? 'let t = Number(next());\nwhile (t--) solve();\n' : 'solve();\n'}console.log(out.join('\\n'));\n`,
    plaintext: () => '',
  };
  const tplKey = (name) => (/\bgcc c\d|\bgnu c\d/i.test(name) ? 'c' : modeOf(name));
  CFM.modeOf = modeOf;
  CFM.starter = (name, multi) => (TPL[tplKey(name)] || TPL.plaintext)(multi);   // Pixel's duel writes in the same editor

  /* ---- what the page shows (read, never fetched) ------------------------------------------------------------------- */
  const q = (s, r = document) => r.querySelector(s);
  function readPage() {
    const st = q('.problem-statement');
    const text = (el) => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    const lim = (sel, unit) => {
      const el = q(sel, st); if (!el) return '';
      const t = text(el).replace(/(time|memory) limit per test/i, '').trim();
      const m = t.match(/([\d.]+)\s*(second|millisecond|megabyte|kilobyte|gigabyte)s?/i); if (!m) return t;
      const u = { second: 's', millisecond: 'ms', megabyte: 'MB', kilobyte: 'KB', gigabyte: 'GB' }[m[2].toLowerCase()];
      return `${m[1]} ${u}`;
    };
    const tags = [...document.querySelectorAll('#sidebar .tag-box, .tag-box')];
    const seen = new Set(), topics = [];
    let rating = '';
    for (const t of tags) {
      const s = text(t);
      if (t.getAttribute('title') === 'Difficulty' || /^\*\d+$/.test(s)) { rating = rating || s.replace('*', ''); continue; }
      if (s && !seen.has(s)) { seen.add(s); topics.push(s); }
    }
    const contestA = q('#sidebar a[href^="/contest/"]') || q('.rtable a[href^="/contest/"]');
    const me = q('#header a[href^="/profile/"], .lang-chooser a[href^="/profile/"]');
    const sel = q('form.submitFrameForm select[name=programTypeId]') || q('select[name=programTypeId]');
    const langs = sel ? [...sel.options].map((o) => ({ id: o.value, name: o.textContent.trim() })) : [];
    const rankCls = me && (me.className.match(/user-(\w+)/) || [])[1];
    return {
      multi: /number of test cases|test cases\b|количество наборов входных данных|количество тестов/i.test(text(q('.input-specification', st))),
      title: text(q('.header .title', st)).replace(/^[A-Z0-9]+\.\s*/, ''), time: lim('.time-limit'), mem: lim('.memory-limit'), rating, topics,
      contest: contestA ? { name: text(contestA), href: contestA.getAttribute('href') } : null,
      handle: me ? decodeURIComponent((me.getAttribute('href') || '').split('/profile/')[1] || '').split(/[?#/]/)[0] : '',
      rank: ['gray', 'green', 'cyan', 'blue', 'violet', 'orange', 'red'].includes(rankCls) ? rankCls : (rankCls ? 'red' : 'gray'),
      langs, defaultLang: sel ? sel.value : (langs[0] && langs[0].id) || '',
    };
  }
  const rankOf = (r) => (r < 1200 ? 'gray' : r < 1400 ? 'green' : r < 1600 ? 'cyan' : r < 1900 ? 'blue' : r < 2100 ? 'violet' : r < 2400 ? 'orange' : 'red');

  /* ---- the shell ------------------------------------------------------------------------------------------------------ */
  const TABS = [['desc', 'Description', 'file', 'tic-d'], ['edit', 'Editorial', 'book', 'tic-e'], ['disc', 'Discussion', 'msg', 'tic-s'], ['subs', 'Submissions', 'hist', 'tic-r']];
  function shellHTML(d) {
    const tabs = TABS.map(([k, n, i, c], j) => `<a class="tab${j === 0 ? ' on' : ''}" data-tab="${k}" tabindex="0" role="tab"><svg class="i ${c}" viewBox="0 0 24 24">${IC[i]}</svg><span>${n}</span></a>`).join('');
    const B = !d.rating ? '' : +d.rating <= 1300 ? 'Easy' : +d.rating <= 1800 ? 'Medium' : 'Hard';
    const dif = B ? `<span class="chip dif d-${B}" title="Rated ${esc(d.rating)}: ${B === 'Easy' ? '800–1300' : B === 'Medium' ? '1400–1800' : '1900 and up'}">${B}</span>` : '<span class="chip dif" title="Codeforces rates a problem some days after its round">Not rated</span>';
    const rating = d.rating ? `<span class="chip rt tn" style="color:var(--rank-${rankOf(+d.rating)})" title="Rated ${esc(d.rating)}">*${esc(d.rating)}</span>` : '';
    const lim = d.time || d.mem ? `<span class="chip">${ic('clock')}<span class="tn">${esc(d.time)}</span> · <span class="tn">${esc(d.mem)}</span></span>` : '';
    const topics = d.topics.length ? `<span class="chip btn" data-act="topics" tabindex="0" role="button" aria-pressed="false">${ic('tag')}Topics</span>` : '';
    const opts = d.langs.map((l) => `<option value="${esc(l.id)}"${l.id === d.defaultLang ? ' selected' : ''}>${esc(l.name)}</option>`).join('');
    const who = d.handle
      ? `<a class="av" href="/profile/${encodeURIComponent(d.handle)}"><span class="dot">${esc(d.handle[0].toUpperCase())}</span><span style="color:var(--rank-${d.rank})">${esc(d.handle)}</span></a>`
      : `<a class="txt" href="/enter">Log in</a>`;
    return `
<div class="top" data-m="top"><a class="logo cflogo" href="/problemset" title="Codeforces">${globalThis.CFM_KIT ? globalThis.CFM_KIT.LOGO : ''}</a>
  <div class="plist"><a class="lbl" href="/problemset">${ic('list')}<span>Problem List</span></a><a class="ibtn off" id="nav-prev" title="Previous problem">${ic('left')}</a><a class="ibtn off" id="nav-next" title="Next problem">${ic('right')}</a><a class="ibtn off" id="nav-rand" title="Random unsolved problem near this rating">${ic('shuffle')}</a></div>
  <div class="mid" data-m="mid"><div class="seg"><button class="run" id="btn-run" data-act="run" title="Run on the samples and your own cases (Ctrl+')">${ic('play')}</button><button class="sub" id="btn-sub" data-act="submit" title="Submit to Codeforces (Ctrl+Enter)">${ic('upload')}<span>Submit</span></button></div></div>
  <div class="right kright">${globalThis.CFM_KIT ? globalThis.CFM_KIT.right(d) : who}</div></div>
<div class="stage" data-m="stage">
  <div class="col" id="left" data-m="left"><div class="panel" data-m="lp" style="flex:1 1 0"><div class="tabs" data-m="tabs" role="tablist">${tabs}<a class="tab res" data-tab="result" id="tab-result" tabindex="0" role="tab" hidden>${ic('sqcheck')}<span>Result</span></a></div>
    <div class="body prose" data-m="body" id="lbody">
      <div id="pane-desc"><div class="ptrow"><h1 class="pt" data-m="title">${esc(CID + IDX)}. ${esc(d.title)}</h1><span class="stm" id="stm"></span></div><div class="chips" data-m="chips">${dif}${rating}${lim}${topics}</div><div class="tpics" hidden>${d.topics.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div><slot name="statement"></slot></div>
      <div id="pane-other" hidden></div></div>
    <div class="foot" data-m="foot"><span class="meta" style="padding-left:8px">${d.contest ? `<a class="link" href="${esc(d.contest.href)}" style="font-weight:400">${esc(d.contest.name)}</a>` : ''}</span><span class="sp"></span>
      <a class="fb" data-act="help" title="Keyboard shortcuts" tabindex="0" role="button">${ic('help')}</a></div>
    <div class="pop" id="pop" hidden><b>Shortcuts</b><div><kbd>Ctrl</kbd> + <kbd>'</kbd> Run</div><div><kbd>Ctrl</kbd> + <kbd>Enter</kbd> Submit</div><div style="color:var(--t2);margin-top:4px">On a Mac use <kbd>Cmd</kbd>.</div></div></div></div>
  <div class="vsplit" id="vs" data-m="vsplit" role="separator" aria-orientation="vertical" title="Drag to resize, double-click to reset"></div>
  <div class="col" id="right" data-m="right"><div class="panel" data-m="code" style="flex:1 1 0"><div class="tabs"><a class="tab on" tabindex="0"><svg class="i" viewBox="0 0 24 24" style="color:var(--green)">${IC.code}</svg><span>Code</span></a></div>
      <div class="sbar" data-m="sbar">${d.langs.length ? `<span class="lwrap"><button type="button" class="lbtn" id="lbtn" data-act="langs" aria-haspopup="listbox" aria-expanded="false"><span id="lname"></span>${ic('down')}</button><select class="lsel" id="lang" aria-label="Language" tabindex="-1" aria-hidden="true">${opts}</select><div class="lpop" id="lpop" role="listbox" aria-label="Language" hidden>${langPopHTML(d)}</div></span>` : '<span class="auto" style="margin-left:4px;color:var(--t2)">Sign in to choose a language</span>'}<span class="auto" id="autosave">Auto</span>
        <span class="tools"><a class="ib" data-act="copycode" title="Copy code" tabindex="0" role="button">${ic('copy')}</a><a class="ib" data-act="reset" title="Reset to the template" tabindex="0" role="button">${ic('reset')}</a><a class="ib" data-act="full" title="Full screen" tabindex="0" role="button">${ic('max')}</a></span></div>
      <div class="edwrap" data-m="editor" id="edwrap"><div class="msg" id="edmsg">Loading the editor…</div><div class="saved"><span id="saved"></span><span id="pos"></span></div></div></div>
    <div class="hsplit" id="hs" data-m="hsplit" role="separator" aria-orientation="horizontal" title="Drag to resize, double-click to reset"></div>
    <div class="panel rp" id="rp" data-m="rp"><div class="tabs"><a class="tab on" data-rp="case" tabindex="0">${ic('sqcheck')}<span>Testcase</span></a><a class="tab" data-rp="result" tabindex="0"><svg class="i" viewBox="0 0 24 24" style="color:var(--green)">${IC.term}</svg><span>Test Result</span></a></div>
      <div class="rbody" id="rbody" hidden></div></div></div>
</div>`;
  }

  /* ---- mount / unmount ------------------------------------------------------------------------------------------------ */
  /* Problem List arrows (M3): neighbours in the problem list's order (newest round first) and a random unsolved problem
     within 200 of this one's rating, all from the caches the Problems page keeps (cfmProblems, cfmStatus). No request. */
  function listNav(a) {
    chrome.storage.local.get(['cfmProblems', 'cfmStatus'], (s) => {
      const rows = s && s.cfmProblems && s.cfmProblems.rows;
      if (app !== a) return;
      if (!rows) {   // first visit: the list arrives later (the strip or Solved-by fetch it); try once more when it lands
        const w = (c, area) => { if (area === 'local' && c.cfmProblems && c.cfmProblems.newValue) { chrome.storage.onChanged.removeListener(w); listNav(a); } };
        chrome.storage.onChanged.addListener(w); a.offs.push(() => chrome.storage.onChanged.removeListener(w));
        return;
      }
      const i = rows.findIndex((r) => String(r[0]) === CID && r[1] === IDX);
      const href = (r) => `/problemset/problem/${r[0]}/${encodeURIComponent(r[1])}`;
      const set = (id, r, title) => { const el = a.sh.getElementById(id); if (el && r) { el.href = href(r); el.classList.remove('off'); if (title) el.title = title; } };
      if (i >= 0) { set('nav-prev', rows[i - 1], 'Previous in the list: ' + rows[i - 1]?.[0] + rows[i - 1]?.[1]); set('nav-next', rows[i + 1], 'Next in the list: ' + rows[i + 1]?.[0] + rows[i + 1]?.[1]); }   // the list's order: newest first, as on the Problems page
      const ok = new Set(((s.cfmStatus && s.cfmStatus.rows) || []).filter((r) => r[4] === 'OK').map((r) => r[2] + r[3]));
      const me = i >= 0 ? rows[i][3] : 0, near = rows.filter((r) => r[3] && (!me || Math.abs(r[3] - me) <= 200) && !ok.has(r[0] + r[1]) && !(String(r[0]) === CID && r[1] === IDX));
      const el = a.sh.getElementById('nav-rand');
      if (el && near.length) { el.classList.remove('off'); el.href = '#'; el.addEventListener('click', (e) => { e.preventDefault(); location.href = href(near[Math.floor(Math.random() * near.length)]); }); }
    });
  }
  function mount(store) {
    if (app || !wanted) return;
    const st = q('.problem-statement');
    if (!st) return fail('no statement on this page');
    const d = readPage();
    const host = document.createElement('div');
    host.id = 'cfm-app'; host.setAttribute('data-cfm', '');
    const sh = host.attachShadow({ mode: 'open' });
    Object.assign(d, globalThis.CFM_KIT ? (({ photo, logout }) => ({ photo, logout }))(globalThis.CFM_KIT.me()) : {});
    const style = document.createElement('style'); style.textContent = (globalThis.CFM_CSS || '') + (globalThis.CFM_KIT_CSS || '') + ACSS; sh.appendChild(style);
    const wrap = document.createElement('div'); wrap.style.display = 'contents'; wrap.innerHTML = shellHTML(d); sh.appendChild(wrap);
    const stmt = document.createElement('div'); stmt.className = 'cfm-stmt'; stmt.id = 'cfm-stmt'; stmt.setAttribute('slot', 'statement');
    app = { host, sh, d, journal: [], timers: [], offs: [], codes: (store && store[CODE_KEY]) || {}, layout: (store && store[LAYOUT_KEY]) || {}, ed: { ready: false, plain: !!(store && store.cfmDev) && /cfm-plain/.test(location.hash) }, lang: pickLang(d, store), dirty: false };
    app.journal.push({ node: st, parent: st.parentNode, next: st.nextSibling });   // undone in reverse on unmount
    stmt.appendChild(st); host.appendChild(stmt);
    root.appendChild(host);
    root.setAttribute('data-cf-ui', 'modern');
    wire(); applyLayout(); initEditor(); credits(st);
    if (globalThis.CFM_KIT) { app.offs.push(globalThis.CFM_KIT.wire(sh, d)); globalThis.CFM_KIT.photos(sh); }
    fire('mount', CFM.ctx);
    listNav(app);
    /* the app lives outside <body>, and Codeforces' MathJax typesets only <body> at startup: when MathJax starts after we moved
       the statement (a slow page; seen live on 2277F and 1951D as raw $$$n$$$), nothing typesets it. Ask for it (bridge.js waits). */
    document.dispatchEvent(new CustomEvent('cfm:typeset', { detail: 'cfm-stmt' }));
    document.dispatchEvent(new CustomEvent('cfts:theme'));   // relayout.js: MathJax re-measures in the new column width
    window.__cfmMounted = true;
  }
  /* a credit line at the top of the statement (a song or its author, right-aligned and linked: "Frums - Credits" on 2277C)
     becomes a chip under the title; the original line is hidden while the app is up and shown again on unmount */
  function credits(st) {
    const legend = st.querySelector('.legend') || st;
    /* Codeforces' own form: an epigraph whose text is a linked song (.epigraph-text > a), its source often a joke glyph */
    const ep = st.querySelector('.epigraph');
    const blocks = ep ? [ep] : [...legend.children].slice(0, 2);
    for (const b of blocks) {
      if (b === ep) {
        const tx = b.querySelector('.epigraph-text'), link = tx && tx.querySelector('a[href]'), t = tx ? tx.textContent.trim() : '';
        if (!link || !t || t.length > 90) return;   // a real quote stays a quote (themes/modern.css)
        const src = (b.querySelector('.epigraph-source') || {}).textContent || '';
        addCredit(b, link.href, t, src.trim().length > 2 ? src.trim() : '');
        return;
      }
      const t = (b.textContent || '').trim(), link = b.querySelector('a[href]');
      if (!link || !t || t.length > 90 || b.querySelector('img, .MathJax, script, table')) continue;
      const al = ((b.getAttribute('style') || '') + ' ' + (b.getAttribute('align') || '')).toLowerCase();
      const center = b.tagName === 'CENTER' || /text-align\s*:\s*(right|center)|^\s*(right|center)/.test(al) || /^(right|center)$/.test(getComputedStyle(b).textAlign);
      if (!center) continue;
      addCredit(b, link.href, t, '');
      return;
    }
  }
  function addCredit(b, url, t, by) {
      const music = /youtu\.?be|spotify|soundcloud|music|bandcamp|nicovideo/i.test(url);
      const chip = document.createElement('a');
      chip.className = 'chip credit'; chip.href = url; chip.target = '_blank'; chip.rel = 'noopener noreferrer'; chip.title = (music ? 'Listen: ' : 'Open: ') + url;
      chip.innerHTML = `<svg class="i" viewBox="0 0 24 24">${music ? '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' : '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'}</svg><span></span>`;
      chip.querySelector('span').textContent = t.replace(/\s+/g, ' ').replace(/\s+-\s+/, ' – ') + (by ? ` · ${by}` : '');
      const chips = app.sh.querySelector('.chips'); if (chips) chips.appendChild(chip);
      b.classList.add('cfm-credit-src'); app.offs.push(() => b.classList.remove('cfm-credit-src'));
  }
  /* the language picker: the languages most people use first, one tile each with a badge (the newest version Codeforces
     lists), then every other one under "More languages". Badges are drawn here (a coloured tile and the usual short name), not
     the languages' own logo files */
  /* language marks: Simple Icons 13.21.0 (CC0 1.0, licenses/simple-icons-CC0.txt), one path each, drawn in the language's
     colour on a soft tile of the same colour (minimal glyphs, as the user asked: "like ri-java-fill") */
  const LOGO = {"cplusplus":"M22.394 6c-.167-.29-.398-.543-.652-.69L12.926.22c-.509-.294-1.34-.294-1.848 0L2.26 5.31c-.508.293-.923 1.013-.923 1.6v10.18c0 .294.104.62.271.91.167.29.398.543.652.69l8.816 5.09c.508.293 1.34.293 1.848 0l8.816-5.09c.254-.147.485-.4.652-.69.167-.29.27-.616.27-.91V6.91c.003-.294-.1-.62-.268-.91zM12 19.11c-3.92 0-7.109-3.19-7.109-7.11 0-3.92 3.19-7.11 7.11-7.11a7.133 7.133 0 016.156 3.553l-3.076 1.78a3.567 3.567 0 00-3.08-1.78A3.56 3.56 0 008.444 12 3.56 3.56 0 0012 15.555a3.57 3.57 0 003.08-1.778l3.078 1.78A7.135 7.135 0 0112 19.11zm7.11-6.715h-.79v.79h-.79v-.79h-.79v-.79h.79v-.79h.79v.79h.79zm2.962 0h-.79v.79h-.79v-.79h-.79v-.79h.79v-.79h.79v.79h.79z","c":"M16.5921 9.1962s-.354-3.298-3.627-3.39c-3.2741-.09-4.9552 2.474-4.9552 6.14 0 3.6651 1.858 6.5972 5.0451 6.5972 3.184 0 3.5381-3.665 3.5381-3.665l6.1041.365s.36 3.31-2.196 5.836c-2.552 2.5241-5.6901 2.9371-7.8762 2.9201-2.19-.017-5.2261.034-8.1602-2.97-2.938-3.0101-3.436-5.9302-3.436-8.8002 0-2.8701.556-6.6702 4.047-9.5502C7.444.72 9.849 0 12.254 0c10.0422 0 10.7172 9.2602 10.7172 9.2602z","python":"M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09zm13.09 3.95l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z","pypy":"M12.947 0c-.099 0-.2.005-.3.016a2.706 2.706 0 0 0-1.27.447c-.164.009-.324.038-.488.053-1.78.279-3.037 1.197-3.92 2.286-1.702 2.515-1.711 6.092-1.481 8.471a6.55 6.55 0 0 1 1.86-3.765c.069-.069.15-.136.22-.217l.034-.034c.09-.078.18-.154.272-.228a8.87 8.87 0 0 1 .416-.309c.028-.014.056-.027.084-.055l.436-.273.03-.016.068-.035a4.99 4.99 0 0 1 .478-.225c.029-.014.07-.029.098-.043.127-.056.268-.098.395-.14-.002-.003-.006-.004-.008-.006l.022-.008a2.162 2.162 0 0 0-.268-.238 1.827 1.827 0 0 0-.731-.268 3.248 3.248 0 0 0-.829-.041 4.37 4.37 0 0 0-.799.115c.248-.102.497-.19.77-.242.279-.07.573-.111.88-.112.265 0 .55.036.82.135l.002.004c.028.014.042.015.07.03.07.028.155.069.225.11.01.006.017.013.026.018l.002.012c.14.084.268.196.394.323l.014.013c.004 0 .006 0 .01-.002a2.821 2.821 0 0 0 2.407.944l.254-.04h.041l.557-.114c1.867-.435 2.185-.507 3.135-1.036.4-.321.562-.548.63-.762.07-.217.055-.455.073-.797l-.002.01c-.001-.374-.282-.8-.696-1.22-.41-.417-.932-.824-1.366-1.196-.53-.374-.785-.718-1.031-.973a1.669 1.669 0 0 0-.63-.434A2.778 2.778 0 0 0 12.947 0zm2.362.934c.12.113.231.224.405.346l.008.004.005.006c.425.365.963.78 1.402 1.225.438.446.795.93.797 1.465v.004l-.002.006c-.017.319.008.589-.088.885-.096.297-.311.588-.754.94l-.012.01-.012.008a9.773 9.773 0 0 1-.584.303c1.232.485 2.467 1.071 3.808 2.118v-.002c1.21.937 2.345 2.057 3.49 3.74-.105-5.25-3.649-9.647-8.463-11.058zM8.534.98a11.576 11.576 0 0 0-2.155.897c-.07.038-.14.08-.209.12a11.768 11.768 0 0 0-5.942 10.02c.033 1.843.683 3.221 1.708 4.232 1.061 1.048 2.528 1.703 4.109 2.034 1.585.333 3.247.442 4.743.362a6.236 6.236 0 0 1-1.92-.692 11.15 11.15 0 0 1-.55-.322 12.475 12.475 0 0 1-.45-.338l-.295-.252a1.697 1.697 0 0 1-.225-.225 6.776 6.776 0 0 1-1.237-1.702c-.028-.056-.056-.126-.084-.182a6.412 6.412 0 0 1-.318-.858c-.104-.294-.318-.938-.489-2.003v-.006c-.299-2.347-.525-6.536 1.464-9.467l.004-.006.004-.006A6.873 6.873 0 0 1 8.534.98zm4.776 3.853c.059-.001.12 0 .182.004.492.043.87.282.856.55-.028.252-.434.436-.926.408-.492-.042-.872-.282-.858-.55.012-.233.336-.401.746-.412zm2.699 1.491c-.164.061-.451.142-.657.2 1.835 1.094 3.106 3.045 3.215 5.315l.004.068c.003.077.006.153.007.233v.04c0 .037-.005.072-.006.108.101 2.366-.31 3.562-1.291 5.62v.002c-.99 2.092-3.237 4.63-5.012 6.089 6.255-.14 11.293-5.145 11.494-11.384-1.22-1.9-2.408-3.086-3.696-4.084-1.43-1.117-2.725-1.7-4.058-2.207zm2.104 8.256c-.045.118-.087.238-.138.352-.029.056-.056.126-.084.182a6.537 6.537 0 0 1-1.462 1.927l-.295.252c-.14.112-.295.225-.45.338a5.13 5.13 0 0 1-.549.322c-.183.1-.375.185-.568.268v.002l-.016.006a6.555 6.555 0 0 1-.412.154c-2.013.742-5.2.867-8.166.244-1.63-.341-3.157-1.02-4.282-2.13a5.941 5.941 0 0 1-1.164-1.625C1.703 20.009 6.232 23.859 11.694 24c1.76-1.35 4.256-4.096 5.27-6.241v-.002c.598-1.253.97-2.146 1.15-3.178z","openjdk":"M11.915 0 11.7.215C9.515 2.4 7.47 6.39 6.046 10.483c-1.064 1.024-3.633 2.81-3.711 3.551-.093.87 1.746 2.611 1.55 3.235-.198.625-1.304 1.408-1.014 1.939.1.188.823.011 1.277-.491a13.389 13.389 0 0 0-.017 2.14c.076.906.27 1.668.643 2.232.372.563.956.911 1.667.911.397 0 .727-.114 1.024-.264.298-.149.571-.33.91-.5.68-.34 1.634-.666 3.53-.604 1.903.062 2.872.39 3.559.704.687.314 1.15.664 1.925.664.767 0 1.395-.336 1.807-.9.412-.563.631-1.33.72-2.24.06-.623.055-1.32 0-2.066.454.45 1.117.604 1.213.424.29-.53-.816-1.314-1.013-1.937-.198-.624 1.642-2.366 1.549-3.236-.08-.748-2.707-2.568-3.748-3.586C16.428 6.374 14.308 2.394 12.13.215zm.175 6.038a2.95 2.95 0 0 1 2.943 2.942 2.95 2.95 0 0 1-2.943 2.943A2.95 2.95 0 0 1 9.148 8.98a2.95 2.95 0 0 1 2.942-2.942zM8.685 7.983a3.515 3.515 0 0 0-.145.997c0 1.951 1.6 3.55 3.55 3.55 1.95 0 3.55-1.598 3.55-3.55 0-.329-.046-.648-.132-.951.334.095.64.208.915.336a42.699 42.699 0 0 1 2.042 5.829c.678 2.545 1.01 4.92.846 6.607-.082.844-.29 1.51-.606 1.94-.315.431-.713.651-1.315.651-.593 0-.932-.27-1.673-.61-.741-.338-1.825-.694-3.792-.758-1.974-.064-3.073.293-3.821.669-.375.188-.659.373-.911.5s-.466.2-.752.2c-.53 0-.876-.209-1.16-.64-.285-.43-.474-1.101-.545-1.948-.141-1.693.176-4.069.823-6.614a43.155 43.155 0 0 1 1.934-5.783c.348-.167.749-.31 1.192-.425zm-3.382 4.362a.216.216 0 0 1 .13.031c-.166.56-.323 1.116-.463 1.665a33.849 33.849 0 0 0-.547 2.555 3.9 3.9 0 0 0-.2-.39c-.58-1.012-.914-1.642-1.16-2.08.315-.24 1.679-1.755 2.24-1.781zm13.394.01c.562.027 1.926 1.543 2.24 1.783-.246.438-.58 1.068-1.16 2.08a4.428 4.428 0 0 0-.163.309 32.354 32.354 0 0 0-.562-2.49 40.579 40.579 0 0 0-.482-1.652.216.216 0 0 1 .127-.03z","kotlin":"M24 24H0V0h24L12 12Z","go":"M1.811 10.231c-.047 0-.058-.023-.035-.059l.246-.315c.023-.035.081-.058.128-.058h4.172c.046 0 .058.035.035.07l-.199.303c-.023.036-.082.07-.117.07zM.047 11.306c-.047 0-.059-.023-.035-.058l.245-.316c.023-.035.082-.058.129-.058h5.328c.047 0 .07.035.058.07l-.093.28c-.012.047-.058.07-.105.07zm2.828 1.075c-.047 0-.059-.035-.035-.07l.163-.292c.023-.035.07-.07.117-.07h2.337c.047 0 .07.035.07.082l-.023.28c0 .047-.047.082-.082.082zm12.129-2.36c-.736.187-1.239.327-1.963.514-.176.046-.187.058-.34-.117-.174-.199-.303-.327-.548-.444-.737-.362-1.45-.257-2.115.175-.795.514-1.204 1.274-1.192 2.22.011.935.654 1.706 1.577 1.835.795.105 1.46-.175 1.987-.77.105-.13.198-.27.315-.434H10.47c-.245 0-.304-.152-.222-.35.152-.362.432-.97.596-1.274a.315.315 0 01.292-.187h4.253c-.023.316-.023.631-.07.947a4.983 4.983 0 01-.958 2.29c-.841 1.11-1.94 1.8-3.33 1.986-1.145.152-2.209-.07-3.143-.77-.865-.655-1.356-1.52-1.484-2.595-.152-1.274.222-2.419.993-3.424.83-1.086 1.928-1.776 3.272-2.02 1.098-.2 2.15-.07 3.096.571.62.41 1.063.97 1.356 1.648.07.105.023.164-.117.2m3.868 6.461c-1.064-.024-2.034-.328-2.852-1.029a3.665 3.665 0 01-1.262-2.255c-.21-1.32.152-2.489.947-3.529.853-1.122 1.881-1.706 3.272-1.95 1.192-.21 2.314-.095 3.33.595.923.63 1.496 1.484 1.648 2.605.198 1.578-.257 2.863-1.344 3.962-.771.783-1.718 1.273-2.805 1.495-.315.06-.63.07-.934.106zm2.78-4.72c-.011-.153-.011-.27-.034-.387-.21-1.157-1.274-1.81-2.384-1.554-1.087.245-1.788.935-2.045 2.033-.21.912.234 1.835 1.075 2.21.643.28 1.285.244 1.905-.07.923-.48 1.425-1.228 1.484-2.233z","rust":"M23.8346 11.7033l-1.0073-.6236a13.7268 13.7268 0 00-.0283-.2936l.8656-.8069a.3483.3483 0 00-.1154-.578l-1.1066-.414a8.4958 8.4958 0 00-.087-.2856l.6904-.9587a.3462.3462 0 00-.2257-.5446l-1.1663-.1894a9.3574 9.3574 0 00-.1407-.2622l.49-1.0761a.3437.3437 0 00-.0274-.3361.3486.3486 0 00-.3006-.154l-1.1845.0416a6.7444 6.7444 0 00-.1873-.2268l.2723-1.153a.3472.3472 0 00-.417-.4172l-1.1532.2724a14.0183 14.0183 0 00-.2278-.1873l.0415-1.1845a.3442.3442 0 00-.49-.328l-1.076.491c-.0872-.0476-.1742-.0952-.2623-.1407l-.1903-1.1673A.3483.3483 0 0016.256.955l-.9597.6905a8.4867 8.4867 0 00-.2855-.086l-.414-1.1066a.3483.3483 0 00-.5781-.1154l-.8069.8666a9.2936 9.2936 0 00-.2936-.0284L12.2946.1683a.3462.3462 0 00-.5892 0l-.6236 1.0073a13.7383 13.7383 0 00-.2936.0284L9.9803.3374a.3462.3462 0 00-.578.1154l-.4141 1.1065c-.0962.0274-.1903.0567-.2855.086L7.744.955a.3483.3483 0 00-.5447.2258L7.009 2.348a9.3574 9.3574 0 00-.2622.1407l-1.0762-.491a.3462.3462 0 00-.49.328l.0416 1.1845a7.9826 7.9826 0 00-.2278.1873L3.8413 3.425a.3472.3472 0 00-.4171.4171l.2713 1.1531c-.0628.075-.1255.1509-.1863.2268l-1.1845-.0415a.3462.3462 0 00-.328.49l.491 1.0761a9.167 9.167 0 00-.1407.2622l-1.1662.1894a.3483.3483 0 00-.2258.5446l.6904.9587a13.303 13.303 0 00-.087.2855l-1.1065.414a.3483.3483 0 00-.1155.5781l.8656.807a9.2936 9.2936 0 00-.0283.2935l-1.0073.6236a.3442.3442 0 000 .5892l1.0073.6236c.008.0982.0182.1964.0283.2936l-.8656.8079a.3462.3462 0 00.1155.578l1.1065.4141c.0273.0962.0567.1914.087.2855l-.6904.9587a.3452.3452 0 00.2268.5447l1.1662.1893c.0456.088.0922.1751.1408.2622l-.491 1.0762a.3462.3462 0 00.328.49l1.1834-.0415c.0618.0769.1235.1528.1873.2277l-.2713 1.1541a.3462.3462 0 00.4171.4161l1.153-.2713c.075.0638.151.1255.2279.1863l-.0415 1.1845a.3442.3442 0 00.49.327l1.0761-.49c.087.0486.1741.0951.2622.1407l.1903 1.1662a.3483.3483 0 00.5447.2268l.9587-.6904a9.299 9.299 0 00.2855.087l.414 1.1066a.3452.3452 0 00.5781.1154l.8079-.8656c.0972.0111.1954.0203.2936.0294l.6236 1.0073a.3472.3472 0 00.5892 0l.6236-1.0073c.0982-.0091.1964-.0183.2936-.0294l.8069.8656a.3483.3483 0 00.578-.1154l.4141-1.1066a8.4626 8.4626 0 00.2855-.087l.9587.6904a.3452.3452 0 00.5447-.2268l.1903-1.1662c.088-.0456.1751-.0931.2622-.1407l1.0762.49a.3472.3472 0 00.49-.327l-.0415-1.1845a6.7267 6.7267 0 00.2267-.1863l1.1531.2713a.3472.3472 0 00.4171-.416l-.2713-1.1542c.0628-.0749.1255-.1508.1863-.2278l1.1845.0415a.3442.3442 0 00.328-.49l-.49-1.076c.0475-.0872.0951-.1742.1407-.2623l1.1662-.1893a.3483.3483 0 00.2258-.5447l-.6904-.9587.087-.2855 1.1066-.414a.3462.3462 0 00.1154-.5781l-.8656-.8079c.0101-.0972.0202-.1954.0283-.2936l1.0073-.6236a.3442.3442 0 000-.5892zm-6.7413 8.3551a.7138.7138 0 01.2986-1.396.714.714 0 11-.2997 1.396zm-.3422-2.3142a.649.649 0 00-.7715.5l-.3573 1.6685c-1.1035.501-2.3285.7795-3.6193.7795a8.7368 8.7368 0 01-3.6951-.814l-.3574-1.6684a.648.648 0 00-.7714-.499l-1.473.3158a8.7216 8.7216 0 01-.7613-.898h7.1676c.081 0 .1356-.0141.1356-.088v-2.536c0-.074-.0536-.0881-.1356-.0881h-2.0966v-1.6077h2.2677c.2065 0 1.1065.0587 1.394 1.2088.0901.3533.2875 1.5044.4232 1.8729.1346.413.6833 1.2381 1.2685 1.2381h3.5716a.7492.7492 0 00.1296-.0131 8.7874 8.7874 0 01-.8119.9526zM6.8369 20.024a.714.714 0 11-.2997-1.396.714.714 0 01.2997 1.396zM4.1177 8.9972a.7137.7137 0 11-1.304.5791.7137.7137 0 011.304-.579zm-.8352 1.9813l1.5347-.6824a.65.65 0 00.33-.8585l-.3158-.7147h1.2432v5.6025H3.5669a8.7753 8.7753 0 01-.2834-3.348zm6.7343-.5437V8.7836h2.9601c.153 0 1.0792.1772 1.0792.8697 0 .575-.7107.7815-1.2948.7815zm10.7574 1.4862c0 .2187-.008.4363-.0243.651h-.9c-.09 0-.1265.0586-.1265.1477v.413c0 .973-.5487 1.1846-1.0296 1.2382-.4576.0517-.9648-.1913-1.0275-.4717-.2704-1.5186-.7198-1.8436-1.4305-2.4034.8817-.5599 1.799-1.386 1.799-2.4915 0-1.1936-.819-1.9458-1.3769-2.3153-.7825-.5163-1.6491-.6195-1.883-.6195H5.4682a8.7651 8.7651 0 014.907-2.7699l1.0974 1.151a.648.648 0 00.9182.0213l1.227-1.1743a8.7753 8.7753 0 016.0044 4.2762l-.8403 1.8982a.652.652 0 00.33.8585l1.6178.7188c.0283.2875.0425.577.0425.8717zm-9.3006-9.5993a.7128.7128 0 11.984 1.0316.7137.7137 0 01-.984-1.0316zm8.3389 6.71a.7107.7107 0 01.9395-.3625.7137.7137 0 11-.9405.3635z","dotnet":"M24 8.77h-2.468v7.565h-1.425V8.77h-2.462V7.53H24zm-6.852 7.565h-4.821V7.53h4.63v1.24h-3.205v2.494h2.953v1.234h-2.953v2.604h3.396zm-6.708 0H8.882L4.78 9.863a2.896 2.896 0 0 1-.258-.51h-.036c.032.189.048.592.048 1.21v5.772H3.157V7.53h1.659l3.965 6.32c.167.261.275.442.323.54h.024c-.04-.233-.06-.629-.06-1.185V7.529h1.372zm-8.703-.693a.868.829 0 0 1-.869.829.868.829 0 0 1-.868-.83.868.829 0 0 1 .868-.828.868.829 0 0 1 .869.829Z","javascript":"M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z"};
  const POP = [
    ['C++', /^GNU G\+\+(\d+)/i, 'cplusplus', '#6295cb'], ['Python', /^Python 3/i, 'python', '#5a9fd4'], ['PyPy', /^PyPy 3/i, 'pypy', '#8fb3d9'],
    ['Java', /^Java \d/i, 'openjdk', '#f89820'], ['Kotlin', /^Kotlin/i, 'kotlin', '#a48bff'], ['Go', /^Go\b/i, 'go', '#00add8'],
    ['Rust', /^Rust/i, 'rust', '#dea584'], ['C#', /^C#/i, 'dotnet', '#9b7cf0'], ['JavaScript', /^Node\.js|^JavaScript/i, 'javascript', '#f7df1e'], ['C', /^GNU GCC C/i, 'c', '#a8b9cc'],
  ];
  const badge = (key, col) => `<span class="lgo" style="--c:${col}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${LOGO[key]}"/></svg></span>`;
  function popular(langs) {
    const out = [];
    for (const [label, re, key, col] of POP) {
      const L = langs.filter((l) => re.test(l.name)); if (!L.length) continue;
      const num = (l) => parseFloat((l.name.match(/(\d+(?:\.\d+)?)/) || [])[1] || 0) + (/64/.test(l.name) ? 0.001 : 0);
      out.push({ l: L.slice().sort((x, y) => num(y) - num(x))[0], label, key, col });
    }
    return out;
  }
  function langPopHTML(d) {
    const P = popular(d.langs), ids = new Set(P.map((x) => x.l.id)), rest = d.langs.filter((l) => !ids.has(l.id));
    const item = (l) => `<button type="button" class="lit" role="option" data-lang="${esc(l.id)}">${esc(l.name)}${ic('check')}</button>`;
    return `<div class="lph">Popular</div><div class="lgrid">${P.map((x) => `<button type="button" class="lit ltile" role="option" data-lang="${esc(x.l.id)}" title="${esc(x.l.name)}">${badge(x.key, x.col)}<span class="ln2"><b>${esc(x.label)}</b><small>${esc(x.l.name)}</small></span>${ic('check')}</button>`).join('')}</div>
${rest.length ? `<button type="button" class="lmore" data-lmore aria-expanded="false">${ic('down')}<span>More languages</span><small>${rest.length}</small></button><div class="lall" hidden>${rest.map(item).join('')}</div>` : ''}`;
  }
  const ACSS = `
.top .right{position:relative}
.top .cflogo{display:flex;align-items:center;justify-content:center;width:32px;height:32px;margin:0 4px 0 2px}.top .cflogo .cfmark{width:24px;height:21px}
.chip.dif{font-weight:500;background:var(--f3)}
.chip.dif.d-Easy{color:#1cbaba}.chip.dif.d-Medium{color:#ffb700}.chip.dif.d-Hard{color:#f63737}
.chip.credit{gap:6px;color:#f5f5f5;text-decoration:none;background:linear-gradient(135deg,rgba(255,161,22,.16),rgba(214,59,214,.14));box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);max-width:320px;transition:filter .15s}
.chip.credit:hover{filter:brightness(1.2)}
.chip.credit .i{width:13px;height:13px;color:#ffa116;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.chip.credit span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic}
.kbar{display:none}
.panel[data-m="code"]{overflow:visible;z-index:6}
.panel[data-m="code"]>.tabs{border-radius:8px 8px 0 0}
.edwrap{border-radius:0 0 8px 8px;overflow:hidden;padding-bottom:26px}
.lpop{max-height:min(460px,calc(100vh - 150px));z-index:30}
.edwrap .saved{left:0;right:0;bottom:0;height:26px;padding:0 12px;display:flex;align-items:center;background:var(--panel);border-top:1px solid var(--line);z-index:1}
.field{overflow-x:auto;max-width:100%}
.field.bad,.field.chk{white-space:pre-wrap;overflow-wrap:anywhere}
.rbody{overflow-x:hidden}
.exbox{overflow-x:auto}
.tabs{overflow-x:auto;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
.tab{flex:none}
.rs-head .big{overflow-wrap:anywhere}
.sl .lg{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.codeblk pre{max-height:60vh}
.lpop{column-count:auto;width:min(560px,calc(100vw - 48px));padding:10px}
.lph{padding:2px 6px 8px;font-size:12px;line-height:16px;color:var(--t3);font-weight:500}
.lgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:4px}
.lit.ltile{height:44px;gap:10px;padding:0 10px;border-radius:8px}
.lgo{width:30px;height:30px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--c) 15%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 22%,transparent)}.lgo svg{width:17px;height:17px;fill:var(--c)}
.ln2{display:flex;flex-direction:column;min-width:0;line-height:16px}.ln2 b{font-size:13px;font-weight:500;color:var(--t1)}.ln2 small{font-size:11px;color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lmore{display:flex;align-items:center;gap:6px;width:100%;height:32px;margin-top:8px;padding:0 8px;border-top:1px solid var(--line);border-radius:0;color:var(--t2);font-size:13px}
.lmore:hover{color:var(--t1)}.lmore .i{width:14px;height:14px;transition:transform .15s}.lmore[aria-expanded="true"] .i{transform:rotate(180deg)}.lmore small{margin-left:auto;color:var(--t3);font-size:12px}
.lall{column-count:2;column-gap:4px;padding-top:4px}
.foot .fb{white-space:nowrap;flex:none}
.foot .meta{min-width:0;flex:1 1 auto;overflow:hidden}.foot .sp{flex:0 0 0}
.foot .meta .link{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lmfix{display:inline-flex;align-items:center;height:32px;padding:0 14px;margin:0 8px 8px 0;border-radius:8px;background:#2cbb5d;color:#fff;font:500 14px/20px var(--ui)}.lmfix:hover{background:#28a754}.lmfix.ghost{background:var(--f3);color:var(--t1)}.lmfix.ghost:hover{background:var(--f2)}
.ptrow{display:flex;align-items:flex-start;gap:12px}.ptrow .pt{flex:1;min-width:0}
.stm{flex:none;display:inline-flex;align-items:center;gap:4px;margin-top:6px;font:400 14px/20px var(--ui);white-space:nowrap}
.stm .i{width:16px;height:16px}.stm.ok{color:#2cbb5d}.stm.try{color:#ffb800}
.tab,.sl .r{cursor:pointer}
`;
  function fail(why) {
    try { console.warn('[cfm] Modern view not mounted:', why); } catch (e) {}
    root.removeAttribute('data-cf-ui'); document.dispatchEvent(new CustomEvent('cfm:fail', { detail: why }));
  }
  function unmount() {
    if (!app) { return; }
    fire('unmount');
    const a = app; app = null; window.__cfmMounted = false;
    a.timers.forEach(clearTimeout); a.offs.forEach((f) => { try { f(); } catch (e) {} });
    flushSave(a);
    for (let i = a.journal.length - 1; i >= 0; i--) { const j = a.journal[i]; try { j.parent.insertBefore(j.node, j.next && j.next.parentNode === j.parent ? j.next : null); } catch (e) {} }
    a.host.remove();
    root.removeAttribute('data-cf-ui');
    if (globalThis.__cftsRebuild) globalThis.__cftsRebuild();   // the next theme was applied while the statement was still in here
    document.dispatchEvent(new CustomEvent('cfts:theme'));
  }
  const $ = (id) => app.sh.getElementById(id);
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); app.offs.push(() => t.removeEventListener(ev, fn, o)); };

  /* ---- behaviour ------------------------------------------------------------------------------------------------------ */
  function wire() {
    const sh = app.sh;
    on(sh, 'click', (e) => {
      const mo = e.target.closest('[data-lmore]');
      if (mo) { const open = mo.getAttribute('aria-expanded') !== 'true'; mo.setAttribute('aria-expanded', open); mo.nextElementSibling.hidden = !open; return; }
      const li = e.target.closest('.lit');
      if (li) { const sel = $('lang'); sel.value = li.dataset.lang; sel.dispatchEvent(new Event('change', { bubbles: true })); langPop(false); $('lbtn').focus(); return; }
      const el = e.target.closest('[data-act],[data-tab],[data-rp]'); if (!el) return;
      if (el.dataset.tab) return showTab(el.dataset.tab);
      if (el.dataset.rp) return rpOpen(el.dataset.rp);
      const act = el.dataset.act;
      if (act === 'topics') { const on_ = el.getAttribute('aria-pressed') !== 'true'; el.setAttribute('aria-pressed', on_); el.classList.toggle('on', on_); sh.querySelector('.tpics').hidden = !on_; }
      else if (act === 'help') { const p = $('pop'); p.hidden = !p.hidden; }
      else if (act === 'langs') langPop(!!$('lpop').hidden);
      else if (act === 'reset') resetCode();
      else if (act === 'copycode') copyCode();
      else if (act === 'full') { const fs = !$('right').parentNode.classList.contains('fs'); $('right').parentNode.classList.toggle('fs', fs); toEditor({ op: 'layout' }); }
      else fire('act', act, el, e);   // run, submit, case:N, ... belong to run.js / submit.js
    });
    on(sh, 'keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "'") { e.preventDefault(); return fire('shortcut', 'run'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); return fire('shortcut', 'submit'); } if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-act],[data-tab],[data-rp]')) { e.preventDefault(); e.target.click(); } });
    on(sh, 'change', (e) => { if (e.target.id === 'lang') { changeLang(e.target.value); fitLang(); } });
    fitLang();
    on(document, 'click', (e) => { const path = e.composedPath(); if ($('lpop') && !$('lpop').hidden && !path.includes($('lpop')) && !path.includes($('lbtn'))) langPop(false); });
    on(sh, 'keydown', (e) => { if (e.key === 'Escape' && $('lpop') && !$('lpop').hidden) { e.stopPropagation(); langPop(false); $('lbtn').focus(); } });
    on(document, 'click', (e) => { if (!e.composedPath().includes($('pop')) && !e.composedPath().some((n) => n.dataset && n.dataset.act === 'help')) { const p = $('pop'); if (p && !p.hidden) p.hidden = true; } });
    splitter($('vs'), 'x'); splitter($('hs'), 'y');
    const rescale = () => { const z = uiScale(); if (zoomOf() !== z) { app.host.style.zoom = z; toEditor({ op: 'layout' }); } };
    rescale(); on(window, 'resize', rescale);
    on(window, 'message', onMessage);
  }
  /* the language picker: LeetCode's panel of names in columns (the native list looked like the OS); the hidden select stays
     the source of truth, so changeLang and the saved code per language are untouched */
  function fitLang() {
    const sel = $('lang'); if (!sel || !sel.selectedOptions[0]) return;
    $('lname').textContent = sel.selectedOptions[0].textContent;
    app.sh.querySelectorAll('.lit').forEach((b) => { const on_ = b.dataset.lang === sel.value; b.classList.toggle('on', on_); b.setAttribute('aria-selected', on_); });
  }
  function langPop(open) {
    const p = $('lpop'); if (!p) return;
    p.hidden = !open; $('lbtn').setAttribute('aria-expanded', open);
    if (open) { const cur0 = p.querySelector('.lall .lit.on'); if (cur0) { const m = p.querySelector('[data-lmore]'); m.setAttribute('aria-expanded', 'true'); m.nextElementSibling.hidden = false; }
      const cur = p.querySelector('.lit.on') || p.querySelector('.lit'); if (cur) { cur.scrollIntoView({ block: 'nearest' }); cur.focus(); } }
  }
  function showTab(k) {
    app.sh.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('on', t.dataset.tab === k));
    const desc = k === 'desc'; $('pane-desc').hidden = !desc; const o = $('pane-other'); o.hidden = desc;
    if (!desc) {
      o.innerHTML = '';
      const handled = CFM.mods.some((m) => { try { return m.pane && m.pane(k, o) === true; } catch (e) { return false; } });
      if (!handled) {
        const name = (TABS.find((t) => t[0] === k) || [0, 'This tab'])[1];
        o.innerHTML = `<div class="stub"><b>${esc(name)} arrives in a later step</b>${k === 'edit' ? "The round's editorial for this problem, with the tutorial hidden until you ask." : 'Comments from the announcement and the editorial.'}</div>`;
      }
    }
  }
  function rpOpen(which, force) {
    const rp = $('rp'), tabs = [...rp.querySelectorAll('[data-rp]')];
    const cur = tabs.find((t) => t.classList.contains('on')).dataset.rp;
    const open = force ? true : !(rp.classList.contains('open') && cur === which);
    rp.classList.toggle('open', open); $('rbody').hidden = !open;
    tabs.forEach((t) => t.classList.toggle('on', t.dataset.rp === (open ? which : 'case')));
    fire('rp', open ? which : 'case', open);
    toEditor({ op: 'layout' });
  }

  /* splitters: pointer events, one rAF-throttled write per frame, sizes remembered, double-click resets */
  function splitter(el, axis) {
    /* The size is written straight in pointermove: a hidden or covered tab never runs requestAnimationFrame, so a throttled
       write would never land (found when modern.mjs failed in a covered window). It is one custom-property write per event;
       the browser still draws at most once per frame. */
    let grab = 0, stage = null;
    const reset = () => { if (axis === 'x') { delete app.layout.lw; app.host.style.removeProperty('--lw'); } else { delete app.layout.rh; app.host.style.removeProperty('--rh'); } applyLayout(); saveLayout(); toEditor({ op: 'layout' }); };
    let last = 0;
    on(el, 'pointerdown', (e) => {
      const now = performance.now(); if (now - last < 400) { last = 0; e.preventDefault(); return reset(); } last = now;
      const r = el.getBoundingClientRect(); grab = axis === 'x' ? e.clientX - r.left : e.clientY - r.top;
      stage = app.sh.querySelector('.stage').getBoundingClientRect();
      el.setPointerCapture(e.pointerId); el.classList.add('drag'); e.preventDefault();
    });
    on(el, 'pointermove', (e) => {
      if (!el.classList.contains('drag')) return;
      const z = zoomOf();   // pointer and boxes are in screen pixels, the stored sizes in the app's own (zoomed) pixels
      if (axis === 'x') setLeft((e.clientX - grab - stage.left) / z); else setRp((stage.bottom - (e.clientY - grab)) / z - 8);   // the bar's own edge follows the pointer
    });
    const end = (e) => { if (!el.classList.contains('drag')) return; el.classList.remove('drag'); try { el.releasePointerCapture(e.pointerId); } catch (x) {} saveLayout(); toEditor({ op: 'layout' }); };
    on(el, 'pointerup', end); on(el, 'pointercancel', end);
  }
  /* the app grows with the window: 1 up to 1536 px wide, 1.25 at 1920 and beyond (user, Oct 28 2026: "too small at 100%").
     CSS zoom scales the editor frame too (checked: a click lands on the right line and column) */
  const uiScale = () => Math.round(Math.min(1.25, Math.max(1, innerWidth / 1536)) * 100) / 100;
  const zoomOf = () => (app && parseFloat(app.host.style.zoom)) || 1;
  function setLeft(px) { const w = app.sh.querySelector('.stage').getBoundingClientRect().width / zoomOf(); px = Math.max(320, Math.min(w - 8 - 360, px)); app.layout.lw = px; app.host.style.setProperty('--lw', px + 'px'); }
  function setRp(px) { const h = app.sh.querySelector('.stage').getBoundingClientRect().height / zoomOf(); px = Math.max(36, Math.min(h - 8 - 160, px)); app.layout.rh = px; const rp = $('rp'); if (px > 40 && !rp.classList.contains('open')) { rp.classList.add('open'); $('rbody').hidden = false; } app.host.style.setProperty('--rh', px + 'px'); }
  function applyLayout() {
    const L = app.layout; if (L.lw) setLeft(L.lw); if (L.rh) { setRp(L.rh); }
  }
  function saveLayout() { chrome.storage.local.set({ [LAYOUT_KEY]: app.layout }); }

  /* ---- editor ------------------------------------------------------------------------------------------------------------ */
  const codeKey = (lang) => `cfmCode:${PID}:${lang}`;
  /* the language the editor opens in: the one you last wrote this problem in, else the one you last picked anywhere
     (cfmLang), else what Codeforces' Submit form had selected. Codeforces' default alone opened Go code under Python 3
     and Submit sent it as Python: Compilation error (user, Oct 30 2026) */
  function pickLang(d, store) {
    const has = (id) => d.langs.some((l) => l.id === id), codes = (store && store[CODE_KEY]) || {}, pre = `cfmCode:${PID}:`;
    const mine = Object.keys(codes).filter((k) => k.startsWith(pre) && has(k.slice(pre.length))).sort((x, y) => codes[y].at - codes[x].at)[0];
    if (mine) return mine.slice(pre.length);
    if (store && has(store.cfmLang)) return store.cfmLang;
    return d.defaultLang;
  }
  const langName = (id, a = app) => ((a && a.d ? a.d.langs : []).find((l) => l.id === id) || { name: '' }).name;   // takes the mount explicitly: unmount() saves after it has cleared `app`
  function initEditor() {
    /* DEV ONLY (cfmDev + "#cfm-plain" in the URL): a plain textarea instead of the Monaco iframe. A tab that embeds another
       extension's page cannot be driven by browser automation (Chrome refuses), so live passes run this way; Monaco itself is
       covered offline (harness/modern-editor.mjs) and by the live iframe check. Same protocol as the iframe, answered locally. */
    if (app.ed.plain) {
      const ta = document.createElement('textarea');
      ta.className = 'edta'; ta.spellcheck = false; ta.setAttribute('aria-label', 'Code (plain dev editor)');
      $('edwrap').insertBefore(ta, $('edmsg'));
      app.ed.ta = ta; ta.value = startCode(app.lang);
      app.ed.ready = true; $('edmsg').hidden = true; $('saved').textContent = 'Saved'; $('pos').textContent = 'plain dev editor';
      ta.addEventListener('input', () => fromEditor({ op: 'change', code: ta.value }));
      ta.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "'") { e.preventDefault(); fire('shortcut', 'run'); }
        else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); fire('shortcut', 'submit'); }
        e.stopPropagation();   // Codeforces' own key handlers never see the code being typed
      });
      return;
    }
    const f = document.createElement('iframe');
    f.className = 'edf'; f.title = 'Code editor'; f.setAttribute('allow', 'clipboard-read; clipboard-write');   // Monaco reads the clipboard on paste: without this Chrome logged a permissions-policy violation
    f.src = chrome.runtime.getURL('src/modern/editor.html');
    app.ed.frame = f; app.ed.timer = setTimeout(() => { if (app && !app.ed.ready) editorMsg('The editor could not start. Reload the page; if it stays, tell me what the console says.'); }, 8000);
    app.timers.push(app.ed.timer);
    $('edwrap').insertBefore(f, $('edmsg'));
    f.style.visibility = 'hidden';
  }
  const editorMsg = (t) => { const m = $('edmsg'); if (m) { m.textContent = t; m.hidden = false; } };
  const toEditor = (m) => {
    if (app && app.ed.plain) {
      const ta = app.ed.ta; if (!ta) return;
      if (m.op === 'setCode') { ta.value = m.code || ''; fromEditor({ op: 'change', code: ta.value }); }
      else if (m.op === 'getCode') fromEditor({ op: 'code', id: m.id, code: ta.value });
      else if (m.op === 'focus') ta.focus();
      return;
    }
    const f = app && app.ed.frame; if (f && f.contentWindow) f.contentWindow.postMessage(Object.assign({ cfm: 'ed' }, m), EXT);
  };
  function onMessage(e) {
    if (!app || !app.ed.frame || e.source !== app.ed.frame.contentWindow || e.origin !== EXT) return;
    const m = e.data; if (!m || m.cfm !== 'ed') return;
    fromEditor(m);
  }
  function fromEditor(m) {
    if (!app) return;
    if (m.op === 'loaded') {
      toEditor({ op: 'init', code: startCode(app.lang), lang: modeOf(langName(app.lang)), pos: app.fresh ? bodyPos(app.code) : null });
    } else if (m.op === 'ready') {
      app.ed.ready = true; $('edmsg').hidden = true; app.ed.frame.style.visibility = ''; $('saved').textContent = 'Saved'; $('pos').textContent = 'Ln 1, Col 1';
    } else if (m.op === 'error') {
      editorMsg('The editor reported a problem: ' + m.message);
    } else if (m.op === 'change') {
      if (m.code === app.lastSaved || app.loading) return;
      app.code = m.code; app.dirty = true; $('saved').textContent = 'Saving…'; scheduleSave();
    } else if (m.op === 'cursor') {
      $('pos').textContent = `Ln ${m.ln}, Col ${m.col}`;
    } else if (m.op === 'shortcut') {
      fire('shortcut', m.key);
    } else if (m.op === 'code' && app.codeWaiters && app.codeWaiters[m.id]) { app.codeWaiters[m.id](m.code); delete app.codeWaiters[m.id]; }
  }
  function flash(t) { const s = $('saved'); const old = s.textContent; s.textContent = t; app.timers.push(setTimeout(() => { if (app) s.textContent = app.dirty ? 'Saving…' : 'Saved'; }, 1800)); }
  function starter(lang, a = app) { return (TPL[tplKey(langName(lang, a))] || TPL.plaintext)(a && a.d && a.d.multi); }
  /* a fresh starter opens with the cursor inside solve(), on its empty indented line (user: "make the cursor there, so the
     user knows where to start typing"), instead of a placeholder to delete */
  function bodyPos(code) {
    const L = String(code).split('\n'), i = L.findIndex((l, k) => k > 0 && /^[ \t]+$/.test(l) && /solve|Solve/.test(L[k - 1]));
    return i < 0 ? null : { ln: i + 1, col: L[i].length + 1 };
  }
  function startCode(lang) {
    const saved = app.codes[codeKey(lang)];
    app.code = saved ? saved.code : starter(lang); app.fresh = !saved;
    app.lastSaved = app.code;
    return app.code;
  }
  function scheduleSave() { clearTimeout(app.saveT); app.saveT = setTimeout(() => flushSave(app), 500); app.timers.push(app.saveT); }
  function flushSave(a) {
    if (!a || !a.dirty) return;
    a.dirty = false; clearTimeout(a.saveT);
    const k = codeKey(a.lang), tpl = starter(a.lang, a);
    if (a.code === tpl) delete a.codes[k]; else a.codes[k] = { code: a.code, at: Date.now() };
    const keys = Object.keys(a.codes).sort((x, y) => a.codes[x].at - a.codes[y].at);
    while (keys.length > LAST) delete a.codes[keys.shift()];
    a.lastSaved = a.code;
    chrome.storage.local.set({ [CODE_KEY]: a.codes }, () => { if (app === a) { const s = a.sh.getElementById('saved'); if (s) s.textContent = 'Saved'; } });
  }
  function changeLang(id) {
    flushSave(app);
    app.lang = id; chrome.storage.local.set({ cfmLang: id });
    const mode = modeOf(langName(id));
    app.loading = true;
    toEditor({ op: 'setLang', lang: mode }); toEditor({ op: 'setCode', code: startCode(id) }); if (app.fresh) toEditor({ op: 'setPos', pos: bodyPos(app.code) });
    app.timers.push(setTimeout(() => { if (app) app.loading = false; }, 200));
  }
  function resetCode() {
    const tpl = starter(app.lang);
    app.code = tpl; app.dirty = true; app.loading = true;
    toEditor({ op: 'setCode', code: tpl }); toEditor({ op: 'setPos', pos: bodyPos(tpl) }); flushSave(app);
    app.timers.push(setTimeout(() => { if (app) app.loading = false; }, 200));
  }
  function copyCode() {
    const id = 'c' + Date.now();
    app.codeWaiters = app.codeWaiters || {};
    app.codeWaiters[id] = (code) => { try { navigator.clipboard.writeText(code).then(() => flash('Copied'), () => flash('Could not copy')); } catch (e) { flash('Could not copy'); } };
    toEditor({ op: 'getCode', id });
  }

  /* "Copy report" (dev box): a summary of the mount. No code, no cookies, no tokens. */
  CFM.debug = CFM.debug || {};
  CFM.debug.app = () => {
    if (!app) return { mounted: false };
    const g = (id) => { const e = app.sh.getElementById(id); return e ? e.textContent : null; };
    const box = (id) => { const e = app.sh.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
    const stmt = app.host.querySelector('.cfm-stmt');
    const raw = stmt ? (stmt.textContent.match(/\$\$\$/g) || []).length : -1;
    return { mounted: true, problem: PID, signedInAs: app.d.handle || '(nobody)', language: langName(app.lang, app) + ' [' + app.lang + '] -> ' + modeOf(langName(app.lang, app)), languages: app.d.langs.length,
      editor: { ready: !!app.ed.ready, message: (app.sh.getElementById('edmsg') || {}).hidden ? '(hidden: ok)' : g('edmsg'), saved: g('saved'), position: g('pos'), codeChars: (app.code || '').length },
      layout: app.layout, left: box('left'), right: box('right'), tabsOn: [...app.sh.querySelectorAll('[data-tab].on')].map((t) => t.dataset.tab),
      statement: { mathRendered: stmt ? stmt.querySelectorAll('.MathJax, .MathJax_Preview').length : -1, rawDollarMarks: raw },
      moved: app.journal.length };
  };
  /* what the modules may use (everything reads the CURRENT mount) */
  CFM.ctx = {
    get app() { return app; }, $, on, esc, ic, IC, PID, CID, IDX, EXT, TABS, rankOf, modeOf, langName: (id) => langName(id, app),
    toEditor, flash, showTab, rpOpen, fire,
    /* Submit's "Switch to Go and submit": the language changes and the code goes with it (it stays under the old one only if different) */
    setLang(id, code) {
      const a = app; if (!a || !a.d.langs.some((l) => l.id === id)) return;
      flushSave(a);
      const old = codeKey(a.lang); if (a.codes[old] && a.codes[old].code === code) delete a.codes[old];
      a.codes[codeKey(id)] = { code, at: Date.now() };
      chrome.storage.local.set({ [CODE_KEY]: a.codes });
      const sel = $('lang'); if (sel) { sel.value = id; sel.dispatchEvent(new Event('change', { bubbles: true })); } else changeLang(id);
    },
    getCode(cb) {
      const id = 'g' + Math.random().toString(36).slice(2); let done = false;
      const fin = (c) => { if (done) return; done = true; if (app && app.codeWaiters) delete app.codeWaiters[id]; cb(c); };
      app.codeWaiters = app.codeWaiters || {}; app.codeWaiters[id] = fin;
      toEditor({ op: 'getCode', id });
      setTimeout(() => fin(app ? app.code : ''), 1500);   // the editor frame did not answer: the code we mirrored from its change events
    },
  };

  /* ---- switching ------------------------------------------------------------------------------------------------------ */
  function apply(v) {
    wanted = v === 'modern';
    if (!wanted) return unmount();
    const go = () => chrome.storage.local.get([LAYOUT_KEY, CODE_KEY, 'cfmDev', 'cfmLang'], (s) => mount(s));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
  }
  /* on = the LeetCode theme with its layout on (popup: cfThemeStudio 'leetcode' + cfUI 'modern'; "Classic view" sets cfUI 'classic') */
  const modernWanted = (r) => !!r && r[UI_KEY] === 'modern' && (globalThis.CFTS_THEMES ? (globalThis.CFTS_THEMES.byId[r.cfThemeStudio] || {}).app === 'modern' : r.cfThemeStudio === 'leetcode');   // src/themes.js: the theme whose app is 'modern'
  chrome.storage.local.get([UI_KEY, 'cfThemeStudio', 'cfmDev'], (r) => {
    if (r && r.cfmDev && /cfm-classic/.test(location.hash)) { chrome.storage.local.set({ [UI_KEY]: 'classic' }); return; }   // DEV ONLY: a way back that needs no click inside Modern
    apply(modernWanted(r) ? 'modern' : 'classic');
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && (c[UI_KEY] || c.cfThemeStudio)) chrome.storage.local.get([UI_KEY, 'cfThemeStudio'], (r) => apply(modernWanted(r) ? 'modern' : 'classic'));
  });
  /* tests and the dev box can ask without storage */
  document.addEventListener('cfm:unmount', () => unmount());
  /* safety net: if Modern was asked for but never mounted (no statement, an error), the page must not stay blank */
  setTimeout(() => { if (wanted && !app) fail('timeout'); }, 6000);
})();
