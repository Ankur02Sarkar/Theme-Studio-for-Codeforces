/* =============================================================================
   editor.js  (extension page, runs inside the iframe src/modern/editor.html)
   Monaco 0.57.0 (vendor/monaco-editor, MIT, files as published minus the pruned
   ones, see vendor/monaco-editor/PRUNED.txt). Talks to the content script by
   postMessage only; both sides check the sender:
     parent -> here : {cfm:'ed', op:'init'|'setCode'|'setLang'|'getCode'|'focus'|'layout', ...}
     here -> parent : {cfm:'ed', op:'ready'|'change'|'cursor'|'shortcut'|'code'|'error', ...}
   The page's CSS can't reach this document, and ours can't reach the page.
============================================================================= */
(() => {
  const ORIGIN_OK = (o) => /^https:\/\/([a-z0-9-]+\.)?codeforces\.com$/.test(o) || o === location.origin;
  const send = (m) => { try { parent.postMessage(Object.assign({ cfm: 'ed' }, m), '*'); } catch (e) {} };
  const JS_CHUNK = 'vs/javascript-B_IYblwB';
  let ed = null, pending = [], jsReady = false; const jsPending = [];
  const FONT = '"Droid Sans Mono", Menlo, Monaco, Consolas, "DejaVu Sans Mono", monospace';

  /* the Dark+ palette measured on LeetCode's Monaco (reference/lc-spec.md 4.13), on our panel grey */
  const THEME = {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: '', foreground: 'd4d4d4' },
      { token: 'keyword', foreground: '569cd6' }, { token: 'keyword.control', foreground: 'c586c0' },
      { token: 'type', foreground: '4ec9b0' }, { token: 'type.identifier', foreground: '4ec9b0' },
      { token: 'identifier', foreground: '9cdcfe' }, { token: 'variable', foreground: '9cdcfe' },
      { token: 'string', foreground: 'ce9178' }, { token: 'number', foreground: 'b5cea8' }, { token: 'comment', foreground: '6a9955' },
      { token: 'delimiter', foreground: 'd4d4d4' }, { token: 'predefined', foreground: 'dcdcaa' }, { token: 'annotation', foreground: 'dcdcaa' },
    ],
    colors: {
      'editor.background': '#262626', 'editor.foreground': '#d4d4d4',
      'editorLineNumber.foreground': '#858585', 'editorLineNumber.activeForeground': '#c6c6c6',
      'editor.lineHighlightBackground': '#00000000', 'editor.lineHighlightBorder': '#282828',
      'editorIndentGuide.background1': '#404040', 'editorIndentGuide.activeBackground1': '#707070',
      'editor.selectionBackground': '#264f78', 'editorCursor.foreground': '#aeafad',
      'editorWidget.background': '#323232', 'scrollbarSlider.background': '#ffffff1a',
    },
  };

  /* Pixel Art's duel: the same editor in that theme's palette */
  /* Anime's ink: paper-white on sumi, one warm accent, one cold (ANIME.md) */
  const INK = {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: '', foreground: 'f1edf5' }, { token: 'keyword', foreground: 'ff6b7a' }, { token: 'keyword.control', foreground: 'ff6b7a' },
      { token: 'type', foreground: '7fd4ff' }, { token: 'type.identifier', foreground: '7fd4ff' }, { token: 'identifier', foreground: 'f1edf5' },
      { token: 'string', foreground: 'ffd27a' }, { token: 'number', foreground: 'c6a6ff' }, { token: 'comment', foreground: '8f8a9c', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'b9b4c4' }, { token: 'predefined', foreground: '7fd4ff' }, { token: 'annotation', foreground: 'ffd27a' },
    ],
    colors: {
      'editor.background': '#0d0b13', 'editor.foreground': '#f1edf5', 'editorLineNumber.foreground': '#5a5468', 'editorLineNumber.activeForeground': '#f1edf5',
      'editor.lineHighlightBackground': '#191522', 'editor.lineHighlightBorder': '#00000000', 'editorIndentGuide.background1': '#221d2e',
      'editor.selectionBackground': '#4a3a5e', 'editorCursor.foreground': '#ff6b7a', 'editorWidget.background': '#191522', 'scrollbarSlider.background': '#3a344866',
    },
  };

  const PIXEL = {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: '', foreground: 'f6f1e3' }, { token: 'keyword', foreground: 'ffcd75' }, { token: 'keyword.control', foreground: 'ffa36b' },
      { token: 'type', foreground: '73eff7' }, { token: 'type.identifier', foreground: '73eff7' }, { token: 'identifier', foreground: 'f6f1e3' }, { token: 'variable', foreground: 'f6f1e3' },
      { token: 'string', foreground: 'a7f070' }, { token: 'number', foreground: 'c9a0ff' }, { token: 'comment', foreground: '9b95b0' },
      { token: 'delimiter', foreground: 'c2bcd2' }, { token: 'predefined', foreground: '6cb6ff' }, { token: 'annotation', foreground: 'ffa36b' },
    ],
    colors: {
      'editor.background': '#14121e', 'editor.foreground': '#f6f1e3', 'editorLineNumber.foreground': '#5d5684', 'editorLineNumber.activeForeground': '#ffcd75',
      'editor.lineHighlightBackground': '#1e1b2e', 'editor.lineHighlightBorder': '#00000000', 'editorIndentGuide.background1': '#2a2640', 'editorIndentGuide.activeBackground1': '#4e4870',
      'editor.selectionBackground': '#4e4870', 'editorCursor.foreground': '#ffcd75', 'editorWidget.background': '#1e1b2e', 'scrollbarSlider.background': '#4e487080',
    },
  };

  function boot(o) {
    window.require.config({ paths: { vs: '../../vendor/monaco-editor/vs' } });
    window.require(['vs/editor/editor.main'], () => {
      const monaco = window.monaco;
      /* editor.main installs Blob-URL workers, which an extension page's CSP (script-src 'self') refuses: point the
         base editor worker at the packaged file instead. Language services (ts/css/html/json) are not used. */
      const wurl = new URL('../../vendor/monaco-editor/vs/assets/editor.worker-_vAIFJDs.js', location.href).href;
      window.MonacoEnvironment = { getWorker: () => new Worker(wurl) };
      monaco.editor.defineTheme('cfm-dark', THEME);
      monaco.editor.defineTheme('cfm-pixel', PIXEL);
      monaco.editor.defineTheme('cfm-anime', INK);
      const skinned = o.skin === 'pixel' || o.skin === 'anime';
      if (skinned) { document.body.style.background = document.documentElement.style.background = o.skin === 'anime' ? '#0d0b13' : '#14121e'; }
      /* JavaScript / Node: colouring only. Monaco's own 'javascript' language starts the TypeScript language service (tsMode +
         a 7 MB worker, both pruned), so we register a separate id with just the Monarch tokenizer that ships in the 1 KB
         javascript chunk (it extends the 5 KB typescript chunk). The hashed names are those of monaco-editor 0.57.0; a
         Monaco upgrade changes them and modern-editor.mjs ('tokenizes cfm-javascript') fails until this is updated. */
      window.require([JS_CHUNK], (m) => {
        monaco.languages.register({ id: 'cfm-javascript', extensions: [], aliases: ['JavaScript (colouring only)'] });
        monaco.languages.setMonarchTokensProvider('cfm-javascript', m.language);
        monaco.languages.setLanguageConfiguration('cfm-javascript', m.conf);
        jsReady = true; while (jsPending.length) jsPending.shift()();
      }, () => { jsReady = true; while (jsPending.length) jsPending.shift()(); });
      ed = monaco.editor.create(document.getElementById('ed'), {
        value: o.code || '', language: (o.lang === 'cfm-javascript' && !jsReady) ? 'plaintext' : (o.lang || 'plaintext'), theme: o.skin === 'anime' ? 'cfm-anime' : o.skin === 'pixel' ? 'cfm-pixel' : 'cfm-dark', fontFamily: skinned ? `"JetBrains Mono", ${FONT}` : FONT, fontSize: skinned ? 14 : 13, lineHeight: skinned ? 22 : 18,
        minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, insertSpaces: true,
        padding: { top: 6 }, renderLineHighlight: 'all', fontLigatures: false, lineNumbersMinChars: 3, lineDecorationsWidth: 16, folding: true,
        glyphMargin: false, overviewRulerLanes: 0, hideCursorInOverviewRuler: true, scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        quickSuggestions: false, suggestOnTriggerCharacters: false, wordBasedSuggestions: 'off', parameterHints: { enabled: false },
        contextmenu: false, readOnly: !!o.readOnly, accessibilitySupport: 'off',
      });
      /* Monaco measures a character once. If the web font lands after that, every column is off and the cursor drifts from the text
         (seen live on a friend's machine: the font was slower than Monaco). Measure again when it is really there. */
      if (skinned && document.fonts) {
        const again = () => { try { monaco.editor.remeasureFonts(); } catch (e) { /* older build */ } };
        document.fonts.load('14px "JetBrains Mono"').then(() => document.fonts.ready).then(again, again);
        document.fonts.addEventListener('loadingdone', again);
      }
      ed.onDidChangeModelContent(() => send({ op: 'change', code: ed.getValue() }));
      ed.onDidChangeCursorPosition((e) => send({ op: 'cursor', ln: e.position.lineNumber, col: e.position.column }));
      /* LeetCode's shortcuts: Ctrl/Cmd+' runs, Ctrl/Cmd+Enter submits */
      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Quote, () => send({ op: 'shortcut', key: 'run' }));
      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => send({ op: 'shortcut', key: 'submit' }));
      if (o.lang === 'cfm-javascript' && !jsReady) jsPending.push(() => monaco.editor.setModelLanguage(ed.getModel(), 'cfm-javascript'));
      send({ op: 'ready', version: '0.57.0' });
      if (o.pos) at(o.pos);   // after 'ready': the app resets its position label on ready
      pending.forEach(handle); pending = [];
    }, (err) => send({ op: 'error', message: 'Monaco failed to load: ' + (err && (err.message || err.requireType) || err) }));
  }

  /* what is on screen, as text and colours: Pixel's break redraws the page, and this frame is another process */
  function painted() {
    const spans = [], top = (el) => el.getBoundingClientRect();
    const lineH = 22, base = 16;
    for (const line of document.querySelectorAll('.view-line')) {
      const y = top(line).top + base;
      for (const s of line.querySelectorAll('span > span')) { const r = top(s), t = s.textContent; if (t.trim()) spans.push({ x: r.left, y, t, c: getComputedStyle(s).color }); }
    }
    for (const n of document.querySelectorAll('.line-numbers')) { const r = top(n); if (n.textContent.trim()) spans.push({ x: r.left + 10, y: r.top + base, t: n.textContent.trim(), c: getComputedStyle(n).color }); }
    return { spans, bg: '#14121e', size: 14, lineH };
  }

  /* the cursor at a line and column, shown and focused (the starter's solve() body) */
  function at(pos) { if (!pos || !ed) return; ed.setPosition({ lineNumber: pos.ln, column: pos.col }); ed.revealPositionInCenterIfOutsideViewport({ lineNumber: pos.ln, column: pos.col }); ed.focus(); }
  function handle(m) {
    if (m.op === 'init') return boot(m);
    if (!ed) return pending.push(m);
    const monaco = window.monaco;
    if (m.op === 'setCode') ed.setValue(m.code || '');
    else if (m.op === 'setLang') { const l = m.lang || 'plaintext'; if (l === 'cfm-javascript' && !jsReady) jsPending.push(() => monaco.editor.setModelLanguage(ed.getModel(), l)); else monaco.editor.setModelLanguage(ed.getModel(), l); }
    else if (m.op === 'getCode') send({ op: 'code', id: m.id, code: ed.getValue() });
    else if (m.op === 'paint') send({ op: 'painted', id: m.id, paint: painted() });
    else if (m.op === 'focus') ed.focus();
    else if (m.op === 'setPos') at(m.pos);
    else if (m.op === 'layout') ed.layout();
    else if (m.op === 'readOnly') ed.updateOptions({ readOnly: !!m.on });
  }

  window.addEventListener('message', (e) => {
    if (e.source !== parent || !ORIGIN_OK(e.origin)) return;
    const m = e.data;
    if (!m || m.cfm !== 'ed') return;
    if (!ed && m.op !== 'init') pending.push(m); else handle(m);
  });
  window.addEventListener('error', (e) => send({ op: 'error', message: String(e.message || e) }));
  send({ op: 'loaded' });
})();
