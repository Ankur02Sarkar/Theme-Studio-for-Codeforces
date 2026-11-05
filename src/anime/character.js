/* =============================================================================
   anime/character.js  (content script)   登場人物, the character page: /profile/<handle> (ANIME.md)
   Not a status screen: the page an anime's official site gives its lead. Their story so far is told in SEASONS: a rank you reach for the
   first time opens a new one, so a career reads as a series, and the graph carries the season breaks. Then the rivals met, the greatest
   battle, the arcs cleared, the latest episodes. What the page shows draws first; the rest is the shared cached API (CFM_API).
============================================================================= */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const DAY = 86400;
  const month = (sec) => new Date(sec * 1000).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const WORD = { OK: 'Accepted', WRONG_ANSWER: 'Wrong answer', TIME_LIMIT_EXCEEDED: 'Time limit', MEMORY_LIMIT_EXCEEDED: 'Memory limit', RUNTIME_ERROR: 'Runtime error', COMPILATION_ERROR: 'Compile error', CHALLENGED: 'Hacked', SKIPPED: 'Skipped' };

  /* a rank reached for the first time opens a season, numbered as the HUD numbers ranks; falling back does not close one */
  function seasons(hist, tierOf) {
    const out = [];
    let top = -1;
    for (const h of hist) {
      const t = tierOf(h[4]), gain = h[4] - h[3];
      if (t > top || !out.length) { top = t; out.push({ t, from: h[5], n: 0, peak: 0, gain: -1e9, best: '', at: out.length ? hist.indexOf(h) : 0 }); }
      const s = out[out.length - 1];
      s.n++; s.peak = Math.max(s.peak, h[4]);
      if (gain > s.gain) { s.gain = gain; s.best = h[1]; }
    }
    return out;
  }
  /* the plot: the rank bands you are near, the climb filled under its line, every result readable, and the next rank in sight */
  function plot(hist, list, L) {
    const W = 900, H = 320, LEFT = 46, RIGHT = 54, TOP = 22, BOT = 26, n = hist.length, rs = hist.flatMap((h, i) => (i || h[3] ? [h[3], h[4]] : [h[4]]));
    const bands = L.slice(0, 7).map(([top, col, name], i) => ({ from: i ? L[i - 1][0] : 0, to: i === 6 ? 4000 : top, col, name }));
    const max = Math.max(...rs), now = hist[n - 1][4], nextB = bands.find((b) => now < b.to && b.to < 4000);
    const lo = Math.max(0, Math.floor((Math.min(...rs) - 100) / 100) * 100), hi = Math.max(max + 120, nextB ? nextB.to + 60 : max + 200);
    const y = (r) => TOP + (1 - (r - lo) / (hi - lo)) * (H - TOP - BOT);
    const t0 = hist[0][5], t1 = hist[n - 1][5], x = (i) => (n < 2 ? (LEFT + W - RIGHT) / 2 : n <= 14 ? LEFT + 16 + (hist[i][5] - t0) / (t1 - t0) * (W - LEFT - RIGHT - 32) : LEFT + 6 + i * (W - LEFT - RIGHT - 12) / (n - 1));
    const pts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h[4]).toFixed(1)}`), base = H - BOT;
    const ticks = n < 2 ? [0] : n < 5 ? [0, n - 1] : [0, Math.floor(n / 3), Math.floor(n * 2 / 3), n - 1];
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rating over time">
      ${bands.filter((b) => b.to > lo && b.from < hi).map((b) => { const y0 = y(Math.min(b.to, hi)), y1 = y(Math.max(b.from, lo)); return `<rect x="${LEFT}" y="${y0}" width="${W - LEFT - RIGHT}" height="${y1 - y0}" style="fill:var(--cf-rank-${b.col});opacity:.11"/><text class="bl" x="${W - RIGHT - 8}" y="${y0 + 15}" style="fill:var(--cf-rank-${b.col})">${esc(b.name)}</text>${b.to < hi ? `<line class="gd" x1="${LEFT}" x2="${W - RIGHT}" y1="${y0}" y2="${y0}" style="stroke:var(--cf-rank-${b.col})"/><text class="yl" x="${LEFT - 7}" y="${y0 + 4}">${b.to}</text>` : ''}`; }).join('')}
      ${list.slice(1).map((s) => `<line class="brk" x1="${x(s.at)}" x2="${x(s.at)}" y1="${TOP}" y2="${base}"/><text class="sn" x="${x(s.at) + 5}" y="${base - 6}">Season ${s.t + 1}</text>`).join('')}
      <polygon class="fl" points="${x(0)},${base} ${pts.join(' ')} ${x(n - 1)},${base}"/><polyline class="ln" points="${pts.join(' ')}"/>
      ${hist.map((h, i) => { const d = h[4] - h[3], lab = n <= 14; return `<g><circle class="${d >= 0 ? 'up' : 'dn'}" cx="${x(i)}" cy="${y(h[4])}" r="${lab ? 5 : 3.2}"><title>${esc(h[1])}: ${h[4]} (${d >= 0 ? '+' : ''}${d}), place ${num(h[2])}, ${month(h[5])}</title></circle>${lab ? `<text class="pv" x="${x(i)}" y="${y(h[4]) - 12}">${h[4]}</text><text class="dv ${d >= 0 ? 'up' : 'dn'}" x="${x(i)}" y="${y(h[4]) + 21}">${d >= 0 ? '+' : ''}${d}</text>` : ''}</g>`; }).join('')}
      ${nextB ? `<text class="go" x="${LEFT + 8}" y="${y(nextB.to) + 15}">${nextB.to - now} to ${esc(L[bands.indexOf(nextB) + 1][2])}</text>` : ''}
      ${ticks.map((i) => `<text class="xl" x="${x(i)}" y="${H - 7}">${month(hist[i][5])}</text>`).join('')}</svg>`;
  }
  /* the year on air: a block per month with a real gap between them, a square a day, the accent deepening with the work */
  function calendar(rows) {
    const days = new Map();
    for (const r of rows) { const k = new Date(r[1] * 1000).toDateString(); days.set(k, (days.get(k) || 0) + 1); }
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - 364);
    const months = [];
    let active = 0, sum = 0;
    for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.getFullYear() * 12 + d.getMonth();
      let m = months[months.length - 1];
      if (!m || m.key !== key) { m = { key, name: d.toLocaleDateString('en-GB', { month: 'short' }), first: d.getDay(), cells: [], cols: 0 }; months.push(m); }
      const n = days.get(d.toDateString()) || 0, l = !n ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 12 ? 3 : 4, col = Math.floor((m.first + m.cells.length) / 7);
      if (n) { active++; sum += n; }
      m.cols = Math.max(m.cols, col + 1);
      m.cells.push(`<i class="l${l}" style="grid-column:${col + 1};grid-row:${d.getDay() + 1}" title="${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}: ${n ? `${n} submission${n === 1 ? '' : 's'}` : 'nothing aired'}"></i>`);
    }
    return { html: `<div class="hm">${months.map((m) => `<div class="mn" style="--w:${m.cols}"><span>${m.cols > 2 ? m.name : ''}</span><div class="gr">${m.cells.join('')}</div></div>`).join('')}</div><div class="lg">Less <i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More</div>`, active, sum };
  }

  function build(c) {
    const { j, me, K, ARCS, RIVALS, arcOf, poster, rivalOf, sceneUrl, heroUrl, tabs, handle } = c, k = K(), L = k.LADDER;
    const box = document.querySelector('.userbox');
    if (!box) return false;
    const rankEl = box.querySelector('.user-rank > span'), photo = box.querySelector('.title-photo img');
    const m0 = /(?:Contest rating|Рейтинг)\s*:?\s*(\d+)/.exec(box.querySelector('.info').textContent.replace(/\s+/g, ' '));
    const rating0 = m0 ? +m0[1] : 0;
    const colOf = (el) => { const m = el && /user-(gray|green|cyan|blue|violet|orange|red|legendary)/.exec(el.className); return m ? m[1] : 'gray'; };
    const tierAt = (r, col) => (r ? k.tierOf(r) : Math.max(0, L.findIndex((x) => x[1] === col)));
    const t0 = tierAt(rating0, colOf(rankEl)), owner = me.handle && me.handle.toLowerCase() === handle.toLowerCase();
    const app = j.make(`<div id="am-root" class="am-char" style="--me:var(--cf-rank-${L[t0][1]})"></div>`);
    const lead = j.make(`<section class="am-lead"><div class="art" style="background-image:var(--cf-scene-wall)"></div>
      <img class="hero" src="${heroUrl('strike')}" alt="" draggable="false">
      <b class="kick jp" aria-hidden="true">登場人物</b>
      <div class="bio"><span class="sn"></span><h1><span class="nm">${esc(handle)}</span></h1><p class="rk">${esc(rankEl ? rankEl.textContent.trim() : 'Unrated')}</p>
        <dl class="facts"></dl></div>
      ${photo ? `<img class="ph" alt="" src="${esc(photo.getAttribute('src'))}">` : ''}</section>`);
    j.insert(lead, app);
    const body = j.make(`<div class="am-book"><div class="am-tabrow"></div><div class="grid"><main>
      <section class="story"><h2>The story so far</h2><div class="chart"><p class="wait">Reading the record…</p></div><ol class="seasons"></ol></section>
      <section class="cal"><header><h2>On air this year</h2><p class="sum"></p></header><div class="body"><p class="wait">Reading the record…</p></div></section>
      <section class="recent"><h2>Latest episodes</h2><div class="list"><p class="wait">Reading the record…</p></div></section></main>
      <aside><section class="rivals"><h2>Rivals met</h2><div class="seals">${RIVALS.map(([n, s], i) => `<a class="seal" data-t="${i}" href="/problemset?tags=${i ? L[i - 1][0] : 800}-${i === 7 ? 3500 : L[i][0] - 1}" title="${esc(n)}: find one"><b class="jp">${s}</b><span>${esc(n)}</span><em>Not met</em></a>`).join('')}</div></section>
      <section class="great" hidden><h2>Greatest battle</h2><a class="am-resume" href="#"></a></section>
      <section class="arcs"><h2>Episodes cleared</h2><div class="list">${ARCS.map((a, i) => `<div class="arc" style="--art:url('${esc(sceneUrl(a.scene))}')"><b class="jp">${a.jp}</b><span>${a.en}</span><em data-a="${i}">–</em></div>`).join('')}</div></section></aside></div></div>`);
    j.insert(body, app);
    tabs(j, body.querySelector('.am-tabrow'));
    const star = box.querySelector('img.friendStar, img.addFriend, img.removeFriend');
    if (star) j.move(star, lead.querySelector('h1'));
    const facts = lead.querySelector('.facts');
    const F = { rating: rating0 };
    const drawFacts = () => {
      const row = (a, b) => (b == null || b === '' ? '' : `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`);
      facts.innerHTML = row('Rating', F.rating ? num(F.rating) : 'Unrated') + row('Peak', F.peak ? num(F.peak) : '') + row('Contests', F.rounds == null ? '…' : num(F.rounds)) + row('Episodes cleared', F.won == null ? '…' : num(F.won)) + row('Best streak', F.best == null ? '' : `${F.best} days`) + row('Contribution', F.contrib == null ? '' : (F.contrib > 0 ? `+${F.contrib}` : F.contrib)) + row('Followers', F.fans == null ? '' : num(F.fans));
    };
    drawFacts();
    const sn = lead.querySelector('.sn');
    sn.textContent = rating0 || colOf(rankEl) !== 'gray' ? `Season ${t0 + 1}${owner ? ', now airing' : ''}` : '';
    k.foot(j, app);
    j.insert(app, document.body, document.getElementById('body'));

    const A = globalThis.CFM_API, off = () => !app.isConnected;
    const wait = (sel, t) => { const n = body.querySelector(sel); n.innerHTML = `<p class="wait">${esc(t)}</p>`; };
    if (!A) { wait('.chart', 'Codeforces data is not available on this page.'); wait('.recent .list', ''); return true; }
    A.userInfo(handle).then((u) => {
      if (off()) return;
      F.rating = u.rating || F.rating; F.peak = u.maxRating; F.contrib = u.contribution; F.fans = u.friendOfCount;
      if (u.rank) lead.querySelector('.rk').textContent = u.rank.replace(/(^| )\w/g, (x) => x.toUpperCase());
      drawFacts();
    }).catch(() => {});
    A.ratingOf(handle).then((hist) => {
      if (off()) return;
      F.rounds = hist.length; drawFacts();
      if (!hist.length) { wait('.chart', 'No rated contests yet: the first one starts this story.'); return; }
      const list = seasons(hist, k.tierOf);
      body.querySelector('.chart').innerHTML = plot(hist, list, L);
      body.querySelector('.seasons').innerHTML = list.map((s, i) => `<li class="${i === list.length - 1 ? 'now' : ''}" style="--c:var(--cf-rank-${L[s.t][1]})"><b>Season ${s.t + 1}</b><span class="nm">${esc(L[s.t][2])}</span><span>${num(s.n)} contest${s.n === 1 ? '' : 's'} from ${month(s.from)}, peak ${s.peak}</span><span class="best">Best episode: ${s.gain > 0 ? `+${s.gain}` : s.gain} in ${esc(s.best)}</span></li>`).reverse().join('');
    }).catch(() => wait('.chart', 'Could not read the rating history.'));
    Promise.all([A.problems(), A.statusOf(handle, me.handle)]).then(([probs, st]) => {
      if (off()) return;
      const byId = new Map(probs.map((p) => [p[0] + '' + p[1], p])), names = st.names || {};
      const info = (cid, idx) => { const p = byId.get(cid + '' + idx), n = names[cid + idx]; return { name: p ? p[2] : (n ? n[0] : `${cid}${idx}`), rating: p ? p[3] : (n ? n[1] : 0) }; };
      const seen = new Map();
      for (const r of [...st.rows].reverse()) if (r[4] === 'OK' && !seen.has(r[2] + r[3])) seen.set(r[2] + r[3], r);
      const beat = [...seen.values()].filter((r) => r[2] < 100000).map((r) => Object.assign(info(r[2], r[3]), { cid: r[2], idx: r[3] })).sort((a, b) => b.rating - a.rating);
      F.won = beat.length;
      const days = new Set(st.rows.map((r) => new Date(r[1] * 1000).toDateString()));
      let best = 0, run = 0;
      const now = Date.now();
      for (let i = 730; i >= 0; i--) { run = days.has(new Date(now - i * DAY * 1000).toDateString()) ? run + 1 : 0; best = Math.max(best, run); }
      F.best = best; drawFacts();
      const cal = calendar(st.rows);
      body.querySelector('.cal .body').innerHTML = cal.html;
      body.querySelector('.cal .sum').textContent = `${num(cal.sum)} submissions, ${cal.active} active days, best streak ${best} days`;
      const tiers = L.map(() => 0), arcs = [0, 0, 0, 0];
      for (const b of beat) if (b.rating) { tiers[k.tierOf(b.rating)]++; arcs[arcOf(b.rating)]++; }
      body.querySelectorAll('.seal').forEach((s) => { const n = tiers[+s.dataset.t]; if (!n) return; s.classList.add('met'); s.style.setProperty('--c', `var(--cf-rank-${L[+s.dataset.t][1]})`); s.querySelector('em').textContent = `${num(n)} beaten`; });
      body.querySelectorAll('[data-a]').forEach((e) => { e.textContent = num(arcs[+e.dataset.a]); });
      const top = beat.find((b) => b.rating);
      if (top) {
        const g = body.querySelector('.great'), r = rivalOf(top.cid, top.idx, top.rating), a = g.querySelector('a');
        a.href = `/problemset/problem/${top.cid}/${top.idx}`;
        a.innerHTML = `<i class="am-still" style="${poster(r)}"></i><span class="tx"><b>${esc(top.name)}</b><span style="color:var(--cf-rank-${r.col})">${top.rating} vs ${esc(r.name)}</span></span>`;
        g.hidden = false;
      }
      body.querySelector('.recent .list').innerHTML = st.rows.slice(0, 7).map((r) => {
        const p = info(r[2], r[3]), ok = r[4] === 'OK', rv = rivalOf(r[2], r[3], p.rating);
        return `<a class="ep" href="${r[2] >= 100000 ? `/gym/${r[2]}/problem/${r[3]}` : `/problemset/problem/${r[2]}/${r[3]}`}"><i class="am-still" style="${poster(rv)}"></i><span class="n">${esc(p.name)}</span><span class="v ${ok ? 'ok' : 'no'}">${esc(WORD[r[4]] || String(r[4] || 'Testing').replace(/_/g, ' ').toLowerCase())}</span></a>`;
      }).join('') || '<p class="wait">No episodes yet.</p>';
    }).catch((e) => { if (!off()) { wait('.recent .list', `Codeforces' API did not answer (${e.message}).`); F.won = 0; drawFacts(); } });
    return true;
  }
  globalThis.__cftsAnimeCharacter = { build };
})();
