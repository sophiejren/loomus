/* ═══════════════════════════════════════════════════════════════════════
 *  loomus-spellbook.js · NOTES v3.4 · 2026-06-04
 *  ──────────────────────────────────────────────────────────────────────
 *  Deploy to:   https://loomus.ai/loomus-spellbook.js
 *  Loaded by:   every graph page that has a [data-loomus-spellbook] slot
 *  Depends on:  loomus-auth.js (for identity + edge fn auth header)
 *
 *  Two new surfaces inside one slot:
 *
 *    ┌─ SPELLBOOK (codex) ─────────────────────────────────────────┐
 *    │  state: ready / cracking / opening / casting / revealed /   │
 *    │         vanishing / clasped                                  │
 *    │  cover  → name a concept + press wax seal                   │
 *    │  open   → Feynman + First Principles spell text revealed    │
 *    │  fade   → ink dissolves, cover shuts, brass clasp engages   │
 *    │  clasped→ countdown to next moon                            │
 *    └──────────────────────────────────────────────────────────────┘
 *    ┌─ YOUR TURN (reflection) ─ visible only when spell on screen ┐
 *    │  prompt → "what's your version?" tagged #yours, saves       │
 *    └──────────────────────────────────────────────────────────────┘
 *
 *  Backend contracts:
 *    POST /functions/v1/spellbook-cast
 *      body:  { term, slug }
 *      ok:    { feynman, fp, next_at, target_ref }
 *      busy:  { error: 'quota_exhausted', next_at, previous_term }
 *
 *    POST /functions/v1/library-save
 *      body:  { kind:'reflection', ref, target_ref:'term:<slug>',
 *               note, visibility, tags }
 *
 *  Visual is ported from mock-notes-plugin-v3-4-SHIP.html. All CSS
 *  inlined (no external stylesheet). Honors prefers-reduced-motion.
 * ═══════════════════════════════════════════════════════════════════════ */

(function (window, document) {
  "use strict";

  const CFG = {
    get supabaseUrl() {
      return (window.LOOMUS_AUTH_CONFIG || {}).supabaseUrl || "";
    },
    get castUrl() {
      const b = this.supabaseUrl.replace(/\/$/, "");
      return b ? `${b}/functions/v1/spellbook-cast` : "";
    },
    get saveUrl() {
      const b = this.supabaseUrl.replace(/\/$/, "");
      return b ? `${b}/functions/v1/library-save` : "";
    },
    REFLECTION_MAX: 280,
    LOCAL_QUOTA_KEY: "loomus.spellbook.last_cast", // {slug, term, next_at}
  };

  // ─── helpers ───────────────────────────────────────────────────────
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();
  const $ = (sel, root = document) => root.querySelector(sel);
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function slugify(s) {
    return String(s || "").toLowerCase()
      .replace(/[‐-―−]/g, "-")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  }
  function haptic(ms = 12) { try { navigator.vibrate?.(ms); } catch {} }
  function reducedMotion() {
    try { return matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch { return false; }
  }
  function fmtNextDate(iso) {
    if (!iso) return "soon";
    const d = new Date(iso);
    if (isNaN(+d)) return "soon";
    return d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
  }
  function fmtCountdown(iso) {
    if (!iso) return "—";
    const ms = +new Date(iso) - Date.now();
    if (ms <= 0) return "now";
    const days = Math.floor(ms / 86400000);
    const hrs  = Math.floor((ms % 86400000) / 3600000);
    const mns  = Math.floor((ms % 3600000) / 60000);
    return `${days}d ${hrs}h ${mns}m`;
  }
  function loadLocalCast() {
    try { return JSON.parse(localStorage.getItem(CFG.LOCAL_QUOTA_KEY) || "null"); }
    catch { return null; }
  }
  function saveLocalCast(o) {
    try { localStorage.setItem(CFG.LOCAL_QUOTA_KEY, JSON.stringify(o)); } catch {}
  }
  function authBearer() {
    // loomus-auth.js exposes the current access token
    try {
      const t = window.LoomusAuth?.getAccessToken?.();
      return t ? `Bearer ${t}` : null;
    } catch { return null; }
  }

  // ─── CSS injection ─────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById("loomus-spellbook-css")) return;
    const css = `
:root {
  --lsp-paper:#f5efe4; --lsp-ink:#1f1d18; --lsp-ink-soft:#4a463c;
  --lsp-rule:#d4caba; --lsp-hairline:rgba(31,29,24,0.10);
  --lsp-ochre:#c19a3e; --lsp-ochre-bright:#d4ac4a; --lsp-ochre-deep:#8a6c21;
  --lsp-gold-leaf:#b88a2b;
  --lsp-pompeii:#a23a26; --lsp-pompeii-deep:#7e2a1a; --lsp-pompeii-cool:#6b2a1c;
  --lsp-terracotta:#c25d3a;
  --lsp-vellum-1:#f3e6c8; --lsp-vellum-2:#e9d6a8; --lsp-vellum-3:#d9bf86;
  --lsp-sepia:#5b3a1c; --lsp-sepia-soft:#7e5430;
  --lsp-leather:#5a2a1c; --lsp-leather-deep:#3a180e;
  --lsp-brass:#a98648; --lsp-brass-shine:#dfba6a; --lsp-brass-deep:#6b4f1c;
}
.lsp-shell { font-family:Inter,-apple-system,sans-serif; color:var(--lsp-ink); margin:18px 0 8px; }
.lsp-divider { position:relative; text-align:center; margin:14px 0;
  font-family:'Geist Mono',monospace; font-weight:600;
  font-size:9px; letter-spacing:0.34em; text-transform:uppercase; color:var(--lsp-pompeii); }
.lsp-divider::before, .lsp-divider::after { content:''; position:absolute; top:50%; width:34%; height:1px;
  background:linear-gradient(90deg, transparent, var(--lsp-pompeii)); opacity:0.42; }
.lsp-divider::before { left:0; }
.lsp-divider::after  { right:0; background:linear-gradient(270deg, transparent, var(--lsp-pompeii)); }
.lsp-divider .lsp-g { display:inline-block; padding:0 10px; position:relative;
  background:var(--lsp-paper); }

/* CODEX container */
.lsp-codex { position:relative; width:100%; aspect-ratio:5/6;
  border-radius:4px 8px 8px 4px; overflow:hidden;
  box-shadow:0 22px 36px -16px rgba(0,0,0,0.32), 0 2px 0 rgba(31,29,24,0.05); }
/* Parchment spread (underneath cover) */
.lsp-spread { position:absolute; inset:0;
  background:
    radial-gradient(ellipse 12% 8% at 22% 38%, rgba(176,140,82,0.32) 0%, transparent 60%),
    radial-gradient(ellipse 9% 6% at 72% 28%, rgba(176,140,82,0.28) 0%, transparent 60%),
    radial-gradient(ellipse 14% 8% at 88% 78%, rgba(176,140,82,0.24) 0%, transparent 60%),
    linear-gradient(180deg, var(--lsp-vellum-1) 0%, var(--lsp-vellum-2) 60%, var(--lsp-vellum-3) 100%);
  opacity:0; transition:opacity .55s ease; z-index:1; }
.lsp-spread::before { content:''; position:absolute; left:50%; top:0; bottom:0; width:36px;
  transform:translateX(-50%); pointer-events:none;
  background:radial-gradient(ellipse 50% 100% at 50% 50%,
    rgba(91,58,28,0.28) 0%, rgba(91,58,28,0.10) 40%, transparent 75%); }
.lsp-codex[data-state="opening"] .lsp-spread,
.lsp-codex[data-state="casting"] .lsp-spread,
.lsp-codex[data-state="revealed"] .lsp-spread,
.lsp-codex[data-state="vanishing"] .lsp-spread { opacity:1; }

/* Leather cover */
.lsp-cover { position:absolute; inset:0; border-radius:4px 8px 8px 4px;
  background:
    radial-gradient(ellipse 100% 80% at 50% 50%, #6b2d1d 0%, var(--lsp-leather) 60%, var(--lsp-leather-deep) 100%);
  transform-origin:left center; transition:opacity .55s ease;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,0.32); z-index:5; }
.lsp-cover::before { content:''; position:absolute; left:0; top:0; bottom:0; width:14px;
  background:linear-gradient(90deg, rgba(0,0,0,0.45), rgba(255,255,255,0.06) 60%, transparent); }
.lsp-cover::after { content:''; position:absolute; inset:12px;
  border:1px solid rgba(193,154,62,0.32); border-radius:3px;
  box-shadow:inset 0 0 0 3px rgba(0,0,0,0.18), inset 0 0 0 4px rgba(193,154,62,0.20); }
.lsp-codex[data-state="opening"] .lsp-cover,
.lsp-codex[data-state="casting"] .lsp-cover,
.lsp-codex[data-state="revealed"] .lsp-cover,
.lsp-codex[data-state="vanishing"] .lsp-cover { opacity:0; }

/* Cover face */
.lsp-cover-face { position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; padding:24px 22px; text-align:center;
  z-index:6; transition:opacity .35s ease; }
.lsp-codex[data-state="opening"] .lsp-cover-face,
.lsp-codex[data-state="casting"] .lsp-cover-face,
.lsp-codex[data-state="revealed"] .lsp-cover-face,
.lsp-codex[data-state="vanishing"] .lsp-cover-face,
.lsp-codex[data-state="clasped"] .lsp-cover-face { opacity:0; pointer-events:none; }
.lsp-cv-eb { font-family:'Geist Mono',monospace; font-weight:600;
  font-size:9px; letter-spacing:0.30em; text-transform:uppercase;
  color:var(--lsp-brass-shine); margin:0 0 10px; opacity:0.85; }
.lsp-cv-glyph { width:48px; height:48px; margin:0 auto 12px; opacity:0.92;
  filter:drop-shadow(0 1px 0 rgba(0,0,0,0.42)); }
.lsp-cv-title { font-family:'Fraunces',serif; font-style:italic; font-weight:500;
  font-size:19px; line-height:1.18; margin:0 0 6px; letter-spacing:-0.005em;
  background:linear-gradient(180deg, #f4d385 0%, var(--lsp-gold-leaf) 55%, #6b4a14 100%);
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.lsp-cv-title .amp { color:rgba(241,212,136,0.45); -webkit-text-fill-color:rgba(241,212,136,0.45); padding:0 4px; }
.lsp-cv-byline { font-family:'Newsreader',serif; font-style:italic;
  font-size:11.5px; color:rgba(241,212,136,0.55); margin:0 0 16px; line-height:1.45; }
.lsp-cv-byline span { display:block; }
.lsp-cv-moon-rule { font-family:'Geist Mono',monospace; font-style:normal;
  font-weight:500; font-size:9px; letter-spacing:0.28em; text-transform:uppercase;
  color:rgba(241,212,136,0.50); margin-top:3px; }
.lsp-cv-prompt { font-family:'Newsreader',serif; font-style:italic;
  font-size:12.5px; color:rgba(241,212,136,0.78); margin:0 0 6px;
  text-align:center; line-height:1.4; max-width:240px; }
.lsp-cv-term { width:80%; max-width:240px; margin:0 auto 18px;
  background:rgba(241,212,136,0.04); border:none; outline:none; text-align:center;
  font-family:'Fraunces',serif; font-style:italic; font-size:18px;
  color:#f1d488; padding:10px 6px;
  border-bottom:2px solid var(--lsp-brass-shine);
  transition:background .2s ease, border-color .2s ease; }
.lsp-cv-term::placeholder { color:rgba(241,212,136,0.45); font-style:italic; }
.lsp-cv-term:focus { background:rgba(241,212,136,0.08); border-color:#f4d385; }

/* Wax seal */
.lsp-seal { position:relative; width:72px; height:72px; border-radius:50%;
  cursor:pointer; border:none; padding:0;
  background:radial-gradient(circle at 32% 28%,
    #d96d4f 0%, var(--lsp-pompeii) 40%, var(--lsp-pompeii-deep) 92%);
  box-shadow:inset 0 4px 5px rgba(255,255,255,0.20),
    inset 0 -4px 6px rgba(0,0,0,0.42),
    0 10px 22px rgba(155,58,38,0.55),
    0 0 0 5px rgba(193,154,62,0.10);
  transition:transform .25s ease, box-shadow .3s ease; }
.lsp-seal:hover:not(:disabled) { transform:translateY(-2px); }
.lsp-seal:disabled { opacity:0.55; cursor:not-allowed; }
.lsp-seal::after { content:'M'; position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  font-family:'Fraunces',serif; font-weight:600; font-style:italic;
  font-size:34px; color:rgba(255,255,255,0.88);
  text-shadow:0 2px 0 rgba(0,0,0,0.48), 0 -1px 0 rgba(255,255,255,0.16); }
.lsp-seal-rune { margin-top:14px;
  font-family:'Geist Mono',monospace; font-weight:500;
  font-size:9px; letter-spacing:0.30em; text-transform:uppercase;
  color:rgba(241,212,136,0.62); animation:lspBreath 4s ease-in-out infinite; }
@keyframes lspBreath { 0%,100%{ opacity:0.5 } 50%{ opacity:0.92 } }
.lsp-cv-moon { position:absolute; top:18px; right:18px;
  width:16px; height:16px; border-radius:50%;
  background:radial-gradient(circle at 38% 38%, #f4d385 0%, var(--lsp-gold-leaf) 90%);
  box-shadow:0 0 12px rgba(193,154,62,0.55); z-index:7; transition:all .8s ease; }
.lsp-codex[data-state="clasped"] .lsp-cv-moon {
  background:radial-gradient(circle at 38% 38%, rgba(244,196,121,0.18) 0%, rgba(193,154,62,0.08) 90%);
  box-shadow:0 0 4px rgba(193,154,62,0.12); }

/* Pages (open spread) */
.lsp-pages { position:absolute; inset:14px; display:grid; grid-template-columns:1fr 1fr;
  padding:14px 18px; z-index:2; }
.lsp-page { position:relative; padding:4px 12px; min-width:0; }
.lsp-page-left  { padding-right:18px; }
.lsp-page-right { padding-left:18px; }
.lsp-ch-eb { font-family:'Geist Mono',monospace; font-weight:600;
  font-size:8px; letter-spacing:0.26em; text-transform:uppercase;
  color:var(--lsp-sepia); margin:0 0 8px; opacity:0.78;
  display:flex; align-items:center; gap:5px; }
.lsp-ch-eb::after { content:''; flex:1; height:1px;
  background:linear-gradient(90deg, var(--lsp-sepia), transparent); opacity:0.55; }
.lsp-body { font-family:'Newsreader',serif; font-style:italic;
  font-size:12.5px; line-height:1.6; color:var(--lsp-sepia);
  margin:0; min-height:80px; white-space:pre-wrap; }
.lsp-body em { color:#7e2a1a; font-style:italic; }
.lsp-cursor { display:inline-block; width:1px; height:1.1em;
  background:var(--lsp-sepia); vertical-align:-2px; margin-left:1px;
  animation:lspCursor 1s steps(2,end) infinite; }
@keyframes lspCursor { 0%,49%{ opacity:1 } 50%,100%{ opacity:0 } }
.lsp-codex[data-state="revealed"] .lsp-body::first-letter,
.lsp-codex[data-state="vanishing"] .lsp-body::first-letter {
  font-family:'Fraunces',serif; font-weight:700; font-style:italic;
  font-size:32px; line-height:0.9; float:left; padding:4px 6px 0 0;
  background:linear-gradient(180deg, #f4d385 0%, var(--lsp-gold-leaf) 50%, #6b4a14 100%);
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
  filter:drop-shadow(0 1px 0 rgba(91,58,28,0.32)); }
.lsp-folio { position:absolute; bottom:4px; font-family:'Fraunces',serif;
  font-style:italic; font-weight:500; font-size:10px;
  color:var(--lsp-sepia); opacity:0.65; letter-spacing:0.10em; }
.lsp-folio-left { left:20px; }
.lsp-folio-right { right:20px; }

/* Vanish (ink dissolves right-to-left) */
.lsp-codex[data-state="vanishing"] .lsp-body {
  -webkit-mask:linear-gradient(270deg, transparent 0%, #000 30%, #000 100%);
          mask:linear-gradient(270deg, transparent 0%, #000 30%, #000 100%);
  -webkit-mask-size:300% 100%; mask-size:300% 100%;
  animation:lspInkVanish 1.8s ease-out forwards; }
@keyframes lspInkVanish {
  0% { -webkit-mask-position:100% 0; mask-position:100% 0; }
  40%{ filter:saturate(0.55) brightness(1.08); }
  100%{ -webkit-mask-position:-50% 0; mask-position:-50% 0; filter:saturate(0) opacity(0); } }

/* Fade-the-spell button */
.lsp-fade-btn { position:absolute; right:24px; bottom:24px; z-index:8;
  font-family:'Geist Mono',monospace; font-weight:500;
  font-size:8.5px; letter-spacing:0.26em; text-transform:uppercase;
  color:var(--lsp-sepia); background:transparent;
  border:1px solid rgba(91,58,28,0.42); border-radius:99px;
  padding:6px 11px; cursor:pointer; opacity:0;
  transition:opacity .4s ease, background .18s ease, color .18s ease, border-color .18s ease; }
.lsp-codex[data-state="revealed"] .lsp-fade-btn { opacity:0.85; }
.lsp-fade-btn:hover { background:rgba(91,58,28,0.07); color:var(--lsp-pompeii-deep);
  border-color:var(--lsp-pompeii-deep); opacity:1; }

/* Clasped — brass strap + lock plate */
.lsp-strap, .lsp-lock { opacity:0; transition:opacity .55s ease; z-index:7; }
.lsp-codex[data-state="clasped"] .lsp-strap,
.lsp-codex[data-state="clasped"] .lsp-lock { opacity:1; }
.lsp-strap { position:absolute; right:6px; top:30%; bottom:30%; width:28px;
  background:linear-gradient(180deg, var(--lsp-brass) 0%, var(--lsp-brass-shine) 40%, var(--lsp-brass-deep) 100%);
  border-left:1px solid rgba(0,0,0,0.32); border-right:1px solid rgba(0,0,0,0.32);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18), -2px 0 4px rgba(0,0,0,0.32); }
.lsp-lock { position:absolute; right:-2px; top:50%; transform:translateY(-50%);
  width:40px; height:44px; border-radius:4px;
  background:radial-gradient(ellipse 80% 80% at 30% 30%,
    var(--lsp-brass-shine) 0%, var(--lsp-brass) 50%, var(--lsp-brass-deep) 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.32),
    inset 0 -2px 4px rgba(0,0,0,0.32), -4px 4px 10px rgba(0,0,0,0.32); }
.lsp-lock::after { content:''; position:absolute; left:50%; top:50%;
  transform:translate(-50%,-50%); width:5px; height:11px;
  background:var(--lsp-brass-deep); border-radius:50% 50% 0 0;
  box-shadow:0 0 5px rgba(0,0,0,0.55) inset; }

/* Clasped face content */
.lsp-clasp-face { position:absolute; inset:0; display:none; align-items:center;
  justify-content:center; flex-direction:column; gap:8px; padding:28px 22px;
  text-align:center; z-index:8; }
.lsp-codex[data-state="clasped"] .lsp-clasp-face { display:flex; }
.lsp-clasp-eb { font-family:'Geist Mono',monospace; font-weight:600;
  font-size:9px; letter-spacing:0.30em; text-transform:uppercase;
  color:var(--lsp-brass-shine); margin:0; opacity:0.85; }
.lsp-clasp-prose { font-family:'Fraunces',serif; font-style:italic; font-weight:500;
  font-size:16px; line-height:1.22; margin:0;
  background:linear-gradient(180deg, #f4d385 0%, var(--lsp-gold-leaf) 60%, #6b4a14 100%);
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.lsp-next-date { font-family:'Fraunces',serif; font-style:italic; font-weight:500;
  font-size:22px; line-height:1.1; margin:6px 0 2px; letter-spacing:-0.005em;
  background:linear-gradient(180deg, #f4d385 0%, var(--lsp-gold-leaf) 60%, #6b4a14 100%);
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.lsp-countdown { font-family:'Geist Mono',monospace; font-weight:600;
  font-size:9.5px; letter-spacing:0.24em; color:rgba(241,212,136,0.78); margin:0;
  text-transform:uppercase; }
.lsp-locked-helper { font-family:'Newsreader',serif; font-style:italic;
  font-size:11.5px; color:rgba(241,212,136,0.52); margin:8px 0 0; line-height:1.4; }

/* YOUR TURN block */
.lsp-yourturn { position:relative; margin-top:14px; padding:14px 14px 12px;
  background:linear-gradient(180deg, rgba(194,93,58,0.07) 0%, rgba(194,93,58,0.03) 100%);
  border:1px solid rgba(194,93,58,0.32); border-radius:10px; display:none; }
.lsp-yourturn.is-visible { display:block; animation:lspAppear .55s cubic-bezier(.22,1,.36,1); }
@keyframes lspAppear { from{ opacity:0; transform:translateY(-6px); } to{ opacity:1; transform:translateY(0); } }
.lsp-yourturn::before { content:''; position:absolute; top:-14px; left:50%;
  transform:translateX(-50%); width:1px; height:14px;
  background:linear-gradient(180deg, transparent, rgba(194,93,58,0.55)); }
.lsp-yourturn::after { content:'↓'; position:absolute; top:-22px; left:50%;
  transform:translateX(-50%); width:14px; height:14px;
  font-family:'Geist Mono',monospace; font-size:11px; color:var(--lsp-terracotta);
  opacity:0.62; display:flex; align-items:center; justify-content:center; }
.lsp-yt-head { display:flex; align-items:baseline; justify-content:space-between;
  gap:8px; margin-bottom:6px; }
.lsp-yt-label { font-family:'Geist Mono',monospace; font-weight:600;
  font-size:10px; letter-spacing:0.26em; text-transform:uppercase; color:var(--lsp-terracotta); }
.lsp-yt-on { font-family:'Fraunces',serif; font-style:italic; font-size:12px;
  color:rgba(31,29,24,0.62); }
.lsp-yt-on em { color:var(--lsp-ink); font-weight:500; }
.lsp-yt-prompt { font-family:'Newsreader',serif; font-style:italic;
  font-size:13.5px; line-height:1.55; color:rgba(31,29,24,0.78); margin:0 0 10px; }
.lsp-yt-prompt em { color:var(--lsp-terracotta); }
.lsp-yt-ta { width:100%; min-height:72px; box-sizing:border-box;
  background:repeating-linear-gradient(to bottom, transparent 0, transparent 22px,
    rgba(194,93,58,0.10) 22px, rgba(194,93,58,0.10) 23px), #fffaf6;
  border:1px solid rgba(194,93,58,0.30); border-radius:5px;
  padding:10px 12px; font-family:'Newsreader',serif; font-style:italic;
  font-size:13.5px; line-height:23px; color:var(--lsp-ink); resize:vertical; outline:none; }
.lsp-yt-ta::placeholder { color:rgba(31,29,24,0.34); font-style:italic; }
.lsp-yt-actions { display:flex; gap:8px; margin-top:8px; align-items:center; flex-wrap:wrap; }
.lsp-yt-pin { background:var(--lsp-terracotta); color:var(--lsp-paper); border:none;
  padding:9px 14px; border-radius:99px; cursor:pointer; min-height:36px;
  font-family:'Geist Mono',monospace; font-weight:600;
  font-size:9.5px; letter-spacing:0.22em; text-transform:uppercase;
  box-shadow:0 6px 14px -4px rgba(194,93,58,0.36); }
.lsp-yt-pin:disabled { opacity:0.5; cursor:not-allowed; }
.lsp-yt-tag { font-family:'Geist Mono',monospace; font-weight:500;
  font-size:9px; letter-spacing:0.18em;
  color:var(--lsp-terracotta); background:rgba(194,93,58,0.12);
  padding:3px 7px; border-radius:99px; }
.lsp-yt-saved { margin-top:8px; padding:8px 10px;
  background:rgba(194,93,58,0.10); border:1px solid rgba(194,93,58,0.32);
  border-radius:7px; font-family:'Newsreader',serif; font-style:italic;
  font-size:12.5px; color:rgba(31,29,24,0.78);
  display:none; align-items:center; gap:8px; }
.lsp-yt-saved.is-visible { display:flex; animation:lspAppear .55s cubic-bezier(.22,1,.36,1); }
.lsp-yt-saved em { color:var(--lsp-terracotta); }
.lsp-yt-saved-dot { width:7px; height:7px; border-radius:50%;
  background:var(--lsp-terracotta); flex-shrink:0;
  box-shadow:0 0 0 3px rgba(194,93,58,0.18); }

@media (prefers-reduced-motion: reduce) {
  .lsp-codex *, .lsp-codex *::before, .lsp-codex *::after,
  .lsp-yourturn, .lsp-yourturn *::before, .lsp-yourturn *::after,
  .lsp-yourturn.is-visible, .lsp-yt-saved.is-visible {
    animation:none !important; transition:none !important;
  }
}
`;
    const el = document.createElement("style");
    el.id = "loomus-spellbook-css"; el.textContent = css;
    document.head.appendChild(el);
  }

  // ─── Markup ────────────────────────────────────────────────────────
  function renderShell(slot) {
    const bookSlug   = slot.dataset.loomusBook || "";
    const bookTitle  = slot.dataset.loomusBookTitle || "this piece";
    slot.dataset.bookSlug  = bookSlug;
    slot.dataset.bookTitle = bookTitle;

    slot.innerHTML = `
<div class="lsp-shell">
  <div class="lsp-divider"><span class="lsp-g">✦  the spellbook  ✦</span></div>
  <div class="lsp-codex" data-state="ready">
    <div class="lsp-spread">
      <div class="lsp-pages">
        <div class="lsp-page lsp-page-left">
          <p class="lsp-ch-eb">Feynman</p>
          <p class="lsp-body" data-lsp="bodyLeft"></p>
          <p class="lsp-folio lsp-folio-left">i.</p>
        </div>
        <div class="lsp-page lsp-page-right">
          <p class="lsp-ch-eb">First Principles</p>
          <p class="lsp-body" data-lsp="bodyRight"></p>
          <p class="lsp-folio lsp-folio-right">ii.</p>
        </div>
      </div>
      <button type="button" class="lsp-fade-btn" data-lsp="fadeBtn">— let it fade</button>
    </div>
    <div class="lsp-cover">
      <div class="lsp-cv-moon"></div>
    </div>
    <div class="lsp-cover-face" data-lsp="coverFace">
      <p class="lsp-cv-eb">— libellvs spectri</p>
      <svg class="lsp-cv-glyph" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="20" stroke="#f1d488" stroke-width="1.2" opacity="0.55"/>
        <path d="M22 32 Q32 18 42 32 Q32 46 22 32 Z" stroke="#f1d488" stroke-width="1.2" fill="#a23a26" fill-opacity="0.55"/>
        <circle cx="22" cy="32" r="2.2" fill="#f1d488"/>
        <circle cx="42" cy="32" r="2.2" fill="#f1d488"/>
      </svg>
      <h3 class="lsp-cv-title">Feynman <span class="amp">·</span> First Principles</h3>
      <p class="lsp-cv-byline">
        <span>two lenses on one concept</span>
        <span class="lsp-cv-moon-rule">— once per moon —</span>
      </p>
      <p class="lsp-cv-prompt">✦ name a concept that's been on your mind</p>
      <input type="text" class="lsp-cv-term" data-lsp="termInput" placeholder="type it here" />
      <button type="button" class="lsp-seal" data-lsp="seal" disabled aria-label="Press the seal to cast"></button>
      <p class="lsp-seal-rune">Press the seal to cast</p>
    </div>
    <div class="lsp-clasp-face">
      <p class="lsp-clasp-eb">— sealed until next moon</p>
      <p class="lsp-clasp-prose">You cast on<br><em data-lsp="lockedTerm"></em></p>
      <p class="lsp-next-date" data-lsp="nextDate"></p>
      <p class="lsp-countdown">next cast in <span data-lsp="countdown"></span></p>
      <p class="lsp-locked-helper">— a new concept will be waiting then —</p>
    </div>
    <div class="lsp-strap"></div>
    <div class="lsp-lock"></div>
  </div>

  <div class="lsp-yourturn" data-lsp="yourTurn">
    <div class="lsp-yt-head">
      <span class="lsp-yt-label">Your turn</span>
      <span class="lsp-yt-on">on <em data-lsp="ytTerm"></em></span>
    </div>
    <p class="lsp-yt-prompt">
      Whatever the spellbook said, <em>what's your version</em>?<br>
      One line, one push-back, one extension.
    </p>
    <textarea class="lsp-yt-ta" data-lsp="ytInput" rows="3"
      placeholder="i'd push back: …  /  i'd add: …  /  this lands because: …"></textarea>
    <div class="lsp-yt-actions">
      <button type="button" class="lsp-yt-pin" data-lsp="ytPin" disabled>+ pin to my wall</button>
      <span class="lsp-yt-tag">#yours</span>
    </div>
    <div class="lsp-yt-saved" data-lsp="ytSaved">
      <span class="lsp-yt-saved-dot"></span>
      <span><em>Pinned.</em> Your line is on the wall — tagged <em>#yours</em>.</span>
    </div>
  </div>
</div>
    `;
  }

  // ─── Logic ─────────────────────────────────────────────────────────
  function activate(slot) {
    const $$ = (k) => slot.querySelector(`[data-lsp="${k}"]`);
    const codex = slot.querySelector(".lsp-codex");
    const termInput = $$("termInput");
    const seal = $$("seal");
    const bodyLeft = $$("bodyLeft");
    const bodyRight = $$("bodyRight");
    const fadeBtn = $$("fadeBtn");
    const yourTurn = $$("yourTurn");
    const ytTerm = $$("ytTerm");
    const ytInput = $$("ytInput");
    const ytPin = $$("ytPin");
    const ytSaved = $$("ytSaved");
    const lockedTerm = $$("lockedTerm");
    const nextDateEl = $$("nextDate");
    const countdownEl = $$("countdown");

    const bookSlug = slot.dataset.bookSlug || "";
    const state = {
      term: "",
      targetRef: null,
      castNextAt: null,
    };

    function setState(s) { codex.setAttribute("data-state", s); }
    function setLocked(term, nextAtIso) {
      state.term = term; state.castNextAt = nextAtIso;
      lockedTerm.textContent = term;
      nextDateEl.textContent = fmtNextDate(nextAtIso);
      countdownEl.textContent = fmtCountdown(nextAtIso);
      setState("clasped");
      saveLocalCast({ slug: bookSlug, term, next_at: nextAtIso });
    }

    // Boot: if we already cast this week (server told us before, or local
    // optimistic), show clasped immediately.
    const cached = loadLocalCast();
    if (cached && cached.slug === bookSlug && cached.next_at && +new Date(cached.next_at) > Date.now()) {
      setLocked(cached.term, cached.next_at);
    } else {
      setState("ready");
    }

    // Enable seal only when user typed something
    termInput.addEventListener("input", () => {
      seal.disabled = termInput.value.trim().length < 2;
    });
    termInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !seal.disabled) { e.preventDefault(); seal.click(); }
    });

    // ─── Streaming reveal (mimics LLM stream when v3.5 lands) ────────
    function streamInto(el, text, cps = 30) {
      return new Promise((resolve) => {
        if (reducedMotion()) { el.textContent = text; resolve(); return; }
        el.innerHTML = '<span class="lsp-cursor"></span>';
        const cursor = el.querySelector(".lsp-cursor");
        let i = 0;
        const tick = () => {
          if (i >= text.length) { cursor.remove(); resolve(); return; }
          cursor.insertAdjacentText("beforebegin", text[i]); i++;
          const ms = 1000 / cps + (Math.random() * 30 - 10);
          setTimeout(tick, Math.max(8, ms));
        };
        tick();
      });
    }

    async function runCast() {
      const term = termInput.value.trim();
      if (term.length < 2) return;
      seal.disabled = true;

      if (!authBearer()) {
        // Hand off to loomus-auth sign-in tray; replay after auth
        try {
          window.LoomusAuth?.signIn?.({ then: "spellbook-cast", payload: { slug: bookSlug, term } });
        } catch {}
        seal.disabled = false;
        return;
      }

      // cracking → opening → casting (visual rhythm)
      setState("cracking");
      await new Promise((r) => setTimeout(r, 380));
      setState("opening");
      await new Promise((r) => setTimeout(r, 700));
      setState("casting");

      let payload;
      try {
        const res = await fetch(CFG.castUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authBearer() },
          body: JSON.stringify({ term, slug: bookSlug }),
        });
        payload = await res.json();
        if (!res.ok || !payload.ok) {
          // 429 → already cast this week. Lock immediately.
          if (res.status === 429 && payload.next_at) {
            setLocked(payload.previous_term || term, payload.next_at);
            return;
          }
          throw new Error(payload.error || "cast_failed");
        }
      } catch (e) {
        console.error("spellbook cast failed", e);
        bodyLeft.textContent = "the spell didn't catch — try again in a moment.";
        bodyRight.textContent = "";
        setState("revealed"); // let user dismiss
        return;
      }

      state.term = term;
      state.targetRef = payload.target_ref;
      state.castNextAt = payload.next_at;
      saveLocalCast({ slug: bookSlug, term, next_at: payload.next_at });

      ytTerm.textContent = term;

      // Stream both lenses in parallel
      await Promise.all([
        streamInto(bodyLeft, payload.feynman, 30),
        streamInto(bodyRight, payload.fp, 32),
      ]);

      setState("revealed");
      yourTurn.classList.add("is-visible");
      // Tiny haptic ack so users on phone feel "the spell took"
      haptic(8);
      // Defer focus so screen reader follows the new content
      setTimeout(() => ytInput.focus({ preventScroll: true }), 200);
    }

    seal.addEventListener("click", () => { if (codex.getAttribute("data-state") === "ready") runCast(); });

    fadeBtn.addEventListener("click", async () => {
      if (codex.getAttribute("data-state") !== "revealed") return;
      setState("vanishing");
      await new Promise((r) => setTimeout(r, reducedMotion() ? 60 : 1800));
      bodyLeft.textContent = ""; bodyRight.textContent = "";
      setLocked(state.term, state.castNextAt);
    });

    // ─── Your turn (reflection) ──────────────────────────────────────
    ytInput.addEventListener("input", () => {
      ytPin.disabled = ytInput.value.trim().length < 4 ||
                       ytInput.value.length > CFG.REFLECTION_MAX;
    });

    ytPin.addEventListener("click", async () => {
      const note = ytInput.value.trim();
      if (!note || !state.targetRef) return;
      ytPin.disabled = true;
      ytPin.textContent = "saving…";

      const ref = `${bookSlug ? bookSlug + ":" : ""}reflection:${slugify(state.term)}`;
      try {
        if (!authBearer()) {
          window.LoomusAuth?.signIn?.({
            then: "library-save",
            payload: { kind: "reflection", ref, target_ref: state.targetRef, note },
          });
          return;
        }
        const res = await fetch(CFG.saveUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authBearer() },
          body: JSON.stringify({
            kind: "reflection",
            ref,
            target_ref: state.targetRef,
            note,
            visibility: "public",        // reflections public by default
            tags: ["#yours"],
            display_title: state.term,
            display_source: slot.dataset.bookTitle || "",
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "save_failed");
        ytPin.textContent = "✓ pinned";
        ytSaved.classList.add("is-visible");
        haptic(12);
      } catch (e) {
        console.error("reflection save failed", e);
        ytPin.disabled = false;
        ytPin.textContent = "+ pin to my wall";
        alert("Couldn't pin that reflection. Try once more?");
      }
    });

    // Tick the countdown once a minute while in clasped state
    setInterval(() => {
      if (codex.getAttribute("data-state") !== "clasped" || !state.castNextAt) return;
      countdownEl.textContent = fmtCountdown(state.castNextAt);
      // When the countdown rolls to <= 0, reset to ready next refresh
      if (+new Date(state.castNextAt) <= Date.now()) {
        try { localStorage.removeItem(CFG.LOCAL_QUOTA_KEY); } catch {}
      }
    }, 60_000);
  }

  // ─── Boot ──────────────────────────────────────────────────────────
  ready(() => {
    injectCSS();
    document.querySelectorAll("[data-loomus-spellbook]").forEach((slot) => {
      if (slot.dataset.lspBound === "1") return;
      slot.dataset.lspBound = "1";
      renderShell(slot);
      activate(slot);
    });
  });

  // Expose for late-mounted slots (e.g. SPA navigation)
  window.LoomusSpellbook = {
    mount(slot) {
      if (!slot || slot.dataset.lspBound === "1") return;
      injectCSS();
      slot.dataset.lspBound = "1";
      renderShell(slot);
      activate(slot);
    },
  };
})(window, document);
