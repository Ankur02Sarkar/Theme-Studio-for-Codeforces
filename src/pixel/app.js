/* =============================================================================
   pixel/app.js  (content script)   Pixel Art's own app (PIXEL.md)
   Codeforces as a monster-hunting RPG. Mounted by guided.js's world layer, Guided only, never in a live contest.
   Every problem is a monster; its identity is hash(contest + letter), so the Monster Book, the battle screen and the
   fight show the same creature. Reads the page only (no requests). Everything goes through the world journal `j`,
   Codeforces' controls are its own nodes moved in, so Off puts the page back exactly.
============================================================================= */
(() => {
  const root = document.documentElement;
  const PATH = location.pathname;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IS_BOOK = /^\/problemset\/?$/.test(PATH) || /^\/problemset\/page\/\d+/.test(PATH);
  const IS_FIGHT = /^\/(problemset\/problem|contest\/\d+\/problem|gym\/\d+\/problem)\//.test(PATH);
  const IS_HERO = /^\/profile\/[^/]+\/?$/.test(PATH);
  const IS_RAIDS = /^\/contests\/?$/.test(PATH) || /^\/contests\/page\/\d+/.test(PATH);
  const owns = () => IS_BOOK || IS_FIGHT || IS_HERO || IS_RAIDS;

  /* ---- the bestiary ----------------------------------------------------------- */
  const SPECIES = ['Slime', 'Goblin', 'Ghost', 'Golem', 'Warlock', 'Drake', 'Dragon', 'Elder'];
  const LADDER = [[1200, 'gray', 'Newbie'], [1400, 'green', 'Pupil'], [1600, 'cyan', 'Specialist'], [1900, 'blue', 'Expert'],
    [2100, 'violet', 'Candidate Master'], [2400, 'orange', 'Master'], [3000, 'red', 'Grandmaster'], [1e9, 'red', 'Legendary']];
  const LANDS = [['The Meadow', 'Easy', 800, 1300], ['Twilight Woods', 'Medium', 1400, 1800], ['Ember Peaks', 'Hard', 1900, 2300], ['The Dark Keep', 'Very hard', 2400, 3500]];
  const tierOf = (r) => LADDER.findIndex((x) => r < x[0]);
  const landOf = (r) => (r <= 1300 ? 0 : r <= 1800 ? 1 : r <= 2300 ? 2 : 3);
  const wordOf = (r) => (r < 1400 ? 'Easy' : r < 1900 ? 'Medium' : r < 2400 ? 'Hard' : 'Very hard');
  /* FNV-1a: the same problem is the same monster, on every page and every machine */
  function variant(contest, letter) {
    let h = 2166136261;
    for (const c of String(contest) + String(letter)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0) % 16;
  }
  /* an unrated problem is a silhouette: its species guessed from the letter, nothing else known */
  const monster = (contest, letter, rating) => {
    const r = rating || 0;
    const letterTier = Math.min(5, Math.max(0, (String(letter).charCodeAt(0) || 65) - 65));
    return { sp: r ? tierOf(r) : letterTier, v: variant(contest, letter), unknown: !r, col: r ? LADDER[tierOf(r)][1] : 'gray' };
  };
  const sprite = (m, size, extra = '') => `<i class="px-spr s${size}${m.unknown ? ' unk' : ''} ${extra}" style="--c:${m.v * 2};--r:${m.sp}" aria-hidden="true"></i>`;
  const heroSprite = (lvl, size, extra = '') => `<i class="px-hero s${size} ${extra}" style="--c:${lvl}" aria-hidden="true"></i>`;

  /* the status page shows no ratings: what the Book and the battle read is remembered, so the fight has the right monster */
  let seen = {};
  try { chrome.storage.local.get('cfPxSeen', (s) => { seen = Object.assign(s.cfPxSeen || {}, seen); window.dispatchEvent(new CustomEvent('px:seen')); }); } catch (e) { /* none */ }
  const remember = (list) => {
    let added = false;
    for (const [k, r] of list) if (r && seen[k] !== r) { seen[k] = r; added = true; }
    if (!added) return;
    const keys = Object.keys(seen);
    if (keys.length > 1500) for (const k of keys.slice(0, keys.length - 1500)) delete seen[k];
    chrome.storage.local.set({ cfPxSeen: seen });
  };

  /* ---- me: read from the page, remembered, so a page without a rating still knows ---- */
  function readMe(myHandle) {
    const handle = myHandle();
    let rating = 0;
    const box = document.querySelector('.personal-sidebar');
    if (box) { const m = /(?:Rating|Рейтинг)\s*:?\s*(\d+)/.exec(box.textContent); if (m) rating = +m[1]; }
    const self = handle && document.querySelector(`#body a.rated-user[href$="/${CSS.escape(handle)}"]`);
    let col = '';
    if (self) { const m = /user-(gray|green|cyan|blue|violet|orange|red|legendary|black)/.exec(self.className); if (m) col = m[1]; }
    return { handle, rating, col };
  }
  const applyMe = (hud, me) => {
    if (!hud || !me.handle) return;
    const r = me.rating, t = r ? tierOf(r) : Math.max(0, LADDER.findIndex((x) => x[1] === me.col));
    const hero = hud.querySelector('.px-hero');
    if (hero) hero.style.setProperty('--c', t);
    const [hi, , name] = LADDER[t], lo = t ? LADDER[t - 1][0] : 0, next = LADDER[t + 1];
    hud.style.setProperty('--me', `var(--cf-rank-${LADDER[t][1]})`);
    const lv = hud.querySelector('.px-lv');
    if (lv) lv.textContent = r ? `Lv ${r}` : (me.col ? name : '');   // never a rank we can't read
    const bar = hud.querySelector('.px-xp i');
    const xp = hud.querySelector('.px-xp');
    /* the whole road to Grandmaster, seven stretches, the profile's bar in small */
    const road = r ? (Math.min(t, 6) + Math.min(1, (r - lo) / (Math.min(hi, 3000) - lo))) / 7 : 0;
    if (bar) bar.style.width = Math.max(2, Math.round(road * 50) * 2) + '%';
    if (xp) { xp.title = r && next ? `${name}: ${hi - r} more to ${next[2]}` : name; xp.hidden = !r; }
  };

  /* ---- the HUD: on every page ----------------------------------------------------- */
  function hud(j, kit) {
    const body = document.getElementById('body');
    const links = [...document.querySelectorAll('.menu-list.main-menu-list > li')];
    if (!body || !links.length) return null;
    const handle = kit.myHandle();
    const logout = document.querySelector('#header .lang-chooser a[href$="/logout"]');
    const enter = document.querySelector('#header .lang-chooser a[href^="/enter"]');
    const reg = document.querySelector('#header .lang-chooser a[href^="/register"]');
    /* what people open every day stays in the bar; the rest waits under More (matched by address: the words change with the language) */
    const isMain = (li) => /^\/(problemset|contests|gyms|ratings)?$/.test(li.querySelector('a').getAttribute('href'));
    const item = (li) => { const a = li.querySelector('a'); return `<a href="${esc(a.getAttribute('href'))}"${li.classList.contains('current') ? ' class="on" aria-current="page"' : ''}>${esc(a.textContent.trim())}</a>`; };
    const h = j.make(`<header id="px-hud">
      <div class="px-top"><a class="px-logo" href="/" aria-label="Codeforces home"><i class="b1"></i><i class="b2"></i><i class="b3"></i><span>CODEFORCES</span></a>
        <div class="px-find"></div><div class="px-flags"></div>
        ${handle ? `<div class="px-me"><a class="px-frame" href="/profile/${esc(handle)}">${heroSprite(0, 24)}</a>
          <div class="px-id"><a class="px-name" href="/profile/${esc(handle)}">${esc(handle)}</a><span class="px-lv"></span><span class="px-xp"><i></i></span></div></div>`
    : `<div class="px-guest">${enter ? `<a class="px-btn" href="${esc(enter.getAttribute('href'))}">${esc(enter.textContent.trim())}</a>` : ''}${reg ? `<a class="px-btn gold" href="${esc(reg.getAttribute('href'))}">${esc(reg.textContent.trim())}</a>` : ''}</div>`}
      </div>
      <nav class="px-nav">${links.filter(isMain).map(item).join('')}
        <div class="px-mwrap"><button class="px-mbtn${links.some((li) => !isMain(li) && li.classList.contains('current')) ? ' on' : ''}" type="button" aria-haspopup="true" aria-expanded="false">More</button>
          <div class="px-menu" hidden>${links.filter((li) => !isMain(li)).map(item).join('')}${handle ? '<a href="/friends">Friends</a>' : ''}${logout ? `<hr><a href="${esc(logout.getAttribute('href'))}">${esc(logout.textContent.trim())}</a>` : ''}</div></div></nav>
    </header>`);
    j.insert(h, document.body, body);
    const form = document.querySelector('.menu-list-container form');
    if (form) {
      j.move(form, h.querySelector('.px-find'));
      const q = form.querySelector('input.search');
      if (q) { j.attr(q, 'placeholder', 'Search problems'); j.attr(q, 'aria-label', 'Search problems by name or ID'); }
      globalThis.__cftsFind.thumb = (r) => sprite(monster(r[0], r[1], r[3]), 2);
    }
    const flags = document.querySelector('#header .lang-chooser > div:first-child');
    if (flags) { j.move(flags, h.querySelector('.px-flags')); keepBell(j, flags); }
    j.attr(root, 'data-px-hud', '1');
    const mbtn = h.querySelector('.px-mbtn'), menu = h.querySelector('.px-menu');
    const openMenu = (on) => { menu.hidden = !on; mbtn.setAttribute('aria-expanded', String(on)); };
    j.on(mbtn, 'click', (e) => { e.stopPropagation(); openMenu(menu.hidden); });
    j.on(document, 'click', (e) => { if (!menu.hidden && !menu.contains(e.target)) openMenu(false); });
    j.on(document, 'keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { openMenu(false); mbtn.focus(); } });
    const me = readMe(kit.myHandle);
    applyMe(h, me);
    chrome.storage.local.get(['cfPxMe', 'cfRating'], (s) => {
      if (!h.isConnected) return;
      const c = s.cfPxMe && s.cfPxMe.handle === me.handle ? s.cfPxMe : null;
      const last = s.cfRating && s.cfRating.handle === me.handle && s.cfRating.result && s.cfRating.result.slice(-1)[0];
      const m = { handle: me.handle, col: me.col || (c && c.col) || '', rating: me.rating || (last && last.newRating) || (c && c.rating) || 0 };
      applyMe(h, m);
      if (me.handle && (m.rating !== (c && c.rating) || m.col !== (c && c.col))) chrome.storage.local.set({ cfPxMe: m });
      window.dispatchEvent(new CustomEvent('px:me', { detail: m }));
    });
    return { el: h, me };
  }

  /* ---- shared pieces ------------------------------------------------------------- */
  /* Codeforces' ready handler puts the bell into ".lang-chooser > div:first-child", which is already this block, moved to the
     theme's bar, on a fresh load: the bell landed in the hidden header and the notifications were gone. It comes to the bar */
  function keepBell(j, flags) {
    const fetch = () => {
      const bell = document.querySelector('.header-bell');
      if (bell && !flags.contains(bell) && flags.closest('.am-flags, .px-flags')) j.move(bell, flags, flags.firstChild);
    };
    [0, 400, 1500].forEach((ms) => setTimeout(fetch, ms));
  }
  function tabs(j, into) {
    const list = document.querySelector('#pageContent .second-level-menu');
    if (!list) return;
    const groups = [...list.querySelectorAll('.second-level-menu-list')];
    const html = groups.map((g) => [...g.querySelectorAll('li')].filter((li) => !li.classList.contains('backLava') && li.querySelector('a')).map((li) => {
      const a = li.querySelector('a');
      return `<a href="${esc(a.getAttribute('href'))}"${li.matches('.current, .selectedLava') ? ' class="on"' : ''}>${esc(a.textContent.trim())}</a>`;
    }).join('')).join('<span class="sep"></span>');
    j.insert(j.make(`<nav class="px-tabs">${html}</nav>`), into);
  }
  function side(j, into) {
    const s = document.getElementById('sidebar');
    if (!s) return;
    for (const b of [...s.children]) if (b.matches('.roundbox, form, div')) { j.move(b, into); }
  }
  function foot(j, into) {
    const f = document.getElementById('footer');
    if (f) j.move(f, into);
  }

  /* ---- the Monster Book (/problemset) --------------------------------------------- */
  function readRows() {
    return [...document.querySelectorAll('table.problems tr')].filter((tr) => tr.querySelector('td.id')).map((tr) => {
      const a = tr.querySelector('td.id a'), href = a.getAttribute('href');
      const m = /\/(\d+)\/([A-Za-z0-9]+)\/?$/.exec(href) || [];
      const nameA = tr.cells[1].querySelector('a');
      const ratingEl = tr.querySelector('.ProblemRating');
      const rating = ratingEl ? parseInt(ratingEl.textContent, 10) || 0 : 0;
      const solved = tr.cells[4] ? tr.cells[4].textContent.replace(/[^\d]/g, '') : '';
      const star = tr.querySelector('img.toggle-favourite');
      return { href, id: a.textContent.trim(), contest: m[1] || '', letter: m[2] || '', name: nameA ? nameA.textContent.trim() : '', rating,
        tags: [...tr.cells[1].querySelectorAll('a.notice')].map((n) => [n.textContent.trim(), n.getAttribute('href')]),
        solved: solved ? +solved : 0, solvedHref: (tr.cells[4] && tr.cells[4].querySelector('a') || { getAttribute: () => '' }).getAttribute('href'),
        submit: (tr.querySelector('a[href*="/submit"]') || { getAttribute: () => '' }).getAttribute('href'),
        won: tr.classList.contains('accepted-problem'), hurt: tr.classList.contains('rejected-problem'), star };
    });
  }
  function row(p, band) {
    const m = monster(p.contest, p.letter, p.rating);
    const lvl = p.rating ? `<b style="color:var(--cf-rank-${m.col})">${p.rating}</b><span>${wordOf(p.rating)}</span>` : '<b class="q">???</b><span>Not rated yet</span>';
    const mine = p.rating && !p.won && band && p.rating >= band[0] && p.rating <= band[1];
    return `<div class="px-row${p.won ? ' won' : p.hurt ? ' hurt' : ''}${mine ? ' mine' : ''}" data-href="${esc(p.href)}" tabindex="-1">
      <span class="c-mon">${sprite(m, 24)}</span>
      <span class="c-name"><a href="${esc(p.href)}">${esc(p.name)}</a><span class="sub"><span class="pid">${esc(p.id)}</span>${p.rating ? `<span class="sp">${SPECIES[m.sp]}</span>` : '<span class="sp">Unknown</span>'}${mine ? '<span class="lv">Your level</span>' : ''}${p.won ? '<span class="st w">Defeated</span>' : p.hurt ? '<span class="st h">Wounded it</span>' : ''}</span>
        ${p.tags.length ? `<span class="tags">${p.tags.map(([t, h]) => `<a href="${esc(h)}">${esc(t)}</a>`).join('')}</span>` : ''}</span>
      <span class="c-lvl">${lvl}</span>
      <span class="c-count">${p.solved ? (p.solvedHref ? `<a href="${esc(p.solvedHref)}">${p.solved.toLocaleString('en-US')}</a>` : p.solved.toLocaleString('en-US')) : '–'}</span>
      <span class="c-act"><a class="px-btn" href="${esc(p.href)}">Solve</a>${p.star ? `<button class="px-star${p.star.classList.contains('remove-favourite') ? ' on' : ''}" data-id="${esc(p.star.getAttribute('data-entityId'))}" type="button" aria-label="Favourite" title="Favourite"></button>` : ''}</span>
    </div>`;
  }
  function book(j, kit, me) {
    const rows = readRows();
    if (!rows.length) return false;
    remember(rows.map((p) => [p.contest + p.letter, p.rating]));
    const params = new URLSearchParams(location.search);
    const tagParam = params.get('tags') || '';
    const onLand = LANDS.findIndex(([, , lo, hi]) => tagParam.split(',').includes(`${lo}-${hi}`));
    const app = j.make(`<div id="px-root" class="px-book"><div class="px-page"></div></div>`);
    const page = app.firstElementChild;
    tabs(j, page);
    const order = (re) => { const a = [...document.querySelectorAll('table.problems th a')].find((x) => re.test(x.getAttribute('href') || '')); return a ? a.getAttribute('href') : ''; };
    const map = j.make(`<section class="px-map px-win">
      <div class="px-maphead"><h1>Monster Book</h1><p>Every problem is a monster. The further the land, the stronger it is: ratings run from 800 to 3500.</p>
        <a class="px-all${onLand < 0 ? ' on' : ''}" href="/problemset">All lands</a></div>
      <div class="px-lands">${LANDS.map(([n, w, lo, hi], i) => `<a class="px-land l${i}${i === onLand ? ' on' : ''}" href="/problemset?tags=${lo}-${hi}" data-land="${i}">
        <span class="t"><b>${n}</b><span>${w} · ${lo}${i === 3 ? '+' : `–${hi}`}</span></span><span class="pin"></span></a>`).join('')}</div>
    </section>`);
    j.insert(map, page);
    const cols = j.make(`<div class="px-cols"><main class="px-list px-win">
      <div class="px-head"><span class="c-mon"></span><span class="c-name">Monster</span><a class="c-lvl" href="${esc(order(/BY_RATING/))}">Level</a><a class="c-count" href="${esc(order(/BY_SOLVED/))}">Defeated by</a><span class="c-act"><span class="px-tally"></span></span></div>
      <div class="px-rows"></div><div class="px-pages"></div>
    </main><aside class="px-side"><section class="px-quest px-win" hidden></section></aside></div>`);
    j.insert(cols, page);
    const paint = (r) => {
      const band = r ? [Math.max(800, r - 100), Math.max(1000, r + 200)] : [800, 1000];
      cols.querySelector('.px-rows').innerHTML = rows.map((p) => row(p, band)).join('');
      /* the one thing this page should offer: the next fight at your level */
      const next = rows.find((p) => p.rating && !p.won && p.rating >= band[0] && p.rating <= band[1]);
      const q = cols.querySelector('.px-quest');
      q.hidden = false;
      if (next) {
        const m = monster(next.contest, next.letter, next.rating);
        q.innerHTML = `<h2>Next hunt</h2><a class="px-q" href="${esc(next.href)}">${sprite(m, 48, 'idle')}<span class="n">${esc(next.name)}</span><span class="m"><b style="color:var(--cf-rank-${m.col})">${next.rating}</b> ${SPECIES[m.sp]} · ${next.id}</span></a><a class="px-btn gold wide" href="${esc(next.href)}">Fight it</a>`;
      } else {
        q.innerHTML = `<h2>Next hunt</h2><p>Nothing at your level on this page.</p><a class="px-btn gold wide" href="/problemset?tags=${band[0]}-${band[1]}">Find one (${band[0]}–${band[1]})</a>`;
      }
      if (r) {
        const land = landOf(Math.max(800, r));
        map.querySelectorAll('.px-land .pin').forEach((p, i) => { p.innerHTML = i === land ? heroSprite(tierOf(r), 24, 'idle') : ''; });
        map.querySelector(`.px-land.l${land}`).classList.add('home');
      } else {
        map.querySelector('.px-land.l0 .pin').innerHTML = heroSprite(0, 24, 'idle');
      }
    };
    paint(me.rating);
    const won = rows.filter((p) => p.won).length, hurt = rows.filter((p) => p.hurt).length;
    cols.querySelector('.px-tally').textContent = me.handle ? `${won} defeated · ${hurt} wounded` : '';
    j.on(window, 'px:me', (e) => { if (e.detail.rating !== me.rating) { me.rating = e.detail.rating; paint(me.rating); } });
    const pg = document.querySelector('#pageContent .pagination');
    if (pg) j.move(pg, cols.querySelector('.px-pages'));
    side(j, cols.querySelector('.px-side'));
    foot(j, page);
    /* the whole row is the target; the keyboard walks the list like a menu */
    const list = cols.querySelector('.px-rows');
    j.on(list, 'click', (e) => {
      const star = e.target.closest('.px-star');
      if (star) {
        const img = rows.map((p) => p.star).find((x) => x && x.getAttribute('data-entityId') === star.dataset.id);
        if (img) { img.click(); star.classList.toggle('on'); }
        return;
      }
      if (e.target.closest('a, button')) return;
      const r = e.target.closest('.px-row');
      if (r) location.href = r.dataset.href;
    });
    let at = -1;
    j.on(document, 'keydown', (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const items = list.querySelectorAll('.px-row');
      if (e.key === '/') { const q = document.querySelector('#px-hud input.search'); if (q) { e.preventDefault(); q.focus(); } return; }
      if (e.key === 'j' || e.key === 'k') {
        at = Math.max(0, Math.min(items.length - 1, at + (e.key === 'j' ? 1 : -1)));
        list.querySelector('.cur')?.classList.remove('cur');
        items[at].classList.add('cur');
        items[at].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && at >= 0) location.href = items[at].dataset.href;
    });
    j.insert(app, document.body, document.getElementById('body'));
    return true;
  }

  /* ---- the battle screen (a problem page) ----------------------------------------- */
  function fight(j, kit, me) {
    const holder = document.querySelector('.problemindexholder');
    const ps = holder && holder.querySelector('.problem-statement');
    const hdr = ps && ps.querySelector(':scope > .header');
    const titleEl = hdr && hdr.querySelector('.title');
    if (!titleEl) return false;
    const pm = /^\s*([A-Z]\d?)\.\s*(.+?)\s*$/.exec(titleEl.textContent) || [];
    const path = /\/(?:problemset\/problem|contest|gym)\/(\d+)(?:\/problem)?\/(\w+)/.exec(PATH) || [];
    const contest = path[1] || '', letter = path[2] || pm[1] || '';
    const side0 = document.getElementById('sidebar');
    const tagEls = [...document.querySelectorAll('#sidebar .tag-box')];
    const tag = tagEls.map((t) => t.textContent.trim()).find((t) => /^\*\d+$/.test(t));
    /* Codeforces hides a problem's rating here with "Show tags for unsolved problems" off; the Book saw it */
    const rating = tag ? +tag.slice(1) : seen[contest + letter] || 0;
    const m = monster(contest, letter, rating);
    const land = rating ? landOf(rating) : 0;
    remember([[contest + letter, rating]]);
    const subs = [...document.querySelectorAll('#sidebar .roundbox')].find((b) => b.querySelector('a[href*="/submission/"]'));
    const won = !!(subs && subs.querySelector('.verdict-accepted'));
    const tries = subs ? subs.querySelectorAll('.verdict-rejected').length : 0;
    const val = (c) => { const e = hdr.querySelector(c); if (!e) return ''; const k = e.querySelector('.property-title'); return e.textContent.replace(k ? k.textContent : '', '').trim(); };
    const contestA = document.querySelector('#sidebar .rtable th a');
    const find = (re) => [...(side0 ? side0.querySelectorAll('a') : [])].find((a) => re.test(a.textContent));
    const tut = find(/Tutorial|Editorial|Разбор/i), ann = find(/Announcement|Анонс/i);
    const submit = /\/contest\/|\/gym\//.test(PATH) ? `/${/\/gym\//.test(PATH) ? 'gym' : 'contest'}/${contest}/submit/${letter}` : `/problemset/submit/${contest}/${letter}`;
    const fileIn = val('.input-file'), fileOut = val('.output-file');
    const std = /^standard/.test(fileIn) && /^standard/.test(fileOut);
    const handle = me.handle;
    const form = document.querySelector('form.submitFrameForm');
    const langSel = form && form.querySelector('select[name="programTypeId"]');
    const langs = langSel ? [...langSel.options].filter((o) => o.value).map((o) => ({ id: o.value, name: o.textContent.trim() })) : [];
    const multi = /number of test cases|test cases\b|количество наборов входных данных|количество тестов/i.test((ps.querySelector('.input-specification') || {}).textContent || '');
    const heroT = me.rating ? tierOf(me.rating) : Math.max(0, LADDER.findIndex((x) => x[1] === me.col));
    const app = j.make(`<div id="px-root" class="px-fight land-${land}"></div>`);
    const left = j.make(`<section class="px-left">
      <header class="px-head2"><button class="px-headx" type="button" aria-label="Close the title" title="Close the title"></button>
        <div class="px-crumb"></div>
        <h1>${esc(pm[2] || titleEl.textContent.trim())}</h1>
        <div class="stat"><b ${rating ? `style="color:var(--cf-rank-${m.col})"` : ''}>${rating ? `Lv ${rating}` : 'Lv ???'}</b><span>${rating ? `${wordOf(rating)} · ${SPECIES[m.sp]}` : 'Not rated yet'}</span><span class="pid">${esc(contest + letter)}</span>
          <span><i>Time</i> ${esc(val('.time-limit'))}</span><span><i>Memory</i> ${esc(val('.memory-limit'))}</span>${std ? '' : `<span><i>In</i> ${esc(fileIn)}</span><span><i>Out</i> ${esc(fileOut)}</span>`}</div>
        <div class="acts">${tut ? `<a class="px-btn sm" href="${esc(tut.getAttribute('href'))}">${esc(tut.textContent.trim().replace(/^.*?(Tutorial|Editorial|Разбор).*$/i, '$1'))}</a>` : ''}${ann ? `<a class="px-btn sm" href="${esc(ann.getAttribute('href'))}">Announcement</a>` : ''}
          ${tagEls.length ? '<button class="px-btn sm px-tt" type="button">Show topics</button>' : ''}<button class="px-btn sm px-more" type="button">More</button>
          ${contestA ? `<a class="px-contest" href="${esc(contestA.getAttribute('href'))}">${esc(contestA.textContent.trim())}</a>` : ''}</div>
        <div class="px-topics" hidden>${tagEls.map((t) => t.textContent.trim()).filter((t) => !/^\*\d+$/.test(t)).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
      </header>
      <main class="px-scroll"></main>
    </section>`);
    const right = j.make(`<section class="px-right" id="px-duel">
      <div class="px-arena wild${won ? ' slain' : ''}" aria-label="Battle">
        <div class="px-gnd" aria-hidden="true"></div>
        <div class="px-amb" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="px-foe" title="Poke it"><i class="pad"></i>${sprite(m, 48, 'idle')}<span class="px-mbub" hidden></span></div>
        <div class="px-ally"><i class="pad"></i><i class="px-hero back idle" style="--c:${heroT}"></i><span class="px-bub" hidden></span></div>
        <div class="px-plate2 f"><div class="nm"><b>${rating ? SPECIES[m.sp] : 'Unknown'}</b><span>${rating ? `Lv ${rating}` : 'Lv ???'}</span></div>
          <div class="sl"><em>HP</em><span class="hp foe${won ? ' zero' : ''}"><i style="width:${won ? 0 : 100}%"></i></span></div><div class="cap foecap">${won ? 'Defeated' : 'Full health'}</div></div>
        <div class="px-plate2 a"><div class="nm"><b>${handle ? esc(handle) : 'Guest'}</b><span class="hlv">${me.rating ? `Lv ${me.rating}` : ''}</span></div>
          <div class="sl"><em class="x">EXP</em><span class="hp exp"><i></i></span></div><div class="cap px-round">${won ? 'Defeated' : `Attempt ${tries + 1}`}</div></div>
        <div class="px-wait" hidden><b></b><span class="el"></span><span class="ch"><i></i></span></div>
        <div class="px-word" aria-live="polite"></div>
        <div class="px-wipe" aria-hidden="true"></div>
      </div>
      <div class="px-hsplit a" role="separator" aria-label="Resize the arena" title="Drag to resize, double-click to reset"></div>
      <div class="px-cmd2">
        <select class="px-lang" aria-label="Language"></select><span class="px-saved">Saved</span><button class="px-tool px-fscode" type="button" aria-label="Full view of the code" title="Full view of the code"></button>
        <button class="px-btn px-run" type="button" title="Ctrl+'">Run samples</button><button class="px-btn gold px-sub" type="button" title="Ctrl+Enter">Submit</button>
      </div>
      <div class="px-edwrap"></div>
      <div class="px-hsplit b" role="separator" aria-label="Resize the battle log" title="Drag to resize, double-click to reset"></div>
      <div class="px-loghead"><span>Battle log</span><span class="r"><button class="px-tool px-fslog" type="button" aria-label="Full view of the log" title="Full view of the log"></button><button class="px-logtog" type="button" aria-label="Collapse the battle log" title="Collapse"></button></span></div>
      <div class="px-log" role="log" aria-live="polite"></div>
    </section>`);
    const split = j.make('<div class="px-split"></div>');
    j.insert(left, split); j.insert(j.make('<div class="px-divider" role="separator" aria-label="Resize"></div>'), split); j.insert(right, split);
    j.insert(split, app);
    tabs(j, left.querySelector('.px-crumb'));
    j.move(holder, left.querySelector('.px-scroll'));
    /* Codeforces' side column stays reachable, out of the way: its boxes keep their forms and handlers */
    const subBox = form && form.closest('.roundbox');
    if (subBox) j.cls(subBox, 'px-hide');            // the editor is the submit box here
    const topicBox = tagEls[0] && tagEls[0].closest('.sidebox');
    if (topicBox) j.cls(topicBox, 'px-hide');        // topics spoil: Show topics, by the title, is the only way to them
    const drawer = j.make('<aside class="px-drawer px-side" hidden><button class="px-btn sm px-close" type="button">Close</button></aside>');
    side(j, drawer);
    j.insert(drawer, app);
    foot(j, left.querySelector('.px-scroll'));
    j.on(left.querySelector('.px-more'), 'click', () => { drawer.hidden = !drawer.hidden; });
    j.on(drawer.querySelector('.px-close'), 'click', () => { drawer.hidden = true; });
    const tt = left.querySelector('.px-tt');
    if (tt) j.on(tt, 'click', () => { const box = left.querySelector('.px-topics'); box.hidden = !box.hidden; tt.textContent = box.hidden ? 'Show topics' : 'Hide topics'; });
    const div = split.querySelector('.px-divider');
    j.on(div, 'pointerdown', (e) => {
      e.preventDefault(); split.classList.add('drag'); div.setPointerCapture(e.pointerId);     // capture: the editor's frame would take the moves
      const move = (ev) => split.style.setProperty('--left', Math.max(26, Math.min(72, ev.clientX / innerWidth * 100)) + '%');
      const up = () => { split.classList.remove('drag'); div.removeEventListener('pointermove', move); div.removeEventListener('pointerup', up); div.removeEventListener('pointercancel', up); };
      div.addEventListener('pointermove', move); div.addEventListener('pointerup', up); div.addEventListener('pointercancel', up);
    });
    j.insert(app, document.body, document.getElementById('body'));
    const sink = j.make('<iframe aria-hidden="true" tabindex="-1" style="position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0;visibility:hidden"></iframe>');
    j.insert(sink, document.documentElement);
    /* a problem whose rating arrives after we drew (the memory answers late): the same monster, known */
    if (!rating) j.on(window, 'px:seen', () => {
      const r = seen[contest + letter];
      if (!r) return;
      const k = monster(contest, letter, r);
      right.querySelectorAll('.px-spr').forEach((e) => { e.classList.remove('unk'); e.style.setProperty('--r', k.sp); });
      app.className = `px-fight land-${landOf(r)}`;
      right.querySelector('.px-plate2.f b').textContent = SPECIES[k.sp];
      right.querySelector('.px-plate2.f .nm span').textContent = `Lv ${r}`;
      const st = left.querySelector('.stat');
      st.firstElementChild.textContent = `Lv ${r}`; st.firstElementChild.style.color = `var(--cf-rank-${k.col})`;
      st.children[1].textContent = `${wordOf(r)} · ${SPECIES[k.sp]}`;
    });
    /* the hero's plate: EXP is the road to the next rank, the same number as the top bar */
    const heroPlate = (r, col) => {
      const t = r ? tierOf(r) : Math.max(0, LADDER.findIndex((x) => x[1] === col));
      right.querySelector('.px-hero.back').style.setProperty('--c', t);
      right.querySelector('.hlv').textContent = r ? `Lv ${r}` : '';
      const lo = t ? LADDER[t - 1][0] : 0, top = Math.min(LADDER[t][0], 3000);
      right.querySelector('.hp.exp i').style.width = r ? `${Math.max(2, Math.min(100, Math.round((r - lo) / (top - lo) * 100)))}%` : '0%';
      return t;
    };
    heroPlate(me.rating, me.col);
    j.on(window, 'px:me', (e) => { heroPlate(e.detail.rating, e.detail.col); });
    const duel = globalThis.__cftsPixelDuel.build({ j, arena: right.querySelector('.px-arena'), log: right.querySelector('.px-log'), cmd: right.querySelector('.px-cmd2'), edwrap: right.querySelector('.px-edwrap'), sink,
      right, left, app, cid: contest, idx: letter, submitUrl: submit, handle, langs, defaultLang: langSel ? langSel.value : '', multi, won, tries, monster: m, land, heroT, ink: rating ? getComputedStyle(root).getPropertyValue(`--cf-rank-${m.col}`).trim() : '', speciesName: rating ? SPECIES[m.sp] : 'Unknown monster', species: rating ? `A level ${rating} ${SPECIES[m.sp]}` : 'An unknown monster' });
    globalThis.__cftsPixel.duel = duel;
    return true;
  }

  /* ---- the hero's status screen (/profile/<handle>): src/pixel/profile.js --------------- */
  function heroPage(j, kit, me) {
    if (!document.querySelector('.userbox')) return false;
    const app = j.make('<div id="px-root" class="px-heroes"><div class="px-page"></div></div>');
    const page = app.firstElementChild;
    tabs(j, page);
    j.insert(app, document.body, document.getElementById('body'));
    globalThis.__cftsPixelProfile.build({ j, page, me, handle: decodeURIComponent(PATH.split('/')[2]), X: { LADDER, SPECIES, tierOf, landOf, monster, sprite, heroSprite } });
    foot(j, page);
    return true;
  }

  /* ---- the raid board (/contests): src/pixel/raids.js ------------------------------------ */
  function raids(j, kit, me) {
    if (!document.querySelector('.contestList')) return false;
    const app = j.make('<div id="px-root" class="px-raids"><div class="px-page"></div></div>');
    const page = app.firstElementChild;
    tabs(j, page);
    j.insert(app, document.body, document.getElementById('body'));
    globalThis.__cftsPixelRaids.build({ j, kit, page, me, side, X: { heroSprite, LADDER, tierOf, sprite } });
    foot(j, page);
    return true;
  }

  /* sign in and register: Codeforces' own form, moved in whole (token, fingerprint fields, handlers), beside the hero it belongs to.
     No saved copy of these pages: without a password field the page stays Codeforces' own */
  function door(j) {
    const pc = document.getElementById('pageContent');
    const form = pc && [...pc.querySelectorAll('form')].find((f) => f.querySelector('input[type="password"]'));
    if (!form) return false;
    const reg = /register/.test(PATH);
    const app = j.make(`<div id="px-root" class="px-doorway"><div class="px-page"><section class="px-auth"><div class="scene"><h1>${reg ? 'Start your journey' : 'Welcome back, hero'}</h1><p>${reg ? 'A new hero, a whole world of monsters.' : 'The monsters are still out there.'}</p>${heroSprite(reg ? 0 : 1, 48, 'idle')}</div>
      <div class="door"><h2>${reg ? 'Create your account' : 'Sign in'}</h2><div class="slot"></div><div class="alt"></div><p class="swap">${reg ? 'Already a hero? <a href="/enter">Sign in</a>' : 'New here? <a href="/register">Create an account</a>'}</p></div></section></div></div>`);
    const page = app.firstElementChild;
    /* only what matters comes across: Codeforces' box around the form has a fixed width and a white sheet */
    j.move(form, app.querySelector('.slot'));
    const alt = app.querySelector('.alt'), links = [...pc.querySelectorAll('a'), ...form.querySelectorAll('a')];
    const gmail = links.find((a) => /g-?mail|google/i.test(`${a.textContent} ${a.getAttribute('href')}`));
    if (gmail) {
      j.move(gmail, alt);
      j.cls(gmail, 'px-google');
      const t = [...gmail.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (t) j.text(t, reg ? 'Sign up with Google' : 'Continue with Google');
    }
    const forgot = links.find((a) => /forgot|password|пароль/i.test(`${a.textContent} ${a.getAttribute('href')}`) && a !== gmail);
    if (forgot && !form.contains(forgot)) j.move(forgot, app.querySelector('.slot'));
    j.insert(app, document.body, document.getElementById('body'));
    foot(j, page);
    return true;
  }

  /* one round, and its registration: no saved copies, so a page that doesn't read right stays Codeforces' own */
  function raid(j, kit, me) {
    const app = j.make('<div id="px-root" class="px-raids"><div class="px-page"></div></div>');
    const page = app.firstElementChild;
    const R = globalThis.__cftsPixelRaids, ctx = { j, kit, page, me, X: { heroSprite, LADDER, tierOf, sprite } };
    const parked = document.createDocumentFragment();
    parked.append(page);
    if (!(/contestRegistration/.test(PATH) ? R.join(ctx) : R.single(ctx))) return false;
    app.append(page);
    j.insert(app, document.body, document.getElementById('body'));
    foot(j, page);
    return true;
  }

  /* ---- the catalog: its markup can't be seen offline, so it is read by what it is: entries are links to posts, folders
     are the icons left over, and any ink too dark for the card moves to the muted role. Rows stay Codeforces' own. --- */
  function catalog(j) {
    const pc = document.getElementById('pageContent');
    if (!pc) return;
    const blockOf = (el) => { let n = el; while (n && n !== pc && getComputedStyle(n).display.startsWith('inline')) n = n.parentElement; return n && n !== pc ? n : null; };
    for (const a of pc.querySelectorAll('a[href*="/blog/entry/"]')) j.cls(blockOf(a), 'px-doc');
    for (const i of pc.querySelectorAll('img, svg, i')) { const b = blockOf(i); if (b && !b.closest('.px-doc') && !b.querySelector('.px-doc')) j.cls(b, 'px-dir'); }
    const lum = (c) => { const m = /(\d+)[^\d]+(\d+)[^\d]+(\d+)/.exec(c); return m ? (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255 : 1; };
    let n = 0;
    for (const el of pc.querySelectorAll('a, span, div, td, li, p, small, b')) {
      if (++n > 4000) break;
      if (el.classList.contains('rated-user') || el.closest('.px-dir a')) continue;
      if ([...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim()) && lum(getComputedStyle(el).color) < .36) j.cls(el, 'px-ink');
    }
  }

  function mount(j, kit) {
    const h = hud(j, kit);
    const me = h ? h.me : { handle: kit.myHandle(), rating: 0 };
    let ok = false;
    if (IS_BOOK) ok = book(j, kit, me);
    else if (IS_FIGHT) ok = fight(j, kit, me);
    else if (IS_HERO) ok = heroPage(j, kit, me);
    else if (IS_RAIDS) ok = raids(j, kit, me);
    else if (/^\/contests\/\d+\/?$/.test(PATH) || /^\/contestRegistration\/\d+/.test(PATH)) ok = raid(j, kit, me);
    else if (/^\/(enter|register)\/?$/.test(PATH)) ok = door(j);
    else if (/^\/catalog/.test(PATH)) catalog(j);
    if (ok) j.attr(root, 'data-px-app', IS_BOOK ? 'book' : IS_FIGHT ? 'fight' : IS_HERO ? 'hero' : /^\/(enter|register)/.test(PATH) ? 'door' : 'raids');
  }
  /* for the moments: the same monster and hero, wherever the verdict lands */
  function fighters(f) {
    const p = /^(\d+)([A-Za-z]\d?)/.exec(f.pid || '') || [];
    const rating = seen[(p[1] || '') + (p[2] || '')] || 0;
    const t = f.rating ? tierOf(f.rating) : Math.max(0, LADDER.findIndex((x) => x[1] === f.col));
    return { m: monster(p[1] || '', p[2] || 'A', rating), hero: t, land: rating ? landOf(rating) : 0, rating };
  }
  globalThis.__cftsPixel = { owns, mount, fighters, sprite, heroSprite, SPECIES,
    shared: { keepBell, LADDER, tierOf, variant, readMe, readRows, remember, tabs, side, foot, seenOf: (k) => seen[k] || 0 } };   // Anime reads the same page the same way
})();
