/* =============================================================================
   cf-sounds.js -- the Codeforces sound pack (PLAN.md phase 3R).

   Every moment's sound, synthesised with the sister's voices (sounds.js:
   tone, filtered noise, drum, chip) and played through its plumbing (the
   compressor bus, autoplay rules, the offscreen page). Nothing is a file.
   Each effect is timed to its moment in themes/fx.css; every envelope ends in
   silence well inside the moment's 2.2 s (checked by harness/sfx.mjs: peak
   under clipping, a silent tail).

   Families: IMPACT (drum + sub drop + low noise), SLASH (a bright noise sweep
   with a falling saw), SHATTER (a crack, a noise burst, ringing shards), TIME
   STOP (a reversed whoosh into a stopped clock and a hum), ARCADE (square and
   triangle chips only, for Pixel Art) and the PRESS (paper whoosh, press thump,
   typewriter, rubber stamp, for Vintage Paper).

   Kinds per theme (cf-fx.js asks for them by name):
     anime  vs, vs-boss, tick-1..5, finisher, guard, stumble, hit, timestop,
            overload, ambush, shatter, awaken, and the broadcast's cues (cut, slam, smash, launch, title, write ...)
     pixel  fight, tick-1..5, ko, perfect, continue, syntax, pretests, levelup,
            press, bonk, jump, cast, hit-1..5, coin, whiff, ready, victory, flawless, lose, slow, overflow, crash, fizzle, getup, crackle, smash, clack, rebuild, shoot, boom, thunder, thunderclap, rumble, charge, beam (the duel)
     paper  extra, pretests, correction, promoted
     fastlap pass, fastest, pretests, flag, crash, limit, memory, pit, review, promoted
             (each wrapped in an original team-radio open and close)
============================================================================= */
(function (root) {
  'use strict';
  const SFX = root.LCTSSounds;
  if (!SFX || !SFX.register) return;
  const { tone, noise, drum, chip, N } = SFX.voices;

  /* ---- families ------------------------------------------------------------ */
  function impact(b, t, k) {
    k = k || 1;
    drum(b, t, 52, 0.9 * k);
    tone(b, t, { freq: 68, to: 28, glide: 0.7, dur: 0.95, gain: 0.42 * k, attack: 0.002 });
    noise(b, t, { filter: 'lowpass', freq: 1800, to: 80, dur: 0.9, gain: 0.32 * k, attack: 0.002, wet: 0.35 });
  }
  function slash(b, t, k) {
    k = k || 1;
    noise(b, t, { filter: 'highpass', freq: 1800, to: 9000, dur: 0.16, gain: 0.3 * k, attack: 0.01 });
    tone(b, t, { type: 'sawtooth', freq: 2200, to: 260, glide: 0.14, dur: 0.16, gain: 0.07 * k, lowpass: 6000, attack: 0.002, wet: 0.3 });
  }
  function whoosh(b, t, from, to, dur, gain, swell) {
    noise(b, t, { freq: from, to, dur, gain, q: 0.9, attack: swell ? dur * 0.85 : 0.05, wet: 0.25 });
  }
  function shards(b, t, n, spread) {
    for (let i = 0; i < n; i++) {
      const f = 2200 + ((i * 1733) % 4200);
      tone(b, t + (i * 37 % 100) / 100 * spread, { freq: f, dur: 0.18 + (i % 4) * 0.08, gain: 0.03 + (i % 3) * 0.01, attack: 0.001, wet: 0.6 });
    }
  }
  const ticks = (pack, fn) => { for (let l = 1; l <= 5; l++) pack['tick-' + l] = (b) => fn(b, l); };

  /* ---- Anime Studio: shonen battle --------------------------------------- */
  const ANIME = {
    /* the panels slam in (0-180 ms), VS lands with a clang at ~200 ms */
    vs(b) {
      whoosh(b, 0, 300, 2600, 0.2, 0.16, true);
      drum(b, 0.18, 64, 0.85);
      tone(b, 0.2, { type: 'triangle', freq: 1046, dur: 0.7, gain: 0.07, attack: 0.002, wet: 0.7 });   // the clang: two inharmonic partials
      tone(b, 0.2, { freq: 1568 * 1.41, dur: 0.5, gain: 0.04, attack: 0.002, wet: 0.7 });
      tone(b, 0.2, { freq: 82, to: 41, glide: 0.4, dur: 0.6, gain: 0.25, attack: 0.003 });
    },
    'vs-boss'(b) {
      ANIME.vs(b);
      noise(b, 0.3, { filter: 'highpass', freq: 2500, dur: 0.08, gain: 0.32, attack: 0.001 });           // thunder: the crack
      noise(b, 0.32, { filter: 'lowpass', freq: 500, to: 60, dur: 1.2, gain: 0.32, attack: 0.02, wet: 0.5 });  // and its roll
    },
    /* finisher: silence for the hit-stop, the slash at 120 ms, the impact at 300 ms, a ring */
    finisher(b) {
      slash(b, 0.12, 1.1);
      impact(b, 0.3, 1);
      [N(7), N(14), N(19)].forEach((f, i) => tone(b, 0.34 + i * 0.03, { type: 'triangle', freq: f, dur: 1.2, gain: 0.05, attack: 0.004, wet: 0.8 }));
    },
    /* the broadcast (src/anime/onair.js, manga.js) */
    /* every cue below starts on its first sample: the picture fires it at the frame it belongs to (onair.js, manga.js), and they stack */
    /* a cut: the air splits */
    cut(b) { slash(b, 0, .75); drum(b, 0, 74, .42); },
    /* a B-roll cut: only the wind of it */
    swish(b) { whoosh(b, 0, 700, 2600, 0.16, 0.05, false); },
    /* the fight's bed: wind and a low held note, retriggered for as long as the judge takes */
    bed(b) { noise(b, 0, { filter: 'lowpass', freq: 520, to: 280, dur: 2.5, gain: 0.05, attack: 0.5 }); tone(b, 0, { freq: 55, dur: 2.5, gain: 0.08, attack: 0.5 }); tone(b, 0, { freq: 82.4, dur: 2.5, gain: 0.03, attack: 0.7 }); },
    /* Submit: the blade drawn, the band tearing across */
    launch(b) { slash(b, 0, 1.1); whoosh(b, 0, 500, 5200, 0.3, 0.2, false); tone(b, 0, { type: 'sawtooth', freq: 110, to: 220, glide: .3, dur: .4, gain: .06, lowpass: 1800, attack: .005, wet: .4 }); },
    /* the weight landing: on the frame the picture stops */
    slam(b) { impact(b, 0, .7); },
    /* the big one: blade, weight and a chord, all on the first sample */
    smash(b) { slash(b, 0, 1.1); impact(b, 0, 1); [N(7), N(14), N(19)].forEach((f, i) => tone(b, 0.02 + i * 0.03, { type: 'triangle', freq: f, dur: 1.2, gain: 0.05, attack: 0.004, wet: 0.8 })); },
    /* the title: ink bursting */
    title(b) { whoosh(b, 0, 300, 2600, 0.26, 0.22, false); noise(b, 0, { filter: 'lowpass', freq: 900, to: 200, dur: 0.3, gain: 0.3, attack: 0.002 }); },
    /* a blade writing the title, then the chord it leaves */
    write(b) { slash(b, 0, .8); [N(0), N(7), N(12), N(19)].forEach((f, i) => tone(b, .05 + i * .07, { type: 'triangle', freq: f, dur: 1.0, gain: .07, attack: .01, wet: .8 })); },
    ring(b) { tone(b, 0, { freq: 3400, dur: .7, gain: .05, attack: .002, wet: .8 }); },
    /* the signal going: static */
    static(b) { noise(b, 0, { filter: 'highpass', freq: 900, dur: 0.54, gain: 0.3, attack: 0.002 }); noise(b, 0, { filter: 'bandpass', freq: 2600, to: 900, dur: 0.54, gain: 0.14, attack: 0.002 }); },
    /* a red pencil, hard */
    pen(b) { for (let i = 0; i < 5; i++) noise(b, i * .062, { filter: 'bandpass', freq: 2300 + i * 260, dur: .05, gain: .11, attack: .004 }); },
    /* one test, one cut: a heartbeat, felt more than heard */
    heart(b) {
      drum(b, 0, 58, 0.5);
      drum(b, 0.16, 46, 0.34);
    },
    /* the blade goes home: one small clean ring, then nothing */
    sheathe(b) {
      noise(b, 0, { filter: 'highpass', freq: 3200, dur: 0.05, gain: 0.16, attack: 0.001 });
      tone(b, 0.02, { freq: 3200, dur: 0.5, gain: 0.1, attack: 0.001, wet: 0.7 });
      tone(b, 0.02, { freq: 4815, dur: 0.3, gain: 0.05, attack: 0.001, wet: 0.7 });
    },
    /* the page hits the press */
    inkslam(b) {
      drum(b, 0, 70, 0.7);
      noise(b, 0, { filter: 'lowpass', freq: 2600, to: 300, dur: 0.22, gain: 0.26, attack: 0.001 });
    },
    panel(b) { noise(b, 0, { filter: 'bandpass', freq: 1500, to: 700, dur: 0.09, gain: 0.3, attack: 0.001 }); drum(b, 0, 96, 0.3); },
    pageturn(b) { whoosh(b, 0, 900, 3600, 0.34, 0.16, false); noise(b, 0.3, { filter: 'highpass', freq: 2400, dur: 0.05, gain: 0.08, attack: 0.002 }); },
    /* to be continued: a chord left hanging */
    cliff(b) {
      [N(0), N(3), N(6)].forEach((f, i) => tone(b, 0.02 + i * 0.02, { type: 'triangle', freq: f, dur: 1.5, gain: 0.08, attack: 0.01, wet: 0.7 }));
      drum(b, 0, 60, 0.5);
    },
    /* a clock wound forward through the whole lapse, then crickets on シーン */
    timeskip(b) {
      for (let i = 0; i < 26; i++) noise(b, i * 0.052, { filter: 'highpass', freq: 2600 + i * 90, dur: 0.02, gain: 0.08, attack: 0.001 });
      whoosh(b, 0, 300, 1500, 1.4, 0.05, true);
    },
    crickets(b) { [0, .17, .34, .62, .79].forEach((t) => tone(b, t, { freq: 4300, dur: 0.07, gain: 0.03, attack: 0.002, wet: 0.4 })); },
    /* a reading that climbs, and glass that gives */
    scouter(b) { tone(b, 0, { type: 'square', freq: 500, to: 2600, glide: 1.05, dur: 1.08, gain: 0.04, lowpass: 3600, attack: 0.01 }); },
    glass(b) { noise(b, 0, { filter: 'highpass', freq: 3600, dur: 0.14, gain: 0.26, attack: 0.001 }); shards(b, 0.02, 9, 0.3); },
    /* the 1 kHz tone of a station gone off the air */
    testtone(b) { tone(b, 0, { type: 'sine', freq: 1000, dur: 1.5, gain: 0.07, attack: 0.002 }); },
    retake(b) { drum(b, 0, 150, 0.4); noise(b, 0, { filter: 'lowpass', freq: 1600, dur: 0.06, gain: 0.3, attack: 0.001 }); },
    /* the sting before the adverts */
    eyecatch(b) { [N(7), N(12), N(16), N(19)].forEach((f, i) => tone(b, i * 0.075, { type: 'triangle', freq: f, dur: 0.32, gain: 0.09, attack: 0.004, wet: 0.5 })); },
    /* guard stance: a metallic shing and a held breath, no fanfare */
    guard(b) {
      tone(b, 0.02, { freq: 2400, to: 2700, glide: 0.3, dur: 0.6, gain: 0.14, attack: 0.002, wet: 0.7 });
      tone(b, 0.02, { freq: 3610, dur: 0.4, gain: 0.07, attack: 0.002, wet: 0.7 });
      noise(b, 0.02, { filter: 'highpass', freq: 5000, dur: 0.12, gain: 0.2, attack: 0.002 });
      tone(b, 0.1, { freq: 110, dur: 1.6, gain: 0.2, attack: 0.25 });
    },
    /* wrong answer on test 1: a soft thud */
    stumble(b) {
      drum(b, 0.02, 74, 0.4);
      tone(b, 0.02, { type: 'triangle', freq: 330, to: 220, glide: 0.18, dur: 0.24, gain: 0.08, attack: 0.004 });
    },
    /* a heavy hit: crunch, a glass crack, the impact */
    hit(b) {
      noise(b, 0, { filter: 'lowpass', freq: 2400, to: 220, dur: 0.32, gain: 0.42, attack: 0.001 });
      for (let i = 0; i < 7; i++) noise(b, 0.02 + i * 0.03, { freq: 3000 + i * 470, q: 5, dur: 0.03, gain: 0.12, attack: 0.001 });
      impact(b, 0.02, 0.9);
    },
    /* time stop: a reversed whoosh, two clock ticks, the second one is the last, a hum */
    timestop(b) {
      whoosh(b, 0, 260, 3200, 0.3, 0.32, true);
      noise(b, 0.34, { freq: 3400, q: 7, dur: 0.04, gain: 0.6, attack: 0.001 });
      noise(b, 0.62, { freq: 2600, q: 7, dur: 0.05, gain: 0.5, attack: 0.001, wet: 0.6 });
      tone(b, 0.3, { freq: 55, dur: 1.5, gain: 0.3, attack: 0.15 });
      tone(b, 0.3, { freq: 110.5, dur: 1.4, gain: 0.04, attack: 0.2 });
    },
    /* overload: a rising, bit-crushed buzz with stutters */
    overload(b) {
      tone(b, 0.02, { type: 'square', freq: 70, to: 560, glide: 0.95, dur: 1.0, gain: 0.07, lowpass: 2200, attack: 0.02 });
      [0.32, 0.41, 0.58, 0.66, 0.83, 0.97].forEach((t, i) => tone(b, t, { type: 'square', freq: 900 + (i * 377) % 1200, dur: 0.035, gain: 0.07, attack: 0.001 }));
      drum(b, 0.04, 60, 0.5);
    },
    /* ambush: a whoosh from the right edge into a slash, a short hit */
    ambush(b) {
      whoosh(b, 0, 5000, 700, 0.14, 0.2);
      slash(b, 0.1, 1);
      drum(b, 0.15, 66, 0.7);
    },
    /* shatter: the crack (0), the screen breaking at 250 ms, ringing shards, a low boom */
    shatter(b) {
      noise(b, 0, { filter: 'highpass', freq: 2600, dur: 0.06, gain: 0.4, attack: 0.001 });
      for (let i = 0; i < 4; i++) noise(b, 0.05 + i * 0.045, { freq: 4000 + i * 600, q: 6, dur: 0.025, gain: 0.1, attack: 0.001 });
      noise(b, 0.25, { filter: 'highpass', freq: 1400, to: 4000, dur: 0.5, gain: 0.2, attack: 0.002, wet: 0.4 });
      shards(b, 0.27, 16, 0.6);
      impact(b, 0.27, 0.75);
    },
    /* awakening: the aura swells for a second, then the chord */
    awaken(b) {
      noise(b, 0, { freq: 180, to: 2200, dur: 1.15, gain: 0.12, q: 0.8, attack: 1.0, wet: 0.4 });
      tone(b, 0, { type: 'sawtooth', freq: 110, to: 220, glide: 1.1, dur: 1.15, gain: 0.05, lowpass: 1200, attack: 0.9 });
      drum(b, 1.2, 100, 0.6);
      [N(5), N(9), N(12), N(17)].forEach((f, i) => tone(b, 1.22 + i * 0.04, { type: 'triangle', freq: f, dur: 0.9, gain: 0.08, attack: 0.005, wet: 0.6 }));
    },
  };
  /* the combo tick: a short click, its pitch rising with the counter's heat */
  ticks(ANIME, (b, l) => {
    noise(b, 0, { freq: 3200, q: 8, dur: 0.025, gain: 0.12, attack: 0.001 });
    tone(b, 0, { type: 'triangle', freq: 520 * Math.pow(2, (l - 1) / 5), dur: 0.07, gain: 0.07, attack: 0.002 });
  });

  /* ---- Pixel Art: arcade fighter (square, triangle, noise only) ----------- */
  const PIXEL = {
    /* ROUND 1 (two notes) ... FIGHT! at 700 ms */
    fight(b) {
      chip(b, 0.05, N(3), 0.12, 0.198); chip(b, 0.2, N(10), 0.22, 0.198);
      noise(b, 0.7, { filter: 'lowpass', freq: 2400, dur: 0.18, gain: 0.45, attack: 0.001 });
      tone(b, 0.7, { type: 'square', freq: 110, to: 55, glide: 0.25, dur: 0.3, gain: 0.25, lowpass: 1600, attack: 0.002 });
      chip(b, 0.74, N(15), 0.24, 0.176);
    },
    /* K.O.: one hit, a descending run, a closing thump */
    ko(b) {
      noise(b, 0, { filter: 'lowpass', freq: 3000, dur: 0.08, gain: 0.32, attack: 0.001 });
      [N(15), N(12), N(10), N(7), N(3)].forEach((f, i) => chip(b, 0.1 + i * 0.06, f, 0.07, 0.176));
      tone(b, 0.45, { type: 'square', freq: 82, to: 41, glide: 0.3, dur: 0.4, gain: 0.12, lowpass: 900, attack: 0.002 });
      noise(b, 0.45, { filter: 'lowpass', freq: 900, dur: 0.25, gain: 0.2, attack: 0.002 });
    },
    /* PERFECT: a rising arpeggio and a held chord */
    perfect(b) {
      noise(b, 0, { filter: 'lowpass', freq: 3000, dur: 0.08, gain: 0.3, attack: 0.001 });
      [N(3), N(7), N(10), N(15), N(19)].forEach((f, i) => chip(b, 0.1 + i * 0.07, f, 0.08, 0.176));
      [N(15), N(19), N(22)].forEach((f) => chip(b, 0.48, f, 0.7, 0.088, 'triangle'));
    },
    /* CONTINUE? 9, 8, 7: one beep per number, lower each time */
    continue(b) {
      [[0.05, N(7)], [0.75, N(5)], [1.45, N(3)]].forEach(([t, f]) => chip(b, t, f, 0.16, 0.22));
      tone(b, 0.05, { type: 'triangle', freq: N(-17), dur: 0.5, gain: 0.08, attack: 0.004 });
    },
    syntax(b) {
      for (let i = 0; i < 5; i++) chip(b, 0.02 + i * 0.045, 300 + ((i * 587) % 1300), 0.035, 0.176);
      chip(b, 0.26, 98, 0.3, 0.22);
    },
    pretests(b) { chip(b, 0.02, N(14), 0.08, 0.22); chip(b, 0.1, N(19), 0.4, 0.22); },
    levelup(b) {
      [N(3), N(7), N(10), N(15), N(19), N(22)].forEach((f, i) => chip(b, 0.05 + i * 0.08, f, 0.09, 0.176));
      [N(15), N(19), N(22)].forEach((f) => chip(b, 0.6, f, 0.8, 0.088, 'triangle'));
    },
  };
  ticks(PIXEL, (b, l) => chip(b, 0, N(10 + l * 2), 0.045, 0.154));
  /* the duel (src/pixel/duel.js): two square voices and a triangle bass, like a cartridge */
  const seq = (b, t, notes, step, gain, type) => notes.forEach((n, i) => { if (n !== null) chip(b, t + i * step, N(n), step * .92, gain, type); });
  const crack = (b, t, k) => { noise(b, t, { filter: 'lowpass', freq: 3600, to: 500, dur: 0.07, gain: 0.3 * (k || 1), attack: 0.001 }); tone(b, t, { type: 'square', freq: 170, to: 62, glide: 0.09, dur: 0.1, gain: 0.13 * (k || 1), lowpass: 1500, attack: 0.001 }); };
  Object.assign(PIXEL, {
    press(b) { chip(b, 0, N(19), 0.03, 0.11); chip(b, 0.03, N(24), 0.04, 0.11); },
    bonk(b) { tone(b, 0, { type: 'square', freq: 330, to: 150, glide: 0.09, dur: 0.1, gain: 0.13, lowpass: 2000, attack: 0.001 }); },
    jump(b) { tone(b, 0, { type: 'square', freq: 280, to: 760, glide: 0.13, dur: 0.15, gain: 0.11, lowpass: 3000, attack: 0.002 }); },
    cast(b) { [0, 4, 7, 12, 16, 19].forEach((n, i) => chip(b, i * 0.055, N(n + 3), 0.05, 0.1)); },
    'hit-1'(b) { crack(b, 0, .7); chip(b, 0.015, N(12), 0.05, 0.11); },
    'hit-2'(b) { crack(b, 0, .75); chip(b, 0.015, N(15), 0.05, 0.11); },
    'hit-3'(b) { crack(b, 0, .8); chip(b, 0.015, N(19), 0.05, 0.11); },
    'hit-4'(b) { crack(b, 0, .9); chip(b, 0.015, N(22), 0.05, 0.11); },
    'hit-5'(b) { crack(b, 0, 1); chip(b, 0.015, N(27), 0.06, 0.11); },
    coin(b) { chip(b, 0, N(23), 0.06, 0.13); chip(b, 0.06, N(28), 0.22, 0.13); },
    whiff(b) { noise(b, 0, { freq: 1800, to: 500, q: 1.2, dur: 0.16, gain: 0.16, attack: 0.02 }); chip(b, 0.08, N(2), 0.1, 0.1); },
    ready(b) { seq(b, 0, [12, 16, 19, 24], 0.07, 0.13); chip(b, 0.28, N(28), 0.3, 0.1, 'triangle'); },
    /* the victory fanfare: lead, a third under it, a walking bass, the coins on the last bar */
    victory(b) {
      crack(b, 0, 1.2);
      noise(b, 0.3, { filter: 'lowpass', freq: 5000, to: 300, dur: 0.3, gain: 0.26, attack: 0.002 });
      const t = 0.42, st = 0.095;
      seq(b, t, [12, 12, 12, 12, 8, 10, 12, null, 10, 12], st, 0.13);
      seq(b, t, [7, 7, 7, 7, 3, 5, 7, null, 5, 7], st, 0.07);
      seq(b, t, [-24, null, -17, null, -20, null, -22, null, -17, null], st, 0.15, 'triangle');
      [12, 16, 19, 24].forEach((n) => chip(b, t + st * 10, N(n), 0.72, 0.07));
      chip(b, t + st * 10, N(-12), 0.72, 0.15, 'triangle');
    },
    /* a first-try win: the fanfare a fourth higher, with sparkles over the held chord */
    flawless(b) {
      crack(b, 0, 1.2);
      noise(b, 0.3, { filter: 'lowpass', freq: 5000, to: 300, dur: 0.3, gain: 0.26, attack: 0.002 });
      const t = 0.42, st = 0.085;
      seq(b, t, [17, 17, 17, 17, 13, 15, 17, null, 20, 24], st, 0.13);
      seq(b, t, [12, 12, 12, 12, 8, 10, 12, null, 15, 19], st, 0.07);
      seq(b, t, [-19, null, -12, null, -15, null, -17, null, -12, null], st, 0.15, 'triangle');
      [17, 21, 24, 29].forEach((n) => chip(b, t + st * 10, N(n), 0.7, 0.07));
      [36, 40, 43, 48, 43, 48].forEach((n, i) => chip(b, t + st * 10 + 0.08 + i * 0.08, N(n), 0.05, 0.05));
    },
    lose(b) {
      crack(b, 0.18, 1.3);
      seq(b, 0.42, [7, 6, 5, 3, null, -2], 0.11, 0.13);
      seq(b, 0.42, [-17, null, -19, null, -24, null], 0.11, 0.14, 'triangle');
    },
    slow(b) {
      [0, .26, .46, .62, .74, .84, .92, .98].forEach((t) => noise(b, t, { filter: 'highpass', freq: 3000, dur: 0.02, gain: 0.2, attack: 0.001 }));
      tone(b, 1.06, { type: 'square', freq: 196, dur: 0.14, gain: 0.13, lowpass: 1600, attack: 0.002 });
      tone(b, 1.24, { type: 'square', freq: 147, dur: 0.34, gain: 0.13, lowpass: 1600, attack: 0.002 });
    },
    overflow(b) {
      tone(b, 0, { type: 'square', freq: 90, to: 880, glide: 0.8, dur: 0.82, gain: 0.1, lowpass: 2600, attack: 0.01, vibrato: 26 });
      crack(b, 0.82, 1.3);
      seq(b, 0.96, [0, -1, -5], 0.09, 0.11);
    },
    crash(b) {
      for (let i = 0; i < 14; i++) chip(b, 0.02 * i * (1 + (i % 3)), 180 + ((i * 1487) % 2600), 0.03, 0.09);
      noise(b, 0.3, { filter: 'lowpass', freq: 1200, dur: 0.14, gain: 0.26, attack: 0.001 });
      tone(b, 0.36, { type: 'square', freq: 72, dur: 0.34, gain: 0.13, lowpass: 900, attack: 0.002 });
    },
    fizzle(b) {
      noise(b, 0, { filter: 'highpass', freq: 1400, to: 5000, dur: 0.3, gain: 0.13, attack: 0.01 });
      seq(b, 0.26, [5, 1], 0.14, 0.11, 'triangle');
    },
    getup(b) { seq(b, 0, [0, 4, 7], 0.06, 0.09); },
    /* the break: glass stress rising, then the whole window going, then the rubble, then time running back */
    crackle(b) {
      for (let i = 0; i < 16; i++) noise(b, i * i * .0016 + (i % 3) * .004, { filter: 'highpass', freq: 2600 + (i * 701) % 3200, dur: .022, gain: .1 + i * .012, attack: .001 });
      tone(b, 0, { type: 'sawtooth', freq: 70, to: 420, glide: .36, dur: .38, gain: .06, lowpass: 900, attack: .02 });
    },
    smash(b) {
      drum(b, 0, 46, 1);
      tone(b, 0, { freq: 60, to: 26, glide: .9, dur: 1.2, gain: .42, attack: .002 });
      noise(b, 0, { filter: 'highpass', freq: 1800, to: 500, dur: .9, gain: .28, attack: .001, wet: .4 });
      noise(b, 0, { filter: 'lowpass', freq: 2400, to: 90, dur: 1.1, gain: .34, attack: .002, wet: .35 });
      shards(b, .02, 26, .8);
    },
    clack(b) { noise(b, 0, { filter: 'lowpass', freq: 2200, dur: .07, gain: .5, attack: .001 }); tone(b, 0, { type: 'square', freq: 210, to: 130, glide: .05, dur: .08, gain: .16, lowpass: 1200, attack: .001 }); },
    shoot(b) { noise(b, 0, { freq: 1400, to: 3800, q: 1, dur: .2, gain: .14, attack: .01 }); chip(b, .02, N(19), .07, .08); },
    boom(b) { drum(b, 0, 50, .9); noise(b, 0, { filter: 'lowpass', freq: 2800, to: 120, dur: .6, gain: .34, attack: .001, wet: .3 }); tone(b, 0, { freq: 70, to: 30, glide: .5, dur: .6, gain: .3, attack: .002 }); shards(b, .02, 8, .3); },
    thunder(b) { noise(b, 0, { filter: 'lowpass', freq: 420, to: 180, dur: 1.5, gain: .3, attack: .3, wet: .4 }); tone(b, 0, { freq: 48, dur: 1.5, gain: .14, attack: .4 }); },
    thunderclap(b) { noise(b, 0, { filter: 'highpass', freq: 1200, to: 300, dur: .35, gain: .36, attack: .001, wet: .5 }); drum(b, 0, 44, 1); noise(b, .05, { filter: 'lowpass', freq: 900, to: 90, dur: 1.2, gain: .34, attack: .01, wet: .5 }); },
    rumble(b) { noise(b, 0, { filter: 'lowpass', freq: 300, to: 700, dur: 1.2, gain: .28, attack: .4 }); [0, .4, .8].forEach((t) => tone(b, t, { freq: 90, to: 200, glide: .3, dur: .34, gain: .07, lowpass: 700, attack: .1 })); },
    charge(b) { tone(b, 0, { type: 'sawtooth', freq: 90, to: 1400, glide: .46, dur: .5, gain: .1, lowpass: 2600, attack: .02, vibrato: 30 }); noise(b, 0, { freq: 400, to: 3400, q: 1, dur: .46, gain: .12, attack: .38 }); },
    beam(b) { tone(b, 0, { type: 'square', freq: 220, to: 110, glide: .4, dur: .44, gain: .16, lowpass: 2400, attack: .002, vibrato: 60 }); noise(b, 0, { filter: 'highpass', freq: 900, dur: .42, gain: .22, attack: .002 }); drum(b, 0, 60, .8); },
    rebuild(b) {
      noise(b, 0, { freq: 400, to: 3600, q: .9, dur: .6, gain: .16, attack: .5 });
      [-5, 0, 3, 7, 12, 15, 19, 24].forEach((n, i) => chip(b, .08 * i, N(n), .07, .09));
      chip(b, .66, N(24), .3, .1, 'triangle');
    },
  });

  /* ---- Vintage Paper: the press -------------------------------------------- */
  function thump(b, t, k) {
    drum(b, t, 72, 0.75 * (k || 1));
    noise(b, t, { filter: 'lowpass', freq: 700, dur: 0.14, gain: 0.25 * (k || 1), attack: 0.002 });
  }
  const PAPER = {
    /* the page spins in (paper whoosh), lands with a press thump at 500 ms */
    extra(b) {
      whoosh(b, 0, 700, 2600, 0.48, 0.14, true);
      for (let i = 0; i < 5; i++) noise(b, 0.08 + i * 0.08, { freq: 1800 + i * 200, q: 1.5, dur: 0.05, gain: 0.05, attack: 0.01 });   // flutter
      thump(b, 0.5, 1);
    },
    pretests(b) { whoosh(b, 0, 700, 2200, 0.42, 0.12, true); thump(b, 0.5, 0.7); },
    /* the slip types in (keys), the rubber stamp at 750 ms */
    correction(b) {
      for (let i = 0; i < 13; i++) noise(b, 0.05 + i * 0.047 + (i * 13 % 7) * 0.004, { filter: 'highpass', freq: 2600, dur: 0.018, gain: 0.16, attack: 0.001 });
      thump(b, 0.75, 0.9);
    },
    promoted(b) {
      PAPER.extra(b);
      tone(b, 0.6, { freq: 1760, dur: 1.1, gain: 0.05, attack: 0.002, wet: 0.7 });
      tone(b, 0.6, { freq: 2637, dur: 0.8, gain: 0.025, attack: 0.002, wet: 0.7 });
    },
  };

  /* ---- FASTLAP: a race broadcast (engines, race-control tones) -------------- */
  /* a car passing the camera: an engine note that drops with the Doppler shift, a tyre-and-air whoosh */
  function passby(b, t, k) {
    k = k || 1;
    tone(b, t, { type: 'sawtooth', freq: 310, to: 150, glide: 0.55, dur: 0.6, gain: 0.08 * k, lowpass: 1400, attack: 0.05, vibrato: 38 });
    tone(b, t, { type: 'square', freq: 155, to: 75, glide: 0.55, dur: 0.6, gain: 0.05 * k, lowpass: 700, attack: 0.05 });
    noise(b, t, { freq: 900, to: 2600, q: 0.9, dur: 0.55, gain: 0.22 * k, attack: 0.18 });
  }
  /* race control: short, clean alert tones */
  const beep = (b, t, f, d, g) => tone(b, t, { type: 'square', freq: f, dur: d, gain: g, lowpass: 3200, attack: 0.003 });
  /* team radio (original, generic two-way radio): the channel opens with a key
     click, a burst of band-limited static and a short chirp; it closes with a
     click and a squelch tail. Every cut-in is wrapped in one (open at 0, close
     at `end`), so each verdict sounds like a call from the pit wall. */
  /* the key click is a tick of tone, not high-passed noise: in Chrome a highpass started
     late in a sound spiked a 0.1 click to 0.8 (measured, harness/sfx.mjs) */
  const keyClick = (b, t) => { tone(b, t, { type: 'square', freq: 3400, dur: 0.008, gain: 0.05, attack: 0.0005 }); tone(b, t, { type: 'triangle', freq: 1700, dur: 0.012, gain: 0.04, attack: 0.0005 }); };
  function radioOpen(b, t, up) {
    keyClick(b, t);
    noise(b, t + 0.008, { freq: 1900, q: 1.4, dur: 0.16, gain: 0.07, attack: 0.004 });                          // static
    tone(b, t + 0.03, { type: 'square', freq: up ? 1250 : 1400, to: up ? 1650 : 1100, glide: 0.06, dur: 0.07, gain: 0.04, lowpass: 2800, attack: 0.002 });   // chirp
  }
  function radioClose(b, t, k) {
    k = k || 1;
    keyClick(b, t);
    noise(b, t + 0.01, { freq: 2400, to: 900, q: 1.1, dur: 0.12 * k, gain: 0.08, attack: 0.002 });             // squelch
  }
  /* a voice-band "radio" layer on a note: bandpassed so it reads as heard over the radio */
  const call = (b, t, f, d, g) => tone(b, t, { type: 'square', freq: f, dur: d, gain: g, lowpass: 2600, q: 2, attack: 0.003 });
  const FASTLAP = {
    /* ACCEPTED: the radio opens rising, the car passes the camera, a clean "box closed" two-note call */
    pass(b) { radioOpen(b, 0, true); passby(b, 0.12, 1); call(b, 0.62, 988, 0.08, 0.05); call(b, 0.72, 1319, 0.14, 0.05); radioClose(b, 0.98); },
    /* FIRST TRY (purple): the pass-by, then a bright three-note "fastest lap" chime ringing out */
    fastest(b) {
      radioOpen(b, 0, true); passby(b, 0.12, 1);
      [1318.5, 1661.2, 1975.5].forEach((f, i) => tone(b, 0.5 + i * 0.1, { type: 'triangle', freq: f, dur: 0.55 - i * 0.08, gain: 0.075, attack: 0.002, wet: 0.6 }));
      radioClose(b, 1.15);
    },
    /* PRETESTS PASSED: a softer pass-by and one waiting note (the system test is to come) */
    pretests(b) { radioOpen(b, 0, true); passby(b, 0.12, 0.7); call(b, 0.62, 880, 0.18, 0.045); radioClose(b, 0.9); },
    /* WRONG ANSWER (red flag): an urgent falling double call and a low drop */
    flag(b) {
      radioOpen(b, 0, false);
      call(b, 0.12, 932, 0.08, 0.065); call(b, 0.22, 740, 0.08, 0.065); call(b, 0.36, 932, 0.08, 0.065); call(b, 0.46, 740, 0.08, 0.065);
      tone(b, 0.58, { freq: 220, to: 110, dur: 0.35, gain: 0.08, attack: 0.004 });
      radioClose(b, 0.95);
    },
    /* RUNTIME ERROR: the engine cuts out (a falling, sputtering note) and the radio breaks up */
    crash(b) {
      radioOpen(b, 0, false);
      tone(b, 0.1, { type: 'sawtooth', freq: 260, to: 60, glide: 0.5, dur: 0.55, gain: 0.07, lowpass: 900, attack: 0.01, vibrato: 14 });
      for (let i = 0; i < 4; i++) noise(b, 0.18 + i * 0.09, { freq: 1500 + i * 300, q: 2, dur: 0.04, gain: 0.08, attack: 0.002 });   // break-up
      call(b, 0.62, 587, 0.16, 0.055);
      radioClose(b, 0.92, 1.6);
    },
    /* TIME LIMIT: the pit-lane limiter, an even pulse that stops short */
    limit(b) {
      radioOpen(b, 0, false);
      for (let i = 0; i < 4; i++) call(b, 0.12 + i * 0.12, 660, 0.06, 0.055);
      tone(b, 0.12, { freq: 165, dur: 0.5, gain: 0.06, attack: 0.004 });
      radioClose(b, 0.78);
    },
    /* MEMORY LIMIT: the same limiter, lower and widening (the car bottoming out) */
    memory(b) {
      radioOpen(b, 0, false);
      [660, 587, 523, 466].forEach((f, i) => call(b, 0.12 + i * 0.13, f, 0.07, 0.055));
      tone(b, 0.12, { freq: 110, to: 82, dur: 0.6, gain: 0.07, attack: 0.004 });
      radioClose(b, 0.84);
    },
    /* COMPILATION ERROR: never left the garage: a garbled call through static and one flat note */
    pit(b) {
      radioOpen(b, 0, false);
      for (let i = 0; i < 6; i++) noise(b, 0.1 + i * 0.05, { freq: 1100 + ((i * 433) % 1400), q: 3, dur: 0.03, gain: 0.07, attack: 0.002 });
      noise(b, 0.12, { freq: 5200, q: 0.8, dur: 0.2, gain: 0.07, attack: 0.01 });                      // the air gun in the garage
      call(b, 0.46, 440, 0.2, 0.05);
      radioClose(b, 0.74);
    },
    /* HACKED / FAILED SYSTEM TEST: the stewards' call: three slow, even tones, then a long low one */
    review(b) {
      radioOpen(b, 0, false);
      [698, 698, 698].forEach((f, i) => call(b, 0.12 + i * 0.2, f, 0.12, 0.06));
      call(b, 0.74, 349, 0.32, 0.07);
      radioClose(b, 1.12);
    },
    /* RATING UP: the podium: a rising arpeggio, the pass-by, the radio clicking off twice */
    promoted(b) {
      radioOpen(b, 0, true);
      [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => tone(b, 0.1 + i * 0.11, { type: 'triangle', freq: f, dur: 0.55 - i * 0.07, gain: 0.07, attack: 0.002, wet: 0.5 }));
      passby(b, 0.45, 0.6);
      radioClose(b, 1.2); radioClose(b, 1.32, 0.5);
    },
  };

  SFX.register('anime', ANIME);
  SFX.register('pixel', PIXEL);
  SFX.register('paper', PAPER);
  SFX.register('fastlap', FASTLAP);
  root.CFTSSoundKinds = { anime: Object.keys(ANIME), pixel: Object.keys(PIXEL), paper: Object.keys(PAPER), fastlap: Object.keys(FASTLAP) };
})(globalThis);
