/* =============================================================================
   find.js  (content script)   the search box, on every theme with Codeforces' header

   Codeforces' own /search is a full-text index of blogs and users, so a problem's name brings back posts about it. This filters
   the problem list in the browser, by name, ID and topic, on every key: what the LeetCode layout does. The list is Modern's cache
   (cfmProblems, one fetch a day, fetched here only when someone actually searches); the last row hands the words to Codeforces.
   Enter opens the row that is lit. No results or no list: Enter is the form it always was. A theme may set __cftsFind.thumb.
   The list hangs off <body>: the menu's boxes may clip a child. Mounted once by guided.js; an app's HUD moves the form with it.
============================================================================= */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'cfmProblems', AT = 'cfmApiAt', DAY = 864e5, MAX = 7;
  const get = (k) => new Promise((r) => chrome.storage.local.get(k, r));

  /* the same rows, cache and call spacing as modern/api.js, which only loads on problem pages */
  let list = null;
  function load() {
    return list || (list = (async () => {
      const s = await get([KEY, AT]), c = s[KEY];
      if (c && c.rows && c.rows.length && Date.now() - c.at < DAY && Array.isArray(c.rows[0][5])) return c.rows;
      const wait = (s[AT] || 0) + 2300 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      chrome.storage.local.set({ [AT]: Date.now() });
      const res = await fetch('https://codeforces.com/api/problemset.problems', { credentials: 'omit' }).then((r) => r.json());
      if (res.status !== 'OK') throw new Error(res.comment || 'API');
      const seen = new Map(res.result.problemStatistics.map((x) => [`${x.contestId}:${x.index}`, x.solvedCount]));
      const rows = res.result.problems.map((p) => [p.contestId, p.index, p.name, p.rating || 0, seen.get(`${p.contestId}:${p.index}`) || 0, p.tags || []]);
      chrome.storage.local.set({ [KEY]: { at: Date.now(), rows } });
      return rows;
    })().catch((e) => { list = null; throw e; }));
  }

  /* an exact ID first, then the name from its start, then a word's start, then anywhere, then a topic; the most solved first */
  function rank(rows, text) {
    const q = text.trim().toLowerCase(), words = q.split(/\s+/), id = q.replace(/\s+/g, ''), scored = [];
    for (const r of rows) {
      const pid = `${r[0]}${r[1]}`.toLowerCase(), name = r[2].toLowerCase();
      let s = pid === id ? 0 : pid.startsWith(id) ? 1 : -1;
      if (s < 0 && words.every((w) => name.includes(w))) s = name.startsWith(q) ? 2 : words.every((w) => name.startsWith(w) || name.includes(` ${w}`)) ? 3 : 4;
      if (s < 0 && r[5].some((t) => t === q || t.startsWith(q))) s = 5;
      if (s >= 0) scored.push([s, r]);
    }
    return scored.sort((a, b) => a[0] - b[0] || b[1][4] - a[1][4]).slice(0, MAX).map((x) => x[1]);
  }

  /* the words of a name that match, in the hot ink */
  const mark = (name, text) => {
    const w = text.trim().split(/\s+/).filter(Boolean).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return w.length ? name.split(new RegExp(`(${w.join('|')})`, 'gi')).map((x, i) => (i % 2 ? `<mark>${esc(x)}</mark>` : esc(x))).join('') : esc(name);
  };

  const INK = [[1200, 'gray'], [1400, 'green'], [1600, 'cyan'], [1900, 'blue'], [2100, 'violet'], [2400, 'orange'], [Infinity, 'red']];
  const inkOf = (r) => INK.find((x) => r < x[0])[1];

  function build(j, form) {
    const q = form.querySelector('input.search');
    if (!q) return;
    const box = j.make('<div class="cfts-found" id="cfts-found" data-cfts role="listbox" aria-label="Problems" hidden></div>');
    j.insert(box, document.body);
    j.attr(q, 'role', 'combobox'); j.attr(q, 'aria-controls', 'cfts-found'); j.attr(q, 'aria-expanded', 'false'); j.attr(q, 'autocomplete', 'off');
    let rows = [], lit = 0, seq = 0, failed = false;
    const links = () => [...box.querySelectorAll('a')];
    const light = (i) => { lit = i; links().forEach((a, k) => a.classList.toggle('on', k === i)); const a = links()[i]; if (a) q.setAttribute('aria-activedescendant', a.id); };
    const place = () => { const f = q.getBoundingClientRect(), w = Math.min(520, innerWidth - 24); box.style.width = `${w}px`; box.style.top = `${f.bottom + 8}px`; box.style.left = `${Math.max(12, Math.min(f.right - w, innerWidth - w - 12))}px`; };
    const open = (on) => { if (on) place(); box.hidden = !on; q.setAttribute('aria-expanded', String(on)); if (!on) { q.removeAttribute('aria-activedescendant'); q.classList.remove('cfts-searching'); } };
    function draw() {
      const text = q.value.trim();
      const found = rows.map((r, i) => {
        const pic = globalThis.__cftsFind.thumb ? globalThis.__cftsFind.thumb(r) : '';
        return `<a id="cfts-f${i}" role="option" href="/problemset/problem/${r[0]}/${esc(r[1])}"${pic ? ' class="pic"' : ''}>${pic}<span class="n">${mark(r[2], text)}</span><span class="id">${r[0]}${esc(r[1])}</span><b${r[3] ? ` style="color:var(--cf-rank-${inkOf(r[3])})"` : ''}>${r[3] || 'New'}</b></a>`;
      }).join('');
      const note = failed ? '<p>Couldn’t load the problem list.</p>' : rows.length ? '' : '<p>No problem has that name or ID.</p>';
      box.innerHTML = `${found}${note}<button type="button" class="all">Search blogs and users for “${esc(text)}”</button>`;
      light(rows.length ? 0 : -1);
      open(true);
    }
    function look() {
      const text = q.value.trim(), me = ++seq;
      if (!text) { rows = []; open(false); return; }
      if (!list || !box.hidden) q.classList.toggle('cfts-searching', !list);
      load().then((all) => { if (me !== seq) return; q.classList.remove('cfts-searching'); failed = false; rows = rank(all, text); draw(); },
        () => { if (me !== seq) return; q.classList.remove('cfts-searching'); failed = true; rows = []; draw(); });
    }
    let idle = 0;
    j.on(q, 'input', () => { clearTimeout(idle); idle = setTimeout(look, 40); });
    j.on(q, 'focus', () => { if (q.value.trim() && box.hidden && !q.hasAttribute('data-isPlaceholder')) look(); });
    j.on(q, 'keydown', (e) => {
      if (e.key === 'Escape') { open(false); return; }
      if (box.hidden || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      const n = links().length;
      if (n) light((lit + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
    });
    j.on(form, 'submit', (e) => {
      const a = !box.hidden && links()[lit];
      if (a) { e.preventDefault(); location.href = a.href; return; }
      if (!box.hidden || failed) { open(false); return; }
      if (q.value.trim() && !list) { e.preventDefault(); look(); }        // the first search: Enter arrived before the list
    });
    j.on(box, 'click', (e) => { if (e.target.closest('.all')) { open(false); rows = []; form.requestSubmit(); } });
    j.on(window, 'scroll', () => { if (!box.hidden) place(); });
    j.on(document, 'pointerdown', (e) => { if (!form.contains(e.target) && !box.contains(e.target)) open(false); });
  }
  globalThis.__cftsFind = { build, rank };
})();
