/* The Anime Studio preview frame. Adapted from Theme Studio for LeetCode
   (src/anime/preview.js); changes marked CF:.

   The Studio calls CFTSPreview.apply() with a solved scene; the role block is
   the same css.js + cf-block.js output anime.js injects on Codeforces.
   CF: the page's own stylesheets are the content scripts' (core, icons,
   guided, anime, fx). Extension pages do not substitute
   __MSG_@@extension_id__ in stylesheet URLs, so they are fetched and inserted
   with this extension's origin written in. */
(function () {
  'use strict';
  const SHEETS = ['themes/core.css', 'themes/icons.css', 'themes/guided.css', 'themes/anime.css', 'themes/fx.css', 'themes/anime-app.css'];
  const ORIGIN = chrome.runtime.getURL('');
  const ready = Promise.all(SHEETS.map((p) => fetch(chrome.runtime.getURL(p)).then((r) => r.text()))).then((texts) => {
    const st = document.createElement('style');
    st.id = 'cfts-preview-sheets';
    /* CF: the Firefox build's sheets carry relative "../" URLs instead (scripts/package.py);
       from this frame (src/anime/) they would miss the extension's root */
    st.textContent = texts.join('\n').replace(/chrome-extension:\/\/__MSG_@@extension_id__\//g, ORIGIN).replace(/url\(("?)\.\.\//g, 'url($1' + ORIGIN);
    document.head.insertBefore(st, document.head.firstChild);
  });

  let roleStyle = null;
  /* id: scene id or 'custom'; urls: { wall, blur } */
  function apply(id, theme, urls, glass, name) {
    if (!roleStyle) { roleStyle = document.createElement('style'); document.head.appendChild(roleStyle); }
    const mote = chrome.runtime.getURL(globalThis.CFTSAnimeBlock.petals(id) ? 'icons/ui/petals.svg' : 'icons/ui/motes.svg');
    roleStyle.textContent = globalThis.CFTSAnimeBlock.build(id, theme, { wall: urls.wall, blur: urls.blur, mote }, glass, name);
    document.documentElement.setAttribute('data-cf-mode', theme.mode === 'light' ? 'light' : 'dark');
    globalThis.__lctsAnimeScene = { wall: urls.wall };   // the broadcast plays in this scene, as it does on Codeforces
  }

  /* CF: the problem shown follows the difficulty slot being edited: a rated
     problem of that arc (its badge, 危険度 and arc chip), or an unrated one for
     "every other page" (Codeforces rates problems days after the round) */
  const SLOTS = {
    easy:   { r: 1100, col: 'gray', word: 'Easy', dz: 1, arc: ['日常編', 'rated up to 1300', '50% 58%'] },
    medium: { r: 1700, col: 'blue', word: 'Medium', dz: 3, arc: ['修行編', 'rated 1400–2300', '50% 32%'] },
    hard:   { r: 2600, col: 'red', word: 'Very hard', dz: 5, arc: ['最終決戦', 'rated 2400 and up', '50% 30%'] },
  };
  function slot(d) {
    const s = SLOTS[d], $ = (id) => document.getElementById(id);
    $('pvArc').hidden = !s; $('pvDanger').hidden = !s;
    const rate = $('pvRate');
    if (!s) {
      rate.className = 'cfts-rate none'; rate.removeAttribute('style');
      rate.innerHTML = '<span class="n">Not rated yet</span>';
      $('pvHeader').style.removeProperty('--cfts-pos');
      return;
    }
    rate.className = 'cfts-rate';
    rate.style.setProperty('--c', `var(--cf-rank-${s.col})`);
    rate.innerHTML = `<span class="n">${s.r}</span><span class="w">${s.word}</span>`;
    $('pvArcJp').textContent = s.arc[0]; $('pvArcEn').textContent = s.arc[1];
    $('pvHeader').style.setProperty('--cfts-pos', s.arc[2]);
    const dg = $('pvDanger').querySelector('.cfts-danger');
    dg.style.setProperty('--c', `var(--cf-rank-${s.col})`);
    dg.querySelector('.m').innerHTML = '<i class="on"></i>'.repeat(s.dz) + '<i></i>'.repeat(5 - s.dz);
    dg.querySelector('.n').textContent = s.dz + '/5';
  }

  /* Japanese text: the moments' words (the page's own labels stay) */
  function japanese(on) { if (globalThis.CFTSFx) globalThis.CFTSFx.setJapanese(on !== false); }

  /* The buttons play the real thing: onair.js, sakuga.js and manga.js in this frame, with made-up
     data for the problem on show. Level up is cf-fx.js's, as on Codeforces. `sound` plays a cue */
  const TEXT = { wa: 'Wrong answer on test 37', tle: 'Time limit exceeded on test 12', mle: 'Memory limit exceeded on test 9', err: 'Runtime error on test 4', ce: 'Compilation error', pretests: 'Pretests passed', ac: 'Accepted' };
  const CAST = { easy: ['日常編', 'Kappa', '河', 'green', 1100, 0], medium: ['修行編', 'Tengu', '天', 'blue', 1700, 1], hard: ['最終決戦', 'Ryū', '龍', 'red', 2600, 3], other: ['日常編', 'Unknown rival', '謎', 'gray', 0, 0] };
  const TECH = [['一閃', 'Issen', 'One Flash'], ['連撃', 'Rengeki', 'Flurry'], ['雷神', 'Raijin', 'Thunder God'], ['奥義', 'Ōgi', 'Final Art']];
  const ep = { tag: '1950C', name: 'Paper Lanterns', jp: '', seal: '', rival: '', ink: '#fff', rating: 0, memKb: 262144 };
  const hero = (pose) => chrome.runtime.getURL(`textures/anime/cast/hero-${pose}.webp`);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const j = {
    make(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; },
    insert(node, parent, before) { parent.insertBefore(node, before || null); },
    on(el, type, fn) { el.addEventListener(type, fn); },
  };
  let air = null, cue = () => {}, land = 0, run = [], turn = 0;
  function director() {
    if (air) return air;
    const stand = hero('stand'), strike = hero('strike');
    const tick = j.make('<button hidden><span></span></button>');
    air = globalThis.__cftsAnimeOnAir.build({ j, app: document.body, tick, ep, onVerdict() {},
      art: { wall: globalThis.__lctsAnimeScene.wall, calm: globalThis.__lctsAnimeScene.wall, stand, strike, down: hero('down') },
      page: () => ({ land, wall: globalThis.__lctsAnimeScene.wall, stand, strike, seal: ep.seal, rival: ep.rival, ink: ep.ink, accent: css('--cf-accent'), tech: TECH[land], handle: 'You', name: ep.name, limitMs: 2000, limitKb: 262144 }) });
    air.bindSound((s) => cue(s));
    return air;
  }
  const scene = (kind) => air.verdict(kind, { text: TEXT[kind], n: 12, time: kind === 'tle' ? '2000 ms' : '187 ms', mem: kind === 'mle' ? '262144 KB' : '4100 KB' },
    { first: false, tries: 1, editorPaint: (go) => go(null) });
  function play(name, d, sound) {
    cue = sound || (() => {});
    run.splice(0).forEach(clearTimeout);
    /* a print still on screen makes way first: its end hook would close whatever had started */
    if (document.getElementById('am-page')) {
      const me = ++turn;
      document.addEventListener('am:finish-done', () => setTimeout(() => { if (me === turn) start(name, d); }), { once: true });
      dispatchEvent(new KeyboardEvent('keydown'));
      return;
    }
    turn++;
    start(name, d);
  }
  function start(name, d) {
    const FX = globalThis.CFTSFx;
    if (air) air.clear();
    if (name === 'levelup') {
      const r = FX.levelup({ handle: 'You', oldRating: 1584, newRating: 1652, col: 'blue', oldCol: 'cyan', rank: 'Expert', oldRank: 'Specialist', rankChange: 'Specialist → Expert', contest: 'A made-up round' });
      if (r) cue(r.sound);
      return;
    }
    const [jp, rival, seal, col, rating, arc] = CAST[d] || CAST.medium;
    Object.assign(ep, { jp, rival, seal, rating, ink: css(`--cf-rank-${col}`) || '#fff' });
    land = arc;
    director();
    if (name === 'title') air.coldOpen();
    else if (name === 'run') {
      air.sending(true);
      for (let k = 1; k <= 7; k++) run.push(setTimeout(() => air.test(k, 7), 1050 + k * 420));
      run.push(setTimeout(() => scene('ac'), 4400));
    } else scene(name);
  }

  window.CFTSPreview = { ready, apply, slot, japanese, play };
})();
