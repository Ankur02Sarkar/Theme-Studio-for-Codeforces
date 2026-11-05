/* =============================================================================
   studio.js — Anime Studio. Adapted from Theme Studio for LeetCode
   (src/studio.js); changes marked CF:.

   Every change re-solves the scene here, previews it, and saves the solved
   result. Codeforces tabs then only read storage; they never decode, resize
   or solve anything themselves (src/anime/anime.js).

   CF: two solves per scene. The sister's solver (solver.js) gives the prose
   glass and every role; cf-solve.js then solves the DENSE glass where rating
   colours live (red #ff6464 at 4.5:1 over the picture's 99.9th-percentile
   pixel), the same rule scripts/build-cf-glass.mjs runs for the bundled
   scenes. CF Phase 6: Glass is Dark (the default, and every bundled scene's
   solve), Light (the light rank set, solved by cf-solve.js mode 'light': its
   lightest ink over the picture's darkest 0.1%) or Auto (the sister's rule:
   light when the picture's mean luminance is 0.42 or more).

   STORAGE (written here, read by anime.js, the popup and cf-moments.js)
     cfAnime     { scene, byDifficulty, arcs, glass, visibility, themes, dense, japanese }
     cfAnimeArt  { wall, blur, name } data URLs of your own picture
     cfMoments   { titleCard, verdicts, levelUp, sound, volume, ... } (shared with the popup)
     cfShare     { enabled }
============================================================================= */
(() => {
  'use strict';

  const SCENES = globalThis.LCTS_SCENES, DEF = globalThis.LCTS_SCENE_DEFAULT;
  const ARC = globalThis.LCTS_ARC_DEFAULT || { easy: DEF, medium: DEF, hard: DEF };
  /* CF: four places a scene shows: every page that is not a rated problem, and
     the three arcs (anime.js: up to 1300, 1400-2300, 2400 and up) */
  const SLOTS = [['other', 'Every page', ''], ['easy', 'Up to 1300', '日常編'], ['medium', '1400–2300', '修行編'], ['hard', '2400+', '最終決戦']];
  const Solver = globalThis.LCTSAnimeSolver, Proc = globalThis.LCTSAnimeProcess, Dense = globalThis.CFTSDense;
  const $ = (id) => document.getElementById(id);
  const MAX_INPUT = 30 * 1024 * 1024;
  const MO_DEFAULTS = { titleCard: true, verdicts: true, liveVerdicts: false, levelUp: true, sound: true, volume: 1 };

  const settings = { scene: DEF, byDifficulty: true, arcs: {}, glass: 'dark', visibility: 0.85, japanese: true };
  let moments = Object.assign({}, MO_DEFAULTS);
  let slot = 'other';           // the slot being edited while byDifficulty is on: Every page first, or a pick seems to change nothing
  let justSet = null;           // the scene just given to `slot`, for the confirmation line
  const preparedCache = {};     // scene id -> samples + blobs + 640 px pixels
  let themes = {}, denses = {}; // scene id -> solve / dense glass at the current settings

  const arcScene = (d) => (SCENES[settings.arcs[d]] ? settings.arcs[d] : ARC[d]);
  const slotScene = (d) => (d === 'other' ? (SCENES[settings.scene] ? settings.scene : DEF) : arcScene(d));
  /* which scene the preview shows (and a gallery click changes) */
  const viewId = () => settings.scene === 'custom' ? 'custom' : (settings.byDifficulty ? slotScene(slot) : slotScene('other'));
  /* the problem the preview shows: the slot's own, or a mid-rated one */
  const viewSlot = () => (settings.scene === 'custom' || !settings.byDifficulty) ? 'medium' : slot;
  /* every scene Codeforces may show with the current settings */
  const neededIds = () => settings.scene === 'custom' ? ['custom']
    : settings.byDifficulty ? [...new Set(SLOTS.map(([d]) => slotScene(d)))] : [slotScene('other')];
  let prepared = null, theme = null, glass = null;
  let previewUrls = null;
  let hasArt = false, customThumb = null;

  /* ---- preview frame --------------------------------------------------------- */
  const frame = $('frame');
  /* Poll for the preview's API rather than wait for the iframe's load event:
     that event can fire before this script attaches a listener. */
  const frameReady = new Promise((res) => {
    const check = () => {
      let w = null;
      try { w = frame.contentWindow; } catch (e) {}
      if (w && w.CFTSPreview && w.document.readyState !== 'loading') w.CFTSPreview.ready.then(res);
      else setTimeout(check, 40);
    };
    check();
  });
  function fitFrame() {
    const box = $('frameBox');
    frame.style.transform = `scale(${box.clientWidth / 1280})`;
  }
  new ResizeObserver(fitFrame).observe($('frameBox'));

  const nameOf = (id) => (id === 'custom' ? 'Your picture' : SCENES[id].name);
  async function showPreview() {
    await frameReady;
    if (!theme || !prepared) return;
    if (previewUrls) { URL.revokeObjectURL(previewUrls.wall); URL.revokeObjectURL(previewUrls.blur); }
    previewUrls = { wall: URL.createObjectURL(prepared.wallBlob), blur: URL.createObjectURL(prepared.blurBlob) };
    const P = frame.contentWindow.CFTSPreview;
    P.slot(viewSlot() === 'other' ? 'other' : viewSlot());
    P.apply(viewId(), theme, previewUrls, glass, nameOf(viewId()));
    P.japanese(settings.japanese);
  }

  /* the studio's own accent follows the scene */
  function tintStudio() {
    if (!theme) return;
    const r = document.documentElement.style;
    r.setProperty('--accent', theme.roles['--lc-accent']);
    r.setProperty('--accent-ink', theme.scrim);
  }

  /* ---- solving ---------------------------------------------------------------- */
  const solveOf = (p) => Solver.analyze(p.sharp, p.blurSamples, { glass: settings.glass, visibility: settings.visibility, cols: p.cols });
  /* the dense glass depends on the scrim colour and the panel floor, not on
     visibility; cached so the slider stays smooth */
  const denseCache = {};
  function denseOf(id, p, t) {
    const key = id + '|' + t.mode + '|' + t.scrim + '|' + t.alpha.panel.toFixed(3);
    if (!denseCache[key]) denseCache[key] = Dense.dense(p.pixels, t.scrim, t.alpha, { mode: t.mode });
    return denseCache[key];
  }
  function solveNow() {
    if (!prepared) return;
    theme = solveOf(prepared);
    glass = denseOf(viewId(), prepared, theme);
    renderReport();
    tintStudio();
  }

  function renderReport() {
    const r = theme.report;
    const chip = (label, v, tip) => `<span class="chip" title="${tip}">${label} <b>${v.toFixed(1)}:1</b></span>`;
    /* the cards sit at max(0.90, dense): the solve is the floor, the page is at least that */
    $('report').innerHTML =
      chip('Text', r.text, 'Body text over the picture\'s brightest pixels') +
      chip('Rating colours ≥', glass.check, theme.mode === 'light'
        ? 'The lightest rating ink, on tables and sidebar boxes over the darkest 0.1% of the picture'
        : 'Red, the hardest rating ink, on tables and sidebar boxes over the brightest 0.1% of the picture') +
      chip('Accent', r.accent, 'Active tab, links in prose, key numbers') +
      chip('Buttons', r.submit, 'The Submit and Register buttons');
  }

  async function blobFromExtension(path) {
    const res = await fetch(chrome.runtime.getURL(path));
    return res.blob();
  }
  /* CF: the picture at 640 px wide, the pixels cf-solve.js reads */
  async function pixelsOf(wallBlob) {
    const im = await createImageBitmap(wallBlob);
    const W = Dense.WIDTH, H = Math.max(1, Math.round(W * im.height / im.width));
    const c = new OffscreenCanvas(W, H), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0, W, H);
    return g.getImageData(0, 0, W, H).data;
  }

  async function samplesFor(id) {
    if (preparedCache[id]) return preparedCache[id];
    let p;
    if (id === 'custom') {
      const art = (await chrome.storage.local.get('cfAnimeArt')).cfAnimeArt;
      if (!art) return samplesFor(DEF);
      const [w, b] = await Promise.all([Proc.dataURLToBlob(art.wall), Proc.dataURLToBlob(art.blur)]);
      p = await Proc.samplesFrom(w, b);
    } else {
      const s = SCENES[id] || SCENES[DEF];
      const [w, b] = await Promise.all([blobFromExtension(s.wall), blobFromExtension(s.blur)]);
      p = await Proc.samplesFrom(w, b);
    }
    p.pixels = await pixelsOf(p.wallBlob);
    return (preparedCache[id] = p);
  }
  async function loadScene(id) { prepared = await samplesFor(id); }

  /* solve every scene Codeforces may show, so each slot gets the same settings */
  async function solveAll() {
    const t = {}, d = {};
    for (const id of neededIds()) {
      const p = await samplesFor(id), s = solveOf(p);
      t[id] = s; d[id] = denseOf(id, p, s);
    }
    themes = t; denses = d;
  }

  /* ---- saving ------------------------------------------------------------------ */
  let saveTimer = 0;
  async function solveAndSave() { await solveAll(); save(true); }
  function save(immediate) {
    clearTimeout(saveTimer);
    const write = () => chrome.storage.local.set({ cfAnime: Object.assign({}, settings, { themes, dense: denses }) });
    if (immediate) write(); else saveTimer = setTimeout(write, 220);
  }
  const saveMoments = () => chrome.storage.local.set({ cfMoments: moments });

  /* ---- scene tiles ---------------------------------------------------------------- */
  function renderScenes() {
    const box = $('scenes');
    box.innerHTML = '';
    /* your own picture comes first, so it is never scrolled out of sight */
    const presets = document.createDocumentFragment();
    Object.entries(SCENES).forEach(([id, s]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scene';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(viewId() === id));
      b.style.backgroundImage = `url("${chrome.runtime.getURL(s.thumb || s.wall)}")`;
      b.innerHTML = `<span class="name">${s.name}</span>`;
      b.title = s.desc + (s.credit ? ' · ' + s.credit : '');
      b.addEventListener('click', () => pickScene(id));
      presets.appendChild(b);
    });

    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'scene upload' + (hasArt ? ' has-art' : '');
    up.setAttribute('role', 'radio');
    up.setAttribute('aria-checked', String(settings.scene === 'custom'));
    if (hasArt && customThumb) up.style.backgroundImage = `url("${customThumb}")`;
    up.innerHTML = `<span class="plus" aria-hidden="true">+</span><span class="name">${hasArt ? 'Your picture' : 'Add your picture'}</span>`;
    up.addEventListener('click', () => { if (hasArt && settings.scene !== 'custom') pickScene('custom'); else $('file').click(); });
    ['dragenter', 'dragover'].forEach((t) => up.addEventListener(t, (e) => { e.preventDefault(); up.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach((t) => up.addEventListener(t, () => up.classList.remove('dragging')));
    up.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) upload(f);
    });
    if (hasArt) {
      const x = document.createElement('span');
      /* an SVG cross, not the × character: a glyph sits on the font's
         baseline and never lands in the circle's true centre */
      x.className = 'remove'; x.title = 'Remove your picture';
      x.setAttribute('aria-label', 'Remove your picture');
      x.innerHTML = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5"/></svg>';
      x.setAttribute('role', 'button');
      x.addEventListener('click', (e) => { e.stopPropagation(); removeArt(); });
      up.appendChild(x);
    }
    box.appendChild(up);
    box.appendChild(presets);
    const picked = box.querySelector('[aria-checked="true"]');
    if (picked) box.scrollTop = Math.max(0, picked.offsetTop - box.offsetTop - 8);
    renderCredit();
  }

  /* the credits of the scenes in use; the free Freepik/Magnific licence requires
     "designed by Freepik - Magnific.com" wherever its pictures are shown */
  function renderCredit() {
    const n = $('sceneCredit');
    if (!n) return;
    const ids = settings.scene === 'custom' ? [] : [...new Set([viewId(), ...neededIds()])];
    const lines = ids.map((id) => SCENES[id]).filter((s) => s && s.credit && s.credit !== 'Original' && s.credit !== 'AI-generated')
      .map((s) => s.credit.indexOf('Freepik') === 0 ? `${s.name}: designed by Freepik – Magnific.com` : `${s.name}: ${s.credit}`);
    n.textContent = lines.join(' · ');
  }

  async function pickScene(id) {
    busy(true);
    try {
      justSet = null;
      if (id === 'custom') settings.scene = 'custom';
      else if (settings.byDifficulty && slot !== 'other') { settings.arcs = Object.assign({}, settings.arcs, { [slot]: id }); justSet = id; if (settings.scene === 'custom') settings.scene = DEF; }
      else { settings.scene = id; justSet = settings.byDifficulty ? id : null; }
      await refresh();
      await solveAndSave();
      activate();
    } finally { busy(false); }
  }

  /* re-solve and redraw whatever the preview should show now */
  async function refresh() {
    await loadScene(viewId());
    solveNow();
    renderScenes();
    renderArcs();
    await showPreview();
  }

  /* ---- scenes by difficulty ------------------------------------------------------ */
  function renderArcs() {
    $('arcs').checked = settings.byDifficulty;
    const box = $('arcSlots'), custom = settings.scene === 'custom';
    box.hidden = !settings.byDifficulty || custom;
    const label = (SLOTS.find(([d]) => d === slot) || [])[1] || '';
    const n = $('arcNote');
    n.classList.toggle('done', !!justSet);
    const where = slot === 'other' ? 'every page except rated problems' : `problems rated ${label === '2400+' ? '2400 and up' : label.toLowerCase()}`;
    if (custom) n.textContent = 'Your picture is used on every page.';
    else if (!settings.byDifficulty) n.textContent = 'One scene on every page.';
    else if (justSet) n.textContent = `✓ ${where[0].toUpperCase() + where.slice(1)} now use${slot === 'other' ? 's' : ''} ${SCENES[justSet].name}. Pick another slot to change it too.`;
    else n.innerHTML = `Choosing the scene for <b>${where}</b>. Pick a slot above to change another.`;
    box.innerHTML = '';
    SLOTS.forEach(([d, label, jp]) => {
      const s = SCENES[slotScene(d)];
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'slot'; b.dataset.slot = d;
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(d === slot));
      b.style.backgroundImage = `url("${chrome.runtime.getURL(s.thumb || s.wall)}")`;
      b.innerHTML = `${jp ? `<span class="jp">${jp}</span>` : ''}<span class="slot-label"><b>${label}</b></span><span class="slot-name">${s.name}</span>`;
      if (justSet && d === slot) { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
      b.addEventListener('click', async () => { slot = d; justSet = null; busy(true); try { await refresh(); } finally { busy(false); } });
      box.appendChild(b);
    });
  }

  function busy(on, text) {
    $('busy').hidden = !on;
    if (text) $('busy').lastChild.textContent = text;
  }

  function note(text, error) {
    const n = $('uploadNote');
    n.textContent = text;
    n.classList.toggle('error', !!error);
  }

  async function upload(file) {
    if (!/^image\//.test(file.type)) { note('That file is not an image.', true); return; }
    if (file.size > MAX_INPUT) { note('That image is over 30 MB. Try a smaller copy.', true); return; }
    busy(true, 'Preparing your picture…');
    try {
      const p = await Proc.prepare(file);
      p.pixels = await pixelsOf(p.wallBlob);
      const [wall, blur] = await Promise.all([Proc.blobToDataURL(p.wallBlob), Proc.blobToDataURL(p.blurBlob)]);
      await chrome.storage.local.set({ cfAnimeArt: { wall, blur, name: file.name } });
      preparedCache.custom = p;
      Object.keys(denseCache).filter((k) => k.startsWith('custom|')).forEach((k) => delete denseCache[k]);
      hasArt = true;
      customThumb = blur;
      settings.scene = 'custom';
      await refresh();
      await solveAndSave();
      activate();
      const soft = p.width < 1280 ? ' It is under 1280 px wide, so it may look soft on a large screen.' : '';
      note(`Ready: ${file.name}, ${Math.round(p.wallBlob.size / 1024)} KB.${soft}`);
    } catch (e) {
      note('That image could not be read. Try a PNG, JPEG or WebP.', true);
    } finally { busy(false); }
  }

  async function removeArt() {
    await chrome.storage.local.remove('cfAnimeArt');
    hasArt = false; customThumb = null;
    note('Your picture was removed from this browser.');
    delete preparedCache.custom;
    if (settings.scene === 'custom') settings.scene = DEF;
    await pickScene(settings.scene);
  }

  /* ---- theme on/off ---------------------------------------------------------- */
  function activate() { chrome.storage.local.set({ cfThemeStudio: 'anime' }); }
  function renderActive(themeId) {
    const on = (themeId || 'anime') === 'anime';   // nothing saved = fresh install = anime (content.js DEFAULT)
    $('activeState').textContent = on ? 'Active on Codeforces' : 'Not active on Codeforces';
    $('activeState').classList.toggle('on', on);
    $('activate').hidden = on;
  }
  $('activate').addEventListener('click', activate);
  if (globalThis.LCTSSupportButton) globalThis.LCTSSupportButton($('support'));
  if (globalThis.LCTSBugButton) globalThis.LCTSBugButton($('bug'));

  /* ---- controls ---------------------------------------------------------------- */
  const vis = $('visibility');
  const showVis = () => { $('visibilityOut').textContent = Math.round(settings.visibility * 100); };
  let raf = 0;
  vis.addEventListener('input', () => {
    settings.visibility = vis.value / 100;
    showVis();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(async () => { solveNow(); await showPreview(); });
  });
  vis.addEventListener('change', () => solveAndSave());

  const renderGlass = () => document.querySelectorAll('#glass button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === settings.glass)));
  document.querySelectorAll('#glass button').forEach((b) => b.addEventListener('click', async () => {
    if (settings.glass === b.dataset.v) return;
    settings.glass = b.dataset.v;
    renderGlass();
    busy(true);
    try { solveNow(); await showPreview(); await solveAndSave(); } finally { busy(false); }
  }));

  $('arcs').addEventListener('change', async () => {
    settings.byDifficulty = $('arcs').checked;
    if (settings.byDifficulty && settings.scene === 'custom') settings.scene = DEF;
    justSet = null;
    busy(true);
    try { await refresh(); await solveAndSave(); } finally { busy(false); }
  });

  $('file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) upload(f); e.target.value = ''; });

  ['titleCard', 'verdicts', 'levelUp'].forEach((k) => $(k).addEventListener('change', () => { moments[k] = $(k).checked; saveMoments(); }));
  /* Japanese text: the moments' stamps and title cards, the slots' arc names and the brand mark */
  const renderJapanese = () => {
    $('japanese').checked = settings.japanese;
    document.documentElement.toggleAttribute('data-no-jp', !settings.japanese);
  };
  $('japanese').addEventListener('change', async () => {
    settings.japanese = $('japanese').checked; renderJapanese(); save();
    await frameReady; frame.contentWindow.CFTSPreview.japanese(settings.japanese);
  });

  const renderSound = () => {
    $('sound').checked = !!moments.sound;
    $('volume').value = Math.round(moments.volume * 100);
    $('volumeOut').textContent = Math.round(moments.volume * 100);
    document.querySelector('.volume').classList.toggle('off', !moments.sound);
  };
  $('sound').addEventListener('change', () => { moments.sound = $('sound').checked; renderSound(); saveMoments(); });
  $('volume').addEventListener('input', () => { moments.volume = $('volume').value / 100; renderSound(); });
  /* on release, play a short sound at the new level so the choice can be heard */
  $('volume').addEventListener('change', () => {
    saveMoments();
    if (moments.sound) globalThis.LCTSSounds.play('tick-3', { volume: moments.volume, theme: 'anime' });   // CF: a combo tick (phase 3R pack)
  });

  document.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', async () => {
    await frameReady;
    frame.contentWindow.CFTSPreview.play(b.dataset.play, viewSlot(), (kind) => {   // CF: the show calls its own cues, and they stack
      if (moments.sound && kind) globalThis.LCTSSounds.play(kind, { volume: moments.volume, theme: 'anime', layer: true });
    });
  }));

  /* ---- boot --------------------------------------------------------------------- */
  (async () => {
    const res = await chrome.storage.local.get(['cfAnime', 'cfAnimeArt', 'cfThemeStudio', 'cfMoments', 'cfShare']);
    const A = res.cfAnime;
    if (A) Object.assign(settings, {
      scene: A.scene || DEF,
      byDifficulty: A.byDifficulty !== false,
      arcs: A.arcs || {},
      glass: ['dark', 'light', 'auto'].includes(A.glass) ? A.glass : 'dark',
      visibility: typeof A.visibility === 'number' ? A.visibility : 0.85,
      japanese: A.japanese !== false,
    });
    moments = Object.assign({}, MO_DEFAULTS, res.cfMoments);
    hasArt = !!res.cfAnimeArt;
    customThumb = hasArt ? res.cfAnimeArt.blur : null;
    if (settings.scene === 'custom' && !hasArt) settings.scene = DEF;

    vis.value = Math.round(settings.visibility * 100); showVis();
    renderGlass();
    ['titleCard', 'verdicts', 'levelUp'].forEach((k) => { $(k).checked = !!moments[k]; });
    renderJapanese();
    renderSound();
    $('share').checked = !(res.cfShare && res.cfShare.enabled === false);
    $('share').addEventListener('change', () => chrome.storage.local.set({ cfShare: { enabled: $('share').checked } }));
    renderActive(res.cfThemeStudio);

    /* CF: no recordings are bundled (no audio/anime/): every sound is the synth, as on Codeforces */

    busy(true, 'Loading scene…');
    try {
      await refresh();
      await solveAll();
    } finally { busy(false); document.documentElement.dataset.ready = ''; }
  })();

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.cfThemeStudio) renderActive(ch.cfThemeStudio.newValue);
    if (ch.cfShare) $('share').checked = !(ch.cfShare.newValue && ch.cfShare.newValue.enabled === false);
    /* the popup's switches change the same moments settings */
    if (ch.cfMoments) {
      moments = Object.assign({}, MO_DEFAULTS, ch.cfMoments.newValue);
      ['titleCard', 'verdicts', 'levelUp'].forEach((k) => { $(k).checked = !!moments[k]; });
      renderSound();
    }
  });
})();
