/* =============================================================================
   anime/app.js  (content script)   Anime's own app (ANIME.md: read it first)
   Your Codeforces career as a shōnen series. Mounted by guided.js's world layer, Guided only, never in a live contest.
   Reads the page only; every node goes through the world journal `j`; Codeforces' controls are its own nodes moved in.
   Pixel is a game; this is a broadcast and a manga. Only the plumbing is shared: Run, Submit and the verdict watch (src/pixel/duel.js), told by onair.js.
============================================================================= */
(() => {
  const root = document.documentElement;
  const PATH = location.pathname;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = (p) => chrome.runtime.getURL(p);
  const IS_GUIDE = /^\/problemset\/?$/.test(PATH) || /^\/problemset\/page\/\d+/.test(PATH);
  const IS_EPISODE = /^\/(problemset\/problem|contest\/\d+\/problem|gym\/\d+\/problem)\//.test(PATH);
  const IS_DOOR = /^\/(enter|register)\/?$/.test(PATH);
  const IS_SCHEDULE = /^\/contests\/?$/.test(PATH) || /^\/contests\/page\/\d+/.test(PATH);
  const IS_HOME = PATH === '/' || /^\/page\/\d+/.test(PATH);
  const IS_ROUND = /^\/(contest|gym)\/\d+\/?$/.test(PATH);
  const IS_GYM = /^\/gyms\/?$/.test(PATH) || /^\/gyms\/page\/\d+/.test(PATH);
  const IS_RANK = /^\/ratings(\/|$)/.test(PATH);
  const IS_CHARACTER = /^\/profile\/[^/]+\/?$/.test(PATH);
  const owns = () => IS_GUIDE || IS_EPISODE || IS_DOOR || IS_SCHEDULE || IS_CHARACTER || IS_HOME || IS_ROUND || IS_GYM || IS_RANK;

  /* ---- the series -------------------------------------------------------------- */
  const ARCS = [
    { jp: '日常編', en: 'Daily Life', word: 'Easy', lo: 800, hi: 1300, scene: 'easy' },
    { jp: '修行編', en: 'Training', word: 'Medium', lo: 1400, hi: 1800, scene: 'medium' },
    { jp: '激闘編', en: 'Battle', word: 'Hard', lo: 1900, hi: 2300, scene: 'dragon-bride' },
    { jp: '最終決戦', en: 'Final Battle', word: 'Very hard', lo: 2400, hi: 3500, scene: 'hard' },
  ];
  const arcOf = (r) => (r <= 1300 ? 0 : r <= 1800 ? 1 : r <= 2300 ? 2 : 3);
  /* one rival for each rung of the ladder: a yōkai and its seal */
  const RIVALS = [['Hitodama', '魂'], ['Kappa', '河'], ['Yūrei', '霊'], ['Oni', '鬼'], ['Tengu', '天'], ['Gashadokuro', '骨'], ['Kitsune', '狐'], ['Ryū', '龍']];
  const TECH = [['一閃', 'Issen', 'One Flash'], ['連撃', 'Rengeki', 'Flurry'], ['雷神', 'Raijin', 'Thunder God'], ['奥義', 'Ōgi', 'Final Art']];
  const SEASON_GEAR = () => 'hero';           // gear by rank arrives with its art: hero-stand-T.webp
  const K = () => globalThis.__cftsPixel.shared;
  const rivalOf = (contest, letter, rating) => {
    const k = K(), t = rating ? k.tierOf(rating) : -1;
    return { sp: t, v: k.variant(contest, letter), col: t < 0 ? 'gray' : k.LADDER[t][1], name: t < 0 ? 'Unknown rival' : RIVALS[t][0], seal: t < 0 ? '謎' : RIVALS[t][1] };
  };
  /* a problem's picture says who you face and how hard: the rung's colour and kanji, one of six compositions, the same everywhere (build-posters.mjs) */
  const posterAt = (tier, v) => `--sx:${v % 6};--sy:${tier < 0 ? 8 : tier}`;
  const poster = (r) => posterAt(r.sp, r.v);
  const heroUrl = (pose) => url(`textures/anime/cast/${SEASON_GEAR()}-${pose}.webp`);
  const sceneUrl = (id) => {
    const s = globalThis.LCTS_SCENES || {}, a = globalThis.LCTS_ARC_DEFAULT || {}, sc = s[a[id]] || s[id] || s[globalThis.LCTS_SCENE_DEFAULT];
    return sc ? url(sc.wall) : '';
  };

  /* ---- the HUD ------------------------------------------------------------------- */
  function hud(j, kit) {
    const body = document.getElementById('body');
    const links = [...document.querySelectorAll('.menu-list.main-menu-list > li')];
    if (!body || !links.length) return null;
    const k = K(), handle = kit.myHandle();
    const logout = document.querySelector('#header .lang-chooser a[href$="/logout"]');
    const enter = document.querySelector('#header .lang-chooser a[href^="/enter"]');
    const reg = document.querySelector('#header .lang-chooser a[href^="/register"]');
    const isMain = (li) => /^\/(problemset|contests|gyms|ratings)?$/.test(li.querySelector('a').getAttribute('href'));
    const item = (li) => { const a = li.querySelector('a'); return `<a href="${esc(a.getAttribute('href'))}"${li.classList.contains('current') ? ' class="on" aria-current="page"' : ''}><span>${esc(a.textContent.trim())}</span></a>`; };
    const h = j.make(`<header id="am-hud">
      <a class="am-logo" href="/" aria-label="Codeforces home"><i></i><i></i><i></i><b>CODEFORCES</b></a>
      <nav class="am-nav">${links.filter(isMain).map(item).join('')}
        <div class="am-mwrap"><button class="am-mbtn${links.some((li) => !isMain(li) && li.classList.contains('current')) ? ' on' : ''}" type="button" aria-haspopup="true" aria-expanded="false"><span>More</span></button>
          <div class="am-menu" hidden>${links.filter((li) => !isMain(li)).map(item).join('')}${handle ? '<a href="/friends"><span>Friends</span></a>' : ''}${logout ? `<hr><a href="${esc(logout.getAttribute('href'))}"><span>${esc(logout.textContent.trim())}</span></a>` : ''}</div></div></nav>
      <div class="am-find"></div><div class="am-flags"></div>
      ${handle ? `<a class="am-me" href="/profile/${esc(handle)}"><i class="am-face" style="--hero:url('${heroUrl('stand')}')"></i>
        <span class="id"><b>${esc(handle)}</b><span class="sn"></span><span class="road"></span></span></a>`
    : `<div class="am-guest">${enter ? `<a class="am-btn" href="${esc(enter.getAttribute('href'))}">${esc(enter.textContent.trim())}</a>` : ''}${reg ? `<a class="am-btn hot" href="${esc(reg.getAttribute('href'))}">${esc(reg.textContent.trim())}</a>` : ''}</div>`}
    </header>`);
    j.insert(h, document.body, body);
    const form = document.querySelector('.menu-list-container form');
    if (form) {
      j.move(form, h.querySelector('.am-find'));
      const q = form.querySelector('input.search');
      if (q) { j.attr(q, 'placeholder', 'Search problems'); j.attr(q, 'aria-label', 'Search problems by name or ID'); }
      globalThis.__cftsFind.thumb = (r) => `<i class="am-still" style="${posterAt(r[3] ? k.tierOf(r[3]) : -1, k.variant(r[0], r[1]))}"></i>`;
    }
    const flags = document.querySelector('#header .lang-chooser > div:first-child');
    if (flags) { j.move(flags, h.querySelector('.am-flags')); K().keepBell(j, flags); }
    j.attr(root, 'data-am-hud', '1');
    const mbtn = h.querySelector('.am-mbtn'), menu = h.querySelector('.am-menu');
    const openMenu = (on) => { menu.hidden = !on; mbtn.setAttribute('aria-expanded', String(on)); };
    j.on(mbtn, 'click', (e) => { e.stopPropagation(); openMenu(menu.hidden); });
    j.on(document, 'click', (e) => { if (!menu.hidden && !menu.contains(e.target)) openMenu(false); });
    j.on(document, 'keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { openMenu(false); mbtn.focus(); } });

    const me = k.readMe(kit.myHandle);
    const paint = (m) => {
      const sn = h.querySelector('.sn'), road = h.querySelector('.road');
      if (!sn) return;
      const t = m.rating ? k.tierOf(m.rating) : Math.max(0, k.LADDER.findIndex((x) => x[1] === m.col));
      const [hi, col, name] = k.LADDER[t], lo = t ? k.LADDER[t - 1][0] : 0;
      h.style.setProperty('--me', `var(--cf-rank-${col})`);
      sn.textContent = m.rating ? `Season ${t + 1} · ${name} · ${m.rating}` : m.col ? `Season ${t + 1} · ${name}` : '';
      /* the road to Grandmaster: one tick per season, the current one filled by how far through it you are */
      const part = m.rating ? Math.min(1, (m.rating - lo) / (Math.min(hi, 3000) - lo)) : 0;
      road.innerHTML = [0, 1, 2, 3, 4, 5, 6].map((i) => `<i${i < t ? ' class="on"' : ''}>${i === t ? `<u style="width:${Math.round(part * 100)}%"></u>` : ''}</i>`).join('');
      road.title = k.LADDER[t + 1] && m.rating ? `${hi - m.rating} more to ${k.LADDER[t + 1][2]}` : name;
      road.hidden = !m.rating;
    };
    paint(me);
    chrome.storage.local.get(['cfPxMe', 'cfRating'], (s) => {
      if (!h.isConnected) return;
      const c = s.cfPxMe && s.cfPxMe.handle === me.handle ? s.cfPxMe : null;
      const last = s.cfRating && s.cfRating.handle === me.handle && s.cfRating.result && s.cfRating.result.slice(-1)[0];
      const m = { handle: me.handle, col: me.col || (c && c.col) || '', rating: me.rating || (last && last.newRating) || (c && c.rating) || 0 };
      paint(m);
      if (me.handle && (m.rating !== (c && c.rating) || m.col !== (c && c.col))) chrome.storage.local.set({ cfPxMe: m });
      window.dispatchEvent(new CustomEvent('am:me', { detail: m }));
    });
    return { el: h, me };
  }
  const tabs = (j, into) => {
    K().tabs(j, into);
    const n = into.querySelector('.px-tabs');
    if (n) n.className = 'am-tabs';
  };

  const chip = (kit, d) => { if (!d || d === 'none') return ''; const [a, b, c] = kit.DIVS[d]; return `<span class="am-div" style="--c:var(--cf-rank-${c})" title="${esc(kit.DIVS[d][3])}"><b>${esc(a)}</b>${esc(b)}</span>`; };

  /* ---- the Episode Guide (/problemset): a streaming service's shelves, not a table. Twice as many episodes in a screen as rows held ---- */
  const lvlWord = (p, r, arc) => (p.rating ? ARCS[arc].word : 'Not rated yet');
  function card(p, band) {
    const r = rivalOf(p.contest, p.letter, p.rating), arc = p.rating ? arcOf(p.rating) : 0;
    const mine = p.rating && !p.won && band && p.rating >= band[0] && p.rating <= band[1];
    return `<div class="am-card${p.won ? ' won' : p.hurt ? ' hurt' : ''}${mine ? ' mine' : ''}" data-href="${esc(p.href)}">
      <span class="pic" title="Rival: ${esc(r.name)}"><i class="am-still" style="${poster(r)}"></i><b class="rt"${p.rating ? ` style="color:var(--cf-rank-${r.col})"` : ''}>${p.rating || 'New'}</b>${p.won ? '<em class="am-done jp">完</em>' : ''}</span>
      <a class="nm" href="${esc(p.href)}">${esc(p.name)}</a>
      <span class="sub"><span class="pid">${esc(p.id)}</span><span>${lvlWord(p, r, arc)}</span>${mine ? '<span class="lv">Your level</span>' : p.hurt && !p.won ? '<span class="st h">Unfinished</span>' : ''}${p.solved ? `<span class="n">${p.solvedHref ? `<a href="${esc(p.solvedHref)}">${p.solved.toLocaleString('en-US')}</a>` : p.solved.toLocaleString('en-US')}</span>` : ''}</span>
      ${p.tags.length ? `<span class="tags">${p.tags.map(([t, h]) => `<a href="${esc(h)}">${esc(t)}</a>`).join('')}</span>` : ''}
      ${p.star ? `<button class="am-star${p.star.classList.contains('remove-favourite') ? ' on' : ''}" data-id="${esc(p.star.getAttribute('data-entityId'))}" type="button" aria-label="Favourite" title="Favourite"></button>` : ''}
    </div>`;
  }
  /* Continue watching: the episodes you left unfinished, on this machine only */
  const VERDICT_WORD = { wa: 'Wrong answer', tle: 'Time limit', mle: 'Memory limit', err: 'Runtime error', ce: 'Compile error', hacked: 'Hacked' };
  const watched = (cb) => chrome.storage.local.get('cfAmRecent', (s) => cb((s && s.cfAmRecent) || []));
  const remember = (e) => watched((list) => {
    const next = [Object.assign({}, list.find((x) => x.pid === e.pid), e, { at: Date.now() }), ...list.filter((x) => x.pid !== e.pid)].slice(0, 24);
    chrome.storage.local.set({ cfAmRecent: next });
  });
  function shelf(j, into) {
    watched((list) => {
      const open = list.filter((x) => !x.won).slice(0, 5);
      if (!open.length || !into.isConnected) return;
      into.hidden = false;
      into.innerHTML = `<h2>Continue watching</h2><div class="row">${open.map((x) => {
        const r = rivalOf(x.pid.replace(/\D+\d*$/, ''), x.pid.replace(/^\d+/, ''), x.rating);
        return `<a class="am-resume" href="${esc(x.href)}"><i class="am-still" style="${poster(r)}"></i><span class="tx"><b>${esc(x.name)}</b><span>${x.v ? esc(VERDICT_WORD[x.v] || 'Unfinished') : 'Opened, not submitted'}</span></span></a>`;
      }).join('')}</div>`;
    });
  }
  function guide(j, kit, me) {
    const k = K(), rows = k.readRows();
    if (!rows.length) return false;
    k.remember(rows.map((p) => [p.contest + p.letter, p.rating]));
    const tag = new URLSearchParams(location.search).get('tags') || '';
    const on = ARCS.findIndex((a) => tag.split(',').includes(`${a.lo}-${a.hi}`));
    const app = j.make('<div id="am-root" class="am-guide"></div>');
    const order = (re) => { const a = [...document.querySelectorAll('table.problems th a')].find((x) => re.test(x.getAttribute('href') || '')); return a ? a.getAttribute('href') : ''; };
    const key = j.make(`<section class="am-key"><div class="am-keyart" style="${on >= 0 ? `background-image:url('${esc(sceneUrl(ARCS[on].scene))}');background-size:cover;background-position:50% 34%` : 'background-image:var(--cf-scene-wall)'}"></div>
      <img class="am-keyhero" src="${heroUrl('strike')}" alt="" draggable="false">
      <div class="am-keytext"><span class="jp" aria-hidden="true">エピソード</span><h1>Episode Guide</h1><p class="lede"></p><div class="am-next"></div></div></section>`);
    j.insert(key, app);
    j.insert(j.make(`<nav class="am-arcs" aria-label="Arcs">${ARCS.map((a, i) => `<a class="am-arc${i === on ? ' on' : ''}" href="/problemset?tags=${a.lo}-${a.hi}" style="--art:url('${esc(sceneUrl(a.scene))}')"><span class="in"><b class="jp">${a.jp}</b><span>${a.en} · ${a.lo}${i === 3 ? '+' : `–${a.hi}`}</span></span></a>`).join('')}
      <a class="am-arc all${on < 0 ? ' on' : ''}" href="/problemset"><span class="in"><b>All</b><span>Every arc</span></span></a></nav>`), app);
    const body = j.make(`<div class="am-shelves"><section class="am-shelf" hidden></section>
      <div class="am-tabrow"><span class="am-tally"></span><span class="am-sort"><span>Sort by</span><a href="${esc(order(/BY_RATING/))}">Rating</a><a href="${esc(order(/BY_SOLVED/))}">Times cleared</a></span><button class="am-btn sm am-filter" type="button">Filters and topics</button></div>
      <main class="am-grid"></main><div class="am-pages"></div></div>`);
    j.insert(body, app);
    shelf(j, body.querySelector('.am-shelf'));
    tabs(j, body.querySelector('.am-tabrow'));
    const tr = body.querySelector('.am-tabrow');
    tr.append(tr.querySelector('.am-tally'), tr.querySelector('.am-sort'), tr.querySelector('.am-filter'));
    const paint = (r) => {
      const band = r ? [Math.max(800, r - 100), Math.max(1000, r + 200)] : [800, 1000];
      body.querySelector('.am-grid').innerHTML = rows.map((p) => card(p, band)).join('');
      const next = rows.find((p) => p.rating && !p.won && p.rating >= band[0] && p.rating <= band[1]);
      key.querySelector('.lede').textContent = r ? 'Your next fight is the first one at your level.' : 'Every problem is an episode. Ratings run from 800 to 3500: start with Daily Life.';
      key.querySelector('.am-next').innerHTML = next
        ? `<a class="am-btn hot big" href="${esc(next.href)}">Next episode</a><span class="what"><b>${esc(next.name)}</b><i style="color:var(--cf-rank-${rivalOf(next.contest, next.letter, next.rating).col})">${next.rating}</i> <i>${esc(next.id)}</i></span>`
        : `<a class="am-btn hot big" href="/problemset?tags=${band[0]}-${band[1]}">Find one at ${band[0]}–${band[1]}</a>`;
    };
    paint(me.rating);
    const won = rows.filter((p) => p.won).length, hurt = rows.filter((p) => p.hurt).length;
    body.querySelector('.am-tally').textContent = me.handle ? `${won} cleared · ${hurt} unfinished` : '';
    j.on(window, 'am:me', (e) => { if (e.detail.rating !== me.rating) { me.rating = e.detail.rating; paint(me.rating); } });
    const pg = document.querySelector('#pageContent .pagination');
    if (pg) j.move(pg, body.querySelector('.am-pages'));
    const drawer = j.make('<aside class="am-drawer am-side" hidden><button class="am-btn sm am-close" type="button">Close</button></aside>');
    k.side(j, drawer);
    j.insert(drawer, app);
    k.foot(j, app);
    j.on(body.querySelector('.am-filter'), 'click', () => { drawer.hidden = !drawer.hidden; });
    j.on(drawer.querySelector('.am-close'), 'click', () => { drawer.hidden = true; });
    const list = body.querySelector('.am-grid');
    j.on(list, 'click', (e) => {
      const star = e.target.closest('.am-star');
      if (star) {
        const img = rows.map((p) => p.star).find((x) => x && x.getAttribute('data-entityId') === star.dataset.id);
        if (img) { img.click(); star.classList.toggle('on'); }
        return;
      }
      if (e.target.closest('a, button')) return;
      const r = e.target.closest('.am-card');
      if (r) location.href = r.dataset.href;
    });
    let at = -1;
    j.on(document, 'keydown', (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const items = list.querySelectorAll('.am-card');
      if (e.key === '/') { const q = document.querySelector('#am-hud input.search'); if (q) { e.preventDefault(); q.focus(); } return; }
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

  /* ---- the episode (a problem page): a two-page spread. No arena: the show cuts in when you submit (onair.js) ---------------- */
  function episode(j, kit, me) {
    const k = K();
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
    const rating = tag ? +tag.slice(1) : k.seenOf(contest + letter);
    const rv = rivalOf(contest, letter, rating), arc = rating ? arcOf(rating) : 0, A = ARCS[arc];
    k.remember([[contest + letter, rating]]);
    const subs = [...document.querySelectorAll('#sidebar .roundbox')].find((b) => b.querySelector('a[href*="/submission/"]'));
    const won = !!(subs && subs.querySelector('.verdict-accepted'));
    const tries = subs ? subs.querySelectorAll('.verdict-rejected').length : 0;
    const lastV = subs && subs.querySelector('.verdict-rejected, .verdict-accepted, .verdict-failed');
    const val = (c) => { const e = hdr.querySelector(c); if (!e) return ''; const t = e.querySelector('.property-title'); return e.textContent.replace(t ? t.textContent : '', '').trim(); };
    const contestA = document.querySelector('#sidebar .rtable th a');
    const find = (re) => [...(side0 ? side0.querySelectorAll('a') : [])].find((a) => re.test(a.textContent));
    const tut = find(/Tutorial|Editorial|Разбор/i), ann = find(/Announcement|Анонс/i);
    const submit = /\/contest\/|\/gym\//.test(PATH) ? `/${/\/gym\//.test(PATH) ? 'gym' : 'contest'}/${contest}/submit/${letter}` : `/problemset/submit/${contest}/${letter}`;
    const fileIn = val('.input-file'), fileOut = val('.output-file'), std = /^standard/.test(fileIn) && /^standard/.test(fileOut);
    const handle = me.handle;
    const form = document.querySelector('form.submitFrameForm');
    const langSel = form && form.querySelector('select[name="programTypeId"]');
    const langs = langSel ? [...langSel.options].filter((o) => o.value).map((o) => ({ id: o.value, name: o.textContent.trim() })) : [];
    const multi = /number of test cases|test cases\b|количество наборов входных данных|количество тестов/i.test((ps.querySelector('.input-specification') || {}).textContent || '');
    const heroT = me.rating ? k.tierOf(me.rating) : Math.max(0, k.LADDER.findIndex((x) => x[1] === me.col));
    const inkVar = rating ? `var(--cf-rank-${rv.col})` : 'var(--cf-text-3)';
    const wall = sceneUrl(A.scene);
    const name = pm[2] || titleEl.textContent.trim();
    const memory = val('.memory-limit');
    const app = j.make(`<div id="am-root" class="am-spread arc-${arc}" style="--wall:var(--cf-scene-wall);--rival:${inkVar}"></div>`);
    const left = j.make(`<section class="am-left">
      <div class="am-spine" aria-hidden="true"><b class="jp">${A.jp}</b><span class="jp">第${esc(letter)}話</span></div>
      <div class="am-leaf">
      <header class="am-head2"><button class="am-headx" type="button" aria-label="Close the title" title="Close the title"></button>
        <div class="am-crumb"></div>
        <b class="am-hanko jp" title="Rival: ${esc(rv.name)}" aria-hidden="true">${rv.seal}</b>
        <h1>${esc(name)}</h1>
        <div class="stat"><b style="color:${inkVar}">${rating || 'Not rated yet'}</b>${rating ? `<span>${A.word}</span>` : ''}<span><i>Episode</i> ${esc(contest + letter)}</span><span><i>Rival</i> ${esc(rv.name)}</span>
          <span><i>Time</i> ${esc(val('.time-limit'))}</span><span><i>Memory</i> ${esc(memory)}</span>${std ? '' : `<span><i>In</i> ${esc(fileIn)}</span><span><i>Out</i> ${esc(fileOut)}</span>`}</div>
        <div class="acts">${tut ? `<a class="am-btn sm" href="${esc(tut.getAttribute('href'))}">${esc(tut.textContent.trim().replace(/^.*?(Tutorial|Editorial|Разбор).*$/i, '$1'))}</a>` : ''}${ann ? `<a class="am-btn sm" href="${esc(ann.getAttribute('href'))}">Announcement</a>` : ''}
          ${tagEls.length ? '<button class="am-btn sm am-tt" type="button">Show topics</button>' : ''}<button class="am-btn sm am-more" type="button">More</button>
          ${contestA ? `<a class="am-contest" href="${esc(contestA.getAttribute('href'))}">${esc(contestA.textContent.trim())}</a>` : ''}</div>
        <div class="am-topics" hidden>${tagEls.map((t) => t.textContent.trim()).filter((t) => !/^\*\d+$/.test(t)).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
      </header>
      <p class="am-prev" hidden></p>
      <main class="am-scroll"></main>
      </div>
    </section>`);
    const right = j.make(`<section class="am-right" id="px-duel">
      <div class="am-cmd2">
        <select class="am-lang" aria-label="Language"></select><span class="am-saved">Saved</span><button class="am-tool am-fscode" type="button" aria-label="Full view of the code" title="Full view of the code"></button>
        <button class="am-ontick" type="button" hidden title="Back to the broadcast"><i></i><span></span></button>
        <button class="am-btn am-run" type="button" title="Ctrl+'">Run samples</button><button class="am-btn hot am-sub" type="button" title="Ctrl+Enter">Submit</button>
      </div>
      <div class="am-edwrap"></div>
      <div class="am-hsplit b" role="separator" aria-label="Resize the notes" title="Drag to resize, double-click to reset"></div>
      <div class="am-loghead"><span>Notes</span><span class="r"><button class="am-tool am-fslog" type="button" aria-label="Full view of the notes" title="Full view of the notes"></button><button class="am-logtog" type="button" aria-label="Collapse the notes" title="Collapse"></button></span></div>
      <div class="am-log" role="log" aria-live="polite"></div>
    </section>`);
    const split = j.make('<div class="am-split"></div>');
    j.insert(left, split); j.insert(j.make('<div class="am-divider" role="separator" aria-label="Resize"></div>'), split); j.insert(right, split);
    j.insert(split, app);
    tabs(j, left.querySelector('.am-crumb'));
    j.move(holder, left.querySelector('.am-scroll'));
    const subBox = form && form.closest('.roundbox');
    if (subBox) j.cls(subBox, 'am-hide');
    const topicBox = tagEls[0] && tagEls[0].closest('.sidebox');
    if (topicBox) j.cls(topicBox, 'am-hide');
    const drawer = j.make('<aside class="am-drawer am-side" hidden><button class="am-btn sm am-close" type="button">Close</button></aside>');
    k.side(j, drawer);
    j.insert(drawer, app);
    k.foot(j, left.querySelector('.am-scroll'));
    j.on(left.querySelector('.am-more'), 'click', () => { drawer.hidden = !drawer.hidden; });
    j.on(drawer.querySelector('.am-close'), 'click', () => { drawer.hidden = true; });
    const tt = left.querySelector('.am-tt');
    if (tt) j.on(tt, 'click', () => { const box = left.querySelector('.am-topics'); box.hidden = !box.hidden; tt.textContent = box.hidden ? 'Show topics' : 'Hide topics'; });
    const div = split.querySelector('.am-divider');
    j.on(div, 'pointerdown', (e) => {
      e.preventDefault(); split.classList.add('drag'); div.setPointerCapture(e.pointerId);
      const move = (ev) => split.style.setProperty('--left', Math.max(26, Math.min(72, ev.clientX / innerWidth * 100)) + '%');
      const up = () => { split.classList.remove('drag'); div.removeEventListener('pointermove', move); div.removeEventListener('pointerup', up); div.removeEventListener('pointercancel', up); };
      div.addEventListener('pointermove', move); div.addEventListener('pointerup', up); div.addEventListener('pointercancel', up);
    });
    j.insert(app, document.body, document.getElementById('body'));
    const sink = j.make('<iframe aria-hidden="true" tabindex="-1" style="position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0;visibility:hidden"></iframe>');
    j.insert(sink, document.documentElement);

    /* previously on: where you left this episode, in a narrator's box */
    const prev = left.querySelector('.am-prev');
    const narrate = (t) => { prev.innerHTML = `<b class="jp">前回</b>${esc(t)}`; prev.hidden = !t; };
    if (won) narrate('You cleared this episode.');
    else if (lastV) narrate(`${lastV.textContent.replace(/\s+/g, ' ').trim()}.`);
    const pid = contest + letter;
    remember({ pid, name, href: PATH, rating, won });

    const rankInk = getComputedStyle(root).getPropertyValue(rating ? `--cf-rank-${rv.col}` : '--cf-text-2').trim();
    const art = { wall, calm: sceneUrl('golden-hour'), stand: heroUrl('stand'), strike: heroUrl('strike'), down: heroUrl('down') };
    const memKb = /(\d+)\s*megabyte/i.test(memory) ? +RegExp.$1 * 1024 : 0;
    const air = globalThis.__cftsAnimeOnAir.build({ j, app, tick: right.querySelector('.am-ontick'), art,
      ep: { tag: pid, name, jp: A.jp, seal: rv.seal, rival: rv.name, ink: rankInk || '#fff', rating, memKb },
      onVerdict: (kind, r) => {
        const cleared = kind === 'ac' || won;
        narrate(kind === 'ac' ? 'You cleared this episode.' : `${r.text}.`);
        remember({ pid, name, href: PATH, rating, won: cleared, v: kind === 'ac' ? '' : kind });
      },
      page: () => ({ mode: root.getAttribute('data-am-break-test') || undefined, land: arc, wall: (globalThis.__lctsAnimeScene || {}).wall || wall, stand: art.stand, strike: art.strike, seal: rv.seal, rival: rv.name, ink: rankInk, accent: getComputedStyle(root).getPropertyValue('--cf-accent').trim(), tech: TECH[arc], handle, name, limitMs: (/([\d.]+)\s*second/i.exec(val('.time-limit')) || [0, 0])[1] * 1000, limitKb: memKb }),
    });
    const anchor = j.make('<div hidden></div>');
    j.insert(anchor, app);
    const stage = {
      prefix: 'am', director: air,
      words: { ce: 'The storyboard came back: no test ran and this attempt costs nothing.', log: 'Waiting for a judge.', ready: 'Every sample matched. Ready to go on air.', hint: 'Read it, write your answer. Ctrl+Enter submits.' },
      intro: `Episode ${pid}: tonight's rival is ${rv.name}.`,
      sound: { cast: '-', press: '-', getup: 'guard', ready: 'guard', coin: 'tick-1', whiff: 'stumble', fizzle: 'stumble' },   // '-': Submit's sound is the launch, nothing plays over it
      preload() { globalThis.__cftsAnimeManga.preload(Object.values(art)); },
    };
    const duel = globalThis.__cftsPixelDuel.build({ j, theme: 'anime', stage, app, left, right, arena: anchor, log: right.querySelector('.am-log'), cmd: right.querySelector('.am-cmd2'), edwrap: right.querySelector('.am-edwrap'), sink,
      cid: contest, idx: letter, submitUrl: submit, handle, langs, defaultLang: langs[0] ? langs[0].id : '', multi, won, tries, monster: rv, speciesName: rv.name, land: arc, heroT, ink: '' });
    /* the setting is read once: a storage round trip per cue is a random delay on every sound. Cues stack (layer), and the offscreen page opens early for the card */
    const snd = { on: false, vol: 1 };
    air.bindSound((s) => { if (snd.on && globalThis.LCTSSounds) globalThis.LCTSSounds.play(s, { theme: 'anime', volume: snd.vol, layer: true }); });
    globalThis.__cftsAnimeApp.duel = duel;
    /* every time you open a problem: the card never waits for you, any key or click skips it */
    chrome.storage.local.get('cfMoments', (x) => {
      const m = (x && x.cfMoments) || {};
      snd.on = m.sound !== false; snd.vol = m.volume == null ? 1 : m.volume;
      try { if (snd.on && globalThis.LCTSSounds && globalThis.LCTSSounds.prime) globalThis.LCTSSounds.prime('anime'); } catch (e) { /* no sound is fine */ }
      if (m.titleCard !== false) air.coldOpen();
    });
    return true;
  }

  /* ---- a round's own page (/contest/N, /gym/N): its problems as this season's episodes. A running contest never gets here ---- */
  function round(j, kit, me) {
    const k = K();
    const rows = [...document.querySelectorAll('table.problems tr')].filter((tr) => tr.querySelector('td.id a')).map((tr) => {
      const a = tr.querySelector('td.id a'), href = a.getAttribute('href'), m = /\/(?:contest|gym)\/(\d+)\/problem\/(\w+)/.exec(href) || [], nm = tr.cells[1].querySelector('a'), last = tr.cells[tr.cells.length - 1], link = last.querySelector('a');
      return { href, id: a.textContent.trim(), contest: m[1] || '', letter: m[2] || a.textContent.trim(), name: nm ? nm.textContent.trim() : '', rating: k.seenOf((m[1] || '') + (m[2] || '')), tags: [], solved: +last.textContent.replace(/\D/g, '') || 0, solvedHref: link ? link.getAttribute('href') : '', won: tr.classList.contains('accepted-problem'), hurt: tr.classList.contains('rejected-problem'), star: null };
    });
    if (!rows.length) return false;
    const title = (document.querySelector('#sidebar .rtable th a') || document.querySelector('.contest-name') || {}).textContent || `Contest ${rows[0].contest}`;
    const div = kit.division(title), won = rows.filter((p) => p.won).length;
    const app = j.make('<div id="am-root" class="am-guide"></div>');
    j.insert(j.make(`<section class="am-key short"><div class="am-keyart" style="background-image:var(--cf-scene-wall)"></div><img class="am-keyhero" src="${heroUrl('strike')}" alt="" draggable="false">
      <div class="am-keytext">${div ? chip(kit, div) : ''}<h1 class="lg">${esc(title.trim())}</h1><p class="lede">${rows.length} episodes${won ? `, ${won} cleared` : ''}.</p>
      <div class="am-next"><a class="am-btn hot big" href="${esc((rows.find((p) => !p.won) || rows[0]).href)}">${won ? 'Next episode' : 'Start with episode A'}</a></div></div></section>`), app);
    const body = j.make('<div class="am-shelves"><div class="am-tabrow"><button class="am-btn sm am-filter" type="button">About this round</button></div><main class="am-grid"></main></div>');
    j.insert(body, app);
    tabs(j, body.querySelector('.am-tabrow'));
    const tr = body.querySelector('.am-tabrow');
    tr.append(tr.querySelector('.am-filter'));
    body.querySelector('.am-grid').innerHTML = rows.map((p) => card(p, null)).join('');
    const drawer = j.make('<aside class="am-drawer am-side" hidden><button class="am-btn sm am-close" type="button">Close</button></aside>');
    k.side(j, drawer);
    j.insert(drawer, app);
    k.foot(j, app);
    j.on(body.querySelector('.am-filter'), 'click', () => { drawer.hidden = !drawer.hidden; });
    j.on(drawer.querySelector('.am-close'), 'click', () => { drawer.hidden = true; });
    j.on(body.querySelector('.am-grid'), 'click', (e) => { if (e.target.closest('a, button')) return; const r = e.target.closest('.am-card'); if (r) location.href = r.dataset.href; });
    j.insert(app, document.body, document.getElementById('body'));
    return true;
  }

  /* ---- the door: /enter and /register. Codeforces' own form, moved in whole; a page without a password field stays Codeforces' own -- */
  function door(j) {
    const pc = document.getElementById('pageContent');
    const form = pc && [...pc.querySelectorAll('form')].find((f) => f.querySelector('input[type="password"]'));
    if (!form) return false;
    const reg = /register/.test(PATH);
    const app = j.make(`<div id="am-root" class="am-door" style="--wall:var(--cf-scene-wall)"><img class="hero" src="${heroUrl('stand')}" alt="" draggable="false">
      <section class="title"><b class="jp">${reg ? '第一話' : '再開'}</b><h1>${reg ? 'Every series has an Episode 1' : 'Your series continues'}</h1><p>${reg ? 'Make an account and yours starts at 800.' : 'Sign in to pick up where you left off.'}</p></section>
      <section class="form"><h2>${reg ? 'Create your account' : 'Sign in'}</h2><div class="slot"></div><div class="alt"></div><p class="swap">${reg ? 'Already have an account? <a href="/enter">Sign in</a>' : 'New here? <a href="/register">Create an account</a>'}</p></section></div>`);
    j.move(form, app.querySelector('.slot'));
    const alt = app.querySelector('.alt'), links = [...pc.querySelectorAll('a'), ...form.querySelectorAll('a')];
    const gmail = links.find((a) => /g-?mail|google/i.test(`${a.textContent} ${a.getAttribute('href')}`));
    if (gmail) {
      j.move(gmail, alt);
      j.cls(gmail, 'am-google');
      const t = [...gmail.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (t) j.text(t, reg ? 'Sign up with Google' : 'Continue with Google');
    }
    const forgot = links.find((a) => /forgot|password|пароль/i.test(`${a.textContent} ${a.getAttribute('href')}`) && a !== gmail);
    if (forgot && !form.contains(forgot)) j.move(forgot, app.querySelector('.slot'));
    j.insert(app, document.body, document.getElementById('body'));
    return true;
  }

  function mount(j, kit) {
    if (!globalThis.__cftsPixel) return false;
    const h = hud(j, kit);
    const me = h ? h.me : { handle: kit.myHandle(), rating: 0 };
    let ok = false, name = '';
    if (IS_GUIDE) { ok = guide(j, kit, me); name = 'guide'; }
    else if (IS_EPISODE) { ok = episode(j, kit, me); name = 'episode'; }
    else if (IS_DOOR) { ok = door(j); name = 'door'; }
    else if (IS_SCHEDULE && globalThis.__cftsAnimeSchedule) { ok = globalThis.__cftsAnimeSchedule.build({ j, kit, me, K, chip, posterAt }); name = 'schedule'; }
    else if (IS_CHARACTER && globalThis.__cftsAnimeCharacter) { ok = globalThis.__cftsAnimeCharacter.build({ j, me, K, ARCS, RIVALS, arcOf, poster, rivalOf, sceneUrl, heroUrl, tabs, handle: decodeURIComponent(PATH.split('/')[2]) }); name = 'character'; }
    else if (IS_HOME && globalThis.__cftsAnimeHome) { ok = globalThis.__cftsAnimeHome.build({ j, kit, me, K, heroUrl, shelf, chip, posterAt }); name = 'home'; }
    else if (IS_ROUND) { ok = round(j, kit, me); name = 'guide'; }
    else if (IS_GYM && globalThis.__cftsAnimeDojo) { ok = globalThis.__cftsAnimeDojo.gym({ j, K, heroUrl, posterAt }); name = 'schedule'; }
    else if (IS_RANK && globalThis.__cftsAnimeDojo) { ok = globalThis.__cftsAnimeDojo.ranking({ j, me, K, heroUrl, posterAt }); name = 'schedule'; }
    if (ok) j.attr(root, 'data-am-app', name);
    return ok;
  }
  globalThis.__cftsAnimeApp = { owns, mount };
})();
