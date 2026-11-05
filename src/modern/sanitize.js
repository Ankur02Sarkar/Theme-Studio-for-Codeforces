/* =============================================================================
   sanitize.js  (isolated world; also loaded by harness/modern-sanitize.mjs)   MODERN.md M2c
   Every HTML string from Codeforces' API (blog entries, comments, the problemTutorial answer) goes through DOMPurify
   (vendor/dompurify, 3.4.17, Apache-2.0 / MPL-2.0) with the allow-list below BEFORE it touches the page. No home-made parsing.
     - tags: reading material only (no script, style, iframe, object, embed, form controls, svg, math, link, meta, base)
     - attributes: href, src, alt, title, colspan, rowspan, and a few classes Codeforces' own markup needs (rank colours, maths spans)
     - no style attribute, no data-* attributes, no event handlers, no srcset
     - links open in a new tab with rel="noopener noreferrer nofollow"; images only over https
   cfmSanitize(html) -> a string safe to assign to innerHTML of an element in our own container.
============================================================================= */
(() => {
  'use strict';
  const DP = globalThis.DOMPurify;
  if (!DP) { globalThis.cfmSanitize = () => ''; return; }   // never fall back to passing HTML through
  const TAGS = ['a', 'abbr', 'b', 'blockquote', 'br', 'center', 'code', 'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'ol', 'p', 'pre', 'q', 's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'tt', 'u', 'ul', 'var'];
  const ATTR = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'class', 'problemcode'];
  /* the only classes kept: Codeforces' own markup for spoilers, tutorials, handles, maths and code */
  const CLASS_OK = /^(spoiler|spoiler-title|spoiler-content|problemTutorial|rated-user|user-[a-z0-9]+|tex-[a-z0-9-]+|tt|ttypography|bordertable|prettyprint|lang-[a-z0-9+]+)$/;
  let hooked = false;
  function hook() {
    if (hooked) return; hooked = true;
    DP.addHook('uponSanitizeAttribute', (node, d) => {
      if (d.attrName === 'class') { d.attrValue = String(d.attrValue).split(/\s+/).filter((c) => CLASS_OK.test(c)).join(' '); if (!d.attrValue) d.keepAttr = false; }
      if (d.attrName === 'src' && node.tagName === 'IMG' && !/^https:\/\//i.test(String(d.attrValue).trim())) d.keepAttr = false;   // https images only
    });
    DP.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && node.hasAttribute('href')) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer nofollow'); }
      if (node.tagName === 'IMG' && !node.hasAttribute('src')) node.remove();
      if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
    });
  }
  globalThis.cfmSanitize = (html) => {
    hook();
    return DP.sanitize(String(html == null ? '' : html), {
      ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTR, ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, ALLOW_UNKNOWN_PROTOCOLS: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'base', 'svg', 'math', 'template', 'noscript', 'audio', 'video', 'source', 'canvas'],
      FORBID_ATTR: ['style', 'srcset', 'srcdoc', 'formaction', 'action', 'background'],
    });
  };
})();
