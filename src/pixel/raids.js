/* =============================================================================
   pixel/raids.js  (content script)   the raid board, /contests (PIXEL.md)
   The one question here is "which round is for me, and when". The next round is a boss on its land with a live clock and
   a plain "rated for you"; the rounds after it are pins on a 30-day road; past rounds are the archive, with Enter, Virtual and
   Standings. Everything is read from the page; Register, Unregister and the filter are Codeforces' own links and form.
============================================================================= */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* a division's boss wears the division's colour: [species, land] */
  const BOSS = { div4: [1, 0], div3: [2, 1], div2: [3, 2], div1: [6, 3], edu: [3, 1], all: [5, 3], none: [4, 2] };
  const SPECIES = ['Slime', 'Goblin', 'Ghost', 'Golem', 'Warlock', 'Drake', 'Dragon', 'Elder'];
  const WHO = { div4: 'below 1400', div3: 'below 1600', div2: 'below 2100', div1: '1900 and up', edu: 'below 2100', all: 'everyone' };
  const ratedFor = (k, r) => ({ div4: r < 1400, div3: r < 1600, div2: r < 2100, div1: r >= 1900, edu: r < 2100, all: true }[k]);
  const secsOf = (el) => {
    const s = el && (el.querySelector('[title]') ? el.querySelector('[title]').getAttribute('title') : el.textContent);
    const m = /^(\d+):(\d\d):(\d\d)$/.exec((s || '').trim());
    return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
  };
  const clock = (s) => {
    const p = (x) => String(x).padStart(2, '0'), d = Math.floor(s / 86400);
    return `${d ? `${d}d ` : ''}${p(Math.floor(s % 86400 / 3600))}:${p(Math.floor(s % 3600 / 60))}:${p(s % 60)}`;
  };
  const shortWhen = (t) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function readUp(kit, rows) {
    return rows.map((tr) => {
      const [nameTd, byTd, , lenTd, stateTd, actTd] = tr.cells;
      const id = tr.getAttribute('data-contestid') || (/\/contests\/(\d+)/.exec(location.pathname) || [])[1] || '0';
      const name = nameTd.textContent.trim().split('\n')[0].trim();
      const k = kit.division(name) || 'none';
      const secs = secsOf(stateTd.querySelector('.countdown'));
      const reg = actTd.querySelector('a[href^="/contestRegistration/"]');
      const cnt = actTd.querySelector('a.contestParticipantCountLinkMargin');
      const closeEl = [...actTd.querySelectorAll('div')].find((d) => /Until closing|До закрытия/.test(d.textContent));
      const opensEl = /Before registration|До регистрации/.test(actTd.textContent) ? actTd.querySelector('.countdown') : null;
      const unreg = actTd.querySelector('a[href*="nregister" i], a[href*="Unregistration" i]');
      const enter = [...tr.querySelectorAll('a[href^="/contest/"]')][0];
      const done = /finished|final standings|завершен|итогов/i.test(stateTd.textContent);
      const live = !done && (/running|идёт|идет/i.test(stateTd.textContent) || (!secs && !!enter));
      return { id, name, done, stand: (stateTd.querySelector('a[href$="/standings"]') || { getAttribute: () => '' }).getAttribute('href'), k, by: [...byTd.querySelectorAll('a.rated-user')], len: lenTd.textContent.trim(), secs, live, start: secs != null ? Date.now() + secs * 1000 : 0,
        reg: reg && reg.getAttribute('href'), count: cnt ? +cnt.textContent.replace(/\D/g, '') : 0, countHref: cnt && cnt.getAttribute('href'), closeAt: closeEl ? Date.now() + (secsOf(closeEl.querySelector('.countdown')) || 0) * 1000 : 0,
        opensAt: opensEl ? Date.now() + (secsOf(opensEl) || 0) * 1000 : 0, unreg: unreg && unreg.getAttribute('href'), registered: !!unreg || (/registration completed|you are registered|вы зарегистрированы/i.test(actTd.textContent) && !reg), enter: enter && enter.getAttribute('href') };
    });
  }
  const chip = (kit, k) => { if (k === 'none') return ''; const [a, b, c] = kit.DIVS[k]; return `<span class="px-div" style="--c:var(--cf-rank-${c})" title="${esc(kit.DIVS[k][3])}"><b>${esc(a)}</b>${esc(b)}</span>`; };
  const handles = (list, n) => list.slice(0, n).map((a) => `<a class="${esc(a.className)}" href="${esc(a.getAttribute('href'))}">${esc(a.textContent)}</a>`).join(', ') + (list.length > n ? ` +${list.length - n}` : '');

  const bossOf = (X, c, size, extra = '') => X.sprite({ sp: BOSS[c.k][0], v: +c.id % 16, unknown: false }, size, extra);
  /* the round as a scene: its boss, the room, the bill, the clock */
  function raidScene(ctx, c, kick) {
    const { j, kit, page, me, X } = ctx;
    const heroAt = me.rating ? X.tierOf(me.rating) : 0;
    /* the crowd: the room filling up, a hero per doubling of the registrations; you stand at the front when you are in */
    const crowd = Math.min(11, Math.ceil(Math.log2(c.count + 1) * .9));
    const tiers = [0, 2, 1, 3, 0, 4, 1, 2, 5, 0, 3];
    const el = j.make(`<section class="px-raid land-${BOSS[c.k][1]}${c.live ? ' live' : ''}">
      <div class="stage"></div>
      <div class="crowd">${c.registered ? `<span class="you">${X.heroSprite(heroAt, 24, 'idle')}<em>You</em></span>` : ''}${Array.from({ length: crowd }, (_, i) => X.heroSprite(tiers[i], 24, 'idle')).join('')}</div>
      <div class="bossbox">${bossOf(X, c, 48, 'idle')}<i class="pad"></i></div>
      <div class="bill px-win"><div class="kick">${esc(kick)}</div>${chip(kit, c.k)}<h1>${esc(c.name)}</h1>
        <p class="when">${c.start ? `${esc(shortWhen(c.start))} · ` : ''}${esc(c.len)} h${c.by.length ? ` · by ${handles(c.by, 3)}` : ''}</p>
        <p class="rated"></p></div>
      <div class="clockbox px-win"><div class="lbl">${c.done ? 'Finished' : c.live ? 'Running' : 'Starts in'}</div><div class="digits">${c.secs != null ? clock(c.secs) : ''}</div>
        ${c.done ? `${c.enter ? `<a class="px-btn gold wide big" href="${esc(c.enter)}">Enter</a>` : ''}${c.stand ? `<a class="un" href="${esc(c.stand)}">Standings</a>` : ''}`
    : c.live && c.enter ? `<a class="px-btn gold wide big" href="${esc(c.enter)}">Enter the raid</a>` : c.reg ? `<a class="px-btn gold wide big" href="${esc(c.reg)}">Register</a>` : c.registered ? '<div class="in">You are registered</div>' : c.opensAt ? `<div class="opens">Registration opens in <b data-to="${c.opensAt}"></b></div>` : ''}
        ${c.unreg ? `<a class="un" href="${esc(c.unreg)}">Unregister</a>` : ''}
        <div class="sub">${c.count ? `<a href="${esc(c.countHref)}">${c.count.toLocaleString('en-US')} registered</a>` : ''}${c.closeAt && c.reg ? `<span>closes in <b data-to="${c.closeAt}"></b></span>` : ''}</div></div>
    </section>`);
    j.insert(el, page);
    const forYou = (r) => {
      const p = el.querySelector('.rated');
      if (c.k === 'none' || (c.done && !c.join)) { p.textContent = ''; return; }
      const yes = ratedFor(c.k, r);
      p.className = `rated ${!r ? '' : yes ? 'ok' : 'no'}`;
      p.textContent = !r ? `Rated for ${WHO[c.k]}` : yes ? `Rated for you: your ${r} is in range (${WHO[c.k]})` : `Not rated for you: this one is for ${WHO[c.k]}`;
    };
    forYou(me.rating);
    j.on(window, 'px:me', (e) => { forYou(e.detail.rating); });
    const dig = el.querySelector('.digits'), end = c.start;
    if (end) j.every(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      dig.textContent = clock(s);
      dig.classList.toggle('soon', s < 300);
    }, 1000);
    return el;
  }
  const stamper = (j, page) => {
    const stamps = () => page.querySelectorAll('[data-to]').forEach((b) => { const s = Math.max(0, Math.round((+b.dataset.to - Date.now()) / 1000)); b.textContent = s > 172800 ? `${Math.floor(s / 86400)} days` : clock(s); });
    stamps();
    j.every(stamps, 1000);
  };

  /* /contests/<id>: one round. Its table row is read by shape: the page has no saved copy, so anything else stays Codeforces' page */
  function single(ctx) {
    const { j, kit, page, X } = ctx;
    const tr = [...document.querySelectorAll('#pageContent .datatable table tr')].find((t) => t.cells.length >= 6 && t.querySelector('td'));
    if (!tr) return false;
    const c = readUp(kit, [tr])[0];
    if (!c.name) return false;
    raidScene(ctx, c, c.done ? 'Past raid' : c.live ? 'Raid in progress' : 'Raid');
    const more = document.querySelector('#pageContent a[href*="contestRegistrants"], #pageContent a[href*="/standings"]');
    j.insert(j.make(`<section class="px-win px-facts"><h2>About this raid</h2><dl>
      <dt>Who it is for</dt><dd>${c.k === 'none' ? 'See the announcement' : esc(WHO[c.k])}</dd>
      <dt>Length</dt><dd>${esc(c.len)} h</dd>
      ${c.by.length ? `<dt>Written by</dt><dd>${handles(c.by, 12)}</dd>` : ''}
      ${c.count ? `<dt>Registered</dt><dd>${esc(c.count.toLocaleString('en-US'))}</dd>` : ''}
      ${more ? `<dt>Full list</dt><dd><a href="${esc(more.getAttribute('href'))}">Open it</a></dd>` : ''}
    </dl></section>`), page);
    j.insert(j.make('<a class="px-back" href="/contests">All raids</a>'), page);
    stamper(j, page);
    return true;
  }

  /* /contestRegistration/<id>: Codeforces' own form, moved in whole so its token and handler stay */
  function join(ctx) {
    const { j, kit, page } = ctx;
    const form = document.querySelector('#pageContent form');
    if (!form) return false;
    const id = (/\/contestRegistration\/(\d+)/.exec(location.pathname) || [])[1] || '0';
    const head = [...document.querySelectorAll('#pageContent h1, #pageContent h2, #pageContent h3, #pageContent .caption, #pageContent .contest-name')].map((e) => e.textContent.trim()).find(Boolean) || '';
    const name = head.replace(/^(registration( for( the)?)?|register( for)?|регистрация( на)?)\s*(contest|соревнование)?\s*:?\s*/i, '').trim() || `Contest ${id}`;
    const k = kit.division(name) || 'none';
    const el = raidScene(ctx, { id, name, k, by: [], len: '', count: 0, secs: null, start: 0, done: true, join: true }, 'Join the raid');
    el.classList.add('join');
    el.querySelector('.clockbox').remove();
    el.querySelector('.when').remove();
    const box = j.make('<section class="px-win px-join"><h2>The rules of the raid</h2></section>');
    j.insert(box, page);
    j.move(form, box);
    j.insert(j.make(`<a class="px-back" href="/contests/${esc(id)}">Back to the raid</a>`), page);
    return true;
  }

  function build(ctx) {
    const { j, kit, page, me, side, X } = ctx;
    const ups = readUp(kit, [...document.querySelectorAll('.contestList > .datatable table tr')].filter((tr) => tr.cells.length >= 6 && tr.getAttribute('data-contestid')));
    const boss = (c, size, extra = '') => bossOf(X, c, size, extra);
    const next = ups.find((c) => c.live) || ups[0];
    const later = ups.filter((c) => c !== next);
    if (next) raidScene(ctx, next, next.live ? 'Raid in progress' : 'Next raid');
    else j.insert(j.make('<section class="px-win px-noraid"><h1>Raids</h1><p>No round is scheduled right now.</p></section>'), page);

    /* the road: thirty days, a pin per round */
    if (later.length) {
      const now = Date.now(), span = 30 * 86400000;
      const on = later.filter((c) => c.start && c.start - now < span);
      /* rounds close together stand on each other's shoulders */
      const lanes = [];
      const pin = (c) => {
        const x = (c.start - now) / span * 100;
        let lane = lanes.findIndex((end) => x - end > 4.2);
        if (lane < 0) lane = lanes.length;
        lanes[lane] = x;
        return `<a class="pin" style="left:${x.toFixed(2)}%;--l:${lane}" href="/contests/${esc(c.id)}" title="${esc(c.name)} · ${esc(shortWhen(c.start))}">${boss(c, 24)}</a>`;
      };
      const ticks = [0, 7, 14, 21, 28].map((d) => `<span style="left:${d / 30 * 100}%">${d ? new Date(now + d * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Today'}</span>`).join('');
      const row = (c) => `<div class="px-urow"><a class="sp" href="/contests/${esc(c.id)}">${boss(c, 24)}</a>
        <div class="c"><div class="t">${chip(kit, c.k)}<a href="/contests/${esc(c.id)}">${esc(c.name)}</a></div><div class="m">${c.start ? esc(shortWhen(c.start)) : ''} · ${esc(c.len)} h${c.by.length ? ` · by ${handles(c.by, 2)}` : ''}</div></div>
        <div class="w"><b data-to="${c.start}"></b>${me.rating && c.k !== 'none' ? `<span class="${ratedFor(c.k, me.rating) ? 'ok' : 'no'}">${ratedFor(c.k, me.rating) ? 'Rated for you' : 'Not rated for you'}</span>` : ''}</div>
        <div class="a">${c.reg ? `<a class="px-btn gold" href="${esc(c.reg)}">Register</a>` : c.registered ? '<span class="in">Registered</span>' : c.opensAt ? `<span class="op">Opens in <b data-to="${c.opensAt}"></b></span>` : ''}</div></div>`;
      const pinned = on.map(pin).join('');
      j.insert(j.make(`<section class="px-win px-road" style="--lanes:${Math.max(1, lanes.length)}"><h2>Coming up</h2>${on.length ? `<div class="line"><div class="pins">${pinned}</div><div class="ruler">${ticks}</div></div>` : ''}<div class="rows">${later.map(row).join('')}</div></section>`), page);
    }

    /* the archive and the guide */
    const cols = j.make(`<div class="px-cols"><main class="px-win px-past"><h2>Past raids</h2><p class="lead">Enter to read the problems. Virtual replays the round against the clock, under contest conditions.</p><div class="rows"></div><div class="px-pages"></div></main>
      <aside class="px-side"><section class="px-win px-guide"><h2>Which raid is mine?</h2><div class="g"></div><p>New here? Start with a Div. 4 or Div. 3 round: they begin around 800.</p></section></aside></div>`);
    j.insert(cols, page);
    const guide = (r) => {
      cols.querySelector('.g').innerHTML = ['div4', 'div3', 'div2', 'div1'].map((k) => `<div class="${r ? (ratedFor(k, r) ? 'yes' : 'not') : ''}">${chip(kit, k)}<span>${WHO[k]}</span>${r && ratedFor(k, r) ? '<i>You</i>' : ''}</div>`).join('');
    };
    guide(me.rating);
    j.on(window, 'px:me', (e) => guide(e.detail.rating));
    const rows = cols.querySelector('.rows');
    for (const tr of document.querySelectorAll('.contests-table .datatable table tr')) {
      if (tr.cells.length < 6 || !tr.getAttribute('data-contestid')) continue;
      const [nameTd, byTd, startTd, lenTd, stateTd, partTd] = tr.cells;
      const id = tr.getAttribute('data-contestid');
      const name = ([...nameTd.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim()) || {}).nodeValue || nameTd.textContent;
      const c = { id, k: kit.division(name) || 'none' };
      const links = [...nameTd.querySelectorAll('a')];
      const enter = links.find((a) => !/virtual/i.test(a.getAttribute('href'))), virt = links.find((a) => /virtual/i.test(a.getAttribute('href')));
      const stand = stateTd.querySelector('a[href$="/standings"]');
      const cnt = partTd.querySelector('a');
      const n = cnt ? +cnt.textContent.replace(/\D/g, '') : 0;
      const by = [...byTd.querySelectorAll('a.rated-user')];
      const row = j.make(`<div class="px-prow" data-href="${esc(enter ? enter.getAttribute('href') : `/contest/${id}`)}"><span class="sp">${boss(c, 24)}</span>
        <div class="c"><div class="t">${chip(kit, c.k)}<a href="${esc(enter ? enter.getAttribute('href') : `/contest/${id}`)}">${esc(name.trim())}</a></div><div class="m"><span class="d"></span> · ${esc(lenTd.textContent.trim())} h${n ? ` · ${n.toLocaleString('en-US')} took part` : ''}${by.length ? ` · by ${handles(by, 2)}` : ''}</div></div>
        <div class="a">${enter ? `<a class="px-btn" href="${esc(enter.getAttribute('href'))}">Enter</a>` : ''}${virt ? `<a class="px-btn" href="${esc(virt.getAttribute('href'))}">Virtual</a>` : ''}${stand ? `<a class="px-btn" href="${esc(stand.getAttribute('href'))}">Standings</a>` : ''}</div></div>`);
      /* Codeforces' own date nodes: its script turns them into your time zone */
      const dt = startTd.querySelector('.format-date') || startTd.querySelector('.format-time');
      if (dt) j.move(dt, row.querySelector('.d'));
      rows.append(row);
    }
    j.on(rows, 'click', (e) => { if (e.target.closest('a')) return; const r = e.target.closest('.px-prow'); if (r) location.href = r.dataset.href; });
    const pg = document.querySelector('.contests-table .pagination, #pageContent .pagination');
    if (pg) j.move(pg, cols.querySelector('.px-pages'));
    stamper(j, page);
    const pay = [...document.querySelectorAll('#sidebar > .roundbox')].find((b) => b.querySelector('.contest-state-phase'));
    if (pay) j.cls(pay, 'px-hide');                 // the bill above says it
    side(j, cols.querySelector('.px-side'));
  }
  globalThis.__cftsPixelRaids = { build, single, join, SPECIES, readUp, WHO, ratedFor, clock };   // the readers: Anime's schedule reads the same rows
})();
