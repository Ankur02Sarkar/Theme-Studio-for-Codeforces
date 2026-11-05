/* =============================================================================
   graph.js  (MAIN world, profile pages)
   The rating graph is a flot <canvas>: CSS can't reach its rank bands. This
   re-colours it through flot's own API with the theme's colours, and puts
   Codeforces' colours back on Off.

   - Rank bands (grid.markings) keep their hue but are toned down: saturation
     scaled by --cf-graph-band-sat, drawn at --cf-graph-band-alpha over the
     card, so the rating line carries the eye.
   - Grid lines, tick colour and the points' white fill follow theme roles.
   - A flot plugin applies this to every plot Codeforces draws (the "Only
     rated / All" switch re-plots), and a live switch (cfts:theme) recolours
     the plot on screen. Roles are read from a hidden probe element, so a
     theme controls them in CSS (core.css, section 14).
   No network, no DOM observers: a short decaying schedule waits for flot.
============================================================================= */
(() => {
  const ORIG = '__cftsGraphOriginal';

  function roles() {
    const root = document.documentElement;
    /* light themes keep Codeforces' pastels (Classic is Codeforces' own colours) unless they ask: Paper's sheet is not white */
    if (!root.getAttribute('data-cf-theme')) return null;
    if (root.getAttribute('data-cf-mode') !== 'dark' && !getComputedStyle(root).getPropertyValue('--cf-graph-themed').trim()) return null;
    /* The probe goes on <html>, never <body>: flot can draw while <body> is
       absent (seen on a signed-in profile: "Cannot read properties of null
       (reading 'appendChild')"). The --cf-graph-* tokens are declared on
       <html>, so they resolve there too. */
    const probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
    root.appendChild(probe);
    const read = (v) => { probe.style.color = ''; probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
    const num = (v, d) => { const x = parseFloat(getComputedStyle(probe).getPropertyValue(v)); return Number.isFinite(x) ? x : d; };
    /* the rating line: only when a theme defines --cf-graph-line (Anime: the scene's accent) */
    const lineSet = getComputedStyle(probe).getPropertyValue('--cf-graph-line').trim() !== '';
    const r = { grid: read('--cf-graph-grid'), tick: read('--cf-graph-tick'), point: read('--cf-graph-point'), label: read('--cf-graph-label'),
      line: lineSet ? read('--cf-graph-line') : null,
      alpha: num('--cf-graph-band-alpha', 0.3), sat: num('--cf-graph-band-sat', 0.55),
      /* optional: a theme's label face and line weight (FASTLAP); unset = as before */
      font: getComputedStyle(probe).getPropertyValue('--cf-graph-font').trim() || '600 10px Inter, system-ui, sans-serif',
      width: num('--cf-graph-line-width', 0) };
    probe.remove();
    return r;
  }

  const rgb = (c) => {
    if (c[0] === '#') {
      let h = c.slice(1); if (h.length === 3) h = h.split('').map((x) => x + x).join('');
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    return (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  };
  /* a band, toned down: saturation scaled by `sat` toward its own grey, then
     drawn at `alpha` over the card, so the hue (the rank) survives and the
     rating line carries the eye */
  const tone = (c, r) => {
    const [R, G, B] = rgb(c), y = 0.299 * R + 0.587 * G + 0.114 * B;
    const ch = [R, G, B].map((v) => Math.round(y + (v - y) * r.sat));
    return `rgba(${ch.join(',')},${r.alpha})`;
  };

  /* Guided: each rank band carries its rank's name at its right edge (the
     bands carry meaning). Drawn on flot's own canvas after the plot, so it
     follows every re-plot; a theme that keeps Codeforces' positions, and Off, draw nothing. */
  const RANKS = [[3000, 'Legendary Grandmaster'], [2600, 'International Grandmaster'], [2400, 'Grandmaster'], [2300, 'International Master'],
    [2100, 'Master'], [1900, 'Candidate Master'], [1600, 'Expert'], [1400, 'Specialist'], [1200, 'Pupil'], [-1e9, 'Newbie']];
  function labelBands(plot, ctx) {
    const root = document.documentElement;
    if (!guided()) return;
    const r = roles();
    if (!r) return;
    const marks = plot.getOptions().grid.markings;
    if (!Array.isArray(marks)) return;
    const y = plot.getAxes().yaxis, off = plot.getPlotOffset(), w = plot.width();
    ctx.save();
    ctx.font = r.font;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';      // at each band's lower edge: flot's legend sits in the top corner
    ctx.fillStyle = r.label;
    for (const m of marks) {
      if (!m.yaxis) continue;
      /* an open-ended band (the top one has no upper bound) runs to the axis edge */
      const f = m.yaxis.from == null ? y.min : m.yaxis.from, t = m.yaxis.to == null ? y.max : m.yaxis.to;
      const lo = Math.max(Math.min(f, t), y.min), hi = Math.min(Math.max(f, t), y.max);
      if (!(hi > lo)) continue;
      const top = off.top + y.p2c(hi), bottom = off.top + y.p2c(lo);
      if (bottom - top < 14) continue;
      const name = (RANKS.find(([t]) => lo >= t) || RANKS[RANKS.length - 1])[1];
      ctx.fillText(name, off.left + w - 6, bottom - 2);
    }
    ctx.restore();
  }

  /* options -> themed options (or back), remembering Codeforces' values once */
  function style(o, r) {
    const g = o.grid;
    if (!o[ORIG]) {
      o[ORIG] = {
        markings: Array.isArray(g.markings) ? g.markings.map((m) => m.color) : null,
        color: g.color, borderColor: g.borderColor, tickColor: g.tickColor,
        axes: (o.xaxes || []).concat(o.yaxes || []).map((a) => [a.color, a.tickColor]),
        yticks: (o.yaxes || []).map((a) => a.ticks),
      };
    }
    const O = o[ORIG];
    if (Array.isArray(g.markings) && O.markings) g.markings.forEach((m, i) => { m.color = r ? tone(O.markings[i], r) : O.markings[i]; });
    g.color = r ? r.grid : O.color;
    g.borderColor = r ? r.tick : O.borderColor;
    g.tickColor = r ? r.tick : O.tickColor;
    (o.xaxes || []).concat(o.yaxes || []).forEach((a, i) => {
      if (!O.axes[i]) return;
      a.color = r ? r.grid : O.axes[i][0];
      a.tickColor = r ? r.tick : O.axes[i][1];
    });
    /* Guided: evenly spaced rating ticks (every 500). Codeforces ticks every
       rank edge (…2300, 2400, 2600…), whose labels collide; in Guided the band
       names already mark the edges. Those themes and Off keep Codeforces' ticks. */
    (o.yaxes || []).forEach((a, i) => { a.ticks = r && guided() ? every500 : O.yticks[i]; });
  }
  const guided = () => document.documentElement.getAttribute('data-cf-layout') === 'guided' && !document.documentElement.hasAttribute('data-cf-live');
  function every500(axis) {
    const out = [];
    for (let v = Math.ceil(axis.min / 500) * 500; v <= axis.max; v += 500) out.push(v);
    return out;
  }
  function stylePoints(series, r) {
    for (const s of series) {
      if (!s.points) continue;
      if (s.__cftsFill === undefined) { s.__cftsFill = s.points.fillColor; s.__cftsRadius = s.points.radius; s.__cftsColor = s.color; s.__cftsWidth = s.lines && s.lines.lineWidth; }
      s.points.fillColor = r ? r.point : s.__cftsFill;
      s.color = r && r.line ? r.line : s.__cftsColor;
      if (s.lines) s.lines.lineWidth = r && r.width ? r.width : s.__cftsWidth;
      /* Guided: small points, so the line reads as a line */
      s.points.radius = r && guided() ? 1.5 : s.__cftsRadius;
    }
  }

  function recolour() {
    const $ = window.jQuery;
    if (!$) return;
    const r = roles();
    $('.flot-base').closest('[id]').each(function () {
      const plot = $(this).data('plot');
      if (!plot) return;
      const o = plot.getOptions(), series = plot.getData();
      style(o, r);
      stylePoints(series, r);
      /* A fresh plot on the same placeholder, not resize()+draw(): flot 0.8
         caches tick-label sizes per canvas (measured in the old font, with no
         API to clear them) and the canvas was sized for the old column, so
         after a switch the plot area stayed a few px off. $.plot reuses the
         canvases, shuts the old plot down and measures afresh; Codeforces'
         hover handlers are bound to the placeholder and survive. */
      $.plot($(this), series, o);
    });
  }

  let installed = false;
  function install() {
    const $ = window.jQuery;
    if (installed || !$ || !$.plot || !$.plot.plugins) return false;
    installed = true;
    $.plot.plugins.push({
      name: 'cfts-theme', version: '1',
      init(plot) {
        /* never let the theme break Codeforces' graph: an exception in a flot
           hook aborts $.plot, so a failure here leaves the stock colours */
        plot.hooks.processOptions.push((p, o) => { try { const r = roles(); if (r) style(o, r); } catch (e) { /* stock colours */ } });
        plot.hooks.processDatapoints.push((p, s) => { try { const r = roles(); if (r) stylePoints([s], r); } catch (e) { /* stock colours */ } });
        plot.hooks.draw.push((p, ctx) => { try { labelBands(p, ctx); } catch (e) { /* no labels */ } });
      },
    });
    recolour();               // a plot drawn before the plugin existed
    return true;
  }

  if (!/^\/profile\//.test(location.pathname)) return;
  /* jQuery and flot load from the page's head, so they exist at
     DOMContentLoaded, and this listener (registered at document_start) runs
     before Codeforces' own ready handler draws the plot. A short fallback
     covers anything later. */
  const attempt = () => { if (!installed) install(); };
  document.addEventListener('DOMContentLoaded', () => { attempt(); [300, 1500].forEach((ms) => setTimeout(attempt, ms)); }, { once: true });
  document.addEventListener('cfts:theme', () => setTimeout(recolour, 30));
})();
