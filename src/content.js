/* =============================================================================
   content.js  (isolated world, every Codeforces page)
   - Applies the saved theme to <html> as early as possible via data-cf-theme;
     every rule in themes/*.css is scoped under it.
   - data-cf-mode="dark|light" tells core.css which rating-colour and icon set
     the surface needs (anime's mode comes from its solved scene).
   - Switches live through storage.onChanged; 'off' removes both attributes,
     which switches every rule off at once with no reload.
   Codeforces has no dark mode of its own, so there is nothing to force or
   restore, unlike the LeetCode version.
============================================================================= */
(() => {
  const KEY = 'cfThemeStudio';
  /* every theme is declared once, in src/themes.js (THEMES.md): this file names none */
  const REG = globalThis.CFTS_THEMES;
  const DEFAULT = REG.DEFAULT;
  const VALID = new Set(REG.list.map((t) => t.id));
  const DARK_THEMES = new Set(REG.list.filter((t) => t.dark === true).map((t) => t.id));
  /* core.css, guided.css and icons.css are keyed on data-cf-look, which a
     theme sets unless it is listed here (a theme with the extension's
     features but Codeforces' own look; none at present). */
  const NO_LOOK = new Set(REG.list.filter((t) => t.noLook).map((t) => t.id));
  const isDark = (theme) => (REG.byId[theme] || {}).dark === 'scene'
    ? globalThis.__cftsAnimeMode !== 'light'
    : DARK_THEMES.has(theme);
  const root = document.documentElement;
  let current = null;
  /* A theme either reorganises pages (guided: true, data-cf-layout="guided") or
     keeps Codeforces' positions (no attribute). A running contest is never
     reorganised (BRIEF rule 5): on contest/gym pages data-cf-live is set at
     once and guided.js clears it after reading the sidebar's phase, so a live
     contest page never flashes the Guided layout. */
  const maybeLive = /^\/(contest|gym|group)\//.test(location.pathname);
  const sync = () => { if (globalThis.__cftsSync) globalThis.__cftsSync(); };

  function setMode() {
    if (!current || current === 'off') return;
    if (NO_LOOK.has(current)) { root.removeAttribute('data-cf-mode'); return; }
    root.setAttribute('data-cf-mode', isDark(current) ? 'dark' : 'light');
  }

  /* Dark Reader on top of a Theme Studio theme double-darkens the page and
     inverts the Codeforces logo into a black box (seen on the user's
     browser). Its documented opt-out for sites with their own dark theme is
     <meta name="darkreader-lock">. Present only while a theme is on. */
  function darkReaderLock(on) {
    const el = document.querySelector('meta[name="darkreader-lock"][data-cfts]');
    if (on && !el) {
      const m = document.createElement('meta');
      m.name = 'darkreader-lock'; m.setAttribute('data-cfts', '');
      (document.head || root).appendChild(m);
    } else if (!on && el) el.remove();
  }

  /* Modern (MODERN.md): on its four page types the Classic theme steps aside, because the statement's REAL nodes live inside
     #cfm-app and every Classic rule is keyed on data-cf-theme. content.js owns data-cf-ui; src/modern/app.js mounts/unmounts. */
  const UI_KEY = 'cfUI';
  const modernPage = /^\/(problemset\/problem\/\d+\/\w+|(contest|gym)\/\d+\/problem\/\w+)/.test(location.pathname) || /^\/problemset(\/page\/\d+)?\/?$/.test(location.pathname)   // M3: the Problems list
    || /^\/(contests|profile\/[^/]+)\/?$/.test(location.pathname)   // M4: Contests and Profile
    || /^\/(friends|contests\/with\/[^/]+|settings\/general)\/?$/.test(location.pathname)   // Friends, a user's contests, Settings
    || /^\/(page\/\d+|top|gyms)?\/?$/.test(location.pathname);   // Discuss (the home feed, its pages, Top) and Gym
  /* The LeetCode theme IS the LeetCode layout: on its pages (modernPage) the app mounts and the skin steps aside; every
     other page wears Midnight. cfUI is its on/off, set by the popup only (choosing the theme sets 'modern'). */
  let ui = 'classic', requested = DEFAULT;
  const modernOn = () => ui === 'modern' && (REG.byId[requested] || {}).app === 'modern';
  /* a theme that "wears" another look on the pages it does not reshape (LeetCode: Midnight) */
  const effective = () => (modernOn() && modernPage ? 'off' : (REG.byId[requested] || {}).wears || requested);
  function syncUI() {
    if (modernPage) { if (modernOn()) root.setAttribute('data-cf-ui', 'modern'); else root.removeAttribute('data-cf-ui'); }
    applyNow(effective());
    if (modernPage) darkReaderLock(modernOn() || effective() !== 'off');
  }
  function apply(theme) { requested = VALID.has(theme) ? theme : DEFAULT; syncUI(); }
  function setUI(v) { ui = v === 'modern' ? 'modern' : 'classic'; syncUI(); }
  document.addEventListener('cfm:fail', () => { ui = 'classic'; root.removeAttribute('data-cf-ui'); applyNow(effective()); darkReaderLock(effective() !== 'off'); });

  function applyNow(theme) {
    if (!VALID.has(theme)) theme = DEFAULT;
    /* the theme that wears this look (LeetCode wears Midnight): its palette rides on Midnight's roles (midnight.css) */
    const wearer = theme !== 'off' && theme !== requested && (REG.byId[requested] || {}).wears === theme ? requested : '';
    const wore = root.getAttribute('data-cf-wearer') || '';
    if (wearer) root.setAttribute('data-cf-wearer', wearer); else root.removeAttribute('data-cf-wearer');
    if (theme === current) { if (wore !== wearer) sync(); return; }   // LeetCode -> Midnight keeps the theme and changes the page
    const live = current !== null;
    current = theme;
    /* a live switch changes the prose face: MathJax must re-measure (relayout.js) */
    if (live) queueMicrotask(() => document.dispatchEvent(new CustomEvent('cfts:theme')));
    if (theme === 'off') {
      clearTitles();
      darkReaderLock(modernOn() && modernPage);   // Modern is its own dark UI: Dark Reader repainted it (black panels, lost fills; user's Chrome, Oct 28 2026)
      root.removeAttribute('data-cf-theme');
      root.removeAttribute('data-cf-look');
      root.removeAttribute('data-cf-mode');
      root.removeAttribute('data-cf-layout');
      root.removeAttribute('data-cf-live');
      sync();
      return;
    }
    root.setAttribute('data-cf-theme', theme);
    if (NO_LOOK.has(theme)) root.removeAttribute('data-cf-look');
    else root.setAttribute('data-cf-look', '');
    if ((REG.byId[theme] || {}).guided) root.setAttribute('data-cf-layout', 'guided');
    else root.removeAttribute('data-cf-layout');
    if (maybeLive && !was_synced) root.setAttribute('data-cf-live', '');
    /* a theme without our look is Codeforces' own page: Dark Reader may darken it */
    darkReaderLock(!NO_LOOK.has(theme));
    setMode();
    sync();
  }
  let was_synced = false;
  document.addEventListener('DOMContentLoaded', () => { was_synced = true; }, { once: true });

  globalThis.__cftsReassertMode = setMode;

  /* Each family is split in faces by unicode-range (Latin, Cyrillic). A family
     the page uses that still has an UNLOADED face is re-laid out on every later
     font load on the page, ours or Codeforces' (MathJax's fonts arrive ~600 ms
     in): on a 200-row standings page that was one extra full layout (~40-50 ms)
     per load. Loading every face of the theme's families as soon as the theme
     is known leaves none unloaded, and they usually arrive before the first
     layout. Off loads nothing (stock pages never use these faces). */
  const FACES = Object.fromEntries(REG.list.filter((t) => t.faces).map((t) => [t.id, t.faces]));
  const facesLoaded = new Set();
  function loadFaces(theme) {
    if (!FACES[theme] || facesLoaded.has(theme) || !document.fonts) return;
    facesLoaded.add(theme);
    FACES[theme].forEach((f) => { try { document.fonts.load(f, 'A\u0416').catch(() => {}); } catch (e) {} });
  }

  /* The logo filter (core.css, dark mode). Chrome resolves CSS filter url()s
     only inside the document, so the definition is one hidden <svg>. It is
     inert unless a theme's CSS references it, so Off needs no cleanup.
     Per pixel: chroma = max - min channel. Saturated pixels (the three bars)
     keep their colour; near-neutral ones (the wordmark, its white field) are
     flipped in lightness with the hue kept. Last, alpha = R+G+B: the field
     (black after the flip) turns transparent and the marks stay opaque, which
     looks like screen blending without a blend mode (a blend mode on content
     scrolling over the fixed scene layer re-blends every frame). */
  const LOGO_FILTER = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
<filter id="cfts-logo-dark" color-interpolation-filters="sRGB">
 <feColorMatrix in="SourceGraphic" result="R" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 1 0"/>
 <feColorMatrix in="SourceGraphic" result="G" values="0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 1 0"/>
 <feColorMatrix in="SourceGraphic" result="B" values="0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 1 0"/>
 <feBlend in="R" in2="G" mode="lighten" result="mx"/><feBlend in="mx" in2="B" mode="lighten" result="MAX"/>
 <feBlend in="R" in2="G" mode="darken" result="mn"/><feBlend in="mn" in2="B" mode="darken" result="MIN"/>
 <feBlend in="MAX" in2="MIN" mode="difference" result="C"/>
 <feComponentTransfer in="C" result="M"><feFuncR type="linear" slope="8" intercept="-3.2"/><feFuncG type="linear" slope="8" intercept="-3.2"/><feFuncB type="linear" slope="8" intercept="-3.2"/></feComponentTransfer>
 <feComponentTransfer in="M" result="IM"><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/><feFuncB type="table" tableValues="1 0"/></feComponentTransfer>
 <feComponentTransfer in="SourceGraphic" result="inv"><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/><feFuncB type="table" tableValues="1 0"/></feComponentTransfer>
 <feColorMatrix in="inv" type="hueRotate" values="180" result="INV"/>
 <feComposite in="SourceGraphic" in2="M" operator="arithmetic" k1="1" result="keep"/>
 <feComposite in="INV" in2="IM" operator="arithmetic" k1="1" result="flip"/>
 <feComposite in="keep" in2="flip" operator="arithmetic" k2="1" k3="1"/>
 <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 1 1 1 0 0"/>
</filter></svg>`;
  function addLogoFilter() {
    if (document.getElementById('cfts-logo-dark') || !document.body) return;
    document.body.insertAdjacentHTML('beforeend', LOGO_FILTER);
  }
  if (document.body) addLogoFilter();
  else document.addEventListener('DOMContentLoaded', addLogoFilter, { once: true });

  /* One line per table row: clipped cells (status Lang / Problem) end in an
     ellipsis, and the full text appears as a tooltip. Set lazily on hover by
     one delegated listener (no per-row work), only for cells that are really
     clipped, and removed again on Off. */
  const titled = new Set();
  document.addEventListener('mouseover', (e) => {
    if (!current || current === 'off') return;
    /* the tables' own icon controls: name them (they have no label) */
    const ico = e.target && e.target.matches && e.target.matches('.datatable img.closed, .datatable img.opened, .userListMarker') ? e.target : null;
    if (ico) {
      if (!ico.hasAttribute('title')) { ico.setAttribute('title', ico.matches('.userListMarker') ? 'Your lists' : ico.matches('.opened') ? 'Close the filter' : 'Filter the rows on this page'); titled.add(ico); }
      return;
    }
    const td = e.target && e.target.closest && e.target.closest('.datatable td');
    if (!td || td.hasAttribute('title') || td.scrollWidth <= td.clientWidth) return;
    td.setAttribute('title', td.textContent.replace(/\s+/g, ' ').trim());
    titled.add(td);
  }, { passive: true });
  const clearTitles = () => { titled.forEach((td) => td.removeAttribute('title')); titled.clear(); };

  apply(DEFAULT);
  chrome.storage.local.get([KEY, UI_KEY], (res) => {
    ui = res && res[UI_KEY] === 'modern' ? 'modern' : 'classic';
    apply((res && res[KEY]) || DEFAULT);
    loadFaces(current);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[UI_KEY]) setUI(changes[UI_KEY].newValue);
    if (changes[KEY]) { apply(changes[KEY].newValue || DEFAULT); loadFaces(current); }
    /* picking the LeetCode theme in the popup opens its home, the Problems list, in the tab you are looking at (its
       other pages stay where they are). Popup-only: there is no way back on the page itself. */
    const nt = changes[KEY] && changes[KEY].newValue;
    if (nt && nt !== changes[KEY].oldValue && (REG.byId[nt] || {}).app === 'modern' && !modernPage && document.visibilityState === 'visible') location.assign('/problemset');
  });
})();
