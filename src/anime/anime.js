/* =============================================================================
   anime.js  (isolated world, Codeforces)

   Publishes the chosen scene: the solved role block (css.js) plus the
   Codeforces glass (cf-block.js). Nothing here decodes, resizes or solves:
   the Anime Studio did that when the scene was picked; this reads the result.
   Also published: the scene picture as --cf-scene-wall (the Guided banners
   crop it), its name for the episode header, and the ambient motes' shape.

   STORAGE
     cfAnime     { scene, byDifficulty, arcs, visibility, themes, dense,
                 japanese }
                 scene: the scene for every page ('custom' = your picture);
                 byDifficulty (default on): a rated problem uses its arc's
                 scene instead: up to 1300 日常編, 1400-2300 修行編, 2400+
                 最終決戦 (arcs overrides LCTS_ARC_DEFAULT per slot). Your
                 picture wins everywhere. themes / dense: the Studio's solve
                 per scene id at your settings; a scene without one uses the
                 copy pre-solved in scenes.js / cf-glass.js.
     cfAnimeArt  { wall, blur } data URLs, only for your own picture. Read only
                 while the anime theme is on, so a big picture costs nothing on
                 a page using another theme.
============================================================================= */
(() => {
  const SCENES = globalThis.LCTS_SCENES, DEF = globalThis.LCTS_SCENE_DEFAULT;
  const ARC = globalThis.LCTS_ARC_DEFAULT || {};
  const STYLE_ID = 'cfts-anime-roles';
  let published = '';
  let objectUrls = [];

  function styleEl() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  const moteUrl = (id) => chrome.runtime.getURL(globalThis.CFTSAnimeBlock.petals(id) ? 'icons/ui/petals.svg' : 'icons/ui/motes.svg');
  function publish(id, theme, urls, glass, name) {
    const css = globalThis.CFTSAnimeBlock.build(id, theme, Object.assign({ mote: moteUrl(id) }, urls), glass, name);
    if (css !== published) { styleEl().textContent = css; published = css; }
    /* the share card draws the scene the user is on (src/moments/share.js) */
    globalThis.__lctsAnimeScene = { wall: urls.wall };
    const modeChanged = globalThis.__cftsAnimeMode !== theme.mode;
    globalThis.__cftsAnimeMode = theme.mode;
    if (modeChanged && globalThis.__cftsReassertMode) globalThis.__cftsReassertMode();
  }
  const solvedFor = (cfg, id) => (cfg.themes && cfg.themes[id]) || SCENES[id].theme;
  const glassFor = (cfg, id) => (cfg.dense && cfg.dense[id]) || (globalThis.CFTS_GLASS || {})[id] || { dense: 0.9 };
  function publishPreset(cfg, id) {
    if (!SCENES[id]) id = DEF;
    const s = SCENES[id];
    releaseObjectUrls();
    publish(id, solvedFor(cfg, id), { wall: chrome.runtime.getURL(s.wall), blur: chrome.runtime.getURL(s.blur) }, glassFor(cfg, id), s.name);
  }

  /* ---- your own picture: data URLs from storage become object URLs ---------- */
  function toObjectUrl(dataUrl) {
    const comma = dataUrl.indexOf(',');
    const type = dataUrl.slice(5, comma).split(';')[0] || 'image/webp';
    const bin = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    objectUrls.push(url);
    return url;
  }
  function releaseObjectUrls(keep) {
    objectUrls.filter((u) => !(keep && keep.includes(u))).forEach((u) => URL.revokeObjectURL(u));
    objectUrls = keep ? objectUrls.filter((u) => keep.includes(u)) : [];
  }
  const loads = (url) => new Promise((res) => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = url; });

  /* ---- which scene ------------------------------------------------------------ */
  let rating = 0;
  const arcOf = (r) => (r <= 1300 ? 'easy' : r <= 2300 ? 'medium' : 'hard');
  function sceneFor(cfg) {
    if (cfg.byDifficulty !== false && rating) {
      const id = Object.assign({}, ARC, cfg.arcs)[arcOf(rating)];
      if (SCENES[id]) return id;
    }
    return SCENES[cfg.scene] ? cfg.scene : DEF;
  }

  /* the pre-solved default goes in at once, before storage answers, so the
     first paint under the anime theme is never unstyled */
  publishPreset({}, DEF);
  let cfgNow = {}, loading = 0;
  function show() {
    const ticket = ++loading, cfg = cfgNow;
    if (cfg.scene !== 'custom') { publishPreset(cfg, sceneFor(cfg)); return; }
    chrome.storage.local.get('cfAnimeArt', async (r) => {
      if (ticket !== loading) return;
      const art = r && r.cfAnimeArt, theme = cfg.themes && cfg.themes.custom;
      if (!art || !art.wall || !art.blur || !theme) { publishPreset(cfg, DEF); return; }
      try {
        const before = objectUrls.slice();
        const urls = { wall: toObjectUrl(art.wall), blur: toObjectUrl(art.blur) };
        if (!(await loads(urls.wall)) || ticket !== loading) { releaseObjectUrls(before); if (ticket === loading) publishPreset(cfg, DEF); return; }
        publish('custom', theme, urls, glassFor(cfg, 'custom'), 'Your picture');
        releaseObjectUrls([urls.wall, urls.blur]);
      } catch (e) { publishPreset(cfg, DEF); }
    });
  }
  const load = () => chrome.storage.local.get(['cfThemeStudio', 'cfAnime'], (res) => {
    /* nothing saved = a fresh install, which content.js runs as anime (its DEFAULT) */
    if (((res && res.cfThemeStudio) || 'anime') !== 'anime') return;   // nothing to load for other themes
    cfgNow = (res && res.cfAnime) || {};
    show();
  });
  load();
  /* a rated problem: its arc's scene (read once the sidebar's rating tag is parsed) */
  if (/^\/(problemset\/problem|contest\/\d+\/problem|gym\/\d+\/problem)\//.test(location.pathname)) {
    const read = () => {
      const tag = [...document.querySelectorAll('#sidebar .tag-box')].map((t) => t.textContent.trim()).find((t) => /^\*\d+$/.test(t));
      rating = tag ? +tag.slice(1) : 0;
      if (rating && cfgNow.scene !== 'custom') show();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', read, { once: true }); else read();
  }
  globalThis.__cftsArcOf = arcOf;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.cfAnime || changes.cfAnimeArt || changes.cfThemeStudio)) load();
  });
})();
