/* =============================================================================
   popup.js — the toolbar popup. Adapted from Theme Studio for LeetCode
   (src/popup.js); changes marked CF:.

   Five theme cards, each previewing a strip of Codeforces (a problem row, three
   handles, two verdicts) drawn in that theme's own surfaces, type and rating
   inks. The choice goes to storage; content.js applies it live in every open
   Codeforces tab, so there is nothing to refresh. Below the cards: the four
   everyday toggles. Everything finer lives in the Studio.

   STORAGE (all read by the content scripts)
     cfThemeStudio  theme id
     cfMoments      { titleCard, verdicts, levelUp, sound, volume, ... }
     cfMotion       false = no ambient motion      cfTopics  true = show topics
============================================================================= */

const KEY = 'cfThemeStudio';
const DEFAULT = (globalThis.CFTS_THEMES || {}).DEFAULT || 'anime';

/* Every theme comes from the registry (src/themes.js, THEMES.md): the card's name, maker, line, accent and code preview
   (bg, text, line numbers, keyword, function, number, variable, comment, punctuation, + font). Only the Anime card
   repaints itself from the scene you picked (paintAnimeCard). */
const REG = globalThis.CFTS_THEMES;
const THEMES = Object.fromEntries(REG.list.map((t) => [t.id, t]));
(() => {   // the Anime card's default inks: the default scene's solve
  const sc = (globalThis.LCTS_SCENES || {})[globalThis.LCTS_SCENE_DEFAULT], t = sc && sc.theme, ink = (t && t.ink) || {};
  if (t) Object.assign(THEMES.anime, { accent: t.roles['--lc-accent'], pv: { bg: t.scrim, text: ink.variable, line: t.roles['--lc-text3'], kw: ink.keyword, fn: ink.func, num: ink.number, var: ink.param, com: ink.comment, pn: ink.operator } });
})();
const ORDER = REG.list.map((t) => t.id);
let selectedId = null;
const studioButton = document.getElementById('studio');

const SNIPPET = [
  [1, [k('def'), ' ', f('solve'), pn('('), v('n'), pn(', '), v('a'), pn('):')]],
  [2, ['    ', k('if'), ' ', v('n'), ' ', pn('=='), ' ', n('1'), pn(':'), '  ', c('# base case')]],
  [3, ['        ', k('return'), ' ', v('a'), pn('['), n('0'), pn(']')]],
  [4, ['    ', k('return'), ' ', f('max'), pn('('), v('a'), pn(')'), ' - ', f('min'), pn('('), v('a'), pn(')')]],
];
function k(s) { return { t: 'kw', s }; }  function f(s) { return { t: 'fn', s }; }
function n(s) { return { t: 'num', s }; } function v(s) { return { t: 'var', s }; }
function c(s) { return { t: 'com', s }; } function pn(s) { return { t: 'pn', s }; }
const escH = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function previewHTML() {
  const rows = SNIPPET.map(([no, parts]) => `<div class="row"><span class="ln">${no}</span><span class="code">${parts.map((p) => (typeof p === 'string' ? escH(p) : `<span class="tok-${p.t}">${escH(p.s)}</span>`)).join('')}</span></div>`).join('');
  return rows;
}

const CHECK = '<svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2 5 8.7 9.6 3.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* CF: set as properties, not a style="" string: the font stacks hold double
   quotes, which ended the attribute early (every card but Off lost its palette) */
function pvVars(node, pv) {
  Object.entries(pv).forEach(([key, val]) => { if (val) node.style.setProperty(`--pv-${key}`, val); });
}

function render(selected) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  ORDER.forEach((id) => {
    const t = THEMES[id];
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(id === selected));
    card.setAttribute('aria-label', `${t.name} theme`);
    card.dataset.id = id;
    card.style.setProperty('--card-accent', t.accent);
    card.innerHTML =
      `<div class="preview tex-${t.tex}">${previewHTML()}</div>` +
      `<div class="meta">` +
        `<span class="name">${t.name}</span>${t.tag ? `<span class="tag">${t.tag}</span>` : ''}` +
        `<span class="desc">${t.desc}</span>` +
        `<span class="spacer"></span>` +
        `<span class="check">${CHECK}</span>` +
      `</div>`;
    pvVars(card.querySelector('.preview'), t.pv);
    card.addEventListener('click', () => choose(id));
    grid.appendChild(card);
    if (t.studio) {
      paintAnimeCard(card.querySelector('.preview'));
      grid.appendChild(studioButton);
    }
    if (t.thumb) { const pv = card.querySelector('.preview'); pv.innerHTML = `<img class="pv-shot" alt="" src="${chrome.runtime.getURL(t.thumb)}">`; pv.classList.add('shot'); }
  });
  setAccent(selected);
}

/* The Anime card shows the scenes you actually use. CF: cfAnime { scene,
   byDifficulty, arcs }: with a scene per difficulty, the three problem scenes
   side by side (800–1300 | 1400–2300 | 2400+); with one scene, that scene;
   with your own picture, its small blurred copy. The credits line names the
   scenes on the card (the Freepik licence: credit wherever its art is shown). */
function paintAnimeCard(preview) {
  chrome.storage.local.get(['cfAnime', 'cfAnimeArt'], (res) => {
    const cfg = res.cfAnime || {};
    document.querySelectorAll('.studio-jp').forEach((e) => { e.hidden = cfg.japanese === false; });
    const scenes = globalThis.LCTS_SCENES || {}, DEF = globalThis.LCTS_SCENE_DEFAULT;
    const ARC = globalThis.LCTS_ARC_DEFAULT || {};
    const thumb = (id) => { const s = scenes[id] || scenes[DEF]; return s ? chrome.runtime.getURL(s.thumb || s.wall) : null; };
    const custom = cfg.scene === 'custom' && res.cfAnimeArt;
    const arcs = !custom && cfg.byDifficulty !== false;

    let urls, ids, inkFrom;
    if (custom) { urls = [res.cfAnimeArt.blur]; ids = []; inkFrom = 'custom'; }
    else if (arcs) {
      const pick = (d) => (scenes[(cfg.arcs || {})[d]] ? cfg.arcs[d] : ARC[d]);
      ids = ['easy', 'medium', 'hard'].map(pick);
      urls = ids.map(thumb); inkFrom = ids[1];
    } else { ids = [scenes[cfg.scene] ? cfg.scene : DEF]; urls = ids.map(thumb); inkFrom = ids[0]; }

    const t = (cfg.themes && cfg.themes[inkFrom]) || (scenes[inkFrom] && scenes[inkFrom].theme);
    if (t && t.roles) {
      const ink = t.ink || {};
      pvVars(preview, { bg: t.scrim, text: ink.variable, line: t.roles['--lc-text3'], kw: ink.keyword, fn: ink.func, num: ink.number, var: ink.param, com: ink.comment, pn: ink.operator });
      document.querySelector('.card[data-id="anime"]').style.setProperty('--card-accent', t.roles['--lc-accent']);
      THEMES.anime.accent = t.roles['--lc-accent'];
      if (document.querySelector('.card[data-id="anime"][aria-checked="true"]')) setAccent('anime');
    }
    /* a manga page: your scenes as slanted panels, nothing over them. One scene is one panel */
    preview.classList.add('manga');
    preview.innerHTML = urls.map((u) => `<div class="pn" style="background-image:url('${u}')"></div>`).join('');
    preview.dataset.panels = urls.length;
    const credited = [...new Set(ids)].map((id) => scenes[id]).filter((s) => s && /freepik/i.test(s.credit || ''));
    document.getElementById('credits').textContent = credited.length
      ? `${credited.map((s) => s.name).join(', ')}: designed by Freepik – Magnific.com` : '';
  });
}

function setAccent(id) {
  document.documentElement.style.setProperty('--pop-accent', THEMES[id].accent);
}

function markSelected(id) {
  document.querySelectorAll('.card').forEach((c) =>
    c.setAttribute('aria-checked', String(c.dataset.id === id)));
  setAccent(id);
}

function choose(id) {
  markSelected(id);
  selectedId = id;
  readOptions();
  /* LeetCode is the theme that turns the LeetCode layout on (cfUI, read by src/modern); every other theme turns it off */
  chrome.storage.local.set({ [KEY]: id, cfUI: THEMES[id].app === 'modern' ? 'modern' : 'classic' });
  document.getElementById('studio').classList.toggle('lit', !!THEMES[id].studio);
  const status = document.getElementById('status');
  status.textContent = id === 'off'
    ? 'Theme off. Codeforces is back to its own look.'
    : THEMES[id].app ? `${THEMES[id].name} on: Problems, problem pages, Contests and Profile. Other pages use ${THEMES[THEMES[id].wears] ? THEMES[THEMES[id].wears].name : 'the theme'}.`
    : `${THEMES[id].name} applied to your open Codeforces tabs.`;
}

/* ---- CF: options -------------------------------------------------------------- */
const MO_DEFAULTS = { titleCard: true, verdicts: true, liveVerdicts: false, levelUp: true, sound: true, volume: 1 };
function paintOptions(r) {
  document.getElementById('guide').checked = !(r.cfGuide && r.cfGuide.nav === false);
  const m = Object.assign({}, MO_DEFAULTS, r.cfMoments);
  /* the Moments switch covers all three; the Studio can set them one by one */
  const mo = document.getElementById('moments');
  const n = [m.titleCard, m.verdicts, m.levelUp].filter(Boolean).length;
  mo.checked = n > 0;
  mo.indeterminate = n > 0 && n < 3;
  document.getElementById('sound').checked = !!m.sound;
  document.getElementById('sound').closest('.opt').classList.toggle('dim', n === 0);
  document.getElementById('motion').checked = r.cfMotion !== false;
  document.getElementById('topics').checked = !!r.cfTopics;
}
const OPT_KEYS = ['cfMoments', 'cfMotion', 'cfTopics', 'cfGuide'];
const readOptions = () => chrome.storage.local.get(OPT_KEYS, paintOptions);
const setMoments = (patch) => chrome.storage.local.get('cfMoments', (r) =>
  chrome.storage.local.set({ cfMoments: Object.assign({}, MO_DEFAULTS, r.cfMoments, patch) }));
document.getElementById('moments').addEventListener('change', (e) => {
  const on = e.target.checked;
  setMoments({ titleCard: on, verdicts: on, levelUp: on });
});
document.getElementById('sound').addEventListener('change', (e) => setMoments({ sound: e.target.checked }));
document.getElementById('motion').addEventListener('change', (e) => chrome.storage.local.set({ cfMotion: e.target.checked }));
document.getElementById('topics').addEventListener('change', (e) => chrome.storage.local.set({ cfTopics: e.target.checked }));
/* the guide: "Start here" in the menu and the home card; on brings both back */
document.getElementById('guide').addEventListener('change', (e) => chrome.storage.local.set({ cfGuide: { nav: e.target.checked, card: e.target.checked } }));
/* Stamp the running version into the footer. If this does not match the
   version of the folder you loaded, Chrome is still serving a cached copy of
   the extension and needs the reload button on chrome://extensions. */
try {
  const v = chrome.runtime.getManifest().version;
  const el = document.getElementById('ver');
  if (el) el.textContent = 'v' + v;
} catch (e) {}

/* boot */
chrome.storage.local.get(KEY, (res) => {
  const selected = (res && res[KEY]) || DEFAULT;
  selectedId = THEMES[selected] ? selected : DEFAULT;
  render(selectedId);
  readOptions();
  document.getElementById('studio').classList.toggle('lit', selected === 'anime');
});
readOptions();
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  if (OPT_KEYS.some((k) => ch[k])) readOptions();
  if (ch.cfAnime || ch.cfAnimeArt) { const p = document.querySelector('.card[data-id="anime"] .preview'); if (p) paintAnimeCard(p); }
});

document.getElementById('studio').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/studio.html') });
  window.close();
});

/* keyboard: arrow keys move between radio cards and select, as a radio group does */
document.addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return;
  const cards = [...document.querySelectorAll('.card')];
  const idx = cards.findIndex((c) => c === document.activeElement);
  if (idx === -1) return;
  e.preventDefault();
  const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
  const next = cards[(idx + dir + cards.length) % cards.length];
  next.focus();
  choose(next.dataset.id);
});

/* the Support and Report bug links (src/support.js holds the URLs) */
if (globalThis.LCTSSupportButton) globalThis.LCTSSupportButton(document.getElementById('support'));
if (globalThis.LCTSBugButton) globalThis.LCTSBugButton(document.getElementById('bug'));
