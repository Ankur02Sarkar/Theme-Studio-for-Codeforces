/* =============================================================================
   strip.js  (isolated world)   MODERN.md M2c: the contest strip on /contest/N/problem/X and /gym/N/problem/X.
   A slim bar above the panels: the contest's name, its phase (with the time left while it runs), the problem letters A..G as tabs
   (solved = a green dot, the current one lit) and a Standings link (a Classic page). The letters are not on the problem page, so
   they come from the cached problem list (Gym: contest.standings with ONE row; api.js). If that fails the strip is simply not shown and nothing
   moves. The countdown is computed from the API's timing and ticks locally once a second while the contest runs.
============================================================================= */
(() => {
  'use strict';
  const CFM = globalThis.CFM; if (!CFM) return;
  const PATH = /^\/(contest|gym)\/(\d+)\/problem\//.exec(location.pathname);
  CFM.debug = CFM.debug || {};
  if (!PATH) { CFM.debug.strip = () => ({ shown: false, reason: 'not a contest or gym problem page: no strip by design' }); return; }
  let c = null, S = null;
  const clock = (sec) => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; const p = (n) => String(n).padStart(2, '0'); return h >= 48 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${p(h)}:${p(m)}:${p(s)}`; };

  function mount(ctx) {
    c = ctx; S = { info: null, timer: 0 };
    const t = S; const A = globalThis.CFM_API; if (!A) return;
    A.contestInfo(PATH[2], PATH[1] === 'gym', fromPage()).then((info) => { if (S !== t || !c) return; S.info = info; build(); }).catch(() => { /* no strip, nothing moves */ });
  }
  /* the contest box in Codeforces' sidebar: its name link, "Finished" / "Contest is running" and the countdown (hh:mm:ss) */
  function fromPage() {
    const box = document.querySelector('#sidebar .rtable'), a = box && box.querySelector(`a[href*="/${PATH[1]}/${PATH[2]}"]`);
    if (!a) return null;
    const ph = (document.querySelector('#sidebar .contest-state-phase') || {}).textContent || '';
    const cd = /(\d+):(\d\d):(\d\d)/.exec((document.querySelector('#sidebar .countdown') || {}).textContent || '');
    const left = cd ? +cd[1] * 3600 + +cd[2] * 60 + +cd[3] : 0;
    const phase = /finished/i.test(ph) ? 'FINISHED' : /running/i.test(ph) && cd ? 'CODING' : ph.trim();
    return { name: a.textContent.trim(), phase, duration: left, relative: 0 };
  }
  function unmount() { if (S) clearTimeout(S.timer); S = null; c = null; }

  function phaseText() {
    const i = S.info, el = (Date.now() - i.fetched) / 1000;
    if (i.phase === 'CODING') return { t: `Running · ${clock(i.duration - i.relative - el)} left`, run: true };
    if (i.phase === 'BEFORE') return { t: `Starts in ${clock(-i.relative - el)}`, run: false };
    if (i.phase === 'FINISHED') return { t: 'Finished', run: false };
    return { t: String(i.phase || '').toLowerCase().replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()), run: false };
  }
  function lettersHTML() {
    const rows = (CFM.state && CFM.state.rows) || [];
    const ok = new Set(rows.filter((r) => String(r[2]) === PATH[2] && r[4] === 'OK').map((r) => r[3]));
    return S.info.problems.map((p) => `<a class="ltr${p.index === c.IDX ? ' on' : ''}${ok.has(p.index) ? ' ok' : ''}" href="/${PATH[1]}/${PATH[2]}/problem/${encodeURIComponent(p.index)}" title="${c.esc(p.name)}${ok.has(p.index) ? ' (solved)' : ''}">${c.esc(p.index)}</a>`).join('');
  }
  function build() {
    const sh = c.app.sh, i = S.info;
    if (sh.getElementById('strip')) return;
    const ph = phaseText();
    sh.querySelector('.top').insertAdjacentHTML('afterend', `<div class="strip" id="strip" data-m="strip"><a class="cn" href="/${PATH[1]}/${PATH[2]}" title="Contest page (Classic view)">${c.esc(i.name)}</a><span class="ph${ph.run ? ' run' : ''}" id="strip-ph">${c.esc(ph.t)}</span><span class="lt" id="strip-lt">${lettersHTML()}</span><a class="sd" href="/${PATH[1]}/${PATH[2]}/standings" title="Standings (Classic view)">Standings</a></div>`);
    c.app.host.style.setProperty('--sy', '88px');
    c.toEditor({ op: 'layout' });
    tick();
  }
  function tick() {
    if (!S || !c) return;
    const el = c.app.sh.getElementById('strip-ph'); if (el) el.textContent = phaseText().t;
    if (S.info.phase === 'CODING' || S.info.phase === 'BEFORE') S.timer = setTimeout(tick, 1000);
  }
  CFM.debug.strip = () => (S && S.info ? { contest: S.info.id, phase: S.info.phase, letters: S.info.problems.map((p) => p.index).join(''), shown: !!(c && c.app.sh.getElementById('strip')) } : { shown: false, reason: PATH[1] === 'gym' ? 'no contest info (contest.standings failed)' : 'no contest info (round not in the problem list yet, or no contest box on the page)' });

  CFM.use({
    mount, unmount,
    status() { if (S && S.info && c) { const lt = c.app.sh.getElementById('strip-lt'); if (lt) lt.innerHTML = lettersHTML(); } },
  });
})();
