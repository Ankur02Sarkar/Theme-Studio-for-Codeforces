/* =============================================================================
   classic.js  (isolated world)  — the Classic theme's quality of life

   docs/A-04-classic-theme-proposal.md. Classic is Codeforces' colours with
   the design system's finish, always in Codeforces' positions. This file adds
   only what helps, each one passing the same test: it looks native, moves
   nothing a regular clicks, adds information or a shortcut (or fixes a bug),
   and makes no request. themes/classic.css styles it.

   What it adds, by page:
     every page    "Start here" at the end of the main menu: the beginner
                   guide, built when first opened; menu tooltips; readable
                   sidebar countdowns; keyboard shortcuts (/ s ? j k Enter
                   Esc); the bell reachable from the keyboard; the language
                   you used last pinned first in every language list
     problem       the rating beside the title, Submit (this problem
                   preselected), your Solved / Tried state (from Codeforces'
                   own "Last submissions" box), topics hidden until asked,
                   Copy all inputs
     problemset    ratings in their rank colour, topics hidden until asked,
                   "start with 800–1300"; the difficulty filter takes a pasted
                   range, and offers Reset while a filter is on
     status        how many rows on the page are yours, and a jump to them
     contests      who each round is rated for, counts in words, "1 d 21 h"
     home, blog    who announced rounds are rated for; a round's Moscow
                   start time in your own time; "New to Codeforces?" (home)
     profile       the current streak (Codeforces shows only the best ones)
     standings     Jump to my row (signed in, your row on the page)
   In Russian (Codeforces' ?locale=ru) every string is Russian.
   Stuck verdicts are fixed by src/verdicts.js, which runs under any theme.

   Same rules as guided.js: one pass at load, no observer, no polling, every
   change journaled and undone on a switch away (Off gives the page back
   exactly). Uses guided.js's journal and vocabulary (globalThis.__cftsKit).
============================================================================= */
(() => {
  const K = globalThis.__cftsKit;
  if (!K) return;
  const { Journal, DIVS, division, rankOf, word, textChild, fmt, esc, dayCountdown, myHandle, PATH } = K;
  const root = document.documentElement;
  const j = Journal();
  const GUIDE_KEY = 'cfGuide';          // { nav: false = no "Start here", card: false = home card dismissed }
  let guide = {}, topicsOn = false;

  /* ---- language: Codeforces' own (html lang, or the menu in Russian) --------- */
  const RU = root.lang === 'ru' || /^главная$/i.test(((document.querySelector('.main-menu-list > li > a') || {}).textContent || '').trim());
  const ruDays = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней');
  const L = RU ? {
    search: 'Поиск задач, пользователей…',
    divWord: { div4: 'Начальный', div3: 'Лёгкий', div2: 'Средний', div1: 'Продвинутый', edu: 'Уровень Div. 2', all: 'Все уровни' },
    divLabel: { edu: 'Образовательный' },
    rated: { div4: 'для рейтинга < 1400', div3: 'для рейтинга < 1600', div2: 'для рейтинга < 2100', div1: 'для рейтинга 1900+', edu: 'для рейтинга < 2100', all: 'для всех' },
    ratedLong: {
      div4: 'рейтинговый для участников с рейтингом ниже 1400', div3: 'рейтинговый для участников с рейтингом ниже 1600',
      div2: 'рейтинговый для участников с рейтингом ниже 2100', div1: 'рейтинговый для участников с рейтингом от 1900',
      edu: 'рейтинговый для участников с рейтингом ниже 2100; учебный формат: расширенные правила ICPC и 12-часовая фаза открытых взломов',
      all: 'рейтинговый для всех: один набор задач для всех уровней',
    },
    word: { Easy: 'Лёгкая', Medium: 'Средняя', Hard: 'Сложная', 'Very hard': 'Очень сложная' },
    rank: { Newbie: 'Новичок', Pupil: 'Ученик', Specialist: 'Специалист', Expert: 'Эксперт', 'Candidate Master': 'Кандидат в мастера', Master: 'Мастер', Grandmaster: 'Гроссмейстер' },
    range: (s) => s.replace('below', 'ниже'),
    rateTip: (r, w, rk, rng) => `Рейтинг ${r} · ${w}: примерно уровень «${rk}» (${rng}). Сложность задач — от 800 (легче всего) до 3500.`,
    submit: 'Отправить', submitTip: 'Открыть страницу отправки с этой задачей (клавиша s)',
    solved: 'Решена ✓', tried: (v) => `Была попытка · ${v}`, mineTip: 'По вашим посылкам в блоке «Последние посылки»',
    showTopics: 'Показать темы', hideTopics: 'Скрыть темы',
    copyAll: 'Копировать все входные', copyAllTip: 'Скопировать входные данные всех примеров через пустую строку', copied: 'Скопировано', copyFail: 'Не удалось скопировать',
    start: 'Новичок? Начните с 800–1300', startTip: 'Сложность задач — от 800 (легче всего) до 3500',
    pasteTip: 'Можно вставить диапазон, например 1200-1600', reset: 'Сбросить фильтр',
    registered: (n) => `зарегистрировано: ${n}`, tookPart: (n) => `участников: ${n}`,
    yours: (n) => `ваших на странице: ${n}`, jumpTo: 'Перейти',
    localTime: (t) => `= ${t} по вашему времени`, localTip: 'В вашем часовом поясе (Codeforces указывает московское время, UTC+3)',
    streak: (n, since) => `Текущая серия: ${n} ${ruDays(n)}${since ? ` (с ${since})` : ''}`, streakNone: (last) => `Текущая серия: 0 дней${last ? ` (последняя активность ${last})` : ''}`,
    dateLocale: 'ru-RU', units: ['д', 'ч'],
    welcomeTitle: 'Впервые на Codeforces?',
    welcomeBody: 'Начните с лёгкой задачи (рейтинг 800–1300), затем примите участие в раунде <b>Div. 4</b> или <b>Div. 3</b>.',
    open: 'Как всё устроено', dismiss: 'Скрыть', jump: 'К моей строке', bell: 'Уведомления',
    nav: ['Новости, анонсы соревнований и записи в блогах', 'Самые популярные недавние записи и комментарии', 'Каталог полезных записей: разборы, руководства и приёмы',
      'Предстоящие раунды (регистрация здесь) и все прошедшие', 'Тренировки: прошедшие соревнования ICPC и олимпиады', 'Все задачи, сложность от 800 (легче всего) до 3500, с фильтрами по сложности и темам',
      'Группы со своими участниками и соревнованиями', 'Рейтинг участников', 'EDU: курсы с уроками и задачами для практики', 'API Codeforces для создания инструментов',
      'Когда пройдут ближайшие соревнования', 'Помощь и частые вопросы'],
    startHere: 'С чего начать', startHereTip: 'Впервые на Codeforces? Где что находится и с чего начать (клавиша ?)',
  } : {
    search: 'Search problems, users…',
    divWord: {}, divLabel: {},
    rated: { div4: 'rated < 1400', div3: 'rated < 1600', div2: 'rated < 2100', div1: 'rated 1900+', edu: 'rated < 2100', all: 'rated for all' },
    ratedLong: null,
    word: {}, rank: {}, range: (s) => s,
    rateTip: (r, w, rk, rng) => `Rated ${r} · ${w}: about ${rk} level (${rng}). Ratings run from 800 (easiest) to 3500.`,
    submit: 'Submit', submitTip: 'Open the submit page with this problem selected (shortcut: s)',
    solved: 'Solved ✓', tried: (v) => `Tried · ${v}`, mineTip: 'From your submissions in the "Last submissions" box',
    showTopics: 'Show topics', hideTopics: 'Hide topics',
    copyAll: 'Copy all inputs', copyAllTip: 'Copy every sample input, separated by a blank line', copied: 'Copied', copyFail: 'Copy failed',
    start: 'New here? Start with 800–1300', startTip: 'Problems are rated from 800 (easiest) to 3500',
    pasteTip: 'Tip: paste a range like 1200-1600', reset: 'Reset filter',
    registered: (n) => `${n} registered`, tookPart: (n) => `${n} took part`,
    yours: (n) => `${n} of yours on this page`, jumpTo: 'Jump',
    localTime: (t) => `= ${t} your time`, localTip: 'In your time zone (Codeforces gives Moscow time, UTC+3)',
    streak: (n, since) => `Current streak: ${n} day${n === 1 ? '' : 's'}${since ? ` (since ${since})` : ''}`, streakNone: (last) => `Current streak: 0 days${last ? ` (last active ${last})` : ''}`,
    dateLocale: undefined, units: ['d', 'h'],
    welcomeTitle: 'New to Codeforces?',
    welcomeBody: 'Start with an easy problem (rated 800–1300), then join a <b>Div. 4</b> or <b>Div. 3</b> round.',
    open: 'How it works', dismiss: 'Dismiss', jump: 'Jump to my row', bell: 'Notifications',
    nav: ['News, contest announcements and community blog posts', 'The most upvoted recent blog posts and comments', 'A catalog of useful blog posts: tutorials, guides and tricks',
      'Upcoming rounds (register here) and every past round', 'Training: past ICPC and olympiad contests to practise on', 'Every problem, rated 800 (easiest) to 3500, with filters by difficulty and topic',
      'Groups with their own members and contests', 'The rating leaderboard', 'EDU: courses with lessons and practice problems', 'The Codeforces API, for building tools',
      'When the upcoming contests are', 'Help and frequently asked questions'],
    startHere: 'Start here', startHereTip: 'New to Codeforces? Where things are and how to start (shortcut: ?)',
  };
  const tw = (r) => { const w = word(r); return L.word[w] || w; };

  /* ---- vocabulary ------------------------------------------------------------ */
  /* named: a parallel Div. 1 / Div. 2 round shows two hints, each with its division */
  function divHint(name, named) {
    const k = division(name);
    if (!k) return null;
    const [label0, w0, , rated] = DIVS[k];
    const label = L.divLabel[k] || label0, w = L.divWord[k] || w0;
    const tip = `${label} · ${w}: ${L.ratedLong ? L.ratedLong[k] : rated}.`;
    return j.make(`<span class="cfts-c-div" title="${esc(tip)}">${named ? esc(label) + ': ' : ''}${esc(w)} · ${esc(L.rated[k])}</span>`);
  }
  function rateInfo(r) {
    const [, col, rk, rng] = rankOf(r);
    return { col, tip: L.rateTip(r, tw(r), L.rank[rk] || rk, L.range(rng)) };
  }
  const submitHref = () => {
    const m = PATH.match(/^\/(problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?(\w+)/);
    if (!m) return null;
    return m[1] === 'problemset/problem' ? `/problemset/submit/${m[2]}/${m[3]}` : `/${m[1]}/${m[2]}/submit/${m[3]}`;
  };

  /* ---- topics: hidden until asked (a topic can give the solution away) -------- */
  function syncTopics() {
    if (topicsOn) root.setAttribute('data-cf-topics', 'on'); else root.removeAttribute('data-cf-topics');
    document.querySelectorAll('.cfts-c-topics').forEach((b) => {
      b.textContent = topicsOn ? L.hideTopics : L.showTopics;
      b.setAttribute('aria-pressed', String(topicsOn));
    });
  }
  const toggleTopics = () => chrome.storage.local.set({ cfTopics: !topicsOn });
  function topicsButton() {
    const b = j.make(`<button type="button" class="cfts-c-topics" aria-pressed="false">${esc(L.showTopics)}</button>`);
    j.on(b, 'click', toggleTopics);
    return b;
  }

  /* ---- problem ----------------------------------------------------------------- */
  function problemPage() {
    const ps = document.querySelector('.problemindexholder .problem-statement');
    const title = ps && ps.querySelector(':scope > .header > .title');
    if (!title) return;
    j.attr(root, 'data-cfts-page', 'problem');
    /* the rating, from Codeforces' own *NNNN tag (absent in a live round) */
    const tags = [...document.querySelectorAll('#sidebar .tag-box')];
    const ratingTag = tags.find((t) => /^\*\d+$/.test(t.textContent.trim()));
    const r = ratingTag ? parseInt(ratingTag.textContent.trim().slice(1), 10) : 0;
    if (r) {
      const { col, tip } = rateInfo(r);
      j.insert(j.make(`<span class="cfts-c-rate cfts-c-r-${col}" title="${esc(tip)}">*${r} · ${esc(tw(r))}</span>`), title);
    }
    const href = submitHref();
    if (href) j.insert(j.make(`<a class="cfts-c-submit" href="${esc(href)}" title="${esc(L.submitTip)}">${esc(L.submit)}</a>`), title);
    /* signed in: Solved / Tried, read from Codeforces' "Last submissions" box
       (newest first; any Accepted there means solved) */
    const last = [...document.querySelectorAll('#sidebar .roundbox')].find((x) => x.querySelector('a[href*="/submission/"]') && x.querySelector('[class*="verdict-"]'));
    if (last) {
      const ok = !!last.querySelector('.verdict-accepted');
      /* the newest verdict; Compilation error is bare text in its wrapper */
      const first = last.querySelector('.submissionVerdictWrapper') || last.querySelector('[class*="verdict-"]:not([class*="verdict-format"])');
      const text = ok ? L.solved : first ? L.tried(first.textContent.trim().replace(/\s+/g, ' ')) : '';
      if (text) j.insert(j.make(`<span class="cfts-c-state ${ok ? 'ok' : 'tried'}" title="${esc(L.mineTip)}">${esc(text)}</span>`), title);
    }
    /* topics: every tag but the rating, behind one button in their own box */
    const box = tags[0] && tags[0].closest('#sidebar > .roundbox');
    if (box) {
      j.cls(box, 'cfts-c-tagbox');
      for (const t of tags) {
        if (t === ratingTag) continue;
        j.cls(t.closest('.roundbox') !== box ? t.closest('.roundbox') : t, 'cfts-c-topic');
      }
      const cap = box.querySelector(':scope > .caption');
      const b = topicsButton();
      j.insert(b, cap || box, null);
    }
    /* Copy all inputs: every sample input, separated by a blank line
       (Codeforces' own Copy already sits on each input and output) */
    const st = ps.querySelector(':scope > .sample-tests');
    const pres = st ? [...st.querySelectorAll('.sample-test .input pre')] : [];
    const head = st && st.querySelector(':scope > .section-title');
    if (head && pres.length >= 2) {
      const b = j.make(`<button type="button" class="cfts-c-copyall" title="${esc(L.copyAllTip)}">${esc(L.copyAll)}</button>`);
      j.insert(b, head);
      j.on(b, 'click', () => {
        const text = pres.map(preText).join('\n\n') + '\n';
        navigator.clipboard.writeText(text).then(() => flash(b, L.copied), () => flash(b, L.copyFail));
      });
    }
  }
  /* a sample's text: multi-test samples are one div per line; old ones use <br> */
  function preText(pre) {
    const lines = pre.querySelectorAll(':scope > div');
    if (lines.length) return [...lines].map((d) => d.textContent).join('\n').replace(/\n+$/, '');
    const c = pre.cloneNode(true);
    c.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    return c.textContent.replace(/^\n+|\n+$/g, '');
  }
  function flash(b, msg) {
    const was = b.textContent;
    b.textContent = msg;
    setTimeout(() => { if (b.isConnected) b.textContent = was; }, 1400);
  }

  /* ---- every language list: the one you used last, first ------------------------
     Codeforces preselects your last language (selected="selected"); it moves
     to the top with a star, a divider under it. The value sent is unchanged. */
  function lastLanguage() {
    for (const sel of document.querySelectorAll('select[name="programTypeId"]')) {
      const o = sel.querySelector('option[selected]');
      if (!o || sel.options[0] === o) continue;
      j.move(o, sel, sel.firstChild);
      j.attr(o, 'label', '★ ' + o.textContent.trim());
      j.insert(j.make('<option disabled value="">──────────</option>'), sel, o.nextSibling);
    }
  }

  /* ---- problemset ---------------------------------------------------------------- */
  function problemsetPage() {
    const table = document.querySelector('.datatable table.problems');
    if (!table) return;
    j.attr(root, 'data-cfts-page', 'problemset');
    /* one pass over the page's rows (as Guided does): the rating in its rank colour */
    for (const span of table.querySelectorAll('.ProblemRating')) {
      const r = parseInt(span.textContent, 10);
      if (!r) continue;
      const { col, tip } = rateInfo(r);
      j.cls(span, 'cfts-c-r-' + col);
      j.attr(span, 'title', tip);
    }
    const cap = table.closest('.datatable').querySelector(':scope > .rb + div');
    if (cap) {
      const tools = j.make('<span class="cfts-c-captools"></span>');
      if (guide.nav !== false && !/tags=/.test(location.search))
        tools.appendChild(j.make(`<a class="cfts-c-start" href="/problemset?tags=800-1300" title="${esc(L.startTip)}">${esc(L.start)}</a>`));
      tools.appendChild(topicsButton());
      /* inside Codeforces' icon box (the magnifier, absolutely placed at the
         right), before its icons: floated beside it, the two overlapped */
      const icons = cap.querySelector(':scope > div');
      j.insert(tools, icons || cap, icons ? icons.firstChild : null);
    }
    difficultyFilter();
  }
  /* the sidebar's difficulty filter: a range pasted into either box fills both;
     while the list is filtered (?tags= in the address), a Reset link */
  function difficultyFilter() {
    const min = document.querySelector('input[name="minDifficulty"]'), max = document.querySelector('input[name="maxDifficulty"]');
    if (!min || !max) return;
    const onPaste = (e) => {
      const t = e.clipboardData ? e.clipboardData.getData('text') : '';
      const m = t.match(/^\s*\*?(\d{3,4})\s*(?:-|–|—|\.\.|,|to|\s)\s*\*?(\d{3,4})\s*$/i);
      if (!m) return;
      e.preventDefault();
      min.value = Math.min(+m[1], +m[2]); max.value = Math.max(+m[1], +m[2]);
    };
    j.on(min, 'paste', onPaste); j.on(max, 'paste', onPaste);
    for (const i of [min, max]) if (!i.title) j.attr(i, 'title', L.pasteTip);
    const submit = min.form && min.form.querySelector('input[type="submit"]');
    if (submit && /[?&]tags=/.test(location.search))
      j.insert(j.make(`<a class="cfts-c-reset" href="/problemset">${esc(L.reset)}</a>`), submit.parentNode, submit.nextSibling);
  }

  /* ---- status: how many rows are yours ------------------------------------------
     Codeforces tints them (tr.highlighted-row, from its own handle match);
     the caption says how many and jumps to the first. One pass, 50 rows. */
  function statusPage() {
    const table = document.querySelector('table.status-frame-datatable');
    const me = myHandle();
    if (!table || !me) return;
    j.attr(root, 'data-cfts-page', 'status');
    const rows = [...table.querySelectorAll('tr[data-submission-id]')];
    const mine = rows.filter((tr) => [...tr.querySelectorAll('a.rated-user')].some((a) => a.textContent === me));
    if (!mine.length || mine.length === rows.length) return;      // none, or "my only" / My submissions
    const cap = table.closest('.datatable') && table.closest('.datatable').querySelector(':scope > .rb + div');
    if (!cap) return;
    const chip = j.make(`<span class="cfts-c-yours">${esc(L.yours(mine.length))} <button type="button">${esc(L.jumpTo)}</button></span>`);
    const icons = cap.querySelector(':scope > div');
    j.insert(chip, icons || cap, icons ? icons.firstChild : null);
    j.on(chip.querySelector('button'), 'click', () => mine[0].scrollIntoView({ block: 'center' }));
  }

  /* ---- contests ------------------------------------------------------------------- */
  function contestsPage() {
    j.attr(root, 'data-cfts-page', 'contests');
    const rows = (sel) => [...document.querySelectorAll(sel)].filter((tr, i) => i > 0 && tr.cells.length >= 6);
    const hint = (td) => {
      const t = textChild(td);
      const h = divHint(t ? t.nodeValue : td.textContent);
      if (h) j.insert(h, td, t ? t.nextSibling : td.firstChild);
    };
    for (const tr of rows('.contestList > .datatable table tr')) {
      hint(tr.cells[0]);
      const cnt = tr.cells[5].querySelector('a.contestParticipantCountLinkMargin');
      const ct = cnt && textChild(cnt, /x\d+/);
      if (ct) j.text(ct, L.registered(fmt(ct.nodeValue.trim().slice(1))));
      for (const cd of tr.querySelectorAll('.countdown')) dayCountdown(j, cd, L.units);
    }
    for (const tr of rows('.contests-table .datatable table tr')) {
      hint(tr.cells[0]);
      const cnt = tr.cells[5].querySelector('a.contestParticipantCountLinkMargin');
      const ct = cnt && textChild(cnt, /x\d+/);
      if (ct) j.text(ct, L.tookPart(fmt(ct.nodeValue.trim().slice(1))));
    }
  }

  /* ---- posts: a round's Moscow start time in your own time -------------------------
     announcements link the time to timeanddate.com with its fields in the
     address (p1=166 = Moscow, UTC+3); nothing shown when you are on UTC+3 */
  function localTimes() {
    if (new Date().getTimezoneOffset() === -180) return;
    for (const a of document.querySelectorAll('.ttypography a.contest-time[href*="timeanddate.com"]')) {
      let q;
      try { q = new URL(a.href).searchParams; } catch (e) { continue; }
      if (q.get('p1') !== '166' || !q.get('year')) continue;
      const t = new Date(Date.UTC(+q.get('year'), +q.get('month') - 1, +q.get('day'), +q.get('hour') - 3, +q.get('min') || 0));
      if (isNaN(t)) continue;
      const time = t.toLocaleTimeString(L.dateLocale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });   // 24-hour, as Codeforces writes it
      const sameDay = t.getDate() === +q.get('day');
      const text = sameDay ? time : `${t.toLocaleDateString(L.dateLocale, { month: 'short', day: 'numeric' })}, ${time}`;
      j.insert(j.make(`<span class="cfts-c-localtime" title="${esc(L.localTip)}">${esc(L.localTime(text))}</span>`), a.parentNode, a.nextSibling);
    }
  }

  /* ---- home ------------------------------------------------------------------------ */
  function homePage() {
    j.attr(root, 'data-cfts-page', 'home');
    for (const a of document.querySelectorAll('#pageContent > div > .topic > .title a')) {
      const t = a.textContent;
      if (!/\bround\s+\d+|educational|раунд\s+\d+|образовательн/i.test(t)) continue;
      /* parallel Div. 1 / Div. 2 rounds: both */
      const names = division(t) !== 'all' && /div\. ?1\b/i.test(t) && /div\. ?2\b/i.test(t) ? ['Div. 1', 'Div. 2'] : [t];
      let at = a.nextSibling;
      for (const n of names) { const h = divHint(n, names.length > 1); if (h) { j.insert(h, a.parentNode, at); at = h.nextSibling; } }
      if (at !== a.nextSibling) j.cls(a.parentNode, 'cfts-c-hinted');
    }
    localTimes();
    if (guide.nav !== false && guide.card !== false) welcomeCard();
  }
  function welcomeCard() {
    const side = document.getElementById('sidebar');
    if (!side) return;
    const card = j.make(`<div class="roundbox sidebox cfts-c-welcome"><div class="caption titled">→ ${esc(L.welcomeTitle)}</div>
      <div class="body"><p>${L.welcomeBody}</p>
      <p class="acts"><button type="button" class="cfts-c-open">${esc(L.open)}</button><button type="button" class="cfts-c-dismiss">${esc(L.dismiss)}</button></p></div></div>`);
    j.insert(card, side, side.firstChild);
    j.on(card.querySelector('.cfts-c-open'), 'click', () => { window.scrollTo(0, 0); openGuide(); });
    j.on(card.querySelector('.cfts-c-dismiss'), 'click', () => chrome.storage.local.set({ [GUIDE_KEY]: Object.assign({}, guide, { card: false }) }));
  }

  /* ---- profile: the current streak, under Codeforces' best-streak counters ----------
     the calendar's own data, in the page's script ("YYYY-MM-DD": { items: [n] });
     a run counts up to today, or to yesterday when today has nothing yet */
  function profilePage() {
    j.attr(root, 'data-cfts-page', 'profile');
    const rows = document.querySelectorAll('._UserActivityFrame_countersRow');
    const row = rows[rows.length - 1];
    const sc = row && [...document.scripts].find((x) => x.textContent.includes('calendar_yearview_blocks'));
    if (!sc) return;
    const active = new Set();
    for (const m of sc.textContent.matchAll(/"(\d{4}-\d{2}-\d{2})":\s*\{\s*items:\s*\[\s*(\d+)/g)) if (+m[2] > 0) active.add(m[1]);
    const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fmtDay = (d) => d.toLocaleDateString(L.dateLocale, { month: 'short', day: 'numeric' });
    const d = new Date(); d.setHours(12, 0, 0, 0);
    if (!active.has(key(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (active.has(key(d))) { n++; d.setDate(d.getDate() - 1); }
    d.setDate(d.getDate() + 1);                       // the run's first day
    let text;
    if (n) text = L.streak(n, fmtDay(d));
    else {
      const lastKey = [...active].sort().pop();
      text = L.streakNone(lastKey ? fmtDay(new Date(lastKey + 'T12:00:00')) : '');
    }
    j.insert(j.make(`<div class="cfts-c-streak">${esc(text)}</div>`), row.parentNode, row.nextSibling);
  }

  /* ---- standings ---------------------------------------------------------------------- */
  function standingsPage() {
    j.attr(root, 'data-cfts-page', 'standings');
    const me = document.querySelector('table.standings tr.highlighted-row');
    if (!me) return;
    const b = j.make(`<button type="button" class="cfts-c-jump">${esc(L.jump)}</button>`);
    j.insert(b, document.body);
    j.on(b, 'click', () => me.scrollIntoView({ block: 'center' }));
  }

  /* ---- the bell: reachable and usable from the keyboard ---------------------------
     Codeforces' bell is a <div> with a click handler (on .header-bell): it gets
     a tab stop and a role; Enter / Space open it, arrows move through its
     links, Esc closes it and returns to the bell. */
  function bellKeys() {
    /* in the server's HTML the bell sits outside #header: Codeforces' ready
       handler moves it in later; the element is the same */
    const bell = document.querySelector('.header-bell');
    if (!bell) return;
    j.attr(bell, 'tabindex', '0'); j.attr(bell, 'role', 'button'); j.attr(bell, 'aria-label', L.bell); j.attr(bell, 'aria-haspopup', 'true');
    const details = () => bell.querySelector('.bell-details');
    const open = () => { const d = details(); return !!(d && d.offsetParent); };
    const links = () => [...bell.querySelectorAll('.bell-details a[href]')].filter((a) => a.offsetParent && !a.closest('[class*="proto-row"]'));
    j.on(bell, 'keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === bell) {
        e.preventDefault(); bell.click();
        if (open()) { const l = links(); if (l[0]) l[0].focus(); }
      } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && open()) {
        const l = links(); if (!l.length) return;
        e.preventDefault();
        const i = l.indexOf(document.activeElement);
        l[(i + (e.key === 'ArrowDown' ? 1 : -1) + l.length) % l.length].focus();
      } else if (e.key === 'Escape' && open()) {
        e.preventDefault(); e.stopPropagation(); bell.click(); bell.focus();
      }
    });
  }

  /* ---- the main menu: tooltips + "Start here" (the guide) --------------------------- */
  const NAV = [/^\/?$/, /^\/top\b/, /^\/catalog\b/, /^\/contests\b/, /^\/gyms\b/, /^\/problemset\b/, /^\/groups\b/, /^\/ratings\b/, /^\/edu\b/, /^\/apiHelp\b/, /^\/calendar\b/, /^\/help\b/];
  const navInfo = (a) => { const h = (a.getAttribute('href') || '').replace(/^https?:\/\/[^/]+/, ''); const i = NAV.findIndex((re) => re.test(h)); return i >= 0 ? L.nav[i] : null; };
  const menu = () => document.querySelector('.menu-list.main-menu-list');
  function navTips() {
    const ul = menu();
    if (!ul) return;
    for (const a of ul.querySelectorAll(':scope > li > a')) {
      const tip = navInfo(a);
      if (tip && !a.hasAttribute('title')) j.attr(a, 'title', tip);
    }
  }
  let navItem = null, panel = null;
  function addStartHere() {
    const ul = menu();
    if (!ul || navItem) return;
    navItem = j.make(`<li class="cfts-c-navitem"><a href="#" role="button" aria-expanded="false" title="${esc(L.startHereTip)}">${esc(L.startHere)}</a></li>`);
    j.insert(navItem, ul);
    j.on(navItem.firstChild, 'click', (e) => { e.preventDefault(); panel && panel.isConnected ? closeGuide() : openGuide(); });
  }
  function removeStartHere() {
    closeGuide();
    if (navItem) { navItem.remove(); navItem = null; }
  }
  const RANKS = [['gray', 'Newbie', 'Новичок', '< 1200'], ['green', 'Pupil', 'Ученик', '1200'], ['cyan', 'Specialist', 'Специалист', '1400'], ['blue', 'Expert', 'Эксперт', '1600'],
    ['violet', 'Candidate master', 'Кандидат в мастера', '1900'], ['orange', 'Master', 'Мастер', '2100'], ['red', 'Grandmaster', 'Гроссмейстер', '2400+']];
  /* the guide's text, per language */
  const GUIDE = RU ? (ranks, map) => `<div class="cfts-c-guide" role="dialog" aria-label="Как устроен Codeforces">
      <div class="g-head"><b>Впервые на Codeforces?</b><span>Где что находится и с чего начать.</span><button type="button" class="g-x" aria-label="Закрыть">✕</button></div>
      <div class="g-cols">
        <section>
          <h3>Три шага для начала</h3>
          <ol>
            <li><a href="/problemset?tags=800-1300">Решите лёгкую задачу</a>. Сложность задач — от 800 (легче всего) до 3500; начните с 800–1300.</li>
            <li><a href="/contests">Примите участие в раунде Div. 4 или Div. 3</a>. Зарегистрируйтесь до начала; большинство раундов длятся около двух часов.</li>
            <li><a href="/edu/courses">Изучите основы в EDU</a>: короткие уроки, в каждом — задачи для практики.</li>
          </ol>
          <h3>Как всё устроено</h3>
          <dl>
            <dt>Отправка решений</dt><dd>Напишите решение в своём редакторе и нажмите «Отправить» на странице задачи. Вердикт появится на странице «Статус»: «Полное решение» или тест, на котором решение не прошло.</dd>
            <dt>Рейтинг</dt><dd>Рейтинговые соревнования меняют ваш рейтинг, а его цвет — это ваше звание: ${ranks}.</dd>
            <dt>Дивизионы</dt><dd>Раунд рейтинговый для вас, если ваш рейтинг в его диапазоне: Div. 4 — ниже 1400, Div. 3 — ниже 1600, Div. 2 — ниже 2100, Div. 1 — от 1900. Образовательные раунды — уровня Div. 2.</dd>
            <dt>Тренируйтесь когда угодно</dt><dd>Любой прошедший раунд можно пройти как <b>виртуальное соревнование</b>, с его исходным таймером, со страницы «Соревнования».</dd>
          </dl>
        </section>
        <section>
          <h3>Где что находится</h3>
          <ul class="g-map">${map}</ul>
          <h3>Горячие клавиши</h3>
          <ul class="g-keys"><li><kbd>/</kbd> поиск</li><li><kbd>s</kbd> отправить (на задаче)</li><li><kbd>j</kbd> <kbd>k</kbd> по строкам таблицы</li><li><kbd>Enter</kbd> открыть строку</li><li><kbd>?</kbd> это руководство</li><li><kbd>Esc</kbd> закрыть</li></ul>
        </section>
      </div>
      <div class="g-foot"><button type="button" class="g-hide">Убрать «С чего начать» из меню</button><span>Вернуть можно во всплывающем окне расширения.</span></div>
    </div>` : (ranks, map) => `<div class="cfts-c-guide" role="dialog" aria-label="How Codeforces works">
      <div class="g-head"><b>New to Codeforces?</b><span>Where things are, and how to get started.</span><button type="button" class="g-x" aria-label="Close">✕</button></div>
      <div class="g-cols">
        <section>
          <h3>Start in three steps</h3>
          <ol>
            <li><a href="/problemset?tags=800-1300">Solve an easy problem</a>. Problems are rated from 800 (easiest) to 3500; start between 800 and 1300.</li>
            <li><a href="/contests">Join a Div. 4 or Div. 3 round</a>. Register before it starts; most rounds last about two hours.</li>
            <li><a href="/edu/courses">Learn the basics on EDU</a>: short lessons, each with practice problems.</li>
          </ol>
          <h3>How it works</h3>
          <dl>
            <dt>Submitting</dt><dd>Write your solution in your own editor, then press Submit on the problem. The verdict shows on the Status page: Accepted, or the test it failed on.</dd>
            <dt>Rating</dt><dd>Rated contests move your rating, and its colour is your rank: ${ranks}.</dd>
            <dt>Divisions</dt><dd>A round is rated for you when your rating is in its range: Div. 4 below 1400, Div. 3 below 1600, Div. 2 below 2100, Div. 1 from 1900. Educational rounds are Div. 2 level.</dd>
            <dt>Practise anytime</dt><dd>Any past round can be replayed as a <b>virtual contest</b>, with its original timer, from the Contests page.</dd>
          </dl>
        </section>
        <section>
          <h3>Where things are</h3>
          <ul class="g-map">${map}</ul>
          <h3>Keyboard shortcuts</h3>
          <ul class="g-keys"><li><kbd>/</kbd> search</li><li><kbd>s</kbd> submit, on a problem</li><li><kbd>j</kbd> <kbd>k</kbd> move through a table's rows</li><li><kbd>Enter</kbd> open the row</li><li><kbd>?</kbd> this guide</li><li><kbd>Esc</kbd> close it</li></ul>
        </section>
      </div>
      <div class="g-foot"><button type="button" class="g-hide">Hide "Start here" from the menu</button><span>You can bring it back from the extension's popup.</span></div>
    </div>`;
  function buildGuide() {
    const map = [...(menu() || document.createElement('ul')).querySelectorAll(':scope > li:not(.cfts-c-navitem) > a')]
      .map((a) => [a, navInfo(a)]).filter(([, d]) => d)
      .map(([a, d]) => `<li><a href="${esc(a.getAttribute('href'))}">${esc(a.textContent.trim())}</a><span>${esc(d)}</span></li>`).join('');
    const ranks = RANKS.map(([c, en, ru, r]) => `<span class="cfts-c-r-${c}">${RU ? ru : en}</span> ${r}`).join(' · ');
    const el = j.make(GUIDE(ranks, map));
    el.querySelectorAll('*').forEach((n) => n.setAttribute('data-cfts', ''));
    el.querySelector('.g-x').addEventListener('click', closeGuide);
    el.querySelector('.g-hide').addEventListener('click', () => chrome.storage.local.set({ [GUIDE_KEY]: Object.assign({}, guide, { nav: false }) }));
    return el;
  }
  /* the panel hangs off <body>, placed under the menu item (the menu's boxes
     may clip their content); read once per opening, after it is in place */
  function openGuide() {
    if (!navItem) return;
    if (!panel) panel = buildGuide();
    if (!panel.isConnected) document.body.appendChild(panel);
    navItem.firstChild.setAttribute('aria-expanded', 'true');
    const r = navItem.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - panel.offsetWidth - 8));
    panel.style.top = `${r.bottom + window.scrollY + 8}px`;
    panel.style.left = `${left + window.scrollX}px`;
  }
  function closeGuide() {
    if (panel && panel.isConnected) panel.remove();
    if (navItem) navItem.firstChild.setAttribute('aria-expanded', 'false');
  }

  /* ---- a row cursor for the problemset and status tables (j / k, Enter) ----------
     work only on a key press: nothing runs per row at load */
  let cursor = null;
  function cursorRows() {
    const t = document.querySelector('.datatable table.problems, table.status-frame-datatable');
    return t ? [...t.rows].filter((r) => r.cells.length > 1 && r.querySelector('td') && r.offsetParent) : [];
  }
  function moveCursor(step) {
    const rows = cursorRows();
    if (!rows.length) return false;
    let i = cursor ? rows.indexOf(cursor) : -1;
    i = i < 0 ? (step > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, i + step));
    if (cursor) cursor.classList.remove('cfts-c-cursor');
    cursor = rows[i];
    cursor.classList.add('cfts-c-cursor');
    cursor.scrollIntoView({ block: 'nearest' });
    return true;
  }
  function openCursor() {
    if (!cursor || !cursor.isConnected) return false;
    /* problemset: the name; status: the problem */
    const a = cursor.closest('table.problems') ? cursor.querySelector('td:nth-child(2) a') : cursor.querySelector('td:nth-child(4) a, td a[href*="/problem/"]');
    if (!a) return false;
    location.href = a.href;
    return true;
  }

  /* ---- keyboard shortcuts -------------------------------------------------------- */
  function typing(t) {
    return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t.closest && t.closest('.ace_editor, .CodeMirror'))));
  }
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (panel && panel.isConnected) { closeGuide(); e.preventDefault(); }
      else if (cursor) { cursor.classList.remove('cfts-c-cursor'); cursor = null; }
      return;
    }
    if (typing(e.target)) return;
    if (e.key === '/') {
      const s = document.querySelector('input.search');
      if (s) { e.preventDefault(); s.focus(); }
    } else if (e.key === 's' && !e.shiftKey) {
      const a = document.querySelector('.cfts-c-submit');
      if (a) { e.preventDefault(); location.href = a.href; }
    } else if (e.key === '?') {
      if (!navItem) return;
      e.preventDefault();
      panel && panel.isConnected ? closeGuide() : openGuide();
    } else if ((e.key === 'j' || e.key === 'k') && !e.shiftKey) {
      if (moveCursor(e.key === 'j' ? 1 : -1)) e.preventDefault();
    } else if (e.key === 'Enter' && cursor && (e.target === document.body || e.target === document.documentElement)) {
      if (openCursor()) e.preventDefault();
    }
  }
  /* a click outside the guide closes it */
  function onDocClick(e) {
    if (!panel || !panel.isConnected || panel.contains(e.target) || (navItem && navItem.contains(e.target))) return;
    if (!(e.target.closest && e.target.closest('.cfts-c-open'))) closeGuide();
  }

  /* ---- apply / undo -------------------------------------------------------------- */
  function apply() {
    j.applied = true;
    const search = document.querySelector('input.search');
    if (search && !search.placeholder) j.attr(search, 'placeholder', L.search);
    navTips();
    j.on(document, 'keydown', onKey);
    j.on(document, 'click', onDocClick);
    for (const cd of document.querySelectorAll('#sidebar .countdown')) dayCountdown(j, cd, L.units);
    for (const step of [bellKeys, lastLanguage]) { try { step(); } catch (e) { /* keep the rest */ } }
    try {
      if (PATH === '/' || PATH === '') homePage();
      else if (/^\/contests\/?$/.test(PATH)) contestsPage();
      else if (/^\/(contest|gym)\/\d+\/standings(\/|$)/.test(PATH)) standingsPage();
      else if (/^\/problemset\/?$/.test(PATH) || /^\/problemset\/page\/\d+/.test(PATH)) problemsetPage();
      else if (/^\/(problemset\/problem|contest\/\d+\/problem|gym\/\d+\/problem)\//.test(PATH)) problemPage();
      else if (/^\/(problemset\/status|contest\/\d+\/status|gym\/\d+\/status)(\/|$)/.test(PATH)) statusPage();
      else if (/^\/blog\/entry\/\d+/.test(PATH)) localTimes();
      else if (/^\/profile\/[^/]+\/?$/.test(PATH)) profilePage();
    } catch (e) { /* a page we don't recognise keeps what was applied so far */ }
    if (guide.nav !== false) addStartHere();
    syncTopics();
  }
  function undo() {
    removeStartHere();
    panel = null;
    if (cursor) { cursor.classList.remove('cfts-c-cursor'); cursor = null; }
    j.undo();
    /* the Guided layer of the next theme owns the topics attribute, if it applies */
    if (!(root.hasAttribute('data-cf-look') && root.getAttribute('data-cf-layout') === 'guided')) root.removeAttribute('data-cf-topics');
  }
  let ready = false, want = false;
  globalThis.__cftsClassicSync = (on) => {
    want = on;
    if (!ready) return;                       // storage first: the guide's state decides what is added
    if (on && !j.applied) apply();
    else if (!on && j.applied) undo();
  };
  chrome.storage.local.get([GUIDE_KEY, 'cfTopics'], (r) => {
    guide = (r && r[GUIDE_KEY]) || {};
    topicsOn = !!(r && r.cfTopics);
    ready = true;
    globalThis.__cftsClassicSync(want);
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local') return;
    if (c.cfTopics) { topicsOn = !!c.cfTopics.newValue; if (j.applied) syncTopics(); }
    if (c[GUIDE_KEY]) {
      guide = c[GUIDE_KEY].newValue || {};
      if (j.applied) { undo(); apply(); }    // the menu item, the home card, the caption hint
    }
  });
})();
