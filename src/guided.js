/* =============================================================================
   guided.js  (isolated world)  — the Guided layout's annotations

   BRIEF.md "The UX layer", CLAUDE.md "Page briefs". CSS (themes/guided.css)
   does the layout; this script only ANNOTATES the server-rendered page, once,
   reading what the page already shows: division and rating badges, page
   titles, primary buttons, solved markers, the topics switch, the sidebar
   explainer. It never requests anything and never observes the page.

   Every change goes through a journal (J) and is undone in reverse order, so
   Off and a live contest give back Codeforces' DOM exactly: added nodes are removed,
   moved nodes go back to their old parent and position, classes and
   attributes are restored. Everything added carries data-cfts.

   Two journals:
     always   header niceties that belong to the look, in both layouts
              (search placeholder, the signed-in handle's cached rating)
     guided   the page reorganisation (Guided only)
   content.js calls globalThis.__cftsSync() whenever theme / layout / live
   state change; sync() applies or undoes each journal accordingly.
============================================================================= */
(() => {
  const root = document.documentElement;
  const PATH = location.pathname;

  /* ---- journal ------------------------------------------------------------ */
  function Journal() {
    const ops = [];
    const j = {
      get active() { return ops.length > 0 || j.applied; },
      applied: false,
      make(html) {
        const t = document.createElement('template');
        t.innerHTML = html.trim();
        const el = t.content.firstElementChild;
        el.setAttribute('data-cfts', '');
        return el;
      },
      insert(el, parent, before = null) {
        if (!parent) return el;
        if (before && before.parentNode !== parent) before = null;   // a reference node elsewhere threw NotFoundError and the catch below undid the whole layer (user's live problemset, Oct 28 2026)
        parent.insertBefore(el, before);
        ops.push(() => el.remove());
        return el;
      },
      move(node, parent, before = null) {
        if (!node || !parent) return;
        if (before && before.parentNode !== parent) before = null;
        const op = node.parentNode, on = node.nextSibling;
        parent.insertBefore(node, before);
        /* no parent = someone else removed it since (FASTLAP's sidebar panels, leaving as Anime took the page): not ours to bring back */
        ops.push(() => { if (op && node.parentNode) op.insertBefore(node, on && on.parentNode === op ? on : null); });
      },
      cls(el, ...names) {
        if (!el) return;
        for (const c of names) {
          if (el.classList.contains(c)) continue;
          el.classList.add(c);
          ops.push(() => el.classList.remove(c));
        }
      },
      attr(el, name, value) {
        if (!el) return;
        const had = el.hasAttribute(name), old = el.getAttribute(name);
        el.setAttribute(name, value);
        ops.push(() => (had ? el.setAttribute(name, old) : el.removeAttribute(name)));
      },
      /* relabel a TEXT node (Codeforces' raw strings: "x13151", "Enter »"...) */
      text(tn, value) {
        if (!tn || tn.nodeType !== 3) return;
        const old = tn.nodeValue;
        if (old === value) return;
        tn.nodeValue = value;
        ops.push(() => { tn.nodeValue = old; });
      },
      on(el, type, fn) {
        if (!el) return;
        el.addEventListener(type, fn);
        ops.push(() => el.removeEventListener(type, fn));
      },
      /* a display timer (not page polling: it reads nothing from the page);
         runs until fn returns false or the journal is undone */
      every(fn, ms) {
        let id = 0, live = true;
        const run = () => { if (live && fn() !== false) id = setTimeout(run, ms); };
        id = setTimeout(run, ms);
        ops.push(() => { live = false; clearTimeout(id); });
      },
      undo() {
        while (ops.length) { try { ops.pop()(); } catch (e) { /* keep undoing */ } }
        j.applied = false;
      },
    };
    return j;
  }
  const always = Journal(), guided = Journal(), world = Journal();

  /* the first direct text child of el matching re (or any non-empty one) */
  function textChild(el, re) {
    if (!el) return null;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim() && (!re || re.test(n.nodeValue))) return n;
    return null;
  }
  const fmt = (n) => Number(n).toLocaleString('en-US');
  /* Reads of computed style or layout wait for the first frame: at
     DOMContentLoaded they would force a full style + layout pass of the page
     before Chrome's own, and on a 10,000-row standings page each pass costs
     seconds (harness/loadtrace.mjs). Writes happen first, reads after. */
  const afterFirstFrame = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));

  /* ---- shared vocabulary (CLAUDE.md, "Page briefs") ------------------------ */
  const DIVS = {
    div4: ['Div. 4', 'Beginner', 'green', 'Rated for participants below 1400'],
    div3: ['Div. 3', 'Easy', 'cyan', 'Rated for participants below 1600'],
    div2: ['Div. 2', 'Intermediate', 'blue', 'Rated for participants below 2100'],
    div1: ['Div. 1', 'Advanced', 'red', 'Rated for participants rated 1900 and up'],
    edu:  ['Educational', 'Div. 2 level', 'blue', 'Rated for participants below 2100. Learning-focused: extended ICPC rules and a 12-hour open hacking phase'],
    all:  ['Div. 1 + 2', 'All levels', 'orange', 'Rated for everyone: one problem set for all levels'],
  };
  function division(name) {
    const n = (name || '').toLowerCase();
    if (/educational|образовательн/.test(n)) return 'edu';
    if (/div\. ?1 ?\+ ?(div\. ?)?2|global|глобальн/.test(n)) return 'all';
    for (const d of '4321') if (n.includes('div. ' + d)) return 'div' + d;
    return null;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function divBadge(j, name, extra = '') {
    const k = division(name);
    if (!k) return null;
    const [label, word, col, rated] = DIVS[k];
    return j.make(`<span class="cfts-div" style="--c:var(--cf-rank-${col})" tabindex="0" data-cfts-tip="${esc(label + ' · ' + word + '\n' + rated + '.' + extra)}"><b>${label}</b><span>${word}</span></span>`);
  }
  const RANK = [[1200, 'gray', 'Newbie', 'below 1200'], [1400, 'green', 'Pupil', '1200–1399'], [1600, 'cyan', 'Specialist', '1400–1599'],
    [1900, 'blue', 'Expert', '1600–1899'], [2100, 'violet', 'Candidate Master', '1900–2099'], [2400, 'orange', 'Master', '2100–2399'], [1e9, 'red', 'Grandmaster', '2400+']];
  const rankOf = (r) => RANK.find((x) => r < x[0]);
  /* Easy / Medium / Hard / Very hard ("Very hard", not "Expert": Expert is the
     name of the 1600–1899 rank, which the tooltips use) */
  const word = (r) => (r < 1400 ? 'Easy' : r < 1900 ? 'Medium' : r < 2400 ? 'Hard' : 'Very hard');
  function ratingBadge(j, r) {
    if (!r) return j.make('<span class="cfts-rate none" tabindex="0" data-cfts-tip="Not rated yet&#10;Codeforces rates a problem some days after its round."><span class="n">Not rated yet</span></span>');
    const [, col, rk, rng] = rankOf(r);
    return j.make(`<span class="cfts-rate" style="--c:var(--cf-rank-${col})" tabindex="0" data-cfts-tip="Rated ${r} · ${word(r)}&#10;About ${rk} level (${rng}). Ratings run from 800 (easiest) to 3500."><span class="n">${r}</span><span class="w">${word(r)}</span></span>`);
  }
  const ICON = {
    check: '<svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    flame: '<svg viewBox="0 0 24 24"><path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.6 3-5.6 3.6-9.3 2.4 1.6 3.4 3.6 3.4 5.6.9-.8 1.5-2 1.6-3.4 2 1.6 4.4 4 4.4 7.1 0 3.5-2.5 6.2-6.5 6.2z"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20.5h7M10 17h4"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0C5.5 15 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    lang: '<svg viewBox="0 0 24 24"><path d="M4 6h9M8.5 4v2M6 6c.5 3 2.5 5.5 5 7M11 6c-.8 3.5-3 6.5-6 8"/><path d="M13 20l3.5-8 3.5 8M14.2 17.5h4.6"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/></svg>',
    mega: '<svg viewBox="0 0 24 24"><path d="M3 11v3l12 5V6z"/><path d="M15 9a4 4 0 0 1 0 6"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M21 3 10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/></svg>',
  };

  /* ---- live contest: never reorganised (BRIEF rule 5) -------------------------- */
  function isLiveContest() {
    if (!/^\/(contest|gym|group)\//.test(PATH)) return false;
    const phase = document.querySelector('#sidebar .contest-state-phase');
    if (phase) return !/finished|закончено|practice|дорешивание|before contest|до начала/i.test(phase.textContent);
    /* standings pages have no sidebar: the phase is the line under the
       contest name ("Final standings, …"). Unknown = live: a
       running contest must never get the Guided layout. */
    if (/^\/(contest|gym|group\/[^/]+\/contest)\/\d+\/standings/.test(PATH)) {
      const name = document.querySelector('.contest-name');
      const line = name && name.parentNode ? name.parentNode.textContent : '';
      return !/final standings|finished|итоговое положение|закончено|practice|дорешивание/i.test(line);
    }
    return false;
  }

  /* ---- a contest's (or gym's) problem list: marked by what it shows, not by its column count (Codeforces' markup for it has
     no saved copy; the problemset's grid misplaced its cells and clipped the time/memory line, user Oct 30 2026). The
     name cell's line that names the input/output and limits becomes .cfts-lims; the table .cfts-clist. */
  function contestListPage(j) {
    const table = document.querySelector('table.problems'); if (!table) return;
    j.cls(table, 'cfts-clist');
    const LIMS = /input|output|\b[MKG]B\b|МБ|ввод|вывод/i;
    for (const tr of table.querySelectorAll('tr')) {
      const name = tr.cells[1]; if (!name || name.tagName !== 'TD') continue;
      const link = name.querySelector('a[href*="/problem/"]');
      /* the limits: the outermost block that names input/output or a size and does not hold the problem's link */
      const cands = [...name.querySelectorAll('div, span')].filter((e) => LIMS.test(e.textContent) && !(link && e.contains(link)));
      const lims = cands.find((e) => !cands.some((o) => o !== e && o.contains(e)));
      let title = link; while (title && title.parentElement && title.parentElement !== name) title = title.parentElement;
      if (title && title !== link) j.cls(title, 'cfts-ctitle');
      /* the limits are redrawn as our own block, a sibling of the title in the cell: Codeforces' block kept clipping and
         overlapping under styling we cannot see (no saved copy of this page), so nothing of it is reused but its text */
      if (lims) {
        const c = lims.cloneNode(true); c.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
        const lines = c.textContent.split('\n').map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
        j.cls(lims, 'cfts-hidden');
        j.insert(j.make(`<div class="cfts-lims">${lines.map((t) => `<span>${esc(t)}</span>`).join('')}</div>`), name);
      }
      j.cls(name, 'cfts-cname');
      if (link && tr.classList.contains('accepted-problem')) j.insert(j.make(`<span class="cfts-chip ok">${ICON.check} Solved</span>`), link.parentNode, link.nextSibling);
      else if (link && tr.classList.contains('rejected-problem')) j.insert(j.make('<span class="cfts-chip warn">Tried</span>'), link.parentNode, link.nextSibling);
      const sub = tr.querySelector('td.act a[href*="/submit"]');
      if (sub && !sub.querySelector('.cfts-sublbl')) j.insert(j.make('<span class="cfts-sublbl">Submit</span>'), sub);
    }
  }

  /* A contest's problem list where Guided does not run (Midnight, Grid, Classic, LeetCode's other pages, and EVERY theme while
     the contest runs): Codeforces' limits line was clipped and ran under long names (user, Nov 1 2026, /contest/2278 live).
     The same method as Guided's: its text redrawn as our own block. The title and the block share one flex row inside the
     cell (a cell itself must stay a table cell, or the columns fall apart); nothing leaves the cell */
  function contestLimits(j) {
    if (!/^\/(contest|gym)\/\d+\/?$/.test(location.pathname)) return;
    const table = document.querySelector('table.problems'); if (!table) return;
    const LIMS = /input|output|\b[MKG]B\b|МБ|ввод|вывод/i;
    for (const tr of table.querySelectorAll('tr')) {
      const name = tr.cells[1]; if (!name || name.tagName !== 'TD' || name.querySelector('.cfts-crow')) continue;
      const link = name.querySelector('a[href*="/problem/"]'); if (!link) continue;
      const cands = [...name.querySelectorAll('div, span')].filter((e) => LIMS.test(e.textContent) && !e.contains(link));
      const lims = cands.find((e) => !cands.some((o) => o !== e && o.contains(e)));
      if (!lims) continue;
      let title = link; while (title.parentElement && title.parentElement !== name) title = title.parentElement;
      const c = lims.cloneNode(true); c.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
      const lines = c.textContent.split('\n').map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const row = j.insert(j.make('<div class="cfts-crow"></div>'), name, name.firstChild);
      j.move(title, row);
      j.cls(title, 'cfts-ctitle');
      j.cls(lims, 'cfts-hidden');
      j.insert(j.make(`<div class="cfts-lims">${lines.map((t) => `<span>${esc(t)}</span>`).join('')}</div>`), row);
    }
  }

  /* ===================== ALWAYS (both layouts) ============================= */
  /* A page type we have no saved copy of can carry Codeforces' light-page inks in rules we have never seen (the user's
     /groups/with/<handle>: a black group name, a navy "Accepted", on every dark theme). On such pages, once, the same test
     regress.mjs runs: own text darker than a dark theme can show gets the theme's ink; blue stays in Codeforces' blue family.
     Known pages are covered by core.css and never scanned; nor is a page too big to read at load. */
  const INKED_PAGES = /^\/($|problemset|contests?\b|gyms?\b|profile|blog|submissions|ratings)/;
  function inkGuard(j) {
    if (root.getAttribute('data-cf-mode') !== 'dark' || INKED_PAGES.test(location.pathname)) return;
    const els = document.querySelectorAll('#pageContent *');
    if (!els.length || els.length > 4000) return;
    for (const el of els) {
      if (el.classList.contains('rated-user') || el.closest('.MathJax') || !textChild(el)) continue;
      const s = getComputedStyle(el);
      if (lum(s.color) >= 0.2 || lum(s.backgroundColor) > 0.6) continue;
      const [r, g, b] = s.color.match(/[\d.]+/g).map(Number);
      j.cls(el, b > r + g ? 'cfts-ink-blue' : 'cfts-ink');
    }
  }
  function applyAlways() {
    const j = always;
    j.applied = true;
    afterFirstFrame(() => { if (always.applied) { markChrome(always); inkGuard(always); } });
    /* Donate, where a theme asks: in the flags' row, whose right edge is fixed, so it only takes the header's empty space */
    const cfg = (globalThis.CFTS_THEMES && CFTS_THEMES.byId[root.getAttribute('data-cf-theme')]) || {};
    const flags = document.querySelector('#header .lang-chooser > div:first-child');
    if (cfg.donate && flags && !root.hasAttribute('data-cf-wearer')) j.insert(j.make(`<a class="cfts-donate" href="https://extensions.vinaytz.com/support" target="_blank" rel="noopener"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14s-5.5-3.4-5.5-7.1A3 3 0 0 1 8 4.6a3 3 0 0 1 5.5 2.3C13.5 10.6 8 14 8 14Z"/></svg>Donate</a>`), flags, flags.firstChild);
    if (/^\/(usertalk|talks)\b/.test(location.pathname)) [800, 2500].forEach((ms) => setTimeout(() => { if (always.applied) markChrome(always); }, ms));   // the talk window fills in after load
    const hdr = document.getElementById('header');
    if (hdr) j.on(hdr, 'click', () => setTimeout(() => { if (always.applied) markChrome(always); }, 60));
    const search = document.querySelector('input.search');
    if (search && !search.placeholder) j.attr(search, 'placeholder', 'Search problems…');
    const theme = root.getAttribute('data-cf-theme');
    if (search && search.form && !root.hasAttribute('data-cf-wearer') && theme !== 'fastlap') globalThis.__cftsFind.build(j, search.form);
    /* a search is a POST and a full page load: the field shows it is on its way.
       The back button can restore this page from the cache, hence pageshow; 15 s
       is for a form that never left */
    const findField = (form) => form && form.querySelector && form.querySelector('input.search, input.search-large');
    const clearSearching = () => { for (const q of document.querySelectorAll('.cfts-searching')) q.classList.remove('cfts-searching'); };
    const searching = (q) => { if (!q || !q.value.trim()) return; q.classList.add('cfts-searching'); setTimeout(clearSearching, 15000); };
    j.on(document, 'submit', (e) => { if (!e.defaultPrevented) searching(findField(e.target)); });
    j.on(document, 'change', (e) => { if (e.target.name === 'by' && e.target.closest('.by-form')) searching(document.querySelector('input.search-large')); });   // Sort by submits from script: no submit event
    j.on(window, 'pageshow', clearSearching);
    /* /search's cards are inline-styled roundboxes with no class of their own */
    if (location.pathname === '/search') {
      const pc = document.getElementById('pageContent');
      j.cls(pc, 'cfts-searchpage');
      for (const n of pc ? pc.querySelectorAll(':scope > .roundbox > div[style*="float:right"]:first-child') : []) j.cls(n, 'cfts-search-n');
    }
    /* signed in, a "|" sits between the header's small icon and the flags */
    for (const div of document.querySelectorAll('#header .lang-chooser > div')) {
      if (!div.querySelector('img[src*="/flags/"]')) continue;
      for (const n of [...div.childNodes]) if (n.nodeType === 3 && /^\s*\|\s*$/.test(n.nodeValue)) j.text(n, ' ');
    }
    /* signed in: the personal sidebar box loses its bullets (both layouts) */
    const mine = findMeBox();
    if (mine) j.cls(mine, 'cfts-mine');
    /* signed in: the header's handle link (it is the one before Logout) */
    const links = [...document.querySelectorAll('#header .lang-chooser > div:nth-child(2) a')];
    const logout = links.find((a) => /\/logout/.test(a.getAttribute('href') || ''));
    if (logout) {
      j.attr(root, 'data-cf-signed', '');
      j.cls(logout, 'cfts-logout');
      const me = links.find((a) => /^\/profile\//.test(a.getAttribute('href') || ''));
      if (me) {
        j.cls(me, 'cfts-me');
        const handle = me.getAttribute('href').split('/')[2];
        /* on your own profile, cache your rating (no request: the page shows it) */
        if (PATH === '/profile/' + handle) {
          const info = [...document.querySelectorAll('.info li')].find((li) => /rating|рейтинг/i.test(li.textContent));
          const val = info && info.querySelector('span[style*="font-weight"], span.user-gray, span[class^="user-"]');
          const rating = val ? parseInt(val.textContent, 10) : NaN;
          if (Number.isFinite(rating)) chrome.storage.local.set({ cfMe: { handle, rating, at: Date.now() } });
        }
        chrome.storage.local.get('cfMe', (res) => {
          const c = res && res.cfMe;
          if (!c || c.handle !== handle || !always.applied || me.querySelector('[data-cfts]')) return;
          const [, col] = rankOf(c.rating);
          j.attr(me, 'style', `--me:var(--cf-rank-${col})`);
          j.insert(j.make(`<span class="cfts-me-rating">${c.rating}</span>`), me);
        });
      }
    }
  }

  /* Signed-in chrome we can't see in the signed-out harness (the bell, its
     dropdown, profile action icons): found by READING the page, not by class
     names. Inside #header, any box painted light (a white dropdown) is marked
     cfts-lightbox; raster icons that are not the logo or a flag become line
     icons when their purpose is clear (alt/title/src: bell, settings, mail),
     else a neutral treatment. Rescanned after a click in the header, since a
     dropdown may be built on demand. #header is ~50 elements: cheap. */
  const lum = (c) => {
    const m = (c || '').match(/[\d.]+/g); if (!m) return 0;
    const [r, g, b, a = 1] = m.map(Number); if (a < 0.5) return 0;
    const l = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
    return .2126 * l(r) + .7152 * l(g) + .0722 * l(b);
  };
  function iconKind(img) {
    const t = ((img.getAttribute('alt') || '') + ' ' + (img.getAttribute('title') || '') + ' ' + (img.getAttribute('src') || '')).toLowerCase();
    if (/bell|notif|уведом/.test(t)) return 'bell';
    if (/setting|gear|настрой/.test(t)) return 'gear';
    if (/mail|email|envelope|почт/.test(t)) return 'mail';
    return null;
  }
  function markChrome(j) {
    const hdr = document.getElementById('header');
    /* a light header (Classic) paints its own boxes light: they are not dropdowns */
    const darkHdr = hdr && lum(getComputedStyle(hdr).color) > 0.2;
    if (hdr) {
      if (darkHdr) for (const el of hdr.querySelectorAll('div, ul, span, table')) {
        if (el.classList.contains('cfts-lightbox') || el.closest('.cfts-lightbox')) continue;
        if (lum(getComputedStyle(el).backgroundColor) > 0.6) j.cls(el, 'cfts-lightbox');
      }
      for (const img of hdr.querySelectorAll('img')) {
        if (img.closest('a[href="/"]') || /\/flags/.test(img.getAttribute('src') || '') || img.classList.contains('cfts-ico')) continue;
        j.cls(img, 'cfts-ico');
        const k = iconKind(img);
        if (k) j.attr(img, 'data-cfts-ico', k);
      }
    }
    /* talk pages (/usertalk, /talks): Codeforces paints its message boxes and editor light, and the theme's light ink on them
       was unreadable (user, Oct 30 2026). Any light-painted box there becomes a pane (themed in core.css); boxes inside a pane are
       left to the pane's rules */
    if (/^\/(usertalk|talks)\b/.test(location.pathname)) {
      for (const el of document.body.querySelectorAll('div, table, td, ul, li, p, span, textarea, input[type="text"]')) {
        if (el.closest('#header, #cfm-app, .cfts-lightpane, [data-cfts]')) continue;
        if (lum(getComputedStyle(el).backgroundColor) > 0.6) j.cls(el, 'cfts-lightpane');
      }
    }
    for (const img of document.querySelectorAll('.userbox .info ul li img')) {   // the action list only: never the badge or the avatar
      if (img.classList.contains('cfts-ico') || getComputedStyle(img).backgroundImage !== 'none') continue;   // icons.css already drew it
      j.cls(img, 'cfts-ico');
      const k = iconKind(img);
      if (k) j.attr(img, 'data-cfts-ico', k);
    }
  }

  /* ---- shared Guided helpers ---------------------------------------------- */
  /* "*has extra registration ?" -> a small chip; the explanation is the tooltip */
  function extraRegChip(j, scope) {
    for (const n of scope.querySelectorAll('div.notice')) {
      if (!/extra registration|дополнительн/i.test(n.textContent)) continue;
      const q = n.querySelector('[title]');
      j.cls(n, 'cfts-hidden');
      j.insert(j.make(`<span class="cfts-chip xr" tabindex="0" data-cfts-tip="${esc(q ? q.getAttribute('title') : '')}">Extra registration</span>`), n.parentNode, n);
    }
  }
  /* Codeforces' "Pay attention" box (next contest), as the mocked card:
     division badge, title, "Starts in", the countdown, Register as a button */
  function payCard(j) {
    const pay = [...document.querySelectorAll('#sidebar > .roundbox')].find((b) => b.querySelector('.contest-state-phase') && /pay attention|внимание/i.test((b.querySelector('.caption') || {}).textContent || ''));
    if (!pay) return null;
    j.cls(pay, 'cfts-pay');
    const name = pay.querySelector('a[href^="/contests/"], a[href^="/contest/"]');
    const phase = pay.querySelector('.contest-state-phase');
    if (name) { const b = divBadge(j, name.textContent); if (b) j.insert(b, name.parentNode, phase); }
    if (phase && /before contest/i.test(phase.textContent)) j.text(textChild(phase), 'Starts in');
    const reg = pay.querySelector('a[href^="/contestRegistration/"]');
    if (reg) { j.cls(reg, 'cfts-btn', 'primary', 'wide'); j.text(textChild(reg, /Register/), 'Register now'); }
    extraRegChip(j, pay);
    dayCountdown(j, pay.querySelector('.countdown'));
    return pay;
  }
  /* over 24 h, "45:29:00" reads as "1 d 21 h". Codeforces' script rewrites its
     countdown every second, so ours stands in for it (computed once from its
     value, redrawn each minute) and hands back to Codeforces' live hh:mm:ss
     under 24 h. Under 24 h, or in its own words ("2 days"), nothing changes. */
  /* units: Classic in Russian passes ['д', 'ч'] */
  function dayCountdown(j, cd, units = ['d', 'h']) {
    const m = cd && cd.textContent.trim().match(/^(\d+):(\d\d):(\d\d)$/);
    if (!m) return;
    const secs = +m[1] * 3600 + +m[2] * 60 + +m[3];
    if (secs < 86400) return;
    const end = Date.now() + secs * 1000;
    const el = j.make('<span class="cfts-dcount"></span>');
    j.insert(el, cd.parentNode, cd);
    j.cls(cd, 'cfts-hidden');
    const draw = () => {
      const left = end - Date.now();
      if (left < 86400000) { el.remove(); cd.classList.remove('cfts-hidden'); return false; }
      el.textContent = `${Math.floor(left / 86400000)} ${units[0]} ${Math.floor((left % 86400000) / 3600000)} ${units[1]}`;
      return true;
    };
    draw();
    j.every(draw, 60000);
  }

  /* ===================== GUIDED: Contests ================================== */
  /* a contest row's meta: date and length chips, the "by" line (hidden when
     there are no authors; more than 3 collapse into "+N", the rest on hover) */
  function rowMeta(j, tr, byTd, startTd, lenTd) {
    j.cls(byTd, 'cfts-by'); j.cls(startTd, 'cfts-when'); j.cls(lenTd, 'cfts-len');
    /* past rows: Codeforces writes the start twice (.format-date and
       .format-time-only) and its reformatTimes() turns them into a local date
       and a local time. Ours never converts: after load, if both still read
       the same (not converted), the second is hidden; else "date · time". */
    const fd = startTd.querySelector('.format-date'), ft = startTd.querySelector('.format-time-only');
    if (fd && ft) afterFirstFrame(() => {
      if (!guided.applied) return;
      j.cls(startTd, ft.textContent.trim() === fd.textContent.trim() ? 'cfts-when-one' : 'cfts-when-two');
    });
    const authors = [...byTd.querySelectorAll('a')];
    if (!authors.length) j.cls(byTd, 'cfts-noby');
    if (authors.length > 3) {
      authors.slice(3).forEach((a) => j.cls(a, 'cfts-hidden'));
      j.insert(j.make(`<span class="cfts-more" tabindex="0" data-cfts-tip="${esc(authors.slice(3).map((a) => a.textContent.trim()).join(', '))}">+${authors.length - 3}</span>`), byTd);
    }
  }
  function contestsPage(j) {
    j.attr(root, 'data-cfts-page', 'contests');
    const pc = document.getElementById('pageContent');
    const first = document.querySelector('.contestList');
    if (pc && first) {
      j.insert(j.make('<div class="cfts-pagehead"><h1>Contests</h1><p>Join a rated round live, or practise any past round as a virtual contest.</p></div>'), first.parentNode, first);
    }
    /* times are shown once, in the section line, not on every row */
    /* Codeforces' format-time shows times in the browser's zone and adds the
       "UTC+5.5" superscript after we run: name the same zone ourselves */
    const off = -new Date().getTimezoneOffset() / 60;
    const tz = 'UTC' + (off >= 0 ? '+' : '') + (Math.round(off * 100) / 100);
    /* upcoming = the FIRST table only: the past-contests table sits inside
       .contestList too (.contestList > .contests-table > .datatable) */
    const up = [...document.querySelectorAll('.contestList > .datatable table tr')].filter((tr, i) => i > 0 && tr.cells.length >= 6);
    up.forEach((tr, i) => {
      const [nameTd, byTd, startTd, lenTd, stateTd, actTd] = tr.cells;
      j.cls(tr, 'cfts-up');
      const badge = divBadge(j, nameTd.textContent) || j.make('<span class="cfts-div-none"></span>');
      j.insert(badge, nameTd, nameTd.firstChild);
      if (i === 0) {
        j.cls(tr, 'cfts-hero');
        j.insert(j.make('<div class="cfts-kicker">Next contest</div>'), nameTd, nameTd.firstChild);
        /* "Also coming up" sits in the NEXT row's first cell, never as a row
           of its own: Codeforces stripes the rows by script after we run, and
           an extra <tr> left the stripes shifted by one after Off */
        if (up[1]) {
          j.cls(up[1], 'cfts-afterhero');
          j.insert(j.make(`<div class="cfts-subhead"><h2>Also coming up <span>times in ${esc(tz)}</span></h2></div>`), up[1].cells[0], up[1].cells[0].firstChild);
        }
      }
      rowMeta(j, tr, byTd, startTd, lenTd);
      j.cls(stateTd, 'cfts-state'); j.cls(actTd, 'cfts-act');
      j.text(textChild(stateTd, /Before start/), 'Starts in ');
      const reg = actTd.querySelector('a[href^="/contestRegistration/"]');
      if (reg) { j.cls(reg, 'cfts-btn', 'primary'); j.text(textChild(reg, /Register/), 'Register'); }
      const cnt = actTd.querySelector('a.contestParticipantCountLinkMargin');
      const ct = cnt && textChild(cnt, /x\d+/);
      if (ct) j.text(ct, fmt(ct.nodeValue.trim().slice(1)) + ' registered');
      for (const d of actTd.querySelectorAll(':scope > div')) j.text(textChild(d, /Until closing/), 'closes in ');
      j.text(textChild(actTd, /Before registration/), 'Registration opens in ');
      extraRegChip(j, actTd);
      for (const cd of tr.querySelectorAll('.countdown')) dayCountdown(j, cd);
      /* signed in, registered: Codeforces' own markup (CONFIRM on a capture) */
      const unreg = actTd.querySelector('a[href*="nregister" i], a[href*="Unregistration" i]');
      if (unreg) j.cls(unreg, 'cfts-btn', 'ghost');
      if (/registration completed|registered|вы зарегистрированы|регистрация завершена/i.test(actTd.textContent) && !reg)
        j.insert(j.make(`<span class="cfts-chip ok">${ICON.check} You're registered</span>`), actTd, actTd.firstChild);
    });
    /* past contests: badge | title, then one meta line (date · length · took
       part · by …), and one row of quiet buttons Enter · Virtual · Standings */
    const pastDt = document.querySelector('.contests-table > .datatable');
    const pastCap = pastDt && pastDt.querySelector(':scope > .rb + div');
    if (pastCap) j.insert(j.make('<span class="cfts-capsub">Enter to read the problems · Virtual to replay it under contest conditions</span>'), pastCap, textChild(pastCap) ? textChild(pastCap).nextSibling : null);
    document.querySelectorAll('.contests-table .datatable table tr').forEach((tr, i) => {
      if (i === 0 || tr.cells.length < 6) return;
      const [nameTd, byTd, startTd, lenTd, stateTd, partTd] = tr.cells;
      j.cls(tr, 'cfts-past');
      rowMeta(j, tr, byTd, startTd, lenTd);
      j.cls(partTd, 'cfts-part'); j.cls(stateTd, 'cfts-acts');
      const title = textChild(nameTd);
      const badge = divBadge(j, title ? title.nodeValue : nameTd.textContent,
        division(nameTd.textContent) === 'div3' ? ' Its problems start at about 800: a good first contest.' : '');
      j.insert(badge || j.make('<span class="cfts-div-none"></span>'), nameTd, nameTd.firstChild);
      const cnt = partTd.querySelector('a.contestParticipantCountLinkMargin');
      const ct = cnt && textChild(cnt, /x\d+/);
      if (ct) j.text(ct, fmt(ct.nodeValue.trim().slice(1)) + ' took part');
      /* one row of actions: Enter, Virtual, Standings (no » chevrons) */
      const links = [...nameTd.querySelectorAll(':scope > a')];
      const stand = stateTd.querySelector('a[href$="/standings"]');
      for (const a of links) {
        j.cls(a, 'cfts-btn', 'quiet');
        j.move(a, stateTd, stateTd.firstChild && stateTd.firstChild.nodeType === 1 ? stateTd.firstElementChild : null);
        const t = textChild(a);
        if (t) j.text(t, /virtual/i.test(a.getAttribute('href')) ? 'Virtual' : 'Enter');
      }
      if (links[0]) j.cls(links[0], 'enter');
      if (stand) {
        j.cls(stand, 'cfts-btn', 'quiet');
        j.move(stand, stateTd, null);
        const t = textChild(stand); if (t && /final standings/i.test(t.nodeValue)) j.text(t, 'Standings');
      }
      stateTd.querySelectorAll('a:not(.cfts-btn)').forEach((a) => j.cls(a, 'cfts-btn', 'quiet'));
    });
    /* sidebar: "Pay attention" repeats the hero here; the explainer replaces it */
    const pay = [...document.querySelectorAll('#sidebar > .roundbox')].find((b) => b.querySelector('a[href^="/contestRegistration/"]') && b.querySelector('.contest-state-phase'));
    const side = document.getElementById('sidebar');
    if (side) {
      const meRank = (() => {
        const me = document.querySelector('#header .cfts-me');
        const m = me && me.className.match(/user-(gray|green|cyan|blue|violet|orange|red|legendary)/);
        return m ? m[1] : null;
      })();
      const steps = ['div4', 'div3', 'div2', 'div1'].map((k) => {
        const [label, w, col] = DIVS[k];
        const rng = { div4: 'below 1400', div3: 'below 1600', div2: 'below 2100', div1: '1900 and up' }[k];
        return `<div class="step"><span class="cfts-div" style="--c:var(--cf-rank-${col})"><b>${label}</b><span>${w}</span></span><span class="rng">${rng}</span></div>`;
      }).join('');
      const you = meRank ? `<div class="you">${{ gray: 'Div. 4, Div. 3', green: 'Div. 4, Div. 3', cyan: 'Div. 3, Div. 2', blue: 'Div. 2', violet: 'Div. 2 and Div. 1', orange: 'Div. 1', red: 'Div. 1', legendary: 'Div. 1' }[meRank]}, Educational and Div. 1 + 2 rounds are rated for your current rank.</div>`
        : '<div class="you">New here? Start with a <b>Div. 4</b> or <b>Div. 3</b> round.</div>';
      const card = j.make(`<div class="roundbox sidebox cfts-explainer"><div class="caption titled">→ Which contest should I join?</div>
        <div class="body"><p>A round is <b>rated</b> for you when your rating is in its range:</p><div class="ladder">${steps}</div>
        <p><b>Educational</b>: Div. 2 level, learning-focused. <b>Div. 1 + 2</b>: everyone, one problem set.</p>${you}</div></div>`);
      j.insert(card, side, pay ? pay : side.firstChild);
      if (pay) j.cls(pay, 'cfts-hidden');
    }
    /* the past-contests filter: the mocked labels, Filter as the full-width
       primary button */
    const form = document.getElementById('past-contests-filter-form');
    if (form) {
      const fbox = form.closest('.roundbox');
      j.cls(fbox, 'cfts-filterbox');
      j.text(textChild(fbox.querySelector('.caption'), /Past contests filter/i), '→ Filter past contests');
      const LABELS = { 'Contest type:': 'Contest type', 'Rated:': 'Rated', 'Tried:': 'Tried by you', 'Substring:': 'Name contains' };
      for (const el of form.querySelectorAll('label, .setting-name, td')) {
        const t = textChild(el); if (t && LABELS[t.nodeValue.trim()]) j.text(t, LABELS[t.nodeValue.trim()]);
      }
      const sub = form.querySelector('input[name="filterSubstring"], #filterSubstring');
      if (sub && !sub.placeholder) j.attr(sub, 'placeholder', 'e.g. Educational');
      const btn = form.querySelector('input[type="submit"]');
      if (btn) j.cls(btn, 'cfts-primary-input', 'cfts-full');
    }
  }

  /* ===================== GUIDED: Problemset ================================ */
  function problemsetPage(j) {
    j.attr(root, 'data-cfts-page', 'problemset');
    const table = document.querySelector('.datatable table.problems');
    if (!table) return;
    const dt = table.closest('.datatable');
    const cap = dt.querySelector(':scope > .rb + div');
    /* lede + difficulty quick filters (Codeforces' own ?tags= ranges, verified) */
    const tags = new URLSearchParams(location.search).get('tags') || '';
    const range = (tags.match(/\d{3,4}-\d{3,4}/) || [''])[0];
    const chips = [['All', '', null], ['Easy', '800-1300', 'gray'], ['Medium', '1400-1800', 'cyan'], ['Hard', '1900-2300', 'violet'], ['Very hard', '2400-3500', 'red']]
      .map(([n, r, c]) => `<a class="cfts-seg${r === range ? ' on' : ''}" href="/problemset${r ? '?tags=' + r : ''}">${c ? `<i style="background:var(--cf-rank-${c})"></i>` : ''}${n}${r ? ` <span>${r.replace('-', '–').replace('2400–3500', '2400+')}</span>` : ''}</a>`).join('');
    /* Sort: Codeforces' own orders (verified: each keeps the ?tags= filter) */
    const params = new URLSearchParams(location.search), order = params.get('order') || '';
    const SORTS = [['', 'Newest'], ['BY_RATING_ASC', 'Easiest first'], ['BY_RATING_DESC', 'Hardest first'], ['BY_SOLVED_DESC', 'Most solved'], ['BY_SOLVED_ASC', 'Least solved']];
    const sortUrl = (o) => { const q = new URLSearchParams(location.search); if (o) q.set('order', o); else q.delete('order'); const qs = q.toString(); return location.pathname + (qs ? '?' + qs : ''); };
    const sortSel = `<label class="cfts-sort"><span>Sort</span><select>${SORTS.map(([o, n]) => `<option value="${esc(sortUrl(o))}"${o === order ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
    const lede = j.make(`<div class="cfts-pslede"><p>Every problem is rated from 800 (easiest) to 3500. New here? Start with Easy and work up.</p><div class="cfts-quick">${chips}${sortSel}</div></div>`);
    if (cap) j.insert(lede, dt, cap.nextSibling);
    j.on(lede.querySelector('select'), 'change', (e) => { location.href = e.target.value; });
    /* column labels: PROBLEM, DIFFICULTY, SOLVED BY (the sort links stay) */
    const head = table.rows[0];
    if (head) {
      j.text(textChild(head.cells[1], /Name|Название/), 'Problem');
      for (const [i, label] of [[3, 'Difficulty'], [4, 'Solved by']]) {
        const a = head.cells[i] && head.cells[i].querySelector('a');
        if (a) { j.cls(a, 'cfts-sortlink'); j.insert(j.make(`<span class="cfts-thlabel">${label}</span>`), a, a.firstChild); }
      }
    }
    /* signed in: solved / tried on this page */
    const acc = table.querySelectorAll('tr.accepted-problem').length, rej = table.querySelectorAll('tr.rejected-problem').length;
    if (acc + rej) lede.insertAdjacentHTML('beforeend', `<div class="cfts-progress"><b>${acc}</b> solved · <b>${rej}</b> tried on this page</div>`);
    [...table.rows].forEach((tr, i) => {
      if (i === 0) return;
      const nameTd = tr.cells[1], act = tr.cells[2], rateTd = tr.cells[3];
      if (!nameTd) return;
      const nameDiv = nameTd.querySelector('div');
      if (tr.classList.contains('accepted-problem')) j.insert(j.make(`<span class="cfts-chip ok">${ICON.check} Solved</span>`), nameDiv);
      else if (tr.classList.contains('rejected-problem')) j.insert(j.make('<span class="cfts-chip warn">Tried</span>'), nameDiv);
      if (rateTd) {
        const span = rateTd.querySelector('.ProblemRating');
        const r = span ? parseInt(span.textContent, 10) : NaN;
        j.insert(ratingBadge(j, Number.isFinite(r) ? r : 0), rateTd);
      }
      const sub = act && act.querySelector('a[href*="/submit"]');
      if (sub) j.insert(j.make('<span class="cfts-sublbl">Submit</span>'), sub);
      /* "x174" -> "✓ 174", muted */
      const cnt = tr.cells[4] && tr.cells[4].querySelector('a');
      const ct = cnt && textChild(cnt, /x\d+/);
      if (ct) { j.text(ct, fmt(ct.nodeValue.replace(/[^\d]/g, ''))); j.cls(cnt, 'cfts-solvedcount'); j.insert(j.make(`<span class="cfts-tick">${ICON.check}</span>`), cnt, cnt.firstChild); }
    });
    /* sidebar pieces: each on its own, so a box shaped unlike our saved pages costs that box, not the page */
    step(() => topicsSwitch(j, document.querySelector('#sidebar ._FilterByTagsFrame_main')), 'topics');
    step(() => payCard(j), 'pay');
    step(() => filterCard(j), 'filter');
  }
  function step(fn, what) { try { fn(); } catch (e) { try { console.warn('[cfts] guided ' + what + ':', e && e.message); } catch (x) { /* none */ } } }

  /* the problemset filter as mocked: DIFFICULTY (From / To + the coloured
     Easy → Very hard scale), then TOPICS (the switch, Codeforces' "Add tag"
     as a field), Apply primary + Reset. Codeforces' own inputs and form. */
  function filterCard(j) {
    const box = document.querySelector('#sidebar ._FilterByTagsFrame_main');
    if (!box) return;
    j.cls(box, 'cfts-filterbox');
    const diff = box.querySelector('._FilterByTagsFrame_difficulty');
    if (diff) {
      j.cls(diff, 'cfts-diff');
      const label = diff.querySelector('label');
      j.text(textChild(label, /Difficulty|Сложность/), '');
      j.insert(j.make('<div class="cfts-group">Difficulty</div>'), diff.parentNode, diff);
      const span = label && label.querySelector('span');
      if (span) { j.text(textChild(span, /—|\u2014/), 'to'); j.cls(span, 'cfts-pair'); }
      const min = diff.querySelector('input[name="minDifficulty"]'), max = diff.querySelector('input[name="maxDifficulty"]');
      if (min) { j.attr(min, 'placeholder', '800'); j.attr(min, 'aria-label', 'From difficulty'); j.insert(j.make('<span class="cfts-from">From</span>'), min.parentNode, min); }
      if (max) { j.attr(max, 'placeholder', '3500'); j.attr(max, 'aria-label', 'To difficulty'); }
      j.insert(j.make('<div class="cfts-scale"><div class="bar"><i style="background:var(--cf-rank-gray)"></i><i style="background:var(--cf-rank-green)"></i><i style="background:var(--cf-rank-cyan)"></i><i style="background:var(--cf-rank-blue)"></i><i style="background:var(--cf-rank-violet)"></i><i style="background:var(--cf-rank-orange)"></i><i style="background:var(--cf-rank-red)"></i></div><div class="lbl"><span>Easy</span><span>Medium</span><span>Hard</span><span>Very hard</span></div></div>'), diff.parentNode, diff.nextSibling);
    }
    /* topics: group label, the switch, then Codeforces' Add tag */
    const add = box.querySelector('._FilterByTagsFrame_addTag');
    const sw = box.querySelector('.cfts-topics');
    if (add) {
      j.insert(j.make('<div class="cfts-group">Topics</div>'), add.parentNode, box.querySelector('._FilterByTagsFrame_tagBoxes') || add);
      if (sw) j.move(sw, add.parentNode, box.querySelector('._FilterByTagsFrame_tagBoxes') || add);
      const link = add.querySelector('a, ._FilterByTagsFrame_addTagLink');
      const lt = link && (textChild(link, /Add\s*tag|Добавить/));
      if (lt) { j.text(lt, 'Add a topic…'); j.cls(link, 'cfts-addtopic'); }
    }
    const apply = box.querySelector('._FilterByTagsFrame_button input, input[type="submit"]');
    if (apply) {
      j.cls(apply, 'cfts-primary-input');
      j.cls(apply.parentNode, 'cfts-actions');
      j.insert(j.make('<a class="cfts-btn quiet cfts-reset" href="/problemset">Reset</a>'), apply.parentNode);
    }
  }

  /* the topics switch: off by default (a topic can give the solution away) */
  function topicsSwitch(j, box) {
    if (!box) return;
    const sw = j.make(`<div class="cfts-topics"><button type="button" class="cfts-switch" role="switch" aria-checked="false"><span>Show topics</span><i></i></button>
      <p>Off by default: a topic can give the solution away. The difficulty always shows. If your Codeforces settings hide tags, they stay hidden.</p></div>`);
    const cap = box.querySelector(':scope > .caption');
    j.insert(sw, box, cap ? cap.nextSibling : box.firstChild);
    const btn = sw.querySelector('button');
    j.on(btn, 'click', toggleTopics);
  }
  /* every topics control is a toggle: the switch, the header's Show/Hide, the sidebar's Show/Hide topics */
  const toggleTopics = () => chrome.storage.local.set({ cfTopics: root.getAttribute('data-cf-topics') !== 'on' });
  function syncTopics(on) {
    if (on) root.setAttribute('data-cf-topics', 'on'); else root.removeAttribute('data-cf-topics');
    document.querySelectorAll('.cfts-switch').forEach((b) => b.setAttribute('aria-checked', String(!!on)));
    document.querySelectorAll('.cfts-showtopics').forEach((b) => {
      b.textContent = (on ? 'Hide' : 'Show') + (b.hasAttribute('data-long') ? ' topics' : '');
      b.setAttribute('aria-pressed', String(!!on));
    });
  }

  /* ===================== GUIDED: Problem =================================== */
  function problemPage(j) {
    const ps = document.querySelector('.problemindexholder .problem-statement');
    const hdr = ps && ps.querySelector(':scope > .header');
    if (!hdr) return;
    j.attr(root, 'data-cfts-page', 'problem');
    const idx = (ps.closest('.problemindexholder') || {}).getAttribute ? ps.closest('.problemindexholder').getAttribute('problemindex') : '';
    const contestA = document.querySelector('#sidebar .rtable th a');
    const contest = contestA ? contestA.textContent.trim() : '';
    const phase = document.querySelector('#sidebar .contest-state-phase');
    /* crumb: division · contest · problem */
    const crumb = j.make(`<div class="cfts-crumb"><a href="${esc(contestA ? contestA.getAttribute('href') : '#')}">${esc(contest)}</a><span>· Problem ${esc(idx || '')}${phase ? ' · ' + esc(phase.textContent.trim().toLowerCase()) : ''}</span></div>`);
    const b = divBadge(j, contest);
    if (b) crumb.insertBefore(b, crumb.firstChild);
    j.insert(crumb, hdr, hdr.firstChild);
    /* rating + topics from Codeforces' own tag boxes */
    const tagBoxes = [...document.querySelectorAll('#sidebar .tag-box')];
    const ratingTag = tagBoxes.find((t) => /^\*\d+$/.test(t.textContent.trim()));
    const r = ratingTag ? parseInt(ratingTag.textContent.trim().slice(1), 10) : 0;
    const topics = tagBoxes.filter((t) => t !== ratingTag).map((t) => t.textContent.trim());
    /* limits: "2 seconds per test", "256 megabytes", "standard input / output";
       Codeforces' labels become the chips' tooltips */
    const lim = (sel, tip, fn) => {
      const el = hdr.querySelector(sel); if (!el) return null;
      const t = textChild(el); j.cls(el, 'cfts-lim'); j.attr(el, 'data-cfts-tip', tip);
      if (t && fn) j.text(t, fn(t.nodeValue.trim()));
      return el;
    };
    const tl = lim('.time-limit', 'Time limit per test', (v) => v + ' per test');
    if (tl) j.insert(j.make(`<span class="cfts-ico">${ICON.clock}</span>`), tl, tl.querySelector('.property-title').nextSibling);
    lim('.memory-limit', 'Memory limit per test');
    const inp = hdr.querySelector('.input-file'), out = hdr.querySelector('.output-file');
    if (inp && out && /standard input/i.test(inp.textContent) && /standard output/i.test(out.textContent)) {
      lim('.input-file', 'Reads standard input, writes standard output', () => 'standard input / output');
      j.cls(inp, 'cfts-plain'); j.cls(out, 'cfts-hidden');
    } else { lim('.input-file', 'Input'); lim('.output-file', 'Output'); j.cls(inp, 'cfts-io-file'); j.cls(out, 'cfts-io-file'); }
    /* the epigraph's source: a lone symbol (here "ඞ") is decoration, not a credit */
    const src = ps.querySelector('.epigraph-source');
    if (src && src.textContent.trim().length <= 2) j.cls(src, 'cfts-hidden');
    const meta = j.make('<div class="cfts-pmeta"></div>');
    meta.appendChild(ratingBadge(j, r));
    j.insert(meta, hdr, hdr.querySelector('.time-limit'));
    if (topics.length) {
      const tl = j.make(`<div class="cfts-ptopics"><span class="lbl">Topics</span><span class="hid">${topics.length} topic${topics.length > 1 ? 's' : ''} hidden</span>
        ${topics.map((t) => `<span class="cfts-chip t">${esc(t)}</span>`).join('')}<button type="button" class="cfts-showtopics" aria-pressed="false">Show</button></div>`);
      j.insert(tl, hdr);
      j.on(tl.querySelector('button'), 'click', toggleTopics);
    }
    /* signed in: your latest verdict, from Codeforces' "Last submissions" box (CONFIRM) */
    const last = [...document.querySelectorAll('#sidebar .roundbox')].find((x) => x.querySelector('a[href*="/submission/"]') && x.querySelector('[class*="verdict-"]'));
    if (last) {
      const v = last.querySelector('[class*="verdict-"]');
      const ok = /verdict-accepted/.test(v.className);
      j.insert(j.make(`<div class="cfts-mine"><span class="cfts-chip ${ok ? 'ok' : 'warn'}">${ok ? ICON.check + ' Solved' : 'Tried · ' + esc(v.textContent.trim())}</span></div>`), hdr);
    }
    /* actions: Submit (primary) + Codeforces' own materials and tabs as secondaries */
    const acts = j.make('<div class="cfts-pact"></div>');
    /* Submit opens Codeforces' submit page with THIS problem selected (Phase 5.5;
       never the sidebar's form):
         /problemset/problem/N/X -> /problemset/submit/N/X
         /contest/N/problem/X    -> /contest/N/submit/X
         /gym/N/problem/X        -> /gym/N/submit/X */
    let href = (document.querySelector('.second-level-menu-list a[href$="/submit"]') || {}).getAttribute ? document.querySelector('.second-level-menu-list a[href$="/submit"]').getAttribute('href') : '/problemset/submit';
    const m = PATH.match(/^\/(problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?(\w+)/);
    if (m) href = m[1] === 'problemset/problem' ? `/problemset/submit/${m[2]}/${m[3]}` : `/${m[1]}/${m[2]}/submit/${m[3]}`;
    const sub = j.make(`<a class="cfts-btn primary xl" href="${esc(href)}">${ICON.send} Submit</a>`);
    acts.appendChild(sub);
    const mats = [...document.querySelectorAll('#sidebar .sidebar-menu li a')];
    const matName = (a) => (a.childNodes[0] ? a.childNodes[0].textContent : a.textContent).trim();
    const isTut = (a) => /tutorial|editorial|разбор/i.test(matName(a));
    const matIco = (a) => (isTut(a) ? ICON.book : /announcement|анонс/i.test(matName(a)) ? ICON.mega : '');
    const ordered = [...mats.filter(isTut), ...mats.filter((a) => !isTut(a))];
    if (mats.length) acts.insertAdjacentHTML('beforeend', `<div class="sec">${ordered.slice(0, 2).map((a) => `<a class="cfts-btn quiet" href="${esc(a.getAttribute('href'))}" target="_blank">${matIco(a)} ${esc(matName(a))}</a>`).join('')}</div>`);
    const tabs = ['status', 'standings'].map((t) => document.querySelector(`.second-level-menu-list a[href$="/${t}"]`)).filter(Boolean);
    if (tabs.length) acts.insertAdjacentHTML('beforeend', `<div class="sec">${tabs.map((a) => `<a class="cfts-btn ghost" href="${esc(a.getAttribute('href'))}">${esc(a.textContent.trim())}</a>`).join('')}</div>`);
    acts.querySelectorAll('*').forEach((el) => el.setAttribute('data-cfts', ''));
    j.insert(acts, hdr);
    /* the sidebar's tag box: hidden unless topics are on */
    const tagBox = (tagBoxes[0] || document.createElement('i')).closest('#sidebar > .roundbox');
    if (tagBox) {
      j.cls(tagBox, 'cfts-tagbox');
      const cap = tagBox.querySelector(':scope > .caption');
      j.text(textChild(cap, /Problem tags/), '→ Problem topics');
      const hint = j.make('<div class="cfts-taghint"><p>Hidden: a topic can give the solution away.</p><button type="button" class="cfts-showtopics" data-long aria-pressed="false">Show topics</button></div>');
      j.insert(hint, tagBox, cap ? cap.nextSibling : tagBox.firstChild);
      j.on(hint.querySelector('button'), 'click', toggleTopics);
    }
    problemSidebar(j, mats, matName, matIco);
  }

  /* the problem's sidebar: one Contest card (badge, name, phase, materials),
     "Practise it like a contest" in a few words (Codeforces' text behind More) */
  function problemSidebar(j, mats, matName, matIco) {
    const th = document.querySelector('#sidebar > .roundbox .rtable th a[href^="/contest/"], #sidebar > .roundbox .rtable th a[href^="/gym/"]');
    const card = th && th.closest('#sidebar > .roundbox');
    if (card) {
      j.cls(card, 'cfts-pcontest');
      j.insert(j.make('<div class="cfts-sidecap">Contest</div>'), card, card.firstChild);
      const b = divBadge(j, th.textContent);
      if (b) { const w = j.make('<div class="cfts-pcbadge"></div>'); w.appendChild(b); j.insert(w, card, card.querySelector('.rtable')); }
      const menu = mats.length && mats[0].closest('#sidebar > .roundbox');
      if (menu) {
        const box = j.make('<div class="cfts-mat"></div>');
        j.insert(box, card);
        mats.forEach((a) => {
          j.insert(j.make(`<span class="cfts-ico">${matIco(a) || ICON.book}</span>`), a, a.firstChild);
          const loc = a.querySelector('.resource-locale'); if (loc) j.cls(loc, 'cfts-hidden');
          j.move(a, box);
        });
        j.cls(menu, 'cfts-hidden');
      }
    }
    const vf = document.querySelector('#sidebar .ContestVirtualFrame');
    if (vf) {
      j.cls(vf, 'cfts-virtual');
      const cap = vf.querySelector(':scope > .caption');
      j.text(textChild(cap, /Virtual participation|Виртуальное участие/), '→ Practise it like a contest ');
      const long = vf.querySelector('div[style*="font-size:0.8em"]');
      if (long) {
        j.cls(long, 'cfts-long');
        j.attr(vf, 'data-cfts-open', 'false');
        const short = j.make('<div class="cfts-short"><p>A <b>virtual contest</b> replays this round with its original time, as close as possible to taking part live. Only if you haven\'t seen its problems yet.</p><button type="button" class="cfts-more-btn" aria-expanded="false">More</button></div>');
        j.insert(short, long.parentNode, long);
        const btn = short.querySelector('button');
        j.on(btn, 'click', () => { const open = vf.getAttribute('data-cfts-open') !== 'true'; vf.setAttribute('data-cfts-open', String(open)); btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Less' : 'More'; });
      }
      const go = vf.querySelector('input[type="submit"]');
      if (go) j.cls(go, 'cfts-quiet-input', 'cfts-full');
    }
  }

  /* ===================== shared sidebar (Home, Profile, Blog) ================ */
  /* "Pay attention" becomes "Upcoming contest" (first; countdown + Register),
     then Top rated, Top contributors, Recent actions; Codeforces' "Find user"
     stays, last */
  function communitySidebar(j) {
    const side = document.getElementById('sidebar');
    if (!side) return;
    j.cls(side, 'cfts-community');
    meBox(j);
    const pay = payCard(j);
    if (pay) {
      const cap = pay.querySelector('.caption');
      j.text(textChild(cap, /Pay attention|Внимание/i), '→ Upcoming contest ');
      j.cls(pay, 'cfts-upcoming');
      const reg = pay.querySelector('a[href^="/contestRegistration/"]');
      j.text(textChild(reg, /Register now/), 'Register');
      const inner = pay.querySelector('div[style*="text-align:center"]') || pay;
      j.insert(j.make('<a class="cfts-btn ghost wide cfts-allc" href="/contests">All contests →</a>'), inner);
      if (side.firstElementChild !== pay) j.move(pay, side, side.firstElementChild);
    }
    const find = [...side.querySelectorAll(':scope > .roundbox')].find((b) => b.querySelector('form.handleForm, input[name="handle"]'));
    if (find && find !== side.lastElementChild) j.move(find, side, null);
    if (find) j.cls(find, 'cfts-finduser');
    const ra = side.querySelector('.recent-actions');
    if (ra) j.cls(ra.closest('.roundbox'), 'cfts-recent');
  }

  /* the signed-in personal box (titled with your handle): a card with a
     header (photo, handle in rank colour, rating) and the links as a compact
     row of quiet links. Found by content, not by exact markup. */
  function findMeBox() {
    const me = myHandle();
    if (!me) return null;
    /* the caption is a link to your profile on some pages and plain text ("→ Vinaytz") on others, where the handle
       link sits under the photo (.personal-sidebar .avatar): Codeforces' server HTML, signed in, Oct 2026 */
    const mine = (a) => a && (a.getAttribute('href') || '').split('/')[2].toLowerCase() === me.toLowerCase();
    return [...document.querySelectorAll('#sidebar > .roundbox')].find((b) =>
      mine(b.querySelector(':scope > .caption a[href^="/profile/"]')) || mine(b.querySelector(':scope > .personal-sidebar .avatar a[href^="/profile/"].rated-user'))) || null;
  }
  function meBox(j) {
    const box = findMeBox();
    if (!box || box.classList.contains('cfts-mebox')) return;
    j.cls(box, 'cfts-mebox');
    const cap = box.querySelector(':scope > .caption');
    const handleA = cap.querySelector('a[href^="/profile/"]') || box.querySelector('.personal-sidebar .avatar a[href^="/profile/"].rated-user');
    const img = [...box.querySelectorAll('img')].find((i) => !/\/flags\/|icons\//.test(i.getAttribute('src') || ''));
    const lists = [...box.querySelectorAll('ul')];
    const stats = lists.find((u) => /rating|рейтинг/i.test(u.textContent));
    const links = lists.find((u) => u.querySelector('a[href*="/settings"]')) || lists.find((u) => u !== stats);
    const head = j.make('<div class="cfts-mehead"><div class="who"></div></div>');
    j.insert(head, box, cap.nextSibling);
    if (img) j.move(img.closest('a') || img, head, head.firstChild);
    if (handleA) j.move(handleA, head.querySelector('.who'));
    if (stats) { j.cls(stats, 'cfts-mestats'); j.move(stats, head.querySelector('.who')); }
    j.cls(cap, 'cfts-hidden');
    if (links) j.cls(links, 'cfts-melinks');
  }

  /* ===================== GUIDED: Home ====================================== */
  /* contest announcements get division badges ("Round N", Educational);
     parallel Div. 1 / Div. 2 rounds get both */
  function postBadges(j, title) {
    if (!/\bround\s+\d+|educational|раунд\s+\d+|образовательн/i.test(title)) return [];
    if (division(title) !== 'all' && /div\. ?1\b/i.test(title) && /div\. ?2\b/i.test(title))
      return [divBadge(j, 'Div. 1'), divBadge(j, 'Div. 2')].filter(Boolean);
    const b = divBadge(j, title);
    return b ? [b] : [];
  }
  function homePage(j) {
    j.attr(root, 'data-cfts-page', 'home');
    const pc = document.getElementById('pageContent');
    if (!pc) return;
    const first = pc.querySelector(':scope > div > .topic');
    if (first) j.insert(j.make('<h2 class="cfts-feedhead">Latest posts <span>announcements, editorials and community posts</span></h2>'), pc, first.parentNode);
    for (const t of pc.querySelectorAll(':scope > div > .topic')) {
      j.cls(t.parentNode, 'cfts-post');
      const title = t.querySelector(':scope > .title');
      const ta = title && title.querySelector('a');
      if (ta) for (const b of postBadges(j, ta.textContent)) j.insert(b, title, ta);
      /* "By _O_v_O_, history, 16 hours ago," -> "_O_v_O_ · history · 16 hours ago" */
      const info = t.querySelector(':scope > .info');
      if (info) for (const n of [...info.childNodes]) {
        if (n.nodeType !== 3) continue;
        if (/^\s*By\s*$/.test(n.nodeValue) || /^\s*Автор\s*$/.test(n.nodeValue)) j.text(n, '');
        else if (/^\s*,\s*$/.test(n.nodeValue)) j.text(n, ' · ');
      }
      const more = t.querySelector('.topic-read-more');
      j.text(textChild(more, /Full text|Читать/), 'Read more →');
      const meta = t.querySelector(':scope > .roundbox.meta');
      if (meta) {
        j.cls(meta, 'cfts-pmeta-row');
        const lis = [...meta.querySelectorAll('.right-meta li')];
        for (const li of lis) {
          const c = [...li.querySelectorAll('a[href$="#comments"]')].pop();   // the count (the first one wraps the icon)
          if (c) {
            const tn = textChild(c);
            if (tn) j.text(tn, tn.nodeValue.trim() + ' comments');
            j.cls(li, 'cfts-comments');
          } else j.cls(li, 'cfts-hidden');       // author and date repeat the info line
        }
      }
    }
    communitySidebar(j);
    /* "New to Codeforces?": signed out, until dismissed (remembered) */
    if (!root.hasAttribute('data-cf-signed')) {
      chrome.storage.local.get('cfNewbieDismissed', (r) => {
        if ((r && r.cfNewbieDismissed) || !guided.applied || j !== guided || pc.querySelector('.cfts-newbie')) return;
        const card = j.make(`<div class="cfts-newbie" role="region" aria-label="New to Codeforces?"><div class="nbh"><div><div class="cfts-kicker">New to Codeforces?</div>
          <div class="nbt">Three steps to get started</div></div><button type="button" class="x" aria-label="Dismiss" data-cfts-tip="Dismiss">${ICON.x}</button></div>
          <ol class="steps">
          <li><span class="sn">1</span><span class="st">Solve Easy problems <span class="faint">(800–1300)</span></span><a class="cfts-btn quiet" href="/problemset?tags=800-1300">Problemset · 800–1300 →</a></li>
          <li><span class="sn">2</span><span class="st">Join a <span class="cfts-div" style="--c:var(--cf-rank-green)"><b>Div. 4</b></span> or <span class="cfts-div" style="--c:var(--cf-rank-cyan)"><b>Div. 3</b></span> round</span><a class="cfts-btn quiet" href="/contests">Contests →</a></li>
          <li><span class="sn">3</span><span class="st">Learn the basics</span><a class="cfts-btn quiet" href="/edu/courses">EDU →</a></li></ol></div>`);
        j.insert(card, pc, pc.querySelector(':scope > .cfts-feedhead') || pc.firstElementChild);
        j.on(card.querySelector('.x'), 'click', () => { chrome.storage.local.set({ cfNewbieDismissed: true }); card.remove(); });
      });
    }
  }

  /* ===================== GUIDED: Gym ======================================= */
  /* each training is a card: name, metadata chips, a labelled difficulty chip
     made from the stars, Enter (primary) with Virtual and Standings quiet */
  /* Codeforces' own words for its 1-5 stars (its filter's titles) */
  const GYM_WORDS = [null, ['Very easy', 'green'], ['Easy', 'cyan'], ['Medium', 'blue'], ['Hard', 'orange'], ['Very hard', 'red']];
  function gymsPage(j) {
    j.attr(root, 'data-cfts-page', 'gyms');
    const dt = document.querySelector('#pageContent .datatable');
    const table = dt && dt.querySelector('table');
    if (!table) return;
    const cap = dt.querySelector(':scope > .rb + div');
    j.text(textChild(cap, /Trainings|Тренировки/), 'Gym ');
    if (cap) j.insert(j.make('<p class="cfts-lede">Training contests from ICPC regionals, olympiads and schools. Open one to practise, or replay it as a virtual contest.</p>'), cap.parentNode, cap.nextSibling);
    const head = table.rows[0];
    if (head) j.cls(head, 'cfts-hidden');
    j.insert(j.make('<div class="cfts-ghead"><span>Training</span><span>Difficulty</span><span></span></div>'), table.parentNode, table);
    [...table.rows].slice(1).forEach((tr) => {
      if (tr.cells.length < 5) return;
      const [nameTd, startTd, lenTd, stateTd, infoTd] = tr.cells;
      j.cls(tr, 'cfts-gym');
      j.cls(nameTd, 'cfts-gname'); j.cls(startTd, 'cfts-gstart'); j.cls(lenTd, 'cfts-glen'); j.cls(stateTd, 'cfts-gacts'); j.cls(infoTd, 'cfts-ginfo');
      /* the date and length join the detail chips: one line that wraps from
         the left edge (their own cells are emptied and hidden) */
      j.cls(startTd, 'cfts-hidden'); j.cls(lenTd, 'cfts-hidden');
      const lenChip = j.make(`<span class="cfts-chip plain cfts-glen"><span class="cfts-ico">${ICON.clock}</span></span>`);
      j.insert(lenChip, infoTd, infoTd.firstChild);
      for (const n of [...lenTd.childNodes]) j.move(n, lenChip);
      if (startTd.textContent.trim() !== '-') {
        const startChip = j.make(`<span class="cfts-chip plain cfts-gstart"><span class="cfts-ico">${ICON.cal}</span></span>`);
        j.insert(startChip, infoTd, lenChip);
        for (const n of [...startTd.childNodes]) j.move(n, startChip);
      }
      /* actions: Enter (primary), Virtual, Standings, in one row */
      const links = [...nameTd.querySelectorAll(':scope > a')];
      for (const a of links) {
        const virt = /virtual/i.test(a.getAttribute('href'));
        j.cls(a, 'cfts-btn', virt ? 'quiet' : 'primary');
        j.text(textChild(a), virt ? 'Virtual' : 'Enter');
        j.move(a, stateTd, stateTd.firstChild);
      }
      if (links[1]) j.move(links[1], stateTd, links[0].nextSibling);
      const st = stateTd.querySelector('a[href$="/standings"]');
      if (st) { j.cls(st, 'cfts-btn', 'quiet'); j.text(textChild(st, /standings/i), 'Standings'); }
      /* the metadata lines become chips; "Prepared by" is the by-line */
      for (const d of infoTd.querySelectorAll(':scope > div.small')) {
        const t = d.textContent.replace(/\s+/g, ' ').trim();
        if (/^Prepared by|^Подготовил/.test(t)) {
          j.cls(d, 'cfts-gby'); j.text(textChild(d, /Prepared by/), 'by ');
          /* our cells go BEFORE Codeforces' last cell: its datatable script marks
             the first and last cells (left / right borders) after we run */
          const byTd = j.make('<td class="cfts-gbycell"></td>'); j.insert(byTd, tr, infoTd); j.move(d, byTd);
          continue;
        }
        j.cls(d, 'cfts-chip', 'plain');
        if (/^Official ICPC/.test(t)) { j.cls(d, 'kind', 'icpc'); j.text(textChild(d), 'Official ICPC'); }
        else if (/^Official School/.test(t)) { j.cls(d, 'kind'); j.text(textChild(d), 'School'); }
        else if (/^Training Contest/.test(t)) { j.cls(d, 'kind'); j.text(textChild(d), 'Training'); }
        else if (/^Statements:/.test(t)) { j.cls(d, 'lang'); j.text(textChild(d, /Statements/), t.replace(/^Statements:\s*/, '').replace(/\bin /g, '')); j.insert(j.make(`<span class="cfts-ico">${ICON.lang}</span>`), d, d.firstChild); }
        else if (!/description/i.test(t)) { j.cls(d, 'place'); j.insert(j.make(`<span class="cfts-ico">${ICON.pin}</span>`), d, d.firstChild); }
      }
      /* the stars -> a difficulty chip (Codeforces' own description as the tooltip) */
      const stars = infoTd.querySelector(':scope > div[title]');
      const n = stars ? stars.querySelectorAll('img').length : 0;
      const w = GYM_WORDS[n];
      const chip = w
        ? `<span class="cfts-rate cfts-gdiff" style="--c:var(--cf-rank-${w[1]})" tabindex="0" data-cfts-tip="${esc(n + '★ · ' + w[0] + '\n' + (stars.getAttribute('title') || ''))}"><span class="stars">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(5 - n)}</span><span class="w">${w[0]}</span></span>`
        : '<span class="cfts-rate none" tabindex="0" data-cfts-tip="Not rated\nThe authors gave this training no difficulty."><span class="n">Not rated</span></span>';
      const td = j.make(`<td class="cfts-gdcell">${chip}</td>`);
      j.insert(td, tr, infoTd);
      if (stars) j.cls(stars, 'cfts-hidden');
    });
    gymFilter(j);
  }
  function gymFilter(j) {
    const form = document.getElementById('gym-filter-form');
    if (!form) return;
    const box = form.closest('.roundbox');
    j.cls(box, 'cfts-filterbox', 'cfts-gymfilter');
    j.text(textChild(box.querySelector('.caption'), /Training filter/i), '→ Filter trainings ');
    const names = [...form.querySelectorAll('.setting-name')];
    const at = (re) => names.find((n) => re.test(n.textContent));
    for (const [re, label] of [[/Season/i, 'When'], [/Contest type/i, 'What'], [/Duration/i, 'How long, how hard'], [/^\s*Order by/i, 'Order']]) {
      const n = at(re);
      if (n) j.insert(j.make(`<div class="cfts-group">${label}</div>`), n.parentNode, n);
    }
    for (const n of names) {
      const t = textChild(n) || textChild(n.querySelector('label'));
      if (t && /:\s*$/.test(t.nodeValue)) j.text(t, t.nodeValue.replace(/:\s*$/, '').replace('Secondary order by', 'Then by'));
    }
    const btn = form.querySelector('input[type="submit"]');
    if (btn) {
      j.cls(btn, 'cfts-primary-input');
      j.cls(btn.parentNode, 'cfts-actions');
      j.insert(j.make('<a class="cfts-btn quiet cfts-reset" href="/gyms">Reset</a>'), btn.parentNode);
    }
    const side = document.getElementById('sidebar');
    if (side) j.insert(j.make(`<div class="roundbox sidebox cfts-explainer"><div class="caption titled">→ What is the Gym?</div>
      <div class="body"><p>Past contests from ICPC regionals, olympiads and schools, added for practice. They are <b>unrated</b>: your rating never changes here.</p></div></div>`), side);
  }

  /* ===================== GUIDED: Standings ================================= */
  /* CSS does the cells (accepted / rejected / untried from Codeforces' own
     attributes) and the sticky header. Here, once per page: the badge, the
     column labels, "Jump to me" when your row is on the page, and, only when
     the table is wider than its card, a scroll box with a sticky first column.
     Nothing per row; rows are never hidden or collapsed. */
  function standingsPage(j) {
    j.attr(root, 'data-cfts-page', 'standings');
    const table = document.querySelector('table.standings');
    if (!table) return;
    const name = document.querySelector('.contest-name');
    if (name) {
      j.cls(name.parentNode, 'cfts-sthead');
      const b = divBadge(j, name.textContent); if (b) j.insert(j.make('<div class="cfts-stbadge"></div>'), name.parentNode, name).appendChild(b);
    }
    const cap = document.querySelector('#pageContent .datatable > .rb + div');
    if (cap) j.cls(cap, 'cfts-stcap');
    const unoff = document.querySelector('#pageContent form.toggle-show-unofficial');
    if (unoff) j.cls(unoff.parentNode, 'cfts-unoff');
    const head = table.rows[0];
    if (head) for (const th of head.cells) {
      const t = textChild(th);
      if (t && t.nodeValue.trim() === '=') { j.text(t, 'Solved'); j.attr(th, 'data-cfts-tip', 'Problems solved'); }
      else if (t && t.nodeValue.trim() === '*') j.text(t, 'Hacks');
    }
    const me = table.querySelector('tr.highlighted-row');
    if (me) {
      const btn = j.make('<a class="cfts-btn quiet cfts-jump" href="#" role="button">Jump to me</a>');
      const anchorEl = document.querySelector('#pageContent .datatable') || table;
      j.insert(btn, anchorEl.parentNode, anchorEl);
      j.on(btn, 'click', (e) => { e.preventDefault(); me.scrollIntoView({ block: 'center' }); });
    }
    /* wider than its card: its own scroll box with a sticky header; the sticky
       first column only up to 1,500 rows (a sticky cell per row is costly on
       a huge table: 10,000 rows scrolled at ~75 ms a frame) */
    const sheet = table.parentNode;
    const rows = table.rows.length;
    const setWide = () => { j.attr(table, 'data-cfts-wide', rows <= 1500 ? 'sticky' : ''); j.cls(sheet, 'cfts-stscroll'); };
    /* decided now, with the other writes, from the problem-column count and
       the window width (no layout read), so it costs no extra pass: ~560 px of
       fixed columns, ~64 px a problem, in a card of min(window, 1200) - 70.
       After the first frame (layout clean, reading is free) a measurement
       corrects a wrong guess. */
    const probs = head ? head.querySelectorAll('th a[href*="/problem/"]').length : 0;
    const guessWide = 560 + 64 * probs > Math.min(window.innerWidth, 1240) - 70;
    if (sheet && guessWide) setWide();
    afterFirstFrame(() => {
      if (!guided.applied || !sheet || table.hasAttribute('data-cfts-wide')) return;
      if (table.scrollWidth > sheet.clientWidth + 2) setWide();
    });
  }

  /* ===================== GUIDED: Profile =================================== */
  /* a header card (avatar, handle, rank, labelled facts), stat tiles from the
     numbers the page shows (solved, current streak from the calendar's own
     data, best streak), the graph and the calendar in their own cards */
  function profilePage(j) {
    j.attr(root, 'data-cfts-page', 'profile');
    const box = document.querySelector('#pageContent .userbox');
    if (!box) return;
    j.cls(box, 'cfts-phead');
    /* Codeforces' roundbox around the header and the tiles is a frame around cards (box in a box): Guided drops its frame */
    const wrap = box.parentElement && box.parentElement.closest('#pageContent .roundbox');
    if (wrap) j.cls(wrap, 'cfts-pwrap');
    const LBL = [[/Contest rating|Рейтинг/, 'Rating'], [/Contribution|Вклад/, 'Contribution'], [/Friend of|друзьях/, 'Friend of'],
      [/Last visit|Был/, 'Last visit'], [/Registered|Зарегистрирован/, 'Registered']];
    for (const li of box.querySelectorAll('.info ul > li')) {
      const tn = [...li.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
      const hit = tn && LBL.find(([re]) => re.test(tn.nodeValue));
      if (!hit) { j.cls(li, 'cfts-plinks'); if (li.querySelector('a[href*="usertalk"]')) j.cls(li, 'cfts-pmsg'); continue; }
      j.cls(li, 'cfts-fact');
      const label = hit[1];
      if (label === 'Friend of') {
        const n = (tn.nodeValue.match(/\d+/) || [''])[0];
        j.text(tn, '');
        j.insert(j.make(`<b class="cfts-fval">${n ? fmt(n) : ''} <span>users</span></b>`), li);
      } else j.text(tn, tn.nodeValue.replace(/^[^:]*:/, ''));
      j.insert(j.make(`<span class="cfts-flbl">${label}</span>`), li, li.firstChild);
      /* the max rating becomes its own fact: "Max rating 4009 · tourist" */
      const max = label === 'Rating' && li.querySelector(':scope > .smaller');
      if (max) {
        const mli = j.make('<li class="cfts-fact cfts-max"><span class="cfts-flbl">Max rating</span></li>');
        j.insert(mli, li.parentNode, li.nextSibling);
        j.move(max, mli);
        for (const n of [...max.childNodes]) if (n.nodeType === 3) j.text(n, n.nodeValue.replace(/\(\s*max\.\s*|\)/g, '').replace(/\s+/g, ' '));
        const title = max.querySelector('span');
        const ttn = title && textChild(title);
        if (ttn && /,\s*$/.test(ttn.nodeValue)) j.text(ttn, ttn.nodeValue.replace(/,\s*$/, ''));
        if (title && max.lastElementChild !== title) j.move(title, max);   // number first, then the rank title
      }
    }
    /* your own profile: the owner-only rows (friends, settings, the email,
       "start your own blog", comments) as one small muted row, "Only you see
       this"; a link that repeats one already shown (Comments) is dropped */
    const me = myHandle(), owner = me && PATH.split('/')[2] && PATH.split('/')[2].toLowerCase() === me.toLowerCase();
    const ul = box.querySelector('.info > ul');
    if (owner && ul) {
      const OWN = /my friends|change settings|not visible|start your own blog|^\s*comments\s*$|мои друзья|изменить настройки|не видн|завести свой блог|^\s*комментарии\s*$/i;
      const own = [...ul.children].filter((li) => li.matches('li:not(.cfts-fact)') && OWN.test(li.textContent.replace(/\s+/g, ' ').trim()));
      if (own.length) {
        const row = j.make('<li class="cfts-ownrow"><span class="lbl">Only you see this</span></li>');
        j.insert(row, ul);
        const shown = new Set([...ul.querySelectorAll('li:not(.cfts-ownrow) a[href]')].filter((a) => !own.includes(a.closest('li'))).map((a) => a.getAttribute('href')));
        for (const li of own) {
          const hrefs = [...li.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
          j.cls(li, 'cfts-hidden');
          if (hrefs.length && hrefs.every((h) => shown.has(h))) continue;      // a duplicate (Comments)
          hrefs.forEach((h) => shown.add(h));
          const item = j.make(`<span class="cfts-ownitem${/not visible|не видн/i.test(li.textContent) ? ' email' : ''}"></span>`);
          j.insert(item, row);
          for (const n of [...li.childNodes]) j.move(n, item);
        }
      }
    }
    /* "Change photo | Unset photo": one small muted line under the photo */
    const pls = [...box.querySelectorAll('.title-photo a')].filter((a) => /change photo|unset photo|изменить фото|удалить фото/i.test(a.textContent));
    if (pls.length) {
      const wrap = j.make('<div class="cfts-photolinks"></div>');
      const first = pls[0], last = pls[pls.length - 1];
      j.insert(wrap, box.querySelector('.title-photo'));      // under the photo, whatever Codeforces' order
      let n = first;
      while (n) { const next = n.nextSibling; j.move(n, wrap); if (n === last) break; n = next; }
    }
    /* stat tiles */
    const counters = [...document.querySelectorAll('._UserActivityFrame_counterValue')].map((e) => e.textContent.trim());
    if (counters.length >= 6) {
      const num = (t) => (t.match(/\d+/) || ['0'])[0];
      const cur = currentStreak();
      const tiles = j.make(`<div class="cfts-tiles">
        <div class="cfts-tile"><span class="ti">${ICON.check}</span><div><div class="tv">${fmt(num(counters[0]))}</div><div class="tl">problems solved</div>
          <div class="ts">${fmt(num(counters[1]))} in the last year · ${fmt(num(counters[2]))} in the last month</div></div></div>
        <div class="cfts-tile"><span class="ti">${ICON.flame}</span><div><div class="tv">${cur ? cur.days : '–'} <small>days</small></div><div class="tl">current streak</div>
          <div class="ts">${cur && cur.last ? 'last active ' + cur.last : 'from the activity calendar'}</div></div></div>
        <div class="cfts-tile"><span class="ti">${ICON.trophy}</span><div><div class="tv">${num(counters[3])} <small>days</small></div><div class="tl">best streak</div>
          <div class="ts">${esc(counters[4])} in the last year · ${esc(counters[5])} in the last month</div></div></div></div>`);
      j.insert(tiles, box.parentNode, box.nextSibling);
    }
    const graph = document.getElementById('usersRatingGraphPlaceholder');
    const gbox = graph && graph.closest('.roundbox');
    if (gbox) { j.cls(gbox, 'cfts-pcard', 'cfts-graphcard'); j.insert(j.make('<h2 class="cfts-pch">Rating</h2>'), gbox, gbox.firstChild); }
    const abox = document.querySelector('._UserActivityFrame_frame .userActivityRoundBox');
    if (abox) {
      j.cls(abox, 'cfts-pcard');
      /* its stats footer: every number is in the tiles above */
      if (counters.length >= 6) j.cls(abox.querySelector('._UserActivityFrame_footer'), 'cfts-hidden');
      const g = abox.querySelector('#userActivityGraph');
      if (g) j.insert(j.make('<div class="cfts-callegend"><span>Less</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>More</span></div>'), g.parentNode, g.nextSibling);
    }
    communitySidebar(j);
  }
  /* the current streak: consecutive days up to today (or yesterday) with
     activity, read from the calendar's own data in the page's script */
  function currentStreak() {
    const sc = [...document.scripts].find((x) => x.textContent.includes('calendar_yearview_blocks'));
    if (!sc) return null;
    const days = new Set();
    for (const m of sc.textContent.matchAll(/"(\d{4}-\d{2}-\d{2})":\s*\{\s*items:\s*\[\s*(\d+)/g)) if (+m[2] > 0) days.add(m[1]);
    if (!days.size) return { days: 0, last: '' };
    const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const d = new Date();
    if (!days.has(key(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(key(d))) { n++; d.setDate(d.getDate() - 1); }
    const last = [...days].sort().pop();
    const [Y, M, D] = last.split('-').map(Number);
    return { days: n, last: new Date(Y, M - 1, D).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
  }

  /* ===================== GUIDED: Status / My submissions =================== */
  /* the table's look is core.css (pills, ellipsis, widths); here only the page
     title and, on your own submissions, the Who column goes (every row is you) */
  function myHandle() {
    const a = [...document.querySelectorAll('#header .lang-chooser a[href^="/profile/"]')].pop();
    return a ? a.getAttribute('href').split('/')[2] : '';
  }
  function statusPage(j) {
    j.attr(root, 'data-cfts-page', 'status');
    const table = document.querySelector('table.status-frame-datatable');
    if (!table) return;
    const dt = table.closest('.datatable');
    const cap = dt && dt.querySelector(':scope > .rb + div');
    const me = myHandle();
    const sub = PATH.match(/^\/submissions\/([^/]+)/);
    const mine = !!(sub && me && sub[1].toLowerCase() === me.toLowerCase());
    if (mine) j.attr(root, 'data-cfts-mine', '');
    const title = mine ? 'My submissions' : /^\/problemset\/status\/?$/.test(PATH) ? 'Status' : null;
    if (title) j.text(textChild(cap, /status|submissions|посылки|статус/i), title + ' ');
    const lede = mine ? 'Your submissions, newest first.' : /^\/problemset\/status\/?$/.test(PATH) ? 'Every submission to the problemset, newest first. Open an ID to see its code.' : '';
    if (cap && lede) j.insert(j.make(`<p class="cfts-lede">${lede}</p>`), cap.parentNode, cap.nextSibling);
    /* the problem as an ID chip + name: an approved exception to "no per-row
       JS": one pass at load over at most 50 rows, idempotent, journaled (Off
       puts the original text node back) */
    [...table.rows].slice(1, 51).forEach((tr) => {
      const a = tr.cells[3] && tr.cells[3].querySelector('a');
      if (!a || a.querySelector('.cfts-pid')) return;
      const tn = textChild(a, /^\s*\w+\s+-\s+/);
      if (!tn) return;
      const m = tn.nodeValue.match(/^(\s*)(\w+)\s+-\s+([\s\S]*)$/);
      if (!m) return;
      j.text(tn, m[3].replace(/\s+$/, ''));
      j.insert(j.make(`<span class="cfts-pid">${esc(m[2])}</span>`), a, tn);
    });
  }

  /* ===================== GUIDED: Blog entry ================================ */
  /* a readable article column, code blocks like the problem samples (with
     Copy), comments as threaded cards (CSS), the community sidebar */
  function blogPage(j) {
    j.attr(root, 'data-cfts-page', 'blog');
    const topic = document.querySelector('#pageContent .topic');
    if (topic) {
      j.cls(topic, 'cfts-article');
      const title = topic.querySelector(':scope > .title');
      const ta = title && title.querySelector('a, h3');
      if (ta) for (const b of postBadges(j, ta.textContent)) j.insert(b, title, title.firstChild);
      for (const pre of topic.querySelectorAll('.ttypography pre')) {
        if (pre.closest('.cfts-code')) continue;
        const wrap = j.make('<div class="cfts-code"><div class="sh"><span>Code</span><button type="button" class="cfts-copybtn">Copy</button></div></div>');
        j.insert(wrap, pre.parentNode, pre);
        j.move(pre, wrap);
        const btn = wrap.querySelector('button');
        j.on(btn, 'click', () => { navigator.clipboard.writeText(pre.innerText).then(() => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1200); }, () => {}); });
      }
    }
    communitySidebar(j);
  }

  /* ===================== ANIME WORLD (PLAN.md phase 2) ====================
     Anime Studio + Guided, never in a live contest: a cinematic
     banner per page (a crop of the scene, the English title in Dela Gothic and
     its Japanese subtitle), problems as episodes (第N話, the contest as the arc,
     危険度), the next contest as 次回予告, the profile as a character sheet, and
     the ambient motes. Japanese text is Dela Gothic One: every glyph must be in
     scripts/build-dela.py (the subset). Applied after the Guided layer, undone
     before it. */
  const BANNERS = { home: ['Home', 'ホーム', '50% 40%'], problemset: ['Problems', '問題集', '50% 68%'], contests: ['Contests', 'コンテスト', '50% 22%'],
    standings: ['Standings', '順位表', '30% 85%'], status: ['Status', '提出状況', '85% 60%'], profile: ['Profile', 'プロフィール', '18% 50%'],
    gyms: ['Gym', '道場', '70% 30%'], blog: ['Blog', 'ブログ', '40% 55%'] };
  const ARC_JP = { easy: ['日常編', 'rated up to 1300', '50% 58%'], medium: ['修行編', 'rated 1400–2300', '50% 32%'], hard: ['最終決戦', 'rated 2400 and up', '50% 30%'] };
  const danger = (r) => (r < 1200 ? 1 : r < 1600 ? 2 : r < 2000 ? 3 : r < 2500 ? 4 : 5);

  function applyWorld(j, theme) {
    j.applied = true;
    j.theme = theme;
    if (theme === 'paper') return paperWorld(j);
    if (theme === 'pixel') return globalThis.__cftsPixel.mount(j, globalThis.__cftsKit);
    const anime = globalThis.__cftsAnimeApp;
    if (anime && anime.mount(j, globalThis.__cftsKit)) return;   // its own screens (ANIME.md); other pages keep the world below, under its HUD
    j.cls(document.body, 'cfts-world');
    const page = root.getAttribute('data-cfts-page');
    if (page === 'problem') episode(j);
    else if (BANNERS[page]) pageBanner(j, page);
    if (page === 'contests') yokoku(j);
    if (page === 'profile') characterSheet(j);
    motes(j);
  }

  const WORLDS = new Set(['anime', 'paper', 'pixel']);

  /* ---- Vintage Paper's world: the editorial pages ---------------------------- */
  function paperWorld(j) {
    const page = root.getAttribute('data-cfts-page');
    /* the masthead's dateline; Home's nameplate carries its own */
    const head = document.getElementById('header');
    const nav = document.querySelector('.menu-list a');
    const locale = nav && /[А-Яа-я]/.test(nav.textContent) ? 'ru-RU' : 'en-GB';   // the interface's language, read from the page
    if (head && page !== 'home') j.insert(j.make(`<div class="cfts-dateline" aria-hidden="true">${esc(new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>`), head, null);
    if (page === 'home') {
      const pc = document.getElementById('pageContent');
      const posts = pc ? [...pc.querySelectorAll(':scope > .cfts-post')] : [];
      if (!posts.length) return;
      const today = new Date();
      const np = j.make(`<header class="cfts-np"><div class="top"><span>Competitive programming</span><span>${esc(today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span><span>codeforces.com</span></div>
        <div class="name">Codeforces</div><div class="sub">Announcements · Editorials · Rounds · Community</div></header>`);
      j.insert(np, pc, pc.firstElementChild);   // the nameplate tops the page; the welcome card goes under it
      /* the lead article; a drop cap only when its text starts with a Latin letter */
      j.cls(posts[0], 'cfts-lead');
      const tx = posts[0].querySelector('.content > .ttypography');
      const first = tx ? (tx.textContent.trim()[0] || '') : '';
      if (/[A-Za-z]/.test(first)) j.cls(posts[0], 'cfts-dropcap');
      /* the next three under column rules */
      const cols = j.make('<div class="cfts-cols"></div>');
      j.insert(cols, pc, posts[1] || null);
      for (const p of posts.slice(1, 4)) j.move(p, cols);
    } else if (page === 'problem') {
      /* the statement's drop cap: only a paragraph that opens with a plain letter (never maths) */
      const p = document.querySelector('.problem-statement > .legend > p, .problem-statement > div:not([class]) > p');
      const t = p && p.firstChild;
      if (t && t.nodeType === 3 && /^\s*[A-Za-z\u0400-\u04FF]/.test(t.data)) j.cls(p, 'cfts-dropcap');
    } else if (page === 'problemset') {
      /* before the table frame, never inside it: .datatable > .rb + div is the caption slot */
      const dt = document.querySelector('#pageContent .datatable');
      if (dt) j.insert(j.make('<div class="cfts-paper-kick">The Problem Archive</div>'), dt.parentNode, dt);
    }
  }

  function pageBanner(j, page) {
    const pc = document.getElementById('pageContent');
    const wrap = pc && pc.parentNode;
    if (!wrap || !wrap.parentNode) return;
    let [title, jp, pos] = BANNERS[page];
    if (page === 'status' && root.hasAttribute('data-cfts-mine')) title = 'My submissions';
    const b = j.make(`<div class="cfts-banner" style="--cfts-pos:${pos}"><div class="t">${esc(title)}</div><div class="jsub cfts-jp">「${jp}」</div></div>`);
    j.insert(b, wrap.parentNode, wrap);
    /* the page's own title and lede move into the banner */
    const lede = document.querySelector('.cfts-pagehead p, .cfts-pslede > p, #pageContent .cfts-lede');
    if (lede) j.move(lede, b);
    j.cls(document.querySelector('.cfts-pagehead h1'), 'cfts-hidden');
    const cap = document.querySelector('#pageContent .datatable > .rb + div');
    if (cap && /problemset|status|gyms/.test(page)) j.cls(cap, 'cfts-captext-off');
  }

  function episode(j) {
    const ps = document.querySelector('.problemindexholder .problem-statement');
    const hdr = ps && ps.querySelector(':scope > .header');
    if (!hdr) return;
    const idx = (ps.closest('.problemindexholder').getAttribute('problemindex') || (hdr.querySelector('.title') || {}).textContent || '').trim();
    const n = /^[A-Z]/.test(idx) ? idx.charCodeAt(0) - 64 : 0;
    const tag = [...document.querySelectorAll('#sidebar .tag-box')].map((t) => t.textContent.trim()).find((t) => /^\*\d+$/.test(t));
    const r = tag ? +tag.slice(1) : 0;
    const arc = r ? (globalThis.__cftsArcOf ? globalThis.__cftsArcOf(r) : (r <= 1300 ? 'easy' : r <= 2300 ? 'medium' : 'hard')) : null;
    const contestA = document.querySelector('#sidebar .rtable th a');
    j.cls(hdr, 'cfts-episode');
    if (arc) j.attr(hdr, 'style', `--cfts-pos:${ARC_JP[arc][2]}`);
    j.cls(hdr.querySelector('.cfts-crumb'), 'cfts-hidden');
    /* the scene's name comes first in the chip: anime.js publishes the scene it
       actually shows (your slot choice, or your own picture) as --cf-scene-name */
    const top = j.make(`<div class="cfts-eptop">${arc ? `<div class="cfts-arc"><span class="cfts-jp">${ARC_JP[arc][0]}</span><span class="cfts-chip cfts-scenechip">${ARC_JP[arc][1]}</span></div>` : ''}
      <div class="cfts-epn">${n ? `<span class="cfts-jp no">第${n}話</span>` : ''}${contestA ? `<a class="of" href="${esc(contestA.getAttribute('href'))}">${esc(contestA.textContent.trim())} <span class="cfts-jp">編</span></a>` : ''}</div></div>`);
    j.insert(top, hdr, hdr.firstChild);
    const meta = hdr.querySelector('.cfts-pmeta');
    if (meta && r) {
      const dz = danger(r), [, col] = rankOf(r);
      const m = j.make(`<span class="cfts-dwrap"><span class="cfts-jp">危険度</span><span class="cfts-danger" style="--c:var(--cf-rank-${col})" tabindex="0"
        data-cfts-tip="${esc(`危険度 ${dz}/5 · danger\nFrom the rating: 800–1100 one mark, 1200–1500 two, 1600–1900 three, 2000–2400 four, 2500+ five.`)}"><span class="m">${'<i class="on"></i>'.repeat(dz)}${'<i></i>'.repeat(5 - dz)}</span><span class="n">${dz}/5</span></span></span>`);
      j.insert(m, meta.parentNode, meta.nextSibling);
    }
  }

  /* the next contest is the next episode: 次回予告, its countdown with days,
     ticking seconds (our own, from Codeforces' value; Codeforces' span hidden) */
  function yokoku(j) {
    const tr = document.querySelector('tr.cfts-hero');
    if (!tr) return;
    j.cls(tr, 'cfts-yokoku');
    const kicker = tr.querySelector('.cfts-kicker');
    const lbl = j.make('<div class="cfts-yk"><span class="cfts-jp">次回予告</span><span>Next episode</span></div>');
    if (kicker) { j.cls(kicker, 'cfts-hidden'); j.insert(lbl, kicker.parentNode, kicker); } else j.insert(lbl, tr.cells[0], tr.cells[0].firstChild);
    const cd = tr.querySelector('td.cfts-state .countdown');
    if (!cd) return;
    const t = (cd.querySelector('[title]') || {}).getAttribute ? cd.querySelector('[title]').getAttribute('title') : cd.textContent;
    const m = (t || '').trim().match(/^(\d+):(\d\d):(\d\d)$/);
    if (!m) return;
    const end = Date.now() + (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000;
    const el = j.make('<span class="cfts-ykcd"></span>');
    j.insert(el, cd.parentNode, cd);
    j.cls(cd, 'cfts-hidden');
    const draw = () => {
      const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60;
      const p2 = (x) => String(x).padStart(2, '0');
      el.innerHTML = (d ? `<span>${d}<i>d</i></span>` : '') + `<span>${d ? h : p2(h)}<i>h</i></span><span>${p2(mi)}<i>m</i></span><span>${p2(se)}<i>s</i></span>`;
      return s > 0;
    };
    draw();
    j.every(draw, 1000);
  }

  /* the profile as a character sheet: the rank as a title (称号), the rating
     as a level (Lv.) */
  function characterSheet(j) {
    const box = document.querySelector('.cfts-phead');
    if (!box) return;
    const rk = box.querySelector('.user-rank > span');
    const h1 = box.querySelector('.main-info h1');
    if (rk && h1) {
      j.cls(box.querySelector('.user-rank'), 'cfts-hidden');
      j.insert(j.make(`<div class="cfts-shogo"><span class="cfts-jp">称号</span><span class="${esc(rk.className)}">${esc(rk.textContent.trim())}</span></div>`), h1.parentNode, h1.nextSibling);
    }
    const rli = [...box.querySelectorAll('li.cfts-fact')].find((li) => /Rating/.test((li.querySelector('.cfts-flbl') || {}).textContent || '') && !li.classList.contains('cfts-max'));
    const rv = rli && rli.querySelector('span[class*="user-"]');
    const mx = box.querySelector('li.cfts-max .smaller > span');
    /* Codeforces' anniversary badge would sit on the Talks box: with the photo's badges */
    const b2 = box.querySelector('.info > .badge'), tp = box.querySelector('.title-photo > div > div');
    if (b2 && tp) j.move(b2, tp);
    if (rv) j.insert(j.make(`<div class="cfts-lv"><span class="k">Lv.</span> <b class="${esc(rv.className)}">${esc(rv.textContent.trim())}</b>${mx ? `<small>max Lv. ${esc(mx.textContent.replace(/\D/g, ''))}</small>` : ''}</div>`), box);
  }

  /* ambient motes: at most 12, transform and opacity only, behind the content
     (the cards are near-solid: they show in the margins and the header);
     paused while the tab is hidden; none with prefers-reduced-motion (CSS);
     the popup's Motion switch (cfMotion, default on) */
  function motes(j) {
    /* two layers, each ONE composited transform animation over a static mask
       tile of petals (or light motes): a dozen animated elements cost Blink
       per-frame bookkeeping, two do not (harness/motion.mjs) */
    const box = j.make('<div class="cfts-motes" aria-hidden="true" hidden><i class="near"></i><i class="far"></i></div>');
    j.insert(box, document.body);
    j.on(document, 'visibilitychange', () => box.classList.toggle('paused', document.hidden));
    chrome.storage.local.get('cfMotion', (r) => { if (world.applied) box.hidden = !!(r && r.cfMotion === false); });
  }
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local' || !c.cfMotion) return;
    const box = document.querySelector('.cfts-motes');
    if (box) box.hidden = c.cfMotion.newValue === false;
  });

  /* ===================== sync ============================================== */
  let topicsOn = false;
  chrome.storage.local.get('cfTopics', (r) => { topicsOn = !!(r && r.cfTopics); if (guided.applied) syncTopics(topicsOn); });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && c.cfTopics) { topicsOn = !!c.cfTopics.newValue; if (guided.applied) syncTopics(topicsOn); }
  });

  function sync() {
    if (document.readyState === 'loading') return;      // annotate once the page is parsed
    const theme = root.getAttribute('data-cf-theme');
    /* Classic (src/classic.js) has the theme but not the look: neither the
       header niceties nor the Guided layer belong to it */
    const look = !!theme && root.hasAttribute('data-cf-look');
    const layout = root.getAttribute('data-cf-layout');
    const live = isLiveContest();
    root.toggleAttribute('data-cf-live', live && !!theme);
    /* A theme switch rebuilds, as a load would: each layer depends on the theme (the header's light boxes on the header's colour;
       the page layer is EMPTY where Pixel's or Anime's app owns the page, so keeping it left the next theme half-applied until
       a refresh). Newest first, each journal holds values read after the one before it. Classic's journal lets go first: it
       writes data-cfts-page too, and undoing it after Guided built would take Guided's value away */
    if (theme !== 'classic' && globalThis.__cftsClassicSync) globalThis.__cftsClassicSync(false, live);
    const key = theme + '/' + (root.getAttribute('data-cf-wearer') || '');   // LeetCode wears Midnight: leaving it keeps the theme, not the page
    const changed = !look || always.theme !== key;
    if (world.applied && changed) world.undo();
    if (guided.applied && changed) { guided.undo(); root.removeAttribute('data-cf-topics'); }
    if (always.applied && changed) always.undo();
    const want = look && layout === 'guided' && !live;
    if (look && !always.applied) { applyAlways(); always.theme = key; if (!want) step(() => contestLimits(always), 'limits'); }
    if (want && !guided.applied) {
      guided.applied = true;
      try {
        if (theme === 'pixel' && globalThis.__cftsPixel && globalThis.__cftsPixel.owns()) { /* Pixel's app draws this page itself (PIXEL.md) */ }
        else if (theme === 'anime' && globalThis.__cftsAnimeApp && globalThis.__cftsAnimeApp.owns()) { /* so does Anime's (ANIME.md) */ }
        else if (PATH === '/' || PATH === '') homePage(guided);
        else if (PATH === '/contests' || /^\/contests\/?$/.test(PATH)) contestsPage(guided);
        else if (/^\/gyms\/?$/.test(PATH) || /^\/gyms\/page\/\d+/.test(PATH)) gymsPage(guided);
        else if (/^\/(contest|gym)\/\d+\/standings(\/|$)/.test(PATH)) standingsPage(guided);
        else if (/^\/profile\/[^/]+\/?$/.test(PATH)) profilePage(guided);
        else if (/^\/(problemset\/status|contest\/\d+\/status|gym\/\d+\/status|submissions\/[^/]+|contest\/\d+\/my)(\/|$)/.test(PATH)) statusPage(guided);
        else if (/^\/blog\/entry\/\d+/.test(PATH)) blogPage(guided);
        else if (/^\/problemset\/?$/.test(PATH) || /^\/problemset\/page\/\d+/.test(PATH)) problemsetPage(guided);
        else if (/^\/(problemset\/problem|contest\/\d+\/problem|gym\/\d+\/problem)\//.test(PATH)) problemPage(guided);
        else if (/^\/(contest|gym)\/\d+\/?$/.test(PATH)) contestListPage(guided);
        step(() => meBox(guided), 'me');     // the personal box, on every page with a sidebar
      } catch (e) {
        try { console.warn('[cfts] guided layer undone:', e && e.message); } catch (x) { /* none */ }   // never silent again
        guided.undo();          // a page we don't recognise keeps Codeforces' own DOM
      }
      syncTopics(topicsOn);
    } else if (!want && guided.applied) {
      if (world.applied) world.undo();
      guided.undo();
      root.removeAttribute('data-cf-topics');
    }
    /* a theme's world (Anime, Paper, Pixel), Guided only; a theme switch swaps worlds */
    const wantWorld = want && WORLDS.has(theme);
    if (world.applied && (!wantWorld || world.theme !== theme)) world.undo();
    if (wantWorld && guided.applied && !world.applied) { try { applyWorld(world, theme); } catch (e) { world.undo(); } }
    if (theme === 'classic' && globalThis.__cftsClassicSync) globalThis.__cftsClassicSync(true, live);
  }
  /* the shared vocabulary and the journal, for src/classic.js (loaded after this file) */
  globalThis.__cftsKit = { Journal, DIVS, division, RANK, rankOf, word, textChild, fmt, esc, dayCountdown, myHandle, afterFirstFrame, PATH };
  globalThis.__cftsSync = sync;
  /* the page changed under the layers: the LeetCode app gave the statement back after the next theme was applied */
  globalThis.__cftsRebuild = () => {
    if (globalThis.__cftsClassicSync) globalThis.__cftsClassicSync(false, false);
    [world, guided, always].forEach((j) => { if (j.applied) j.undo(); });
    root.removeAttribute('data-cf-topics');
    sync();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();
})();
