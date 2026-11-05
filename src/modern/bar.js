/* =============================================================================
   bar.js  (isolated world, every Codeforces page)   the LeetCode theme's site bar on the pages it does not rebuild
   (user, Oct 30 2026: "our LeetCode navbar on all the pages"). content.js marks those pages with
   html[data-cf-wearer="leetcode"] (Midnight's design in LeetCode's palette); while that is set, the kit's bar (kit.js:
   Problems / Contest / Discuss / Gym, More, search, notifications, Donate, your menu) sits at the top and Codeforces'
   own header and menu row are hidden (html[data-cfm-bar], core.css). Off, another theme, or a rebuilt page: nothing.
============================================================================= */
(() => {
  'use strict';
  const root = document.documentElement;
  let host = null, unwire = null;
  const wanted = () => root.getAttribute('data-cf-wearer') === 'leetcode' && !root.hasAttribute('data-cf-ui');
  const activeOf = (p) => (/^\/problemset/.test(p) ? 'problems' : /^\/(contests?|contestRegistration)\b/.test(p) ? 'contests' : /^\/gyms?\b/.test(p) ? 'gym' : /^\/(blog|page\/|top$|$)/.test(p) ? 'discuss' : '');
  function mount() {
    const K = globalThis.CFM_KIT; if (host || !K || !document.body) return;
    host = document.createElement('div'); host.id = 'cfm-bar'; host.setAttribute('data-cfts', '');
    const sh = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style');
    st.textContent = ':host{all:initial;display:block;position:sticky;top:0;z-index:2147481000;--ui:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;font:14px/21px var(--ui);color:#f5f5f5;-webkit-font-smoothing:antialiased}'
      + '*{box-sizing:border-box;margin:0;padding:0}a{color:inherit;text-decoration:none}button{font:inherit;color:inherit;background:none;border:0}svg.i{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}[hidden]{display:none!important}'
      + (globalThis.CFM_KIT_CSS || '');
    sh.append(st);
    const d = K.me();
    const w = document.createElement('div'); w.innerHTML = K.bar(activeOf(location.pathname), d); sh.append(...w.childNodes);
    document.body.prepend(host);
    root.setAttribute('data-cfm-bar', '');
    unwire = K.wire(sh, d); K.photos(sh);
    dressAuth(K);
  }
  /* /enter and /register: Codeforces' real form as LeetCode's card (core.css, html[data-cfm-auth]). Only a heading and a
     show-password button are added; the form, its scripts and its fields stay Codeforces' own */
  const EYE = '<svg viewBox="0 0 24 24"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYEOFF = '<svg viewBox="0 0 24 24"><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="m2 2 20 20"/></svg>';
  let undoAuth = [];
  function dressAuth(K) {
    if (!/^\/(enter|register)\/?$/.test(location.pathname)) return;
    const box = document.getElementById('pageContent'); if (!box) return;
    root.setAttribute('data-cfm-auth', '');
    undoAuth.push(() => root.removeAttribute('data-cfm-auth'));
    const h = document.createElement('div'); h.className = 'cfm-auth-h'; h.setAttribute('data-cfts', '');
    h.innerHTML = `${K.LOGO}<div>${/register/.test(location.pathname) ? 'Create your account' : 'Sign in to Codeforces'}</div>`;
    box.prepend(h); undoAuth.push(() => h.remove());
    for (const inp of box.querySelectorAll('input[type="password"]')) {
      const wrap = document.createElement('span'); wrap.className = 'cfm-pw'; wrap.setAttribute('data-cfts', '');
      inp.parentNode.insertBefore(wrap, inp); wrap.append(inp);
      const eye = document.createElement('button'); eye.type = 'button'; eye.className = 'cfm-eye'; eye.innerHTML = EYE; eye.title = 'Show password'; eye.setAttribute('aria-label', 'Show password');
      eye.addEventListener('click', () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; eye.innerHTML = show ? EYEOFF : EYE; eye.title = show ? 'Hide password' : 'Show password'; eye.setAttribute('aria-label', eye.title); });
      wrap.append(eye);
      undoAuth.push(() => { inp.type = 'password'; wrap.replaceWith(inp); });
    }
  }
  function unmount() {
    if (!host) return;
    if (unwire) unwire(); unwire = null;
    undoAuth.reverse().forEach((f) => f()); undoAuth = [];
    host.remove(); host = null; root.removeAttribute('data-cfm-bar');
  }
  const sync = () => (wanted() ? mount() : unmount());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true }); else sync();
  /* a live theme switch: content.js updates <html> from the same storage change; read it once that has run */
  chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && (c.cfThemeStudio || c.cfUI)) setTimeout(sync, 60); });
  document.addEventListener('cfm:fail', () => setTimeout(sync, 60));   // a rebuilt page that could not mount wears the bar instead
})();
