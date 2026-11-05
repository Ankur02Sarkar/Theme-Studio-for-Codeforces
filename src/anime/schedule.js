/* =============================================================================
   anime/schedule.js  (content script)   番組表, the broadcast schedule: /contests (ANIME.md)
   Contests are programmes. What's on next is a preview with a live clock and a plain "rated for you"; after it a TV listing, grouped
   Tonight / Tomorrow / by day, with a bar for each slot's length; past rounds are the Reruns. Rows are read by raids.js's readers.
   Register, Unregister, the filter and every link are Codeforces' own.
============================================================================= */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hhmm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  function dayName(t) {
    const d = new Date(t), now = new Date(), a = new Date(now.getFullYear(), now.getMonth(), now.getDate()), b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const n = Math.round((b - a) / 86400000);
    return n === 0 ? ['今夜', 'Today'] : n === 1 ? ['明日', 'Tomorrow'] : ['', d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })];
  }
  const hours = (len) => { const m = /^(\d+):(\d\d)/.exec(len || ''); return m ? +m[1] + +m[2] / 60 : 2; };
  const TIER = { div4: 1, div3: 2, div2: 3, edu: 3, all: 5, div1: 6, none: -1 };
  const handles = (list, n) => list.slice(0, n).map((a) => `<a class="${esc(a.className)}" href="${esc(a.getAttribute('href'))}">${esc(a.textContent)}</a>`).join(', ') + (list.length > n ? ` +${list.length - n}` : '');

  function build({ j, kit, me, K, chip, posterAt }) {
    const R = globalThis.__cftsPixelRaids, k = K();
    const ups = R.readUp(kit, [...document.querySelectorAll('.contestList > .datatable table tr')].filter((tr) => tr.cells.length >= 6 && tr.getAttribute('data-contestid')));
    const past = [...document.querySelectorAll('.contests-table .datatable table tr')].filter((tr) => tr.cells.length >= 6 && tr.getAttribute('data-contestid'));
    if (!ups.length && !past.length) return false;
    const next = ups.find((c) => c.live) || ups[0], later = ups.filter((c) => c !== next);
    const app = j.make('<div id="am-root" class="am-sched"></div>');
    const ratedLine = (c, r) => (c.k === 'none' ? '' : !r ? `Rated for ${R.WHO[c.k]}` : R.ratedFor(c.k, r) ? `Rated for you: your ${r} is in range (${R.WHO[c.k]})` : `Not rated for you: this one is for ${R.WHO[c.k]}`);

    if (next) {
      const act = next.live && next.enter ? `<a class="am-btn hot big" href="${esc(next.enter)}">Enter</a>` : next.reg ? `<a class="am-btn hot big" href="${esc(next.reg)}">Register</a>` : next.registered ? '<span class="in">You are registered</span>' : next.opensAt ? `<span class="in">Registration opens in <b data-to="${next.opensAt}"></b></span>` : '';
      const pv = j.make(`<section class="am-air-next${next.live ? ' live' : ''}"><div class="art" style="background-image:var(--cf-scene-wall)"></div>
        <b class="kick jp" aria-hidden="true">${next.live ? '放送中' : '次回予告'}</b>
        <div class="bill">${chip(kit, next.k)}<h1>${esc(next.name)}</h1>
          <p class="when">${next.start ? `${esc(new Date(next.start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}, ${hhmm(next.start)}` : ''}${next.len ? ` for ${esc(next.len)} h` : ''}${next.by.length ? `. Written by ${handles(next.by, 3)}` : ''}</p>
          <p class="rated"></p></div>
        <div class="clock"><small>${next.live ? 'On air' : 'Starts in'}</small><div class="dig">${next.secs != null ? R.clock(next.secs) : ''}</div>
          <div class="go">${act}${next.unreg ? `<a class="un" href="${esc(next.unreg)}">Unregister</a>` : ''}</div>
          <p class="meta">${next.count ? `<a href="${esc(next.countHref)}">${next.count.toLocaleString('en-US')} registered</a>` : ''}${next.closeAt && next.reg ? ` Closes in <b data-to="${next.closeAt}"></b>` : ''}</p></div></section>`);
      j.insert(pv, app);
      const paint = (r) => { const p = pv.querySelector('.rated'), yes = r && next.k !== 'none' && R.ratedFor(next.k, r); p.textContent = ratedLine(next, r); p.className = `rated${r ? (yes ? ' ok' : ' no') : ''}`; };
      paint(me.rating);
      j.on(window, 'am:me', (e) => paint(e.detail.rating));
      if (next.start) { const dig = pv.querySelector('.dig'); j.every(() => { dig.textContent = R.clock(Math.max(0, Math.round((next.start - Date.now()) / 1000))); }, 1000); }
    } else j.insert(j.make('<section class="am-air-next none"><b class="kick jp" aria-hidden="true">番組表</b><div class="bill"><h1>Nothing scheduled</h1><p class="when">Codeforces has no upcoming round listed. Reruns are below.</p></div></section>'), app);

    const cols = j.make(`<div class="am-cols"><main class="am-listing"></main><aside class="am-side"><section class="am-ladder"><h2>Which round is mine?</h2><div class="g"></div><p>New here? Start with a Div. 4 or Div. 3 round: they begin around 800.</p></section></aside></div>`);
    j.insert(cols, app);
    const main = cols.querySelector('.am-listing');
    if (later.length) {
      const groups = [];
      for (const c of later) { const [jp, en] = c.start ? dayName(c.start) : ['', 'Later']; let g = groups.find((x) => x.en === en); if (!g) groups.push(g = { jp, en, list: [] }); g.list.push(c); }
      const slot = (c) => `<div class="am-slot"><i class="am-still" style="${posterAt(TIER[c.k], +c.id)}"></i><span class="at">${c.start ? hhmm(c.start) : '–'}</span>
        <div class="c"><div class="t">${chip(kit, c.k)}<a href="/contests/${esc(c.id)}">${esc(c.name)}</a></div>
          <div class="m"><i class="len" style="--h:${Math.min(5, hours(c.len)) / 5}" title="${esc(c.len)} h"></i><span>${esc(c.len)} h</span>${me.rating && c.k !== 'none' ? `<span class="${R.ratedFor(c.k, me.rating) ? 'ok' : 'no'}">${R.ratedFor(c.k, me.rating) ? 'Rated for you' : 'Not rated for you'}</span>` : ''}${c.by.length ? `<span>by ${handles(c.by, 2)}</span>` : ''}</div></div>
        <div class="w">in <b data-to="${c.start}"></b></div>
        <div class="a">${c.reg ? `<a class="am-btn hot sm" href="${esc(c.reg)}">Register</a>` : c.registered ? '<span class="in">Registered</span>' : c.opensAt ? `<span class="op">Opens in <b data-to="${c.opensAt}"></b></span>` : ''}</div></div>`;
      j.insert(j.make(`<section class="am-tv"><h2><b class="jp" aria-hidden="true">番組表</b>Coming up</h2>${groups.map((g) => `<h3>${g.jp ? `<b class="jp" aria-hidden="true">${g.jp}</b>` : ''}${esc(g.en)}</h3>${g.list.map(slot).join('')}`).join('')}</section>`), main);
    }
    const reruns = j.make('<section class="am-reruns"><h2><b class="jp" aria-hidden="true">再放送</b>Reruns</h2><p class="lead">Past contests. Enter opens the problems; Virtual replays the round against the clock, under contest conditions.</p><div class="rows"></div><div class="am-pages"></div></section>');
    j.insert(reruns, main);
    const rows = reruns.querySelector('.rows');
    for (const tr of past) {
      const [nameTd, byTd, startTd, lenTd, stateTd, partTd] = tr.cells;
      const id = tr.getAttribute('data-contestid');
      const name = ([...nameTd.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim()) || {}).nodeValue || nameTd.textContent;
      const links = [...nameTd.querySelectorAll('a')];
      const enter = links.find((a) => !/virtual/i.test(a.getAttribute('href'))), virt = links.find((a) => /virtual/i.test(a.getAttribute('href')));
      const stand = stateTd.querySelector('a[href$="/standings"]'), cnt = partTd.querySelector('a');
      const n = cnt ? +cnt.textContent.replace(/\D/g, '') : 0, href = enter ? enter.getAttribute('href') : `/contest/${id}`;
      const row = j.make(`<div class="am-rerun" data-href="${esc(href)}"><i class="am-still" style="${posterAt(TIER[kit.division(name) || 'none'], +id)}"></i><div class="c"><div class="t">${chip(kit, kit.division(name) || 'none')}<a href="${esc(href)}">${esc(name.trim())}</a></div><div class="m"><span class="d"></span><span>${esc(lenTd.textContent.trim())} h</span>${n ? `<span>${n.toLocaleString('en-US')} took part</span>` : ''}${byTd.querySelector('a.rated-user') ? `<span>by ${handles([...byTd.querySelectorAll('a.rated-user')], 2)}</span>` : ''}</div></div>
        <div class="a">${enter ? `<a class="am-btn sm" href="${esc(href)}">Enter</a>` : ''}${virt ? `<a class="am-btn sm" href="${esc(virt.getAttribute('href'))}">Virtual</a>` : ''}${stand ? `<a class="am-btn sm" href="${esc(stand.getAttribute('href'))}">Standings</a>` : ''}</div></div>`);
      /* Codeforces' own date nodes: its script turns them into your time zone */
      const dt = startTd.querySelector('.format-date') || startTd.querySelector('.format-time');
      if (dt) j.move(dt, row.querySelector('.d'));
      rows.append(row);
    }
    j.on(rows, 'click', (e) => { if (e.target.closest('a')) return; const r = e.target.closest('.am-rerun'); if (r) location.href = r.dataset.href; });
    const pg = document.querySelector('.contests-table .pagination, #pageContent .pagination');
    if (pg) j.move(pg, reruns.querySelector('.am-pages'));
    const ladder = (r) => { cols.querySelector('.g').innerHTML = ['div4', 'div3', 'div2', 'div1'].map((d) => `<div class="${r ? (R.ratedFor(d, r) ? 'yes' : 'not') : ''}">${chip(kit, d)}<span>${R.WHO[d]}</span>${r && R.ratedFor(d, r) ? '<i>You</i>' : ''}</div>`).join(''); };
    ladder(me.rating);
    j.on(window, 'am:me', (e) => ladder(e.detail.rating));
    const stamps = () => app.querySelectorAll('[data-to]').forEach((b) => { const s = Math.max(0, Math.round((+b.dataset.to - Date.now()) / 1000)); b.textContent = s > 172800 ? `${Math.floor(s / 86400)} days` : R.clock(s); });
    stamps();
    j.every(stamps, 1000);
    const pay = [...document.querySelectorAll('#sidebar > .roundbox')].find((b) => b.querySelector('.contest-state-phase'));
    if (pay) j.cls(pay, 'am-hide');
    k.side(j, cols.querySelector('.am-side'));
    k.foot(j, app);
    j.insert(app, document.body, document.getElementById('body'));
    return true;
  }
  globalThis.__cftsAnimeSchedule = { build };
})();
