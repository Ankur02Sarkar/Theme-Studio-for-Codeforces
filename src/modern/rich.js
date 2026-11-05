/* =============================================================================
   rich.js  (isolated world)   MODERN.md M2c: the Editorial and Discussion tabs.
   - Editorial: the round's Tutorial entry (blogEntry.view, linked from "Contest materials"), cut down to THIS problem's section
     (from the link to this problem up to the next problem's link; the whole entry with a note when there is no per-problem link).
     Spoilers become collapsible blocks. The Tutorial text itself is not in the entry: ONE POST /data/problemTutorial for this
     problem, made when its block opens (the page's own call, via bridge.js). On an UNSOLVED problem every block starts collapsed
     with "Show"; on a solved one they start open.
   - Discussion: comments of the Announcement and the Tutorial entries (blogEntry.comments), threaded by parentCommentId, sorted by
     votes or newest, filtered by default to the ones about this problem; handles coloured by ONE user.info batch (plain until
     it answers, or if it fails). On an unsolved problem: "Comments may contain spoilers." Read-only: replies happen on Codeforces.
   - EVERY HTML string from Codeforces goes through cfmSanitize (DOMPurify, sanitize.js) before it touches the page.
   - The content lives in the LIGHT DOM (#cfm-rich, slotted into the pane) so MathJax's document styles apply; MathJax is asked
     to typeset it through the MAIN-world bridge ("cfm:typeset").
============================================================================= */
(() => {
  'use strict';
  const CFM = globalThis.CFM; if (!CFM) return;
  CFM.state = CFM.state || {};
  let c = null, R = null;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));
  const san = (h) => (globalThis.cfmSanitize ? globalThis.cfmSanitize(h) : '');
  const text = (h) => { const d = document.createElement('div'); d.innerHTML = san(h); return d.textContent.replace(/\s+/g, ' ').trim(); };
  const fmtDate = (sec) => new Date(sec * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const typeset = () => { clearTimeout(R && R.tsT); if (R) R.tsT = setTimeout(() => document.dispatchEvent(new CustomEvent('cfm:typeset', { detail: 'cfm-rich' })), 30); };
  const solved = () => CFM.state.solved === true;
  const rankClass = (rating) => (rating == null ? '' : 'cfm-rk-' + c.rankOf(rating));

  function mount(ctx) {
    c = ctx;
    const rich = document.createElement('div'); rich.id = 'cfm-rich'; rich.className = 'cfm-rich'; rich.setAttribute('slot', 'rich');
    c.app.host.appendChild(rich);
    const links = [...document.querySelectorAll('#sidebar .sidebar-menu li a[href*="/blog/entry/"]')].map((a) => {
      const m = /\/blog\/entry\/(\d+)/.exec(a.getAttribute('href') || ''); const label = a.textContent.replace(/\s+/g, ' ').trim();
      return m ? { id: +m[1], label, kind: /tutorial|editorial|solution|разбор/i.test(label) ? 'tut' : /announce|анонс/i.test(label) ? 'ann' : 'other' } : null;
    }).filter(Boolean);
    R = { rich, links, tab: '', ed: null, tutWait: {}, tutSeq: 0, disc: null, sort: 'votes', filter: 'about', shown: 30, tsT: 0 };
    rich.addEventListener('click', onClick);
    R.onTut = (e) => { try { const m = JSON.parse(e.detail); const w = R && R.tutWait[m.id]; if (w) { delete R.tutWait[m.id]; w(m); } } catch (x) { /* not ours */ } };
    document.addEventListener('cfm:tut-state', R.onTut);
  }
  function unmount() { if (R) { document.removeEventListener('cfm:tut-state', R.onTut); clearTimeout(R.tsT); } R = null; c = null; }
  const tutLink = () => R.links.find((l) => l.kind === 'tut'), annLink = () => R.links.find((l) => l.kind === 'ann');
  const blogHref = (id) => `/blog/entry/${id}`;
  const A = (href, t) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`;
  const empty = (title, msg) => `<div class="cfm-empty"><b>${esc(title)}</b>${msg}</div>`;
  const spin = (t) => `<div class="cfm-spin"><i></i><span>${esc(t)}</span></div>`;

  /* ---- Editorial -------------------------------------------------------------------------------------------------- */
  function sectionFor(html, cid, idx) {
    const doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    let root = doc.getElementById('r');
    /* entries wrap everything in one <div class="ttypography">: the headings are its children, so cut inside the wrapper */
    while (root.children.length === 1 && root.firstElementChild.tagName === 'DIV') root = root.firstElementChild;
    const here = new RegExp(`/(?:contest|gym|problemset/problem)/${cid}/(?:problem/)?${idx}(?![A-Za-z0-9])`);
    const any = /\/(?:contest|gym|problemset\/problem)\/\d+\/(?:problem\/)?[A-Z][0-9]?(?![A-Za-z0-9])/;
    const hrefs = (n) => [...(n.matches && n.matches('a[href]') ? [n] : []), ...n.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') || '');
    const start = [...root.querySelectorAll('a[href]')].find((a) => here.test(a.getAttribute('href') || ''));
    if (!start) return null;
    let top = start; while (top.parentElement && top.parentElement !== root) top = top.parentElement;
    const out = [top];
    for (let n = top.nextElementSibling; n; n = n.nextElementSibling) {
      if (hrefs(n).some((h) => any.test(h) && !here.test(h))) break;   // the next problem's heading
      out.push(n);
    }
    return out.map((n) => n.outerHTML).join('');
  }
  function foldsFrom(div, open) {
    div.querySelectorAll('.spoiler').forEach((sp) => {
      const title = ((sp.querySelector('.spoiler-title') || {}).textContent || 'Show').trim();
      const content = sp.querySelector('.spoiler-content');
      const fold = document.createElement('div'); fold.className = 'cfm-fold'; fold.setAttribute('data-open', open ? '1' : '0');
      fold.innerHTML = `<button type="button" class="cfm-fh" aria-expanded="${open}"><i class="chev"></i><span class="t">${esc(title)}</span><span class="cfm-show">${open ? 'Hide' : 'Show'}</span></button><div class="cfm-fb"${open ? '' : ' hidden'}></div>`;
      if (content) fold.querySelector('.cfm-fb').append(...content.childNodes);
      sp.replaceWith(fold);
    });
  }
  async function renderEditorial() {
    const rich = R.rich, t = tutLink();
    if (!t) {
      const a = annLink();
      rich.innerHTML = empty('No editorial linked yet', `Codeforces shows no tutorial in this round's materials.${a ? ' Check ' + A(blogHref(a.id), 'the round announcement') + ' for one later.' : ''}`);
      return;
    }
    rich.innerHTML = spin('Loading the editorial…');
    const tab = R.tab;
    let b;
    try { b = await globalThis.CFM_API.blog(t.id); } catch (e) { if (R && R.tab === tab) rich.innerHTML = empty("Couldn't load the editorial", `Codeforces' API did not answer (${esc(e.message)}). ${A(blogHref(t.id), 'Open it on Codeforces')}.`); return; }
    if (!R || R.tab !== 'edit') return;
    const sec = sectionFor(b.content, c.CID, c.IDX);
    const whole = !sec, open = false;   // hints, tutorial and solution always start closed: shown only when asked
    const div = document.createElement('div'); div.innerHTML = san(sec || b.content);
    foldsFrom(div, open);
    const note = solved() ? "Posted by the round's authors on Codeforces. Hints and solutions stay folded until you open them."
      : 'Hints, Tutorial and Solution are hidden because you have not solved this problem yet. Show them when you are ready.';
    rich.innerHTML = `<div class="cfm-ed" data-m="editorial"><div class="cfm-ttl">${esc(text(b.title))}</div><div class="cfm-by"><span>${esc(b.author)}</span><span>· ${esc(fmtDate(b.at))}</span></div>
      ${whole ? `<div class="cfm-hint">This entry has no section for problem ${esc(c.IDX)}, so the whole editorial is shown. ${A(blogHref(t.id), 'Open it on Codeforces')}.</div>` : ''}
      <div class="cfm-body"></div><div class="cfm-note">${esc(note)}</div></div>`;
    rich.querySelector('.cfm-body').append(...div.childNodes);
    rich.querySelectorAll('.cfm-fold[data-open="1"] .problemTutorial[problemcode]').forEach(loadTutorial);
    typeset();
  }
  function loadTutorial(ph) {
    if (!R || ph.getAttribute('data-state')) return;
    ph.setAttribute('data-state', 'loading'); ph.textContent = 'Loading the tutorial…';
    const id = 't' + (++R.tutSeq), code = ph.getAttribute('problemcode');
    const to = setTimeout(() => { if (R && R.tutWait[id]) { delete R.tutWait[id]; ph.setAttribute('data-state', 'none'); ph.textContent = "The tutorial didn't load. Try again by closing and opening this block."; } }, 20000);
    R.tutWait[id] = (m) => {
      clearTimeout(to);
      const d = m.ok && m.data;
      if (!d || String(d.success) !== 'true' || !d.html) { ph.setAttribute('data-state', 'none'); ph.textContent = m.ok ? 'Codeforces has no tutorial text for this problem yet.' : `The tutorial didn't load (${m.error || 'no answer'}).`; return; }
      ph.setAttribute('data-state', 'ok'); ph.innerHTML = san(d.html) + (String(d.public) === 'false' ? '<p class="cfm-hint">Codeforces marks this tutorial as not public yet.</p>' : '');
      typeset();
    };
    document.dispatchEvent(new CustomEvent('cfm:tut', { detail: JSON.stringify({ id, problemCode: code }) }));
  }

  /* ---- Discussion ---------------------------------------------------------------------------------------------------- */
  function aboutRe() {
    const i = c.IDX.replace(/[^A-Za-z0-9]/g, '');
    /* the bare letter ("B:", "B was") only in its own case: case-insensitive, "b)" in any snippet of code matched */
    const loose = new RegExp(`(?:\\b${c.CID}${i}\\b|\\bproblem\\s+${i}\\b|\\bQ-${i}\\b)`, 'i');
    const exact = new RegExp(`(?:\\b${i}\\s*[-:)]|\\b${i}\\s+(?:problem|solution|was|is|can|could|took))`);
    return { test: (s) => loose.test(s) || exact.test(s) };
  }
  async function renderDiscussion() {
    const rich = R.rich, ids = [tutLink(), annLink()].filter(Boolean).map((x) => x.id);
    if (!ids.length) { rich.innerHTML = empty('No discussion linked', 'Codeforces shows no announcement or tutorial for this round, so there are no comments to read here.'); return; }
    rich.innerHTML = spin('Loading the comments…');
    let all = [];
    try { for (const id of ids) { const cs = await globalThis.CFM_API.comments(id); if (!R || R.tab !== 'disc') return; all = all.concat(cs.map((x) => Object.assign({ src: id }, x))); } }
    catch (e) { if (R && R.tab === 'disc') rich.innerHTML = empty("Couldn't load the comments", `Codeforces' API did not answer (${esc(e.message)}). ${ids.map((id) => A(blogHref(id), 'Open the blog entry')).join(' · ')}.`); return; }
    const byId = new Map(all.map((x) => [x.id, x])), kids = new Map();
    for (const x of all) { if (x.parent && byId.has(x.parent)) { (kids.get(x.parent) || kids.set(x.parent, []).get(x.parent)).push(x); } }
    const roots = all.filter((x) => !x.parent || !byId.has(x.parent));
    const thread = (r) => { const out = [], walk = (n, d) => { out.push({ n, d: Math.min(d, 3) }); (kids.get(n.id) || []).sort((a, b) => a.at - b.at).forEach((k) => walk(k, d + 1)); }; walk(r, 0); return out; };
    const re = aboutRe();
    const plain = (x) => x.text.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, ' ').replace(/<[^>]+>/g, ' ');
    R.disc = { roots: roots.map((r) => { const th = thread(r); return { r, th, about: th.some((e) => re.test(plain(e.n))) }; }), total: all.length };
    drawDiscussion();
  }
  function drawDiscussion() {
    const D = R.disc, rich = R.rich;
    const nAbout = D.roots.filter((x) => x.about).length;
    let list = D.roots.filter((x) => R.filter === 'all' || x.about);
    list = list.slice().sort(R.sort === 'new' ? (a, b) => b.r.at - a.r.at : (a, b) => (b.r.up - a.r.up) || (b.r.at - a.r.at));
    const shown = list.slice(0, R.shown);
    const cm = ({ n, d }) => `<div class="cfm-cm d${d}"><span class="av">${esc((n.who[0] || '?').toUpperCase())}</span><div class="bd"><div class="mt"><b class="h" data-h="${esc(n.who)}">${esc(n.who)}</b><span>${esc(fmtDate(n.at))}</span></div><div class="tx">${san(n.text)}</div><div class="vt"><span>▲ ${n.up}</span>${A(`${blogHref(n.src)}#comment-${n.id}`, 'Reply on Codeforces')}</div></div></div>`;
    rich.innerHTML = `<div class="cfm-disc" data-m="discussion">
      ${solved() ? '' : '<div class="cfm-spoil">Comments may contain spoilers.</div>'}
      <div class="cfm-tool"><button type="button" class="cfm-chip${R.filter === 'about' ? ' on' : ''}" data-filter="about">About problem ${esc(c.IDX)} <span>${nAbout}</span></button><button type="button" class="cfm-chip${R.filter === 'all' ? ' on' : ''}" data-filter="all">All <span>${D.roots.length}</span></button><span class="sp"></span>
        <button type="button" class="cfm-sort${R.sort === 'votes' ? ' on' : ''}" data-sort="votes">Most votes</button><button type="button" class="cfm-sort${R.sort === 'new' ? ' on' : ''}" data-sort="new">Newest</button></div>
      ${shown.length ? shown.map((x) => `<div class="cfm-thread">${x.th.map(cm).join('')}</div>`).join('') : `<div class="cfm-empty"><b>${R.filter === 'about' ? 'Nothing about this problem yet' : 'No comments'}</b>${R.filter === 'about' ? 'Try “All” to read every comment on the round.' : ''}</div>`}
      ${list.length > shown.length ? `<button type="button" class="cfm-more" data-more="1">Show ${Math.min(30, list.length - shown.length)} more</button>` : ''}
      <div class="cfm-note">Comments from the round's announcement and editorial. Read-only: reply on Codeforces.</div></div>`;
    /* a comment can embed a tutorial ([tutorial:2259B]); Codeforces' own script fills it in, so here it said "loading" for ever */
    rich.querySelectorAll('.cfm-cm .problemTutorial').forEach((t) => {
      const p = document.createElement('p'); p.className = 'cfm-hint';
      p.textContent = `(Embedded tutorial for ${t.getAttribute('problemcode') || 'a problem'}: see the Editorial tab, or open the comment on Codeforces.)`;
      t.replaceWith(p);
    });
    rich.querySelectorAll('.cfm-cm .tx').forEach((tx) => foldsFrom(tx, false));   // comment spoilers start closed, as on Codeforces
    colourHandles(shown.flatMap((x) => x.th.map((e) => e.n.who)));
    typeset();
  }
  async function colourHandles(handles) {
    const uniq = [...new Set(handles)];
    if (!uniq.length || !globalThis.CFM_API) return;
    let users; try { users = await globalThis.CFM_API.users(uniq); } catch (e) { return; }   // plain handles are fine
    if (!R) return;
    R.rich.querySelectorAll('[data-h]').forEach((el) => { const u = users[el.getAttribute('data-h')]; const k = u && rankClass(u.rating); if (k) el.classList.add(k); });
  }

  function onClick(e) {
    const t = e.target;
    const fh = t.closest && t.closest('.cfm-fh');
    if (fh) {
      const fold = fh.parentElement, open = fold.getAttribute('data-open') !== '1';
      fold.setAttribute('data-open', open ? '1' : '0'); fh.setAttribute('aria-expanded', open); fold.querySelector('.cfm-fb').hidden = !open; fh.querySelector('.cfm-show').textContent = open ? 'Hide' : 'Show';
      if (open) { fold.querySelectorAll('.problemTutorial[problemcode]').forEach(loadTutorial); typeset(); }
      return;
    }
    const f = t.closest && t.closest('[data-filter]'); if (f) { R.filter = f.getAttribute('data-filter'); R.shown = 30; return drawDiscussion(); }
    const s = t.closest && t.closest('[data-sort]'); if (s) { R.sort = s.getAttribute('data-sort'); return drawDiscussion(); }
    if (t.closest && t.closest('[data-more]')) { R.shown += 30; return drawDiscussion(); }
  }

  CFM.debug = CFM.debug || {};
  CFM.debug.rich = () => {
    if (!R) return null;
    const folds = [...R.rich.querySelectorAll('.cfm-fold')].map((f) => f.querySelector('.t').textContent + ':' + (f.getAttribute('data-open') === '1' ? 'open' : 'collapsed'));
    const tuts = [...R.rich.querySelectorAll('.problemTutorial')].map((t) => t.getAttribute('data-state') || 'not requested');
    return { tab: R.tab, materials: R.links.map((l) => l.kind + ':' + l.id + ' "' + l.label + '"'), folds, tutorial: tuts, solvedRule: solved() ? 'solved: open' : 'unsolved: collapsed',
      discussion: R.disc ? { threads: R.disc.roots.length, aboutThisProblem: R.disc.roots.filter((x) => x.about).length, comments: R.disc.total, filter: R.filter, sort: R.sort } : null,
      handles: { total: R.rich.querySelectorAll('[data-h]').length, coloured: R.rich.querySelectorAll('[data-h][class*="cfm-rk-"]').length },
      math: { rendered: R.rich.querySelectorAll('.MathJax, .MathJax_Preview').length, rawDollarMarks: (R.rich.textContent.match(/\$\$\$/g) || []).length } };
  };

  CFM.use({
    mount, unmount,
    pane(k, el) {
      if (!R || (k !== 'edit' && k !== 'disc')) { if (R) R.tab = k; return false; }
      R.tab = k; el.innerHTML = '<slot name="rich"></slot>';
      if (k === 'edit') renderEditorial(); else if (R.disc) drawDiscussion(); else renderDiscussion();
      return true;
    },
    /* the Solved state arrived (or changed): spoiler rules and notices follow it */
    status() { if (R && c.app.sh.querySelector('[data-tab="edit"].on')) renderEditorial(); else if (R && R.disc && c.app.sh.querySelector('[data-tab="disc"].on')) drawDiscussion(); },
  });
})();
