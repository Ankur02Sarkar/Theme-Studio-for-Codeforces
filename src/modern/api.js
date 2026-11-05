/* =============================================================================
   api.js  (isolated world)   MODERN.md "Requests": the one API client for Modern mode.
   - credentials omitted, public API only (https://codeforces.com/api/<method>), visible-tab calls only
   - ONE queue per tab, calls at least GAP ms apart, and the gap is kept across tabs through a timestamp in
     chrome.storage.local (cfmApiAt), so two open problems still call at most once per ~2.3 s together
   - "Call limit exceeded": waits 5 s and retries ONCE, then reports it. A non-OK answer is an Error with the API's comment.
   - caches in chrome.storage.local (compact, never the raw lists):
       cfmProblems  { at, rows: [[contestId, index, name, rating|0, solvedCount, tags[]], ...] }  refreshed after 24 h
       cfmStatus    { handle, at, rows: [[id, sec, cid, idx, verdict, lang, ms, bytes, passed, ptype], ...], limited }
                    first load = the newest 1000 submissions, then the newest 50 on each visit, merged by id
   Deviation from the plan text (recorded in MODERN.md): the client lives here, not in the service worker, because the
   offline harness can intercept page requests but not the worker's; the behaviour (queue, gap, back-off) is the same.
============================================================================= */
(() => {
  'use strict';
  const BASE = 'https://codeforces.com/api/';
  const AT_KEY = 'cfmApiAt', PROB_KEY = 'cfmProblems', STAT_KEY = 'cfmStatus';
  const DAY = 24 * 3600 * 1000, FIRST_PAGE = 1000, REFRESH = 50, KEEP = 3000;
  let gap = 2300, chain = Promise.resolve(), last = 0;
  chrome.storage.local.get(['cfmApiGap'], (r) => { if (r && +r.cfmApiGap) gap = +r.cfmApiGap; });   // a dev/test override
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = (k) => new Promise((r) => chrome.storage.local.get([k], (x) => r(x ? x[k] : undefined)));
  const set = (o) => new Promise((r) => chrome.storage.local.set(o, r));

  async function once(method, params) {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(BASE + method + (qs ? '?' + qs : ''), { credentials: 'omit' });
    let j = null; try { j = await r.json(); } catch (e) { /* not JSON */ }
    if (!j) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
    if (j.status !== 'OK') throw Object.assign(new Error(j.comment || 'API said ' + j.status), { api: true, status: r.status });
    return j.result;
  }
  const LOG = [];   // the last 25 calls (method, outcome, time): read by the dev box's "Copy report"
  const note = (method, t0, err) => { LOG.push({ m: method, ms: Date.now() - t0, ok: !err, err: err ? String(err.message || err).slice(0, 120) : '' }); if (LOG.length > 25) LOG.shift(); };
  function call(method, params = {}) {
    const run = async () => {
      const at = (await get(AT_KEY)) || 0;
      const wait = Math.max(0, Math.max(last, at) + gap - Date.now());
      if (wait) await sleep(wait);
      last = Date.now(); set({ [AT_KEY]: last });
      const t0 = Date.now();
      try { const r = await once(method, params); note(method, t0); return r; }
      catch (e) {
        if (!/limit/i.test(e.message)) { note(method, t0, e); throw e; }
        await sleep(5000); last = Date.now(); set({ [AT_KEY]: last });
        try { const r = await once(method, params); note(method + ' (retry)', t0); return r; } catch (e2) { note(method + ' (retry)', t0, e2); throw e2; }
      }
    };
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }

  /* problemset.problems -> compact rows, one fetch a day */
  async function problems() {
    const c = await get(PROB_KEY);
    if (c && c.rows && Date.now() - c.at < DAY && c.rows.length && Array.isArray(c.rows[0][5])) return c.rows;   // rows without tags: from before M3
    const res = await call('problemset.problems');
    const stat = new Map(res.problemStatistics.map((s) => [s.contestId + ':' + s.index, s.solvedCount]));
    const rows = res.problems.map((p) => [p.contestId, p.index, p.name, p.rating || 0, stat.get(p.contestId + ':' + p.index) || 0, p.tags || []]);
    await set({ [PROB_KEY]: { at: Date.now(), rows } });
    return rows;
  }
  async function problemRow(cid, idx) {
    const rows = await problems();
    return rows.find((r) => String(r[0]) === String(cid) && r[1] === idx) || null;
  }

  const pack = (x) => [x.id, x.creationTimeSeconds, x.problem.contestId, x.problem.index, x.verdict || '', x.programmingLanguage, x.timeConsumedMillis || 0, x.memoryConsumedBytes || 0, x.passedTestCount || 0, (x.author && x.author.participantType) || ''];
  /* the user's submissions, newest first: the first page once, then a short refresh on each visit */
  async function statusRows(handle) {
    const c = await get(STAT_KEY);
    const same = c && c.handle === handle && Array.isArray(c.rows);
    const res = await call('user.status', { handle, from: 1, count: same ? REFRESH : FIRST_PAGE });
    const fresh = res.map(pack);
    let rows = fresh, limited = res.length >= FIRST_PAGE;
    if (same) {
      const byId = new Map(c.rows.map((r) => [r[0], r]));
      fresh.forEach((r) => byId.set(r[0], r));
      rows = [...byId.values()].sort((a, b) => b[0] - a[0]).slice(0, KEEP);
      limited = c.limited;
    }
    await set({ [STAT_KEY]: { handle, at: Date.now(), rows, limited } });
    return { rows, limited };
  }
  /* live look at the newest few (the submit flow): updates the cache so the Submissions tab agrees */
  async function latest(handle, count) {
    const res = await call('user.status', { handle, from: 1, count });
    const c = await get(STAT_KEY);
    if (c && c.handle === handle && Array.isArray(c.rows)) {
      const byId = new Map(c.rows.map((r) => [r[0], r]));
      res.forEach((x) => byId.set(x.id, pack(x)));
      set({ [STAT_KEY]: Object.assign({}, c, { at: Date.now(), rows: [...byId.values()].sort((a, b) => b[0] - a[0]).slice(0, KEEP) }) });
    }
    return res;
  }

  /* blog entries, their comments, handles' ranks and a contest's problem letters: small, cached for an hour */
  const HOUR = 3600 * 1000, BLOG_KEY = 'cfmBlog', USER_KEY = 'cfmUsers', CON_KEY = 'cfmContests';
  async function cached(key, id, ttl, fetcher, keep) {
    const all = (await get(key)) || {};
    const hit = all[id];
    if (hit && Date.now() - hit.at < ttl) return hit.data;
    const data = await fetcher();
    const next = Object.assign({}, all, { [id]: { at: Date.now(), data } });
    const ids = Object.keys(next).sort((a, b) => next[a].at - next[b].at);
    while (ids.length > keep) delete next[ids.shift()];
    await set({ [key]: next });
    return data;
  }
  const blog = (id) => cached(BLOG_KEY, 'e' + id, HOUR, async () => { const r = await call('blogEntry.view', { blogEntryId: id }); return { id: r.id, title: r.title, author: r.authorHandle, at: r.creationTimeSeconds, content: r.content }; }, 6);
  const comments = (id) => cached(BLOG_KEY, 'c' + id, HOUR, async () => (await call('blogEntry.comments', { blogEntryId: id })).map((x) => ({ id: x.id, at: x.creationTimeSeconds, who: x.commentatorHandle, text: x.text, up: x.rating, parent: x.parentCommentId || 0 })), 6);
  /* ranks for the handles on screen: ONE call for up to 100 handles; the rest stay plain */
  async function users(handles) {
    const all = (await get(USER_KEY)) || {};
    const need = handles.filter((h) => !(all[h] && Date.now() - all[h].at < HOUR)).slice(0, 100);
    if (need.length) {
      const res = await call('user.info', { handles: need.join(';') });
      const got = new Set();
      for (const u of res) { all[u.handle] = { at: Date.now(), rating: u.rating == null ? null : u.rating, rank: u.rank || '' }; got.add(u.handle.toLowerCase()); }
      for (const h of need) if (!all[h]) all[h] = { at: Date.now(), rating: null, rank: '' };
      const keys = Object.keys(all).sort((a, b) => all[a].at - all[b].at); while (keys.length > 600) delete all[keys.shift()];
      await set({ [USER_KEY]: all });
    }
    return all;
  }
  /* the contest's name, phase, timing and problem letters.
     Gym: contest.standings with a single row. Contests: Codeforces refuses that call when signed in ("Non-gym contest standings
     ... only via anonymous GET requests with no extra parameters", seen live Oct 28 2026), and without parameters it is the whole
     table. So the letters come from the problem list (already cached for the rating) and the name and phase from the page
     (`page`, read by strip.js). A round not yet in the problemset (a running one) has no strip. */
  async function contestInfo(cid, gym, page) {
    if (gym) return cached(CON_KEY, String(cid), HOUR, async () => {
      const r = await call('contest.standings', { contestId: cid, from: 1, count: 1 });
      const c = r.contest;
      return { id: c.id, name: c.name, phase: c.phase, duration: c.durationSeconds, relative: c.relativeTimeSeconds, fetched: Date.now(), problems: r.problems.map((p) => ({ index: p.index, name: p.name })) };
    }, 20);
    const rows = (await problems()).filter((r) => String(r[0]) === String(cid));
    if (!rows.length || !page || !page.name) throw new Error('round not in the problemset yet, or no contest box on the page');
    rows.sort((a, b) => a[1].localeCompare(b[1], 'en', { numeric: true }));
    return Object.assign({ id: +cid, fetched: Date.now(), problems: rows.map((r) => ({ index: r[1], name: r[2] })) }, page);
  }

  /* upcoming rounds for the Problems page: contest.list once every 6 hours, only the ones not started kept [[id, name, startSec, durationSec]] */
  async function upcoming() {
    const c = await get('cfmUpcoming');
    if (c && Date.now() - c.at < 6 * HOUR) return c.rows.filter((r) => r[2] * 1000 > Date.now());
    const res = await call('contest.list', { gym: false });
    const rows = res.filter((x) => x.phase === 'BEFORE').map((x) => [x.id, x.name, x.startTimeSeconds, x.durationSeconds]).sort((a, b) => a[2] - b[2]).slice(0, 10);
    await set({ cfmUpcoming: { at: Date.now(), rows } });
    return rows;
  }

  /* M4: the Contests page. contest.list once an hour, compact: [[id, name, phase, startSec, durationSec], ...], the upcoming
     ones and the newest 400 finished (Gym excluded). Also refreshes cfmUpcoming so the Problems page agrees. */
  async function contestList() {
    const c = await get('cfmContestList');
    if (c && Date.now() - c.at < HOUR) return c.rows;
    const res = await call('contest.list', { gym: false });
    const pk = (x) => [x.id, x.name, x.phase, x.startTimeSeconds || 0, x.durationSeconds || 0];
    const before = res.filter((x) => x.phase === 'BEFORE').map(pk).sort((a, b) => a[3] - b[3]);
    const rest = res.filter((x) => x.phase !== 'BEFORE').map(pk).sort((a, b) => b[3] - a[3]).slice(0, 400);
    const rows = before.concat(rest);
    await set({ cfmContestList: { at: Date.now(), rows }, cfmUpcoming: { at: Date.now(), rows: before.slice(0, 10).map((r) => [r[0], r[1], r[3], r[4]]) } });
    return rows;
  }
  /* M4: a handle's rating history and profile, cached (6 h / 1 h) for the 20 handles seen last */
  const ratingOf = (handle) => cached('cfmRatings', handle.toLowerCase(), 6 * HOUR, async () => (await call('user.rating', { handle }))
    .map((x) => [x.contestId, x.contestName, x.rank, x.oldRating, x.newRating, x.ratingUpdateTimeSeconds]), 20);
  const userInfo = (handle) => cached('cfmUserInfo', handle.toLowerCase(), HOUR, async () => {
    const u = (await call('user.info', { handles: handle }))[0] || {};
    return { handle: u.handle, rating: u.rating == null ? null : u.rating, maxRating: u.maxRating == null ? null : u.maxRating, rank: u.rank || '', maxRank: u.maxRank || '',
      contribution: u.contribution || 0, friendOfCount: u.friendOfCount || 0, registered: u.registrationTimeSeconds || 0, lastOnline: u.lastOnlineTimeSeconds || 0,
      photo: u.titlePhoto || u.avatar || '', organization: u.organization || '', country: u.country || '', city: u.city || '', firstName: u.firstName || '', lastName: u.lastName || '' };
  }, 20);
  /* someone else's submissions: fetched for the page, never written over the signed-in user's cache (cfmStatus) */
  async function statusOf(handle, me) {
    if (me && handle.toLowerCase() === me.toLowerCase()) return statusRows(me);
    const res = await call('user.status', { handle, from: 1, count: FIRST_PAGE });
    return { rows: res.map(pack), limited: res.length >= FIRST_PAGE, names: Object.fromEntries(res.map((x) => [x.problem.contestId + x.problem.index, [x.problem.name, x.problem.rating || 0, x.problem.tags || []]])) };
  }

  /* the rated, active users once a day: the top 100 (contest page podium) and every rating, sorted (a handle's global rank,
     "Top x%" and the rating distribution on the profile). Kept compact: [[handle, rating, maxRating, photo, country], ...] */
  async function rated() {
    const c = await get('cfmRated');
    if (c && Date.now() - c.at < DAY && Array.isArray(c.ratings) && c.ratings.length) return c;
    const res = await call('user.ratedList', { activeOnly: true, includeRetired: false });
    const all = res.filter((u) => typeof u.rating === 'number').sort((a, b) => b.rating - a.rating);
    const out = { at: Date.now(), top: all.slice(0, 100).map((u) => [u.handle, u.rating, u.maxRating || u.rating, u.titlePhoto || u.avatar || '', u.country || '']), ratings: all.map((u) => u.rating) };
    await set({ cfmRated: out });
    return out;
  }
  /* the Gym (contest.list?gym=true) once a day, compact: [[id, name, difficulty 0-5, type, season, country, city, preparedBy,
     durationSec, startSec], ...], newest first */
  async function gyms() {
    const c = await get('cfmGyms');
    if (c && Date.now() - c.at < DAY && Array.isArray(c.rows) && c.rows.length) return c.rows;
    const res = await call('contest.list', { gym: true });
    const rows = res.map((x) => [x.id, x.name, x.difficulty || 0, x.type || '', x.season || '', x.country || '', x.city || '', x.preparedBy || '', x.durationSeconds || 0, x.startTimeSeconds || 0]).sort((a, b) => b[0] - a[0]);
    await set({ cfmGyms: { at: Date.now(), rows } });
    return rows;
  }
  /* the Friends page and the profile's Following list: user.info for every handle shown, 100 handles a call, each kept an
     hour (cfmPeople, the 800 seen last). Rows: [handle, rating, maxRating, photo, lastOnline, country, city, org, first, last, contribution, followers] */
  async function people(handles) {
    const all = (await get('cfmPeople')) || {}, key = (h) => h.toLowerCase();
    const need = [...new Set(handles)].filter((h) => !(all[key(h)] && Date.now() - all[key(h)].at < HOUR));
    for (let i = 0; i < need.length; i += 100) {
      for (const u of await call('user.info', { handles: need.slice(i, i + 100).join(';') })) {
        all[key(u.handle)] = { at: Date.now(), d: [u.handle, u.rating == null ? null : u.rating, u.maxRating == null ? null : u.maxRating, u.titlePhoto || u.avatar || '', u.lastOnlineTimeSeconds || 0,
          u.country || '', u.city || '', u.organization || '', u.firstName || '', u.lastName || '', u.contribution || 0, u.friendOfCount || 0] };
      }
    }
    const ids = Object.keys(all).sort((a, b) => all[a].at - all[b].at); while (ids.length > 800) delete all[ids.shift()];
    if (need.length) await set({ cfmPeople: all });
    return handles.map((h) => all[key(h)]).filter(Boolean).map((x) => x.d);
  }
  globalThis.CFM_API = { call, problems, problemRow, statusRows, latest, pack, blog, comments, users, contestInfo, upcoming, contestList, ratingOf, userInfo, statusOf, rated, gyms, people, log: () => LOG.slice() };
})();
