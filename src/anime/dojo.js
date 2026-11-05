/* =============================================================================
   anime/dojo.js  (content script)   道場, the Gym, and 番付, the power ranking (ANIME.md)
   /gyms: training rounds, each with a poster in its difficulty's colour, and Enter, Virtual, Standings. Unrated: said plainly.
   /ratings: 番付 is the ranked list a sumo tournament posts. The top three stand on the page, everyone else is a line, your own row is marked.
   No saved copy of /ratings: its table is read by what it is (a row with a rated handle and a rating); anything else stays Codeforces' page.
============================================================================= */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const GYM = [null, ['Very easy', 'green', 1], ['Easy', 'cyan', 2], ['Medium', 'blue', 3], ['Hard', 'orange', 5], ['Very hard', 'red', 6]];
  const hero = (j, app, c, heroUrl) => j.insert(j.make(`<section class="am-key short"><div class="am-keyart" style="background-image:var(--cf-scene-wall)"></div><img class="am-keyhero" src="${heroUrl('strike')}" alt="" draggable="false">
      <div class="am-keytext"><span class="jp" aria-hidden="true">${c.jp}</span><h1>${esc(c.title)}</h1><p class="lede">${esc(c.lede)}</p></div></section>`), app);

  function gym({ j, K, heroUrl, posterAt }) {
    const k = K(), table = document.querySelector('#pageContent .datatable table');
    const rows = table ? [...table.rows].filter((tr) => tr.cells.length >= 5 && tr.querySelector('td')) : [];
    if (!rows.length) return false;
    const app = j.make('<div id="am-root" class="am-dojo"></div>');
    hero(j, app, { jp: '道場', title: 'Gym', lede: 'Past ICPC regionals, olympiads and school contests, for training. They are unrated: your rating never changes here.' }, heroUrl);
    const cols = j.make('<div class="am-cols"><main class="am-reruns"><div class="am-tabrow"></div><div class="rows"></div><div class="am-pages"></div></main><aside class="am-side"></aside></div>');
    j.insert(cols, app);
    const main = cols.querySelector('.am-reruns'), list = cols.querySelector('.rows');
    k.tabs(j, cols.querySelector('.am-tabrow'));
    const nav = cols.querySelector('.px-tabs');
    if (nav) nav.className = 'am-tabs'; else main.querySelector('.am-tabrow').remove();
    rows.forEach((tr, at) => {
      const [nameTd, startTd, lenTd, stateTd, infoTd] = tr.cells;
      const links = [...nameTd.querySelectorAll(':scope > a')], enter = links.find((a) => !/virtual/i.test(a.getAttribute('href'))), virt = links.find((a) => /virtual/i.test(a.getAttribute('href')));
      const name = ([...nameTd.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim()) || {}).nodeValue || nameTd.textContent;
      const id = +(/\d+/.exec((enter && enter.getAttribute('href')) || '') || [at])[0], href = enter ? enter.getAttribute('href') : '#';
      const stars = infoTd.querySelector(':scope > div[title]'), n = stars ? stars.querySelectorAll('img').length : 0, w = GYM[n];
      const st = stateTd.querySelector('a[href$="/standings"]');
      const facts = [...infoTd.querySelectorAll(':scope > div.small')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()).filter((t) => !/description/i.test(t)).map((t) => t.replace(/^Statements:\s*/, '').replace(/\bin /g, ''));
      const row = j.make(`<div class="am-rerun" data-href="${esc(href)}"><i class="am-still" style="${posterAt(w ? w[2] : -1, id)}"></i>
        <div class="c"><div class="t"><a href="${esc(href)}">${esc(name.trim())}</a></div>
          <div class="m">${w ? `<span class="dif" style="--c:var(--cf-rank-${w[1]})" title="${esc(stars.getAttribute('title') || '')}"><u>${'★'.repeat(n)}</u>${esc(w[0])}</span>` : ''}<span class="d"></span><span>${esc(lenTd.textContent.trim())} h</span>${facts.map((t) => `<span>${esc(t)}</span>`).join('')}</div></div>
        <div class="a">${enter ? `<a class="am-btn sm" href="${esc(href)}">Enter</a>` : ''}${virt ? `<a class="am-btn sm" href="${esc(virt.getAttribute('href'))}">Virtual</a>` : ''}${st ? `<a class="am-btn sm" href="${esc(st.getAttribute('href'))}">Standings</a>` : ''}</div></div>`);
      /* Codeforces' own date node: its script turns it into your time zone */
      const dt = startTd.querySelector('.format-date, .format-time');
      if (dt) j.move(dt, row.querySelector('.d'));
      list.append(row);
    });
    j.on(list, 'click', (e) => { if (e.target.closest('a')) return; const r = e.target.closest('.am-rerun'); if (r) location.href = r.dataset.href; });
    const pg = document.querySelector('#pageContent .pagination');
    if (pg) j.move(pg, cols.querySelector('.am-pages'));
    k.side(j, cols.querySelector('.am-side'));
    k.foot(j, app);
    j.insert(app, document.body, document.getElementById('body'));
    return true;
  }

  function ranking({ j, me, K, heroUrl, posterAt }) {
    const k = K();
    const rows = [...document.querySelectorAll('#pageContent .datatable table tr')].map((tr) => {
      const a = tr.querySelector('a.rated-user'), cells = [...tr.cells];
      if (!a || cells.length < 3) return null;
      const flag = tr.querySelector('img[src*="flags"]');
      return { a, rank: +(/\d+/.exec(cells[0].textContent) || [0])[0], rounds: cells.length > 3 ? cells[cells.length - 2].textContent.trim() : '', rating: +cells[cells.length - 1].textContent.replace(/\D/g, ''), flag: flag && flag.getAttribute('src') };
    }).filter((r) => r && r.rating);
    if (rows.length < 3) return false;
    const app = j.make('<div id="am-root" class="am-rank"></div>');
    const mine = me.handle && rows.find((r) => r.a.textContent.trim().toLowerCase() === me.handle.toLowerCase());
    hero(j, app, { jp: '番付', title: 'The strongest', lede: mine ? `You stand at number ${mine.rank.toLocaleString('en-US')}.` : 'Every rated programmer, in order of rating.' }, heroUrl);
    const who = (r) => `<a class="${esc(r.a.className)}" href="${esc(r.a.getAttribute('href'))}">${esc(r.a.textContent.trim())}</a>`;
    const top = rows[0].rank === 1 ? rows.slice(0, 3) : [], rest = rows.slice(top.length);
    if (top.length) j.insert(j.make(`<section class="am-podium">${top.map((r, i) => `<div class="pl p${i}"><i class="am-still" style="${posterAt(k.tierOf(r.rating), r.rank * 3 + 1)}"></i><b class="no" aria-hidden="true">${r.rank}</b><div class="tx"><span class="rk">No. ${r.rank}</span><span class="nm">${who(r)}</span><b class="rt">${r.rating.toLocaleString('en-US')}</b></div></div>`).join('')}</section>`), app);
    const cols = j.make(`<div class="am-cols"><main class="am-board"><div class="am-tabrow"></div><div class="hd"><span>#</span><span>Programmer</span><span>Contests</span><span>Rating</span></div><div class="rows">${rest.map((r) => `<div class="ln${r === mine ? ' me' : ''}"><span class="n">${r.rank.toLocaleString('en-US')}</span><span class="w">${r.flag ? `<img src="${esc(r.flag)}" alt="">` : ''}${who(r)}</span><span>${esc(r.rounds)}</span><b style="color:var(--cf-rank-${k.LADDER[k.tierOf(r.rating)][1]})">${r.rating.toLocaleString('en-US')}</b></div>`).join('')}</div><div class="am-pages"></div></main><aside class="am-side"></aside></div>`);
    j.insert(cols, app);
    k.tabs(j, cols.querySelector('.am-tabrow'));
    const nav = cols.querySelector('.px-tabs');
    if (nav) nav.className = 'am-tabs'; else cols.querySelector('.am-tabrow').remove();
    const pg = document.querySelector('#pageContent .pagination');
    if (pg) j.move(pg, cols.querySelector('.am-pages'));
    k.side(j, cols.querySelector('.am-side'));
    k.foot(j, app);
    j.insert(app, document.body, document.getElementById('body'));
    return true;
  }
  globalThis.__cftsAnimeDojo = { gym, ranking };
})();
