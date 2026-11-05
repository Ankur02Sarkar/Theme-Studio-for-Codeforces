/* =============================================================================
   anime/onair.js  (content script)   the broadcast: how a submission is told in Anime (ANIME.md)

   There is no arena and no health bar: that is a game's grammar. Press Submit and the show cuts in.
     The launch     a cut-in crosses the screen before the bars close.
     The standoff   black bars, and every test Codeforces reports is a CUT with an impact: burnt frames, a colour split, sparks over the bars.
                    The frame tightens and everything heats up as tests pass: tension, not damage. Drawn by sakuga.js, which never holds still.
     Subtitles      the facts, in plain words, where a subtitle goes.
     The verdict    a beat of black, then a trope of the medium, one per verdict:
                    Wrong answer つづく + a next-episode preview of the failing test; Time limit a time skip; Memory limit a power reading;
                    Runtime error a broadcast accident; Compilation error a storyboard sent back for a retake; Pretests an eyecatch.
                    Accepted is an iai cut, then the manga page (manga.js).
   A click or Esc keeps you reading: the show shrinks to a light beside Submit, and the verdict still gets its scene.
   Every scene ends by itself. Verdicts off or reduced motion: the light and the notes, nothing else.
============================================================================= */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CYCLE = ['eye', 'num', 'rival', 'run', 'blade', 'num', 'clash', 'moon'], BROLL = ['stance', 'eye', 'blade', 'run', 'moon', 'rival', 'clash'];
  const OPEN = 74, TIGHT = 50, MIN_CUT = 140;

  function build(c) {
    const { j, app, ep, art, tick, onVerdict } = c;
    let sfx = () => {};
    const air = j.make(`<div id="am-air" hidden aria-live="polite">
      <div class="frame"><div class="shot"></div></div>
      <div class="bar top"><span class="lamp"><i></i><b class="jp">放送中</b><span>On air</span></span><span class="ttl">Episode ${esc(ep.tag)}: ${esc(ep.name)}</span><button class="keep" type="button">Keep reading</button></div>
      <div class="bar bot"><div class="ticks"></div><p class="line"></p><span class="time"></span></div>
    </div>`);
    j.insert(air, app);
    const shot = air.querySelector('.shot'), line = air.querySelector('.line'), time = air.querySelector('.time'), ticks = air.querySelector('.ticks');
    const K = globalThis.__cftsSakuga, sk = K.create(air.querySelector('.frame'), air, art, ep);
    K.ready();
    const timers = [];
    let bedT = 0, sentAt = 0, live = false, scene = false, n = 0, lastCut = 0, t0 = 0, clock = 0, wanted = true, diff = null, onEnd = null, kept = false;
    const later = (ms, f) => timers.push(setTimeout(f, ms));
    const wipe = () => { timers.splice(0).forEach(clearTimeout); };
    const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const size = (vh) => { air.style.setProperty('--open', `${vh}vh`); sk.band(vh / 100); };
    const say = (t) => { line.textContent = t; };
    const light = (t) => { tick.querySelector('span').textContent = t; };
    const dom = (html, cls = '') => { sk.blank(); shot.className = `shot ${cls}`; shot.innerHTML = html; };
    const undom = () => { shot.className = 'shot'; shot.innerHTML = ''; };

    function reveal(bars = true) {
      if (!wanted) return;
      sk.wall((globalThis.__lctsAnimeScene || {}).wall);          // the show plays in the scene you are on, your own picture included
      air.hidden = false;
      sk.start();
      void air.offsetWidth;              // the closed bars are the first frame
      if (bars) air.classList.add('in');
    }
    function retire() { air.classList.remove('in', 'cold'); air.hidden = true; sk.stop(); undom(); }
    /* nothing leaves on a hard cut: the bars draw back and the picture fades into your page */
    let fading = null;
    function end(ms = 460) {
      wipe(); scene = false;
      const done = () => { if (fading) fading.cancel(); fading = null; retire(); if (onEnd) { const f = onEnd; onEnd = null; f(); } };
      if (air.hidden) return done();
      air.classList.remove('in');
      fading = air.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' });
      fading.onfinish = done;
      return undefined;
    }
    const unfade = () => { if (fading) { fading.onfinish = null; fading.cancel(); fading = null; } };
    function stopLive() { live = false; clearInterval(bedT); clearInterval(clock); clock = 0; tick.hidden = true; ticks.innerHTML = ''; }
    function standoff() { sk.cut('stance', { kind: 'slash' }); sk.impact(.7, { burn: 2 }); sk.auto(true, BROLL); air.classList.add('in'); sfx('cut'); sfx('slam'); bed(); }
    /* the bed runs for as long as the judge does; the audio device stays up so no cue waits for it */
    const bed = () => { clearInterval(bedT); sfx('bed'); wake(); bedT = setInterval(() => { if (live && !air.hidden) { sfx('bed'); wake(); } }, 2400); };
    const wake = () => { const A = globalThis.LCTSSounds; try { if (A && A.mayStart()) A.wake(8000); } catch (e) { /* no sound is fine */ } };
    function sending(fx) {
      wipe(); unfade(); stopLive(); scene = false; onEnd = null; diff = null; n = 0; lastCut = 0;
      kept = false;                     // Keep reading holds for one run: the next Submit is a new episode
      wanted = fx && !still();
      live = true; t0 = Date.now(); sentAt = performance.now();
      size(OPEN); sk.heat(0); air.style.setProperty('--heat', 0); undom();
      say('Sending your code'); time.textContent = '';
      tick.hidden = false; light('Sending');
      clock = setInterval(() => { time.textContent = `${Math.round((Date.now() - t0) / 1000)} s`; }, 1000);
      reveal(false);
      if (!wanted) return;
      /* the launch: a cut-in crosses the screen before the bars have closed */
      sk.cut('launch', { hard: true }); sk.fx.flash(.9); sfx('launch'); wake();
      later(170, () => sfx('panel'));                                      // the words land
      later(240, () => { sk.impact(.8, { burn: 2, lines: false }); sfx('slam'); });
      later(760, standoff);
    }
    function keep() { kept = true; wipe(); air.classList.remove('in'); air.hidden = true; sk.stop(); }      // this page's choice: you are reading
    function bring() { kept = false; wanted = true; reveal(); sk.cut('stance', { hard: true }); sk.auto(true, BROLL); }
    function waitingFor(label) { if (!label || !live) return; say(label); light(label); }
    function test(k, total) {
      if (!live) return;
      n = k;
      say(total ? `Running on test ${k} of ${total}` : `Running on test ${k}`); light(`Test ${k}`);
      if (total && total <= 160) {
        if (ticks.childElementCount !== total) ticks.innerHTML = '<i></i>'.repeat(total);
        ticks.querySelectorAll('i').forEach((x, i) => x.classList.toggle('on', i < k));
      }
      /* no health to take: the frame closes in and the whole picture heats up. Exact with a known total; without one it can't shut before the verdict */
      const heat = total ? Math.min(1, (k - 1) / total) : 1 - 24 / (24 + k - 1);
      size(OPEN - (OPEN - TIGHT) * heat);
      sk.heat(heat); air.style.setProperty('--heat', heat.toFixed(2));
      const now = performance.now();
      if (now - lastCut < MIN_CUT || air.hidden) return;            // Codeforces can report faster than a cut can be seen
      lastCut = now;
      sk.cut(CYCLE[(k - 1) % CYCLE.length], { k });
      sk.impact(.55 + heat * .7);
      sfx('cut'); sfx('heart');
    }

    const preview = (r) => {
      const head = r.n ? `Test ${r.n}` : 'The rematch';
      dom(`<div class="yokoku"><div class="v jp">${[...'次回予告'].map((x, i) => `<b style="--i:${i}">${x}</b>`).join('')}</div><div class="pv"><h3>Next time: ${esc(head)}</h3><dl></dl><p>The full test is in your notes.</p></div></div>`, 's-preview');
      fill();
      sk.fx.flash(.8); sk.fx.ring(innerWidth / 2, innerHeight / 2, '#fff', 1.4); sfx('eyecatch'); sfx('cut');
    };
    const brief = (t) => { const x = String(t == null ? '' : t).trim().split('\n')[0]; return x.length > 44 ? `${x.slice(0, 44)}…` : x; };
    function fill() {
      const dl = shot.querySelector('.yokoku dl');
      if (!dl || !diff) return;
      dl.innerHTML = `<dt>Expected</dt><dd>${esc(brief(diff.answer))}</dd><dt>You printed</dt><dd>${esc(brief(diff.output))}</dd>`;
      const h = shot.querySelector('.yokoku h3');
      if (h && diff.num) h.textContent = `Next time: Test ${diff.num}`;
    }
    const SCENE = {
      wa(r) {
        sk.cut('tbc', { hard: true }); sk.impact(1.5, { burn: 3 }); say(r.text); sfx('hit'); sfx('cliff');
        later(340, () => { sk.impact(.4, { burn: false, x: innerWidth * .71 }); sk.fx.splat(innerWidth * .71, innerHeight * .54, 30, '#fff', .8); sfx('slam'); });
        later(1900, () => preview(r));
        later(4400, () => end());
      },
      tle(r) {
        const spent = /^\d+ ms$/.test(r.time || '') && !/^0 /.test(r.time) ? `${r.time} later` : 'Some time later';
        sk.data({ spent }); sk.cut('lapse', { kind: 'whip' }); say(r.text); sfx('timeskip'); sfx('cut');
        [1300, 1460, 1620].forEach((ms) => later(ms, () => sfx('panel')));
        later(1760, () => sfx('crickets'));
        later(3500, () => end());
      },
      mle(r) {
        sk.data({ goal: parseInt(r.mem, 10) || ep.memKb || 262144 });
        sk.cut('scouter', { kind: 'iris' }); say(r.text); sfx('scouter'); sfx('cut');
        later(1100, () => { sk.impact(1.8, { burn: 3, col: '#ff3c4c', spark: '#ff8a90' }); sk.fx.sparks(innerWidth / 2, innerHeight / 2, 80, '#fff', 1.2); sfx('glass'); });
        later(3100, () => end());
      },
      err(r) {
        sk.cut('glitch', { hard: true }); sk.impact(1, { burn: 2, lines: false }); say(r.text); sfx('static'); sfx('slam');
        later(550, () => sfx('testtone'));
        later(3300, () => end());
      },
      ce() {
        dom(`<div class="conte">${[0, 1, 2].map((i) => `<span class="cell c${i}" style="--i:${i}"><img src="${[art.stand, art.strike, art.down][i]}" alt=""></span>`).join('')}<svg class="redo" viewBox="0 0 1000 300" aria-hidden="true"><path pathLength="1" d="M70 170 C 150 40 840 10 930 130 C 980 230 330 300 120 230 C 40 200 60 120 190 90"/></svg><b class="retake jp">リテイク</b></div>`, 's-paper');
        say('Compilation error. No test ran, and this attempt costs nothing.');
        [0, 110, 220].forEach((ms) => later(ms, () => sfx('panel')));
        later(420, () => sfx('pen'));
        later(760, () => { sk.impact(1.1, { burn: false, col: '#d21f2f', spark: '#d21f2f' }); sk.fx.splat(innerWidth / 2, innerHeight / 2, 44, '#d21f2f', 1); air.querySelector('.frame').animate([{ transform: 'translate(10px,6px)' }, { transform: 'translate(-8px,-4px)' }, { transform: 'none' }], 200); sfx('retake'); });
        later(3100, () => end());
      },
      pretests(r) {
        dom(`<div class="eyecatch"><i></i><img src="${art.strike}" alt=""><b>${esc(r.text)}</b></div>`, 's-eye');
        sk.fx.flash(1); sk.fx.petals(30, innerWidth, innerHeight); say(r.text); sfx('eyecatch'); sfx('slam');
        later(2100, () => end());
      },
      /* iai: the blow has already landed. A line of light, a click of the sheath, and for a long moment nothing; then the rival comes apart */
      ac(r, o) {
        sk.cut('iai', { hard: true }); sk.auto(false);
        air.classList.remove('in');
        later(200, () => sfx('sheathe'));
        later(920, () => { sk.impact(2, { burn: 4, x: innerWidth * .3 }); sk.fx.sparks(innerWidth * .3, innerHeight / 2, 110, '#fff', 1.4); sfx('smash'); });
        later(1240, () => o.editorPaint((paint) => {
          air.hidden = true; sk.stop();
          const played = globalThis.__cftsAnimeManga && globalThis.__cftsAnimeManga.play(Object.assign(c.page(), { paint, time: /^0 /.test(r.time || '') ? '' : r.time, mem: /^0 /.test(r.mem || '') ? '' : r.mem, first: o.first, tries: o.tries, sound: sfx, onEnd: () => end(1) }));
          if (!played) end();
        }));
      },
    };
    SCENE.hacked = SCENE.wa;
    function verdict(kind, r, o) {
      wipe(); unfade(); stopLive(); onVerdict(kind, r);
      if (still() || !SCENE[kind]) return quiet();
      scene = true; kept = false; wanted = true;
      sk.auto(false); undom();
      size(kind === 'ac' ? OPEN : 68); sk.heat(0); air.style.setProperty('--heat', 0);
      if (air.hidden) reveal();
      say(''); time.textContent = '';
      /* one held breath of black before the answer */
      sk.cut('hold', { hard: true });
      later(kind === 'ac' ? 240 : 200, () => SCENE[kind](r, o));
      return undefined;
    }
    function quiet(kind, r) { if (kind) onVerdict(kind, r); wipe(); stopLive(); scene = false; retire(); }
    function clear() { wipe(); unfade(); stopLive(); scene = false; retire(); onEnd = null; }

    /* the cold open: the episode's title card, once a session per problem. It never waits for you */
    function coldOpen() {
      if (still()) return;
      kept = false; wanted = true; scene = true;
      air.classList.add('cold');
      sk.data({ name: ep.name, tag: ep.tag, jp: ep.jp, rival: ep.rival, rating: ep.rating });
      reveal(false);
      K.ready().then(() => {
        sk.cut('title', { hard: true }); sfx('title');
        later(290, () => { sk.impact(1, { burn: 2, lines: false, x: innerWidth * .66, y: innerHeight * .34 }); sk.fx.sparks(innerWidth * .66, innerHeight * .4, 40, '#fff', 1.1); sfx('smash'); });
        later(440, () => sfx('write'));
        [620, 700, 780, 860].slice(0, [...ep.jp].length).forEach((ms) => later(ms, () => sfx('panel')));
        later(1240, () => sfx('ring'));
        later(2050, () => sfx('cut'));
        later(2360, () => end());
      });
    }

    j.on(air, 'pointerdown', () => { if (fading) return; if (scene) end(220); else if (live && performance.now() - sentAt > 600) keep(); });   // the second half of a double-clicked Submit is not a choice
    j.on(document, 'keydown', (e) => { if (air.hidden || fading) return; if (air.classList.contains('cold')) end(220); else if (e.key === 'Escape') { if (scene) end(220); else keep(); } });
    j.on(tick, 'click', bring);
    j.on(document, 'am:sk', (e) => { sk.heat(.7); size(58); sk.cut(e.detail, { hard: true, k: 14 }); });       // tests: any shot, hot
    return {
      bindSound(f) { sfx = f; sk.onSoft(() => sfx('swish')); }, sending, test, verdict, quiet, clear, coldOpen,
      waiting: waitingFor,
      detail(d) { diff = d; fill(); },
    };
  }
  globalThis.__cftsAnimeOnAir = { build };
})();
