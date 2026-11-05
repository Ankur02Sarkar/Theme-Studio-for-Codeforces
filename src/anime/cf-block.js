/* =============================================================================
   cf-block.js — the Codeforces half of a scene's role block, as a pure
   builder. anime.js (on Codeforces) and the Anime Studio preview both call it,
   so the preview shows exactly what a Codeforces page gets.

   Cards are near-solid: total scrim weight max(0.90, the dense glass solved
   for red at 4.5:1; cf-solve.js). The scene layer already carries the desk
   veil, so the card adds what is left.
============================================================================= */
(function (root) {
  'use strict';
  const over = (total, under) => Math.max(0, 1 - (1 - total) / (1 - under));
  /* the page backdrop's focal crop: a scene whose picture is mostly a light
     sky shows its dark subject instead (scored over the visible margins at
     1280-1920 px wide: no cream behind the glass) */
  /* a banner shows a strip of the scene with the page's words and the hero over its middle, so each scene names its best framing: [x %, y %, zoom %], chosen by eye
     on the real banner (anime-app.mjs banners), with the subject at the open right edge or behind nothing that cuts it. Your own picture has no entry and gets the default */
  const BANNER = { 'pilgrim-gate': [0, 62, 175], 'cloud-temple': [0, 50, 130], 'crimson-sunset': [70, 44, 100], 'jade-dragon': [0, 56, 150], 'red-train': [100, 44, 115], 'temple-garden': [0, 64, 118], 'forest-ruins': [0, 55, 175], 'forest-elder': [100, 42, 100], 'arcade-lights': [100, 32, 100],
    'moonlit-shrine': [0, 22, 128], 'blossom-night': [0, 25, 128], 'moon-field': [50, 36, 100], 'harvest-moon': [50, 33, 100], 'moon-wanderer': [50, 17, 100], 'golden-hour': [50, 67, 100], 'city-cat': [50, 72, 100], starfield: [50, 80, 100], 'torii-forest': [50, 24, 100],
    'train-window': [50, 38, 100], 'new-year': [0, 8, 130], 'forest-road': [50, 53, 100], 'map-room': [50, 20, 100], 'blue-dragon': [100, 66, 130], 'dragon-bride': [0, 46, 125], 'crimson-dragon': [50, 12, 100], 'sakura-dusk': [50, 20, 100], 'neon-rain': [50, 64, 100] };
  const FOCUS = { 'crimson-dragon': ['auto 340%', '85% 30%'] };
  const cssString = (s) => '"' + String(s).replace(/["\\]/g, '\\$&').replace(/[\n\r]/g, ' ') + '"';

  /* id: scene id ('custom' for your picture); theme: the solve; urls: { wall,
     blur, mote }; glass: { dense }; name: shown in the episode header's arc chip */
  function build(id, theme, urls, glass, name) {
    const { rgba } = root.LCTSAnimeCss;
    const card = over(Math.max(0.9, (glass && glass.dense) || 0.9), theme.alpha.desk);
    const focus = FOCUS[id] || ['cover', 'center'];
    return root.LCTSAnimeCss.build(theme, { wall: urls.wall, blur: urls.blur }) +
      `html[data-cf-theme="anime"]{` +
      `--cf-scene-size:${focus[0]};--cf-scene-pos:${focus[1]};--cf-banner-pos:${(BANNER[id] || [50])[0]}% ${(BANNER[id] || [0, 42])[1]}%;--cf-banner-size:${(BANNER[id] || [0, 0, 100])[2]}% auto;` +
      `--cf-scene-wall:url("${urls.wall}");` +
      `--cf-scene-name:${cssString(name ? name + ' · ' : '')};` +
      /* drifting petals for blossom scenes, soft light motes for the others */
      `--cf-mote-mask:url("${urls.mote}");` +
      `--cf-surface-card:${rgba(theme.scrim, card)};` +
      `--cf-surface-sticky:${rgba(theme.scrim, 0.97)};` +
      /* the header shows the picture, calmed enough that nav text never sits
         on raw blossoms: at least 66% scrim on top of the desk veil (at 55% the
         brightest scenes' moons left the nav at 3.45:1) */
      `--cf-masthead:${rgba(theme.scrim, Math.max(0.66, theme.alpha.nav))};}`;
  }
  const petals = (id) => /blossom|sakura|shrine/.test(id);

  root.CFTSAnimeBlock = { build, petals };
})(globalThis);
