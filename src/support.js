/* =============================================================================
   support.js — the one place the "Support" and "Report bug" links point.
   Copied from Theme Studio for LeetCode (src/support.js); changes marked CF:.

   Used by the popup footer and the Anime Studio header. Report bug opens a
   Gmail draft to report@vinaytz.com with a short template and the version,
   browser, theme and layout filled in (nothing is sent until the user sends
   it). Support opens YOUR page rather than a payment provider directly, so
   the provider can change without an extension update or a new store review.
============================================================================= */
(function (root) {
  root.LCTS_SUPPORT_URL = 'https://extensions.vinaytz.com/support';
  root.LCTS_BUG_EMAIL = 'report@vinaytz.com';

  /* a Gmail compose window, pre-filled; the details help reproduce the bug */
  async function bugUrl() {
    let theme = 'anime';
    try {
      const r = await chrome.storage.local.get(['cfThemeStudio']);   // CF: Codeforces' keys
      theme = r.cfThemeStudio || 'anime';
    } catch (e) {}
    const ua = navigator.userAgent;
    const browser = (/Firefox\/(\d+)/.exec(ua) || [])[0] || (/Edg\/(\d+)/.exec(ua) || [])[0] || (/Chrome\/(\d+)/.exec(ua) || [])[0] || 'unknown browser';
    const v = chrome.runtime.getManifest().version;
    /* CF: a page link, not a problem link (every Codeforces page is themed) */
    const body = 'Hi Vinay,\n\nWhat happened:\n\n\nWhat I expected:\n\n\nPage link (if any):\n\n\n---\n' +
      `Theme Studio for Codeforces ${v} · ${browser.replace('/', ' ')} · theme: ${theme}`;
    return 'https://mail.google.com/mail/?view=cm&fs=1' +
      '&to=' + encodeURIComponent(root.LCTS_BUG_EMAIL) +
      '&su=' + encodeURIComponent(`Theme Studio for Codeforces bug report (v${v})`) +
      '&body=' + encodeURIComponent(body);
  }

  function opens(url) {
    return function (el) {
      if (!el) return;
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: typeof url === 'function' ? await url() : root[url] });
      });
    };
  }
  root.LCTSSupportButton = opens('LCTS_SUPPORT_URL');
  root.LCTSBugButton = opens(bugUrl);
  /* CF: no Connect button (PLAN.md phase 5: Support and Report bug) */
})(globalThis);
