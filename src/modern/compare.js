/* Sample comparison for Run (MODERN.md, "Run never judges custom input"): only a SAMPLE run is compared with the
   sample's output, and trailing whitespace on each line and the final newline(s) do not count. Everything else does:
   inner spaces, case, blank lines in the middle. Pure; used by the Run UI and tested in harness/compare.test.mjs. */
(function (root) {
  const norm = (s) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t\f\v]+$/, '')).join('\n').replace(/\n+$/, '');
  const sameOutput = (a, b) => norm(a) === norm(b);
  root.cfmCompare = { norm, sameOutput };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.cfmCompare;
})(typeof globalThis !== 'undefined' ? globalThis : this);
