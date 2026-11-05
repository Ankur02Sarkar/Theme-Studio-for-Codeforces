/* =============================================================================
   relayout.js  (MAIN world)
   Two things Codeforces measures ONCE, with whatever font is on screen, and
   that a LIVE theme switch (including Off) would leave stale:
   - MathJax 2 bakes a font scale into every formula, matched to the x-height
     of the text around it; a theme sets a different prose face, so the
     statement would reflow. -> ask the page's MathJax to re-render.
   - The second-level menu's "lava" slider (li.backLava) keeps the box of the
     highlighted item as measured in the old font. -> set them
     to that item's offset box, which is exactly what
     Codeforces' lavalamp computes. Firing its own mouseout handler instead
     worked only sometimes (it raced the switch), so the geometry is written
     directly, twice: after the switch settles and after late reflows.
   content.js fires "cfts:theme" on a live switch only; nothing runs on first
   load (both measure after our CSS is already in place). No network.

   Also (Phase 5.5): src/verdicts.js asks for Codeforces' own verdict markup
   (preparedVerdictFormats, in the page's language) with "cfts:formats"; the
   answer is a JSON string in "cfts:formats-data" (the isolated world can't
   read page globals).
============================================================================= */
(() => {
  function resetLava() {
    for (const ul of document.querySelectorAll('.second-level-menu-list')) {
      const back = ul.querySelector('li.backLava');
      const sel = ul.querySelector('li.selectedLava') || ul.querySelector('li.current');
      if (!back || !sel || sel === back) continue;
      back.style.left = sel.offsetLeft + 'px';
      back.style.width = sel.offsetWidth + 'px';
      back.style.top = sel.offsetTop + 'px';
      back.style.height = sel.offsetHeight + 'px';   // the themed pill is taller (25 px vs 20)
    }
  }
  document.addEventListener('cfts:formats', () => {
    let json = '';
    try { const f = window.preparedVerdictFormats; if (f) json = JSON.stringify(Object.assign({}, f)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('cfts:formats-data', { detail: json }));
  });
  document.addEventListener('cfts:theme', () => {
    const MJ = window.MathJax;
    if (MJ && MJ.Hub && MJ.Hub.Queue) MJ.Hub.Queue(['Rerender', MJ.Hub]);
    /* timers, not requestAnimationFrame, which a background tab never runs */
    setTimeout(resetLava, 120);
    setTimeout(resetLava, 700);
  });
})();
