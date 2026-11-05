/* =============================================================================
   site.js  (isolated world, /contests and /profile/<handle>)   MODERN.md, phases M4 and the premium pass
   The LeetCode theme's Contests and Profile pages, rebuilt Oct 28 2026 from LeetCode's own pages reverse-engineered with REA
   and a computed-style dump (leetcode.com/u/<name>/ and /contest/, dark, 1440 px): its font stack, sizes, colours, radii
   and spacing, its ring geometry, its heatmap cell grid. Filled with Codeforces data, on the kit's site bar (kit.js).
   - Contests: a trophy hero, the next rounds as art cards (countdown, Register, Add to calendar as a local .ics), your
     contest stats and "Which round is for me?", Past / My contests with thumbnails and pages, a random past round.
   - Profile (any handle): a sticky left card (photo, rank, facts, community stats, languages, skills by level); the
     contest card (rating line with hover, rating changes, next rank), the solved gauge, badges earned from the data,
     the heatmap by month with a year picker, Recent AC / Submissions / Contests.
   - Data through api.js only: contest.list (1 h), user.rating (6 h), user.info (1 h), user.status (yours cached; another
     handle's fetched for the page and never written over yours), problemset.problems (a day). Nothing of the page moves.
   Nothing here invents data: badges are milestones the user's own rows show, with the date they were reached.
============================================================================= */
(() => {
  'use strict';
  const PATH = location.pathname.replace(/\/+$/, '');
  const PAGE = /^\/contests$/.test(PATH) ? 'contests' : /^\/profile\/[^/]+$/.test(PATH) ? 'profile' : /^(\/page\/\d+|\/top)?$/.test(PATH) ? 'discuss' : /^\/gyms$/.test(PATH) ? 'gym'
    : /^\/friends$/.test(PATH) ? 'friends' : /^\/contests\/with\/[^/]+$/.test(PATH) ? 'cwith' : /^\/settings\/general$/.test(PATH) ? 'settings' : '';
  if (!PAGE) return;
  const UI_KEY = 'cfUI', HANDLE = PAGE === 'profile' ? decodeURIComponent(PATH.split('/')[2]) : PAGE === 'cwith' ? decodeURIComponent(PATH.split('/')[3]) : '';
  const root = document.documentElement;
  let app = null, wanted = false;
  const K = () => globalThis.CFM_KIT;

  /* ---- icons: Lucide (ISC, licenses/lucide-ISC.txt) ------------------------------------------------------------------ */
  const IC = {
    glass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    cal: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M12 14v4"/><path d="M10 16h4"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    sqcheck: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    org: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    right: '<path d="m9 18 6-6-6-6"/>', left: '<path d="m15 18-6-6 6-6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>',
    crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
    dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    vote: '<path d="M9 18v-6H5l7-7 7 7h-4v6H9z"/>',
    spark: '<path d="M9.94 14.06 4 20"/><path d="m14 4 1.4 3.6L19 9l-3.6 1.4L14 14l-1.4-3.6L9 9l3.6-1.4z"/><path d="M20 15v4"/><path d="M22 17h-4"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="m2 2 20 20"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  };
  const ic = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const N = (n) => Number(n).toLocaleString('en-US');
  const RKC = { gray: '#ababab', green: '#4fd24f', cyan: '#2fd3c5', blue: '#8c9cff', violet: '#e27be2', orange: '#ffa033', red: '#ff6464' };
  const rankOf = (r) => (r == null ? 'gray' : r < 1200 ? 'gray' : r < 1400 ? 'green' : r < 1600 ? 'cyan' : r < 1900 ? 'blue' : r < 2100 ? 'violet' : r < 2400 ? 'orange' : 'red');
  const RANKS = [[0, 'Newbie'], [1200, 'Pupil'], [1400, 'Specialist'], [1600, 'Expert'], [1900, 'Candidate Master'], [2100, 'Master'], [2300, 'International Master'], [2400, 'Grandmaster'], [2600, 'International Grandmaster'], [3000, 'Legendary Grandmaster']];
  const rankLevel = (r) => (r == null ? 0 : Math.min(7, RANKS.filter(([lo]) => r >= lo).length - 1));   // the rank medals' ladder: Newbie 0 ... International Master 6, Grandmaster and up 7
  const rankName = (r) => (r == null ? 'Unrated' : RANKS.filter(([lo]) => r >= lo).pop()[1]);
  const nextRank = (r) => RANKS.find(([lo]) => lo > (r || 0));
  const band = (r) => (!r ? 'Not rated' : r <= 1300 ? 'Easy' : r <= 1800 ? 'Medium' : 'Hard');
  const rchip = (r) => (r ? `<span class="rchip" style="color:var(--rank-${rankOf(r)})">*${r}</span>` : '');
  function division(name) {
    if (/Div\.\s*1\s*\+\s*Div\.\s*2|Global/.test(name)) return ['All levels', 'orange'];
    if (/Educational/.test(name)) return ['Educational', 'blue'];
    for (const [d, c] of [[4, 'green'], [3, 'cyan'], [2, 'blue'], [1, 'red']]) if (new RegExp(`Div\\.\\s*${d}`).test(name)) return ['Div. ' + d, c];
    return ['Special', 'violet'];
  }
  const dbadge = (name) => { const [l, c] = division(name); return `<span class="dv" style="--c:var(--rank-${c})">${l}</span>`; };
  const tz = (() => { const o = -new Date().getTimezoneOffset(), h = Math.floor(Math.abs(o) / 60), m = Math.abs(o) % 60; return `GMT${o >= 0 ? '+' : '-'}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; })();
  const fmtWhen = (ts) => new Date(ts * 1000).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtDate = (ts) => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dur = (s) => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return `${h} h${m ? ' ' + m + ' min' : ''}`; };
  function countdown(sec) {
    sec = Math.max(0, Math.floor(sec)); const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return d ? `${d}d ${t}` : t;
  }
  const ago = (ts) => { const s = Date.now() / 1000 - ts; return s < 300 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} minutes ago` : s < 86400 ? `${Math.floor(s / 3600)} hours ago` : s < 2 * 86400 ? 'a day ago' : s < 30 * 86400 ? `${Math.floor(s / 86400)} days ago` : s < 365 * 86400 ? `${Math.floor(s / 2592000)} month${s < 2 * 2592000 ? '' : 's'} ago` : `${Math.floor(s / 31536000)} year${s < 2 * 31536000 ? '' : 's'} ago`; };

  /* ---- original art (no LeetCode picture is used): a round's card is its division's colour field with the division drawn
     as a glass numeral, lit from the top right. Same art for the 110 x 72 thumbnails. ---------------------------------- */
  const PAL = { orange: ['#ffc65c', '#f7811f', '#c2410c'], blue: ['#8b7bff', '#5b3df5', '#2a1aa0'], cyan: ['#5eead4', '#14b8c4', '#0b5e78'], green: ['#86efac', '#22c55e', '#0f6b3c'], red: ['#ff9a8b', '#f2545b', '#8f1d3a'], violet: ['#e9a8ff', '#b14df0', '#5b1a99'], edu: ['#93c5fd', '#3b82f6', '#1e3a8a'] };
  let artN = 0;
  function glyphOf(name) {
    const [l] = division(name);
    if (/^Div\. \d$/.test(l)) return l.slice(-1);
    if (l === 'Educational') return 'Edu';
    if (/Global/.test(name)) return 'G';
    if (l === 'All levels') return '1+2';
    const w = String(name).split(/\s+/)[0] || '?';
    return /^[A-Z]{2,4}$/.test(w) ? w : w[0].toUpperCase();
  }
  const palOf = (name) => { const [l, c] = division(name); return PAL[l === 'Educational' ? 'edu' : c] || PAL.violet; };
  function art(name, w, h, band = 0) {
    const [hi, mid, lo] = palOf(name), g = glyphOf(name), id = 'a' + (++artN), gh = h - band;
    const fs = gh * (g.length > 2 ? 0.42 : g.length === 2 ? 0.56 : 0.74);
    return `<svg class="art" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".45" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
<radialGradient id="${id}l" cx=".72" cy=".28" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity=".02"/></linearGradient>
<linearGradient id="${id}g" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="${hi}" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/></linearGradient>
<linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#fff2b3"/><stop offset=".65" stop-color="#ffc2f2"/><stop offset="1" stop-color="#b8ecff"/></linearGradient>
<filter id="${id}s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="${(h * 0.05).toFixed(1)}" stdDeviation="${(h * 0.05).toFixed(1)}" flood-color="${lo}" flood-opacity=".7"/></filter></defs>
<rect width="${w}" height="${h}" fill="url(#${id}b)"/><rect width="${w}" height="${h}" fill="url(#${id}l)"/>
<path d="M${-w * 0.1} ${h * 0.86} C ${w * 0.25} ${h * 0.5}, ${w * 0.6} ${h * 1.05}, ${w * 1.1} ${h * 0.55} L ${w * 1.1} ${h} L ${-w * 0.1} ${h} Z" fill="url(#${id}p)"/>
<path d="M${w * 0.08} ${h * 1.02} C ${w * 0.22} ${h * 0.3}, ${w * 0.62} ${h * 0.02}, ${w * 1.02} ${h * 0.1}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="${(h * 0.012).toFixed(2)}"/>
<text x="${w * 0.6}" y="${gh * 0.52}" text-anchor="middle" dominant-baseline="central" font-family="Inter, -apple-system, Segoe UI, Arial, sans-serif" font-weight="800" font-size="${fs.toFixed(1)}" letter-spacing="${(-fs * 0.04).toFixed(1)}" fill="url(#${id}g)" stroke="url(#${id}e)" stroke-width="${(gh * 0.009).toFixed(2)}" filter="url(#${id}s)">${esc(g)}</text></svg>`;
  }
  const TROPHY = `<svg class="trophy" viewBox="0 0 140 130" aria-hidden="true"><defs>
<linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".3" stop-color="#ffc24a"/><stop offset=".7" stop-color="#e0841c"/><stop offset="1" stop-color="#9c4f0f"/></linearGradient>
<linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd47a"/><stop offset="1" stop-color="#a85c16"/></linearGradient>
<radialGradient id="tglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb02e" stop-opacity=".28"/><stop offset="1" stop-color="#ffb02e" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="70" cy="60" rx="70" ry="58" fill="url(#tglow)"/>
<path d="M40 22 H22 a12 12 0 0 0 0 24 c4 10 14 16 22 17" fill="none" stroke="url(#tg2)" stroke-width="7" stroke-linecap="round"/>
<path d="M100 22 H118 a12 12 0 0 1 0 24 c-4 10 -14 16 -22 17" fill="none" stroke="url(#tg2)" stroke-width="7" stroke-linecap="round"/>
<path d="M38 14 H102 V48 C102 72 88 86 70 86 C52 86 38 72 38 48 Z" fill="url(#tg)"/>
<path d="M46 20 H58 V50 C58 64 62 72 66 78 C54 74 46 62 46 48 Z" fill="#fff" opacity=".3"/>
<rect x="62" y="86" width="16" height="14" fill="url(#tg2)"/><path d="M46 112 L52 100 H88 L94 112 Z" fill="url(#tg)"/><rect x="40" y="112" width="60" height="9" rx="3" fill="url(#tg2)"/>
<g transform="translate(58 34)" opacity=".92"><rect x="0" y="10" width="6" height="14" rx="1.4" fill="#fff8e1"/><rect x="9" y="2" width="6" height="22" rx="1.4" fill="#fff8e1"/><rect x="18" y="7" width="6" height="17" rx="1.4" fill="#fff8e1"/></g></svg>`;

  /* ---- the rating chart, LeetCode's: a thin orange line, the last round marked and labelled, the years under it ------- */
  function chart(hist, w, h) {
    if (!hist.length) return `<div class="nochart">No rated rounds yet</div>`;
    const xs = hist.map((x) => x[5]), ys = hist.map((x) => x[4]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), hi = Math.max(...ys), lo = Math.min(...ys);
    const pad = Math.max(40, (hi - lo) * 0.35), y1 = hi + pad, y0 = lo - pad;
    const X = (t) => 4 + (x1 === x0 ? (w - 8) / 2 : (t - x0) / (x1 - x0) * (w - 8)), Y = (r) => 8 + (1 - (r - y0) / (y1 - y0 || 1)) * (h - 40);
    const pts = hist.map((x) => [X(x[5]), Y(x[4])]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const same = new Date(x0 * 1000).getFullYear() === new Date(x1 * 1000).getFullYear();
    const lab = (t) => same ? new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : new Date(t * 1000).getFullYear();
    const data = esc(JSON.stringify(hist.map((x, i) => [pts[i][0], pts[i][1], x[1], x[4], x[4] - x[3], x[2], fmtDate(x[5])])));
    const L = pts[pts.length - 1], last = hist[hist.length - 1];
    return `<div class="rchart" data-pts="${data}" data-w="${w}"><svg viewBox="0 0 ${w} ${h - 22}" width="100%" height="${h - 22}" preserveAspectRatio="none" aria-label="Rating history"><path d="${line}" fill="none" stroke="#ffa116" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
<line class="hl" x1="0" x2="0" y1="0" y2="${h - 22}" stroke="rgba(255,255,255,.2)" vector-effect="non-scaling-stroke" visibility="hidden"/></svg>
<span class="pt last" style="left:${(L[0] / w * 100).toFixed(2)}%;top:${L[1].toFixed(1)}px"></span><span class="lbl last" style="left:${(L[0] / w * 100).toFixed(2)}%;top:${(L[1] + 10).toFixed(1)}px">${N(last[4])}</span><span class="pt hov" hidden></span>
<div class="yrs"><span>${lab(x0)}</span><span>${lab(x1)}</span></div><div class="tip" hidden></div></div>`;
  }
  function chartHover(e) {
    const c = e.target.closest && e.target.closest('.rchart'); if (!c || !c.dataset.pts) return;
    const pts = JSON.parse(c.dataset.pts), w = +c.dataset.w, box = c.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width * w;
    let best = pts[0]; for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    const left = best[0] / w * 100, tip = c.querySelector('.tip'), hp = c.querySelector('.pt.hov'), hl = c.querySelector('.hl');
    hp.hidden = false; hp.style.left = left + '%'; hp.style.top = best[1] + 'px';
    hl.setAttribute('x1', best[0]); hl.setAttribute('x2', best[0]); hl.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<div class="t1">${esc(best[6])}</div><div class="t2">Rating: <b>${N(best[3])}</b> <span class="${best[4] >= 0 ? 'up' : 'dn'}">${best[4] >= 0 ? '+' : ''}${best[4]}</span></div><div class="t3">${esc(best[2])}</div><div class="t1">Rank: ${N(best[5])}</div>`;
    tip.style.left = `clamp(0px, calc(${left}% - 110px), calc(100% - 220px))`; tip.style.top = Math.max(-10, best[1] - 104) + 'px';
  }
  function chartLeave(e) {
    const c = e.target.closest && e.target.closest('.rchart'); if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return;
    c.querySelector('.tip').hidden = true; c.querySelector('.pt.hov').hidden = true; c.querySelector('.hl').setAttribute('visibility', 'hidden');
  }

  /* ---- the shell ------------------------------------------------------------------------------------------------- */
  const shell = (d, active) => `${K().bar(active, d)}<main class="site-main ${PAGE}" id="main"></main>`;
  const $ = (id) => app.sh.getElementById(id);
  const photoOf = (u) => K().photoUrl(u || '');
  const av = (photo, handle, cls) => `<span class="av ${cls || ''}">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : ''}<b>${esc((handle || '?')[0].toUpperCase())}</b></span>`;

  /* ================================ Contests (LeetCode's /contest/, measured) ================================ */
  function icsFor(c) {
    const t = (s) => new Date(s * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Theme Studio for Codeforces//EN', 'BEGIN:VEVENT', `UID:cf-contest-${c[0]}@codeforces.com`, `DTSTAMP:${t(Date.now() / 1000)}`,
      `DTSTART:${t(c[3])}`, `DTEND:${t(c[3] + c[4])}`, `SUMMARY:${c[1].replace(/[,;]/g, ' ')}`, `URL:https://codeforces.com/contests/${c[0]}`, 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Codeforces round in 30 minutes', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }
  const PER = 8;
  /* the name as a list shows it (the full one is the tooltip): "Codeforces Round 1130 (Div. 2)" -> "Round 1130 (Div. 2)",
     "Educational Codeforces Round 195 (Rated for Div. 2)" -> "Educational Round 195", sponsor rounds keep their own name */
  const shortName = (n) => String(n).replace(/\s*\(Rated for [^)]*\)/, '').replace(/^Educational Codeforces Round/, 'Educational Round').replace(/\s*\(Codeforces Round[^)]*\)/, '').replace(/^Codeforces (Round|Global Round)/, '$1');
  const lcDate = (ts) => `${new Date(ts * 1000).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} ${tz}`;
  function contestsView() {
    const a = app, rows = a.list || [], me = a.d.handle, now = Date.now() / 1000;
    const live = rows.filter((r) => r[2] === 'CODING'), up = rows.filter((r) => r[2] === 'BEFORE');
    const next = live.concat(up), cards = next.slice(0, 2), more = next.slice(2);
    const card = (c, i) => {
      const running = c[2] === 'CODING', left = running ? c[3] + c[4] - now : c[3] - now;
      const reg = running ? `<a class="reg" href="/contest/${c[0]}">${ic('play')}Enter</a>`
        : `<a class="reg" href="${me ? `/contestRegistration/${c[0]}` : `/enter?back=%2FcontestRegistration%2F${c[0]}`}">Register</a>`;
      return `<article class="ccard${i ? ' sm' : ''}" data-m="ccard" title="${esc(division(c[1])[0])}">${art(c[1], i ? 350 : 400, i ? 230 : 250, 72)}
 ${reg}<span class="cdp">${running ? '<i class="ldot"></i>' : ic('glass')}<span class="cd" data-cd="${running ? c[3] + c[4] : c[3]}" data-run="${running ? 1 : 0}">${running ? 'Live · ' : ''}${countdown(left)}</span></span>
 <div class="band"><div class="tx"><p class="c-t"><a href="/contests/${c[0]}" title="${esc(c[1])}">${esc(shortName(c[1]))}</a></p><p class="c-s">${esc(lcDate(c[3]))}</p></div>${running ? '' : `<a class="cbtn abtn" href="${icsFor(c)}" download="codeforces-${c[0]}.ics" title="Add to calendar (reminder 30 min before)" aria-label="Add to calendar">${ic('alarm')}</a>`}</div></article>`;
    };
    /* the podium and the list: Codeforces' top rated (user.ratedList, once a day) */
    const R = a.rated, mine = a.info && a.info.country, pool = R ? (a.scope === 'country' && mine ? R.top.filter((u) => u[4] === mine) : R.top) : null;
    const pod = (u, place) => !u ? '<div class="pd"></div>' : `<a class="pd p${place}" href="/profile/${encodeURIComponent(u[0])}"><span class="crown k${place}">${ic('crown')}</span>${av(photoOf(u[3]), u[0], 'big')}<span class="plinth"><span class="pn" style="color:${RKC[rankOf(u[1])]}">${esc(u[0])}</span><span class="pr">${u[1]}</span></span></a>`;
    const ranking = !R ? `<div class="rkload">${a.ratedError ? 'Codeforces\' rating list did not load.' : 'Loading the top rated…'}</div>`
      : `<div class="podium">${pod(pool[1], 2)}${pod(pool[0], 1)}${pod(pool[2], 3)}</div><div class="rlist2">${pool.slice(3, a.rankMore ? 25 : 10).map((u, i) => `<a class="ritem2" href="/profile/${encodeURIComponent(u[0])}"><span class="rn">${i + 4}</span>${av(photoOf(u[3]), u[0], 'sm')}<span class="rh" style="color:${RKC[rankOf(u[1])]}">${esc(u[0])}</span><span class="rs"><span><i>Rating:</i> ${u[1]}</span><span><i>Max:</i> ${u[2]}</span></span></a>`).join('')}</div>
 <button class="smore2" data-act="rankmore">${a.rankMore ? 'Show Less' : 'Show More'}</button>`;
    /* past and mine */
    const hist = a.hist || [], byC = new Map(hist.map((x) => [x[0], x]));
    const solvedIn = (cid) => a.solvedBy ? (a.solvedBy.get(cid) || 0) : null, total = (cid) => a.probCount ? (a.probCount.get(cid) || 0) : null;
    const pager = (n) => { const pages = Math.ceil(n / PER); if (pages <= 1) return ''; const cur = a.page, nums = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - cur) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…'); return `<div class="pager"><button data-pg="${cur - 1}" ${cur <= 1 ? 'disabled' : ''} aria-label="Previous page">${ic('left')}</button>${nums.map((x) => x === '…' ? '<button disabled>…</button>' : `<button data-pg="${x}" class="${x === cur ? 'on' : ''}">${x}</button>`).join('')}<button data-pg="${cur + 1}" ${cur >= pages ? 'disabled' : ''} aria-label="Next page">${ic('right')}</button></div>`; };
    const thumb = (name) => `<span class="th">${art(name, 110, 72)}</span>`;
    let listHTML;
    if (a.tab === 'mine') {
      const h = hist.slice().reverse(), shown = h.slice((a.page - 1) * PER, a.page * PER);
      listHTML = !me ? `<div class="signin"><p>Sign in to view your contests.</p><a href="/enter">Sign in</a></div>` : !h.length ? `<div class="empty2">${a.hist ? 'No rated rounds yet. A Div. 4 or Div. 3 is a good first one.' : 'Loading…'}</div>`
        : shown.map((x) => { const dl = x[4] - x[3]; return `<a class="crow" href="/contest/${x[0]}">${thumb(x[1])}<span class="cm"><span class="n" title="${esc(x[1])}">${esc(shortName(x[1]))}</span><span class="d">${esc(lcDate(x[5]))}</span></span><span class="sc">#${N(x[2])}</span><span class="dl ${dl >= 0 ? 'up' : 'dn'}">${dl >= 0 ? '+' : ''}${dl}</span></a>`; }).join('') + pager(h.length);
    } else {
      const past = rows.filter((x) => x[2] !== 'BEFORE' && x[2] !== 'CODING'), shown = past.slice((a.page - 1) * PER, a.page * PER);
      listHTML = !a.list ? '<div class="empty2">Loading the contests…</div>' : shown.map((c) => { const s0 = solvedIn(c[0]), t = total(c[0]), you = byC.get(c[0]);
        return `<a class="crow" href="/contest/${c[0]}">${thumb(c[1])}<span class="cm"><span class="n" title="${esc(c[1])}">${esc(shortName(c[1]))}</span><span class="d">${esc(lcDate(c[3]))}</span></span>${t ? `<span class="sc${s0 ? ' some' : ''}" title="Solved ${s0} of ${t}${you ? ` · rank #${N(you[2])}` : ''}">${s0 || 0} / ${t}</span>` : '<span class="sc ghost"></span>'}<span class="vbtn" data-virtual="${c[0]}" role="button" tabindex="0" title="Take part as a virtual contest">Virtual</span></a>`; }).join('') + pager(past.length);
    }
    $('main').innerHTML = `<div class="cwrap">
 <section class="hero" data-m="hero">${TROPHY}<h1>Codeforces Contest</h1><p>Contest every week. Compete and see your ranking!</p></section>
 <div class="ccards" data-m="ccards">${a.listError ? `<div class="empty2">Codeforces' API did not answer (${esc(a.listError)}). Reload in a minute.</div>` : !a.list ? '<article class="ccard skel"></article><article class="ccard sm skel"></article>' : cards.length ? cards.map(card).join('') : '<div class="empty2">No rounds announced yet.</div>'}</div>
 ${more.length ? `<button class="moreup" data-act="moreup">${ic('cal')}${a.moreUp ? 'Hide' : `${more.length} more upcoming round${more.length === 1 ? '' : 's'}`}</button>${a.moreUp ? `<div class="uplist">${more.map((c) => `<a href="/contests/${c[0]}"><span class="un" title="${esc(c[1])}">${esc(shortName(c[1]))}</span><span class="ud">${esc(lcDate(c[3]))}</span><span class="uc" data-cd="${c[3]}" data-run="0">${countdown(c[3] - now)}</span></a>`).join('')}</div>` : ''}` : ''}
 <div class="cgrid" data-m="cgrid"><aside class="rank" data-m="ranking"><div class="scope"><button class="${a.scope !== 'country' ? 'on' : ''}" data-scope="global"><span>Global</span></button>${mine ? `<button class="${a.scope === 'country' ? 'on' : ''}" data-scope="country"><span>${esc(mine)}</span></button>` : ''}</div>${ranking}</aside>
 <section class="lcard" data-m="lcard"><div class="lhead"><span class="sgm" role="tablist"><button class="${a.tab === 'past' ? 'on' : ''}" data-tab="past" role="tab">Past Contests</button><button class="${a.tab === 'mine' ? 'on' : ''}" data-tab="mine" role="tab">My Contests</button></span><button class="rnd" data-act="random" title="A random past round you have not done, as a virtual contest" aria-label="Random contest">${ic('shuffle')}</button></div>${listHTML}</section></div></div>`;
    app.sh.querySelectorAll('.av img').forEach((im) => { const bad = () => im.remove(); if (im.complete && !im.naturalWidth) bad(); else im.addEventListener('error', bad, { once: true }); });
  }
  function tickCountdowns() {
    if (!app) return;
    const now = Date.now() / 1000;
    app.sh.querySelectorAll('[data-cd]').forEach((el) => { el.textContent = `${el.dataset.run === '1' ? 'Live · ' : ''}${countdown(+el.dataset.cd - now)}`; });
  }
  function randomContest() {
    const a = app, r = a.info ? a.info.rating : null, rr = r == null ? 0 : r;
    const fits = (n) => { const [l] = division(n); return l === 'Div. 4' ? rr < 1400 : l === 'Div. 3' ? rr < 1600 : l === 'Div. 2' || l === 'Educational' ? rr < 2100 : l === 'Div. 1' ? rr >= 1900 : true; };
    const done = new Set((a.hist || []).map((x) => x[0]));
    const pool = (a.list || []).filter((c) => c[2] === 'FINISHED' && !done.has(c[0]) && fits(c[1]));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) location.href = `/contestRegistration/${pick[0]}/virtual/true`;
  }

  /* ================================ Discuss (LeetCode's /discuss/, measured) ================================
     Codeforces' home feed, read from the page itself (no request): each .topic's title, author, time, text, first picture,
     its rating (the sibling meta box) and comment count; "Recent actions" from the sidebar becomes Trending. Tabs: For You
     (/) and Top (/top); Most Votes / Newest sort the page; pages are Codeforces' own /page/N. */
  function readFeed() {
    const posts = [...document.querySelectorAll('#pageContent .topic')].map((t) => {
      const box = t.parentElement || t, a = t.querySelector('.title a'), m = /\/blog\/entry\/(\d+)/.exec(a ? a.getAttribute('href') : '');
      if (!a || !m) return null;
      const au = t.querySelector('.info a.rated-user'), when = t.querySelector('.info .format-humantime');
      const body = t.querySelector('.content .ttypography'), cl = body ? body.cloneNode(true) : null;
      if (cl) { cl.querySelectorAll('script, style, .MathJax, .MathJax_Preview, .MathJax_Display, .spoiler-content, pre, table').forEach((x) => x.remove()); }
      const text = cl ? cl.textContent.replace(/\$\$\$/g, '').replace(/\s+/g, ' ').trim() : '';
      const img = body && [...body.querySelectorAll('img')].map((x) => x.getAttribute('src') || '').find((u) => /^(https?:)?\/\//.test(u) && !/\/images\/(flags|icons)\//.test(u));
      const rt = box.querySelector('.topic-rating'), cm = box.querySelector('.right-meta a[href*="#comments"]:not(:has(img))') || [...box.querySelectorAll('.right-meta a[href*="#comments"]')].pop();
      const rank = au ? ((au.className.match(/user-(\w+)/) || [])[1] || 'gray') : 'gray';
      return { id: m[1], title: a.textContent.replace(/\s+/g, ' ').trim(), author: au ? au.textContent.trim() : '', rank: RKC[rank] ? rank : rank === 'legendary' ? 'red' : 'gray', when: when ? when.textContent.trim() : '', at: when ? Date.parse((when.getAttribute('title') || '').replace(/\//g, ' ')) || 0 : 0, text: text.slice(0, 320), img: img ? (img.startsWith('//') ? 'https:' + img : img) : '', votes: rt ? parseInt(rt.textContent.replace(/[^\d-]/g, ''), 10) || 0 : 0, comments: cm ? parseInt(cm.textContent.replace(/\D/g, ''), 10) || 0 : 0 };
    }).filter(Boolean);
    const trending = [...document.querySelectorAll('#sidebar .recent-actions li')].map((li) => {
      const u = li.querySelector('a.rated-user'), b = li.querySelector('a[href*="/blog/entry/"]'), ic2 = li.querySelector('img');
      if (!b) return null;
      const rank = u ? ((u.className.match(/user-(\w+)/) || [])[1] || 'gray') : 'gray';
      return { href: b.getAttribute('href'), title: b.textContent.trim(), author: u ? u.textContent.trim() : '', rank: RKC[rank] ? rank : rank === 'legendary' ? 'red' : 'gray', kind: ic2 && /comment/i.test(ic2.getAttribute('alt') || '') ? 'comment' : 'update' };
    }).filter(Boolean).slice(0, 12);
    const pages = [...document.querySelectorAll('#pageContent .pagination a[href*="/page/"], #pageContent a[href^="/page/"]')].map((x) => +((/\/page\/(\d+)/.exec(x.getAttribute('href')) || [])[1] || 0)).filter(Boolean);
    return { posts, trending, last: pages.length ? Math.max(...pages) : 1 };
  }
  function discussView() {
    const a = app, F = a.feed || (a.feed = readFeed());
    const cur = +((/\/page\/(\d+)/.exec(PATH) || [])[1] || 1), base = /^\/top/.test(PATH) ? 'top' : 'home';
    const q = (a.q || '').toLowerCase();
    let posts = F.posts.filter((p) => !q || (p.title + ' ' + p.author + ' ' + p.text).toLowerCase().includes(q));
    if (a.sort === 'votes') posts = posts.slice().sort((x, y) => y.votes - x.votes);
    else if (a.sort === 'new') posts = posts.slice().sort((x, y) => y.at - x.at);
    const up = (a.upcoming || [])[0], me = a.d.handle;
    const promo = (cls, href, title, sub, cta) => `<a class="promo ${cls}" href="${href}"><span class="pt1">${title}</span><span class="pt2">${sub}</span>${cta ? `<span class="pcta">${cta}</span>` : ''}</a>`;
    const promos = promo('p-a', '/contests', up ? esc(shortName(up[1])) : 'Codeforces Rounds', up ? `Starts in ${countdown(up[2] - Date.now() / 1000).replace(/:\d\d$/, '')}` : 'Rated rounds every week', up ? 'Register' : 'See contests')
      + promo('p-b', '/problemset', 'Practice', 'Problems by difficulty and topic', 'Start now')
      + promo('p-c', '/gyms', 'Gym', 'Past ICPC and olympiad sets as virtual contests', '')
      + promo('p-d', '/edu/courses', 'EDU', 'Courses with lessons and practice', '');
    const item = (p) => `<a class="post" href="/blog/entry/${p.id}"><span class="pav" style="--c:${RKC[p.rank]}">${esc((p.author || '?')[0].toUpperCase())}</span><span class="pbody">
 <span class="pmeta"><span style="color:${RKC[p.rank]}">${esc(p.author)}</span><i></i><span class="pw">${esc(p.when)}</span></span>
 <span class="ptitle">${esc(p.title)}</span>${p.text ? `<span class="ptext">${esc(p.text)}</span>` : ''}
 <span class="pstats"><span title="Rating">${ic('vote')}${p.votes > 0 ? '+' : ''}${N(p.votes)}</span><span title="Comments">${ic('msg')}${N(p.comments)}</span></span></span>${p.img ? `<span class="pimg"><img src="${esc(p.img)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>` : ''}</a>`;
    const pg = (n) => (base === 'top' ? '/top' : n === 1 ? '/' : `/page/${n}`);
    const pager = base === 'top' || F.last <= 1 ? '' : `<div class="pager">${cur > 1 ? `<a href="${pg(cur - 1)}" aria-label="Previous page">${ic('left')}</a>` : ''}${[...new Set([1, cur - 1, cur, cur + 1, F.last])].filter((n) => n >= 1 && n <= F.last).sort((x, y) => x - y).map((n, i, arr) => `${i && n - arr[i - 1] > 1 ? '<span>…</span>' : ''}<a href="${pg(n)}" class="${n === cur ? 'on' : ''}">${n}</a>`).join('')}${cur < F.last ? `<a href="${pg(cur + 1)}" aria-label="Next page">${ic('right')}</a>` : ''}</div>`;
    $('main').innerHTML = `<div class="dwrap"><div class="dmain"><div class="promos">${promos}</div>
 <div class="dtabs"><a class="dtab${base === 'home' ? ' on' : ''}" href="/">${ic('flame')}For You</a><a class="dtab${base === 'top' ? ' on' : ''}" href="/top">Top</a><a class="dtab" href="/recent-actions">Recent actions</a><a class="dtab" href="/catalog">Catalog</a>
 ${me ? `<a class="dcreate" href="/blog/entry/new">${ic('edit')}Create</a>` : ''}</div>
 <div class="dsort"><button class="${a.sort === 'votes' ? 'on' : ''}" data-sort="votes">${ic('vote')}Most Votes</button><button class="${a.sort === 'new' ? 'on' : ''}" data-sort="new">${ic('spark')}Newest</button></div>
 <div class="posts" data-m="posts">${posts.length ? posts.map(item).join('') : `<div class="empty2">${F.posts.length ? 'No post on this page matches.' : 'No posts on this page.'}</div>`}</div>${pager}</div>
 <aside class="dside"><label class="dsearch">${ic('search')}<input id="dq" type="search" placeholder="Search" value="${esc(a.q || '')}" aria-label="Search the posts on this page"></label>
 <div class="trend" data-m="trending"><div class="th2">${ic('compass')}Trending</div>${F.trending.map((t, i) => `<a class="ti" href="${esc(t.href)}"><span class="tn${i < 3 ? ' hot' : ''}">${i + 1}</span><span class="tb"><span class="tt2">${esc(t.title)}</span><span class="tm"><span style="color:${RKC[t.rank]}">${esc(t.author)}</span><i></i>${ic(t.kind === 'comment' ? 'msg' : 'edit')}${t.kind === 'comment' ? 'new comments' : 'updated'}</span></span></a>`).join('') || '<div class="empty2">Nothing yet.</div>'}</div></aside></div>`;
    const inp = $('dq'); if (inp) { inp.addEventListener('input', () => { a.q = inp.value; clearTimeout(a.qt); a.qt = setTimeout(() => { draw(); const n = $('dq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 150); }); }
    app.sh.querySelectorAll('.pimg img').forEach((im) => { const bad = () => im.parentNode && im.parentNode.remove(); if (im.complete && !im.naturalWidth) bad(); else im.addEventListener('error', bad, { once: true }); });
  }

  /* ================================ Gym ================================
     Codeforces' Gym (contest.list?gym=true, once a day), in the Contests page's list style: search, difficulty, type,
     sort, 20 a page; each row opens the gym, Virtual starts it as a virtual contest. */
  const GPER = 20;
  function gymView() {
    const a = app, all = a.gyms || [], f = a.gf;
    const q = (f.q || '').toLowerCase();
    let rows = all.filter((g) => (!f.diff || g[2] === f.diff) && (!f.type || g[3] === f.type) && (!q || (g[1] + ' ' + g[4] + ' ' + g[5] + ' ' + g[6] + ' ' + g[7]).toLowerCase().includes(q)));
    if (f.sort === 'old') rows = rows.slice().reverse();
    else if (f.sort === 'hard') rows = rows.slice().sort((x, y) => y[2] - x[2] || y[0] - x[0]);
    else if (f.sort === 'easy') rows = rows.slice().sort((x, y) => (x[2] || 9) - (y[2] || 9) || y[0] - x[0]);
    const pages = Math.max(1, Math.ceil(rows.length / GPER)); if (a.page > pages) a.page = pages;
    const shown = rows.slice((a.page - 1) * GPER, a.page * GPER);
    const stars = (n) => `<span class="stars" title="${n ? `Difficulty ${n} of 5` : 'Difficulty not set'}">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
    const GC = ['#8a8f98', '#2cbb5d', '#1cbaba', '#ffb700', '#ff8a3d', '#f63737'];
    const thumb = (g) => `<span class="gth" style="--c:${GC[g[2]] || GC[0]}"><b>${esc((g[3] || 'GYM').slice(0, 4))}</b><small>${esc(g[4] || (g[9] ? new Date(g[9] * 1000).getFullYear() : ''))}</small></span>`;
    const chip = (attr, v, label, on) => `<button class="gchip${on ? ' on' : ''}" data-${attr}="${v}">${label}</button>`;
    const pager = pages <= 1 ? '' : (() => { const cur = a.page, nums = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - cur) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…'); return `<div class="pager"><button data-pg="${cur - 1}" ${cur <= 1 ? 'disabled' : ''} aria-label="Previous page">${ic('left')}</button>${nums.map((x) => x === '…' ? '<button disabled>…</button>' : `<button data-pg="${x}" class="${x === cur ? 'on' : ''}">${x}</button>`).join('')}<button data-pg="${cur + 1}" ${cur >= pages ? 'disabled' : ''} aria-label="Next page">${ic('right')}</button></div>`; })();
    const list = a.gymsError ? `<div class="empty2">Codeforces' API did not answer (${esc(a.gymsError)}). Reload in a minute.</div>` : !a.gyms ? '<div class="empty2">Loading the Gym…</div>'
      : !shown.length ? '<div class="empty2">No training matches. Try clearing a filter.</div>'
      : shown.map((g) => `<a class="grow" href="/gym/${g[0]}">${thumb(g)}<span class="cm"><span class="n" title="${esc(g[1])}">${esc(g[1])}</span><span class="d">${[g[5] && esc([g[6], g[5]].filter(Boolean).join(', ')), g[7] && 'by ' + esc(g[7].replace(/<[^>]*>/g, '').replace(/^\/?profile\//, '').slice(0, 40)), g[8] ? dur(g[8]) : ''].filter(Boolean).join(' · ') || '&nbsp;'}</span></span>${stars(g[2])}<span class="vbtn" data-gvirtual="${g[0]}" role="button" tabindex="0" title="Take part as a virtual contest">Virtual</span></a>`).join('');
    $('main').innerHTML = `<div class="gwrap2"><section class="ghero"><h1>Gym</h1><p>${a.gyms ? N(all.length) + ' training sets' : 'Training sets'}: past ICPC regionals, olympiads and camps. Run any of them as a virtual contest.</p></section>
 <div class="gtools"><label class="gsearch">${ic('search')}<input id="gq" type="search" placeholder="Search by name, season, country, author" value="${esc(f.q || '')}" autocomplete="off"></label>
  <span class="gseg">${chip('gtype', '', 'All', !f.type)}${chip('gtype', 'ICPC', 'ICPC', f.type === 'ICPC')}${chip('gtype', 'IOI', 'IOI', f.type === 'IOI')}</span>
  <span class="gsort"><select id="gsort" aria-label="Sort"><option value="new"${f.sort === 'new' ? ' selected' : ''}>Newest</option><option value="old"${f.sort === 'old' ? ' selected' : ''}>Oldest</option><option value="easy"${f.sort === 'easy' ? ' selected' : ''}>Easiest</option><option value="hard"${f.sort === 'hard' ? ' selected' : ''}>Hardest</option></select>${ic('down')}</span></div>
 <div class="gdiff">${chip('gdiff', 0, 'Any difficulty', !f.diff)}${[1, 2, 3, 4, 5].map((n) => chip('gdiff', n, stars(n), f.diff === n)).join('')}<span class="gcount">${a.gyms ? N(rows.length) + ' shown' : ''}</span></div>
 <section class="lcard glist" data-m="gyms">${list}${pager}</section></div>`;
    const inp = $('gq'); if (inp) inp.addEventListener('input', () => { f.q = inp.value; a.page = 1; clearTimeout(a.qt); a.qt = setTimeout(() => { draw(); const n = $('gq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 150); });
    const so = $('gsort'); if (so) so.addEventListener('change', () => { f.sort = so.value; a.page = 1; draw(); });
  }

  /* ================================ Profile (LeetCode's /u/<name>/, measured) ================================ */
  const ADV = ['dp', 'graphs', 'trees', 'dsu', 'divide and conquer', 'flows', 'fft', 'string suffix structures', '2-sat', 'matrices', 'games', 'geometry', 'graph matchings', 'shortest paths', 'meet-in-the-middle', 'chinese remainder theorem', 'expression parsing', 'schedules', 'ternary search'];
  const INT = ['binary search', 'dfs and similar', 'number theory', 'combinatorics', 'two pointers', 'data structures', 'hashing', 'probabilities', 'bitmasks', 'interactive', 'constructive algorithms'];
  const TAGNAME = (t) => t.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^Dp$/, 'Dynamic Programming').replace(/^Dsu$/, 'Union-Find').replace(/^Dfs And Similar$/, 'DFS and Similar').replace(/^Fft$/, 'FFT');
  /* badges: milestones in the user's own rows, each with the day it was reached */
  function badges(firstAC, hist, days) {
    const out = [];
    for (const [n, t, tier] of [[1, 'First Accepted', 0], [10, '10 Problems', 1], [50, '50 Problems', 2], [100, '100 Problems', 3], [250, '250 Problems', 4], [500, '500 Problems', 5], [1000, '1000 Problems', 6]]) out.push({ k: 'solve', t, tier, at: firstAC.length >= n ? firstAC[n - 1] : 0, need: `Solve ${n} problem${n === 1 ? '' : 's'}`, glyph: n === 1 ? 'AC' : String(n) });
    for (const [n, t, tier] of [[1, 'First Round', 0], [5, '5 Rounds', 1], [10, '10 Rounds', 2], [25, '25 Rounds', 3], [50, '50 Rounds', 4], [100, '100 Rounds', 5]]) out.push({ k: 'round', t, tier, at: hist.length >= n ? hist[n - 1][5] : 0, need: `Take part in ${n} rated round${n === 1 ? '' : 's'}`, glyph: String(n) });
    const reached = {}; let run = 0;
    days.forEach((t, i) => { run = i && Math.round((t - days[i - 1]) / 86400000) === 1 ? run + 1 : 1; for (const L of [7, 30, 100]) if (run >= L && !reached[L]) reached[L] = t / 1000; });
    for (const [L, tier] of [[7, 2], [30, 4], [100, 6]]) out.push({ k: 'streak', t: `${L}-Day Streak`, tier, at: reached[L] || 0, need: `Submit on ${L} days in a row`, glyph: String(L) });
    for (const [lo, name] of RANKS.slice(1, 7)) { const hit = hist.find((x) => x[4] >= lo); out.push({ k: 'rank', t: name, tier: 3, lvl: rankLevel(lo), col: RKC[rankOf(lo)], at: hit ? hit[5] : 0, need: `Reach ${lo} rating`, glyph: name.split(' ').map((w) => w[0]).join('') }); }
    return out;
  }
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
  /* badges: rendered art (scripts/build-badges.py: a height map lit by a studio, 240 px), one file per badge; not earned = the
     same die in unfinished gunmetal. A rank's medal grows with the rank (swords, wings, crown, sunburst). Hovering tilts a medal toward the pointer and a highlight follows it across the metal. */
  const TIER_GLOW = ['#0d6a43', '#0d5c66', '#1b46ad', '#2a3563', '#8c1231', '#4b1ea3', '#6a3dff'];
  const glow = (b) => (b.col ? shade(b.col, -.45) : TIER_GLOW[Math.min(b.tier, 6)]);
  const medalFile = (b) => (b.k === 'rank' ? `rank-${b.lvl}${b.at ? '' : '-l'}` : `${b.k}-${String(b.glyph).toLowerCase()}${b.at ? '' : '-l'}`);
  /* the card shows the most prestigious, not the newest: the best of each kind first (three of one kind look alike), then
     the next best when fewer than three kinds are earned. A rank outranks a milestone of the same weight. */
  const prestige = (b) => (b.k === 'rank' ? 20 + b.lvl * 13 : b.tier * 10);
  function bestBadges(earned) {
    const list = [...earned].sort((x, y) => prestige(y) - prestige(x) || (y.k === 'rank') - (x.k === 'rank') || y.at - x.at);
    const best = list.filter((b, i) => list.findIndex((x) => x.k === b.k) === i);
    return [...best, ...list.filter((b) => !best.includes(b))].slice(0, 3).sort((x, y) => prestige(y) - prestige(x));
  }
  function medal(b, size = 64) {
    const url = chrome.runtime.getURL(`textures/badges/${medalFile(b)}.webp`);
    return `<span class="medal${b.at ? '' : ' locked'}" style="width:${size}px;height:${size}px;--m:url(${url})"><img src="${url}" alt="" width="${size}" height="${size}" decoding="sync" draggable="false">${b.at ? '<i class="gl"></i>' : ''}</span>`;
  }
  let tilted = null;
  const untilt = () => { if (tilted) { tilted.classList.remove('tilt'); tilted.style.removeProperty('--rx'); tilted.style.removeProperty('--ry'); tilted = null; } };
  function medalTilt(e) {
    const host = e.target.closest && e.target.closest('.bi:not(.off),.bm span'), m = host && host.querySelector('.medal');
    if (m !== tilted) untilt();
    if (!m || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const r = m.getBoundingClientRect(), x = Math.max(-.7, Math.min(.7, (e.clientX - r.left) / r.width - .5)), y = Math.max(-.7, Math.min(.7, (e.clientY - r.top) / r.height - .5));
    m.classList.add('tilt'); tilted = m;
    m.style.setProperty('--rx', (-y * 26).toFixed(1) + 'deg'); m.style.setProperty('--ry', (x * 26).toFixed(1) + 'deg');
    m.style.setProperty('--gx', ((x + .5) * 100).toFixed(0) + '%'); m.style.setProperty('--gy', ((y + .5) * 100).toFixed(0) + '%');
  }
  function heatmap(rows, year) {
    const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const perDay = new Map(); for (const x of rows) { const k = dayKey(new Date(x[1] * 1000)); perDay.set(k, (perDay.get(k) || 0) + 1); }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let first, last;
    if (year === 'current') { first = new Date(today.getFullYear(), today.getMonth() - 11, 1); last = today; }
    else { first = new Date(+year, 0, 1); last = new Date(+year, 11, 31); if (last > today) last = today; }
    const C = 8.86, S = 11.52, MG = 4.43;   // LeetCode's cell, step and month gap
    let x = 0, cells = '', labels = '', total = 0, active = 0;
    for (let m = new Date(first); m <= last; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const startX = x, dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      let col = 0;
      for (let dd = 1; dd <= dim; dd++) {
        const cur = new Date(m.getFullYear(), m.getMonth(), dd); if (cur > last) break;
        const wd = cur.getDay(); if (dd > 1 && wd === 0) col++;
        const n = perDay.get(dayKey(cur)) || 0; total += n; if (n) active++;
        const lv = !n ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4;
        cells += `<rect class="l${lv}" x="${(x + col * S).toFixed(2)}" y="${(wd * S).toFixed(2)}" width="${C}" height="${C}" rx="2"><title>${n} submission${n === 1 ? '' : 's'} on ${cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</title></rect>`;
      }
      const wdt = col * S + C;
      labels += `<text x="${(startX + wdt / 2).toFixed(2)}" y="${(7 * S + 14).toFixed(2)}" text-anchor="middle">${m.toLocaleString('en-US', { month: 'short' })}</text>`;
      x += (col + 1) * S + MG;
    }
    const W = x - MG - (S - C), H = 7 * S + 20;
    return { svg: `<svg class="hm" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Submissions per day">${cells}${labels}</svg>`, total, active };
  }
  function profileView() {
    const a = app, u = a.info, me = a.d.handle && a.d.handle.toLowerCase() === HANDLE.toLowerCase();
    if (a.notFound) { $('main').innerHTML = `<div class="nf"><b>No user "${esc(HANDLE)}"</b>Codeforces has no handle like that. <a href="/problemset">Back to problems</a></div>`; return; }
    if (!u) { $('main').innerHTML = a.infoError ? `<div class="nf"><b>Couldn't load this profile</b>Codeforces' API did not answer (${esc(a.infoError)}). Reload in a minute.</div>` : `<div class="pf"><div class="sk" style="height:420px"></div><div><div class="sk" style="height:200px"></div><div class="sk" style="height:180px;margin-top:16px"></div></div></div>`; return; }
    const r = u.rating, rk = rankOf(r), hist = a.hist || [];
    const rows = (a.status && a.status.rows) || [], names = a.names || new Map();
    const ok = new Map(), tried = new Set();
    for (const x of rows) { const k = x[2] + x[3]; if (x[4] === 'OK') { if (!ok.has(k) || ok.get(k)[1] > x[1]) ok.set(k, x); } else tried.add(k); }
    for (const k of ok.keys()) tried.delete(k);
    const lastAC = new Map(); for (const x of rows) if (x[4] === 'OK') { const k = x[2] + x[3]; if (!lastAC.has(k) || lastAC.get(k)[1] < x[1]) lastAC.set(k, x); }
    const inSet = a.prob ? new Map(a.prob.map((p) => [p[0] + p[1], p])) : new Map();
    const solvedSet = [...ok.keys()].filter((k) => inSet.has(k)), gym = ok.size - solvedSet.length;
    const B = { Easy: [0, 0], Medium: [0, 0], Hard: [0, 0], 'Not rated': [0, 0] };
    for (const p of a.prob || []) B[band(p[3])][1]++;
    for (const k of solvedSet) B[band(inSet.get(k)[3])][0]++;
    const tagOf = (k) => (inSet.get(k) ? inSet.get(k)[5] : names.get(k) ? names.get(k)[2] || [] : []) || [];
    const tags = new Map(); for (const k of ok.keys()) for (const t of tagOf(k)) tags.set(t, (tags.get(t) || 0) + 1);
    const langs = new Map(); for (const [, x] of ok) langs.set(x[5], (langs.get(x[5]) || 0) + 1);
    const days = [...new Set(rows.map((x) => { const t = new Date(x[1] * 1000); t.setHours(0, 0, 0, 0); return t.getTime(); }))].sort((x, y) => x - y);
    let bestRun = 0, run = 0; days.forEach((t, i) => { run = i && Math.round((t - days[i - 1]) / 86400000) === 1 ? run + 1 : 1; bestRun = Math.max(bestRun, run); });
    const name = (k) => (names.get(k) || (inSet.get(k) ? [inSet.get(k)[2], inSet.get(k)[3]] : null));
    const href = (x) => (x[2] >= 100000 ? `/gym/${x[2]}/problem/${encodeURIComponent(x[3])}` : `/problemset/problem/${x[2]}/${encodeURIComponent(x[3])}`);
    const word = (v) => (v === 'OK' ? 'Accepted' : v ? v.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'In queue');
    const H = encodeURIComponent(u.handle);
    const lastR = hist[hist.length - 1], lastD = lastR ? lastR[4] - lastR[3] : null;
    const sgn = (v) => (v > 0 ? '+' : '') + v;

    /* ---- left column (no card, as LeetCode) ---- */
    const photo = a.photo || photoOf(u.photo);
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ');
    const where = [u.city, u.country].filter(Boolean).join(', ');
    const fact = (icon, v) => (v ? `<div class="fact">${ic(icon)}<span>${v}</span></div>` : '');
    const langList = [...langs.entries()].sort((x, y) => y[1] - x[1]);
    const tagList = [...tags.entries()].sort((x, y) => y[1] - x[1]);
    const grp = (lvl, col, list, key) => { if (!list.length) return ''; const open = a.open && a.open[key]; return `<div class="skg"><div class="skh"><i style="background:${col}"></i>${lvl}</div><div class="skt">${list.slice(0, open ? 99 : 3).map(([t, n]) => `<span class="stw"><a class="stag" href="/problemset?tags=${encodeURIComponent(t)}">${esc(TAGNAME(t))}</a><small>x${n}</small></span>`).join('')}</div>${list.length > 3 ? `<button class="smore" data-open="${key}">${open ? 'Show less' : 'Show more'}</button>` : ''}</div>`; };
    const stat = (icon, col, k, v, sub) => `<div class="cs"><span class="csi" style="color:${col}">${ic(icon)}</span><div><div class="csl"><span>${k}</span><b>${v}</b></div>${sub ? `<div class="css">${sub}</div>` : ''}</div></div>`;
    const left = `<aside class="pfl" data-m="pfleft">
 <div class="who"><div class="av80" id="pfav">${photo ? `<img src="${esc(photo)}" alt="">` : ''}<b>${esc(u.handle[0].toUpperCase())}</b></div><div class="wn"><div class="hn" style="color:${RKC[rk]}">${esc(u.handle)}</div><div class="hs2">${esc(full || rankName(r))}</div><div class="hr"><span>Rating</span> <b>${r == null ? '—' : N(r)}</b></div></div></div>
 ${u.organization ? `<div class="bio">${esc(u.organization)}</div>` : ''}
 <div class="fol"><button class="folb" data-act="follows" title="${me ? 'Followers and the people you follow' : 'Followers'}"><b>${N(u.friendOfCount)}</b> Followers</button><i></i><span><b>${sgn(u.contribution)}</b> Contribution</span></div>
 <div class="pacts">${me ? `<a class="pbtn" href="/settings/general">${ic('edit')}Edit Profile</a>` : `<a class="pbtn" href="/usertalk?other=${H}">${ic('msg')}Message</a>`}<span class="pmore-w"><button class="pmore" data-act="pmenu" aria-label="More">${ic('dots')}</button><span class="pmenu" hidden><a href="/submissions/${H}">Submissions</a><a href="/blog/${H}">Blog</a><a href="/contests/with/${H}">Contests</a>${me ? `<a href="/friends">Friends</a>` : ''}</span></span></div>
 <div class="facts">${fact('pin', esc(where))}${fact('cal', u.registered ? 'Joined ' + new Date(u.registered * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '')}${fact('clock', u.lastOnline ? 'Last visit ' + ago(u.lastOnline) : '')}
 ${langList.length ? `<div class="fact">${ic('code')}<span class="lchips">${langList.slice(0, 3).map(([l]) => `<span>${esc(l.replace(/\s*\(.*\)$/, ''))}</span>`).join('')}</span></div>` : ''}</div>
 <div class="divd"></div><div class="sec">Community Stats</div>
 ${stat('trophy', '#ffa116', 'Max rating', u.maxRating == null ? '—' : N(u.maxRating), u.maxRating == null ? '' : `<span style="color:${RKC[rankOf(u.maxRating)]}">${rankName(u.maxRating)}</span>`)}
 ${stat('chart', '#2cbb5d', 'Rated rounds', a.hist ? hist.length : '…', lastR ? `Last round <span class="${lastD >= 0 ? 'blue' : 'red'}">${sgn(lastD)}</span>` : '')}
 ${stat('msg', '#0a84ff', 'Contribution', sgn(u.contribution), '')}
 <button class="csb" data-act="follows">${stat('heart', '#ff375f', 'Followers', N(u.friendOfCount), '')}</button>
 ${langList.length ? `<div class="divd"></div><div class="sec">Languages</div>${langList.slice(0, a.open && a.open.langs ? 99 : 3).map(([l, n]) => `<div class="lrow"><span class="lpill">${esc(l)}</span><span><b>${n}</b> problem${n === 1 ? '' : 's'} solved</span></div>`).join('')}${langList.length > 3 ? `<button class="smore" data-open="langs">${a.open && a.open.langs ? 'Show less' : 'Show more'}</button>` : ''}` : ''}
 ${tagList.length ? `<div class="divd"></div><div class="sec">Skills</div>${grp('Advanced', '#f63737', tagList.filter(([t]) => ADV.includes(t)), 'adv')}${grp('Intermediate', '#ffb700', tagList.filter(([t]) => INT.includes(t)), 'int')}${grp('Fundamental', '#2cbb5d', tagList.filter(([t]) => !ADV.includes(t) && !INT.includes(t)), 'fun')}` : ''}</aside>`;

    /* ---- contest card: rating, level, global ranking, attended, the line; then "Top x%" over the rating distribution ---- */
    const R = a.rated, total = R ? R.ratings.length : 0;
    let gRank = null; if (R && r != null) { let lo = 0, hi = total; while (lo < hi) { const m = (lo + hi) >> 1; if (R.ratings[m] > r) lo = m + 1; else hi = m; } gRank = lo + 1; }
    let dist = '';
    if (R) {
      const B0 = 400, STEP = 150, NB = 22, cnt = new Array(NB).fill(0);
      for (const v of R.ratings) cnt[Math.max(0, Math.min(NB - 1, Math.floor((v - B0) / STEP)))]++;
      const mx = Math.max(...cnt), mine = r == null ? -1 : Math.max(0, Math.min(NB - 1, Math.floor((r - B0) / STEP)));
      dist = `<div class="dist">${cnt.map((n, i) => `<i class="${i === mine ? 'me' : ''}" style="height:${Math.max(6, n / mx * 100).toFixed(1)}%" title="${B0 + i * STEP}–${B0 + (i + 1) * STEP - 1}: ${N(n)} users"></i>`).join('')}</div>`;
    }
    const topPct = gRank && total ? gRank / total * 100 : null;
    const c1 = `<div class="card c1" data-m="pf-contest"><div class="c1l"><div class="c1h">
  <div><div class="lb1">Contest Rating</div><div class="v24">${r == null ? 'Unrated' : N(r)}</div></div>
  <div class="lvl">${medal({ k: 'rank', lvl: rankLevel(r), col: RKC[rk], tier: 3, at: 1 }, 40)}<div><div class="lb">Level</div><div class="lv" style="color:${RKC[rk]}">${rankName(r)}</div></div></div>
  <div><div class="lb">Global Ranking</div><div class="v12">${gRank ? N(gRank) : '—'}${total ? `<span>/${N(total)}</span>` : ''}</div></div>
  <div><div class="lb">Attended</div><div class="v12">${a.hist ? hist.length : '…'}</div></div></div>
  ${chart(hist, 385, 123)}</div>
 <div class="c1r"><div class="lb">Top</div><div class="v24">${topPct == null ? '—' : (topPct < 1 ? topPct.toFixed(2) : topPct.toFixed(1)) + ' %'}</div>${dist || `<div class="nochart">${a.ratedError ? 'The rating list did not load' : 'Loading…'}</div>`}</div></div>`;

    /* ---- solved + badges ---- */
    const solvedCard = `<div class="card pring" data-m="pf-ring">${a.status && a.prob ? K().solvedCard(B, solvedSet.length, (a.prob || []).length, tried.size, '', (() => { const j = rows.filter((x) => x[4] && x[4] !== 'TESTING'); return j.length ? (100 * j.filter((x) => x[4] === 'OK').length / j.length).toFixed(2) : ''; })()) : '<div class="loadc">Loading…</div>'}${gym > 0 ? `<span class="gym" title="Gym problems solved (not in the problem set)">+${gym} Gym</span>` : ''}</div>`;
    const firstAC = [...ok.values()].map((x) => x[1]).sort((x, y) => x - y);
    const BG = badges(firstAC, hist, days), earned = BG.filter((b) => b.at), top3 = bestBadges(earned);
    const order = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
    const bcard = `<div class="card pbad" data-m="pf-badges"><div class="lb">Badges</div><div class="bn">${earned.length}</div><button class="bgo" data-act="badges" aria-label="All badges" title="All badges">${ic('arrow')}</button>
 <div class="bm">${order.length ? order.map((b) => `<span class="${b === top3[0] ? 'big' : ''}" title="${esc(b.t)} · ${fmtDate(b.at)}">${medal(b, b === top3[0] ? 72 : 56)}</span>`).join('') : '<span class="nob">Solve a problem to earn the first badge</span>'}</div>
 ${top3[0] ? `<div class="lb">Top Badge</div><div class="bt">${esc(top3[0].t)}</div>` : ''}</div>`;

    /* ---- heatmap ---- */
    const years = [...new Set(rows.map((x) => new Date(x[1] * 1000).getFullYear()))].sort((x, y) => y - x);
    const hm = heatmap(rows, a.year);
    const yearRows = a.year === 'current' ? rows.filter((x) => x[1] * 1000 > Date.now() - 365 * 86400000) : rows.filter((x) => new Date(x[1] * 1000).getFullYear() === +a.year);
    const yDays = [...new Set(yearRows.map((x) => { const t = new Date(x[1] * 1000); t.setHours(0, 0, 0, 0); return t.getTime(); }))].sort((x, y) => x - y);
    let yBest = 0; run = 0; yDays.forEach((t, i) => { run = i && Math.round((t - yDays[i - 1]) / 86400000) === 1 ? run + 1 : 1; yBest = Math.max(yBest, run); });
    const heat = `<div class="card pheat" data-m="pf-heat"><div class="hh"><span class="hn2">${N(hm.total)}</span><span class="ht">submissions in ${a.year === 'current' ? 'the past one year' : a.year}</span><span class="hi" title="${bestRun ? `All-time max streak: ${bestRun} day${bestRun === 1 ? '' : 's'}. ` : ''}${a.status && a.status.limited ? 'Counted from the latest 1,000 submissions.' : 'Every submission, by local day.'}">${ic('info')}</span>
 <span class="hs">Total active days: <b>${hm.active}</b></span><span class="hs">Max streak: <b>${yBest}</b></span>
 <span class="ysel"><button class="ybtn" data-act="years">${a.year === 'current' ? 'Current' : a.year}${ic('down')}</button><span class="ypop" hidden>${['current', ...years.map(String)].map((y) => `<button data-year="${y}" class="${a.year === y ? 'on' : ''}">${y === 'current' ? 'Current' : y}${a.year === y ? ic('check') : ''}</button>`).join('')}</span></span></div>
 <div class="hmw">${hm.svg}</div></div>`;

    /* ---- tabs ---- */
    const row = (x, extra) => { const nm = name(x[2] + x[3]); return `<a class="prow2" href="${href(x)}"><span class="tt">${esc(nm ? nm[0] : x[2] + x[3])}</span>${extra || ''}<span class="when">${ago(x[1])}</span></a>`; };
    let tab = '';
    if (a.ptab === 'ac') tab = lastAC.size ? [...lastAC.values()].sort((x, y) => y[1] - x[1]).slice(0, 15).map((x) => row(x)).join('') : `<div class="empty2">${a.status ? 'No accepted solutions yet.' : 'Loading…'}</div>`;
    else if (a.ptab === 'subs') tab = rows.length ? rows.slice(0, 15).map((x) => row(x, `<span class="vd ${x[4] === 'OK' ? 'ok' : /COMPILATION|SKIPPED/.test(x[4]) ? 'neu' : 'bad'}">${word(x[4])}</span>`)).join('') : `<div class="empty2">${a.status ? 'No submissions yet.' : 'Loading…'}</div>`;
    else tab = hist.length ? hist.slice().reverse().slice(0, 15).map((x) => { const dl = x[4] - x[3]; return `<a class="prow2" href="/contest/${x[0]}/standings"><span class="tt">${esc(x[1])}</span><span class="vd ${dl >= 0 ? 'ok' : 'bad'}">${sgn(dl)}</span><span class="when">${fmtDate(x[5])}</span></a>`; }).join('') : `<div class="empty2">${a.hist ? 'No rated rounds yet.' : 'Loading…'}</div>`;
    const T = (k, icon, t) => `<button class="ptab${a.ptab === k ? ' on' : ''}" data-ptab="${k}" role="tab">${ic(icon, 'i ti')}${t}</button>`;
    const tabs = `<div class="card ptabsc" data-m="pf-tabs"><div class="ptop"><div class="ptabs" role="tablist">${T('ac', 'sqcheck', 'Recent AC')}${T('subs', 'file', 'Submissions')}${T('contests', 'trophy', 'Contests')}</div><a class="vall" href="${a.ptab === 'contests' ? `/contests/with/${H}` : `/submissions/${H}`}">View all ${a.ptab === 'contests' ? 'contests' : 'submissions'}${ic('right')}</a></div>${tab}</div>`;

    $('main').innerHTML = `<div class="pf" data-m="pf">${left}<div class="pfr" data-m="pfright">${c1}<div class="pair">${solvedCard}${bcard}</div>${heat}${tabs}</div></div>
 ${a.badgesOpen ? `<div class="modal" data-act="badges-close"><div class="box bbox" role="dialog" aria-label="Badges"><div class="mh"><h2>Badges <small>${earned.length} of ${BG.length}</small></h2><button class="bgo" data-act="badges-close" aria-label="Close">${ic('x')}</button></div><div class="bscroll">${[['solve', 'Problems'], ['round', 'Rated rounds'], ['streak', 'Streaks'], ['rank', 'Ranks']].map(([k, name]) => { const g = BG.filter((x) => x.k === k); return `<h3>${name} <small>${g.filter((x) => x.at).length} of ${g.length}</small></h3><div class="bgrid">${g.map((b) => `<div class="bi${b.at ? '' : ' off'}"${b.at ? ` style="--g:${glow(b)}"` : ''}>${medal(b, 96)}<b>${esc(b.t)}</b><small>${b.at ? fmtDate(b.at) : esc(b.need)}</small></div>`).join('')}</div>`; }).join('')}</div></div></div>` : ''}${a.follows ? followsModal(u, me) : ''}`;
    const img = $('pfav') && $('pfav').querySelector('img');
    if (img) { const bad = () => img.remove(); if (img.complete && !img.naturalWidth) bad(); else img.addEventListener('error', bad, { once: true }); }
    app.sh.querySelectorAll('.av img').forEach((im) => { const bad = () => im.remove(); if (im.complete && !im.naturalWidth) bad(); else im.addEventListener('error', bad, { once: true }); });
  }


  /* ================================ Friends (/friends) and the profile's Following list ================================ */
  /* the handles a friends page lists: every profile link in its content (the sidebar's are outside #pageContent) */
  function friendsIn(doc, me) {
    const box = doc.querySelector('#pageContent') || doc.body, seen = new Set(), out = [];
    for (const l of box ? box.querySelectorAll('a[href*="/profile/"]') : []) {
      const m = (l.getAttribute('href') || '').match(/\/profile\/([^/?#]+)/); if (!m) continue;
      const h = decodeURIComponent(m[1]), k = h.toLowerCase();
      if (k === (me || '').toLowerCase() || seen.has(k)) continue;
      seen.add(k); out.push(h);
    }
    return out;
  }
  const online = (t) => t && Date.now() / 1000 - t < 600;
  const byRating = (x, y) => (y[1] == null ? -1e9 : y[1]) - (x[1] == null ? -1e9 : x[1]);
  function personRow(p, compact) {
    const [h, r, mx, photo, last, country, city, org, f, l] = p, H = encodeURIComponent(h), rk = rankOf(r), name = [f, l].filter(Boolean).join(' ');
    const sub = [name, org, [city, country].filter(Boolean).join(', ')].filter(Boolean).map(esc).join(' · ');
    const img = photoOf(photo);
    return `<a class="frow${compact ? ' sm' : ''}" href="/profile/${H}"><span class="fav">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}<b>${esc(h[0].toUpperCase())}</b>${online(last) ? '<i class="on" title="Online now"></i>' : ''}</span>
 <span class="fm"><span class="fh" style="color:${RKC[rk]}">${esc(h)}</span><span class="fs">${sub || esc(rankName(r))}</span></span>
 ${compact ? '' : `<span class="fr"><b style="color:${RKC[rk]}">${r == null ? '—' : N(r)}</b><small>${esc(rankName(r))}${mx != null && mx > r ? ` · max ${N(mx)}` : ''}</small></span><span class="fl">${online(last) ? '<span class="onl">Online</span>' : last ? esc(ago(last)) : ''}</span>
 <span class="fbtn" data-msg="${esc(h)}" role="button" tabindex="0" title="Message ${esc(h)}">${ic('msg')}</span>`}</a>`;
  }
  function friendsView() {
    const a = app, all = a.people || [], q = (a.fq || '').toLowerCase(), by = a.fsort || 'rating';
    let rows = all.filter((p) => !q || (p[0] + ' ' + p[7] + ' ' + p[8] + ' ' + p[9] + ' ' + p[5]).toLowerCase().includes(q));
    rows = rows.slice().sort(by === 'name' ? (x, y) => x[0].localeCompare(y[0]) : by === 'online' ? (x, y) => y[4] - x[4] : byRating);
    const n = a.friends ? a.friends.length : 0, on = all.filter((p) => online(p[4])).length, top = all.slice().sort(byRating)[0];
    const seg = (k, t) => `<button class="gchip${by === k ? ' on' : ''}" data-fsort="${k}">${t}</button>`;
    const list = a.peopleError ? `<div class="empty2">Codeforces' API did not answer (${esc(a.peopleError)}). Reload in a minute.</div>`
      : !n ? '<div class="empty2">You are not following anyone yet. Add someone as a friend from their profile on Codeforces and they appear here.</div>'
      : !a.people ? '<div class="empty2">Loading your friends…</div>' : !rows.length ? '<div class="empty2">Nobody matches. Try another name.</div>'
      : `<div class="fhd"><span></span><span>User</span><span style="text-align:right">Rating</span><span style="text-align:right">Last visit</span><span></span></div>${rows.map((p) => personRow(p)).join('')}`;
    $('main').innerHTML = `<div class="gwrap2 fwrap"><section class="ghero"><h1>Friends</h1><p>The people you follow on Codeforces, with their rating and when they were last online.</p></section>
 <div class="fstats"><div class="fst"><span class="lb">Following</span><b>${N(n)}</b></div><div class="fst"><span class="lb">Online now</span><b class="${on ? 'g' : ''}">${a.people ? N(on) : '…'}</b></div><div class="fst"><span class="lb">Highest rated</span>${top && top[1] != null ? `<a href="/profile/${encodeURIComponent(top[0])}" style="color:${RKC[rankOf(top[1])]}">${esc(top[0])}</a><small>${N(top[1])}</small>` : '<b>—</b>'}</div></div>
 <div class="gtools"><label class="gsearch">${ic('search')}<input id="fq" type="search" placeholder="Search friends by handle, name, organisation" value="${esc(a.fq || '')}" autocomplete="off"></label><span class="gseg">${seg('rating', 'Rating')}${seg('online', 'Recently online')}${seg('name', 'Name')}</span></div>
 <section class="lcard flist" data-m="friends">${list}</section></div>`;
    const inp = $('fq'); if (inp) inp.addEventListener('input', () => { a.fq = inp.value; clearTimeout(a.qt); a.qt = setTimeout(() => { draw(); const x = $('fq'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 150); });
  }
  /* Following on your own profile: your /friends page, read once when the list is opened. Codeforces publishes no list of
     who follows someone, only the number, so Followers shows the number and says so */
  async function loadFollowing() {
    const me = app; if (me.following || me.followingBusy) return;
    me.followingBusy = true;
    try {
      const r = await fetch('/friends', { credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const hs = friendsIn(new DOMParser().parseFromString(await r.text(), 'text/html'), me.d.handle);
      const ppl = hs.length ? await globalThis.CFM_API.people(hs) : [];
      if (app === me) { me.following = ppl.sort(byRating); draw(); }
    } catch (e) { if (app === me) { me.followingError = e.message; draw(); } } finally { me.followingBusy = false; }
  }
  function followsModal(u, me) {
    const a = app, tab = a.follows;
    const T = (k, t) => `<button class="ptab${tab === k ? ' on' : ''}" data-ftab="${k}" role="tab">${t}</button>`;
    const body = tab === 'following'
      ? (a.followingError ? `<div class="empty2">Your friends list did not load (${esc(a.followingError)}).</div>` : !a.following ? '<div class="empty2">Loading…</div>'
        : !a.following.length ? '<div class="empty2">You are not following anyone yet.</div>' : `<div class="flist2">${a.following.map((p) => personRow(p, true)).join('')}</div><a class="vall fall" href="/friends">Open Friends${ic('right')}</a>`)
      : `<div class="fcount"><span class="fci">${ic('heart')}</span><b>${N(u.friendOfCount)}</b><span>${u.friendOfCount === 1 ? 'person follows' : 'people follow'} ${me ? 'you' : esc(u.handle)}</span></div><p class="fnote">Codeforces shows how many people follow a profile, never who they are, so there is no list to open.${me ? ' The people you follow are under Following.' : ''}</p>`;
    return `<div class="modal" data-act="follows-close"><div class="box fbox" role="dialog" aria-label="Followers"><div class="mh"><div class="ptabs" role="tablist">${T('follows', `Followers <small>${N(u.friendOfCount)}</small>`)}${me ? T('following', `Following${a.following ? ` <small>${N(a.following.length)}</small>` : ''}`) : ''}</div><button class="bgo" data-act="follows-close" aria-label="Close">${ic('x')}</button></div>${body}</div></div>`;
  }

  /* ================================ A user's contests (/contests/with/<handle>): user.rating ================================ */
  const CPER = 20;
  function cwithView() {
    const a = app, u = a.info, hist = a.hist || [], q = (a.cq || '').toLowerCase(), by = a.csort || 'new';
    if (a.notFound) { $('main').innerHTML = `<div class="nf"><b>No user "${esc(HANDLE)}"</b>Codeforces has no handle like that. <a href="/contests">Back to contests</a></div>`; return; }
    const rows = hist.map((x, i) => ({ n: i + 1, id: x[0], name: x[1], rank: x[2], now: x[4], at: x[5], d: x[4] - x[3] }));
    let shown = rows.filter((x) => !q || x.name.toLowerCase().includes(q));
    if (by !== 'old') shown = shown.slice().sort(by === 'rank' ? (x, y) => x.rank - y.rank : by === 'gain' ? (x, y) => y.d - x.d : (x, y) => y.at - x.at);
    const pages = Math.max(1, Math.ceil(shown.length / CPER)); if (a.page > pages) a.page = pages;
    const page = shown.slice((a.page - 1) * CPER, a.page * CPER);
    const r = u ? u.rating : rows.length ? rows[rows.length - 1].now : null, mx = u && u.maxRating != null ? u.maxRating : rows.reduce((m, x) => Math.max(m, x.now), -1);
    const best = rows.length ? rows.reduce((m, x) => (x.rank < m.rank ? x : m)) : null, gain = rows.length ? rows.reduce((m, x) => (x.d > m.d ? x : m)) : null;
    const sgn = (v) => (v > 0 ? '+' : '') + v;
    const stat = (k, v, sub) => `<div class="fst"><span class="lb">${k}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const seg = (k, t) => `<button class="gchip${by === k ? ' on' : ''}" data-csort="${k}">${t}</button>`;
    const pager = pages <= 1 ? '' : (() => { const cur = a.page, nums = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - cur) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…'); return `<div class="pager"><button data-pg="${cur - 1}" ${cur <= 1 ? 'disabled' : ''} aria-label="Previous page">${ic('left')}</button>${nums.map((x) => x === '…' ? '<button disabled>…</button>' : `<button data-pg="${x}" class="${x === cur ? 'on' : ''}">${x}</button>`).join('')}<button data-pg="${cur + 1}" ${cur >= pages ? 'disabled' : ''} aria-label="Next page">${ic('right')}</button></div>`; })();
    const list = a.histError ? `<div class="empty2">Codeforces' API did not answer (${esc(a.histError)}). Reload in a minute.</div>` : !a.hist ? '<div class="empty2">Loading the contests…</div>'
      : !rows.length ? `<div class="empty2">${esc(HANDLE)} has no rated contests yet.</div>` : !page.length ? '<div class="empty2">No contest matches.</div>'
      : `<div class="chd"><span>#</span><span>Contest</span><span>Date</span><span style="text-align:right">Rank</span><span style="text-align:right">Change</span><span style="text-align:right">Rating</span></div>${page.map((x) => `<a class="cwr" href="/contest/${x.id}"><span class="cn">${x.n}</span><span class="ct" title="${esc(x.name)}">${esc(shortName(x.name))}</span><span class="cd">${esc(fmtDate(x.at))}</span><span class="cr" data-href="/contest/${x.id}/standings" title="Standings">${N(x.rank)}</span><span class="cdl ${x.d >= 0 ? 'up' : 'dn'}">${sgn(x.d)}</span><span class="cnr" style="color:${RKC[rankOf(x.now)]}">${N(x.now)}</span></a>`).join('')}${pager}`;
    const hn = u ? u.handle : HANDLE, H = encodeURIComponent(hn), photo = u ? photoOf(u.photo) : '';
    $('main').innerHTML = `<div class="gwrap2 cwwrap"><section class="cwhero"><a class="fav big" href="/profile/${H}">${photo ? `<img src="${esc(photo)}" alt="">` : ''}<b>${esc(hn[0].toUpperCase())}</b></a><div><h1><a href="/profile/${H}" style="color:${RKC[rankOf(r)]}">${esc(hn)}</a><span>Contest history</span></h1><p>${esc(rankName(r))}${rows.length ? ` · ${N(rows.length)} rated contest${rows.length === 1 ? '' : 's'} since ${esc(fmtDate(rows[0].at))}` : ''}</p></div></section>
 <div class="fstats four">${stat('Contest rating', r == null ? '—' : `<span style="color:${RKC[rankOf(r)]}">${N(r)}</span>`, '')}${stat('Max rating', mx > 0 ? `<span style="color:${RKC[rankOf(mx)]}">${N(mx)}</span>` : '—', mx > 0 ? esc(rankName(mx)) : '')}${stat('Best rank', best ? '#' + N(best.rank) : '—', best ? esc(shortName(best.name)) : '')}${stat('Biggest gain', gain ? `<span class="${gain.d >= 0 ? 'up' : 'dn'}">${sgn(gain.d)}</span>` : '—', gain ? esc(shortName(gain.name)) : '')}</div>
 ${rows.length ? `<section class="card cwchart">${chart(hist, 852, 200)}</section>` : ''}
 <div class="gtools"><label class="gsearch">${ic('search')}<input id="cq" type="search" placeholder="Search contests" value="${esc(a.cq || '')}" autocomplete="off"></label><span class="gseg">${seg('new', 'Newest')}${seg('old', 'Oldest')}${seg('rank', 'Best rank')}${seg('gain', 'Biggest gain')}</span></div>
 <section class="lcard cwlist" data-m="cwith">${list}</section></div>`;
    const inp = $('cq'); if (inp) inp.addEventListener('input', () => { a.cq = inp.value; a.page = 1; clearTimeout(a.qt); a.qt = setTimeout(() => { draw(); const x = $('cq'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 150); });
  }


  /* ================================ Settings (/settings/general), LeetCode's Basic Info ================================ */
  /* No saved copy of the signed-in page exists, so nothing here names Codeforces' fields: the form with the most visible
     controls is read as rows (label from <label for>, else the row's first cell), shown LeetCode's way (label, value, Edit),
     and a save writes into Codeforces' own control and submits Codeforces' own form (its token and hidden fields go with it;
     the page reloads with Codeforces' answer, and any error it prints next to a field is shown under that row). */
  function readSettings() {
    const forms = [...document.querySelectorAll('#pageContent form')].map((f) => ({ f, n: f.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea').length })).sort((x, y) => y.n - x.n);
    const form = forms[0] && forms[0].n ? forms[0].f : null; if (!form) return null;
    const clean = (t) => String(t || '').replace(/\s+/g, ' ').replace(/[:*]\s*$/, '').trim();
    const labelOf = (el) => {
      const byFor = el.id && form.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (byFor && clean(byFor.textContent)) return clean(byFor.textContent);
      const wrap = el.closest('label'); if (wrap && clean(wrap.textContent)) return clean(wrap.textContent);
      const tr = el.closest('tr'); if (tr) { const td = tr.querySelector('td, th'); if (td && !td.contains(el) && clean(td.textContent)) return clean(td.textContent); }
      return clean(el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.name);
    };
    const errOf = (el) => { const tr = el.closest('tr') || el.parentElement; const e = tr && tr.querySelector('.error, span.error, .field-error'); return e ? clean(e.textContent) : ''; };
    const rows = [], radios = new Map();
    for (const el of form.querySelectorAll('input, select, textarea')) {
      const type = el.tagName === 'INPUT' ? (el.type || 'text').toLowerCase() : el.tagName.toLowerCase();
      if (/^(hidden|submit|button|image|reset)$/.test(type)) continue;
      if (type === 'radio') { if (!radios.has(el.name)) { const r = { kind: 'radio', name: el.name, label: '', els: [], err: errOf(el) }; radios.set(el.name, r); rows.push(r); } radios.get(el.name).els.push(el); continue; }
      rows.push({ kind: type, el, label: labelOf(el), err: errOf(el) });
    }
    for (const r of radios.values()) { const tr = r.els[0].closest('tr'); const td = tr && tr.querySelector('td, th'); r.label = clean(td && !td.contains(r.els[0]) ? td.textContent : r.name); }
    const submit = form.querySelector('input[type=submit], button[type=submit], button:not([type])');
    const tabs = [...document.querySelectorAll('.second-level-menu-list li a, .second-level-menu a')].map((a) => ({ href: a.getAttribute('href'), t: clean(a.textContent), on: !!a.closest('.current, .selectedLava') || a.getAttribute('href') === location.pathname }));
    const note = clean((document.querySelector('#pageContent .message, #pageContent .success, .alert-success') || {}).textContent);
    return { form, rows: rows.filter((r) => r.label), submit, tabs, note };
  }
  const svalue = (r) => {
    if (r.kind === 'radio') { const on = r.els.find((e) => e.checked); return on ? (on.closest('label') ? on.closest('label').textContent.trim() : (on.nextSibling && on.nextSibling.textContent || on.value).trim()) : ''; }
    if (r.kind === 'checkbox') return r.el.checked;
    if (r.kind === 'select') { const o = r.el.selectedOptions[0]; return o ? o.textContent.trim() : ''; }
    if (r.kind === 'password' || r.kind === 'file') return '';
    return r.el.value;
  };
  function settingsView() {
    const a = app, S = a.set;
    if (!S) { $('main').innerHTML = `<div class="nf"><b>Settings</b>This page shows no settings form (are you signed in?). <a href="/enter">Sign in</a></div>`; return; }
    const d = a.d, H = encodeURIComponent(d.handle || '');
    const ICS = ['user', 'gear', 'lock', 'msg', 'globe', 'star'];
    const nav = (S.tabs.length ? S.tabs : [{ href: '/settings/general', t: 'General', on: true }]).map((t, i) => `<a class="snav${t.on || t.href === location.pathname ? ' on' : ''}" href="${esc(t.href)}">${ic(ICS[i] || 'gear')}<span>${esc(t.t)}</span></a>`).join('');
    const row = (r, i) => {
      const v = svalue(r), editing = a.edit === i;
      let ctrl = '';
      if (r.kind === 'checkbox') return `<div class="srow"><div class="sl2">${esc(r.label)}</div><div class="sv"></div><button class="tgl${v ? ' on' : ''}" data-stoggle="${i}" role="switch" aria-checked="${v}" aria-label="${esc(r.label)}"><i></i></button>${r.err ? `<div class="serr">${esc(r.err)}</div>` : ''}</div>`;
      if (editing) {
        if (r.kind === 'select') ctrl = `<select class="sin" id="sedit">${[...r.el.options].map((o) => `<option value="${esc(o.value)}"${o.selected ? ' selected' : ''}>${esc(o.textContent.trim())}</option>`).join('')}</select>`;
        else if (r.kind === 'radio') ctrl = `<span class="srad">${r.els.map((e, k) => `<label><input type="radio" name="sedit" value="${k}"${e.checked ? ' checked' : ''}>${esc((e.closest('label') ? e.closest('label').textContent : (e.nextSibling && e.nextSibling.textContent) || e.value).trim())}</label>`).join('')}</span>`;
        else if (r.kind === 'textarea') ctrl = `<textarea class="sin" id="sedit" rows="4">${esc(r.el.value)}</textarea>`;
        else if (r.kind === 'file') ctrl = `<button class="sbtn ghost" data-sfile="${i}">Choose file</button><span class="sfn">${esc(r.el.files && r.el.files[0] ? r.el.files[0].name : 'No file chosen')}</span>`;
        else ctrl = `<input class="sin" id="sedit" type="${/^(email|number|date|url|tel)$/.test(r.kind) ? r.kind : 'text'}" value="${esc(r.el.value)}"${r.el.maxLength > 0 ? ` maxlength="${r.el.maxLength}"` : ''} autocomplete="off">`;
        return `<div class="srow ed"><div class="sl2">${esc(r.label)}</div><div class="sv">${ctrl}<div class="sact"><button class="sbtn ghost" data-scancel>Cancel</button><button class="sbtn" data-ssave="${i}">Save</button></div></div>${r.err ? `<div class="serr">${esc(r.err)}</div>` : ''}</div>`;
      }
      return `<div class="srow"><div class="sl2">${esc(r.label)}</div><div class="sv${v ? '' : ' empty'}">${v ? esc(v) : r.kind === 'password' ? '••••••••' : 'Not set'}</div><button class="sedit" data-sedit="${i}">${ic('edit')}Edit</button>${r.err ? `<div class="serr">${esc(r.err)}</div>` : ''}</div>`;
    };
    /* sections, as LeetCode groups its settings: the password fields are ONE "Password" row whose edit shows them together
       (three separate rows read as three passwords, user Oct 30 2026), switches under Notifications */
    const idx = S.rows.map((r, i) => i), pw = idx.filter((i) => S.rows[i].kind === 'password'), sw = idx.filter((i) => S.rows[i].kind === 'checkbox'), basic = idx.filter((i) => !pw.includes(i) && !sw.includes(i));
    const pwRow = () => {
      if (!pw.length) return '';
      const err = pw.map((i) => S.rows[i].err).filter(Boolean).join(' ');
      if (a.edit !== 'pw') return `<div class="srow"><div class="sl2">Password</div><div class="sv">••••••••</div><button class="sedit" data-sedit="pw">${ic('lock')}Change</button>${err ? `<div class="serr">${esc(err)}</div>` : ''}</div>`;
      const field = (i) => { const r = S.rows[i], cur = /old|current|текущ|стар/i.test(r.label); return `<label class="spw"><span>${esc(r.label)}</span><span class="spwin"><input class="sin" type="password" data-pw="${i}" autocomplete="${cur ? 'current-password' : 'new-password'}"${r.el.maxLength > 0 ? ` maxlength="${r.el.maxLength}"` : ''}><button type="button" class="eye" data-eye aria-label="Show password" title="Show password">${ic('eye')}</button></span></label>`; };
      return `<div class="srow ed"><div class="sl2">Password</div><div class="sv">${pw.map(field).join('')}<div class="sact"><button class="sbtn ghost" data-scancel>Cancel</button><button class="sbtn" data-ssave="pw">Save</button></div></div>${err ? `<div class="serr">${esc(err)}</div>` : ''}</div>`;
    };
    const sec = (t, body) => (body ? `<div class="ssec">${t}</div><div class="scard">${body}</div>` : '');
    $('main').innerHTML = `<div class="swrap"><aside class="sside"><a class="sme" href="/profile/${H}">${K().avatar(d.photo, d.handle || '?', 'lg')}<span><b>${esc(d.handle || '')}</b><small>View profile</small></span></a><nav>${nav}</nav></aside>
 <section class="smain"><h2>${esc((S.tabs.find((t) => t.on) || {}).t || 'Basic Info')}</h2>${S.note ? `<div class="snote">${ic('check')}${esc(S.note)}</div>` : ''}${a.saving ? '<div class="snote busy">Saving on Codeforces…</div>' : ''}
 <div data-m="settings">${sec('Basic info', basic.map((i) => row(S.rows[i], i)).join(''))}${sec('Password', pwRow())}${sec('Notifications', sw.map((i) => row(S.rows[i], i)).join(''))}</div><p class="shint">Each change is sent through Codeforces' own settings form.</p></section></div>`;
    const pf = app.sh.querySelector('[data-pw]'); if (pf) pf.focus();
    const ed = $('sedit'); if (ed && ed.focus) { ed.focus(); if (ed.select && ed.tagName === 'INPUT') ed.select(); }
  }
  function saveSetting(i) {
    const S = app.set;
    if (i === 'pw') {
      app.sh.querySelectorAll('[data-pw]').forEach((inp) => { const r = S.rows[+inp.dataset.pw]; r.el.value = inp.value; r.el.dispatchEvent(new Event('input', { bubbles: true })); });
      app.saving = true; app.edit = null; draw();
      if (S.form.requestSubmit) S.form.requestSubmit(S.submit && S.form.contains(S.submit) ? S.submit : undefined); else S.form.submit();
      return;
    }
    const r = S.rows[i]; if (!r) return;
    if (r.kind === 'radio') { const k = app.sh.querySelector('input[name="sedit"]:checked'); if (k) r.els[+k.value].checked = true; }
    else if (r.kind === 'checkbox') r.el.checked = !r.el.checked;
    else if (r.kind !== 'file') { const e = $('sedit'); if (!e) return; r.el.value = e.value; }
    const el = r.el || r.els[0]; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    app.saving = true; app.edit = null; draw();
    if (S.form.requestSubmit) S.form.requestSubmit(S.submit && S.form.contains(S.submit) ? S.submit : undefined); else S.form.submit();
  }

  /* a redraw keeps where you were: the page's scroll and the profile's left column (it scrolls on its own); "Show more"
     re-rendered both to the top (user, Oct 28 2026) */
  const draw = () => {
    if (!app) return;
    const top = app.host.scrollTop, side = [...app.sh.querySelectorAll('.pfl')].map((e) => e.scrollTop);
    if (PAGE === 'contests') contestsView(); else if (PAGE === 'discuss') discussView(); else if (PAGE === 'gym') gymView(); else if (PAGE === 'friends') friendsView(); else if (PAGE === 'cwith') cwithView(); else if (PAGE === 'settings') settingsView(); else profileView();
    app.host.scrollTop = top; app.sh.querySelectorAll('.pfl').forEach((e, i) => { if (side[i] != null) e.scrollTop = side[i]; });
  };

  /* ---- events ------------------------------------------------------------------------------------------------------ */
  function onClick(e) {
    const t = e.target, el = t.closest('[data-act],[data-tab],[data-ptab],[data-pg],[data-year],[data-scope],[data-open],[data-virtual],[data-sort],[data-gtype],[data-gdiff],[data-gvirtual],[data-msg],[data-fsort],[data-csort],[data-ftab],[data-href],[data-sedit],[data-scancel],[data-ssave],[data-stoggle],[data-sfile],[data-eye]');
    app.sh.querySelectorAll('.ypop,.pmenu').forEach((p) => { if (!p.hidden && !(el && /^(years|pmenu)$/.test(el.dataset.act || ''))) p.hidden = true; });
    if (!el) return;
    const act = el.dataset.act;
    if (el.dataset.sedit) { app.edit = el.dataset.sedit === 'pw' ? 'pw' : +el.dataset.sedit; return draw(); }
    if (el.dataset.eye != null) { e.preventDefault(); const inp = el.previousElementSibling, show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; el.innerHTML = ic(show ? 'eyeoff' : 'eye'); el.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); el.title = el.getAttribute('aria-label'); inp.focus(); return; }
    if (el.dataset.scancel != null) { app.edit = null; return draw(); }
    if (el.dataset.ssave) return saveSetting(el.dataset.ssave === 'pw' ? 'pw' : +el.dataset.ssave);
    if (el.dataset.stoggle) return saveSetting(+el.dataset.stoggle);
    if (el.dataset.sfile) { const r = app.set.rows[+el.dataset.sfile]; r.el.addEventListener('change', () => draw(), { once: true }); r.el.click(); return; }
    if (el.dataset.msg) { e.preventDefault(); location.href = `/usertalk?other=${encodeURIComponent(el.dataset.msg)}`; return; }
    if (el.dataset.href) { e.preventDefault(); location.href = el.dataset.href; return; }
    if (el.dataset.fsort) { app.fsort = el.dataset.fsort; return draw(); }
    if (el.dataset.csort) { app.csort = el.dataset.csort; app.page = 1; return draw(); }
    if (el.dataset.ftab) { app.follows = el.dataset.ftab; if (app.follows === 'following') loadFollowing(); return draw(); }
    if (act === 'follows') { app.follows = 'follows'; return draw(); }
    if (act === 'follows-close') { if (t.closest('.box') && !el.classList.contains('bgo')) return; app.follows = ''; return draw(); }
    if (el.dataset.gvirtual) { e.preventDefault(); location.href = `/gymRegistration/${el.dataset.gvirtual}/virtual/true`; return; }
    if (el.dataset.sort != null && PAGE === 'discuss') { app.sort = app.sort === el.dataset.sort ? '' : el.dataset.sort; return draw(); }
    if (el.dataset.gtype != null) { app.gf.type = el.dataset.gtype; app.page = 1; return draw(); }
    if (el.dataset.gdiff != null) { app.gf.diff = +el.dataset.gdiff; app.page = 1; return draw(); }
    if (el.dataset.virtual) { e.preventDefault(); location.href = `/contestRegistration/${el.dataset.virtual}/virtual/true`; return; }
    if (el.dataset.scope) { app.scope = el.dataset.scope; return draw(); }
    if (el.dataset.open) { app.open = Object.assign({}, app.open, { [el.dataset.open]: !(app.open && app.open[el.dataset.open]) }); return draw(); }
    if (act === 'rankmore') { app.rankMore = !app.rankMore; return draw(); }
    if (act === 'moreup') { app.moreUp = !app.moreUp; return draw(); }
    if (act === 'pmenu') { const m = app.sh.querySelector('.pmenu'); if (m) m.hidden = !m.hidden; return; }
    if (act === 'random') return randomContest();
    if (act === 'years') { const yp = app.sh.querySelector('.ypop'); if (yp) yp.hidden = !yp.hidden; return; }
    if (act === 'badges') { app.badgesOpen = true; return draw(); }
    if (act === 'badges-close') { if (el.classList.contains('modal') && t.closest('.box') && t !== el) return; app.badgesOpen = false; return draw(); }
    if (el.dataset.year) { app.year = el.dataset.year; return draw(); }
    if (el.dataset.pg) { if (el.disabled) return; app.page = +el.dataset.pg; draw(); const l = app.sh.querySelector('.lcard'); if (l && l.getBoundingClientRect().top < 0) l.scrollIntoView({ block: 'start' }); return; }
    if (el.dataset.tab) { app.tab = el.dataset.tab; app.page = 1; return draw(); }
    if (el.dataset.ptab) { app.ptab = el.dataset.ptab; return draw(); }
  }
  function onKey(e) {
    if (PAGE === 'settings' && app.edit === 'pw' && e.target.dataset && e.target.dataset.pw != null) {
      if (e.key === 'Escape') { app.edit = null; draw(); return e.stopPropagation(); }
      if (e.key === 'Enter') { e.preventDefault(); saveSetting('pw'); return e.stopPropagation(); }
    }
    if (PAGE === 'settings' && app.edit != null && e.target.id === 'sedit') {
      if (e.key === 'Escape') { app.edit = null; draw(); return e.stopPropagation(); }
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); saveSetting(app.edit); return e.stopPropagation(); }
    }
    if (e.key === 'Escape' && (app.badgesOpen || app.follows)) { app.badgesOpen = false; app.follows = ''; draw(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="tab"]')) { e.preventDefault(); e.target.click(); }
    e.stopPropagation();
  }

  /* ---- mount / unmount --------------------------------------------------------------------------------------------- */
  function mount() {
    if (app || !wanted) return;
    const kit = K(); if (!kit) return fail('no kit');
    const host = document.createElement('div'); host.id = 'cfm-app'; host.setAttribute('data-cfm', PAGE);
    const sh = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = (globalThis.CFM_SITE_CSS || '') + (globalThis.CFM_KIT_CSS || '') + SCSS; sh.append(st);
    const d = kit.me();
    const wrap = document.createElement('div'); wrap.innerHTML = shell(d, PAGE === 'profile' || PAGE === 'friends' || PAGE === 'settings' ? '' : PAGE === 'cwith' ? 'contests' : PAGE); sh.append(...wrap.childNodes);
    root.append(host);
    /* the profile picture Codeforces shows on this page (same origin, always loads) beats the API's */
    const owner = PAGE === 'profile' && document.querySelector('.main-info a.rated-user, .main-info h1 a, .userbox h1 a');
    const tp = owner && owner.textContent.trim().toLowerCase() === HANDLE.toLowerCase() && document.querySelector('.title-photo img');
    app = { host, sh, d, tab: 'past', ptab: 'ac', page: 1, year: 'current', scope: 'global', open: {}, sort: '', gf: { q: '', diff: 0, type: '', sort: 'new' }, title: document.title, timers: [], photo: tp ? kit.photoUrl(tp.getAttribute('src')) : '' };
    document.title = { contests: 'Contests - Codeforces', discuss: 'Discuss - Codeforces', gym: 'Gym - Codeforces', friends: 'Friends - Codeforces', settings: 'Settings - Codeforces', cwith: `${HANDLE}'s contests - Codeforces` }[PAGE] || `${HANDLE} - Codeforces`;
    if (PAGE === 'friends') app.friends = friendsIn(document, d.handle);
    if (PAGE === 'settings') app.set = readSettings();
    sh.addEventListener('click', onClick); sh.addEventListener('keydown', onKey);
    app.onEsc = (e) => { if (e.key === 'Escape' && app && (app.badgesOpen || app.follows)) { app.badgesOpen = false; app.follows = ''; draw(); } };   // a modal closes on Escape wherever focus is
    document.addEventListener('keydown', app.onEsc);
    sh.addEventListener('mousemove', chartHover); sh.addEventListener('mouseout', chartLeave); sh.addEventListener('mousemove', medalTilt);
    app.unwire = kit.wire(sh, d); kit.photos(sh); kit.wireGauge(sh);
    const rescale = () => { host.style.zoom = Math.round(Math.min(1.25, Math.max(1, innerWidth / 1536)) * 100) / 100; };
    rescale(); app.onResize = rescale; addEventListener('resize', rescale);
    draw();
    const A = globalThis.CFM_API, me = app; if (!A) return;
    const redraw = () => { if (app === me) draw(); };
    if (PAGE === 'discuss') { A.upcoming().then((u) => { me.upcoming = u; redraw(); }).catch(() => {}); return; }
    if (PAGE === 'settings') return;
    if (PAGE === 'friends') { if (app.friends.length) A.people(app.friends).then((p) => { me.people = p; redraw(); }).catch((e) => { me.peopleError = e.message; redraw(); }); else { me.people = []; draw(); } return; }
    if (PAGE === 'cwith') {
      A.userInfo(HANDLE).then((u) => { me.info = u; redraw(); }).catch((e) => { if (/not found/i.test(e.message)) me.notFound = true; redraw(); });
      A.ratingOf(HANDLE).then((h) => { me.hist = h; redraw(); }).catch((e) => { me.histError = e.message; redraw(); });
      return;
    }
    if (PAGE === 'gym') { A.gyms().then((g) => { me.gyms = g; redraw(); }).catch((e) => { me.gymsError = e.message; redraw(); }); return; }
    if (PAGE === 'contests') {
      A.contestList().then((l) => { me.list = l; redraw(); }).catch((e) => { me.listError = e.message; redraw(); });
      A.rated().then((x) => { me.rated = x; redraw(); }).catch((e) => { me.ratedError = e.message; redraw(); });
      A.problems().then((p) => { const m = new Map(); for (const x of p) m.set(x[0], (m.get(x[0]) || 0) + 1); me.probCount = m; redraw(); }).catch(() => {});
      if (d.handle) {
        A.statusRows(d.handle).then((s) => { const seen = new Set(), m = new Map(); for (const x of s.rows) if (x[4] === 'OK' && !seen.has(x[2] + x[3])) { seen.add(x[2] + x[3]); m.set(x[2], (m.get(x[2]) || 0) + 1); } me.solvedBy = m; redraw(); }).catch(() => {});
        A.ratingOf(d.handle).then((h) => { me.hist = h; redraw(); }).catch(() => { me.hist = []; redraw(); });
        A.userInfo(d.handle).then((u) => { me.info = u; redraw(); }).catch(() => {});
      }
      me.timers.push(setInterval(tickCountdowns, 1000));
    } else {
      A.userInfo(HANDLE).then((u) => { me.info = u; redraw(); }).catch((e) => { if (/not found/i.test(e.message)) me.notFound = true; else me.infoError = e.message; redraw(); });
      A.ratingOf(HANDLE).then((h) => { me.hist = h; redraw(); }).catch(() => { me.hist = []; redraw(); });
      A.rated().then((x) => { me.rated = x; redraw(); }).catch((e) => { me.ratedError = e.message; redraw(); });
      A.problems().then((p) => { me.prob = p; redraw(); }).catch(() => { me.prob = []; redraw(); });
      A.statusOf(HANDLE, d.handle).then((s) => { me.status = s; if (s.names) me.names = new Map(Object.entries(s.names)); redraw(); }).catch(() => { me.status = { rows: [] }; redraw(); });
    }
  }
  function unmount() {
    if (!app) return;
    removeEventListener('resize', app.onResize); document.removeEventListener('keydown', app.onEsc); app.timers.forEach(clearInterval); if (app.unwire) app.unwire();
    document.title = app.title; app.host.remove(); app = null;
  }
  function fail(why) {
    try { console.warn('[cfm] Modern', PAGE, 'not mounted:', why); } catch (e) { /* none */ }
    root.removeAttribute('data-cf-ui'); document.dispatchEvent(new CustomEvent('cfm:fail', { detail: why }));
  }
  function apply(v) {
    wanted = v === 'modern';
    if (!wanted) return unmount();
    const go = () => { try { mount(); } catch (e) { try { console.error('[cfm] site', e); } catch (x) { /* none */ } fail('error'); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
  }

  /* ---- the pages' own sheet (after the M1 tokens and the kit) ---- */
  const SCSS = `
/* every number below is LeetCode's own, measured on leetcode.com/u/<name>/ and /contest/ (dark, 1440 px, Oct 28 2026) */
:host{--ui:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";--l1:#fff;--l2:rgba(239,241,246,.75);--l3:rgba(239,242,246,.6);--l4:rgba(235,235,245,.3);--f3:rgba(255,255,255,.1);font-family:var(--ui)}
.site-main{min-height:calc(100vh - 50px);background:#1a1a1a;color:#fff;font-size:14px;line-height:21px}
.card{background:#282828;border-radius:8px}
.lb{font-size:12px;line-height:16px;color:var(--l3)}
.up,.blue{color:#0a84ff}.dn,.red{color:#f63737}
.empty2{padding:40px 8px;color:#a8a8a8;text-align:center}
.nochart{display:flex;align-items:center;justify-content:center;height:100px;color:var(--l4);font-size:12px}
.av{position:relative;display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;overflow:hidden;background:#404040;flex:none;color:#fff}
.av b{font-size:12px;font-weight:600}.av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.av.sm{width:28px;height:28px}.av.big{width:76px;height:76px}.av.big b{font-size:28px}

/* ---------------- Contests ---------------- */
.site-main.contests{background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.035) 0,rgba(255,255,255,.024) 45%,rgba(255,255,255,0) 80%),repeating-conic-gradient(from 45deg,rgba(255,255,255,.028) 0 25%,transparent 0 50%) 0 0/64px 64px,#1a1a1a}
.site-main.contests::after{content:"";position:fixed;inset:50px 0 0;pointer-events:none;background:radial-gradient(circle,rgba(0,0,0,0) 0,rgba(0,0,0,.45) 60%,rgba(0,0,0,.75) 100%)}
.cwrap{position:relative;z-index:1;max-width:770px;margin:0 auto;padding:20px 0 96px}
.hero{display:flex;flex-direction:column;align-items:center;margin-top:38px}
.hero .trophy{width:132px;height:122px}
.hero h1{margin:26px 0 0;font:400 26px/39px var(--ui);color:#f5f5f5;letter-spacing:.01em}
.hero p{margin:6px 0 0;font-size:14px;line-height:20px;font-weight:300;color:#a8a8a8}
.ccards{display:flex;justify-content:center;align-items:center;gap:16px;margin:64px -100px 0}
.ccard{position:relative;width:400px;height:250px;border-radius:32px;overflow:hidden;flex:none;box-shadow:0 20px 40px -18px rgba(0,0,0,.8);transition:transform .25s cubic-bezier(.2,.8,.2,1)}
.ccard.sm{width:350px;height:230px}
.ccard:hover{transform:translateY(-3px)}
.ccard .art{position:absolute;inset:0;width:100%;height:100%}
.ccard.skel{background:linear-gradient(90deg,#252525,#2e2e2e,#252525);background-size:200% 100%;animation:sk 1.2s linear infinite}
@keyframes sk{to{background-position:-200% 0}}
.cdp{position:absolute;right:12px;top:12px;display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:9999px;background:rgba(0,0,0,.3);color:#f5f5f5;font-size:11px;line-height:16.5px;font-variant-numeric:tabular-nums}
.cdp .i{width:13px;height:13px}
.ldot{width:7px;height:7px;border-radius:9999px;background:#ff4d4d;animation:pulse 1.6s infinite}
@keyframes pulse{50%{opacity:.35}}
.band{position:absolute;left:0;right:0;bottom:0;height:72px;display:flex;align-items:center;gap:10px;padding:0 12px 0 24px;background:rgba(0,0,0,.3)}
.band .tx{flex:1;min-width:0}
.c-t{margin:0;font-size:16px;line-height:24px;font-weight:600;color:#f5f5f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-t a:hover{text-decoration:underline}
.c-s{margin:0;font-size:12px;line-height:16px;color:#c6c6c6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbtn{height:40px;min-width:40px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);color:#fafafa;font-size:13px;font-weight:500;flex:none;transition:background .15s}
.cbtn:hover{background:rgba(255,255,255,.16)}
.cbtn .i{width:18px;height:18px}
.ccard .reg{position:absolute;left:12px;top:12px;z-index:1;display:inline-flex;align-items:center;gap:5px;padding:6px 16px;border-radius:9999px;background:rgba(255,255,255,.92);color:#1a1a1a;font-size:11px;line-height:16.5px;font-weight:600;transition:background .15s}
.ccard .reg:hover{background:#fff}.ccard .reg .i{width:11px;height:11px;fill:currentColor}
.moreup{display:flex;align-items:center;gap:6px;margin:28px auto 0;font-size:12px;line-height:16px;font-weight:500;color:#a8a8a8}
.moreup:hover{color:#f5f5f5}.moreup .i{width:14px;height:14px}
.uplist{margin:12px auto 0;max-width:540px;border-radius:16px;background:rgba(38,38,38,.9);border:1px solid rgba(255,255,255,.1);padding:6px}
.uplist a{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px}
.uplist a:hover{background:rgba(255,255,255,.05)}
.uplist .un{flex:1;min-width:0;font-size:14px;color:rgba(255,255,255,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uplist .ud{font-size:12px;color:rgba(255,255,255,.6)}
.uplist .uc{font-size:11px;font-weight:600;padding:4px 10px;border-radius:9999px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);font-variant-numeric:tabular-nums}
.cgrid{display:grid;grid-template-columns:320px 540px;gap:24px;justify-content:center;margin:96px -120px 0;align-items:start}
.rank{display:flex;flex-direction:column;align-items:center}
.scope{display:inline-flex;align-self:flex-end;gap:2px;padding:5px;border-radius:6px 8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);transform:skewX(-14deg);margin:22px 0 40px}
.scope button{height:24px;padding:0 12px;border-radius:4px 6px;font-size:11px;line-height:16.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.7)}
.scope button span{display:inline-block;transform:skewX(14deg)}
.scope button.on{color:#fff;background:linear-gradient(120deg,#d35400,#f39c12)}
.podium{display:grid;grid-template-columns:repeat(3,96px);gap:6px;align-items:end;justify-content:center;width:320px}
.pd{display:flex;flex-direction:column;align-items:center;gap:0;text-align:center}
.pd .crown{width:22px;height:22px;border-radius:9999px;display:flex;align-items:center;justify-content:center;margin-bottom:-8px;z-index:1;box-shadow:0 2px 6px rgba(0,0,0,.4)}
.pd .crown .i{width:13px;height:13px;color:#fff}
.crown.k1{background:linear-gradient(135deg,#ffd76a,#e09a1a)}.crown.k2{background:linear-gradient(135deg,#eef2f7,#9aa4b2)}.crown.k3{background:linear-gradient(135deg,#f3b58c,#b8662f)}
.pd .av.big{border:3px solid rgba(255,255,255,.15);box-shadow:0 10px 24px rgba(0,0,0,.5)}
.pd.p1 .av.big{width:84px;height:84px;border-color:#f5b83d}
.pd.p2 .av.big{border-color:#c8d0db}.pd.p3 .av.big{border-color:#d9895a}
.plinth{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;width:96px;padding:10px 4px 0;margin-top:-6px;border-radius:12px 12px 0 0;background:linear-gradient(180deg,#2e2e2e,#1c1c1c 70%,rgba(28,28,28,0))}
.pd.p1 .plinth{height:96px}.pd.p2 .plinth{height:76px}.pd.p3 .plinth{height:64px}
.pn{font-size:12px;line-height:16px;max-width:88px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr{font-size:12px;line-height:16px;color:#a1a1aa;margin-top:2px}
.pd:hover .pn{text-decoration:underline}
.rlist2{display:flex;flex-direction:column;gap:6px;width:320px;margin-top:4px}
.ritem2{display:flex;align-items:center;gap:12px;height:64px;padding:8px 16px;border-radius:16px;background:#171717;border:1px solid rgba(255,255,255,.1);transition:background .15s}
.ritem2:hover{background:#1f1f1f}
.rn{width:20px;height:20px;border-radius:999px;background:#404040;display:flex;align-items:center;justify-content:center;font-size:12px;flex:none}
.rh{flex:1;min-width:0;font-size:14px;line-height:20px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs{display:flex;flex-direction:column;align-items:flex-end;font-size:12px;line-height:16px;color:#fff;font-variant-numeric:tabular-nums}
.rs i{font-style:normal;color:#a1a1aa}
.smore2{margin-top:14px;font-size:12px;line-height:16px;font-weight:500;color:#a8a8a8}.smore2:hover{color:#f5f5f5}
.rkload{color:#a8a8a8;font-size:13px;padding:40px 0}
.lcard{border-radius:28px;background:rgba(38,38,38,.9);border:1px solid rgba(255,255,255,.1);padding:16px 16px 20px}
.lhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.sgm{display:inline-flex;padding:4px;border-radius:9999px;background:rgba(255,255,255,.08)}
.sgm button{height:36px;padding:8px 12px;border-radius:9999px;font-size:14px;line-height:20px;font-weight:500;color:rgba(255,255,255,.6);transition:color .15s,background .15s}
.sgm button.on{background:rgba(255,255,255,.08);color:#f1f5f9}.sgm button:not(.on):hover{color:#f1f5f9}
.rnd{width:40px;height:40px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;color:#fafafa;background:linear-gradient(#ce41cd,#a21caf);box-shadow:0 0 24px 4px rgba(206,65,205,.35);transition:transform .2s}
.rnd:hover{transform:rotate(-10deg)}.rnd .i{width:16px;height:16px}
.crow{display:flex;align-items:center;gap:16px;padding:8px 0;border-radius:12px}
.crow .th{width:110px;height:72px;border-radius:12px;overflow:hidden;flex:none;transition:transform .2s}
.crow:hover .th{transform:scale(1.03)}
.crow .th .art{width:100%;height:100%;display:block}
.cm{flex:1;min-width:0;display:flex;flex-direction:column}
.cm .n{font-size:16px;line-height:24px;font-weight:500;color:rgba(255,255,255,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.crow:hover .cm .n{color:#fff}
.cm .d{font-size:12px;line-height:16px;color:rgba(255,255,255,.6);margin-top:4px}
.sc{padding:4px 12px;border-radius:9999px;background:rgba(255,255,255,.1);font-size:11px;line-height:11px;font-weight:600;color:rgba(255,255,255,.7);flex:none;white-space:nowrap;font-variant-numeric:tabular-nums}
.sc.some{color:#2cbb5d;background:rgba(44,187,93,.12)}.sc.ghost{visibility:hidden}
.dl{width:54px;text-align:right;font-size:13px;font-weight:600;flex:none}
.dl.up{color:#2cbb5d}
.vbtn{height:34px;padding:8px 12px;border-radius:9999px;border:1px solid rgba(212,51,235,.3);background:linear-gradient(to right bottom,rgba(212,51,235,.1),rgba(212,51,235,.04));color:#e879f9;font-size:12px;line-height:16px;font-weight:600;flex:none;cursor:pointer;transition:background .15s,border-color .15s}
.vbtn:hover{border-color:rgba(212,51,235,.6);background:rgba(212,51,235,.16)}
.signin{display:flex;flex-direction:column;align-items:center;gap:16px;padding:60px 0}
.signin p{margin:0;color:#a8a8a8}.signin a{height:32px;padding:6px 16px;border-radius:9999px;background:#f5f5f5;color:#000;font-weight:500}
.pager{display:flex;justify-content:center;gap:6px;margin-top:24px}
.pager button{min-width:24px;height:24px;padding:3px 8px;border-radius:5px;background:rgba(255,255,255,.1);color:var(--l2);font-size:12px;line-height:16px;display:inline-flex;align-items:center;justify-content:center}
.pager button:hover:not(:disabled){background:rgba(255,255,255,.16)}
.pager button.on{background:#2563eb;color:#fff}
.pager button:disabled{opacity:.5;cursor:default}.pager .i{width:14px;height:14px}

/* ---------------- Profile ---------------- */
.pf{display:grid;grid-template-columns:268px 836px;gap:32px;justify-content:center;padding:24px 0 72px;align-items:start}
.pfl{position:sticky;top:74px;max-height:calc(100vh - 90px);overflow:auto;scrollbar-width:none;padding-bottom:16px}
.pfl::-webkit-scrollbar{display:none}
.who{display:flex;gap:16px}
.av80{position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;flex:none;background:#3e3e3e;display:flex;align-items:center;justify-content:center}
.av80 b{font-size:32px;font-weight:600;color:#fff}.av80 img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
.wn{min-width:0;display:flex;flex-direction:column}
.hn{font-size:16px;line-height:24px;font-weight:600;overflow-wrap:anywhere}
.hs2{font-size:12px;line-height:16px;color:var(--l3)}
.hr{margin-top:auto;font-size:16px;line-height:24px}.hr span{color:var(--l2)}.hr b{font-weight:500}
.bio{margin-top:16px;font-size:14px;line-height:21px;color:var(--l2)}
.fol{display:flex;align-items:center;gap:12px;margin-top:16px;font-size:14px;line-height:20px;color:#a8a8a8}
.fol b{color:#f5f5f5;font-weight:400;margin-right:4px}.fol i{width:1px;height:14px;background:rgba(255,255,255,.2)}
.pacts{display:flex;gap:8px;margin-top:16px}
.pbtn{flex:1;height:36px;border-radius:5px;display:flex;align-items:center;justify-content:center;gap:6px;background:#2cbb5d;color:#fff;font-size:14px;font-weight:500;transition:background .15s}
.pbtn:hover{background:#28a754}.pbtn .i{width:15px;height:15px}
.pmore-w{position:relative}
.pmore{width:36px;height:36px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);color:#f5f5f5}
.pmore:hover{background:rgba(255,255,255,.12)}.pmore .i{width:18px;height:18px}
.pmenu{position:absolute;right:0;top:42px;z-index:5;min-width:150px;padding:6px;border-radius:8px;background:#303030;box-shadow:0 10px 24px rgba(0,0,0,.45);display:flex;flex-direction:column}
.pmenu a{height:32px;padding:0 10px;border-radius:6px;display:flex;align-items:center;font-size:14px;color:var(--l2)}.pmenu a:hover{background:rgba(255,255,255,.08);color:#fff}
.facts{display:flex;flex-direction:column;gap:16px;margin-top:20px}
.fact{display:flex;align-items:center;gap:9px;font-size:14px;line-height:21px;color:var(--l2);min-width:0}
.fact>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fact .i{width:16px;height:16px;color:var(--l3);flex:none}
.lchips{display:flex;gap:6px;flex-wrap:wrap;white-space:normal!important}
.lchips span{padding:2px 8px;border-radius:16px;background:var(--f3);font-size:12px;line-height:16px;color:var(--l2)}
.divd{height:1px;background:rgba(255,255,255,.1);margin:16px 0}
.sec{font-size:16px;line-height:24px;font-weight:500;margin-bottom:16px}
.cs{display:flex;gap:0;margin-bottom:12px}
.csi{width:18px;flex:none;padding-top:2px}.csi .i{width:18px;height:18px}
.csl{display:flex;gap:8px;margin-left:8px;font-size:14px;line-height:21px}.csl span{color:var(--l2)}.csl b{font-weight:400;color:#fff}
.css{margin:2px 0 0 10px;font-size:12px;line-height:16px;color:var(--l3)}
.lrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:12px;line-height:16px;color:var(--l3)}
.lrow b{color:var(--l2);font-weight:500}
.lpill{height:24px;padding:0 8px;border-radius:9999px;background:var(--f3);color:var(--l2);display:inline-flex;align-items:center;font-size:12px;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smore{display:block;margin:4px auto 8px;font-size:12px;line-height:16px;color:var(--l3)}.smore:hover{color:#fff}
.skg{margin-bottom:12px}
.skh{display:flex;align-items:center;gap:6px;font-size:12px;line-height:16px;margin-bottom:10px}.skh i{width:4px;height:4px;border-radius:9999px}
.skt{display:flex;flex-wrap:wrap;gap:12px 16px}
.stw{display:inline-flex;align-items:center;gap:4px;font-size:12px;line-height:16px;color:var(--l3)}
.stag{padding:4px 8px;border-radius:9999px;background:var(--f3);color:var(--l2)}.stag:hover{color:#fff}
.pfr{display:flex;flex-direction:column;gap:16px;min-width:0}
.c1{display:flex;padding:16px;min-height:200px}
.c1l{flex:1;min-width:0;padding-right:16px;border-right:1px solid rgba(247,250,255,.12)}
.c1h{display:flex;align-items:flex-start;gap:16px}
.c1h>div:first-child{margin-right:0}
.lb1{font-size:12px;line-height:16px;font-weight:500;color:var(--l3)}
.v24{font-size:24px;line-height:32px;color:#fff;font-variant-numeric:tabular-nums}
.lvl{display:flex;gap:6px;align-items:flex-start}.lvl .medal{margin-top:-2px}
.lv{font-size:14px;line-height:22px}
.v12{font-size:12px;line-height:22px;font-weight:500;font-variant-numeric:tabular-nums}.v12 span{color:var(--l4);margin-left:1px}
.c1r{width:385px;padding-left:16px;display:flex;flex-direction:column}
.dist{display:flex;align-items:flex-end;gap:3px;height:115px;margin-top:auto}
.dist i{flex:1;border-radius:2px 2px 0 0;background:rgba(255,255,255,.1)}
.dist i.me{background:#ffa116}
.rchart{position:relative;margin-top:8px}
.rchart svg{display:block;overflow:visible}
.rchart .pt{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:9999px;background:#fff;pointer-events:none}
.rchart .lbl{position:absolute;transform:translateX(-50%);padding:2px 5px;border-radius:4px;border:1px solid rgba(255,255,255,.3);background:#282828;font-size:11px;line-height:14px;color:var(--l2);pointer-events:none}
.rchart .yrs{display:flex;justify-content:space-between;font-size:13px;line-height:22px;color:var(--l2);margin-top:4px}
.rchart .tip{position:absolute;width:220px;padding:8px 12px;border-radius:8px;background:#3e3e3e;box-shadow:0 8px 20px rgba(0,0,0,.45);pointer-events:none;z-index:2;font-size:12px;line-height:18px}
.tip .t1{color:var(--l3)}.tip .t2 b{font-size:14px}.tip .t3{color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pair{display:grid;grid-template-columns:410px 410px;gap:16px}
.pring{position:relative;height:180px;padding:16px;display:flex;align-items:center}
.pring .gym{position:absolute;left:16px;bottom:12px;font-size:12px;line-height:16px;color:var(--l3)}
.pring .gwrap{width:100%}
.loadc{color:var(--l4);margin:auto}
.pbad{position:relative;min-height:180px;padding:16px 20px 20px}
.bn{font-size:24px;line-height:18px;margin-top:6px}
.bgo{position:absolute;right:16px;top:16px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:var(--l2);border-radius:6px}
.bgo:hover{background:rgba(255,255,255,.08);color:#fff}.bgo .i{width:22px;height:22px}
.bm{display:flex;align-items:center;justify-content:center;gap:24px;height:76px;margin:6px 0 4px}
.bm span{display:inline-flex;transition:transform .2s}.bm span:hover{transform:translateY(-2px)}
.nob{color:var(--l4);font-size:13px}
.bt{font-size:16px;line-height:24px}
.medal{position:relative;display:inline-block;flex:none;transform:perspective(380px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) scale(var(--ms,1));transition:transform .22s ease-out}
.medal img{display:block;width:100%;height:100%;-webkit-user-drag:none}
.medal.tilt{--ms:1.08;transition:transform .06s linear}
.gl{position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .2s;-webkit-mask:var(--m) center/100% no-repeat;mask:var(--m) center/100% no-repeat;background:radial-gradient(circle at var(--gx,35%) var(--gy,25%),rgba(255,255,255,.62),rgba(255,255,255,.14) 28%,transparent 52%)}
.medal.tilt .gl{opacity:1}
.medal.locked img{opacity:.68}
.pheat{padding:16px}
.hh{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:16px}
.hn2{font-size:20px;line-height:28px;font-weight:500;margin-right:4px}.ht{font-size:16px;line-height:24px;color:var(--l2)}
.hi{color:var(--l3);display:inline-flex;margin-left:4px}.hi .i{width:14px;height:14px}
.hs{font-size:12px;line-height:16px;color:var(--l3);margin-left:16px}.hs b{color:var(--l2);font-weight:500;margin-left:4px}
.hs:first-of-type{margin-left:auto}
.ysel{position:relative;margin-left:16px}
.ybtn{display:inline-flex;align-items:center;gap:12px;height:28px;padding:6px 12px;border-radius:5px;background:rgba(255,255,255,.1);font-size:12px;line-height:16px;color:var(--l2)}
.ybtn:hover{background:rgba(255,255,255,.14)}.ybtn .i{width:14px;height:14px}
.ypop{position:absolute;right:0;top:34px;z-index:5;min-width:120px;padding:6px;border-radius:8px;background:#303030;box-shadow:0 10px 24px rgba(0,0,0,.45);display:flex;flex-direction:column}
.ypop button{display:flex;align-items:center;justify-content:space-between;height:30px;padding:0 10px;border-radius:6px;font-size:13px;color:var(--l2)}
.ypop button:hover{background:rgba(255,255,255,.08);color:#fff}.ypop button.on{color:#fff}.ypop .i{width:14px;height:14px;color:#0a84ff}
.hmw{padding:0 2px}
.hm{display:block;width:100%;height:auto;max-height:108px}
.hm rect{fill:rgba(255,255,255,.1)}
.hm rect.l1{fill:#016620}.hm rect.l2{fill:#109932}.hm rect.l3{fill:#28c244}.hm rect.l4{fill:#7ce38b}
.hm rect:hover{stroke:rgba(255,255,255,.7);stroke-width:1}
.hm text{fill:var(--l3);font:14px var(--ui)}
.ptabsc{padding:16px}
.ptop{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.ptabs{display:flex;gap:0}
.ptab{display:inline-flex;align-items:center;gap:12px;height:44px;padding:10px 20px;border-radius:5px;font-size:14px;line-height:21px;font-weight:500;color:var(--l2);transition:color .15s,background .15s}
.ptab .ti{width:20px;height:20px}
.ptab.on{background:rgba(255,255,255,.1);color:#fff}.ptab:not(.on):hover{color:#fff}
.vall{display:inline-flex;align-items:center;gap:2px;font-size:14px;color:var(--l3)}.vall:hover{color:#fff}.vall .i{width:16px;height:16px}
.prow2{height:56px;border-radius:5px;padding:0 16px;display:flex;align-items:center;gap:16px;font-size:14px;line-height:21px}
.prow2:nth-child(odd){background:rgba(255,255,255,.07)}
.prow2:hover .tt{text-decoration:underline}
.prow2 .tt{flex:1;min-width:0;font-weight:500;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prow2 .when{color:var(--l3);flex:none}
.prow2 .vd{font-size:13px;font-weight:500;flex:none}.vd.ok{color:#2cbb5d}.vd.bad{color:#f63737}.vd.neu{color:var(--l3)}
.modal{position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
.modal .box{width:720px;max-width:calc(100vw - 32px);max-height:calc(100vh - 64px);overflow:auto;background:#282828;border-radius:12px;padding:20px 24px 24px;box-shadow:0 24px 60px rgba(0,0,0,.6)}
.mh{position:relative;display:flex;align-items:center;margin-bottom:16px}.mh h2{margin:0;font-size:18px;font-weight:500}.mh small{font-size:13px;color:var(--l3);font-weight:400;margin-left:6px}.mh .bgo{top:-2px;right:0}
.modal .box.bbox{width:980px;padding:0;display:flex;flex-direction:column;overflow:hidden}
.bbox .mh{flex:none;margin:0;padding:20px 24px 16px;border-bottom:1px solid rgba(255,255,255,.08)}.bbox .mh .bgo{top:18px;right:20px}
.bscroll{overflow:auto;padding:4px 24px 24px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}
.bscroll h3{margin:20px 0 12px;font-size:13px;line-height:20px;font-weight:500;color:var(--l2)}.bscroll h3 small{margin-left:4px;font-size:12px;font-weight:400;color:var(--l3);font-variant-numeric:tabular-nums}
.bgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
.bi{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;padding:16px 8px 14px;border-radius:12px;background:radial-gradient(120% 90% at 50% 0,color-mix(in srgb,var(--g) 30%,transparent),transparent 72%),rgba(255,255,255,.05);box-shadow:inset 0 1px rgba(255,255,255,.08),inset 0 0 0 1px rgba(255,255,255,.04)}
.bi.off{background:rgba(255,255,255,.025);box-shadow:inset 0 0 0 1px rgba(255,255,255,.03)}
.bi b{font-size:13px;line-height:18px;font-weight:500;margin-top:8px}.bi small{font-size:11.5px;line-height:16px;color:var(--l3)}.bi.off b{color:var(--l3)}
@media (prefers-reduced-motion:reduce){.medal{transition:none}}
.nf{padding:80px 24px;text-align:center;color:#a8a8a8}.nf b{display:block;font-size:18px;color:#f5f5f5;margin-bottom:8px}.nf a{color:#0a84ff}
.sk{border-radius:8px;background:linear-gradient(90deg,#252525,#2d2d2d,#252525);background-size:200% 100%;animation:sk 1.2s linear infinite}
/* ---------------- Discuss (LeetCode's /discuss/, measured: feed 952 px, sidebar 268 px) ---------------- */
.dwrap{display:grid;grid-template-columns:minmax(0,952px) 268px;gap:56px;justify-content:center;padding:24px 24px 72px}
.promos{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.promo{position:relative;height:135px;border-radius:8px;overflow:hidden;padding:18px 18px;display:flex;flex-direction:column;justify-content:center;gap:4px;color:#fff;transition:transform .2s}
.promo:hover{transform:translateY(-2px)}
.promo::after{content:"";position:absolute;right:-40px;bottom:-60px;width:180px;height:180px;border-radius:9999px;border:22px solid rgba(255,255,255,.12)}
.p-a{background:linear-gradient(135deg,#1c1c3a,#2f2a8a 60%,#6a3df0)}.p-b{background:linear-gradient(135deg,#0f5132,#13895a 60%,#2cbb5d)}.p-c{background:linear-gradient(135deg,#5a2a0a,#b8560f 60%,#f39c12)}.p-d{background:linear-gradient(135deg,#3a0f4a,#8a2be2 60%,#d63bd6)}
.pt1{font-size:19px;line-height:24px;font-weight:700;letter-spacing:-.01em;max-width:200px;position:relative;z-index:1}
.pt2{font-size:12px;line-height:16px;color:rgba(255,255,255,.75);max-width:190px;position:relative;z-index:1}
.pcta{align-self:flex-start;margin-top:8px;padding:4px 12px;border-radius:9999px;background:#141414;font-size:12px;font-weight:500;position:relative;z-index:1}
.dtabs{display:flex;align-items:center;gap:6px;padding:16px 0}
.dtab{display:inline-flex;align-items:center;gap:6px;height:32px;padding:4px 10px;border-radius:8px;font-size:16px;line-height:24px;color:#a8a8a8;transition:color .15s}
.dtab:hover{color:#f5f5f5}.dtab.on{background:rgba(255,255,255,.08);color:#f5f5f5;font-weight:600}.dtab .i{width:16px;height:16px}
.dcreate{margin-left:auto;display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-radius:8px;background:#02b128;color:#fff;font-size:14px;font-weight:500}
.dcreate:hover{background:#029a23}.dcreate .i{width:15px;height:15px}
.dsort{display:flex;gap:16px;padding:0 10px 16px}
.dsort button{display:inline-flex;align-items:center;gap:6px;font-size:14px;line-height:20px;color:#a8a8a8}
.dsort button:hover,.dsort button.on{color:#f5f5f5}.dsort .i{width:15px;height:15px}
.post{display:flex;gap:12px;padding:16px 0 18px;border-bottom:1px solid rgba(255,255,255,.1)}
.post:hover .ptitle{color:#fff;text-decoration:underline;text-decoration-color:rgba(255,255,255,.3)}
.pav{width:28px;height:28px;border-radius:9999px;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#1a1a1a;background:var(--c);margin-top:8px}
.pbody{flex:1;min-width:0;display:flex;flex-direction:column}
.pmeta{display:flex;align-items:center;gap:6px;font-size:14px;line-height:20px;color:#a8a8a8}
.pmeta i{width:2px;height:2px;border-radius:9999px;background:#757575}.pw{color:#757575}
.ptitle{margin-top:2px;font-size:18px;line-height:28px;font-weight:600;color:#f5f5f5}
.ptext{margin-top:8px;font-size:16px;line-height:24px;color:#a8a8a8;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pstats{display:flex;gap:18px;margin-top:14px;font-size:14px;line-height:20px;color:#a8a8a8}
.pstats span{display:inline-flex;align-items:center;gap:5px}.pstats .i{width:16px;height:16px}
.pimg{width:158px;height:95px;border-radius:8px;overflow:hidden;flex:none;margin-top:8px;background:#282828}
.pimg img{width:100%;height:100%;object-fit:cover;display:block}
.dside{position:sticky;top:74px;align-self:start}
.dsearch{display:flex;align-items:center;gap:8px;height:32px;padding:0 14px;border-radius:9999px;background:rgba(255,255,255,.08);color:#a8a8a8}
.dsearch .i{width:15px;height:15px}.dsearch input{all:unset;flex:1;font:14px/20px var(--ui);color:#f5f5f5}.dsearch input::placeholder{color:#a8a8a8}
.trend{margin-top:16px;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:16px 16px 8px}
.th2{display:flex;align-items:center;gap:8px;font-size:18px;line-height:28px;font-weight:600;margin-bottom:10px}.th2 .i{width:18px;height:18px}
.ti{display:flex;gap:12px;padding:8px 0}
.tn{width:16px;flex:none;text-align:center;font-size:13px;line-height:20px;font-weight:600;color:#a8a8a8}.tn.hot{color:#ff6b1a}
.tb{min-width:0;display:flex;flex-direction:column}
.tt2{font-size:14px;line-height:20px;color:#f5f5f5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ti:hover .tt2{text-decoration:underline}
.tm{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:12px;line-height:16px;color:#757575}.tm i{width:2px;height:2px;border-radius:9999px;background:#757575}.tm .i{width:12px;height:12px}
.dmain .pager a,.dmain .pager span{min-width:24px;height:24px;padding:3px 8px;border-radius:5px;background:rgba(255,255,255,.1);color:var(--l2);font-size:12px;line-height:16px;display:inline-flex;align-items:center;justify-content:center}
.dmain .pager span{background:none}.dmain .pager a.on{background:#2563eb;color:#fff}.dmain .pager a:hover:not(.on){background:rgba(255,255,255,.16)}.dmain .pager .i{width:14px;height:14px}

/* ---------------- Gym ---------------- */
.gwrap2{max-width:900px;margin:0 auto;padding:40px 24px 80px}
.ghero h1{margin:0;font:400 26px/39px var(--ui);color:#f5f5f5}
.ghero p{margin:4px 0 0;font-size:14px;line-height:20px;font-weight:300;color:#a8a8a8}
.gtools{display:flex;align-items:center;gap:12px;margin-top:24px}
.gsearch{flex:1;display:flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:9999px;background:rgba(255,255,255,.08);color:#a8a8a8}
.gsearch .i{width:15px;height:15px}.gsearch input{all:unset;flex:1;font:14px/20px var(--ui);color:#f5f5f5}.gsearch input::placeholder{color:#a8a8a8}
.gseg{display:inline-flex;padding:4px;border-radius:9999px;background:rgba(255,255,255,.08)}
.gseg .gchip{height:28px;padding:0 12px;border-radius:9999px;font-size:13px;font-weight:500;color:rgba(255,255,255,.6);background:none}
.gseg .gchip.on{background:rgba(255,255,255,.1);color:#f1f5f9}
.gsort{position:relative;display:inline-flex;align-items:center}
.gsort select{appearance:none;height:36px;padding:0 32px 0 14px;border-radius:9999px;border:0;background:rgba(255,255,255,.08);color:#f5f5f5;font:13px var(--ui);cursor:pointer}
.gsort select option{background:#303030}.gsort .i{position:absolute;right:12px;width:14px;height:14px;color:#a8a8a8;pointer-events:none}
.gdiff{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0 20px}
.gchip{height:30px;padding:0 12px;border-radius:9999px;background:rgba(255,255,255,.06);color:var(--l2);font-size:13px;display:inline-flex;align-items:center;transition:background .15s}
.gchip:hover{background:rgba(255,255,255,.1)}.gchip.on{background:#f5f5f5;color:#1a1a1a}
.gcount{margin-left:auto;font-size:12px;color:var(--l3)}
.stars{display:inline-flex;gap:2px}.stars i{width:10px;height:10px;background:rgba(255,255,255,.18);clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
.stars i.on{background:#ffb700}.gchip.on .stars i{background:rgba(0,0,0,.2)}.gchip.on .stars i.on{background:#c98a00}
.glist{border-radius:20px}
.grow{display:flex;align-items:center;gap:16px;padding:8px 6px;border-radius:12px;transition:background .15s}
.grow:hover{background:rgba(255,255,255,.04)}
.grow+.grow{margin-top:2px}
.gth{width:72px;height:52px;border-radius:10px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,color-mix(in srgb,var(--c) 70%,#fff),var(--c) 55%,color-mix(in srgb,var(--c) 55%,#000));box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.gth b{font-size:13px;line-height:16px;font-weight:800;color:#fff;letter-spacing:.04em;text-shadow:0 1px 2px rgba(0,0,0,.3)}
.gth small{font-size:10px;line-height:12px;color:rgba(255,255,255,.85)}
.grow .cm .n{font-size:15px;line-height:22px}
.grow .stars{flex:none}
/* ---------------- Friends, Followers, a user's contests ---------------- */
.fstats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:24px}.fstats.four{grid-template-columns:repeat(4,1fr)}
.fst{background:#282828;border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:2px;min-width:0}
.fst .lb{font-size:12px;line-height:16px;color:var(--l3)}.fst b{font-size:20px;line-height:28px;font-weight:500;color:#f5f5f5}.fst b.g{color:#2cbb5d}
.fst a{font-size:16px;line-height:28px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fst small{font-size:12px;line-height:16px;color:var(--l3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fst .up,.cdl.up{color:#2cbb5d}.fst .dn,.cdl.dn{color:#f63737}
.fwrap .gtools,.cwwrap .gtools{margin:20px 0 16px}
.flist,.cwlist{border-radius:20px}
.fhd,.frow{display:grid;grid-template-columns:40px minmax(0,1fr) 150px 130px 32px;gap:16px;align-items:center}
.fhd{padding:0 10px 8px;font-size:12px;color:var(--l3)}
.frow{padding:8px 10px;border-radius:12px;transition:background .15s}.frow:hover{background:rgba(255,255,255,.05)}.frow+.frow{margin-top:2px}
.frow.sm{grid-template-columns:36px minmax(0,1fr);gap:12px;padding:6px 8px}
.fav{position:relative;width:40px;height:40px;border-radius:9999px;background:#3e3e3e;display:flex;align-items:center;justify-content:center;flex:none}
.frow.sm .fav{width:36px;height:36px}
.fav img{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;object-fit:cover;z-index:1}.fav b{font-size:15px;font-weight:600;color:#fff}
.fav .on{position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:9999px;background:#2cbb5d;border:2px solid #282828;z-index:2}
.fm{display:flex;flex-direction:column;min-width:0}.fh{font-size:14px;line-height:20px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fs{font-size:12px;line-height:18px;color:var(--l3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fr{display:flex;flex-direction:column;align-items:flex-end}.fr b{font-size:14px;line-height:20px;font-weight:500}.fr small{font-size:12px;line-height:16px;color:var(--l3);white-space:nowrap}
.fl{text-align:right;font-size:13px;color:var(--l2);white-space:nowrap}.onl{color:#2cbb5d}
.fbtn{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--l2);cursor:pointer;transition:background .15s,color .15s}.fbtn:hover{background:rgba(255,255,255,.1);color:#fff}.fbtn .i{width:16px;height:16px}
.folb{all:unset;cursor:pointer;color:#a8a8a8;white-space:nowrap}.folb:hover,.folb:hover b{color:#fff}.folb b{color:#f5f5f5;font-weight:400;margin-right:4px}
.csb{all:unset;display:block;width:100%;cursor:pointer;border-radius:8px}.csb:hover .csl span{color:#fff}
.modal .box.fbox{width:480px}.fbox .mh{margin-bottom:12px}.fbox .ptab{height:36px;padding:6px 14px;gap:6px}.fbox .ptab small{font-size:12px;color:var(--l3)}
.flist2{max-height:420px;overflow:auto;margin:0 -8px}
.fcount{display:flex;align-items:center;gap:10px;padding:24px 4px 8px;font-size:14px;color:var(--l2)}.fcount b{font-size:28px;line-height:32px;font-weight:500;color:#f5f5f5}
.fci{width:40px;height:40px;border-radius:9999px;background:rgba(255,55,95,.14);color:#ff375f;display:flex;align-items:center;justify-content:center}.fci .i{width:20px;height:20px}
.fnote{margin:8px 4px 4px;font-size:13px;line-height:20px;color:var(--l3)}
.fall{display:inline-flex;margin-top:12px}
.cwhero{display:flex;align-items:center;gap:16px}
.fav.big{width:64px;height:64px;border-radius:12px}.fav.big b{font-size:26px}
.cwhero h1{margin:0;font:400 26px/36px var(--ui);display:flex;align-items:baseline;gap:12px}.cwhero h1 a{font-weight:600}.cwhero h1 span{font-size:16px;color:var(--l2)}
.cwhero p{margin:2px 0 0;font-size:14px;color:#a8a8a8}
.cwchart{margin-top:16px;padding:16px 16px 4px}
.chd,.cwr{display:grid;grid-template-columns:44px minmax(0,1fr) 120px 80px 80px 70px;gap:12px;align-items:center}
.chd{padding:0 12px 8px;font-size:12px;color:var(--l3)}
.cwr{height:48px;padding:0 12px;border-radius:8px;font-size:14px}.cwr:nth-child(even){background:rgba(255,255,255,.04)}.cwr:hover{background:rgba(255,255,255,.08)}
.cwr .cn{color:var(--l3);font-variant-numeric:tabular-nums}.cwr .ct{color:#f5f5f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cwr:hover .ct{text-decoration:underline}
.cwr .cd{color:var(--l3);font-size:13px}.cwr .cr,.cwr .cdl,.cwr .cnr{text-align:right;font-variant-numeric:tabular-nums}.cwr .cr:hover{color:#0a84ff;text-decoration:underline}.cwr .cnr{font-weight:500}
@media (max-width:760px){.fstats,.fstats.four{grid-template-columns:1fr 1fr}.fhd,.frow:not(.sm){grid-template-columns:40px minmax(0,1fr) 90px}.frow .fl,.frow .fbtn,.fhd span:nth-child(n+4){display:none}.chd,.cwr{grid-template-columns:minmax(0,1fr) 70px 60px}.cwr .cn,.cwr .cd,.cwr .cr,.chd span:nth-child(1),.chd span:nth-child(3),.chd span:nth-child(4){display:none}}
/* ---------------- Settings (LeetCode's Basic Info) ---------------- */
.swrap{display:grid;grid-template-columns:240px minmax(0,760px);gap:24px;justify-content:center;padding:32px 24px 80px;align-items:start}
.sside{position:sticky;top:74px;background:#282828;border-radius:8px;padding:12px}
.sme{display:flex;align-items:center;gap:12px;padding:6px 6px 14px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:8px}
.sme span{display:flex;flex-direction:column;min-width:0}.sme b{font-size:15px;font-weight:600;color:#f5f5f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sme small{font-size:12px;color:var(--l3)}
.snav{display:flex;align-items:center;gap:10px;height:40px;padding:0 10px;border-radius:6px;color:var(--l2);font-size:14px;transition:background .15s,color .15s}
.snav .i{width:18px;height:18px}.snav:hover{background:rgba(255,255,255,.06);color:#fff}.snav.on{background:rgba(255,255,255,.1);color:#fff;font-weight:500}
.smain h2{margin:0 0 16px;font:500 20px/28px var(--ui);color:#f5f5f5}
.scard{background:#282828;border-radius:8px;padding:4px 24px}
.srow{display:grid;grid-template-columns:200px minmax(0,1fr) auto;gap:16px;align-items:center;min-height:60px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.srow:last-child{border-bottom:0}
.sl2{font-size:14px;color:#f5f5f5}
.sv{font-size:14px;color:var(--l2);min-width:0;overflow-wrap:anywhere}.sv.empty{color:var(--l3)}
.sedit{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:6px;color:#3c9bff;font-size:14px;transition:background .15s}
.sedit .i{width:14px;height:14px}.sedit:hover{background:rgba(60,155,255,.1)}
.srow.ed{grid-template-columns:200px minmax(0,1fr);align-items:start}.srow.ed .sl2{padding-top:7px}
.sin{all:unset;box-sizing:border-box;display:block;width:100%;min-height:36px;padding:7px 12px;border-radius:8px;background:rgba(255,255,255,.08);color:#f5f5f5;font:14px/22px var(--ui);box-shadow:inset 0 0 0 1px transparent;transition:box-shadow .15s}
.sin:focus{box-shadow:inset 0 0 0 1px #3c9bff}
select.sin{appearance:auto;cursor:pointer}select.sin option{background:#303030}
textarea.sin{white-space:pre-wrap;resize:vertical}
.srad{display:flex;gap:16px;flex-wrap:wrap;padding-top:7px}.srad label{display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:#f5f5f5}
.sact{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.sbtn{height:32px;padding:0 16px;border-radius:8px;background:#2cbb5d;color:#fff;font-size:14px;font-weight:500;transition:background .15s}.sbtn:hover{background:#28a754}
.sbtn.ghost{background:rgba(255,255,255,.1);color:#f5f5f5}.sbtn.ghost:hover{background:rgba(255,255,255,.16)}
.sfn{margin-left:10px;color:var(--l3);font-size:13px}
.tgl{position:relative;width:40px;height:22px;border-radius:9999px;background:rgba(255,255,255,.2);transition:background .15s}
.tgl i{position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:9999px;background:#fff;transition:transform .15s}
.tgl.on{background:#2cbb5d}.tgl.on i{transform:translateX(18px)}
.serr{grid-column:1/-1;color:#ef4743;font-size:13px;margin-top:-4px}
.snote{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 14px;border-radius:8px;background:rgba(44,187,93,.12);color:#2cbb5d;font-size:14px}.snote .i{width:16px;height:16px}.snote.busy{background:rgba(255,255,255,.06);color:var(--l2)}
.ssec{margin:20px 2px 8px;font-size:13px;font-weight:500;color:var(--l3);text-transform:none}.ssec:first-child{margin-top:0}
.spw{display:block;margin-bottom:12px}.spw>span:first-child{display:block;font-size:12px;color:var(--l3);margin-bottom:6px}
.spwin{position:relative;display:block}.spwin .sin{padding-right:44px}
.eye{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:34px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--l3)}.eye:hover{color:#fff;background:rgba(255,255,255,.08)}.eye .i{width:17px;height:17px}
/* Chrome's autofill painted the fields white (user, Oct 30 2026): keep them dark */
.sin:-webkit-autofill,.sin:-webkit-autofill:hover,.sin:-webkit-autofill:focus{-webkit-text-fill-color:#f5f5f5;caret-color:#f5f5f5;-webkit-box-shadow:0 0 0 1000px #3a3a3a inset;transition:background-color 99999s}
.shint{margin:12px 2px 0;font-size:12px;color:var(--l3)}
@media (max-width:900px){.swrap{grid-template-columns:minmax(0,1fr)}.sside{position:static}.srow,.srow.ed{grid-template-columns:minmax(0,1fr) auto}.srow.ed{grid-template-columns:minmax(0,1fr)}}
@media (max-width:1180px){.dwrap{grid-template-columns:minmax(0,952px)}.dside{display:none}.promos{grid-template-columns:repeat(2,1fr)}.pf{grid-template-columns:minmax(0,836px);padding:24px}.pfl{position:static;max-height:none}.pair{grid-template-columns:1fr 1fr}.cgrid{grid-template-columns:minmax(0,540px);margin:64px 0 0}.ccards{margin:64px 0 0;flex-wrap:wrap}}
@media (max-width:760px){.pair{grid-template-columns:1fr}.c1{flex-direction:column}.c1l{border:0;padding:0}.c1r{width:auto;padding:16px 0 0}.crow .th{display:none}}
`;

  const modernWanted = (r) => !!r && r[UI_KEY] === 'modern' && (globalThis.CFTS_THEMES ? (globalThis.CFTS_THEMES.byId[r.cfThemeStudio] || {}).app === 'modern' : r.cfThemeStudio === 'leetcode');
  chrome.storage.local.get([UI_KEY, 'cfThemeStudio'], (r) => apply(modernWanted(r) ? 'modern' : 'classic'));
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && (c[UI_KEY] || c.cfThemeStudio)) chrome.storage.local.get([UI_KEY, 'cfThemeStudio'], (r) => apply(modernWanted(r) ? 'modern' : 'classic'));
  });
  document.addEventListener('cfm:unmount', () => unmount());
  setTimeout(() => { if (wanted && !app) fail('timeout'); }, 6000);
  globalThis.CFM_SITE = { debug: () => (app ? { page: PAGE, mounted: true, contests: app.list ? app.list.length : null, hist: app.hist ? app.hist.length : null, info: !!app.info, status: app.status ? app.status.rows.length : null } : { page: PAGE, mounted: false }) };
})();
