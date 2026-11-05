/* =============================================================================
   anime/home.js  (content script)   the channel's front page: / (ANIME.md)
   What's on next with a live clock, the episodes you left unfinished, then the news: Codeforces' posts as readable cards, a round's
   announcement carrying its division and poster. Every link and the side column are Codeforces' own; a page without posts stays its own.
============================================================================= */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TIER = { div4: 1, div3: 2, div2: 3, edu: 3, all: 5, div1: 6 };
  /* prose with its maths: no rendered copies, $ signs off (CLAUDE.md, reading prose with maths) */
  function excerpt(topic) {
    const box = topic.querySelector('.ttypography');
    if (!box) return '';
    const k = box.cloneNode(true);
    k.querySelectorAll('.MathJax, .MathJax_Preview, .MathJax_Display, script, style, img, table, pre, .spoiler').forEach((n) => n.remove());
    k.querySelectorAll('p, div, li').forEach((n) => n.append(' '));
    return k.textContent.replace(/\${1,3}/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  }
  const clockOf = (el) => { const t = el && (el.querySelector('[title]') ? el.querySelector('[title]').getAttribute('title') : el.textContent), m = /^(\d+):(\d\d):(\d\d)$/.exec((t || '').trim()); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null; };
  function build({ j, kit, me, K, heroUrl, shelf, chip, posterAt }) {
    const k = K(), R = globalThis.__cftsPixelRaids;
    const topics = [...document.querySelectorAll('#pageContent .topic')].filter((t) => t.querySelector('.title a'));
    if (!topics.length) return false;
    const box = [...document.querySelectorAll('#sidebar > .roundbox')].find((b) => b.querySelector('.contest-state-phase'));
    const nx = box && [...box.querySelectorAll('a')].find((a) => /^\/contests?\/\d+/.test(a.getAttribute('href') || ''));
    const reg = box && box.querySelector('a[href^="/contestRegistration/"]');
    const secs = box ? clockOf(box.querySelector('.countdown')) : null;
    const app = j.make('<div id="am-root" class="am-home"></div>');
    const key = j.make(`<section class="am-key short"><div class="am-keyart" style="background-image:var(--cf-scene-wall)"></div><img class="am-keyhero" src="${heroUrl('strike')}" alt="" draggable="false">
      <div class="am-keytext"><h1>${me.handle ? `Welcome back, <span style="color:var(--me-ink)">${esc(me.handle)}</span>` : 'Every programmer is the lead of a series'}</h1>
        <p class="lede">${me.handle ? 'Your series is on air. Pick up the next episode.' : 'Solve problems, climb the ranks, and watch your own story unfold.'}</p>
        <div class="am-next"><a class="am-btn hot big" href="/problemset">Next episode</a><a class="am-btn big" href="/contests">Schedule</a></div></div>
      ${nx ? `<div class="am-onnext"><b class="jp" aria-hidden="true">次回予告</b><a class="nm" href="${esc(nx.getAttribute('href'))}">${esc(nx.textContent.trim())}</a><div class="dig"></div>${reg ? `<a class="am-btn hot sm" href="${esc(reg.getAttribute('href'))}">Register</a>` : ''}</div>` : ''}</section>`);
    j.insert(key, app);
    if (nx && secs != null) { const end = Date.now() + secs * 1000, d = key.querySelector('.dig'), tick = () => { d.textContent = R.clock(Math.max(0, Math.round((end - Date.now()) / 1000))); }; tick(); j.every(tick, 1000); }
    const cols = j.make('<div class="am-cols"><main class="am-news"><section class="am-shelf" hidden></section><h2><b class="jp" aria-hidden="true">お知らせ</b>News</h2><div class="posts"></div><div class="am-pages"></div></main><aside class="am-side"></aside></div>');
    j.insert(cols, app);
    shelf(j, cols.querySelector('.am-shelf'));
    const posts = cols.querySelector('.posts');
    for (const t of topics) {
      const a = t.querySelector('.title a'), name = a.textContent.trim(), href = a.getAttribute('href');
      const round = /round|раунд|educational/i.test(name) && kit.division(name);
      const who = [...t.querySelectorAll('.info a.rated-user, .info a[href^="/profile/"]')][0];
      const when = t.querySelector('.format-humantime, .format-date, .format-time');
      const meta = t.nextElementSibling && t.nextElementSibling.matches('.roundbox') ? t.nextElementSibling : t;
      const rate = meta.querySelector('.topic-rating'), talk = [...meta.querySelectorAll('a')].find((x) => /#comments/.test(x.getAttribute('href') || ''));
      const n = talk ? talk.textContent.replace(/\D/g, '') : '';
      const card = j.make(`<article class="am-post${round ? ' on' : ''}" data-href="${esc(href)}">${round ? `<i class="am-still" style="${posterAt(TIER[round], +(/\d+/.exec(name) || [0])[0])}"></i>` : ''}
        <div class="b">${round ? chip(kit, round) : ''}<h3><a href="${esc(href)}">${esc(name)}</a></h3>
        <p class="ex">${esc(excerpt(t))}</p>
        <div class="m">${who ? `<a class="${esc(who.className)}" href="${esc(who.getAttribute('href'))}">${esc(who.textContent)}</a>` : ''}<span class="w"></span>${rate ? `<span class="r">${esc(rate.textContent.trim())}</span>` : ''}${talk ? `<a href="${esc(talk.getAttribute('href'))}">${n || 0} comments</a>` : ''}</div></div></article>`);
      if (when) j.move(when, card.querySelector('.w'));
      posts.append(card);
    }
    j.on(posts, 'click', (e) => { if (e.target.closest('a')) return; const c = e.target.closest('.am-post'); if (c) location.href = c.dataset.href; });
    const pg = document.querySelector('#pageContent .pagination');
    if (pg) j.move(pg, cols.querySelector('.am-pages'));
    if (box) j.cls(box, 'am-hide');
    k.side(j, cols.querySelector('.am-side'));
    k.foot(j, app);
    j.insert(app, document.body, document.getElementById('body'));
    return true;
  }
  globalThis.__cftsAnimeHome = { build };
})();
