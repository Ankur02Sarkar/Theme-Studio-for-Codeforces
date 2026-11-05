/* =============================================================================
   themes.js  (content script AND popup)   THE THEME REGISTRY (see THEMES.md)
   One entry per theme. Each theme is its own experience: its look (CSS keyed on html[data-cf-theme="<id>"]), its layout
   rule, its own scripts (each one starts with `if (theme !== '<id>') return;`-style guards), and its popup card. Nothing
   in content.js or the popup names a theme any more: they read this list. To add a theme, add an entry here and its files.

   Fields
     id, name, desc         popup card; desc in the card's mono line
     accent                 the popup's accent while it is selected
     dark                   true = dark inks (rank inks, data-cf-mode="dark"); 'scene' = the Anime scene decides
     guided                 true = the theme reorganises pages (guided.js, themes/guided.css); without it the theme keeps
                            Codeforces' positions. A running contest is never reorganised, on any theme.
     wears                  another theme's look on pages this one does not reshape (LeetCode: Midnight elsewhere)
     app                    the theme mounts its own app on some pages (LeetCode: src/modern on the Problems list and
                            problem pages, while cfUI === 'modern')
     faces                  font faces loaded as soon as the theme is known (content.js loadFaces: no late relayout)
     files                  documentation: the files this theme owns (THEMES.md)
     pv                     the popup card's code preview: bg, text, line, kw, fn, num, var, com, pn (+ font)
     tex                    the popup card's texture class
     donate                 a Donate button in the header (guided.js)
     thumb                  a picture on the popup card, in place of the code preview (scripts/store/thumbs.mjs)
============================================================================= */
(() => {
  const INTER = ['400 1em Inter', '400 1em "JetBrains Mono"'];
  const THEMES = [
    {
      thumb: 'textures/popup/leetcode.webp',
      id: 'leetcode', name: 'LeetCode', tag: 'Layout', desc: 'the LeetCode layout on Codeforces', accent: '#2cbb5d',
      dark: true, wears: 'midnight', app: 'modern', faces: INTER,
      files: ['src/modern/*', 'themes/modern.css', 'vendor/monaco-editor', 'vendor/dompurify'],
      pv: { bg: '#262626', text: '#d4d4d4', line: '#6e7681', kw: '#569cd6', fn: '#dcdcaa', num: '#b5cea8', var: '#9cdcfe', com: '#6a9955', pn: '#d4d4d4' }, tex: 'leetcode',
    },
    {
      id: 'anime', name: 'Anime Studio', desc: 'you are the protagonist', accent: '#f98dc1', studio: true,
      dark: 'scene', guided: true, faces: ['400 1em Inter', '400 1em "JetBrains Mono"', '400 1em "Dela Gothic One"'],
      files: ['src/anime/*', 'themes/anime.css', 'themes/anime-app.css', 'textures/anime/*', 'src/moments/*', 'themes/fx.css', 'src/studio.*', 'ANIME.md'],
      pv: { bg: '#150b21', text: '#f3f0f7', line: '#9b8dad', kw: '#f98dc1', fn: '#cb9cfa', num: '#f5993d', var: '#d7c6e9', com: '#9b8dad', pn: '#dab9c9' }, tex: 'anime',
    },
    {
      thumb: 'textures/popup/fastlap.webp',
      id: 'fastlap', name: 'FASTLAP', desc: 'race broadcast, timing tower', accent: '#E10A1E',
      dark: true, guided: true, faces: ['400 1em Inter', '600 1em Inter', '400 1em "JetBrains Mono"', '700 1em "Titillium Web"', '900 1em "Titillium Web"', 'italic 900 1em "Titillium Web"'],
      files: ['src/fastlap/*', 'src/fastlap/models/*', 'textures/fastlap/*', 'themes/fastlap*.css', 'FASTLAP.md'],
      pv: { bg: '#0E0E10', text: '#f4f4f6', line: '#55555f', kw: '#E10A1E', fn: '#FACC15', num: '#22C55E', var: '#f4f4f6', com: '#8C8C97', pn: '#c9c9d1' }, tex: 'fastlap',
    },
    {
      thumb: 'textures/popup/pixel.webp',
      id: 'pixel', name: 'Pixel Art', desc: 'every problem is a monster', accent: '#ffcd75',
      dark: true, guided: true, faces: ['400 1em PX', '400 1em "PX Small"', '400 1em Inter', '400 1em "JetBrains Mono"'],
      files: ['themes/pixel.css', 'themes/pixel-app.css', 'src/pixel/*', 'textures/pixel/*', 'PIXEL.md'],
      pv: { bg: '#262b44', text: '#f4f4f4', line: '#566c86', kw: '#ffcd75', fn: '#73eff7', num: '#c9a0ff', var: '#c5d3e0', com: '#8b9bb4', pn: '#ffa36b' }, tex: 'pixel',
    },
    {
      id: 'classic', name: 'Classic', desc: "Codeforces' colours, modern finish", accent: '#2a5db0',
      dark: false, faces: INTER,
      files: ['src/classic.js', 'themes/classic.css', 'docs/A-*.md'],
      pv: { bg: '#ffffff', text: '#1b1f24', line: '#9aa0a6', kw: '#000088', fn: '#660066', num: '#006666', var: '#1b1f24', com: '#880000', pn: '#666600' }, tex: 'none',
    },
    {
      id: 'midnight', donate: true, name: 'Midnight', desc: 'Codeforces at night: nothing moves', accent: '#d9b36c',
      dark: true, faces: INTER,
      files: ['themes/midnight.css', 'themes/core.css', 'themes/guided.css', 'src/guided.js'],
      pv: { bg: '#0c1020', text: '#e8ecf6', line: '#5f6a85', kw: '#d9b36c', fn: '#a9bbdf', num: '#3ddc97', var: '#e8ecf6', com: '#8e98b0', pn: '#a9d4ff' }, tex: 'stars',
    },
    {
      id: 'grid', donate: true, name: 'Grid', desc: 'a drafting table: nothing moves', accent: '#35e0a1',
      dark: true, faces: INTER,
      files: ['themes/grid.css', 'textures/grid/*', 'scripts/build-grid.py'],
      pv: { bg: '#111823', text: '#d7e0ec', line: '#8b9cb3', kw: '#35e0a1', fn: '#58a6ff', num: '#e3b341', var: '#d7e0ec', com: '#8b9cb3', pn: '#a3b4c9' }, tex: 'grid',
    },
    {
      id: 'paper', donate: true, name: 'Vintage Paper', desc: 'kraft stock, iron-gall ink', accent: '#d9a441',
      dark: false, guided: true,
      faces: ['400 1em "EB Garamond"', '700 1em "EB Garamond"', 'italic 400 1em "EB Garamond"', '400 1em "IM Fell English"', 'italic 400 1em "IM Fell English"', '400 1em "Courier Prime"', '700 1em "Courier Prime"', '400 1em "JetBrains Mono"'],
      files: ['themes/paper.css', 'textures/paper/*'],
      pv: { bg: '#d5c29b', text: '#1c1610', line: '#5f4e33', kw: '#650500', fn: '#00208a', num: '#00343f', var: '#1a2d5a', com: '#3b3120', pn: '#3a2d1d', font: '"Courier Prime", "JetBrains Mono", monospace' }, tex: 'grain',
    },
    {
      thumb: 'textures/popup/off.webp',
      id: 'off', name: 'Off', desc: 'hand the page back to Codeforces', accent: '#8a8f98',
      dark: false, faces: null, files: [],
      pv: { bg: '#ffffff', text: '#000000', line: '#888888', kw: '#000088', fn: '#660066', num: '#006666', var: '#000000', com: '#880000', pn: '#666600' }, tex: 'none',
    },
  ];
  const byId = Object.fromEntries(THEMES.map((t) => [t.id, t]));
  globalThis.CFTS_THEMES = { list: THEMES, byId, DEFAULT: 'anime', get: (id) => byId[id] || byId.anime };
})();
