/* =============================================================================
   plist.js  (isolated world, /problemset list pages only)   MODERN.md, phase M3
   Modern mode's Problems page, built to the approved M1 mockup (mockups/modern/problemset.html):
   nav, "My lists" rail, three Start cards, topic chips, difficulty categories, search / sort / filter / shuffle,
   the virtualised rows (about 30 in the DOM, 11k in data), and the right column (progress, this month, upcoming).
   - Data: problemset.problems (cached a day, with tags), the user's user.status rows (signed in only), contest.list
     (cached 6 h, upcoming only). All through api.js. Nothing of Codeforces' page is moved: #body is hidden by
     themes/modern.css and the app is one shadow host. "Classic view" removes it; zero cfm-* nodes remain.
   - Codeforces' own URL filters map in and out: ?tags=dp,greedy,800-1300 and order=BY_SOLVED_DESC / BY_RATING_*.
     The URL is kept in step (history.replaceState), so Classic view opens the same list.
   - Favourites: Codeforces does not expose its own, so they are local stars (storage cfmFav).
============================================================================= */
(() => {
  'use strict';
  if (!/^\/problemset(\/page\/\d+)?\/?$/.test(location.pathname)) return;
  const UI_KEY = 'cfUI', FAV_KEY = 'cfmFav', ROW = 44, OVER = 12;
  const root = document.documentElement;
  let app = null, wanted = false;

  /* ---- icons: Lucide (ISC, licenses/lucide-ISC.txt) -------------------------------------------------------------- */
  const IC = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    sort: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    cok: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    down: '<path d="m6 9 6 6 6-6"/>', up: '<path d="m18 15-6-6-6 6"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  };
  const ic = (n) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const N = (n) => Number(n).toLocaleString('en-US');
  const rankOf = (r) => (r < 1200 ? 'gray' : r < 1400 ? 'green' : r < 1600 ? 'cyan' : r < 1900 ? 'blue' : r < 2100 ? 'violet' : r < 2400 ? 'orange' : 'red');
  const band = (r) => (!r ? 'Not rated' : r <= 1300 ? 'Easy' : r <= 1800 ? 'Medium' : 'Hard');
  const CATS = [['All', ''], ['Easy', '800–1300'], ['Medium', '1400–1800'], ['Hard', '1900+'], ['Not rated', '']];
  /* the page's own finishing (after the mockup sheet and the kit) */
  const PCSS = `
.nav{display:none}
.rail{top:50px}
.topics{display:flex;flex-wrap:nowrap;gap:8px;height:34px;overflow:hidden;align-items:center;position:relative;padding-right:96px;margin-bottom:16px}
.topics::after{content:"";position:absolute;right:88px;top:0;width:72px;height:34px;background:linear-gradient(90deg,rgba(26,26,26,0),#1a1a1a);pointer-events:none}
.topics.open{height:auto;flex-wrap:wrap;padding-right:0}.topics.open::after{display:none}
.topics .tp,.topics .tpall{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:9999px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.75);font-size:13.5px;white-space:nowrap;cursor:pointer;transition:background .15s,color .15s;flex:none}
.topics .tp:hover,.topics .tpall:hover{background:rgba(255,255,255,.1);color:#f5f5f5}
.topics .tp .ct{background:none;padding:0;color:rgba(255,255,255,.4);font-size:12px;font-variant-numeric:tabular-nums;min-width:0;height:auto}
.topics .tp.on,.topics .tpall.on{background:#f5f5f5;color:#1a1a1a}
.topics .tp.on .ct{background:none;color:rgba(0,0,0,.5)}
.topics .ex{background:#1a1a1a;padding-left:8px;width:88px;justify-content:flex-end;position:absolute;right:0;top:0;height:32px;display:inline-flex;align-items:center;gap:4px;color:rgba(255,255,255,.6);font-size:13.5px;-webkit-mask-image:none}
.topics.open .ex{position:static}
.topics .ex:hover{color:#f5f5f5}
.cats .cat{display:inline-flex;align-items:center;gap:8px}
.cats .cat i{width:8px;height:8px;border-radius:9999px;background:rgba(255,255,255,.35);flex:none}
.cats .c-Easy i{background:#1cbaba}.cats .c-Medium i{background:#ffb700}.cats .c-Hard i{background:#f63737}.cats .c-Notrated i{background:rgba(255,255,255,.25)}
.cats .c-All i{display:none}
.cats .cat.on i{box-shadow:0 0 0 2px rgba(0,0,0,.15)}
.prow .dw{width:58px;flex:none;font-size:13px;font-weight:500;text-align:right;margin-right:12px}
.d-Easy{color:#1cbaba}.d-Medium{color:#ffb700}.d-Hard{color:#f63737}
.pcard{padding:16px!important;border-radius:12px!important;background:#282828!important;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.pcard .ptt{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-size:14px;font-weight:600;color:#f5f5f5}
.pcard .ptt a{font-size:12.5px;font-weight:400;color:rgba(255,255,255,.5)}.pcard .ptt a:hover{color:#f5f5f5}
.pcard .gwrap{flex-direction:column;gap:6px}
.pcard .gring{margin:-12px auto -18px}
.pcard .gts{flex-direction:row;width:100%;gap:6px;margin:0}
.pcard .gt{flex:1;width:auto}
.upc .it .d span{white-space:nowrap}
.pcard .pfoot{display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);font-size:11.5px;color:rgba(255,255,255,.4)}
`;
  const SORTS = [['new', 'Newest first'], ['rating-asc', 'Rating: easiest first'], ['rating-desc', 'Rating: hardest first'], ['solved', 'Most solved']];
  const rchip = (r) => (r ? `<span class="chip rt tn" style="color:var(--rank-${rankOf(r)})" title="Rated ${r}: ${band(r)}">*${r}</span>` : '<span class="chip rt tn" style="color:var(--t3)" title="Not rated yet">—</span>');
  function divBadge(name) {
    let b = ['Special', 'violet'];
    if (/Div\.\s*1\s*\+\s*Div\.\s*2|Global/.test(name)) b = ['All levels', 'orange'];
    else if (/Educational/.test(name)) b = ['Educational', 'blue'];
    else for (const [d, c] of [[4, 'green'], [3, 'cyan'], [2, 'blue'], [1, 'red']]) if (new RegExp(`Div\\.\\s*${d}`).test(name)) { b = ['Div. ' + d, c]; break; }
    return `<span class="dv" style="--c:var(--rank-${b[1]})">${b[0]}</span>`;
  }
  const countdown = (sec) => { sec = Math.max(0, sec); const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60); return d ? `${d} d ${h} h` : `${h} h ${m} m`; };
  const when = (ts) => new Date(ts * 1000).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  function ring(frac, size = 20, stroke = 3) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, h = size / 2;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="${stroke}"/><circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="var(--green)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * Math.min(1, frac)).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 ${h} ${h})"/></svg>`;
  }

  /* ---- what the page shows (read, never fetched) -------------------------------------------------------------------- */
  const readPage = () => globalThis.CFM_KIT.me();   // handle, rank, photo, logout link
  /* Codeforces' own list URL: ?tags=dp,greedy,800-1300&order=BY_SOLVED_DESC */
  function fromUrl() {
    const u = new URLSearchParams(location.search), f = { cat: 'All', tags: [], tagOr: false, q: '', sort: 'new', status: 'all', min: 0, max: 0, list: '' };
    for (const t of (u.get('tags') || '').split(',').map((x) => x.trim()).filter(Boolean)) {
      const m = /^(\d+)-(\d+)$/.exec(t);
      if (m) { f.min = +m[1]; f.max = +m[2]; } else if (t === 'combine-tags-by-or') f.tagOr = true; else f.tags.push(t);
    }
    const cat = CATS.find(([c]) => c === 'Easy' && f.min === 800 && f.max === 1300) || CATS.find(([c]) => c === 'Medium' && f.min === 1400 && f.max === 1800) || CATS.find(([c]) => c === 'Hard' && f.min === 1900 && f.max === 3500);
    if (cat) { f.cat = cat[0]; f.min = f.max = 0; }
    f.q = (u.get('q') || '').slice(0, 80);   // the site bar's search
    const o = u.get('order') || '';
    f.sort = /SOLVED_DESC/.test(o) ? 'solved' : /RATING_ASC/.test(o) ? 'rating-asc' : /RATING_DESC/.test(o) ? 'rating-desc' : 'new';
    return f;
  }
  function toUrl(f) {
    const tags = [...f.tags];
    if (f.tagOr && tags.length > 1) tags.push('combine-tags-by-or');
    const rng = f.cat === 'Easy' ? '800-1300' : f.cat === 'Medium' ? '1400-1800' : f.cat === 'Hard' ? '1900-3500' : (f.min || f.max) ? `${f.min || 800}-${f.max || 3500}` : '';
    if (rng) tags.push(rng);
    const u = new URLSearchParams();
    if (tags.length) u.set('tags', tags.join(','));
    const o = { solved: 'BY_SOLVED_DESC', 'rating-asc': 'BY_RATING_ASC', 'rating-desc': 'BY_RATING_DESC' }[f.sort]; if (o) u.set('order', o);
    if (f.q && f.q.trim()) u.set('q', f.q.trim());
    const s = u.toString().replace(/%2C/g, ',');
    try { history.replaceState(history.state, '', '/problemset' + (s ? '?' + s : '')); } catch (e) { /* not ours to break */ }
  }

  /* ---- the shell ---------------------------------------------------------------------------------------------------- */
  function shell(d) {
    return `${globalThis.CFM_KIT.bar('problems', d)}
<div class="rail" data-m="rail"><div class="h" style="padding-top:0">My lists</div>
 <a class="ritem" data-list="solved" tabindex="0" role="button">${ic('cok')}<span>Solved</span><span class="cnt" id="n-solved">${d.handle ? '…' : ''}</span></a>
 <a class="ritem" data-list="tried" tabindex="0" role="button">${ic('clock')}<span>Tried</span><span class="cnt" id="n-tried">${d.handle ? '…' : ''}</span></a>
 <a class="ritem" data-list="fav" tabindex="0" role="button">${ic('star')}<span>Favourites</span><span class="cnt" id="n-fav">0</span></a></div>
<div class="pl-body"><div class="pl-main" data-m="plmain"><div class="start" data-m="start" id="start"></div>
 <div class="topics" data-m="topics" id="topics"></div>
 <div class="cats" data-m="cats" id="cats"></div>
 <div class="ptools" data-m="tools"><span class="sfield">${ic('search')}<input id="q" type="search" placeholder="Search problems" aria-label="Search problems by name or ID" autocomplete="off"></span>
  <button class="rbtn" data-act="sort" id="b-sort" title="Sort" aria-label="Sort">${ic('sort')}</button><button class="rbtn" data-act="filter" id="b-filter" title="Filter" aria-label="Filter">${ic('filter')}<i class="dot" hidden></i></button>
  <span class="prog" id="prog"></span><div class="menu" id="menu" hidden></div></div>
 <div class="rows" data-m="rows" id="rows"><div class="loading">${ic('loader').replace('class="i"', 'class="i spin"')}Loading the problem list…</div></div></div>
<div class="pl-right" data-m="pright"><div class="card pcard" data-m="progress-card" id="pcard"><div class="ptt"><span>Your progress</span><a id="pall" href="${d.handle ? '/profile/' + encodeURIComponent(d.handle) : '/enter'}">${d.handle ? 'Profile' : 'Sign in'}</a></div><div id="pbody"></div></div>
 <div class="card cal" data-m="cal" id="cal"${d.handle ? '' : ' hidden'}></div>
 <div class="card upc" data-m="upc" id="upc"><div class="tt" style="font-size:14px;font-weight:500">Upcoming contests</div><div id="upl" class="nouser">Loading…</div></div></div>
</div>
<div class="modal" id="intro" hidden><div class="box" role="dialog" aria-label="How Codeforces works"><h2>How Codeforces works</h2><ol>
 <li><b>Problems come from rounds.</b> Each has an ID like <b>1950E</b>: round 1950, the fifth problem. Letters go from easiest (A) to hardest.</li>
 <li><b>Ratings say how hard.</b> <b>*800</b> is the easiest, *3500 the hardest. Start with Easy (800–1300) and move up when they feel routine.</li>
 <li><b>You submit code; it runs on hidden tests.</b> Read input from stdin, print to stdout. <i>Accepted</i> means every test passed; otherwise you see the first failing test's number.</li>
 <li><b>Contests are timed rounds</b> (usually 2 hours) that change your rating. Div. 4 and Div. 3 are for beginners.</li>
 <li><b>Stuck?</b> Every round has an Editorial with hints and the solution; open the problem's Editorial tab.</li></ol>
 <button class="cl" data-act="intro-close">Got it</button></div></div>`;
  }

  /* ---- data -> view ------------------------------------------------------------------------------------------------- */
  const key = (cid, idx) => cid + idx;
  function solvedSets(status) {
    const ok = new Set(), tried = new Set();
    for (const r of status || []) { const k = key(r[2], r[3]); if (r[4] === 'OK') ok.add(k); else if (r[4] && r[4] !== 'TESTING') tried.add(k); }
    for (const k of ok) tried.delete(k);
    return { ok, tried };
  }
  function filtered() {
    const a = app, f = a.f, q = f.q.trim().toLowerCase(), qid = q.replace(/\s+/g, '');
    const lo = f.cat === 'Easy' ? 800 : f.cat === 'Medium' ? 1400 : f.cat === 'Hard' ? 1900 : f.min;
    const hi = f.cat === 'Easy' ? 1300 : f.cat === 'Medium' ? 1800 : f.cat === 'Hard' ? 4000 : f.max;
    let out = a.rows.filter((r) => {
      if (f.cat === 'Not rated' ? r[3] : (lo && r[3] < lo) || (hi && (!r[3] || r[3] > hi))) return false;
      if ((lo || hi) && !r[3] && f.cat !== 'Not rated') return false;
      const k = key(r[0], r[1]);
      if (f.list === 'solved' && !a.ok.has(k)) return false;
      if (f.list === 'tried' && !a.tried.has(k)) return false;
      if (f.list === 'fav' && !a.fav[k]) return false;
      if (f.status === 'solved' && !a.ok.has(k)) return false;
      if (f.status === 'tried' && !a.tried.has(k)) return false;
      if (f.status === 'todo' && (a.ok.has(k) || a.tried.has(k))) return false;
      if (f.tags.length && !(f.tagOr ? f.tags.some((t) => r[5].includes(t)) : f.tags.every((t) => r[5].includes(t)))) return false;
      if (q && !(k.toLowerCase().startsWith(qid) || r[2].toLowerCase().includes(q))) return false;
      return true;
    });
    if (f.sort === 'solved') out = out.slice().sort((x, y) => y[4] - x[4]);
    else if (f.sort === 'rating-asc') out = out.slice().sort((x, y) => (x[3] || 9999) - (y[3] || 9999) || y[4] - x[4]);
    else if (f.sort === 'rating-desc') out = out.slice().sort((x, y) => y[3] - x[3] || y[4] - x[4]);
    return out;
  }
  const $ = (id) => app.sh.getElementById(id);

  function drawRows() {
    const a = app, box = $('rows');
    a.list = filtered();
    if (!a.list.length) { box.style.height = ''; box.innerHTML = `<div class="empty"><b>No problems match</b>${a.f.q ? 'Try another name or ID, or ' : 'Try '}clearing a filter.</div>`; a.drawn = ''; return; }
    box.style.height = a.list.length * ROW + 'px';
    a.drawn = ''; paint();
  }
  /* virtualised: only the rows in view (plus OVER above and below) are in the DOM */
  function paint() {
    const a = app; if (!a || !a.list || !a.list.length) return;
    const box = $('rows'), top = box.getBoundingClientRect().top, z = parseFloat(a.host.style.zoom) || 1, row = ROW * z;   // screen pixels
    const first = Math.max(0, Math.floor(-top / row) - OVER), last = Math.min(a.list.length, Math.ceil((innerHeight - top) / row) + OVER);
    const sig = first + ':' + last + ':' + a.gen;
    if (sig === a.drawn) return;
    a.drawn = sig;
    let h = '';
    for (let i = first; i < last; i++) {
      const r = a.list[i], k = key(r[0], r[1]), st = a.ok.has(k) ? 'ok' : a.tried.has(k) ? 'try' : '';
      h += `<a class="prow${i % 2 ? '' : ' o'}" style="top:${i * ROW}px" href="/problemset/problem/${r[0]}/${encodeURIComponent(r[1])}" data-k="${esc(k)}"><span class="st ${st}" title="${st === 'ok' ? 'Solved' : st === 'try' ? 'Tried, not solved yet' : ''}">${st ? ic(st === 'ok' ? 'cok' : 'clock') : ''}</span><span class="nm"><b>${esc(k)}.</b>${esc(r[2])}${a.f.showTags && r[5].length ? `<span class="tg">${esc(r[5].join(', '))}</span>` : ''}</span><span class="sb" title="Solved by ${N(r[4])}">${ic('users')}${N(r[4])}</span><span class="dw d-${band(r[3]).replace(' ', '')}">${r[3] ? band(r[3]).replace('Medium', 'Med.') : ''}</span><span class="rc">${rchip(r[3])}</span><span class="stbtn${a.fav[k] ? ' fav' : ''}" data-fav="${esc(k)}" title="${a.fav[k] ? 'Remove from' : 'Add to'} Favourites" role="button" tabindex="-1">${ic('star')}</span></a>`;
    }
    box.innerHTML = h;
  }

  function drawControls() {
    const a = app, f = a.f;
    $('cats').innerHTML = CATS.map(([c, s]) => `<span class="cat c-${c.replace(' ', '')}${f.cat === c ? ' on' : ''}" data-cat="${c}" tabindex="0" role="button" aria-pressed="${f.cat === c}"><i></i>${c}${s ? ` <small>${s}</small>` : ''}</span>`).join('');
    const top = a.tagCounts.slice(0, a.topicsOpen ? a.tagCounts.length : 8);
    $('topics').className = 'topics' + (a.topicsOpen ? ' open' : '');
    $('topics').innerHTML = `<span class="tpall${f.tags.length ? '' : ' on'}" data-act="alltags" tabindex="0" role="button">All topics</span>` + top.map(([t, n]) => `<span class="tp${f.tags.includes(t) ? ' on' : ''}" data-tag="${esc(t)}" tabindex="0" role="button" aria-pressed="${f.tags.includes(t)}">${esc(t)}<span class="ct">${N(n)}</span></span>`).join('')
      + `<span class="ex" data-act="topics" tabindex="0" role="button">${a.topicsOpen ? 'Collapse ' + ic('up') : 'Expand ' + ic('down')}</span>`;
    a.sh.querySelectorAll('.ritem').forEach((el) => el.classList.toggle('on', el.getAttribute('data-list') === f.list));
    const active = f.status !== 'all' || f.tags.length || f.min || f.max;
    a.sh.querySelector('#b-filter .dot').hidden = !active;
    $('b-sort').classList.toggle('on', f.sort !== 'new');
    $('b-sort').title = 'Sort: ' + SORTS.find((s) => s[0] === f.sort)[1];
  }
  function drawSide() {
    const a = app, d = a.d, total = a.rows.length;
    const inSet = new Set(a.rows.map((r) => key(r[0], r[1])));
    const okSet = [...a.ok].filter((k) => inSet.has(k)), gym = a.ok.size - okSet.length;
    $('n-solved').textContent = d.handle ? (a.status ? okSet.length : '…') : '';
    $('n-tried').textContent = d.handle ? (a.status ? a.tried.size : '…') : '';
    $('n-fav').textContent = Object.keys(a.fav).length;
    $('prog').innerHTML = d.handle && a.status ? `${ring(okSet.length / Math.max(1, total))}<span>${okSet.length}/${N(total)} Solved</span><button class="rbtn" data-act="shuffle" title="Random unsolved problem from this list">${ic('shuffle')}</button>`
      : `<button class="rbtn" data-act="shuffle" title="Random problem from this list">${ic('shuffle')}</button>`;
    if (!d.handle) { $('pbody').innerHTML = '<div class="nouser"><a href="/enter">Sign in</a> to see what you have solved here.</div>'; return; }
    if (a.statusError) { $('pbody').innerHTML = `<div class="nouser">Codeforces' API did not answer (${esc(a.statusError)}), so your progress can't be shown right now. <a href="/submissions/${encodeURIComponent(d.handle)}">My submissions</a></div>`; return; }
    if (!a.status) { $('pbody').innerHTML = '<div class="nouser">Loading your submissions…</div>'; return; }
    const B = { Easy: [0, 0], Medium: [0, 0], Hard: [0, 0], 'Not rated': [0, 0] }, rating = new Map();
    for (const r of a.rows) { const b = band(r[3]); B[b][1]++; rating.set(key(r[0], r[1]), r[3]); }
    for (const k of okSet) B[band(rating.get(k))][0]++;
    const K = globalThis.CFM_KIT, rated = okSet.filter((k) => rating.get(k)).length;
    $('pbody').innerHTML = K.solvedCard(B, okSet.length, total, a.tried.size)
      + `<div class="pfoot"><span>${rated} rated · ${B['Not rated'][0]} not rated${gym > 0 ? ` · +${gym} Gym` : ''}</span></div>`;
    /* this month: days with an Accepted (local time) */
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), days = new Date(y, m + 1, 0).getDate(), lead = new Date(y, m, 1).getDay();
    const ac = new Set(a.status.filter((r) => r[4] === 'OK').map((r) => new Date(r[1] * 1000)).filter((t) => t.getFullYear() === y && t.getMonth() === m).map((t) => t.getDate()));
    let cells = 'SMTWTFS'.split('').map((w) => `<span class="w">${w}</span>`).join('') + '<span></span>'.repeat(lead);
    for (let i = 1; i <= days; i++) cells += `<span class="${[ac.has(i) && 'ac', i === now.getDate() && 'td', i > now.getDate() && 'mu'].filter(Boolean).join(' ')}">${i}</span>`;
    $('cal').innerHTML = `<div class="hd"><span>${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span><small>${ac.size} day${ac.size === 1 ? '' : 's'} with an Accepted</small></div><div class="g">${cells}</div>`;
  }
  /* "Your next problem": unsolved and untried, near the rating you have been solving (median of your last 10 solves + 100), most solved first */
  function nextProblem() {
    const a = app, byK = new Map(a.rows.map((r) => [key(r[0], r[1]), r]));
    const recent = (a.status || []).filter((r) => r[4] === 'OK').map((r) => byK.get(key(r[2], r[3]))).filter((r) => r && r[3]).slice(0, 10).map((r) => r[3]).sort((x, y) => x - y);
    const target = recent.length ? Math.max(800, Math.round((recent[recent.length >> 1] + 100) / 100) * 100) : 800;
    let best = null;
    for (const r of a.rows) { const k = key(r[0], r[1]); if (r[3] === target && !a.ok.has(k) && !a.tried.has(k) && (!best || r[4] > best[4])) best = r; }
    return best;
  }
  function drawStart() {
    const a = app, n = nextProblem(), up = a.upcoming && a.upcoming[0];
    $('start').innerHTML = `<a class="scard a" data-act="intro" tabindex="0" role="button"><span class="sk">New here</span><span class="t">New to Codeforces?<br>How it works in 60 seconds</span><span class="go">Start</span></a>
 ${n ? `<a class="scard b" href="/problemset/problem/${n[0]}/${encodeURIComponent(n[1])}"><span class="sk">Your next problem</span><span class="t">${esc(key(n[0], n[1]))}. ${esc(n[2])}</span><span class="m">${rchip(n[3])} ${ic('users')} ${N(n[4])} solved</span></a>` : '<span class="scard b"><span class="sk">Your next problem</span><span class="t">…</span><span class="m"></span></span>'}
 ${up ? `<a class="scard c" href="/contests"><span class="sk">Next contest</span><span class="t">${esc(up[1])}</span><span class="m">${divBadge(up[1])} in ${countdown(up[2] - Date.now() / 1000)}</span></a>` : `<a class="scard c" href="/contests"><span class="sk">Next contest</span><span class="t">${a.upcoming ? 'None announced yet' : '…'}</span><span class="m">See all contests</span></a>`}`;
    const ul = $('upl');
    if (a.upcomingError) ul.innerHTML = `Codeforces' API did not answer. <a href="/contests">Contests</a>`;
    else if (a.upcoming) {
      ul.className = ''; ul.innerHTML = a.upcoming.length ? a.upcoming.slice(0, 3).map((c) => `<a class="it" href="/contests"><span class="n">${esc(c[1])}</span><span class="d">${divBadge(c[1])}<span>${esc(when(c[2]))}</span><span style="margin-left:auto">in ${countdown(c[2] - Date.now() / 1000)}</span></span></a>`).join('') : '<div class="nouser">No rounds announced yet.</div>';
    }
  }
  function drawAll() { app.gen++; drawControls(); drawRows(); drawSide(); drawStart(); }

  /* ---- menus ---------------------------------------------------------------------------------------------------------- */
  function openMenu(which) {
    const a = app, m = $('menu'), f = a.f;
    if (!m.hidden && a.menu === which) { m.hidden = true; a.menu = ''; return; }
    a.menu = which; m.hidden = false;
    if (which === 'sort') {
      m.className = 'menu'; m.style.left = $('b-sort').offsetLeft + 'px';
      m.innerHTML = SORTS.map(([k, t]) => `<button class="mi" data-sort="${k}"><span class="ck">${f.sort === k ? ic('check') : ''}</span>${t}</button>`).join('');
      return;
    }
    m.className = 'menu flt'; m.style.left = $('b-filter').offsetLeft + 'px';
    const opt = (attr, v, label, on) => `<button class="opt${on ? ' on' : ''}" data-${attr}="${v}">${label}</button>`;
    m.innerHTML = `<div class="lab">Status</div><div class="row">${[['all', 'All'], ['todo', 'Not tried'], ['tried', 'Tried'], ['solved', 'Solved']].map(([v, t]) => opt('status', v, t, f.status === v)).join('')}</div>
  <div class="lab">Rating range${f.cat !== 'All' ? ' (replaces the category)' : ''}</div><div class="row"><input class="num" id="f-min" type="number" min="800" max="3500" step="100" placeholder="800" value="${f.min || ''}"> – <input class="num" id="f-max" type="number" min="800" max="3500" step="100" placeholder="3500" value="${f.max || ''}"></div>
  <div class="lab">Topics: match ${opt('tagor', '0', 'all', !f.tagOr)} ${opt('tagor', '1', 'any', f.tagOr)}</div><div class="row tags">${a.tagCounts.map(([t]) => opt('ftag', esc(t), esc(t), f.tags.includes(t))).join('')}</div>
  <div class="lab">Rows</div><div class="row">${opt('showtags', '1', 'Show topics on rows', f.showTags)}</div>
  <div class="foot"><button class="link" data-act="clear">Clear filters</button><button class="link" data-act="menu-close">Done</button></div>`;
    const rng = () => { f.min = +($('f-min').value || 0); f.max = +($('f-max').value || 0); if (f.min || f.max) f.cat = 'All'; changed(true); };
    $('f-min').addEventListener('change', rng); $('f-max').addEventListener('change', rng);
  }
  function changed(keepMenu) {
    toUrl(app.f); app.gen++; drawControls(); drawRows();
    if (keepMenu && app.menu === 'filter') { app.menu = ''; openMenu('filter'); }
    const sc = app.host; if (sc.scrollTop > 330) sc.scrollTop = 330;
  }

  function onClick(e) {
    const a = app, t = e.target, f = a.f;
    const fav = t.closest('[data-fav]');
    if (fav) {
      e.preventDefault(); e.stopPropagation();
      const k = fav.getAttribute('data-fav'); if (a.fav[k]) delete a.fav[k]; else a.fav[k] = 1;
      chrome.storage.local.set({ [FAV_KEY]: a.fav }); a.gen++; a.drawn = ''; paint(); $('n-fav').textContent = Object.keys(a.fav).length;
      if (f.list === 'fav') drawRows();
      return;
    }
    const el = t.closest('[data-act],[data-cat],[data-tag],[data-list],[data-sort],[data-status],[data-tagor],[data-ftag],[data-showtags]');
    if (!el) { if (!t.closest('#menu') && !$('menu').hidden) { $('menu').hidden = true; a.menu = ''; } return; }
    const act = el.getAttribute('data-act');
    if (act === 'intro') { $('intro').hidden = false; a.sh.querySelector('#intro .cl').focus(); return; }
    if (act === 'intro-close') { $('intro').hidden = true; return; }
    if (act === 'topics') { a.topicsOpen = !a.topicsOpen; drawControls(); return; }
    if (act === 'alltags') { f.tags = []; return changed(); }
    if (act === 'sort' || act === 'filter') { openMenu(act); return; }
    if (act === 'menu-close') { $('menu').hidden = true; a.menu = ''; return; }
    if (act === 'clear') { Object.assign(f, { tags: [], tagOr: false, status: 'all', min: 0, max: 0 }); changed(true); return; }
    if (act === 'shuffle') {
      const pool = a.list && a.list.length ? a.list : a.rows, fresh = pool.filter((r) => !a.ok.has(key(r[0], r[1])));
      const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
      if (pick) location.href = `/problemset/problem/${pick[0]}/${encodeURIComponent(pick[1])}`;
      return;
    }
    if (el.hasAttribute('data-cat')) { f.cat = el.getAttribute('data-cat'); f.min = f.max = 0; return changed(); }
    if (el.hasAttribute('data-tag')) { const g = el.getAttribute('data-tag'); f.tags = f.tags.includes(g) ? f.tags.filter((x) => x !== g) : f.tags.concat(g); return changed(); }
    if (el.hasAttribute('data-ftag')) { const g = el.getAttribute('data-ftag'); f.tags = f.tags.includes(g) ? f.tags.filter((x) => x !== g) : f.tags.concat(g); return changed(true); }
    if (el.hasAttribute('data-list')) { const l = el.getAttribute('data-list'); f.list = f.list === l ? '' : l; return changed(); }
    if (el.hasAttribute('data-sort')) { f.sort = el.getAttribute('data-sort'); $('menu').hidden = true; a.menu = ''; return changed(); }
    if (el.hasAttribute('data-status')) { f.status = el.getAttribute('data-status'); return changed(true); }
    if (el.hasAttribute('data-tagor')) { f.tagOr = el.getAttribute('data-tagor') === '1'; return changed(true); }
    if (el.hasAttribute('data-showtags')) { f.showTags = !f.showTags; chrome.storage.local.set({ cfmShowTags: f.showTags }); return changed(true); }
  }
  function onKey(e) {
    if (e.key === 'Escape') { if (!$('intro').hidden) $('intro').hidden = true; else if (!$('menu').hidden) { $('menu').hidden = true; app.menu = ''; } }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); }
    if (e.key === '/' && e.target === document.body) { e.preventDefault(); $('q').focus(); }
    e.stopPropagation();   // Codeforces' own key handlers never see the app's keys
  }

  /* ---- mount / unmount ---------------------------------------------------------------------------------------------- */
  function mount(store) {
    if (app || !wanted) return;
    const host = document.createElement('div'); host.id = 'cfm-app'; host.setAttribute('data-cfm', 'plist');
    const sh = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = (globalThis.CFM_PL_CSS || '') + (globalThis.CFM_KIT_CSS || '') + PCSS; sh.append(st);
    const d = readPage(), f = fromUrl(); f.showTags = !!store.cfmShowTags;
    const wrap = document.createElement('div'); wrap.innerHTML = shell(d); sh.append(...wrap.childNodes);
    document.documentElement.append(host);
    app = { host, sh, d, f, rows: [], list: null, status: null, ok: new Set(), tried: new Set(), fav: store[FAV_KEY] || {}, tagCounts: [], topicsOpen: false, gen: 0, drawn: '', menu: '', upcoming: null };
    app.unwire = globalThis.CFM_KIT.wire(sh, d); globalThis.CFM_KIT.photos(sh); globalThis.CFM_KIT.wireGauge(sh);
    const prevTitle = document.title; app.title = prevTitle; document.title = 'Problems - Codeforces';
    sh.addEventListener('click', onClick); sh.addEventListener('keydown', onKey);
    let raf = 0; host.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); }, { passive: true });
    /* the app grows with the window, as the problem page does: 1 up to 1536 px wide, 1.25 at 1920 and beyond */
    const rescale = () => { host.style.zoom = Math.round(Math.min(1.25, Math.max(1, innerWidth / 1536)) * 100) / 100; };
    rescale();
    app.onResize = () => { rescale(); app.drawn = ''; paint(); }; addEventListener('resize', app.onResize);
    let qt = 0; $('q').value = f.q; $('q').addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { if (!app) return; f.q = $('q').value; app.gen++; drawRows(); }, 120); });
    drawControls(); drawSide(); drawStart();
    const A = globalThis.CFM_API, me = app;
    if (!A) return;
    A.problems().then((rows) => {
      if (app !== me) return;
      app.rows = rows;
      const tc = new Map(); for (const r of rows) for (const t of r[5] || []) tc.set(t, (tc.get(t) || 0) + 1);
      app.tagCounts = [...tc.entries()].sort((x, y) => y[1] - x[1]);
      drawAll();
    }).catch((e) => { if (app === me) $('rows').innerHTML = `<div class="empty"><b>Couldn't load the problem list</b>Codeforces' API did not answer (${esc(e.message)}). Reload the page in a minute.</div>`; });
    if (d.handle) A.statusRows(d.handle).then((s) => { if (app !== me) return; app.status = s.rows; Object.assign(app, solvedSets(s.rows)); drawAll(); }).catch((e) => { if (app === me) { app.statusError = e.message; drawSide(); } });
    A.upcoming().then((u) => { if (app !== me) return; app.upcoming = u; drawStart(); }).catch(() => { if (app === me) { app.upcomingError = true; drawStart(); } });
  }
  function unmount() {
    if (!app) return;
    removeEventListener('resize', app.onResize); if (app.unwire) app.unwire();
    document.title = app.title;
    app.host.remove(); app = null;
  }
  function fail(why) {
    try { console.warn('[cfm] Modern Problems page not mounted:', why); } catch (e) { /* none */ }
    root.removeAttribute('data-cf-ui'); document.dispatchEvent(new CustomEvent('cfm:fail', { detail: why }));
  }
  function apply(v) {
    wanted = v === 'modern';
    if (!wanted) return unmount();
    const go = () => chrome.storage.local.get([FAV_KEY, 'cfmShowTags'], (s) => { try { mount(s || {}); } catch (e) { try { console.error('[cfm] plist', e); } catch (x) { /* none */ } fail('error'); } });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
  }
  /* on = the LeetCode theme with its layout on (popup: cfThemeStudio 'leetcode' + cfUI 'modern'; "Classic view" sets cfUI 'classic') */
  const modernWanted = (r) => !!r && r[UI_KEY] === 'modern' && (globalThis.CFTS_THEMES ? (globalThis.CFTS_THEMES.byId[r.cfThemeStudio] || {}).app === 'modern' : r.cfThemeStudio === 'leetcode');   // src/themes.js: the theme whose app is 'modern'
  chrome.storage.local.get([UI_KEY, 'cfThemeStudio', 'cfmDev'], (r) => {
    apply(modernWanted(r) ? 'modern' : 'classic');
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && (c[UI_KEY] || c.cfThemeStudio)) chrome.storage.local.get([UI_KEY, 'cfThemeStudio'], (r) => apply(modernWanted(r) ? 'modern' : 'classic'));
  });
  document.addEventListener('cfm:unmount', () => unmount());
  setTimeout(() => { if (wanted && !app) fail('timeout'); }, 6000);

  globalThis.CFM_PL = { debug: () => (app ? { mounted: true, rows: app.rows.length, shown: app.list ? app.list.length : 0, inDom: app.sh.querySelectorAll('.prow').length, filter: Object.assign({}, app.f), signedInAs: app.d.handle || '(nobody)', solved: app.ok.size, tried: app.tried.size, upcoming: app.upcoming ? app.upcoming.length : null } : { mounted: false }) };
})();
