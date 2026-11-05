/* =============================================================================
   cf-solve.js — the DENSE glass for Codeforces, as a pure function.

   One copy of the rule, run by both scripts/build-cf-glass.mjs (the bundled
   scenes, written to cf-glass.js) and the Anime Studio (your own picture, and
   any scene re-solved at your settings):

     the lowest total scrim weight D such that, over the picture's
     99.9th-percentile luminance pixel, the composite D*scrim + (1-D)*pixel
     (8-bit sRGB, the way the browser composites) leaves the hardest rating
     ink (#ff6464, red in dark mode) at >= 4.5:1.

   LIGHT glass (opts.mode 'light', Phase 6): the same rule mirrored for the
   light rank set (core.css): the hardest ink is the LIGHTEST one, and the
   worst pixel is the picture's 0.1th-percentile (darkest) luminance, which
   the light scrim must lift until that ink clears 4.5:1.

   The total includes the desk veil the scene already has, so the page layers
   are: sidebar box alpha = over(D, desk); table veil = over(D, panel).

   data: RGBA bytes of the picture drawn 640 px wide (any height).
============================================================================= */
(function (root) {
  'use strict';
  const INK = '#ff6464', TARGET = 4.5, PCT = 0.999;
  /* core.css html[data-cf-mode="light"]: gray green cyan blue violet orange red yellow */
  const LIGHT_INKS = ['#5c5c5c', '#006b00', '#016b65', '#0000e0', '#8f008f', '#9a5200', '#c80000', '#6b6b00'];
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const LIN = new Float64Array(256);
  for (let i = 0; i < 256; i++) LIN[i] = lin(i);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const L = (r, g, b) => 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b];
  const over = (total, under) => Math.max(0, 1 - (1 - total) / (1 - under));

  function dense(data, scrim, alpha, opts) {
    opts = opts || {};
    const light = opts.mode === 'light', target = opts.target || TARGET, pct = opts.pct || PCT;
    const ink = opts.ink || (light ? LIGHT_INKS.reduce((a, b) => (L(...hex(b)) > L(...hex(a)) ? b : a)) : INK);
    const S = typeof scrim === 'string' ? hex(scrim) : scrim, I = hex(ink), Li = L(...I);
    /* dark glass: the background must stay at or under maxBg; light: at or over minBg */
    const maxBg = (Li + 0.05) / target - 0.05, minBg = target * (Li + 0.05) - 0.05;
    const fine = (l) => (light ? l >= minBg : l <= maxBg);
    const n = data.length / 4, ls = new Float32Array(n);
    /* the pct-quantile luminance of the composite at total scrim weight D */
    const worst = (D) => {
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const m = (k) => Math.round(D * S[k] + (1 - D) * data[i + k]);
        ls[j] = L(m(0), m(1), m(2));
      }
      ls.sort();
      return ls[Math.min(n - 1, Math.floor(n * (light ? 1 - pct : pct)))];
    };
    let lo = alpha.panel, hi = 0.98;
    if (fine(worst(lo))) hi = lo;
    else for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (fine(worst(mid))) hi = mid; else lo = mid; }
    const D = Math.ceil(hi * 1000) / 1000;
    const Lw = worst(D);
    return { dense: D, sidebar: +over(D, alpha.desk).toFixed(3), veil: +over(D, alpha.panel).toFixed(3),
      check: +(light ? (Lw + 0.05) / (Li + 0.05) : (Li + 0.05) / (Lw + 0.05)).toFixed(2), mode: light ? 'light' : 'dark', ink };
  }

  root.CFTSDense = { dense, over, INK, LIGHT_INKS, TARGET, PCT, WIDTH: 640 };
})(globalThis);
