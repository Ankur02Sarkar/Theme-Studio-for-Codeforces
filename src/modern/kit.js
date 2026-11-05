/* =============================================================================
   kit.js  (isolated world, every LeetCode-theme page)   MODERN.md, "Premium pass" (Oct 28 2026)
   What the theme's pages share, so they look like one product:
   - the site bar (LeetCode's 50 px nav): the Codeforces mark, Problems / Contest / Discuss / Gym, a search field
     (Enter opens the Problems list filtered by it), Notifications, Donate, your avatar with its menu
   - Notifications: built from what the theme already keeps (no request): rounds starting soon (cfmUpcoming), your
     latest rating change (cfmRatings), your latest verdicts (cfmStatus). Seen ones are remembered (cfmNotiSeen).
   - the solved gauge (LeetCode's open ring, one arc per difficulty) for the Problems page and the profile
   - CFM_KIT_CSS: appended to each app's shadow root after its own sheet
   There is no way back to Codeforces' layout from the page: the theme is changed from the extension's popup only.
============================================================================= */
(() => {
  'use strict';
  if (globalThis.CFM_KIT) return;
  const DONATE_URL = 'https://extensions.vinaytz.com/support';   // the popup's Support link (src/support.js)

  /* ---- icons: Lucide (ISC, licenses/lucide-ISC.txt) ----------------------------------------------------------------- */
  const IC = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    list: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    cal: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    up: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    down: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    ok: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    x: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    grad: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  };
  const ic = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const N = (n) => Number(n).toLocaleString('en-US');

  /* Codeforces' mark: the three bars (its own colours; this IS Codeforces) */
  const LOGO = '<svg class="cfmark" viewBox="0 0 28 24" aria-hidden="true"><rect x="1" y="9" width="7" height="14" rx="1.6" fill="#f7c23a"/><rect x="10.5" y="2" width="7" height="21" rx="1.6" fill="#3f8ae0"/><rect x="20" y="6" width="7" height="17" rx="1.6" fill="#d8443c"/></svg>';

  /* ---- what the page says about you (read, never fetched) ---------------------------------------------------------- */
  const RK = ['gray', 'green', 'cyan', 'blue', 'violet', 'orange', 'red'];
  function me() {
    const a = document.querySelector('#header a[href^="/profile/"], .lang-chooser a[href^="/profile/"]');
    const rk = a && (a.className.match(/user-(\w+)/) || [])[1];
    const handle = a ? decodeURIComponent((a.getAttribute('href') || '').split('/profile/')[1] || '').split(/[?#/]/)[0] : '';
    const av = document.querySelector('.personal-sidebar .avatar img, #sidebar .avatar img');
    const out = document.querySelector('#header a[href$="/logout"], .lang-chooser a[href$="/logout"]');
    return { handle, rank: RK.includes(rk) ? rk : (rk ? 'red' : 'gray'), photo: photoUrl(av && av.getAttribute('src')), logout: out ? out.getAttribute('href') : '' };
  }
  /* Codeforces serves pictures through its own origin (https://codeforces.com/userpic.codeforces.org/...); the API
     answers with https://userpic.codeforces.org/..., which does not load from the page (seen live: the profile showed the
     initial). Either form becomes the same-origin one. */
  function photoUrl(u) {
    if (!u) return '';
    u = u.trim();
    if (/no-(avatar|title)\.jpg/.test(u)) return '';
    if (u.startsWith('//')) u = 'https:' + u;
    u = u.replace(/^https?:\/\/userpic\.codeforces\.org\//, 'https://codeforces.com/userpic.codeforces.org/');
    return /^https:\/\/([\w-]+\.)?codeforces\.(com|org)\//.test(u) ? u : '';
  }
  const avatar = (photo, handle, cls) => `<span class="kav ${cls || ''}">${photo ? `<img src="${esc(photo)}" alt="">` : ''}<b>${esc((handle || '?')[0].toUpperCase())}</b></span>`;

  /* ---- the site bar ------------------------------------------------------------------------------------------------ */
  const LINKS = [['problems', '/problemset', 'Problems'], ['contests', '/contests', 'Contest'], ['discuss', '/', 'Discuss'], ['gym', '/gyms', 'Gym']];
  /* the rest of Codeforces' main menu, under "More" (user, Oct 30 2026: Groups, API, Calendar... from the bar itself) */
  /* (/top is Discuss's Top tab: it lit both Discuss and More, user Oct 30 2026) */
  const MORE = [['/catalog', 'Catalog', 'book'], ['/groups', 'Groups', 'team'], ['/ratings', 'Rating', 'trophy'], ['/edu/courses', 'Edu', 'grad'],
    ['/apiHelp', 'API', 'code'], ['/calendar', 'Calendar', 'cal'], ['/help', 'Help', 'help']];
  function right(d) {
    const signed = !!d.handle;
    const who = signed
      ? `<button class="kbtn kme" data-k="me" aria-haspopup="menu" aria-expanded="false" title="${esc(d.handle)}">${avatar(d.photo, d.handle)}</button>`
      : '<a class="ktxt" href="/register">Register</a><span class="kor">or</span><a class="ktxt" href="/enter">Sign in</a>';
    return `${signed ? `<button class="kbtn kbell" data-k="bell" aria-haspopup="dialog" aria-expanded="false" title="Notifications">${ic('bell')}<i class="kdot" hidden></i></button>` : ''}
<a class="kdon" href="${DONATE_URL}" target="_blank" rel="noopener">${ic('heart')}<span>Donate</span></a>${who}
<div class="kpop kmenu" data-kp="me" role="menu" hidden></div><div class="kpop knoti" data-kp="bell" role="dialog" aria-label="Notifications" hidden></div>`;
  }
  function bar(active, d) {
    return `<header class="kbar" data-m="nav"><a class="kbrand" href="/problemset" aria-label="Codeforces">${LOGO}<span>Codeforces</span></a>
<nav class="klinks">${LINKS.map(([k, h, n]) => `<a class="kl${active === k ? ' on' : ''}" href="${h}">${n}</a>`).join('')}<span class="kmw"><button class="kl kmorebtn${MORE.some(([h]) => location.pathname.startsWith(h)) ? ' on' : ''}" data-k="more" aria-haspopup="menu" aria-expanded="false">More${ic('chev')}</button><div class="kpop kmore" data-kp="more" role="menu" hidden>${MORE.map(([h, n, i]) => `<a class="kmi" role="menuitem" href="${h}">${ic(i)}<span>${n}</span></a>`).join('')}</div></span></nav>
<div class="kright"><label class="ksearch">${ic('search')}<input type="search" data-k="q" placeholder="Search" aria-label="Search problems" autocomplete="off"></label>${right(d)}</div></header>`;
  }

  /* ---- the avatar menu ----------------------------------------------------------------------------------------------- */
  function menuHTML(d, info) {
    const h = encodeURIComponent(d.handle);
    const r = info && info.rating;
    const it = (href, icon, t) => `<a class="kmi" role="menuitem" href="${href}">${ic(icon)}<span>${t}</span></a>`;
    return `<a class="kmhead" href="/profile/${h}">${avatar(d.photo, d.handle, 'lg')}<span><b class="rk-${d.rank}">${esc(d.handle)}</b><small>${r != null ? `Rating ${r}` : 'View profile'}</small></span></a>
<div class="kmgrid"><a href="/submissions/${h}">${ic('list')}<span>Submissions</span></a><a href="/contests/with/${h}">${ic('trophy')}<span>Contests</span></a><a href="/blog/${h}">${ic('pen')}<span>Blog</span></a><a href="/talks">${ic('msg')}<span>Talks</span></a></div>
${it('/friends', 'team', 'Friends')}${it('/settings/general', 'gear', 'Settings')}${d.logout ? `<div class="ksep"></div>${it(esc(d.logout), 'out', 'Sign out')}` : ''}`;
  }

  /* ---- notifications: from the caches the theme keeps --------------------------------------------------------------- */
  const SEEN = 'cfmNotiSeen';
  const left = (s) => { s = Math.max(0, s); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };
  const ago = (t) => { const s = Date.now() / 1000 - t; return s < 3600 ? `${Math.max(1, Math.floor(s / 60))}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`; };
  const VWORD = { OK: 'Accepted', WRONG_ANSWER: 'Wrong answer', TIME_LIMIT_EXCEEDED: 'Time limit exceeded', MEMORY_LIMIT_EXCEEDED: 'Memory limit exceeded', RUNTIME_ERROR: 'Runtime error', COMPILATION_ERROR: 'Compilation error' };
  function notiItems(s, handle) {
    const out = [], now = Date.now() / 1000;
    for (const c of ((s.cfmUpcoming && s.cfmUpcoming.rows) || []).filter((c) => c[2] > now).slice(0, 3)) {
      out.push({ id: 'c' + c[0], at: 4e9 - c[2] /* rounds first, the soonest on top */, icon: 'cal', tone: 'blue', title: c[1], text: `Starts in ${left(c[2] - now)}`, href: `/contests` });
    }
    const hist = s.cfmRatings && handle && s.cfmRatings[handle.toLowerCase()] && s.cfmRatings[handle.toLowerCase()].data;
    if (hist && hist.length) {
      const x = hist[hist.length - 1], dl = x[4] - x[3];
      out.push({ id: 'r' + x[0], at: x[5], icon: dl >= 0 ? 'up' : 'down', tone: dl >= 0 ? 'green' : 'red', title: `Rating ${dl >= 0 ? '+' : ''}${dl} → ${x[4]}`, text: `${x[1]} · rank #${N(x[2])}`, href: `/contest/${x[0]}/standings` });
    }
    const st = s.cfmStatus && handle && s.cfmStatus.handle === handle ? s.cfmStatus.rows : [];
    for (const r of st.slice(0, 4)) {
      if (!r[4] || r[4] === 'TESTING') continue;
      const ok = r[4] === 'OK';
      out.push({ id: 's' + r[0], at: r[1], icon: ok ? 'ok' : 'x', tone: ok ? 'green' : 'red', title: `${VWORD[r[4]] || r[4].toLowerCase().replace(/_/g, ' ')} · ${r[2]}${r[3]}`, text: `${r[5]} · ${ago(r[1])}`, href: r[2] >= 100000 ? `/gym/${r[2]}/submission/${r[0]}` : `/contest/${r[2]}/submission/${r[0]}` });
    }
    return out.sort((a, b) => b.at - a.at);
  }
  function notiHTML(items, seen) {
    if (!items.length) return '<div class="knh"><b>Notifications</b></div><div class="kempty">Nothing new. Rounds, rating changes and verdicts show up here.</div>';
    return `<div class="knh"><b>Notifications</b><button class="klink" data-k="readall">Mark all as read</button></div><div class="knl">${items.map((n) => `<a class="kn${seen.has(n.id) ? '' : ' new'}" href="${esc(n.href)}" data-nid="${esc(n.id)}"><span class="kni t-${n.tone}">${ic(n.icon)}</span><span class="knt"><b>${esc(n.title)}</b><small>${esc(n.text)}</small></span></a>`).join('')}</div>`;
  }

  /* ---- behaviour: one listener per shadow root ---------------------------------------------------------------------- */
  function wire(sh, d) {
    const pop = (k) => sh.querySelector(`[data-kp="${k}"]`);
    const btn = (k) => sh.querySelector(`[data-k="${k}"]`);
    const close = () => sh.querySelectorAll('.kpop').forEach((p) => { p.hidden = true; const b = btn(p.dataset.kp); if (b) b.setAttribute('aria-expanded', 'false'); });
    let items = [], seen = new Set();
    const KEYS = ['cfmUpcoming', 'cfmRatings', 'cfmStatus', SEEN, 'cfmUserInfo'];
    const refresh = () => chrome.storage.local.get(KEYS, (s) => {
      if (!sh.host || !sh.host.isConnected) return;
      seen = new Set(s[SEEN] || []);
      items = d.handle ? notiItems(s, d.handle) : [];
      const n = items.filter((x) => !seen.has(x.id)).length, dot = sh.querySelector('.kdot');
      if (dot) { dot.hidden = !n; dot.textContent = n > 9 ? '9+' : n; }
      const p = pop('bell'); if (p && !p.hidden) p.innerHTML = notiHTML(items, seen);
      const info = s.cfmUserInfo && d.handle && s.cfmUserInfo[d.handle.toLowerCase()];
      /* no photo on this page (no personal sidebar): the one user.info gave, once the theme has fetched it */
      if (!d.photo && info && info.data && info.data.photo) {
        d.photo = photoUrl(info.data.photo);
        const b = btn('me'); if (b && d.photo) { b.innerHTML = avatar(d.photo, d.handle); photos(sh); }
      }
      const m = pop('me'); if (m && d.handle) m.innerHTML = menuHTML(d, info && info.data);
    });
    refresh();
    const onCh = (c, area) => { if (area === 'local' && KEYS.some((k) => c[k])) refresh(); };
    chrome.storage.onChanged.addListener(onCh);
    sh.addEventListener('click', (e) => {
      const t = e.target, b = t.closest('[data-k]');
      if (b && (b.dataset.k === 'me' || b.dataset.k === 'bell' || b.dataset.k === 'more')) {
        e.preventDefault(); e.stopPropagation();
        const p = pop(b.dataset.k), open = p.hidden; close();
        if (open) { p.hidden = false; b.setAttribute('aria-expanded', 'true'); if (b.dataset.k === 'bell') p.innerHTML = notiHTML(items, seen); }
        return;
      }
      if (b && b.dataset.k === 'readall') {
        e.stopPropagation(); const all = [...new Set([...seen, ...items.map((x) => x.id)])].slice(-200);
        chrome.storage.local.set({ [SEEN]: all }); return;
      }
      const n = t.closest('[data-nid]');
      if (n) chrome.storage.local.set({ [SEEN]: [...new Set([...seen, n.dataset.nid])].slice(-200) });
      if (!t.closest('.kpop')) close();
    }, true);
    sh.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      const q = e.target.closest && e.target.closest('[data-k="q"]');
      if (q && e.key === 'Enter' && q.value.trim()) { e.preventDefault(); location.href = '/problemset?q=' + encodeURIComponent(q.value.trim()); }
    });
    /* a press anywhere outside the open panel closes it; a press in the code editor (an iframe) reaches no listener here,
       so focus leaving for an iframe closes it too */
    const outside = (e) => { const path = e.composedPath(); if (!path.some((n) => n.classList && (n.classList.contains('kpop') || n.matches('[data-k="me"],[data-k="bell"],[data-k="more"]')))) close(); };
    const blur = () => setTimeout(() => { const a = document.activeElement; if (a && a.tagName === 'IFRAME') close(); }, 0);
    document.addEventListener('pointerdown', outside, true); window.addEventListener('blur', blur);
    return () => { chrome.storage.onChanged.removeListener(onCh); document.removeEventListener('pointerdown', outside, true); window.removeEventListener('blur', blur); };
  }
  /* avatars that fail to load show the initial */
  function photos(sh) {
    sh.querySelectorAll('.kav img').forEach((img) => {
      if (img.dataset.w) return; img.dataset.w = 1;
      const bad = () => img.remove();
      if (img.complete && !img.naturalWidth) bad(); else img.addEventListener('error', bad, { once: true });
    });
  }

  /* ---- the solved ring: LeetCode's own geometry (measured on leetcode.com/u/..., Oct 28 2026): viewBox 100, r 42, stroke 3,
     a 270-degree ring open at the bottom, one arc per difficulty (its share of the problem set), the solved part lit and
     the rest at 20%. Drawn 181 px wide. Hovering a tile shows that difficulty's share in the centre. -------------------- */
  const BANDS = [['Easy', '#1cbaba'], ['Medium', '#ffb700'], ['Hard', '#f63737']];
  const RC = 2 * Math.PI * 42, SPAN = RC * 0.75, GAP = 7;
  let introDone = false;   // the arcs sweep in once per page, not on every redraw
  /* where each arc sits: normally its share of the problem set; with one difficulty in focus, that one takes the whole
     ring and the others fold away (LeetCode's hover, springy) */
  function layout(B, focus) {
    const live = BANDS.filter(([b]) => (B[b] || [0, 0])[1]);
    const tot = live.reduce((s, [b]) => s + B[b][1], 0) || 1, usable = SPAN - GAP * (live.length - 1);
    let at = 0; const out = {};
    for (const [b] of live) {
      const [x, t] = B[b];
      if (focus) { const me = b === focus; out[b] = { rot: me ? 135 : 135 + (BANDS.findIndex(([k]) => k === b) > BANDS.findIndex(([k]) => k === focus) ? 270 : 0), len: me ? SPAN : 0, done: me ? SPAN * Math.min(1, x / t) : 0, op: me ? 1 : 0 }; continue; }
      const len = usable * t / tot;
      out[b] = { rot: 135 + at / RC * 360, len, done: len * Math.min(1, x / t), op: 1 };
      at += len + GAP;
    }
    return out;
  }
  const segStyle = (L) => ({ g: `transform:rotate(${L.rot.toFixed(3)}deg);opacity:${L.op}`, t: `stroke-dasharray:${L.len.toFixed(3)} ${RC.toFixed(3)}`, d: `stroke-dasharray:${Math.max(0.001, L.done).toFixed(3)} ${RC.toFixed(3)};opacity:${L.done > 0.01 ? 1 : 0}` });
  function gauge(B) {
    const L = layout(B), intro = !introDone && Object.values(B).some((v) => v && v[0]); if (intro) introDone = true;
    const g = BANDS.filter(([b]) => L[b]).map(([b, col]) => { const st = segStyle(L[b]); return `<g class="seg" data-band="${b}" style="${st.g}"><circle class="tr" cx="50" cy="50" r="42" stroke="${col}" style="${st.t}"/><circle class="dn" cx="50" cy="50" r="42" stroke="${col}" style="${st.d}"/></g>`; }).join('');
    return `<svg class="gauge${intro ? ' intro' : ''}" viewBox="0 0 100 100" aria-hidden="true" data-b="${esc(JSON.stringify(B))}">${g}</svg>`;
  }
  function solvedCard(B, solved, total, tried, extra, acc) {
    const tiles = BANDS.map(([b, col]) => `<div class="gt" data-band="${b}" style="--c:${col}"><span>${b === 'Medium' ? 'Med.' : b}</span><b>${(B[b] || [0])[0]}/${(B[b] || [0, 0])[1]}</b></div>`).join('');
    return `<div class="gwrap"><div class="gring"${acc ? ` data-acc="${esc(acc)}"` : ''}>${gauge(B)}<div class="gc" data-all="${solved}|${total}"><div class="gn"><b>${solved}</b><small>/${total}</small></div><div class="gs">${ic('check')}<span>Solved</span></div></div>${tried != null ? `<div class="ga2"><b>${tried}</b> Attempting${extra || ''}</div>` : ''}</div><div class="gts">${tiles}</div></div>`;
  }
  function focusRing(w, band) {
    const svg = w.querySelector('.gauge'); if (!svg) return;
    const B = JSON.parse(svg.dataset.b), L = layout(B, band);
    svg.classList.remove('intro');
    svg.querySelectorAll('.seg').forEach((g) => { const st = segStyle(L[g.dataset.band]); g.setAttribute('style', st.g); g.querySelector('.tr').setAttribute('style', st.t); g.querySelector('.dn').setAttribute('style', st.d); });
  }
  function centre(w, html, sub) { const c = w.querySelector('.gc'); c.querySelector('.gn').innerHTML = html; c.querySelector('.gs').innerHTML = sub; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
  function rest(w) { const c = w.querySelector('.gc'), [s0, tot] = c.dataset.all.split('|'); focusRing(w, null); centre(w, `<b>${s0}</b><small>/${tot}</small>`, `${ic('check')}<span>Solved</span>`); w.dataset.f = ''; }
  function wireGauge(sh) {
    sh.addEventListener('mouseover', (e) => {
      const w = e.target.closest && e.target.closest('.gwrap'); if (!w) return;
      const t = e.target.closest('.gt'), ring = !t && e.target.closest('.gring');
      const key = t ? t.dataset.band : ring ? 'acc' : ''; if (!key || w.dataset.f === key) return;
      w.dataset.f = key;
      if (t) {
        const [x, tt] = t.querySelector('b').textContent.split('/').map(Number), pct = tt ? (100 * x / tt).toFixed(2).split('.') : ['0', '00'];
        focusRing(w, t.dataset.band);
        centre(w, `<b>${pct[0]}</b><small>.${pct[1]}%</small>`, `<span style="color:${t.style.getPropertyValue('--c')}">${t.dataset.band} solved</span>`);
      } else {
        const acc = w.querySelector('.gring').dataset.acc; if (!acc) return;
        const [p0, p1] = acc.split('.');
        centre(w, `<b>${p0}</b><small>.${p1 || '00'}%</small>`, '<span>Acceptance</span>');
      }
    });
    sh.addEventListener('mouseout', (e) => {
      const w = e.target.closest && e.target.closest('.gwrap'); if (!w || (e.relatedTarget && w.contains(e.relatedTarget) && (e.relatedTarget.closest('.gt') || e.relatedTarget.closest('.gring')))) return;
      if (w.dataset.f) rest(w);
    });
  }

  const CSS = `
[data-act],[data-tab],[data-ptab],[role=button],[role=tab],[role=option],a[href],button:not(:disabled),select,summary{cursor:pointer}
.kbar{position:sticky;top:0;z-index:20;height:50px;display:flex;align-items:center;gap:8px;padding:0 20px;background:#282828;border-bottom:1px solid rgba(255,255,255,.1);font-family:var(--ui)}
.kbrand{display:flex;align-items:center;gap:8px;height:50px;padding-right:20px;color:#f5f5f5;font-size:17px;font-weight:600;letter-spacing:-.01em}
.kbrand .cfmark{width:26px;height:22px;display:block}
.klinks{display:flex;align-items:center;height:50px}
.kl{position:relative;height:50px;display:flex;align-items:center;padding:0 12px;font-size:15px;color:rgba(255,255,255,.6);transition:color .15s}
.kl:hover{color:#f5f5f5}
.kl.on{color:#f5f5f5;font-weight:500}
.kl.on::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:2px;border-radius:2px 2px 0 0;background:#f5f5f5}
.kright{margin-left:auto;display:flex;align-items:center;gap:6px;position:relative}
.ksearch{display:flex;align-items:center;gap:6px;width:160px;height:32px;padding:0 10px;border-radius:9999px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.45);transition:width .2s,background .2s;margin-right:6px}
.ksearch:focus-within{width:220px;background:rgba(255,255,255,.12);color:#f5f5f5}
.ksearch .i{width:15px;height:15px}
.ksearch input{all:unset;flex:1;min-width:0;font:14px/20px var(--ui);color:#f5f5f5}
.ksearch input::placeholder{color:rgba(255,255,255,.45)}
.ksearch input::-webkit-search-cancel-button{display:none}
.kbtn{all:unset;position:relative;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;color:rgba(255,255,255,.6);cursor:pointer;transition:background .15s,color .15s}
.kbtn:hover,.kbtn[aria-expanded="true"]{background:rgba(255,255,255,.08);color:#f5f5f5}
.kbtn:focus-visible,.kdon:focus-visible{outline:1px solid #d4d4d8;outline-offset:1px}
.kbtn .i{width:18px;height:18px}
.kdot{position:absolute;top:3px;right:2px;min-width:15px;height:15px;padding:0 4px;border-radius:9999px;background:#f63737;color:#fff;font:600 10px/15px var(--ui);font-style:normal;text-align:center;box-shadow:0 0 0 2px #282828}
.kdon{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;margin:0 4px;border-radius:8px;background:rgba(255,161,22,.12);color:#ffa116;font:500 14px/20px var(--ui);transition:background .15s}
.kdon:hover{background:rgba(255,161,22,.2)}
.kdon .i{width:15px;height:15px;fill:currentColor;stroke-width:0}
.kme{width:32px;border-radius:9999px}
.kav{position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;overflow:hidden;background:linear-gradient(135deg,#3f8ae0,#7b5cff);color:#fff;flex:none}
.kav b{font:600 12px/1 var(--ui)}
.kav img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
.kav.lg{width:44px;height:44px}.kav.lg b{font-size:18px}
.ktxt{color:rgba(255,255,255,.6);font-size:14px;padding:0 4px}.ktxt:hover{color:#f5f5f5}
.kor{color:rgba(255,255,255,.4);font-size:14px}
.kpop{position:absolute;top:42px;right:0;z-index:30;background:#303030;border:1px solid rgba(255,255,255,.08);border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.5),0 2px 6px rgba(0,0,0,.3);font-family:var(--ui);animation:kin .14s ease-out}
@keyframes kin{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.kmenu{width:280px;padding:8px}
.kmw{position:relative;display:flex;align-items:center;height:50px}
.kmorebtn{gap:4px;background:none;border:0;font:inherit;font-size:15px;cursor:pointer}.kmorebtn .i{width:14px;height:14px;transition:transform .15s}.kmorebtn[aria-expanded="true"] .i{transform:rotate(180deg)}
.kpop.kmore{left:0;right:auto;top:46px;width:200px;padding:6px}
.kmhead{display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px}
.kmhead:hover{background:rgba(255,255,255,.06)}
.kmhead span{display:flex;flex-direction:column;min-width:0}
.kmhead b{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis}
.kmhead small{font-size:12px;color:rgba(255,255,255,.5)}
.kmgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:6px 0 4px;padding:8px 0;border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}
.kmgrid a{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 2px;border-radius:8px;font-size:11px;color:rgba(255,255,255,.6)}
.kmgrid a:hover{background:rgba(255,255,255,.06);color:#f5f5f5}
.kmgrid .i{width:20px;height:20px}
.kmi{display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:8px;font-size:14px;color:rgba(255,255,255,.75)}
.kmi:hover{background:rgba(255,255,255,.06);color:#f5f5f5}
.kmi .i{width:16px;height:16px;color:rgba(255,255,255,.5)}
.ksep{height:1px;background:rgba(255,255,255,.08);margin:4px 0}
.knoti{width:360px;right:40px;padding:6px}
.knh{display:flex;align-items:center;justify-content:space-between;padding:10px 12px 8px}
.knh b{font-size:15px;font-weight:600}
.klink{all:unset;cursor:pointer;color:#0a84ff;font-size:13px}.klink:hover{text-decoration:underline}
.knl{max-height:420px;overflow:auto}
.kn{display:flex;gap:12px;align-items:flex-start;padding:10px 12px;border-radius:8px;position:relative}
.kn:hover{background:rgba(255,255,255,.06)}
.kn.new::after{content:"";position:absolute;right:12px;top:16px;width:7px;height:7px;border-radius:9999px;background:#0a84ff}
.kni{width:32px;height:32px;border-radius:9999px;display:flex;align-items:center;justify-content:center;flex:none}
.kni .i{width:16px;height:16px}
.t-blue{background:rgba(10,132,255,.15);color:#4ea1ff}.t-green{background:rgba(44,187,93,.15);color:#2cbb5d}.t-red{background:rgba(246,55,55,.15);color:#ff6b6b}
.knt{display:flex;flex-direction:column;min-width:0;padding-right:14px}
.knt b{font-size:13.5px;font-weight:500;line-height:19px;color:#f5f5f5}
.knt small{font-size:12px;color:rgba(255,255,255,.5);line-height:17px;margin-top:2px}
.kempty{padding:24px 16px 28px;color:rgba(255,255,255,.5);font-size:13px;text-align:center}
.gwrap{display:flex;align-items:center;gap:8px}
.gring{position:relative;width:181px;height:181px;flex:none;margin:-17px 0 -17px 40px}
.gauge{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.gauge circle{fill:none;stroke-width:3;stroke-linecap:round}
.gauge .tr{stroke-opacity:.2}
.gauge .seg{transform-origin:50px 50px;transform-box:view-box}
.gauge .seg,.gauge circle{transition:transform .4s cubic-bezier(.6,1.37,.81,.97),stroke-dasharray .4s cubic-bezier(.6,1.37,.81,.97),opacity .25s ease}
.gauge.intro .dn{animation:gfill .9s cubic-bezier(.6,1.37,.81,.97) both}
@keyframes gfill{from{stroke-dasharray:0 300}}
.gring{cursor:default}
.gc.pop{animation:gpop .3s cubic-bezier(.6,1.37,.81,.97)}
@keyframes gpop{from{opacity:.2;transform:scale(.94)}}
.gc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;color:#f5f5f5}
.gn{display:flex;align-items:baseline}
.gn b{font-size:30px;line-height:32px;font-weight:600}
.gn small{font-size:14px;line-height:20px;font-weight:400;margin-left:1px}
.gs{display:flex;align-items:center;gap:4px;font-size:14px;line-height:20px;margin-top:2px}
.gs .i{width:14px;height:14px;color:#2cbb5d}
.ga2{position:absolute;left:0;right:0;top:132px;text-align:center;font-size:12px;line-height:16px;color:#a8a8a8}
.ga2 b{font-weight:600}
.gts{display:flex;flex-direction:column;gap:8px;margin-left:auto}
.gt{width:90px;height:44px;border-radius:5px;background:rgba(255,255,255,.06);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:default;transition:background .15s}
.gt:hover{background:rgba(255,255,255,.1)}
.gt span{font-size:12px;line-height:16px;font-weight:500;color:var(--c)}
.gt b{font-size:12px;line-height:16px;font-weight:500;color:#f5f5f5}
@media (max-width:860px){.klinks .kl:nth-child(n+3){display:none}.ksearch{display:none}}
`;
  globalThis.CFM_KIT_CSS = CSS;
  globalThis.CFM_KIT = { ic, esc, N, LOGO, me, photoUrl, avatar, bar, right, wire, photos, gauge, solvedCard, wireGauge, BANDS, DONATE_URL };
})();
