/* =============================================================================
   pixel/profile.js  (content script)   the hero's status screen (PIXEL.md)
   /profile/<handle>: the hero in their gear, the rating as a journey, and the Monster Collection: every problem they ever
   beat, as the same creature it was in the Book, strongest first. A new species is a real milestone; the empty slots show
   what is left to meet. What the page shows draws first; the rest comes from the LeetCode theme's cached API layer
   (CFM_API: user.info, user.rating, user.status, problemset.problems), one call at a time, 2.3 s apart.
============================================================================= */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const DAY = 86400, TROPHIES = 126;
  const ago = (sec) => { const d = Math.floor((Date.now() / 1000 - sec) / DAY); return d < 1 ? 'today' : d === 1 ? 'yesterday' : d < 60 ? `${d} days ago` : d < 730 ? `${Math.round(d / 30)} months ago` : `${Math.round(d / 365)} years ago`; };
  const WORD = { OK: 'Accepted', WRONG_ANSWER: 'Wrong answer', TIME_LIMIT_EXCEEDED: 'Time limit', MEMORY_LIMIT_EXCEEDED: 'Memory limit', RUNTIME_ERROR: 'Runtime error', COMPILATION_ERROR: 'Compile error', CHALLENGED: 'Hacked', SKIPPED: 'Skipped', IDLENESS_LIMIT_EXCEEDED: 'Idleness' };
  const dayOf = (sec) => { const d = new Date(sec * 1000); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

  /* the rating as a journey: rank bands named, ratings marked, dates under it, a line on the grid (fillRect only: no blur) */
  function journey(wrap, hist, X) {
    const canvas = wrap.querySelector('canvas'), tip = wrap.querySelector('.tip');
    wrap.querySelectorAll('.ax').forEach((n) => n.remove());
    const CW = canvas.clientWidth, CH = canvas.clientHeight;
    const W = Math.floor(CW / 2) || 300, H = Math.floor(CH / 2) || 100;
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const rs = hist.map((h) => h[4]);
    const L = X.LADDER.slice(0, 7).map(([top, col, name], i) => ({ from: i ? X.LADDER[i - 1][0] : 0, to: i === 6 ? 4000 : top, col, name }));
    /* the view: from the band under the lowest rating to the top of the band above the highest, so the next rank is in sight */
    const minB = L.findIndex((b) => Math.min(...rs) < b.to), maxB = L.findIndex((b) => Math.max(...rs) < b.to);
    const lo = L[minB].from, hi = L[Math.min(6, maxB + 1)].to === 4000 ? Math.max(...rs) + 300 : L[Math.min(6, maxB + 1)].to;
    const LEFT = 28, BOTTOM = 10, TOP = 4;     // grid cells kept for the axis text
    const y = (r) => Math.round(TOP + (1 - (r - lo) / (hi - lo)) * (H - TOP - BOTTOM));
    const ax = (cls, text, st) => { const d = document.createElement('span'); d.className = 'ax ' + cls; d.textContent = text; d.style.cssText = st; wrap.append(d); };
    for (const b of L) {
      if (b.to <= lo || b.from >= hi) continue;
      const y0 = y(Math.min(b.to, hi)), y1 = y(Math.max(b.from, lo));
      const ink = css.getPropertyValue(`--cf-rank-${b.col}`).trim() || '#888';
      c.fillStyle = ink; c.globalAlpha = .16; c.fillRect(LEFT, y0, W - LEFT, y1 - y0); c.globalAlpha = .55; c.fillRect(LEFT, y0, W - LEFT, 1); c.globalAlpha = 1;
      ax('band', b.name, `top:${y0 * 2 + 4}px;color:${ink}`);
      if (b.to < hi) ax('y', b.to, `top:${y0 * 2 - 7}px`);
    }
    ax('y', lo, `top:${y(lo) * 2 - 7}px`);
    const n = hist.length, x = (i) => (n < 2 ? Math.floor((LEFT + W) / 2) : LEFT + 6 + Math.round(i * (W - LEFT - 16) / (n - 1)));
    c.fillStyle = '#ffcd75';
    for (let i = 1; i < n; i++) {
      let x0 = x(i - 1), y0 = y(hist[i - 1][4]);
      const x1 = x(i), y1 = y(hist[i][4]), dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {          // Bresenham: a real pixel line
        c.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += 1; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    for (let i = 0; i < n; i++) {
      const up = hist[i][4] >= hist[i][3];
      c.fillStyle = '#09080f'; c.fillRect(x(i) - 3, y(hist[i][4]) - 3, 7, 7);
      c.fillStyle = up ? '#8be05c' : '#ff6f86'; c.fillRect(x(i) - 2, y(hist[i][4]) - 2, 5, 5);
      if (n <= 12) ax('val', hist[i][4], `left:${x(i) * 2 - 14}px;top:${y(hist[i][4]) * 2 - 26}px`);
    }
    const date = (sec) => new Date(sec * 1000).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const marks = n < 2 ? [0] : n < 5 ? [0, n - 1] : [0, Math.floor(n / 2), n - 1];
    for (const i of marks) ax('x', date(hist[i][5]), `left:${Math.min(CW - 70, Math.max(0, x(i) * 2 - 28))}px`);
    canvas.onmousemove = (e) => {
      const r = canvas.getBoundingClientRect(), mx = (e.clientX - r.left) / 2;
      let best = 0;
      for (let i = 1; i < n; i++) if (Math.abs(x(i) - mx) < Math.abs(x(best) - mx)) best = i;
      const h = hist[best], d = h[4] - h[3];
      tip.hidden = false;
      tip.style.left = Math.min(r.width - 260, Math.max(0, x(best) * 2 - 120)) + 'px';
      tip.style.top = (y(h[4]) * 2 > 90 ? y(h[4]) * 2 - 76 : y(h[4]) * 2 + 16) + 'px';
      tip.innerHTML = `<b>${esc(h[1])}</b><span>${h[4]} (${d >= 0 ? '+' : ''}${d}) · place ${num(h[2])} · ${date(h[5])}</span>`;
    };
    canvas.onmouseleave = () => { tip.hidden = true; };
  }

  function build(ctx) {
    const { j, X, page, handle, me } = ctx;
    const box = document.querySelector('.userbox');
    const rankEl = box && box.querySelector('.user-rank > span');
    const photo = box && box.querySelector('.title-photo img');
    const factText = box ? box.querySelector('.info').textContent.replace(/\s+/g, ' ') : '';
    const m0 = /(?:Contest rating|Рейтинг)\s*:?\s*(\d+)/.exec(factText);
    const rating0 = m0 ? +m0[1] : 0;
    const colOf = (el) => { const m = el && /user-(gray|green|cyan|blue|violet|orange|red|legendary)/.exec(el.className); return m ? m[1] : 'gray'; };
    const tierAt = (r, col) => (r ? X.tierOf(r) : Math.max(0, X.LADDER.findIndex((x) => x[1] === col)));
    const t0 = tierAt(rating0, colOf(rankEl));
    const owner = me.handle && me.handle.toLowerCase() === handle.toLowerCase();
    const el = j.make(`<div class="px-status">
      <section class="px-card land-${X.landOf(Math.max(800, rating0))}">
        <div class="stage"><i class="px-hero s48 ghost" style="--c:${Math.min(7, t0 + 1)}" title="What you become next"></i><span class="nextl" hidden></span><i class="px-hero s48 idle" style="--c:${t0}"></i>${photo ? `<img class="ph" alt="" src="${esc(photo.getAttribute('src'))}">` : ''}</div>
        <div class="who px-win"><h1 class="name">${esc(handle)}</h1><div class="rank">${esc(rankEl ? rankEl.textContent.trim() : 'Unrated')}</div>
          <div class="lvl"><b>Lv ${rating0 || '–'}</b><span class="next"></span></div><div class="rungs"></div><div class="xpn"><span class="a"></span><span class="b"></span></div><div class="meta"></div></div>
      </section>
      <section class="px-right2">
        <div class="px-stats"></div>
        <div class="px-win px-journey"><div class="jhead"><h2>Rating history</h2><div class="key"><span><i style="background:#8be05c"></i>rating went up</span><span><i style="background:#ff6f86"></i>went down</span><span>Hover a point for the contest</span></div></div><div class="wrap"><canvas></canvas><div class="tip px-tip" hidden></div><p class="none" hidden>No rated contests yet: your first one starts this line.</p></div></div>
      </section>
    </div>`);
    j.insert(el, page);
    const wall = j.make(`<section class="px-win px-wall"><header><h2>Monster Collection</h2><p class="sum">Scouting…</p></header><p class="lead">Every problem you solve becomes a monster here. The harder the problem, the stronger the species: solve a problem at a new difficulty to discover the next one.</p><div class="kinds"></div><h3 hidden>Your monsters, hardest first</h3><div class="grid"></div></section>`);
    j.insert(wall, page);
    const low = j.make(`<div class="px-low"><section class="px-win px-cal"><header><h2>Activity</h2><p class="sum"></p></header><div class="board"><div class="wk"></div><div class="cal"></div><div class="tip px-tip" hidden></div></div><div class="legend"></div></section>
      <section class="px-win px-recent"><h2>Recent battles</h2><div class="list"><p class="wait">Scouting…</p></div></section></div>`);
    j.insert(low, page);

    const paintInfo = (u) => {
      const r = u.rating || 0, t = tierAt(r, colOf(rankEl)), L = X.LADDER;
      const col = L[t][1], lo = t ? L[t - 1][0] : 0, top = L[t][0], next = L[t + 1];
      el.style.setProperty('--me', `var(--cf-rank-${col})`);
      el.querySelector('.px-hero:not(.ghost)').style.setProperty('--c', t);
      el.querySelector('.px-card').className = `px-card land-${X.landOf(Math.max(800, r))}`;
      el.querySelector('.lvl b').textContent = r ? `Lv ${r}` : 'Lv –';
      if (u.rank) el.querySelector('.rank').textContent = u.rank.replace(/(^| )\w/g, (x) => x.toUpperCase());
      const ghost = el.querySelector('.ghost');
      ghost.hidden = !next; if (next) { ghost.style.setProperty('--c', t + 1); ghost.title = `${next[2]}: what you become next`; }
      const lab = el.querySelector('.nextl'); lab.hidden = !next; if (next) lab.textContent = `At ${next[2]} you become this`;
      /* one bar: the whole road, Newbie to Grandmaster, a stretch per rank; the current stretch fills as far as you are */
      const frac = r ? Math.min(1, (r - lo) / (Math.min(top, 3000) - lo)) : 0;
      el.querySelector('.rungs').innerHTML = L.slice(0, 7).map(([, c, name], i) => {
        const w = i < t ? 100 : i === Math.min(t, 6) ? Math.round(frac * 50) * 2 : 0;
        return `<span title="${esc(name)}"${i === t ? ' class="cur"' : ''}><i style="width:${w}%;background:var(--cf-rank-${c})"></i></span>`;
      }).join('');
      el.querySelector('.next').textContent = next ? `Next rank: ${next[2]}` : 'The top of the ladder';
      if (r && next) { el.querySelector('.xpn .a').textContent = `${r} / ${top}`; el.querySelector('.xpn .b').textContent = `${top - r} more to ${next[2]}`; }
      if (r) el.querySelector('.lvl b').textContent = `Lv ${r}`;
      return u;
    };
    /* someone else's profile: Codeforces' own star adds them to your friends */
    const star = box && box.querySelector('img.friendStar, img.addFriend, img.removeFriend');
    if (star) j.move(star, el.querySelector('.name'));
    /* your party: Codeforces' API lists friends only with a key, so your /friends page is read once an hour */
    if (owner) {
      const party = j.make(`<section class="px-win px-party"><header><h2>Your party</h2><a href="/friends">All friends</a></header><div class="list"><p class="wait">Calling your party…</p></div></section>`);
      j.insert(party, low, low.firstElementChild);
      const COL = { gray: 0, green: 1, cyan: 2, blue: 3, violet: 4, orange: 5, red: 6, legendary: 7 };
      const draw = (rows) => {
        party.querySelector('.list').innerHTML = rows.length ? rows.slice(0, 24).map((f) => `<a class="fr" href="/profile/${esc(f.h)}">${X.heroSprite(COL[f.c] || 0, 24)}<span class="user-${esc(f.c)}" style="color:var(--cf-rank-${f.c === 'legendary' ? 'red' : esc(f.c)})">${esc(f.h)}</span></a>`).join('') : '<p class="wait">No friends yet: press the star on any profile to add one.</p>';
      };
      chrome.storage.local.get('cfPxParty', (s0) => {
        const c0 = s0.cfPxParty;
        if (c0 && c0.handle === me.handle && Date.now() - c0.at < 3600000) return draw(c0.rows);
        fetch('/friends', { credentials: 'include' }).then((r) => r.text()).then((t) => {
          if (!party.isConnected) return;
          const d = new DOMParser().parseFromString(t, 'text/html'), seen0 = new Set(), rows = [];
          for (const a of d.querySelectorAll('#pageContent a.rated-user')) {
            const h = (a.getAttribute('href') || '').split('/').pop();
            if (!h || seen0.has(h) || h.toLowerCase() === me.handle.toLowerCase()) continue;
            seen0.add(h); rows.push({ h, c: (/user-(gray|green|cyan|blue|violet|orange|red|legendary)/.exec(a.className) || [])[1] || 'gray' });
          }
          chrome.storage.local.set({ cfPxParty: { handle: me.handle, at: Date.now(), rows } });
          draw(rows);
        }).catch(() => { party.querySelector('.list').innerHTML = '<p class="wait">Could not read your friends. <a href="/friends">Open the list</a></p>'; });
        return undefined;
      });
    }
    const shot = el.querySelector('.ph');
    if (shot) shot.addEventListener('error', () => { shot.hidden = true; });      // Codeforces' own picture, never swapped for the API's copy
    const stats = el.querySelector('.px-stats');
    const stat = (k, v, sub = '') => `<div class="px-win"><span class="k">${esc(k)}</span><b>${esc(v)}</b>${sub ? `<span class="s">${esc(sub)}</span>` : ''}</div>`;
    const drawStats = (S) => { stats.innerHTML = stat('Peak level', S.peak || '–', S.peakRank) + stat('Monsters beaten', S.won == null ? '…' : num(S.won)) + stat('Contests', S.rounds == null ? '…' : num(S.rounds)) + stat('Best streak', S.best == null ? '…' : `${S.best} d`, S.cur ? `now ${S.cur} d` : '') + stat('Contribution', S.contrib == null ? '…' : (S.contrib > 0 ? `+${S.contrib}` : S.contrib)) + stat('Followers', S.fans == null ? '…' : num(S.fans)); };
    const S = {};
    drawStats(S);

    const A = globalThis.CFM_API;
    const fail = (where, msg) => { where.innerHTML = `<p class="wait">${esc(msg)}</p>`; };
    if (!A) { wall.querySelector('.sum').textContent = 'Codeforces data is not available on this page.'; return; }
    const off = () => !el.isConnected;
    A.userInfo(handle).then((u) => {
      if (off()) return;
      paintInfo(u);
      S.peak = u.maxRating || 0; S.peakRank = u.maxRank || ''; S.contrib = u.contribution; S.fans = u.friendOfCount;
      drawStats(S);
    }).catch(() => {});
    A.ratingOf(handle).then((hist) => {
      if (off()) return;
      S.rounds = hist.length; drawStats(S);
      const cv = el.querySelector('canvas'), wrap = el.querySelector('.px-journey .wrap');
      if (!hist.length) { cv.hidden = true; el.querySelector('.none').hidden = false; return; }
      journey(wrap, hist, X);
      j.on(window, 'resize', () => journey(wrap, hist, X));
    }).catch(() => { el.querySelector('.none').textContent = 'Could not read the rating history.'; el.querySelector('.none').hidden = false; el.querySelector('canvas').hidden = true; });

    Promise.all([A.problems(), A.statusOf(handle, me.handle)]).then(([probs, st]) => {
      if (off()) return;
      const byId = new Map(probs.map((p) => [p[0] + '' + p[1], p]));
      const names = st.names || {};
      const info = (cid, idx) => { const p = byId.get(cid + '' + idx), n = names[cid + idx]; return { name: p ? p[2] : (n ? n[0] : `${cid}${idx}`), rating: p ? p[3] : (n ? n[1] : 0) }; };
      const seen = new Map();
      for (const r of [...st.rows].reverse()) if (r[4] === 'OK' && !seen.has(r[2] + r[3])) seen.set(r[2] + r[3], r);
      const beaten = [...seen.values()].map((r) => Object.assign(info(r[2], r[3]), { cid: r[2], idx: r[3], sec: r[1], gym: r[2] >= 100000 })).filter((b) => !b.gym).sort((a, b) => b.rating - a.rating || b.sec - a.sec);
      S.won = beaten.length;
      /* streaks: days with any submission */
      const days = new Map();
      for (const r of st.rows) { const k = dayOf(r[1]); days.set(k, (days.get(k) || 0) + 1); }
      let best = 0, run = 0, cur = 0;
      const today = new Date(); today.setHours(12, 0, 0, 0);
      for (let i = 730; i >= 0; i--) { const k = dayOf(today.getTime() / 1000 - i * DAY); run = days.has(k) ? run + 1 : 0; if (run > best) best = run; }
      for (let i = 0; i < 730; i++) { if (days.has(dayOf(today.getTime() / 1000 - i * DAY))) cur++; else if (i) break; }
      S.best = best; S.cur = cur; drawStats(S);

      /* the collection */
      const counts = X.SPECIES.map(() => 0);
      for (const b of beaten) if (b.rating) counts[X.tierOf(b.rating)]++;
      const top = beaten.find((b) => b.rating);
      const found = counts.filter(Boolean).length;
      wall.querySelector('.sum').textContent = beaten.length ? `${num(beaten.length)} problems solved · ${found} of 8 species found${top ? ` · hardest: ${top.rating}` : ''}${st.limited ? ' · from your latest 1,000 submissions' : ''}` : 'Nothing solved yet: the Monster Book is waiting.';
      const hunted = (i) => { const v = (handle.length * 7 + i * 5) % 16; return { sp: i, v }; };
      const range = (i) => (i ? X.LADDER[i - 1][0] : 800);
      const rangeText = (i) => (i === 0 ? 'below 1200' : i === 7 ? '3000+' : `${range(i)}–${X.LADDER[i][0] - 1}`);
      wall.querySelector('.kinds').innerHTML = X.SPECIES.map((name, i) => {
        const sprite = `<i class="px-spr s24" style="--c:${hunted(i).v * 2};--r:${i}"></i>`;
        if (counts[i]) return `<div class="kind">${sprite}<b>${esc(name)}</b><span class="r">${rangeText(i)}</span><span class="n">${num(counts[i])} solved</span></div>`;
        return `<a class="kind locked" href="/problemset?tags=${range(i)}-${i === 7 ? 3500 : X.LADDER[i][0] - 1}" title="Open problems rated ${rangeText(i)}">${sprite}<b>${esc(name)}</b><span class="r">${rangeText(i)}</span><span class="n">Find one</span></a>`;
      }).join('');
      wall.querySelector('h3').hidden = !beaten.length;
      /* the strongest of each species, so a veteran's wall shows the whole road, not one row of dragons */
      const taken = X.SPECIES.map(() => 0), shown = [];
      const cap = Math.max(14, Math.floor(TROPHIES / Math.max(1, counts.filter(Boolean).length)));
      for (const b of beaten) { const k = b.rating ? X.tierOf(b.rating) : 0; if (taken[k] < cap && shown.length < TROPHIES) { taken[k]++; shown.push(b); } }
      const href = (b) => `/problemset/problem/${b.cid}/${b.idx}`;
      wall.querySelector('.grid').innerHTML = shown.map((b) => {
        const mon = X.monster(b.cid, b.idx, b.rating);
        return `<a class="tr" href="${esc(href(b))}" title="${esc(b.name)}">${X.sprite(mon, 24)}<span style="color:${b.rating ? `var(--cf-rank-${mon.col})` : 'var(--px-ink-3)'}">${b.rating || '?'}</span></a>`;
      }).join('') + (beaten.length > shown.length ? `<span class="more">+${num(beaten.length - shown.length)}</span>` : '');

      /* recent battles */
      const recent = st.rows.slice(0, 6);
      low.querySelector('.px-recent .list').innerHTML = recent.length ? recent.map((r) => {
        const p = info(r[2], r[3]), mon = X.monster(r[2], r[3], p.rating), ok = r[4] === 'OK';
        return `<a class="bt" href="${r[2] >= 100000 ? `/gym/${r[2]}/problem/${r[3]}` : `/problemset/problem/${r[2]}/${r[3]}`}">${X.sprite(mon, 24, ok ? '' : 'alive')}<span class="n">${esc(p.name)}</span><span class="v ${ok ? 'ok' : 'no'}">${esc(WORD[r[4]] || String(r[4] || 'Testing').replace(/_/g, ' ').toLowerCase())}</span><span class="w">${ago(r[1])}</span></a>`;
      }).join('') : '<p class="wait">No battles yet.</p>';

      /* the training log: a year, a square a day */
      const start = new Date(today); start.setDate(start.getDate() - 364);
      /* a block per month, a real gap between them */
      const months = [];
      let active = 0;
      for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
        const key = d.getFullYear() * 12 + d.getMonth();
        let m = months[months.length - 1];
        if (!m || m.key !== key) { m = { key, name: d.toLocaleDateString('en-GB', { month: 'short' }), first: d.getDay() - (d.getDate() - 1) % 7, cells: [], cols: 0 }; m.first = (d.getDay() + 7) % 7; months.push(m); }
        const n = days.get(dayOf(d.getTime() / 1000)) || 0, l = n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 12 ? 3 : 4;
        if (n) active++;
        const col = Math.floor((m.first + m.cells.length) / 7);
        m.cols = Math.max(m.cols, col + 1);
        m.cells.push(`<i class="l${l}" style="grid-column:${col + 1};grid-row:${d.getDay() + 1}" data-t="${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}|${n}"></i>`);
      }
      const cal = low.querySelector('.cal'), tip = low.querySelector('.board .tip'), board = low.querySelector('.board');
      cal.innerHTML = months.map((m) => `<div class="m" style="--w:${m.cols}"><span>${m.cols > 2 ? m.name : ''}</span><div class="gr">${m.cells.join('')}</div></div>`).join('');
      const fit = () => {
        const cols = months.reduce((a, m) => a + m.cols, 0), w = cal.clientWidth - (months.length - 1) * 10;
        board.style.setProperty('--cell', Math.max(6, Math.floor(w / cols) - 2) + 'px');
      };
      fit();
      j.on(window, 'resize', fit);
      low.querySelector('.wk').innerHTML = ['', 'Mon', '', 'Wed', '', 'Fri', ''].map((x) => `<span>${x}</span>`).join('');
      low.querySelector('.legend').innerHTML = 'Less <i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More';
      const yr = st.rows.filter((r) => r[1] > Date.now() / 1000 - 365 * DAY);
      low.querySelector('.px-cal .sum').textContent = `${num(yr.length)} submissions in the last year · ${active} active days · longest streak ${best} days`;
      j.on(cal, 'mousemove', (e) => {
        const c = e.target.closest('i');
        if (!c) { tip.hidden = true; return; }
        const [dt, n] = c.dataset.t.split('|'), b = low.querySelector('.board').getBoundingClientRect(), r = c.getBoundingClientRect();
        tip.hidden = false;
        tip.style.left = Math.min(b.width - 244, Math.max(0, r.left - b.left - 100)) + 'px';
        tip.style.top = (r.top - b.top - 52) + 'px';
        tip.innerHTML = `<b>${esc(dt)}</b><span>${n === '0' ? 'No submissions' : `${n} submission${n === '1' ? '' : 's'}`}</span>`;
      });
      j.on(cal, 'mouseleave', () => { tip.hidden = true; });
    }).catch((e) => {
      if (off()) return;
      wall.querySelector('.sum').textContent = `Codeforces' API did not answer (${e.message}).`;
      fail(low.querySelector('.px-recent .list'), 'Could not read the battles.');
      S.won = 0; drawStats(S);
    });
  }
  globalThis.__cftsPixelProfile = { build };
})();
