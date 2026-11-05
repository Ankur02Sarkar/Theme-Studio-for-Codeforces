/* =============================================================================
   bridge.js  (MAIN world; answers ONLY while Modern (#cfm-app) or the dev box (#cfm-spike) is mounted, so a page with
   neither never reacts to these events: M0 follow-up "off by default")
   Run = Codeforces' Custom invocation, called through the page's OWN jQuery so
   every hook Codeforces adds (the random "rv" parameter, CSRF header handling)
   still applies:
     POST /data/customtest  { csrf_token (added by the page), communityCode:"", action:"submitSourceCode",
                              programTypeId, sourceCode, input, tabSize, _tta }  -> { customTestSubmitId }
     POST /data/customtest  { csrf_token, communityCode:"", action:"getVerdict",
                              customTestSubmitId }  every 2.5 s                  -> { verdict, output, stat, customTestSubmitId }
   (verified against the user's saved /problemset/customtest, Oct 27 2026; stat is "15 ms, 0 KB": the page prints
    "Used: " + stat)
   The isolated world can't reach jQuery, so spike.js talks to us with events:
     "cfm:run"  detail = JSON string { id, programTypeId, sourceCode, input }
     "cfm:run-state" detail = JSON string { id, state: sent|waiting|done|error, ... }
   One run at a time. No retry: an error is reported once and the user decides.
============================================================================= */
(() => {
  let busy = false;
  const live = () => !!(document.getElementById('cfm-app') || document.getElementById('cfm-spike') || document.getElementById('px-duel'));
  const emit = (o) => document.dispatchEvent(new CustomEvent('cfm:run-state', { detail: JSON.stringify(o) }));
  /* the page's own reader (meta[name=X-Csrf-Token], or span.csrf-token; 32 chars) */
  const csrf = () => { try { return window.Codeforces && Codeforces.getCsrfToken ? Codeforces.getCsrfToken() : undefined; } catch (e) { return undefined; } };
  const POLL_MS = 2500, MAX_POLLS = 40;   // the page polls every 2.5 s forever; we give up after 100 s

  /* Is Codeforces' own anti-bot state ready? Its submit handler copies window._ftaa / window._bfaa into the form ONLY
     when both are set (_ftaa comes from an async evercookie read, _bfaa from Fingerprint2 on idle); otherwise it sends
     them empty. spike.js asks before it submits. */
  document.addEventListener('cfm:aa', () => live() && document.dispatchEvent(new CustomEvent('cfm:aa-state', { detail: JSON.stringify({ ftaa: !!window._ftaa, bfaa: !!window._bfaa, jq: !!(window.jQuery && window.jQuery.post), csrf: !!csrf(), mj: !!(window.MathJax && window.MathJax.Hub), cf: !!window.Codeforces }) })));

  document.addEventListener('cfm:run', (ev) => {
    if (!live()) return;
    let req; try { req = JSON.parse(ev.detail); } catch (e) { return; }
    const pollMs = +req.pollMs || POLL_MS;   // a dev/test override (the harness shortens it)
    const id = req.id, $ = window.jQuery;
    if (!$ || !$.post) return emit({ id, state: 'error', error: 'jQuery is not on this page' });
    if (busy) return emit({ id, state: 'error', error: 'A run is already in progress' });
    if (!csrf()) return emit({ id, state: 'error', error: 'No CSRF token on the page (signed out?)' });
    busy = true;
    const done = (o) => { busy = false; emit(Object.assign({ id }, o)); };
    /* what /problemset/customtest's own submitCustomTest() posts: the form's fields (csrf_token, tabSize, programTypeId,
       input, _tta) plus communityCode, action, programTypeId, sourceCode. csrf_token and the X-Csrf-Token header are added
       by the page's ajaxPrefilter / ajaxSetup, and "rv" by its beforeSend, because we call ITS jQuery. The form has NO
       ftaa/bfaa fields, so none are sent. */
    const body = { communityCode: '', action: 'submitSourceCode', programTypeId: req.programTypeId, sourceCode: req.sourceCode, input: req.input, tabSize: 4 };
    try { if (window.Codeforces && Codeforces.tta) { const t = Codeforces.tta(); if (t) body._tta = t; } } catch (e) { /* signForms adds it the same way */ }
    $.post('/data/customtest', body, null, 'json').done((r) => {
      const sid = r && r.customTestSubmitId;
      if (!sid) return done({ state: 'error', error: 'No customTestSubmitId in the answer (Codeforces setAjaxFormErrors shape?)', raw: r });
      emit({ id, state: 'sent', customTestSubmitId: sid });
      let n = 0;
      const poll = () => {
        if (++n > MAX_POLLS) return done({ state: 'error', error: 'Timed out waiting for the verdict' });
        $.post('/data/customtest', { communityCode: '', action: 'getVerdict', customTestSubmitId: sid }, null, 'json')
          .done((v) => {
            /* the page's own test: verdict != null and the answer is for this id */
            if (v && v.verdict != null && String(v.customTestSubmitId) === String(sid)) return done({ state: 'done', verdict: v.verdict, output: v.output, stat: v.stat, raw: v });
            emit({ id, state: 'waiting', n });
            setTimeout(poll, pollMs);
          })
          .fail((x) => done({ state: 'error', error: 'getVerdict failed: HTTP ' + x.status }));
      };
      setTimeout(poll, pollMs);
    }).fail((x) => done({ state: 'error', error: 'customtest failed: HTTP ' + x.status + ' ' + String(x.responseText || '').slice(0, 200) }));
  });

  /* A finished submission's per-test details (input, your output, the answer, the checker's line) come from the page's own
     POST /data/submitSource {submissionId}: the call the status page's source popup makes. One request per opened
     non-Accepted submission, own submissions only. detail = JSON { id, submissionId }; answer "cfm:src-state" = JSON
     { id, ok, data | error }. csrf_token and the X-Csrf-Token header are added by the page's ajax hooks. */
  document.addEventListener('cfm:src', (ev) => {
    if (!live()) return;
    let req; try { req = JSON.parse(ev.detail); } catch (e) { return; }
    const out = (o) => document.dispatchEvent(new CustomEvent('cfm:src-state', { detail: JSON.stringify(Object.assign({ id: req.id }, o)) }));
    const $ = window.jQuery;
    if (!$ || !$.post) return out({ ok: false, error: 'jQuery is not on this page' });
    if (!csrf()) return out({ ok: false, error: 'No CSRF token on the page (signed out?)' });
    $.post('/data/submitSource', { submissionId: req.submissionId }, null, 'json')
      .done((d) => out({ ok: true, data: d }))
      .fail((x) => out({ ok: false, error: 'submitSource failed: HTTP ' + x.status }));
  });

  /* An editorial's Tutorial text is not in blogEntry.view (the entry holds "Tutorial is loading..." placeholders). Codeforces' own
     Codeforces.setupTutorials() fills each with POST /data/problemTutorial {problemCode}; we do ONE such POST for the problem
     being read, when its Tutorial block opens. detail = JSON { id, problemCode }; answer "cfm:tut-state" = JSON { id, ok, data | error }
     where data = { success, public, html } (the html is sanitised by the caller, never inserted raw). */
  document.addEventListener('cfm:tut', (ev) => {
    if (!live()) return;
    let req; try { req = JSON.parse(ev.detail); } catch (e) { return; }
    const out = (o) => document.dispatchEvent(new CustomEvent('cfm:tut-state', { detail: JSON.stringify(Object.assign({ id: req.id }, o)) }));
    const $ = window.jQuery;
    if (!$ || !$.post) return out({ ok: false, error: 'jQuery is not on this page' });
    if (!csrf()) return out({ ok: false, error: 'No CSRF token on the page (signed out?)' });
    $.post('/data/problemTutorial', { problemCode: req.problemCode }, null, 'json')
      .done((d) => out({ ok: true, data: d }))
      .fail((x) => out({ ok: false, error: 'problemTutorial failed: HTTP ' + x.status }));
  });
  /* MathJax 2 typesets what it is asked to: after we insert sanitised editorial/comment HTML into #cfm-rich (light DOM,
     so MathJax's document styles apply), the isolated world asks the page's MathJax to typeset that element. */
  document.addEventListener('cfm:typeset', (ev) => {
    if (!live()) return;
    const id = String(ev.detail || ''), t0 = Date.now();
    const go = () => {
      try {
        const el = document.getElementById(id), MJ = window.MathJax;
        if (el && MJ && MJ.Hub && MJ.Hub.Queue) return MJ.Hub.Queue(['Typeset', MJ.Hub, el]);
        if (el && Date.now() - t0 < 20000) setTimeout(go, 250);   // MathJax not loaded yet (it loads late on slow pages)
      } catch (e) { /* maths stays as TeX */ }
    };
    go();
  });
})();
