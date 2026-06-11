/* ═══════════════════════════════════════════════════════════════════════
   loomus-chrome.js · 2026-06-04 PM ship #111 · UNIVERSAL CHROME INJECTOR
   ────────────────────────────────────────────────────────────────────
   ONE file. Drop into any LOOMUS page with:
     <script src="https://loomus.ai/loomus-chrome.js" defer></script>
   …and the page gets the unified dark chrome + inline OTP tray +
   auto-refresh sessions + YOU pill (body sigil + tier) + Day chip + EN.
   Hides common old-chrome selectors automatically.
   ═══════════════════════════════════════════════════════════════════════ */

(function(){
  'use strict';
  if (window.__loomusChromeInit) return;
  window.__loomusChromeInit = true;

  const SUPABASE_URL = 'https://nfcpqwamlykhggsrcsjb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Bc5UTKf0onjSH9wGmgAh7w_UHQArMK-';

  /* ─── Old-chrome selectors to hide on init (one-shot cleanup) ─── */
  const OLD_CHROME_SELECTORS = [
    '.topnav',                          // old plaster topnav (Pompeii v4 mock)
    '.you-tabnav',                      // floating /you tabnav
    'nav.chrome',                       // legacy /you chrome
    'nav.bar:not(.uni-chrome)',         // book-pick old bar
    'nav.nav.wrap',                     // homepage / library old chrome (LMUS, Library, Distill, etc.)
    'nav.nav',                          // generic alternate
    'header.you-head + nav.you-tabnav', // legacy combo
    '.head-left img[src*="loomus-logo"]', // duplicate inline logo
    '.head-left a[aria-label="LOOMUS"]',
    // Book Pick / graphs chrome wrappers (common patterns)
    '.book-chrome', '.bp-chrome', '.graph-chrome',
    // Distill old top
    '.distill-top', '.distill-chrome'
  ];
  // Also hide the parent <header> if it's just a wrapper for an old chrome
  const OLD_CHROME_PARENT_HIDE = [
    'header:has(> nav.nav.wrap)',       // modern :has()
    'header:has(> nav.chrome)',
  ];

  /* ─── CSS ─── */
  const CSS = `
:root{
  --uc-bg:#0e0d0a; --uc-ink:#f3ead4;
  --uc-ochre:#c19a3e; --uc-ochre-bright:#d4ac4a; --uc-gold:#e5b647;
  --uc-rule:rgba(243,234,212,0.10);
  --uc-maroon:#7e2a3a; --uc-maroon-bright:#a23a52;
  --uc-forest:#3e5e2e; --uc-forest-bright:#7da050;
  --uc-plum:#4a2030; --uc-plum-bright:#8e4a5e;
}
.uni-chrome{
  position:fixed; top:0; left:0; right:0; z-index:9999;
  display:flex; align-items:center; gap:14px;
  height:48px; padding:0 24px;
  background:rgba(14,13,10,0.94);
  -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);
  border-bottom:1px solid var(--uc-rule);
  font-family:'Geist Mono','SF Mono',monospace;
  color:var(--uc-ink);
  box-sizing:border-box;
}
.uni-chrome a{ text-decoration:none; color:rgba(243,234,212,0.62); transition:color .18s ease; }
.uni-chrome a:hover{ color:var(--uc-ink); }
.uni-chrome .lm-logo{ display:inline-flex; align-items:center; height:100%; flex-shrink:0; }
.uni-chrome .lm-logo img{ height:20px; width:auto; filter:drop-shadow(0 1px 0 rgba(0,0,0,0.35)); }
.uni-chrome .sep{ width:3px; height:3px; border-radius:50%; background:rgba(243,234,212,0.30); flex-shrink:0; }
.uni-chrome .lobrary{
  display:inline-flex; align-items:center; gap:7px;
  font-family:'Fraunces',serif; font-style:italic; font-weight:500;
  font-size:13.5px; color:rgba(243,234,212,0.72);
  flex-shrink:0;
}
.uni-chrome .lobrary:hover{ color:var(--uc-ink); }
.uni-chrome .lib-icon{
  display:inline-flex; align-items:center; justify-content:center;
  width:15px; height:15px; color:var(--uc-ochre); opacity:0.88;
}
.uni-chrome .lobrary .under{ border-bottom:1px dotted rgba(243,234,212,0.32); }
.uni-chrome .nav-item{
  display:inline-flex; align-items:center; gap:6px;
  font-family:'Geist Mono',monospace; font-weight:500;
  font-size:11px; letter-spacing:0.18em; text-transform:uppercase;
  color:rgba(243,234,212,0.62);
  padding:6px 4px; flex-shrink:0;
}
.uni-chrome .nav-item:hover{ color:var(--uc-ink); }
.uni-chrome .nav-item.active{ color:var(--uc-gold); }
.uni-chrome .nav-item .ni-icon{
  display:inline-flex; width:18px; height:18px;
  color:var(--uc-ochre); opacity:0.92;
  flex-shrink:0;
}
.uni-chrome .nav-item:hover .ni-icon{ opacity:1; }

/* ─── ANIMATED ERLENMEYER FLASK for Distill ── triangular + bubbling ─── */
.uni-chrome .ni-icon.flask{
  overflow:visible; position:relative;
  width:18px; height:18px;
  filter:drop-shadow(0 0 6px rgba(193,154,62,0.25));
  transition:filter .25s ease, transform .25s ease;
}
.uni-chrome .ni-icon.flask svg{ overflow:visible; }
.uni-chrome .nav-item:hover .ni-icon.flask{
  filter:drop-shadow(0 0 10px rgba(229,182,71,0.55));
  transform:translateY(-1px);
}
.uni-chrome .ni-icon.flask .glass-edge{
  stroke:currentColor; stroke-width:1.1; fill:none;
  stroke-linecap:round; stroke-linejoin:round;
}
.uni-chrome .ni-icon.flask .cork{
  stroke:currentColor; stroke-width:1.3;
}
.uni-chrome .ni-icon.flask .shine{
  stroke:rgba(255,250,228,0.55); stroke-width:0.6; fill:none;
}
.uni-chrome .ni-icon.flask .liquid{
  fill:var(--uc-ochre); opacity:0.62;
}
.uni-chrome .nav-item:hover .ni-icon.flask .liquid{
  fill:var(--uc-ochre-bright); opacity:0.78;
}
.uni-chrome .ni-icon.flask .meniscus{
  stroke:var(--uc-gold); stroke-width:0.65; fill:none; opacity:0.92;
  animation:flask-slosh 3.4s ease-in-out infinite;
}
.uni-chrome .ni-icon.flask .bub{
  fill:var(--uc-gold);
  opacity:0;
  transform-box:fill-box; transform-origin:center;
}
.uni-chrome .ni-icon.flask .bub-1{ animation:flask-bubble-tall 2.4s ease-in infinite 0s; }
.uni-chrome .ni-icon.flask .bub-2{ animation:flask-bubble-mid  3.0s ease-in infinite 0.55s; }
.uni-chrome .ni-icon.flask .bub-3{ animation:flask-bubble-tall 2.7s ease-in infinite 1.1s; }
.uni-chrome .ni-icon.flask .bub-4{ animation:flask-bubble-mid  2.2s ease-in infinite 1.65s; }
.uni-chrome .ni-icon.flask .bub-5{ animation:flask-bubble-tall 3.2s ease-in infinite 2.1s; }
.uni-chrome .nav-item:hover .ni-icon.flask .bub{
  fill:var(--uc-ochre-bright);
  animation-duration:1.4s !important;
}
@keyframes flask-bubble-tall {
  0%   { transform:translateY(0) scale(0.3); opacity:0; }
  15%  { opacity:0.95; transform:translateY(-1px) scale(0.6); }
  65%  { opacity:0.85; }
  100% { transform:translateY(-7.5px) scale(1.1); opacity:0; }
}
@keyframes flask-bubble-mid {
  0%   { transform:translateY(0) scale(0.25); opacity:0; }
  20%  { opacity:0.85; transform:translateY(-0.5px) scale(0.55); }
  70%  { opacity:0.7; }
  100% { transform:translateY(-5.5px) scale(0.95); opacity:0; }
}
@keyframes flask-slosh {
  0%, 100% { transform:translateX(-0.35px) translateY(0); }
  50%      { transform:translateX(0.35px) translateY(-0.15px); }
}
@media (prefers-reduced-motion: reduce){
  .uni-chrome .ni-icon.flask .bub,
  .uni-chrome .ni-icon.flask .meniscus{ animation:none; }
  .uni-chrome .ni-icon.flask .bub{ opacity:0.65; }
}
.uni-chrome .nav-item .ni-badge{
  display:inline-flex; align-items:center; justify-content:center;
  margin-left:4px;
  font-family:'Geist Mono',monospace; font-weight:700;
  font-size:8px; letter-spacing:0.14em; text-transform:uppercase;
  background:linear-gradient(180deg, var(--uc-ochre-bright), var(--uc-ochre));
  color:#1a1410;
  padding:2px 6px; border-radius:99px;
  box-shadow:inset 0 1px 0 rgba(255,250,228,0.5);
  letter-spacing:0.10em;
}
.uni-chrome .right{ display:inline-flex; align-items:center; gap:12px; margin-left:auto; flex-shrink:0; }
.uni-chrome .ret-chip{
  display:inline-flex; align-items:center; gap:7px;
  font-family:'Geist Mono',monospace; font-weight:500;
  font-size:10px; letter-spacing:0.20em; text-transform:uppercase;
  color:rgba(243,234,212,0.68);
  padding:5px 11px; border:1px solid rgba(243,234,212,0.18); border-radius:99px;
}
/* V1 #112 S7 — Day chip strong number gets ochre-bright (was just ochre) +
   higher font-weight so the cumulative count actually feels like a count. */
.uni-chrome .ret-chip strong{
  color:var(--uc-ochre-bright); font-weight:700;
  font-size:11px; letter-spacing:0.10em;
}
/* YOU pill — body sigil + tier */
.uni-chrome .you-pill{
  display:inline-flex; align-items:center; gap:8px;
  font-family:'Cinzel',serif; font-weight:600;
  font-size:10px; letter-spacing:0.22em; text-transform:uppercase;
  padding:4px 12px 4px 5px;
  border:1px solid var(--tier-border, rgba(243,234,212,0.20));
  border-radius:99px;
  background:var(--tier-bg, rgba(243,234,212,0.04));
  color:var(--tier-fg, var(--uc-ink));
  cursor:pointer; text-decoration:none;
  transition:transform .18s ease, box-shadow .18s ease;
  position:relative;
}
.uni-chrome .you-pill:hover{
  transform:translateY(-1px);
  box-shadow:0 3px 12px rgba(0,0,0,0.4), 0 0 0 1px var(--tier-glow, rgba(193,154,62,0.5));
}
.uni-chrome .you-pill .sigil{
  width:22px; height:22px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,0.20);
  flex-shrink:0;
}
.uni-chrome .you-pill .sigil svg{ display:block; }
.uni-chrome .you-pill .label{ line-height:1; }
.uni-chrome .you-pill.t-reader     { --tier-bg:rgba(122,102,72,0.30); --tier-fg:rgba(243,234,212,0.78); --tier-border:rgba(122,102,72,0.60); --tier-glow:rgba(193,154,62,0.30); }
.uni-chrome .you-pill.t-student    { --tier-bg:#7e2a3a; --tier-fg:#f3ead4; --tier-border:#a23a52; --tier-glow:rgba(162,58,82,0.55); }
.uni-chrome .you-pill.t-scholar    { --tier-bg:#3e5e2e; --tier-fg:#f3ead4; --tier-border:#7da050; --tier-glow:rgba(125,160,80,0.55); }
.uni-chrome .you-pill.t-patron     { --tier-bg:#8a6c21; --tier-fg:#1a1410; --tier-border:#d4ac4a; --tier-glow:rgba(229,182,71,0.65); }
.uni-chrome .you-pill.t-benefactor { --tier-bg:#4a2030; --tier-fg:#f3ead4; --tier-border:#8e4a5e; --tier-glow:rgba(142,74,94,0.55); }
.uni-chrome .you-pill.you-here{ border-color:var(--uc-gold); box-shadow:0 0 0 1px rgba(229,182,71,0.30); }
/* tooltip */
.uni-chrome .you-pill::after{
  content:attr(data-tt);
  position:absolute; top:calc(100% + 8px); right:0;
  font-family:'Newsreader',serif; font-style:italic;
  font-size:13px; letter-spacing:0; text-transform:none; font-weight:400;
  color:rgba(243,234,212,0.88);
  background:rgba(14,13,10,0.96);
  border:1px solid rgba(193,154,62,0.30); border-radius:4px;
  padding:8px 12px; white-space:nowrap;
  opacity:0; transform:translateY(-3px); pointer-events:none;
  transition:opacity .18s ease, transform .18s ease;
  z-index:30;
}
.uni-chrome .you-pill:hover::after{ opacity:1; transform:translateY(0); }
.uni-chrome .lang{
  font-family:'Geist Mono',monospace; font-weight:600;
  font-size:9.5px; letter-spacing:0.24em; text-transform:uppercase;
  color:rgba(243,234,212,0.55);
  padding:4px 8px; cursor:pointer; background:none; border:none;
}
.uni-chrome .lang:hover{ color:var(--uc-ink); }
.uni-chrome .signin{
  font-family:'Geist Mono',monospace; font-weight:600;
  font-size:9.5px; letter-spacing:0.24em; text-transform:uppercase;
  color:var(--uc-ochre);
  padding:6px 14px; border-radius:99px;
  border:1px solid rgba(193,154,62,0.42);
  background:rgba(193,154,62,0.06);
  cursor:pointer;
}
.uni-chrome .signin:hover{ background:rgba(193,154,62,0.16); border-color:rgba(193,154,62,0.72); color:var(--uc-ochre-bright); }
/* anon vs signed-in */
.uni-chrome.is-anon .ret-chip,
.uni-chrome.is-anon .you-pill{ display:none; }
.uni-chrome:not(.is-anon) .signin{ display:none; }
/* touch-friendly base */
.uni-chrome, .uni-chrome a, .uni-chrome button{
  -webkit-tap-highlight-color:transparent;
  touch-action:manipulation;
}
/* mobile (≤760px) */
@media (max-width: 760px){
  .uni-chrome{ height:52px; padding:0 14px; gap:10px; padding-top:env(safe-area-inset-top, 0); height:calc(52px + env(safe-area-inset-top, 0)); }
  .uni-chrome .nav-item, .uni-chrome .ret-chip{ display:none; }
  /* Keep DISTILL reachable on mobile as a compact flask icon. Was hidden with all
     nav-items → "no distill flask on mobile homepage / LO-brary". 2026-06-10. */
  .uni-chrome #uniNavDistill{ display:inline-flex; align-items:center; gap:0; padding:6px; font-size:0; }
  .uni-chrome #uniNavDistill .ni-icon{ width:20px; height:20px; opacity:1; }
  .uni-chrome #uniNavDistill .ni-badge{ display:none; }
  .uni-chrome .lobrary .under{ display:inline; }
  .uni-chrome .you-pill{ padding:6px 6px; min-height:36px; min-width:36px; }
  .uni-chrome .you-pill .label{ display:none; }
  .uni-chrome .you-pill .sigil{ width:26px; height:26px; }
  .uni-chrome .signin{ padding:9px 16px; font-size:10px; min-height:36px; }
  .uni-chrome .lang{ display:none; }
  .uni-chrome .lm-logo img{ height:22px; }
  body.uc-padded{ padding-top:calc(52px + env(safe-area-inset-top, 0)) !important; }
}
@media (max-width: 480px){
  .uni-chrome{ gap:8px; }
  .uni-chrome .lobrary{ font-size:12.5px; }
  .uni-chrome .sep{ display:none; }
}
/* disable hover effects on touch devices (no hover state) */
@media (hover: none){
  .uni-chrome .you-pill:hover{ transform:none; box-shadow:none; }
  .uni-chrome a:hover, .uni-chrome .nav-item:hover, .uni-chrome .lobrary:hover{ color:rgba(243,234,212,0.62); }
  .uni-chrome .you-pill::after{ display:none; }  /* no hover tooltip on touch */
}
/* OTP tray */
.uni-otp-tray{
  position:fixed; top:54px; right:20px; z-index:9998;
  width:320px; padding:18px 20px;
  background:rgba(20,18,14,0.96);
  -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);
  border:1px solid rgba(193,154,62,0.32); border-radius:8px;
  box-shadow:0 12px 32px -8px rgba(0,0,0,0.6);
  display:none;
}
.uni-otp-tray.open{ display:block; animation:uni-otp-in .3s cubic-bezier(.2,.7,.25,1); }
@keyframes uni-otp-in { from{opacity:0;transform:translateY(-8px);} to{opacity:1;transform:translateY(0);} }
.uni-otp-tray .otp-close{ position:absolute; top:8px; right:10px; background:none; border:none; color:rgba(243,234,212,0.55); font-size:16px; cursor:pointer; line-height:1; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; }
.uni-otp-tray .otp-close:hover{ background:rgba(243,234,212,0.10); color:var(--uc-ink); }
.uni-otp-tray .otp-cap{ font-family:'Newsreader',serif; font-style:italic; font-size:13.5px; color:rgba(243,234,212,0.78); margin:0 0 12px; line-height:1.5; }
.uni-otp-tray .otp-cap em{ color:var(--uc-ochre); font-style:italic; }
.uni-otp-tray .otp-input{ width:100%; padding:10px 14px; background:rgba(243,234,212,0.05); border:1px solid rgba(243,234,212,0.18); border-radius:5px; color:var(--uc-ink); font-family:'Newsreader',serif; font-style:italic; font-size:14px; outline:none; margin-bottom:10px; box-sizing:border-box; }
.uni-otp-tray .otp-input::placeholder{ color:rgba(243,234,212,0.30); }
.uni-otp-tray .otp-input:focus{ border-color:var(--uc-ochre); box-shadow:0 0 0 2px rgba(193,154,62,0.18); }
.uni-otp-tray .otp-input.code{ font-family:'Geist Mono',monospace; font-style:normal; letter-spacing:0.4em; text-align:center; font-size:16px; }
.uni-otp-tray .otp-submit{ width:100%; padding:10px 16px; background:var(--uc-ochre); color:#1f1d18; border:none; border-radius:99px; font-family:'Geist Mono',monospace; font-weight:700; font-size:9.5px; letter-spacing:0.22em; text-transform:uppercase; cursor:pointer; }
.uni-otp-tray .otp-submit:hover{ background:var(--uc-ochre-bright); }
.uni-otp-tray .otp-submit:disabled{ opacity:0.5; cursor:wait; }
/* ── 2026-06-11 · Auth v2 P0 · Google-first tray ── */
.uni-otp-tray .otp-google{ width:100%; padding:10px 16px; background:var(--uc-ink); color:#1f1d18; border:none; border-radius:99px; font-family:'Geist Mono',monospace; font-weight:700; font-size:9.5px; letter-spacing:0.22em; text-transform:uppercase; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:9px; }
.uni-otp-tray .otp-google:hover{ background:#fff; }
.uni-otp-tray .otp-google:disabled{ opacity:0.5; cursor:wait; }
.uni-otp-tray .otp-google svg{ flex:0 0 auto; }
.uni-otp-tray .otp-alt{ display:block; margin:10px auto 0; background:none; border:none; cursor:pointer; font-family:'Newsreader',serif; font-style:italic; font-size:12.5px; color:rgba(243,234,212,0.55); text-decoration:underline dotted; text-underline-offset:3px; }
.uni-otp-tray .otp-alt:hover{ color:var(--uc-ochre); }
#uniOtpEmailFlow{ margin-top:14px; padding-top:12px; border-top:1px solid rgba(243,234,212,0.12); }
/* ── 2026-06-11 · you-pill menu (Your space / Account / Sign out) ── */
.uni-chrome .you-menu{ position:absolute; top:calc(100% + 8px); right:0; background:#16140f; border:1px solid rgba(243,234,212,.16); border-radius:12px; padding:6px; min-width:176px; box-shadow:0 14px 40px rgba(0,0,0,.5); opacity:0; transform:translateY(-4px); pointer-events:none; transition:opacity .16s ease, transform .16s ease; z-index:1001; }
.uni-chrome .you-menu.open{ opacity:1; transform:none; pointer-events:auto; }
.uni-chrome .you-menu a, .uni-chrome .you-menu button{ display:flex; width:100%; align-items:center; gap:9px; padding:9px 12px; background:none; border:none; border-radius:8px; color:rgba(243,234,212,.85); font-family:'Geist Mono','SF Mono',monospace; font-size:9.5px; letter-spacing:.18em; text-transform:uppercase; text-decoration:none; cursor:pointer; text-align:left; box-sizing:border-box; }
.uni-chrome .you-menu a:hover, .uni-chrome .you-menu button:hover{ background:rgba(243,234,212,.07); color:#f3ead4; }
.uni-chrome .you-menu .out{ color:rgba(229,125,101,.85); }
@media (prefers-reduced-motion:reduce){ .uni-chrome .you-menu{ transition:none } }
.uni-chrome .you-pill.menu-on::after, .uni-chrome .you-pill.menu-on::before{ display:none !important; }
.uni-otp-tray .otp-note{ font-family:'Newsreader',serif; font-style:italic; font-size:12.5px; color:rgba(243,234,212,0.42); margin:8px 0 0; }
.uni-otp-tray .otp-err{ font-family:'Newsreader',serif; font-style:italic; font-size:12.5px; color:#e57d65; margin:10px 0 0; }
@media (max-width: 760px){
  .uni-otp-tray{
    top:auto; bottom:0; left:0; right:0;
    width:100%; max-width:100%;
    border-radius:18px 18px 0 0;
    padding:26px 22px calc(32px + env(safe-area-inset-bottom, 0));
    border:1px solid rgba(193,154,62,0.32);
    border-bottom:none;
    box-shadow:0 -12px 32px -8px rgba(0,0,0,0.6);
  }
  .uni-otp-tray.open{ animation:uni-otp-up .32s cubic-bezier(.2,.7,.25,1); }
  @keyframes uni-otp-up{ from{ transform:translateY(100%); } to{ transform:translateY(0); } }
  .uni-otp-tray .otp-input{ font-size:16px; }  /* prevent iOS zoom */
  .uni-otp-tray .otp-input.code{ font-size:18px; }
  .uni-otp-tray .otp-submit{ padding:13px 16px; min-height:44px; }
  /* drag handle hint */
  .uni-otp-tray::before{
    content:''; position:absolute; top:8px; left:50%;
    transform:translateX(-50%);
    width:36px; height:4px; border-radius:99px;
    background:rgba(243,234,212,0.20);
  }
}
/* ─── MEMBER HOOK: subtle Patron upgrade hint in YOU pill tooltip ─── */
.uni-chrome .you-pill[data-tt-hook]::after{
  content:attr(data-tt) ' · ' attr(data-tt-hook);
}
.uni-chrome .you-pill .hook-flag{
  display:inline-block;
  margin-left:6px;
  font-family:'Cinzel',serif;
  color:var(--uc-gold); opacity:0.62;
  font-size:9px; vertical-align:middle;
  transition:opacity .2s ease;
}
.uni-chrome .you-pill:hover .hook-flag{ opacity:1; }
/* ── 2026-06-10 · identity chip (Sophie-approved mockup) ──
   you-pill shows WHO (planet thumbnail + @handle); rank/day demoted to tooltip.
   No looping animation — transitions only. */
.uni-chrome .you-pill .label.handle{ text-transform:none; letter-spacing:.06em; font-weight:500;
  font-size:11.5px; font-family:'Geist Mono','SF Mono',ui-monospace,monospace; }
.uni-chrome .you-pill.no-body{ box-shadow:0 0 0 1px rgba(193,154,62,.28); }
.uni-chrome .you-pill.has-planet .sigil{ background:transparent; overflow:visible; }
.uni-chrome .you-pill .sigil svg{ transition:transform .28s ease, filter .28s ease; }
.uni-chrome .you-pill:hover .sigil svg{ transform:scale(1.22) rotate(-8deg); filter:drop-shadow(0 0 7px rgba(216,178,94,.85)); }
.uni-chrome .you-pill:active .sigil svg{ transform:scale(.9); transition-duration:.09s; }
@media (prefers-reduced-motion:reduce){
  .uni-chrome .you-pill .sigil svg{ transition:none }
  .uni-chrome .you-pill:hover .sigil svg{ transform:none }
}
/* body padding to make room for fixed chrome */
body.uc-padded{ padding-top:48px !important; }

/* V1 #A2 2026-06-04 PM — Sophie killed the email subscribe stack
   ("we're not doing the email subscribe for now"). Hide the homepage
   block + any other subscribe surfaces until we decide. */
body.uc-padded #subscribe,
body.uc-padded .s-subscribe,
body.uc-padded section.subscribe,
body.uc-padded .subscribe-block,
body.uc-padded .newsletter-block,
body.uc-padded .weekly-brief{ display:none !important; }

/* V1 #112 — when chrome OTP tray is open, hide all secondary SIGN IN CTAs.
   Sophie's bug: one page showed both chrome's OTP tray AND composer veil's
   "SIGN IN TO INSCRIBE" simultaneously = 2 sign-in surfaces, confusing. */
body.uc-otp-open .composer-anon-veil,
body.uc-otp-open .anon-overlay,
body.uc-otp-open .starter-overlay{
  display:none !important;
}

/* ─── V1 #112 — BOOK PICK secondary-bar downgrade ───
   Book Pick pages have their own .marginalia-chrome (cream) which has
   the Cards/Map/Notes tabs (useful) PLUS LOOMUS mascot logo + EN dropdown
   (redundant with our uni-chrome). Hide the redundant parts, downgrade
   the bar to look like a contextual secondary bar (smaller, less ink). */
body.uc-padded .marginalia-chrome{
  padding-top:8px !important; padding-bottom:8px !important;
  background:rgba(243,234,212,0.96) !important;
  border-bottom:1px solid rgba(122,102,72,0.14) !important;
  box-shadow:none !important;
}
body.uc-padded .marginalia-chrome .top-brand-marginalia,
body.uc-padded .marginalia-chrome .top-brand-marginalia + .top-brand-sep,
body.uc-padded .marginalia-chrome > .logo,
body.uc-padded .marginalia-chrome .top-lang-btn{
  display:none !important;
}
body.uc-padded .marginalia-chrome .top-brand-text{
  font-size:11px; letter-spacing:0.22em; opacity:0.55;
}
body.uc-padded .marginalia-chrome .top-piece{
  font-size:18px;
}

/* ─── V1.3 nav unification · 2026-06-09 · Sophie + Claude ─────────────
   Lock per-book cream bar to: book title (left) + CARDS·MAP·NOTES (right).
   Spec: _playbook/PRIVATE/principles/nav-unification-proposal-2026-06-09.html
   Axiom: dark bar carries the site, cream bar carries the book.

   This is CSS-only — it does NOT touch per-page HTML. All 60+ book
   pages share the same .marginalia-chrome markup, so one CSS edit
   here re-skins every book on the site.
   ──────────────────────────────────────────────────────────────────── */

/* 1. Hide DUPLICATES already covered by the dark global bar. */
body.uc-padded .marginalia-chrome .top-brand-link,
body.uc-padded .marginalia-chrome .top-loomus-logo,
body.uc-padded .marginalia-chrome .top-brand-sep,
body.uc-padded .marginalia-chrome .top-library,
body.uc-padded .marginalia-chrome .top-account,
body.uc-padded .marginalia-chrome .top-account-menu,
body.uc-padded .marginalia-chrome .top-signin,
body.uc-padded .marginalia-chrome .top-signin-panel,
body.uc-padded .marginalia-chrome .top-save,
body.uc-padded .marginalia-chrome [class*="you-pill"],
body.uc-padded .marginalia-chrome [class*="tier-pill"],
body.uc-padded .marginalia-chrome [class*="streak-chip"]{
  display:none !important;
}

/* 2. Push the three tabs to the right · kills the right-side void. */
body.uc-padded .marginalia-chrome .top-doors{
  margin-left:auto !important;
  gap:0 !important;
  background:transparent !important;
  border:none !important;
  padding:0 !important;
  box-shadow:none !important;
}

/* 3. Editorial tab style · italic Fraunces + ochre underline (no pill). */
body.uc-padded .marginalia-chrome .door{
  font-family:'Fraunces',serif !important;
  font-style:italic !important;
  font-weight:400 !important;
  font-size:17px !important;
  color:rgba(31,29,24,0.42) !important;
  background:transparent !important;
  border:none !important;
  padding:8px 18px 10px !important;
  text-transform:none !important;
  letter-spacing:0 !important;
  position:relative !important;
  box-shadow:none !important;
  transition:color 180ms ease;
  display:inline-flex;align-items:baseline;gap:6px;
}
body.uc-padded .marginalia-chrome .door:hover{ color:#1f1d18 !important; }
body.uc-padded .marginalia-chrome .door-dot{ display:none !important; }
/* 2026-06-10 · duplicate SIGN IN: the book bar has its own signin pill
   (#btn-book-signin, un-hidden by page JS when anon). With the uni-chrome
   present, the uni SIGN IN is the only auth entry — suppress the page one. */
body.uc-padded .book-signin,
body.uc-padded #btn-book-signin{ display:none !important; }

/* 4. Active = first .door (button — the "you are here") + .is-active fallback. */
body.uc-padded .marginalia-chrome .door.is-active,
body.uc-padded .marginalia-chrome button.door,
body.uc-padded .marginalia-chrome .door[aria-current="page"]{
  color:#1f1d18 !important;
}
body.uc-padded .marginalia-chrome .door.is-active::after,
body.uc-padded .marginalia-chrome button.door::after,
body.uc-padded .marginalia-chrome .door[aria-current="page"]::after{
  content:"";position:absolute;
  left:18px;right:18px;bottom:2px;
  height:1.5px;background:#c19a3e;
  border-radius:1px;
}

/* 5. Title row · larger italic, breathing room, no fight with the dark bar above. */
body.uc-padded .marginalia-chrome .top-piece{
  font-family:'Fraunces',serif !important;
  font-style:italic !important;
  font-weight:400 !important;
  font-size:22px !important;
  color:#1f1d18 !important;
  letter-spacing:-0.012em !important;
  line-height:1.15;
  padding-left:0 !important;
  margin-left:0 !important;
  border-left:none !important;
  flex:0 1 auto;
}
body.uc-padded .marginalia-chrome .top-piece em{
  color:#7e2a1a !important;
  font-style:italic !important;
  font-weight:500 !important;
}

/* 6. Bar container · flex-row, baseline-aligned, balanced left↔right. */
body.uc-padded .marginalia-chrome .top{
  display:flex !important;
  align-items:baseline !important;
  gap:18px !important;
  padding:10px 22px !important;
}

/* 7. Mobile · ≤640px stack title above tabs (still no void on either side). */
@media (max-width:640px){
  body.uc-padded .marginalia-chrome .top{
    flex-direction:column;align-items:flex-start !important;gap:6px !important;
    padding:10px 14px !important;
  }
  body.uc-padded .marginalia-chrome .top-doors{ margin-left:0 !important; }
  body.uc-padded .marginalia-chrome .top-piece{ font-size:19px !important; }
  body.uc-padded .marginalia-chrome .door{ font-size:15px !important; padding:6px 12px 8px !important; }
}
/* ─── end v1.3 nav unification ──────────────────────────────────────── */
`;

  /* ─── HTML ─── */
  const CHROME_HTML = `
<header class="uni-chrome is-anon" id="uniChrome" role="navigation" aria-label="LOOMUS navigation">
  <a class="lm-logo" href="https://loomus.ai" aria-label="LOOMUS home"><img src="https://loomus.ai/loomus-logo-light.png" alt="LOOMUS"></a>
  <span class="sep"></span>
  <a class="lobrary" href="https://loomus.ai/library" aria-label="LO-brary"><span class="lib-icon"><svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true"><path d="M2.5 3.5 H7 C7.55 3.5 8 3.95 8 4.5 V12.5 C8 11.95 7.55 11.5 7 11.5 H2.5 Z" stroke="currentColor" stroke-width="1.05" fill="currentColor" fill-opacity="0.10"/><path d="M13.5 3.5 H9 C8.45 3.5 8 3.95 8 4.5 V12.5 C8 11.95 8.45 11.5 9 11.5 H13.5 Z" stroke="currentColor" stroke-width="1.05" fill="currentColor" fill-opacity="0.10"/><path d="M8 4.5 V12.5" stroke="currentColor" stroke-width="1.05"/></svg></span>LO-<span class="under">brary</span></a>
  <a class="nav-item" id="uniNavDistill" href="https://distill.loomus.ai" aria-label="Distill">
    <span class="ni-icon flask"><svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <!-- Erlenmeyer triangle: neck (narrow vertical) then sharp flare to wide base -->
      <path class="glass-edge" d="M 6 1.8 L 6 6 L 1.8 15.6 Q 1.2 17 2.8 17 L 15.2 17 Q 16.8 17 16.2 15.6 L 12 6 L 12 1.8"/>
      <!-- cork / cap stroke on top of neck -->
      <line class="cork" x1="5.3" y1="1.8" x2="12.7" y2="1.8" stroke-linecap="round"/>
      <!-- glass inner highlight (left edge shine) -->
      <path class="shine" d="M 6.8 6.5 L 4.8 13"/>
      <!-- liquid fills bottom triangle -->
      <path class="liquid" d="M 3.4 11.2 L 14.6 11.2 L 16.0 15.4 Q 16.5 17 15.0 17 L 3.0 17 Q 1.5 17 2.0 15.4 Z"/>
      <!-- meniscus (slosh wave on top of liquid) -->
      <path class="meniscus" d="M 3.4 11.2 Q 6.5 10.6 9 11.2 Q 11.5 11.8 14.6 11.2"/>
      <!-- 5 bubbles, varied positions + sizes + timings -->
      <circle class="bub bub-1" cx="6" cy="15.2" r="0.7"/>
      <circle class="bub bub-2" cx="10" cy="15.5" r="0.55"/>
      <circle class="bub bub-3" cx="8" cy="14.7" r="0.6"/>
      <circle class="bub bub-4" cx="12.5" cy="15.0" r="0.5"/>
      <circle class="bub bub-5" cx="4.6" cy="14.4" r="0.45"/>
    </svg></span>
    Distill
    <span class="ni-badge">NEW</span>
  </a>
  <a class="nav-item" id="uniNavEvents" href="https://loomus.ai/events">Events</a>
  <div class="right">
    <a class="ret-chip" href="https://loomus.ai/you"><span>Day <strong id="uniDays">0</strong></span><span style="opacity:.45">·</span><span><strong id="uniBooks">0</strong> books</span></a>
    <a class="you-pill t-reader" id="uniYouPill" href="https://loomus.ai/you" data-tt="">
      <span class="sigil" id="uniSigil"></span>
      <span class="label" id="uniTier">Reader</span>
    </a>
    <button class="lang" id="uniLang" type="button">EN ▾</button>
    <button class="signin" id="uniSignin" type="button" data-action="open-otp">Sign in</button>
  </div>
</header>
<div class="uni-otp-tray" id="uniOtpTray" role="dialog" aria-label="Sign in">
  <button class="otp-close" id="uniOtpClose" type="button" aria-label="Close">✕</button>
  <p class="otp-cap" data-step="google">Sign in once — <em>your margin follows you</em> everywhere.</p>
  <button type="button" class="otp-google" id="uniGoogleBtn">
    <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
    <span>Continue with Google</span>
  </button>
  <button type="button" class="otp-alt" id="uniOtpAlt">use email code instead</button>
  <div id="uniOtpEmailFlow" hidden>
    <p class="otp-cap" data-step="email">Marginalia will send you <em>a six-digit code</em>. After, you'll get <em>the weekly letter</em> too.</p>
    <p class="otp-cap" data-step="code" hidden>Check your email. <em>Paste the six digits.</em></p>
    <form class="uni-otp-form" data-step="email" novalidate>
      <input type="email" name="email" class="otp-input" placeholder="your email" required autocomplete="email">
      <button type="submit" class="otp-submit">Send the code →</button>
    </form>
    <form class="uni-otp-form" data-step="code" hidden novalidate>
      <input type="text" name="code" class="otp-input code" placeholder="× × × × × ×" maxlength="6" inputmode="numeric" autocomplete="one-time-code">
      <p class="otp-note">No need to press anything — the code auto-verifies.</p>
    </form>
  </div>
  <p class="otp-err" id="uniOtpErr" hidden></p>
</div>
`;

  /* ─── Tier ladder ─── */
  function computeTier(days){
    if (days >= 365) return { key:'benefactor', name:'Benefactor', threshold:365, next:null };
    if (days >= 100) return { key:'patron', name:'Patron', threshold:100, next:{name:'Benefactor', at:365} };
    if (days >= 50)  return { key:'scholar', name:'Scholar', threshold:50, next:{name:'Patron', at:100} };
    if (days >= 20)  return { key:'student', name:'Student', threshold:20, next:{name:'Scholar', at:50} };
    return { key:'reader', name:'Reader', threshold:0, next:{name:'Student', at:20} };
  }


  /* ─── 2026-06-10 · frozen miniatures of the REAL Choosing planet art ───
     Same palette/geometry recipe as you/choosing.html planetSVG (L/M/D
     gradient sphere + atm ring split behind/front + rim shade; star
     cluster for Pleiades) minus the animated turbulence/spin layers. */
  var MINI_BODIES = {
    'polaris'      : {c:['#cdd8ff','#4a5aa6','#1c2150'], atm:'#6f86e0'},
    'mars'         : {c:['#f0b083','#b4452c','#561d12'], atm:'#c8552f'},
    'saturn'       : {c:['#f6dca6','#c79a44','#6e4f17'], atm:'#d8b25e', ring:true},
    'venus'        : {c:['#ffe9d6','#d99a86','#8a4f56'], atm:'#e0a18c'},
    'mercury'      : {c:['#cfeeea','#2f8a86','#123d3b'], atm:'#3fb0aa'},
    'jupiter'      : {c:['#efce9a','#c2843f','#7a4a22'], atm:'#d9a45a'},
    'neptune'      : {c:['#a7d6ff','#2f5fb0','#142a52'], atm:'#3f7ad0'},
    'the pleiades' : {c:['#e7e0ff','#8f7ad6','#3a3160'], atm:'#9e8cff', cluster:true}
  };
  function renderMiniPlanet(name){
    var b = MINI_BODIES[String(name||'').toLowerCase()];
    if (!b) return null;
    var L=b.c[0], M=b.c[1], D=b.c[2], A=b.atm, uid='ucp'+Math.abs(name.length*7+name.charCodeAt(0));
    if (b.cluster){
      var pts=[[75,38,9],[50,60,7],[100,58,8],[62,92,7],[104,94,6],[42,98,5]];
      var s='';
      for (var i=0;i<pts.length;i++){ s+='<circle cx="'+pts[i][0]+'" cy="'+pts[i][1]+'" r="'+(pts[i][2]*1.9)+'" fill="'+A+'" opacity=".35"/><circle cx="'+pts[i][0]+'" cy="'+pts[i][1]+'" r="'+pts[i][2]+'" fill="#fff" opacity=".9"/>'; }
      return '<svg viewBox="0 0 150 150" width="22" height="22" style="overflow:visible">'+s+'</svg>';
    }
    var ringBack = b.ring ? '<g transform="rotate(-20 75 75)" clip-path="url(#'+uid+'up)"><ellipse cx="75" cy="75" rx="92" ry="24" fill="none" stroke="'+A+'" stroke-width="13" stroke-opacity=".45"/></g>' : '';
    var ringFront= b.ring ? '<g transform="rotate(-20 75 75)" clip-path="url(#'+uid+'dn)"><ellipse cx="75" cy="75" rx="92" ry="24" fill="none" stroke="'+A+'" stroke-width="13" stroke-opacity=".8"/><ellipse cx="75" cy="75" rx="92" ry="24" fill="none" stroke="rgba(20,14,4,.55)" stroke-width="3.5"/></g>' : '';
    var vb = b.ring ? '-22 5 194 140' : '0 0 150 150';
    var w  = b.ring ? 30 : 22;
    return '<svg viewBox="'+vb+'" width="'+w+'" height="22" style="overflow:visible"><defs>'
      + '<radialGradient id="'+uid+'b" cx="36%" cy="30%" r="78%"><stop offset="0%" stop-color="'+L+'"/><stop offset="50%" stop-color="'+M+'"/><stop offset="100%" stop-color="'+D+'"/></radialGradient>'
      + '<radialGradient id="'+uid+'s" cx="34%" cy="28%" r="86%"><stop offset="48%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,0.6)"/></radialGradient>'
      + '<clipPath id="'+uid+'up"><rect x="-50" y="0" width="260" height="75"/></clipPath>'
      + '<clipPath id="'+uid+'dn"><rect x="-50" y="75" width="260" height="120"/></clipPath>'
      + '</defs>'
      + ringBack
      + '<circle cx="75" cy="75" r="62" fill="url(#'+uid+'b)"/>'
      + '<circle cx="75" cy="75" r="62" fill="url(#'+uid+'s)"/>'
      + ringFront + '</svg>';
  }

  /* ─── Body sigil renderer ─── */
  function renderSigil(body, size){
    size = size || 22;
    const cx = size/2, cy = size/2, r = size/2 - 1.5;
    if (!body){
      /* vacant seat — dashed ring + ember dot, static (identity chip 2026-06-10) */
      return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'
        + '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r-1)+'" fill="none" stroke="rgba(243,234,212,0.45)" stroke-width="1" stroke-dasharray="2.5 3.2"/>'
        + '<circle cx="'+cx+'" cy="'+cy+'" r="2.2" fill="rgba(243,234,212,0.55)"/></svg>';
    }
    const a = body.archetype || 'plain';
    const c = body.color || '#c8a766';
    let inner = '';
    if (a === 'plain' || a === 'cratered' || a === 'icy'){
      inner = '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+c+'"/>';
      if (a === 'cratered'){
        inner += '<circle cx="'+(cx-3.5)+'" cy="'+(cy-2)+'" r="1.6" fill="rgba(0,0,0,0.30)"/>';
        inner += '<circle cx="'+(cx+4)+'" cy="'+(cy+3)+'" r="1.2" fill="rgba(0,0,0,0.25)"/>';
      }
      if (a === 'icy'){
        inner += '<path d="M '+(cx-4)+' '+(cy-3)+' L '+(cx+4)+' '+(cy+2)+'" stroke="rgba(255,255,255,0.45)" stroke-width="0.7"/>';
      }
    } else if (a === 'spotted'){
      inner = '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+c+'"/><ellipse cx="'+(cx-2)+'" cy="'+(cy+2)+'" rx="3.5" ry="2.4" fill="rgba(0,0,0,0.35)"/>';
    } else if (a === 'swirled'){
      inner = '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+c+'"/><path d="M 2 '+(cy-4)+' Q '+cx+' '+(cy-6)+', '+(size-2)+' '+(cy-4)+'" stroke="rgba(0,0,0,0.32)" stroke-width="1.1" fill="none"/><path d="M 3 '+cy+' Q '+cx+' '+(cy-2)+', '+(size-3)+' '+cy+'" stroke="rgba(0,0,0,0.26)" stroke-width="0.9" fill="none"/>';
    } else if (a === 'ringed'){
      inner = '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+(r+2.5)+'" ry="2.5" fill="none" stroke="'+c+'" stroke-width="1.2" opacity="0.78"/><circle cx="'+cx+'" cy="'+cy+'" r="'+(r-2)+'" fill="'+c+'"/>';
    } else if (a === 'glowing-star'){
      inner = '<g><circle cx="'+cx+'" cy="'+cy+'" r="3.6" fill="'+c+'"/><path d="M '+cx+' 1 L '+cx+' '+(size-1)+' M 1 '+cy+' L '+(size-1)+' '+cy+'" stroke="'+c+'" stroke-width="1" opacity="0.55"/><path d="M 4 4 L '+(size-4)+' '+(size-4)+' M '+(size-4)+' 4 L 4 '+(size-4)+'" stroke="'+c+'" stroke-width="0.6" opacity="0.35"/></g>';
    } else if (a === 'clustered'){
      inner = '<g fill="'+c+'"><circle cx="'+(cx-5)+'" cy="'+(cy-4)+'" r="1.6"/><circle cx="'+(cx+3)+'" cy="'+(cy-5)+'" r="1.3"/><circle cx="'+(cx-2)+'" cy="'+cy+'" r="1.8"/><circle cx="'+(cx+5)+'" cy="'+(cy+1)+'" r="1.4"/><circle cx="'+(cx-4)+'" cy="'+(cy+4)+'" r="1.5"/><circle cx="'+(cx+1)+'" cy="'+(cy+5)+'" r="1.3"/></g>';
    } else if (a === 'spiral'){
      inner = '<g fill="'+c+'"><circle cx="'+cx+'" cy="'+cy+'" r="2" opacity="0.95"/><path d="M '+(cx-1)+' '+(cy-2)+' Q '+(cx-6)+' '+(cy-4)+', '+(cx-8)+' '+(cy+2)+'" stroke="'+c+'" stroke-width="1.4" fill="none" opacity="0.65"/><path d="M '+(cx+1)+' '+(cy+2)+' Q '+(cx+6)+' '+(cy+4)+', '+(cx+8)+' '+(cy-2)+'" stroke="'+c+'" stroke-width="1.4" fill="none" opacity="0.65"/></g>';
    } else if (a === 'constellation-glyph'){
      inner = '<g fill="'+c+'" opacity="0.92"><line x1="6" y1="'+(cy-5)+'" x2="'+cx+'" y2="'+(cy-2)+'" stroke="'+c+'" stroke-width="0.5" opacity="0.55"/><line x1="'+cx+'" y1="'+(cy-2)+'" x2="'+(size-6)+'" y2="'+(cy-3)+'" stroke="'+c+'" stroke-width="0.5" opacity="0.55"/><line x1="'+cx+'" y1="'+(cy-2)+'" x2="'+(cx-3)+'" y2="'+(cy+5)+'" stroke="'+c+'" stroke-width="0.5" opacity="0.55"/><circle cx="6" cy="'+(cy-5)+'" r="1.6"/><circle cx="'+cx+'" cy="'+(cy-2)+'" r="1.8"/><circle cx="'+(size-6)+'" cy="'+(cy-3)+'" r="1.6"/><circle cx="'+(cx-3)+'" cy="'+(cy+5)+'" r="1.6"/></g>';
    } else {
      inner = '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+c+'"/>';
    }
    return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'" xmlns="http://www.w3.org/2000/svg">'+inner+'</svg>';
  }

  /* ─── Roman numerals ─── */
  function toRoman(n){
    if (!n || n < 1) return '';
    const map = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
    let r = '', x = n;
    for (let i=0;i<map.length;i++){ while (x >= map[i][1]){ r += map[i][0]; x -= map[i][1]; } }
    return r;
  }

  /* ─── Auth ─── */
  function getSbKey(){
    try {
      for (let i=0; i<localStorage.length; i++){
        const k = localStorage.key(i);
        if (k && /^sb-.*-auth-token$/.test(k)) return k;
      }
    } catch(_) {}
    return null;
  }
  async function refreshSession(){
    try {
      const k = getSbKey();
      if (!k) return null;
      const j = JSON.parse(localStorage.getItem(k) || 'null');
      if (!j || !j.refresh_token) return null;
      const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method:'POST',
        headers:{ 'apikey':SUPABASE_KEY, 'Content-Type':'application/json' },
        body: JSON.stringify({ refresh_token: j.refresh_token }),
      });
      if (!res.ok) return null;
      const fresh = await res.json();
      if (!fresh || !fresh.access_token) return null;
      const merged = Object.assign({}, j, fresh);
      if (fresh.expires_at) merged.expires_at = fresh.expires_at;
      else if (fresh.expires_in) merged.expires_at = Math.floor(Date.now()/1000) + Number(fresh.expires_in);
      localStorage.setItem(k, JSON.stringify(merged));
      return fresh.access_token;
    } catch(_) { return null; }
  }
  async function getBearer(){
    try {
      const k = getSbKey();
      if (!k) return null;
      const j = JSON.parse(localStorage.getItem(k) || 'null');
      if (j && j.access_token && j.expires_at && j.expires_at * 1000 > Date.now() + 60000){
        return j.access_token;
      }
      return await refreshSession();
    } catch(_) { return null; }
  }
  function getUserEmail(){
    try {
      const k = getSbKey();
      if (!k) return null;
      const j = JSON.parse(localStorage.getItem(k) || 'null');
      return (j && j.user && j.user.email) || null;
    } catch(_) { return null; }
  }

  /* ─── Hydrate state ─── */
  async function hydrate(){
    const chrome = document.getElementById('uniChrome');
    if (!chrome) return;
    const token = await getBearer();
    const email = token ? getUserEmail() : null;
    if (token){
      chrome.classList.remove('is-anon');
      hideOldOverlays();
      // Day count
      try {
        const today = new Date().toISOString().slice(0,10);
        const days = new Set(JSON.parse(localStorage.getItem('loomus_days_set') || '[]'));
        days.add(today);
        localStorage.setItem('loomus_days_set', JSON.stringify([...days]));
        const dayCount = days.size;
        document.getElementById('uniDays').textContent = toRoman(dayCount);
        // Tier (rank) — demoted to tooltip; the pill now answers WHO, not what rank.
        const tier = computeTier(dayCount);
        const youPill = document.getElementById('uniYouPill');
        youPill.className = 'you-pill t-' + tier.key;
        // Active "you-here" if on /you/*
        if (/\/you(\/|$)/.test(location.pathname)) youPill.classList.add('you-here');
        // Body sigil from localStorage
        let bodyData = null;
        try { bodyData = JSON.parse(localStorage.getItem('loomus_body_data') || 'null'); } catch(_){}
        // V1 #112 S8 — handle fallback sanitized: only alpha letter-run, cap 6
        const handle = localStorage.getItem('loomus_handle') || (email ? ((email.split('@')[0]||'').toLowerCase().match(/^[a-z]+/)||[''])[0].slice(0,6) || 'you' : 'you');
        // ── identity chip (2026-06-10) · label = @handle ──
        const labelEl = document.getElementById('uniTier');
        labelEl.classList.add('handle');
        labelEl.textContent = '@' + handle;
        // 2026-06-10 fix · cross-device: localStorage is per-browser, so a user who
        // chose on another device saw a vacant seat (P0-2 family). Render from cache
        // first; the server backfill below pulls planet+handle from profiles once.
        // priority 2026-06-11: The Choosing star (server-canonical cache) wins
        // over the pompeii body claim — the chip answers "who do you sail under".
        const planetName = localStorage.getItem('loomus_planet_name') || (bodyData && bodyData.name) || null;
        const miniHtml = planetName ? renderMiniPlanet(planetName) : null;
        const sigilHtml = miniHtml || renderSigil(bodyData, 22);
        document.getElementById('uniSigil').innerHTML = sigilHtml;
        (async () => {
          try {
            // Always runs: identity backfill is cache-guarded below, but the
            // day streak is server-canonical (P0-2) and reconciles every load.
            let uid = null;
            try { uid = JSON.parse(atob(token.split('.')[1])).sub; } catch(_){}
            if (!uid) return;
            const pr = await fetch(SUPABASE_URL + '/rest/v1/profiles?select=planet,handle,day_count,last_day&id=eq.' + uid, {
              headers:{ 'apikey':SUPABASE_KEY, 'Authorization':'Bearer ' + token, 'Accept':'application/json' }
            });
            if (!pr.ok) return;
            const rows = await pr.json();
            const me = rows && rows[0];
            if (!me) return;
            // ── P0-2 · day streak server-side ──
            // merge legacy localStorage history once (max), +1 on a new day, PATCH back.
            try {
              const srv = me.day_count || 0;
              let finalDays = Math.max(srv, dayCount);
              if ((me.last_day || '') !== today) finalDays = Math.max(srv + 1, dayCount);
              if (finalDays !== srv || (me.last_day || '') !== today){
                fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + uid, { method:'PATCH',
                  headers:{ 'apikey':SUPABASE_KEY, 'Authorization':'Bearer ' + token, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
                  body: JSON.stringify({ day_count: finalDays, last_day: today }) });
              }
              if (finalDays !== dayCount){
                document.getElementById('uniDays').textContent = toRoman(finalDays);
                const t2 = computeTier(finalDays);
                youPill.classList.remove('t-' + tier.key); youPill.classList.add('t-' + t2.key);
                const tt = youPill.getAttribute('data-tt') || '';
                youPill.setAttribute('data-tt', tt.replace(/Day [IVXLCDM]+/, 'Day ' + toRoman(finalDays)).replace(tier.name, t2.name));
              }
            } catch(_){}
            if (me.handle && !localStorage.getItem('loomus_handle')){
              try { localStorage.setItem('loomus_handle', me.handle); } catch(_){}
              labelEl.textContent = '@' + me.handle;
            }
            // NOTE: profiles.planet is The Choosing star — cached under its own key;
            // loomus_body_data stays pompeii-claim-owned (never written here).
            // 2026-06-11 fix: server is CANONICAL — reconcile the cache every
            // load (changing your star used to leave a stale chip forever).
            if (me.planet){
              const cachedPlanet = localStorage.getItem('loomus_planet_name');
              if (me.planet !== cachedPlanet){
                try { localStorage.setItem('loomus_planet_name', me.planet); } catch(_){}
                const mini2 = renderMiniPlanet(me.planet);
                if (mini2){
                  document.getElementById('uniSigil').innerHTML = mini2;
                  youPill.classList.add('has-planet'); youPill.classList.remove('no-body');
                  youPill.setAttribute('data-tt', me.planet + ' · Day ' + toRoman(dayCount) + ' · ' + tier.name);
                  youPill.href = 'https://loomus.ai/you';
                }
              }
            } else if (localStorage.getItem('loomus_planet_name')){
              // star released server-side (24h regret) → drop stale cache
              try { localStorage.removeItem('loomus_planet_name'); } catch(_){}
            }
          } catch(_){}
        })();
        if (bodyData || miniHtml){
          youPill.classList.add('has-planet'); youPill.classList.remove('no-body');
          youPill.setAttribute('data-tt', planetName + ' · Day ' + toRoman(dayCount) + ' · ' + tier.name);
          youPill.href = 'https://loomus.ai/you';
        } else {
          youPill.classList.add('no-body'); youPill.classList.remove('has-planet');
          youPill.setAttribute('data-tt', 'pick a body \u2192 \u00b7 Day ' + toRoman(dayCount) + ' \u00b7 ' + tier.name);
          youPill.href = 'https://loomus.ai/you/choosing';   // vacant seat → straight to The Choosing
        }
      } catch(_) {}
      // Books count
      try {
        const r = await fetch(SUPABASE_URL + '/rest/v1/library_items?select=kind&kind=eq.reading&limit=200', {
          headers: { 'Authorization':'Bearer '+token, 'apikey':SUPABASE_KEY, 'Accept':'application/json' }
        });
        if (r.ok){
          const rows = await r.json();
          const n = Array.isArray(rows) ? rows.length : 0;
          const booksEl = document.getElementById('uniBooks');
          booksEl.textContent = toRoman(n) || '0';
          // cold-start kindness: no "· 0 books" before the first book
          const span = booksEl.parentElement, dot = span && span.previousElementSibling;
          if (span){ span.style.display = n ? '' : 'none'; }
          if (dot){ dot.style.display = n ? '' : 'none'; }
        }
      } catch(_) {}
    } else {
      chrome.classList.add('is-anon');
    }
    // Active nav item
    const path = location.pathname;
    if (location.hostname === 'distill.loomus.ai' || path.startsWith('/distill')) document.getElementById('uniNavDistill').classList.add('active');
    if (path.startsWith('/events')) document.getElementById('uniNavEvents').classList.add('active');
  }

  function hideOldOverlays(){
    ['anon-overlay','starter-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });
  }

  /* ─── OTP tray flow ─── */
  let pendingEmail = null;
  function openTray(){
    const tray = document.getElementById('uniOtpTray');
    if (tray) tray.classList.add('open');
    document.body.classList.add('uc-otp-open');  // hides secondary SIGN IN CTAs
    setTimeout(() => {
      const inp = tray && tray.querySelector('input[name="email"]');
      if (inp && !inp.disabled) inp.focus();
    }, 200);
  }
  function closeTray(){
    const t = document.getElementById('uniOtpTray');
    if (t) t.classList.remove('open');
    document.body.classList.remove('uc-otp-open');
  }
  function showErr(msg){ const e = document.getElementById('uniOtpErr'); if (e){ e.textContent = msg; e.hidden = false; } }
  function hideErr(){ const e = document.getElementById('uniOtpErr'); if (e) e.hidden = true; }
  async function stepEmail(form){
    hideErr();
    const inp = form.querySelector('input[name="email"]');
    const btn = form.querySelector('button[type="submit"]');
    const email = (inp.value || '').trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)){ showErr('That email looks incomplete. Try again.'); return; }
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Sending…';
    try {
      if (!window.LoomusAuth || typeof window.LoomusAuth.signIn !== 'function') throw new Error('auth-not-loaded');
      const res = await window.LoomusAuth.signIn(email);
      if (!res || !res.ok){ showErr(res && res.error ? String(res.error) : 'Something didn’t take. Try again.'); btn.disabled = false; btn.textContent = orig; return; }
      pendingEmail = email;
      try { sessionStorage.setItem('loomus_otp_pending_email', email); } catch(_){}
      form.hidden = true;
      document.querySelector('.uni-otp-tray .otp-cap[data-step="email"]').hidden = true;
      document.querySelector('.uni-otp-tray .otp-cap[data-step="code"]').hidden = false;
      const codeForm = document.querySelector('.uni-otp-form[data-step="code"]'); codeForm.hidden = false;
      setTimeout(() => codeForm.querySelector('input[name="code"]').focus(), 120);
    } catch(_) { showErr('We couldn’t reach the post office. Try again in a moment.'); btn.disabled = false; btn.textContent = orig; }
  }
  async function stepCode(form){
    hideErr();
    const inp = form.querySelector('input[name="code"]');
    const code = (inp.value || '').replace(/\D/g,'').slice(0,6);
    if (code.length !== 6) return;
    inp.disabled = true;
    try {
      const email = pendingEmail || sessionStorage.getItem('loomus_otp_pending_email');
      if (!email){ showErr('We lost track of your email. Reload and try again.'); inp.disabled = false; return; }
      if (!window.LoomusAuth || typeof window.LoomusAuth.verifyOtp !== 'function') throw new Error('auth-not-loaded');
      const res = await window.LoomusAuth.verifyOtp(email, code);
      if (!res || !res.ok){ showErr(res && res.error ? String(res.error) : 'That code didn’t take. Try again.'); inp.disabled = false; inp.value = ''; inp.focus(); return; }
      try { sessionStorage.removeItem('loomus_otp_pending_email'); } catch(_){}
      window.location.reload();
    } catch(_) { showErr('That code didn’t take. Try again.'); inp.disabled = false; inp.value = ''; inp.focus(); }
  }

  /* ─── Init ─── */
  function loadLoomusAuth(){
    if (window.LoomusAuth || document.querySelector('script[src*="loomus-auth.js"]')) return;
    window.LOOMUS_AUTH_CONFIG = window.LOOMUS_AUTH_CONFIG || { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_KEY };
    const s = document.createElement('script');
    s.src = 'https://loomus.ai/loomus-auth.js';
    s.defer = true;
    document.head.appendChild(s);
  }
  function injectChrome(){
    if (document.getElementById('uniChrome')) return;
    // CSS
    const style = document.createElement('style');
    style.id = 'loomus-chrome-css';
    style.textContent = CSS;
    document.head.appendChild(style);
    // HTML
    const wrap = document.createElement('div');
    wrap.innerHTML = CHROME_HTML;
    while (wrap.firstChild) document.body.insertBefore(wrap.firstChild, document.body.firstChild);
    // body padding
    document.body.classList.add('uc-padded');
    // hide old chromes
    OLD_CHROME_SELECTORS.forEach(sel => {
      try { document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; }); } catch(_) {}
    });
    // hide old chrome wrappers via :has() if supported
    OLD_CHROME_PARENT_HIDE.forEach(sel => {
      try { document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; }); } catch(_) {}
    });
    // Fallback: any <header> at top-of-body that is NOT our uni-chrome
    try {
      const headers = document.querySelectorAll('body > header:not(.uni-chrome):not(#uniChrome)');
      headers.forEach(h => {
        // only hide if it looks like a top-nav (height < 200px + sits at top)
        const r = h.getBoundingClientRect();
        if (r.height < 200 && r.top < 200) h.style.display = 'none';
      });
    } catch(_) {}
    // wire
    wireEvents();
    // Hydrate (retry to wait for LoomusAuth)
    hydrate();
    setTimeout(hydrate, 800);
    setTimeout(hydrate, 2000);
  }
  function wireEvents(){
    document.addEventListener('click', (e) => {
      const trig = e.target && e.target.closest && e.target.closest('[data-action="open-otp"]');
      if (trig){ e.preventDefault(); openTray(); return; }
      if (e.target && e.target.id === 'uniOtpClose'){ closeTray(); return; }
      // ── 2026-06-11 · Auth v2 P0 ──
      const gBtn = e.target && e.target.closest && e.target.closest('#uniGoogleBtn');
      if (gBtn){
        hideErr();
        gBtn.disabled = true;
        const label = gBtn.querySelector('span'); const orig = label ? label.textContent : '';
        if (label) label.textContent = 'Opening Google…';
        const call = (window.LoomusAuth && typeof window.LoomusAuth.signInWithGoogle === 'function')
          ? window.LoomusAuth.signInWithGoogle()
          : Promise.resolve({ ok:false, error:'auth-not-loaded' });
        Promise.resolve(call).then((res) => {
          if (!res || !res.ok){
            showErr('Google didn’t answer just now — the email code below works too.');
            gBtn.disabled = false; if (label) label.textContent = orig;
            const flow = document.getElementById('uniOtpEmailFlow');
            const alt = document.getElementById('uniOtpAlt');
            if (flow) flow.hidden = false; if (alt) alt.hidden = true;
          }
          // on ok: browser is navigating to Google — leave the button as-is
        });
        return;
      }
      if (e.target && e.target.id === 'uniOtpAlt'){
        hideErr();
        const flow = document.getElementById('uniOtpEmailFlow');
        if (flow) flow.hidden = false;
        e.target.hidden = true;
        const inp = document.querySelector('.uni-otp-form[data-step="email"] input[name="email"]');
        if (inp) setTimeout(() => inp.focus(), 120);
        return;
      }
      // ── 2026-06-11 · you-pill menu ──
      // Signed-in pill with a chosen star → small menu instead of direct nav
      // (this is also where "Sign out" finally lives in the chrome).
      // Vacant-seat pill keeps its straight line to The Choosing.
      const pill = e.target && e.target.closest && e.target.closest('#uniYouPill');
      if (pill && pill.classList.contains('has-planet')){
        e.preventDefault();
        let menu = document.getElementById('uniYouMenu');
        if (!menu){
          menu = document.createElement('div');
          menu.id = 'uniYouMenu'; menu.className = 'you-menu';
          menu.innerHTML =
            '<a href="https://loomus.ai/you">✦ Your space</a>' +
            '<a href="https://loomus.ai/you/account">❖ Account</a>' +
            '<button type="button" class="out" id="uniMenuOut">☾ Sign out</button>';
          const host = pill.parentElement || document.body;
          if (host !== document.body) host.style.position = 'relative';
          host.appendChild(menu);
          menu.querySelector('#uniMenuOut').addEventListener('click', async () => {
            try { if (window.LoomusAuth && window.LoomusAuth.signOut) await window.LoomusAuth.signOut(); } catch(_){}
            location.href = 'https://loomus.ai';
          });
        }
        requestAnimationFrame(() => {
          menu.classList.toggle('open');
          // hide the hover tooltip while the menu is up (it overlapped the items)
          pill.classList.toggle('menu-on', menu.classList.contains('open'));
        });
        return;
      }
      const openMenu = document.getElementById('uniYouMenu');
      if (openMenu && openMenu.classList.contains('open') && !(e.target.closest && e.target.closest('#uniYouMenu'))){
        openMenu.classList.remove('open');
        const p2 = document.getElementById('uniYouPill'); if (p2) p2.classList.remove('menu-on');
      }
    });
    document.addEventListener('submit', (e) => {
      const f = e.target;
      if (!f || !f.classList || !f.classList.contains('uni-otp-form')) return;
      e.preventDefault();
      if (f.dataset.step === 'email') stepEmail(f);
      else if (f.dataset.step === 'code') stepCode(f);
    });
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (!t || !t.classList || !t.classList.contains('code')) return;
      const clean = (t.value || '').replace(/\D/g,'').slice(0,6);
      if (clean !== t.value) t.value = clean;
      if (clean.length === 6){ const f = t.closest('form'); if (f) f.dispatchEvent(new Event('submit', { cancelable:true, bubbles:true })); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape'){
        const tr = document.getElementById('uniOtpTray');
        if (tr && tr.classList.contains('open')) closeTray();
      }
    });
  }
  function boot(){
    loadLoomusAuth();
    injectChrome();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

  // Public API for surfaces that need it
  window.LoomusChrome = {
    openSignIn: openTray,
    hydrate,
    renderSigil,
    computeTier,
    toRoman
  };
})();
