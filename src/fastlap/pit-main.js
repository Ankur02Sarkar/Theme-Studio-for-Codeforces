/* FASTLAP pit wall, MAIN world (the page's own JavaScript world), only on
   Codeforces' Submit and Custom Test pages, in frames too. The pit wall
   (isolated world) cannot reach Codeforces' Ace editor, which keeps its own
   copy of the code and copies it into the form's textarea on submit. On a
   'fl:source' event (detail: JSON { source }) this sets both, so the code
   that goes out is the code from the panel. It does nothing else, and
   nothing at all unless that event arrives. Plain JS (no build step). */
(() => {
  document.addEventListener('fl:source', (e) => {
    let d = null;
    try { d = JSON.parse(e.detail); } catch (x) { return; }
    if (!d || typeof d.source !== 'string') return;
    const ta = document.querySelector('textarea[name="source"]');
    if (ta) ta.value = d.source;
    const ed = document.querySelector('.ace_editor');
    if (ed && window.ace && window.ace.edit) {
      try { window.ace.edit(ed).setValue(d.source, 1); } catch (x) { /* the textarea has it */ }
    }
  });
})();
