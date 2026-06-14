/* ============================================================
   LOOMUS Connection GAME — daily rotation engine
   ------------------------------------------------------------
   - One curated puzzle bank (LOOMUS_PUZZLES), drawn from the
     real book library. Each puzzle = 3 "threads" (LOOMUS's
     viewpoint), each thread = a pair of book-ideas.
   - Deterministic daily rotation by calendar date, so every
     reader sees the SAME puzzle on the same day (this is what
     makes the share card work, Wordle-style).
   - Icons are keyed by BOOK, so the 6 ideas on any day are
     naturally distinct and never spoil the grouping.
   - To grow the game: add a book to BOOKS, add an icon, append
     a puzzle to LOOMUS_PUZZLES. No other code changes.
   API:  LoomusConnections.today()  ->  { number, dateLabel, tiles[6], threads{1,2,3} }
         LoomusConnections.pick(n)   ->  same, for puzzle index n (testing)
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- 1. ICON LIBRARY (one signature per book) ---------- */
  var ICONS = {
    brain:'<svg viewBox="0 0 150 60"><line x1="6" y1="15" x2="40" y2="29" stroke="#1f1d18" stroke-width="1.4" opacity=".5" stroke-linecap="round"/><line x1="6" y1="25" x2="40" y2="31" stroke="#1f1d18" stroke-width="1.4" opacity=".3" stroke-linecap="round"/><line x1="6" y1="35" x2="40" y2="33" stroke="#1f1d18" stroke-width="1.4" opacity=".5" stroke-linecap="round"/><line x1="6" y1="45" x2="40" y2="35" stroke="#1f1d18" stroke-width="1.4" opacity=".3" stroke-linecap="round"/><path d="M47 19 q-9 0 -9 10 q0 11 13 11 q15 0 15 -12 q0 -10 -11 -10 q0 -6 -8 -1 Z" fill="#c79bb0" stroke="#1f1d18" stroke-width="1.5"/><path d="M51 21 q3 4 0 8" stroke="#1f1d18" stroke-width="0.9" fill="none" opacity=".4"/><circle cx="49" cy="30" r="2" fill="#1f1d18"/><circle cx="58" cy="30" r="2" fill="#1f1d18"/><circle cx="49.7" cy="29.3" r=".6" fill="#fff"/><circle cx="58.7" cy="29.3" r=".6" fill="#fff"/><path d="M49 35 q4.5 3 9 0" stroke="#1f1d18" stroke-width="1.2" fill="none" stroke-linecap="round"/><ellipse cx="45" cy="34" rx="2" ry="1.4" fill="#e07a55" opacity=".4"/><line x1="67" y1="30" x2="118" y2="30" stroke="#c19a3e" stroke-width="2.8" stroke-linecap="round"/><text x="131" y="35" font-size="15" fill="#c19a3e">&#10022;</text></svg>',
    transformer:'<svg viewBox="0 0 150 60"><path d="M45 30 Q53 24 61 27" stroke="#1f1d18" stroke-width="1.2" stroke-dasharray="1.5 3" fill="none" opacity=".4"/><path d="M89 27 Q97 24 105 30" stroke="#1f1d18" stroke-width="1.2" stroke-dasharray="1.5 3" fill="none" opacity=".4"/><rect x="10" y="22" width="32" height="22" rx="9" fill="#c19a3e" stroke="#1f1d18" stroke-width="1.5"/><path d="M18 43 l-2 5 l7 -3 Z" fill="#c19a3e" stroke="#1f1d18" stroke-width="1.5" stroke-linejoin="round"/><circle cx="22" cy="31" r="2.3" fill="#1f1d18"/><circle cx="32" cy="31" r="2.3" fill="#1f1d18"/><circle cx="22.9" cy="30.2" r=".7" fill="#fff"/><circle cx="32.9" cy="30.2" r=".7" fill="#fff"/><path d="M23 36 q4 3 8 0" stroke="#1f1d18" stroke-width="1.3" fill="none" stroke-linecap="round"/><ellipse cx="17" cy="35" rx="2.2" ry="1.5" fill="#e07a55" opacity=".4"/><rect x="59" y="13" width="32" height="22" rx="9" fill="#2d4a3e" stroke="#1f1d18" stroke-width="1.5"/><path d="M67 34 l-2 5 l7 -3 Z" fill="#2d4a3e" stroke="#1f1d18" stroke-width="1.5" stroke-linejoin="round"/><circle cx="71" cy="22" r="2.3" fill="#faf7f1"/><circle cx="81" cy="22" r="2.3" fill="#faf7f1"/><circle cx="71.9" cy="21.2" r=".7" fill="#1f1d18"/><circle cx="81.9" cy="21.2" r=".7" fill="#1f1d18"/><path d="M72 27 q4 3 8 0" stroke="#faf7f1" stroke-width="1.3" fill="none" stroke-linecap="round"/><rect x="108" y="22" width="32" height="22" rx="9" fill="#3a4a6b" stroke="#1f1d18" stroke-width="1.5"/><path d="M132 43 l2 5 l-7 -3 Z" fill="#3a4a6b" stroke="#1f1d18" stroke-width="1.5" stroke-linejoin="round"/><circle cx="118" cy="31" r="2.3" fill="#faf7f1"/><circle cx="128" cy="31" r="2.3" fill="#faf7f1"/><circle cx="118.9" cy="30.2" r=".7" fill="#1f1d18"/><circle cx="128.9" cy="30.2" r=".7" fill="#1f1d18"/><path d="M119 36 q4 3 8 0" stroke="#faf7f1" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>',
    money:'<svg viewBox="0 0 150 60"><ellipse cx="75" cy="53" rx="34" ry="3" fill="#1f1d18" opacity=".07"/><circle cx="75" cy="18" r="13" fill="#e0c266" stroke="#1f1d18" stroke-width="1.6"/><path d="M66 11 a13 13 0 0 1 15 -1" stroke="#fff" stroke-width="1.6" fill="none" opacity=".5" stroke-linecap="round"/><circle cx="70" cy="17" r="1.7" fill="#1f1d18"/><circle cx="80" cy="17" r="1.7" fill="#1f1d18"/><circle cx="70.7" cy="16.2" r=".6" fill="#fff"/><circle cx="80.7" cy="16.2" r=".6" fill="#fff"/><path d="M70 22 q5 3 10 0" stroke="#1f1d18" stroke-width="1.3" fill="none" stroke-linecap="round"/><ellipse cx="64" cy="21" rx="2" ry="1.4" fill="#c0392b" opacity=".3"/><ellipse cx="86" cy="21" rx="2" ry="1.4" fill="#c0392b" opacity=".3"/><g stroke-linecap="round"><circle cx="48" cy="45" r="4.5" fill="#2d4a3e"/><line x1="48" y1="49.5" x2="48" y2="52" stroke="#2d4a3e" stroke-width="2"/><line x1="45" y1="41" x2="62" y2="31" stroke="#2d4a3e" stroke-width="2"/></g><g stroke-linecap="round"><circle cx="102" cy="45" r="4.5" fill="#3a4a6b"/><line x1="102" y1="49.5" x2="102" y2="52" stroke="#3a4a6b" stroke-width="2"/><line x1="105" y1="41" x2="88" y2="31" stroke="#3a4a6b" stroke-width="2"/></g><g stroke-linecap="round"><circle cx="75" cy="47" r="4.5" fill="#b0593f"/><line x1="72" y1="43" x2="72" y2="34" stroke="#b0593f" stroke-width="2"/><line x1="78" y1="43" x2="78" y2="34" stroke="#b0593f" stroke-width="2"/></g></svg>',
    founder:'<svg viewBox="0 0 150 60"><path d="M75 6 L55 31 L95 31 Z" fill="#e0c266" opacity=".18"/><circle cx="75" cy="11" r="4" fill="#f2d9b0" stroke="#1f1d18" stroke-width="1.4"/><line x1="75" y1="15" x2="75" y2="24" stroke="#1f1d18" stroke-width="1.8" stroke-linecap="round"/><path d="M68 16 q7 -5 14 0" stroke="#1f1d18" stroke-width="1.8" fill="none" stroke-linecap="round"/><line x1="75" y1="24" x2="70" y2="30" stroke="#1f1d18" stroke-width="1.8" stroke-linecap="round"/><line x1="75" y1="24" x2="80" y2="30" stroke="#1f1d18" stroke-width="1.8" stroke-linecap="round"/><rect x="61" y="31" width="28" height="7" rx="1.5" fill="#c19a3e" stroke="#1f1d18" stroke-width="1.4"/><path d="M55 54 q3 -10 10 -12 q3 5 6 0 q3 5 6 0 q7 2 10 12 Z" fill="#2d4a3e" stroke="#1f1d18" stroke-width="1.3" stroke-linejoin="round"/><text x="75" y="50" font-size="7.5" text-anchor="middle" fill="#faf7f1" font-style="italic">gov $</text></svg>',
    cause:'<svg viewBox="0 0 150 60"><ellipse cx="33" cy="52" rx="15" ry="2.6" fill="#1f1d18" opacity=".08"/><circle cx="125" cy="35" r="9" fill="#e0c266" stroke="#1f1d18" stroke-width="1.3"/><g stroke="#c19a3e" stroke-width="1.6" stroke-linecap="round"><line x1="125" y1="20" x2="125" y2="15"/><line x1="139" y1="27" x2="143" y2="24"/><line x1="111" y1="27" x2="107" y2="24"/></g><line x1="98" y1="45" x2="148" y2="45" stroke="#1f1d18" stroke-width="1.2" opacity=".4"/><path d="M24 45 q-9 -2 -9 -13 q0 -10 10 -11 q2 -7 8 -3 q3 -7 8 -1 q-2 4 -6 4 q4 3 3 9 q-1 9 -14 9 Z" fill="#b0593f" stroke="#1f1d18" stroke-width="1.4" stroke-linejoin="round"/><path d="M33 12 q3 -5 7 -2 q-1 4 -4 4 Z" fill="#c0392b" stroke="#1f1d18" stroke-width="1"/><circle cx="37" cy="21" r="1.5" fill="#1f1d18"/><circle cx="37.6" cy="20.4" r=".5" fill="#fff"/><path d="M43 23 l8 -1 l-8 4 Z" fill="#e0c266" stroke="#1f1d18" stroke-width="0.8" stroke-linejoin="round"/><line x1="24" y1="45" x2="21" y2="51" stroke="#c19a3e" stroke-width="1.6" stroke-linecap="round"/><line x1="30" y1="45" x2="33" y2="51" stroke="#c19a3e" stroke-width="1.6" stroke-linecap="round"/><rect x="52" y="6" width="46" height="16" rx="8" fill="#faf7f1" stroke="#1f1d18" stroke-width="1.2"/><path d="M58 22 l-2 5 l6 -4 Z" fill="#faf7f1" stroke="#1f1d18" stroke-width="1.2" stroke-linejoin="round"/><text x="75" y="17" font-size="8" text-anchor="middle" fill="#1f1d18" font-style="italic">I did that!</text></svg>',
    correlation:'<svg viewBox="0 0 150 60"><ellipse cx="35" cy="52" rx="21" ry="3" fill="#1f1d18" opacity=".08"/><line x1="64" y1="46" x2="138" y2="15" stroke="#2d4a3e" stroke-width="2" stroke-linecap="round"/><circle cx="80" cy="37" r="2.4" fill="#2d4a3e"/><circle cx="98" cy="29" r="2.4" fill="#2d4a3e"/><circle cx="116" cy="22" r="2.4" fill="#2d4a3e"/><rect x="18" y="16" width="34" height="30" rx="9" fill="#aab4c0" stroke="#1f1d18" stroke-width="1.6"/><line x1="35" y1="16" x2="35" y2="9" stroke="#1f1d18" stroke-width="1.5"/><circle cx="35" cy="7" r="2.6" fill="#c19a3e" stroke="#1f1d18" stroke-width="1"/><circle cx="28" cy="28" r="3.6" fill="#faf7f1" stroke="#1f1d18" stroke-width="1.2"/><circle cx="43" cy="28" r="3.6" fill="#faf7f1" stroke="#1f1d18" stroke-width="1.2"/><circle cx="28" cy="28" r="1.6" fill="#1f1d18"/><circle cx="43" cy="28" r="1.6" fill="#1f1d18"/><line x1="29" y1="39" x2="42" y2="39" stroke="#1f1d18" stroke-width="1.6" stroke-linecap="round"/><path d="M54 16 q2.5 4 0 7 q-3 -2 0 -7 Z" fill="#5aa8e0" stroke="#1f1d18" stroke-width="0.8"/></svg>',
    manymodels:'<svg viewBox="0 0 150 60"><ellipse cx="75" cy="54" rx="30" ry="3" fill="#1f1d18" opacity=".07"/><path d="M52 40 q-8 -2 -8 -15 q0 -16 18 -17 q4 -7 12 -3 q8 -3 13 4 q10 1 10 14 q0 16 -16 17 q-2 6 -10 4 q-9 5 -16 -2 q-3 1 -3 -3 Z" fill="#c79bb0" stroke="#1f1d18" stroke-width="1.5"/><rect x="55" y="18" width="11" height="9" rx="1.5" fill="#faf7f1" stroke="#1f1d18" stroke-width="1"/><rect x="69" y="16" width="11" height="9" rx="1.5" fill="#faf7f1" stroke="#1f1d18" stroke-width="1"/><rect x="83" y="19" width="11" height="9" rx="1.5" fill="#faf7f1" stroke="#1f1d18" stroke-width="1"/><rect x="60" y="30" width="11" height="9" rx="1.5" fill="#faf7f1" stroke="#1f1d18" stroke-width="1"/><rect x="76" y="31" width="11" height="9" rx="1.5" fill="#faf7f1" stroke="#1f1d18" stroke-width="1"/><circle cx="60.5" cy="22.5" r="1.4" fill="#c19a3e"/><circle cx="74.5" cy="20.5" r="1.4" fill="#2d4a3e"/><circle cx="88.5" cy="23.5" r="1.4" fill="#b0593f"/><circle cx="65.5" cy="34.5" r="1.4" fill="#3a4a6b"/><circle cx="81.5" cy="35.5" r="1.4" fill="#c0392b"/></svg>',
    mindmodel:'<svg viewBox="0 0 150 60"><path d="M58 46 q-12 -1 -12 -16 q0 -17 19 -18 q5 -8 14 -3 q9 -3 14 5 q11 1 11 15 q0 16 -15 17" fill="none" stroke="#2d4a3e" stroke-width="1.8" stroke-linecap="round"/><line x1="55" y1="46" x2="100" y2="46" stroke="#1f1d18" stroke-width="1.2" opacity=".4"/><line x1="55" y1="46" x2="55" y2="20" stroke="#1f1d18" stroke-width="1.2" opacity=".4"/><polyline points="57,40 66,30 74,34 84,22 96,26" fill="none" stroke="#c19a3e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="66" cy="30" r="1.8" fill="#c19a3e"/><circle cx="84" cy="22" r="1.8" fill="#c19a3e"/><text x="106" y="30" font-size="11" fill="#b0593f" font-style="italic">f(x)</text></svg>',
    art:'<svg viewBox="0 0 150 60"><line x1="75" y1="10" x2="75" y2="54" stroke="#7a5a3a" stroke-width="2"/><line x1="62" y1="52" x2="75" y2="44" stroke="#7a5a3a" stroke-width="2"/><line x1="88" y1="52" x2="75" y2="44" stroke="#7a5a3a" stroke-width="2"/><rect x="48" y="12" width="44" height="34" rx="2" fill="#faf7f1" stroke="#1f1d18" stroke-width="1.6"/><circle cx="62" cy="24" r="4" fill="#e0c266"/><path d="M50 44 L64 30 L74 38 L82 28 L90 40 L90 44 Z" fill="#2d4a3e" opacity=".75"/><path d="M50 44 L64 30 L74 38 L82 28 L90 40" fill="none" stroke="#1f1d18" stroke-width="1" opacity=".5"/><circle cx="112" cy="22" r="2.2" fill="#c19a3e"/><path d="M108 22 q4 -6 8 0" stroke="#c19a3e" stroke-width="1.2" fill="none"/></svg>',
    future:'<svg viewBox="0 0 150 60"><ellipse cx="75" cy="53" rx="20" ry="2.6" fill="#1f1d18" opacity=".08"/><rect x="60" y="20" width="30" height="24" rx="8" fill="#9fb0a8" stroke="#1f1d18" stroke-width="1.6"/><line x1="75" y1="20" x2="75" y2="12" stroke="#1f1d18" stroke-width="1.5"/><circle cx="75" cy="10" r="2.6" fill="#c19a3e" stroke="#1f1d18" stroke-width="1"/><rect x="66" y="27" width="18" height="9" rx="2" fill="#1f3528"/><circle cx="71" cy="31.5" r="1.8" fill="#d4ac4a"/><circle cx="79" cy="31.5" r="1.8" fill="#d4ac4a"/><line x1="60" y1="33" x2="54" y2="33" stroke="#1f1d18" stroke-width="2" stroke-linecap="round"/><line x1="90" y1="33" x2="96" y2="33" stroke="#1f1d18" stroke-width="2" stroke-linecap="round"/><text x="112" y="37" font-size="12" fill="#c19a3e" font-style="italic">3.0</text></svg>',
    wave:'<svg viewBox="0 0 150 60"><path d="M10 46 q14 -28 30 -16 q10 8 4 18 q-3 6 -10 4 q8 -2 8 -10 q0 -10 -12 -8 q-14 3 -10 18 Z" fill="#3a6ea0" stroke="#1f1d18" stroke-width="1.5" stroke-linejoin="round"/><path d="M40 30 q6 -6 12 -2" stroke="#faf7f1" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/><path d="M14 50 q20 -8 40 -2 q20 6 40 -2 q20 -6 40 0" fill="none" stroke="#3a6ea0" stroke-width="2" stroke-linecap="round" opacity=".5"/><path d="M14 54 q20 -6 40 -1 q20 5 40 -1 q20 -5 40 1" fill="none" stroke="#3a6ea0" stroke-width="2" stroke-linecap="round" opacity=".3"/><text x="120" y="30" font-size="14" fill="#c19a3e">&#10022;</text></svg>',
    umwelt:'<svg viewBox="0 0 150 60"><ellipse cx="55" cy="52" rx="24" ry="3" fill="#1f1d18" opacity=".07"/><path d="M40 48 q-10 -2 -10 -14 q0 -12 12 -13 q3 -8 9 -3 q4 -2 7 2 l10 -3 -6 7 q6 4 5 12 q-2 12 -16 13 Z" fill="#b0843a" stroke="#1f1d18" stroke-width="1.5" stroke-linejoin="round"/><circle cx="50" cy="30" r="2" fill="#1f1d18"/><circle cx="50.6" cy="29.3" r=".6" fill="#fff"/><path d="M58 33 l8 -1 l-7 4 Z" fill="#1f1d18" opacity=".5"/><g stroke="#c19a3e" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"><path d="M86 30 q6 -6 0 -14"/><path d="M94 32 q9 -8 0 -22"/><path d="M102 34 q12 -10 0 -28"/></g></svg>'
  };

  /* ---------- 2. BOOK LIBRARY (one canonical idea per book) ---------- */
  var BOOKS = {
    bennett:{title:'A Brief History of Intelligence', front:'The brain evolved to weight which signals matter', frag:'weight what matters', icon:'brain'},
    attn:{title:'Attention Is All You Need', front:'The Transformer learns which words to weight', frag:'every word, at once', icon:'transformer'},
    sapiens:{title:'Sapiens', front:'Money works only because everyone agrees to believe in it', frag:'a shared fiction', icon:'money'},
    code:{title:'The Code', front:'Silicon Valley sold itself as lone geniuses + free markets', frag:'lone geniuses?', icon:'founder'},
    why:{title:'The Book of Why', front:'Pattern-matching can never tell you what causes what', frag:'pattern ≠ cause', icon:'cause'},
    align:{title:'The Alignment Problem', front:'Modern AI is the largest correlation engine ever built', frag:'a correlation engine', icon:'correlation'},
    hawkins:{title:'A Thousand Brains', front:'The cortex runs thousands of models of the world at once', frag:'a thousand models', icon:'manymodels'},
    lindsay:{title:'Models of the Mind', front:'No single theory captures the mind — only many partial models', frag:'no one equation', icon:'mindmodel'},
    gombrich:{title:'The Story of Art', front:'Every era literally learned to see the world differently', frag:'trained to see', icon:'art'},
    tegmark:{title:'Life 3.0', front:"Mind may be substrate-independent — it's the pattern, not the meat", frag:'mind without meat', icon:'future'},
    suleyman:{title:'The Coming Wave', front:'Every powerful technology eventually escapes its makers', frag:'the coming wave', icon:'wave'},
    yong:{title:'An Immense World', front:'Each creature senses a different slice of reality', frag:'a different world', icon:'umwelt'}
  };

  /* ---------- 3. PUZZLE BANK (each = 3 threads = LOOMUS's viewpoint) ---------- */
  /* pair: [bookId, bookId] · title/body: LOOMUS's take (a perspective, not the answer) */
  var LOOMUS_PUZZLES = [
    { threads:[
      {pair:['bennett','attn'], emoji:'🧠', title:'Attention as filtering', body:'Both answer the same problem — too much input, too little time — by learning to weight what matters. Brains took 600M years; the Transformer, one paper.'},
      {pair:['code','sapiens'], emoji:'🪙', title:'Useful fictions', body:"A shared story that binds a group together — and works best when no one notices it's a story."},
      {pair:['why','align'], emoji:'🔗', title:'Pattern vs. cause', body:'The blind spot of every correlation engine: it sees what goes together, never what makes what happen.'}
    ]},
    { threads:[
      {pair:['hawkins','lindsay'], emoji:'🧩', title:'Many minds in one', body:'Neither book trusts a single grand theory of cognition. The mind is a committee of partial models, not one master equation.'},
      {pair:['yong','gombrich'], emoji:'👁', title:'Trained to see', body:"Perception isn't a window; it's a habit. Animals and art eras alike each carve out their own slice of the visible."},
      {pair:['suleyman','tegmark'], emoji:'🧭', title:'Steering what we unleash', body:'Both ask the same uncomfortable question: once a technology can improve itself, who is still holding the wheel?'}
    ]},
    { threads:[
      {pair:['bennett','hawkins'], emoji:'🧠', title:'Prediction all the way down', body:'Intelligence as a stack of prediction machines — from the first steering neurons to thousands of cortical models guessing the next instant.'},
      {pair:['attn','align'], emoji:'⚙️', title:'Scaling the guess', body:'Attention made correlation scale; alignment is the bill that came due once the guess grew powerful enough to act.'},
      {pair:['sapiens','tegmark'], emoji:'📖', title:'Stories that steer a species', body:"Shared fictions organized humans. The next fiction we'll have to agree on is which future is worth building."}
    ]},
    { threads:[
      {pair:['why','lindsay'], emoji:'🪜', title:'Explain vs. predict', body:"A model that forecasts isn't a model that understands. Both books climb from correlation toward real causal structure."},
      {pair:['gombrich','yong'], emoji:'🎨', title:'Different eyes, different worlds', body:'Drop the assumption of one true picture and what remains is many equally real ways of perceiving.'},
      {pair:['code','suleyman'], emoji:'🌊', title:'Who controls the wave', body:'Power over a transformative technology rarely sits where the myth says it does — and rarely stays contained.'}
    ]},
    { threads:[
      {pair:['bennett','yong'], emoji:'🌍', title:'Shaped by what you sense', body:'A brain is built around the world it can detect. Change the senses and you change the mind that grows on top.'},
      {pair:['attn','hawkins'], emoji:'🔮', title:'The core trick is prediction', body:'Guess the next thing, check, repeat. Cortex and Transformer converge on the same loop from opposite ends.'},
      {pair:['align','tegmark'], emoji:'🛡', title:'The control problem', body:'What we want vs. what we actually specify — the gap that turns a capable system into a dangerous one.'}
    ]},
    { threads:[
      {pair:['sapiens','gombrich'], emoji:'🏛', title:'Culture as shared imagination', body:'Myth and art are the same move: a group agreeing to treat something invented as real, then building a world on it.'},
      {pair:['why','attn'], emoji:'❓', title:"Correlation isn't understanding", body:"The most powerful pattern-matcher ever built still can't tell you why — the exact gap this book was written about."},
      {pair:['hawkins','tegmark'], emoji:'🤖', title:'What a mind could become', body:"If thought is just the right pattern of models, then mind isn't bound to neurons — or to us."}
    ]}
  ];

  /* ---------- 4. ROTATION (deterministic by calendar date) ---------- */
  var BASE_DATE = new Date(2026, 5, 14);  // 14 June 2026 = puzzle index 0
  var BASE_NUMBER = 142;                   // shown as "No. 142" that day
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function daysSince(d) {
    var a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((a - BASE_DATE) / 86400000);
  }
  function mod(n, m) { return ((n % m) + m) % m; }

  function assemble(puzzleIndex, number, dateObj) {
    var p = LOOMUS_PUZZLES[mod(puzzleIndex, LOOMUS_PUZZLES.length)];
    var tiles = [], threads = {};
    p.threads.forEach(function (t, i) {
      var g = i + 1;
      t.pair.forEach(function (id) {
        var b = BOOKS[id];
        tiles.push({ id: id, t: b.front, frag: b.frag, bk: b.title, g: g, art: ICONS[b.icon] });
      });
      threads[g] = {
        cls: 't' + g,
        th: t.emoji + ' ' + t.title,
        tb: t.body,
        ts: BOOKS[t.pair[0]].title + ' × ' + BOOKS[t.pair[1]].title,
        pair: t.pair.slice()
      };
    });
    return {
      number: number,
      dateLabel: (dateObj.getDate()) + ' ' + MONTHS[dateObj.getMonth()],
      tiles: tiles,
      threads: threads
    };
  }

  var API = {
    today: function () {
      var now = new Date();
      var ds = daysSince(now);
      return assemble(ds, BASE_NUMBER + ds, now);
    },
    // testing helper: jump to any puzzle index
    pick: function (n) {
      return assemble(n, BASE_NUMBER + n, new Date(BASE_DATE.getTime() + n * 86400000));
    },
    count: LOOMUS_PUZZLES.length,
    BOOKS: BOOKS, ICONS: ICONS, PUZZLES: LOOMUS_PUZZLES
  };

  root.LoomusConnections = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
