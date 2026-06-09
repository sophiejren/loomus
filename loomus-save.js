/* ═══════════════════════════════════════════════════════════════════════
 *  loomus-save.js · STEP 3 · client library + button + modal
 *  ──────────────────────────────────────────────────────────────────────
 *  Deploy to:    https://loomus.ai/loomus-save.js
 *  Loaded by:    every page that wants Save (graphs, marginalia, you/notes)
 *  Depends on:   loomus-auth.js  (must be loaded first)
 *
 *  HOW TO USE — declare a save target on any element:
 *
 *    <button data-loomus-save
 *            data-loomus-save-kind="node"
 *            data-loomus-save-ref="thousand-brains-hawkins:hierarchical-temporal-memory"
 *            data-loomus-save-title="Hierarchical Temporal Memory"
 *            data-loomus-save-source="from A Thousand Brains · Hawkins"
 *            data-loomus-save-url="https://graphs.loomus.ai/thousand-brains-hawkins#hierarchical-temporal-memory"
 *            data-loomus-save-note-from="#node-note-input">
 *      <!-- the script fills in icon + label; preserves classes you put here -->
 *    </button>
 *
 *  The script:
 *    · auto-discovers every [data-loomus-save] on DOMContentLoaded
 *    · hydrates: icon, label, click handler, hover, prefers-reduced-motion
 *    · checks "is this already saved?" against the library and flips
 *      the button to the SAVED state without flicker
 *    · on click:
 *        - if signed in   → POST /functions/v1/library-save → toast + flip
 *        - if anon        → write pending_save → open magic-link modal
 *    · listens to LoomusAuth.onAuthChange('SIGNED_IN') and, if a pending
 *      save is in localStorage, executes it then redirects to
 *      /you/library?just_added={id}
 *
 *  All UI (button states, toast, modal, modal CSS) is inlined here. No
 *  external dependencies beyond loomus-auth.js (which is already loaded
 *  by apply-loomus-auth-tag.py on every page).
 * ═══════════════════════════════════════════════════════════════════════ */

(function (window, document) {
  "use strict";

  // ─── 1. config ──────────────────────────────────────────────────────
  const CFG = {
    // Supabase project — same one LoomusAuth uses. We read it from the
    // global LOOMUS_AUTH_CONFIG that loomus-auth.js already set up.
    get supabaseUrl() {
      return (window.LOOMUS_AUTH_CONFIG || {}).supabaseUrl || "";
    },
    get edgeFnUrl() {
      const base = this.supabaseUrl.replace(/\/$/, "");
      return base ? `${base}/functions/v1/library-save` : "";
    },
    PENDING_KEY: "loomus.pending_save",
    SAVED_CACHE_KEY: "loomus.saved_refs",            // user-scoped via prefix below
    LIBRARY_REDIRECT: "/you/library",
    AUTH_REDIRECT_TO: "/auth/callback",
    TOAST_MS: 2400,
  };

  // ─── 2. small helpers ───────────────────────────────────────────────
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  const $ = (sel, root = document) => root.querySelector(sel);

  function userScopedKey(base, userId) {
    return userId ? `${base}:${userId}` : base;
  }

  function readPending() {
    try {
      const raw = localStorage.getItem(CFG.PENDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function writePending(intent) {
    try { localStorage.setItem(CFG.PENDING_KEY, JSON.stringify(intent)); } catch {}
  }
  function clearPending() {
    try { localStorage.removeItem(CFG.PENDING_KEY); } catch {}
  }

  function readSavedCache(userId) {
    try {
      const raw = localStorage.getItem(userScopedKey(CFG.SAVED_CACHE_KEY, userId));
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  }
  function addToSavedCache(userId, ref) {
    const set = readSavedCache(userId);
    set.add(ref);
    try {
      localStorage.setItem(
        userScopedKey(CFG.SAVED_CACHE_KEY, userId),
        JSON.stringify([...set])
      );
    } catch {}
  }
  function removeFromSavedCache(userId, ref) {
    const set = readSavedCache(userId);
    set.delete(ref);
    try {
      localStorage.setItem(
        userScopedKey(CFG.SAVED_CACHE_KEY, userId),
        JSON.stringify([...set])
      );
    } catch {}
  }

  // ─── 3. SVG icons ───────────────────────────────────────────────────
  const ICON_BOOKMARK_OUTLINE = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  const ICON_BOOKMARK_FILL = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
            fill="currentColor"/>
    </svg>`;
  const ICON_CHECK = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"
                fill="none" stroke="currentColor" stroke-width="2.4"
                stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  // ─── 4. CSS injection (one stylesheet for button + toast + modal) ──
  function injectCSS() {
    if (document.getElementById("loomus-save-css")) return;
    const css = `
      .loomus-save-btn {
        --bg:#c19a3e; --bg2:#d4ac4a; --fg:#0e0d0a;
        display:inline-flex; align-items:center; gap:10px;
        padding:13px 20px 13px 17px;       /* tap target ≥ 44 on mobile */
        background:var(--bg); color:var(--fg);
        border:none; border-radius:99px;
        font-family:'Geist Mono','SF Mono',monospace;
        font-weight:600; font-size:11px; letter-spacing:0.20em;
        text-transform:uppercase;
        cursor:pointer; user-select:none;
        min-height:44px;
        transition:transform .2s ease, box-shadow .2s ease, background .2s ease;
        box-shadow:0 6px 18px -4px rgba(193,154,62,0.45);
        -webkit-tap-highlight-color:transparent;
        touch-action:manipulation;          /* removes the 300ms tap delay */
      }
      .loomus-save-btn:hover {
        background:var(--bg2); transform:translateY(-1px);
        box-shadow:0 10px 22px -4px rgba(193,154,62,0.6);
      }
      .loomus-save-btn:active { transform:scale(0.97); }
      @media (hover: none) {
        /* On true touch devices, drop the hover lift so it doesn't stick. */
        .loomus-save-btn:hover { transform:none; box-shadow:0 6px 18px -4px rgba(193,154,62,0.45); }
      }
      .loomus-save-btn svg { width:14px; height:14px; flex-shrink:0; }
      .loomus-save-btn[data-state="saved"] {
        background:rgba(193,154,62,0.14); color:#d4ac4a;
        border:1px solid rgba(193,154,62,0.45);
        box-shadow:none;
      }
      .loomus-save-btn[data-state="saved"]:hover {
        background:rgba(193,154,62,0.22); transform:none;
      }
      .loomus-save-btn[data-state="busy"] {
        opacity:0.55; cursor:wait;
      }
      .loomus-save-btn[data-state="busy"] svg { animation:loomus-spin 1s linear infinite; }
      @keyframes loomus-spin { to { transform:rotate(360deg); } }

      /* === toast === */
      /* DESKTOP: bottom-center pill. MOBILE: top-anchored to avoid the
         Safari URL bar / Android nav bar / keyboard. */
      .loomus-save-toast {
        position:fixed; left:50%; bottom:36px;
        transform:translateX(-50%) translateY(20px);
        opacity:0; pointer-events:none;
        display:inline-flex; align-items:center; gap:12px;
        padding:12px 18px;
        background:#c19a3e; color:#0e0d0a;
        border-radius:99px;
        font-family:'Geist Mono','SF Mono',monospace;
        font-weight:600; font-size:11px; letter-spacing:0.18em;
        text-transform:uppercase;
        box-shadow:0 12px 30px -8px rgba(193,154,62,0.55);
        transition:transform .35s cubic-bezier(.32,.72,0,1), opacity .35s ease;
        z-index:2147483646;
        touch-action:pan-x;
        max-width:calc(100vw - 32px);
      }
      .loomus-save-toast em {
        font-family:'Fraunces',Georgia,serif; font-style:italic; font-weight:500;
        text-transform:none; letter-spacing:-0.005em; font-size:13px;
      }
      .loomus-save-toast svg { width:13px; height:13px; }
      .loomus-save-toast[data-show="true"] {
        opacity:1; transform:translateX(-50%) translateY(0);
      }
      @media (max-width: 640px) {
        .loomus-save-toast {
          bottom:auto; top:calc(env(safe-area-inset-top, 0px) + 16px);
          transform:translateX(-50%) translateY(-24px);
          padding:14px 20px; font-size:11.5px;
        }
        .loomus-save-toast[data-show="true"] {
          transform:translateX(-50%) translateY(0);
        }
      }

      /* === modal / bottom-sheet (anon save) === */
      /* DESKTOP: centered card.  MOBILE: bottom sheet with drag-handle
         + swipe-to-dismiss + safe-area-aware bottom padding + keyboard
         avoidance via visualViewport (set on .loomus-save-modal as a
         translate Y from JS when keyboard appears). */
      .loomus-save-modal-scrim {
        position:fixed; inset:0;
        background:rgba(14,13,10,0.55);
        backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
        display:flex; align-items:center; justify-content:center;
        padding:24px;
        opacity:0; pointer-events:none;
        transition:opacity .25s ease;
        z-index:2147483647;
      }
      .loomus-save-modal-scrim[data-show="true"] { opacity:1; pointer-events:auto; }

      .loomus-save-modal {
        max-width:460px; width:100%;
        background:#faf7f1; color:#1f1d18;
        border-radius:8px;
        padding:32px 28px 26px;
        position:relative;
        font-family:'Inter','-apple-system',sans-serif;
        transform:translateY(8px);
        transition:transform .3s cubic-bezier(.32,.72,0,1);
        max-height:calc(100vh - 48px);
        overflow-y:auto; overflow-x:hidden;
        -webkit-overflow-scrolling:touch;
      }
      .loomus-save-modal-scrim[data-show="true"] .loomus-save-modal {
        transform:translateY(0);
      }

      /* Drag handle — only visible on mobile bottom-sheet mode */
      .loomus-save-modal .lm-drag-handle {
        display:none;
      }

      @media (max-width: 640px) {
        .loomus-save-modal-scrim {
          align-items:flex-end;
          padding:0;
          background:rgba(14,13,10,0.45);
        }
        .loomus-save-modal {
          max-width:100%; width:100%;
          border-radius:18px 18px 0 0;
          padding:0 22px calc(env(safe-area-inset-bottom, 0px) + 28px);
          transform:translateY(100%);
          transition:transform .4s cubic-bezier(.32,.72,0,1);
          max-height:92vh;
          /* JS-driven keyboard offset (visualViewport) — see attachSheetGestures */
          --kbd-offset: 0px;
        }
        .loomus-save-modal-scrim[data-show="true"] .loomus-save-modal {
          transform:translateY(calc(-1 * var(--kbd-offset)));
        }
        .loomus-save-modal .lm-drag-handle {
          display:block;
          width:100%; height:24px;
          position:sticky; top:0; left:0; right:0;
          padding-top:10px;
          background:#faf7f1; z-index:2;
          cursor:grab;
          touch-action:none;
        }
        .loomus-save-modal .lm-drag-handle::after {
          content:''; display:block; margin:0 auto;
          width:38px; height:4px; border-radius:99px;
          background:rgba(31,29,24,0.18);
        }
        /* Make close button huge tap target on mobile (still aesthetically tiny) */
        .loomus-save-modal .lm-close {
          top:8px; right:6px; padding:14px 16px; font-size:18px;
        }
      }

      .loomus-save-modal .lm-eyebrow {
        font-family:'Geist Mono','SF Mono',monospace; font-weight:600;
        font-size:10px; letter-spacing:0.22em; text-transform:uppercase;
        color:rgba(31,29,24,0.55); margin-bottom:16px;
      }
      .loomus-save-modal .lm-eyebrow em {
        font-family:'Fraunces',Georgia,serif; font-style:italic; font-weight:500;
        color:#c19a3e; letter-spacing:-0.005em; font-size:12px; text-transform:none;
      }
      .loomus-save-modal .lm-pending {
        background:rgba(193,154,62,0.10);
        border:1px dashed #c19a3e;
        border-radius:6px;
        padding:14px 16px; margin-bottom:22px;
        font-family:'Newsreader',Georgia,serif; font-style:italic;
        font-size:14px; line-height:1.5;
        color:rgba(31,29,24,0.72);
      }
      .loomus-save-modal .lm-pending strong {
        font-family:'Fraunces',Georgia,serif; font-weight:500;
        color:#1f1d18; font-style:italic;
      }
      .loomus-save-modal h4 {
        font-family:'Fraunces',Georgia,serif; font-style:italic; font-weight:500;
        font-size:24px; color:#1f1d18; margin:0 0 8px;
        letter-spacing:-0.012em; line-height:1.2;
      }
      .loomus-save-modal .lm-copy {
        font-family:'Newsreader',Georgia,serif; font-size:15px;
        color:rgba(31,29,24,0.72); line-height:1.55; margin-bottom:20px;
      }
      .loomus-save-modal input[type=email] {
        display:block; width:100%; box-sizing:border-box;
        padding:16px 20px;
        background:#fff;
        border:1.5px solid #d4caba; border-radius:99px;
        font-family:'Geist Mono','SF Mono',monospace;
        font-size:16px;             /* ≥16px prevents iOS Safari zoom */
        letter-spacing:0.01em;
        color:#1f1d18;
        outline:none; margin-bottom:14px;
        transition:border-color .2s ease, box-shadow .2s ease;
        min-height:52px;            /* generous tap target */
        -webkit-appearance:none;
      }
      .loomus-save-modal input[type=email]:focus {
        border-color:#c19a3e;
        box-shadow:0 0 0 3px rgba(193,154,62,0.18);
      }
      .loomus-save-modal .lm-submit {
        display:block; width:100%;
        padding:18px 22px;
        background:#1f1d18; color:#f5efe4;
        border:none; border-radius:99px;
        font-family:'Geist Mono','SF Mono',monospace; font-weight:600;
        font-size:12px; letter-spacing:0.22em; text-transform:uppercase;
        cursor:pointer;
        transition:background .2s ease, color .2s ease, transform .12s ease;
        min-height:54px;            /* ≥44 Apple HIG floor, comfortable */
        -webkit-tap-highlight-color:transparent;
      }
      .loomus-save-modal .lm-submit:hover { background:#c19a3e; color:#1f1d18; }
      .loomus-save-modal .lm-submit:active { transform:scale(0.98); }
      .loomus-save-modal .lm-submit[disabled] { opacity:0.5; cursor:wait; }
      .loomus-save-modal .lm-fine {
        margin-top:14px;
        font-family:'Geist Mono','SF Mono',monospace; font-size:10px;
        letter-spacing:0.16em; text-transform:uppercase;
        color:rgba(31,29,24,0.55); text-align:center;
      }
      .loomus-save-modal .lm-close {
        position:absolute; top:10px; right:12px;
        background:none; border:none; cursor:pointer;
        font-size:18px; line-height:1;
        color:rgba(31,29,24,0.45);
        padding:12px 14px;          /* expands tap target to ≥44×44 */
        -webkit-tap-highlight-color:transparent;
      }
      .loomus-save-modal .lm-close:hover { color:#1f1d18; }
      .loomus-save-modal .lm-success {
        text-align:center; padding:14px 0 6px;
        font-family:'Fraunces',Georgia,serif; font-style:italic;
        font-size:17px; color:rgba(31,29,24,0.78);
        line-height:1.55;
      }
      .loomus-save-modal .lm-success em { color:#c19a3e; font-style:italic; }
      /* Add a hero check mark to the success state */
      .loomus-save-modal .lm-success::before {
        content:''; display:block; margin:0 auto 18px;
        width:56px; height:56px; border-radius:99px;
        background:rgba(193,154,62,0.12);
        background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><polyline points='20 6 9 17 4 12' fill='none' stroke='%23c19a3e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/></svg>");
        background-repeat:no-repeat; background-position:center;
        background-size:28px;
      }

      @media (prefers-reduced-motion: reduce) {
        .loomus-save-btn,
        .loomus-save-toast,
        .loomus-save-modal,
        .loomus-save-modal-scrim { transition:none !important; }
      }
    `;
    const style = document.createElement("style");
    style.id = "loomus-save-css";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── 5. toast ───────────────────────────────────────────────────────
  let toastEl = null;
  function showToast(message, opts = {}) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "loomus-save-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    const icon = opts.kind === "check" ? ICON_CHECK : ICON_BOOKMARK_FILL;
    toastEl.innerHTML = `${icon}<em>${message}</em>`;
    toastEl.dataset.show = "true";
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.dataset.show = "false";
    }, opts.duration || CFG.TOAST_MS);
  }

  // ─── 6. modal (anon → magic link) ───────────────────────────────────
  let modalEl = null;
  function ensureModal() {
    if (modalEl) return modalEl;
    const scrim = document.createElement("div");
    scrim.className = "loomus-save-modal-scrim";
    scrim.innerHTML = `
      <div class="loomus-save-modal" role="dialog" aria-modal="true"
           aria-labelledby="loomus-save-modal-title">
        <div class="lm-drag-handle" data-loomus-drag-handle aria-hidden="true"></div>
        <button class="lm-close" aria-label="Close">×</button>
        <div class="lm-eyebrow">Save to library &nbsp;·&nbsp; <em>step 01 / 02</em></div>
        <div class="lm-pending" data-loomus-pending></div>
        <h4 id="loomus-save-modal-title">Where should we keep it?</h4>
        <p class="lm-copy">
          One email — we'll send a magic link, and your save will be
          waiting in your library when you come back. Free, forever,
          for Marginalia readers.
        </p>
        <form data-loomus-magic-form novalidate>
          <input type="email" name="email" required
                 inputmode="email" enterkeyhint="go"
                 autocapitalize="off" spellcheck="false"
                 placeholder="you@where-you-already-read.com"
                 autocomplete="email">
          <button type="submit" class="lm-submit">
            Save &amp; send me the link
          </button>
        </form>
        <p class="lm-fine">No password · no spam · your save waits</p>
        <div class="lm-success" data-loomus-success hidden>
          Check your inbox — <em>your save is waiting.</em><br>
          Click the link to keep it forever.
        </div>
      </div>
    `;
    document.body.appendChild(scrim);
    modalEl = scrim;

    // close handlers
    scrim.querySelector(".lm-close").addEventListener("click", closeModal);
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && scrim.dataset.show === "true") closeModal();
    });

    // submit
    const form = scrim.querySelector("[data-loomus-magic-form]");
    form.addEventListener("submit", onMagicSubmit);

    // ─── iOS-grade gestures: swipe-down-to-dismiss + keyboard avoidance ──
    attachSheetGestures(scrim);

    return scrim;
  }

  // ─── 6b. mobile gesture infrastructure ─────────────────────────────
  // Swipe-down-to-dismiss with velocity + position checks (Linear/Stripe pattern):
  //   • starts at drag-handle OR anywhere not interactive
  //   • follows finger 1:1 while dragging
  //   • on release: if dragged > 90px down OR velocity > 0.55px/ms → close
  //   • otherwise snap back via CSS transition
  // Keyboard avoidance:
  //   • visualViewport.height < layout viewport → keyboard is up
  //   • set --kbd-offset = (innerHeight - visualViewport.height) so the
  //     sheet translateY shifts up by exactly that much (CSS does the work)
  function isPhoneSheet() { return window.matchMedia("(max-width: 640px)").matches; }

  function attachSheetGestures(scrim) {
    const sheet  = scrim.querySelector(".loomus-save-modal");
    const handle = scrim.querySelector("[data-loomus-drag-handle]");

    let startY = 0, lastY = 0, startT = 0, dragging = false, dragLockTransition = false;

    function onStart(y) {
      if (!isPhoneSheet()) return;
      dragging = true; startY = y; lastY = y; startT = performance.now();
      sheet.style.transition = "none";
      dragLockTransition = true;
    }
    function onMove(y) {
      if (!dragging) return;
      const dy = Math.max(0, y - startY);   // only down
      sheet.style.transform = `translateY(${dy}px)`;
      lastY = y;
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      const dy = Math.max(0, lastY - startY);
      const dt = Math.max(1, performance.now() - startT);
      const v  = dy / dt;
      sheet.style.transition = ""; // restore CSS-driven spring
      dragLockTransition = false;
      if (dy > 90 || v > 0.55) {
        closeModal();
      } else {
        sheet.style.transform = ""; // snap back
      }
    }

    // Pointer-capable browsers — one unified path
    const startTargets = [handle];
    startTargets.forEach((el) => {
      if (!el) return;
      el.addEventListener("pointerdown", (e) => {
        try { el.setPointerCapture(e.pointerId); } catch {}
        onStart(e.clientY);
      });
      el.addEventListener("pointermove", (e) => { if (dragging) onMove(e.clientY); });
      el.addEventListener("pointerup",   onEnd);
      el.addEventListener("pointercancel", onEnd);
    });

    // Fallback touch events (older Safari)
    if (handle && !("PointerEvent" in window)) {
      handle.addEventListener("touchstart", (e) => onStart(e.touches[0].clientY), { passive: true });
      handle.addEventListener("touchmove",  (e) => onMove(e.touches[0].clientY),  { passive: true });
      handle.addEventListener("touchend",   onEnd);
    }

    // Keyboard avoidance via visualViewport (iOS Safari, Android Chrome)
    if (window.visualViewport && isPhoneSheet) {
      const vv = window.visualViewport;
      const onVV = () => {
        if (!isPhoneSheet()) { sheet.style.setProperty("--kbd-offset", "0px"); return; }
        const kbd = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        sheet.style.setProperty("--kbd-offset", kbd + "px");
      };
      vv.addEventListener("resize", onVV);
      vv.addEventListener("scroll", onVV);
    }
  }

  // Polite haptic on success (Android; iOS Safari ignores silently).
  function haptic(ms = 15) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch {}
  }

  function openModal(intent) {
    ensureModal();
    const pending = modalEl.querySelector("[data-loomus-pending]");
    if (intent.display_title) {
      pending.innerHTML =
        `<strong>${escapeHtml(intent.display_title)}</strong>` +
        (intent.display_source
          ? ` — ${escapeHtml(intent.display_source)}`
          : "") +
        (intent.note
          ? `, with your note 「${escapeHtml(intent.note.slice(0, 60))}${intent.note.length > 60 ? "…" : ""}」.`
          : ".");
      pending.style.display = "";
    } else {
      pending.style.display = "none";
    }
    // reset states
    modalEl.querySelector("[data-loomus-magic-form]").hidden = false;
    modalEl.querySelector("[data-loomus-success]").hidden = true;
    modalEl.querySelector(".lm-fine").hidden = false;
    const submitBtn = modalEl.querySelector(".lm-submit");
    submitBtn.disabled = false;
    submitBtn.textContent = "Save & send me the link";

    modalEl.dataset.show = "true";
    setTimeout(() => modalEl.querySelector("input[type=email]").focus(), 50);
  }
  function closeModal() {
    if (!modalEl) return;
    // Dismiss soft keyboard before close (collapses visual viewport offset).
    try { modalEl.querySelector("input[type=email]").blur(); } catch {}
    modalEl.dataset.show = "false";
    // Clear any inline transform left over from a swipe-drag — let CSS rule own it.
    const sheet = modalEl.querySelector(".loomus-save-modal");
    if (sheet) {
      sheet.style.transform = "";
      sheet.style.transition = "";
    }
  }

  async function onMagicSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.email.value.trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      form.email.focus();
      form.email.style.borderColor = "#c66b3d";
      return;
    }
    const submit = form.querySelector(".lm-submit");
    submit.disabled = true;
    submit.textContent = "Sending…";

    // pending_save is already written by openModal's caller. Trigger signin.
    try {
      const La = window.LoomusAuth;
      if (!La || typeof La.signIn !== "function") {
        throw new Error("LoomusAuth not loaded");
      }
      const result = await La.signIn(email);
      // signIn() always returns OK for security (silent fail on unknown email).
      // Show success either way.
      form.hidden = true;
      modalEl.querySelector("[data-loomus-success]").hidden = false;
      modalEl.querySelector(".lm-fine").hidden = true;
      haptic(20);   // polite "we got it" tap
      // Blur the email input so iOS dismisses the keyboard immediately,
      // collapsing the visual-viewport offset back to zero.
      try { form.email.blur(); } catch {}
    } catch (err) {
      console.error("loomus-save magic link failed", err);
      submit.disabled = false;
      submit.textContent = "Try again";
    }
  }

  // ─── 7. saved-state cache resolution ────────────────────────────────
  function isAlreadySaved(ref, userId) {
    return readSavedCache(userId).has(ref);
  }

  // ─── 8. core save action ────────────────────────────────────────────
  async function postSave(intent, accessToken) {
    if (!CFG.edgeFnUrl) throw new Error("no edge fn url");
    const resp = await fetch(CFG.edgeFnUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind: intent.kind,
        ref: intent.ref,
        display_title: intent.display_title,
        display_source: intent.display_source,
        source_url: intent.source_url,
        note: intent.note,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      const code = data.error || "save_failed";
      const err = new Error(code);
      err.code = code;
      throw err;
    }
    return data; // {ok, id, just_added|already_saved}
  }

  function intentFromButton(btn) {
    let note = null;
    const noteFrom = btn.getAttribute("data-loomus-save-note-from");
    if (noteFrom) {
      const t = $(noteFrom);
      if (t && typeof t.value === "string") note = t.value.trim() || null;
    }
    return {
      kind:           btn.getAttribute("data-loomus-save-kind"),
      ref:            btn.getAttribute("data-loomus-save-ref"),
      display_title:  btn.getAttribute("data-loomus-save-title") || null,
      display_source: btn.getAttribute("data-loomus-save-source") || null,
      source_url:     btn.getAttribute("data-loomus-save-url")
                      || window.location.href,
      note,
    };
  }

  function setBtnState(btn, state) {
    btn.dataset.state = state;
    if (state === "saved") {
      btn.innerHTML = `${ICON_BOOKMARK_FILL}<span>Saved</span>`;
    } else if (state === "busy") {
      btn.innerHTML = `${ICON_BOOKMARK_OUTLINE}<span>Saving…</span>`;
    } else {
      // default
      const label = btn.getAttribute("data-loomus-save-label")
                   || "Save to my library";
      btn.innerHTML = `${ICON_BOOKMARK_OUTLINE}<span>${escapeHtml(label)}</span>`;
    }
  }

  async function onSaveClick(e) {
    const btn = e.currentTarget;
    e.preventDefault();
    if (btn.dataset.state === "busy") return;

    const intent = intentFromButton(btn);
    if (!intent.kind || !intent.ref) {
      console.warn("loomus-save: button missing kind or ref", btn);
      return;
    }

    const La = window.LoomusAuth;
    if (!La) {
      console.error("loomus-save: LoomusAuth not loaded");
      return;
    }

    const user = (typeof La.getUser === "function") ? La.getUser() : null;
    if (!user) {
      // anon path → write pending, open modal
      writePending({ ...intent, return_to: window.location.href });
      openModal(intent);
      return;
    }

    if (btn.dataset.state === "saved") {
      // already saved — no-op for v1 (unsave is Step 5)
      showToast("Already in your library", { kind: "check", duration: 1600 });
      return;
    }

    setBtnState(btn, "busy");
    try {
      const tokenInfo = La.getAccessToken
  ? await La.getAccessToken()
  : (La.session && La.session().access_token);
      // LoomusAuth's exact method varies; try common shapes:
      const accessToken =
        (typeof tokenInfo === "string" && tokenInfo) ||
        (tokenInfo && tokenInfo.access_token) ||
        (La.client && La.client.auth && (await La.client.auth.getSession()).data?.session?.access_token);
      if (!accessToken) throw new Error("no_session");

      const result = await postSave(intent, accessToken);
      addToSavedCache(user.id, intent.ref);
      setBtnState(btn, "saved");
      // Subtle haptic confirms the save — Android Chrome only; iOS Safari ignores.
      if (!result.already_saved) haptic(18);
      showToast(
        result.already_saved
          ? "Already in your library"
          : "Saved — it's in your library.",
        { kind: "check" }
      );
    } catch (err) {
      console.error("loomus-save click failed", err);
      // Friendly fallback per "no code to users" rule.
      setBtnState(btn, "default");
      showToast(
        err && err.code === "not_signed_in"
          ? "Please sign in to save"
          : "Couldn't save — try again",
        { kind: "check", duration: 2200 }
      );
    }
  }

  // ─── 9. post-signin: consume pending_save ───────────────────────────
  async function consumePending() {
    const pending = readPending();
    if (!pending) return;

    const La = window.LoomusAuth;
    if (!La) return;
    const user = (typeof La.getUser === "function") ? La.getUser() : null;
    if (!user) return; // wait for SIGNED_IN event

    try {
      const tokenInfo = La.getAccessToken
        ? await La.getAccessToken()
        : null;
      const accessToken =
        (typeof tokenInfo === "string" && tokenInfo) ||
        (tokenInfo && tokenInfo.access_token) ||
        (La.client && La.client.auth && (await La.client.auth.getSession()).data?.session?.access_token);
      if (!accessToken) return; // try again on next event

      const result = await postSave(pending, accessToken);
      addToSavedCache(user.id, pending.ref);
      clearPending();

      // Redirect to library with just_added highlight, unless we're already
      // on the save-source page (then just toast).
      const here = window.location.pathname;
      if (!here.startsWith(CFG.LIBRARY_REDIRECT)) {
        const url = new URL(CFG.LIBRARY_REDIRECT, window.location.origin);
        if (result.id) url.searchParams.set("just_added", result.id);
        // Soft delay so the magic-link callback toast (if any) is readable.
        setTimeout(() => { window.location.replace(url.toString()); }, 500);
      } else {
        showToast("Saved — it's in your library.", { kind: "check" });
      }
    } catch (err) {
      console.error("loomus-save consumePending failed", err);
      // Keep the pending entry so the next visit / sign-in can retry.
    }
  }

  // ─── 10. mount + hydrate ────────────────────────────────────────────
  function hydrateButton(btn) {
    if (btn.dataset.loomusSaveBound === "1") return;
    btn.dataset.loomusSaveBound = "1";
    btn.classList.add("loomus-save-btn");

    const La = window.LoomusAuth;
    const user = (La && typeof La.getUser === "function") ? La.getUser() : null;
    const ref = btn.getAttribute("data-loomus-save-ref");
    const already = user && ref && isAlreadySaved(ref, user.id);
    setBtnState(btn, already ? "saved" : "default");

    btn.addEventListener("click", onSaveClick);
  }

  function hydrateAll() {
    document.querySelectorAll("[data-loomus-save]").forEach(hydrateButton);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // ─── 11. public API (in case the page wants to mount programmatically) ──
  window.LoomusSave = {
    hydrateAll,
    hydrateButton,
    save: async (intent) => {
      // Programmatic save — used by e.g. keyboard shortcut handlers.
      const La = window.LoomusAuth;
      if (!La) throw new Error("LoomusAuth not loaded");
      const user = (typeof La.getUser === "function") ? La.getUser() : null;
      if (!user) {
        writePending({ ...intent, return_to: window.location.href });
        openModal(intent);
        return { pending: true };
      }
      const tokenInfo = La.getAccessToken ? await La.getAccessToken() : null;
      const accessToken =
        (typeof tokenInfo === "string" && tokenInfo) ||
        (tokenInfo && tokenInfo.access_token) ||
        (La.client && La.client.auth && (await La.client.auth.getSession()).data?.session?.access_token);
      const result = await postSave(intent, accessToken);
      addToSavedCache(user.id, intent.ref);
      showToast(result.already_saved
        ? "Already in your library"
        : "Saved — it's in your library.",
        { kind: "check" });
      return result;
    },
    isSaved: (ref) => {
      const La = window.LoomusAuth;
      const user = (La && typeof La.getUser === "function") ? La.getUser() : null;
      return user ? isAlreadySaved(ref, user.id) : false;
    },
  };

  // ─── 12. boot ───────────────────────────────────────────────────────
  ready(() => {
    injectCSS();
    hydrateAll();

    // Re-hydrate on dynamic content (graphs panel re-renders on node click).
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches("[data-loomus-save]")) hydrateButton(node);
          if (node.querySelectorAll) {
            node.querySelectorAll("[data-loomus-save]").forEach(hydrateButton);
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Wait for LoomusAuth then wire up the SIGNED_IN listener.
    const wireAuth = () => {
      const La = window.LoomusAuth;
      if (!La || typeof La.onAuthChange !== "function") {
        setTimeout(wireAuth, 100);
        return;
      }
      // hydrate again now that we know the user
      hydrateAll();
      La.onAuthChange((event /* SIGNED_IN | SIGNED_OUT | CACHED | INIT */) => {
        if (event === "SIGNED_IN" || event === "CACHED" || event === "INIT") {
          consumePending();
          hydrateAll();
        } else if (event === "SIGNED_OUT") {
          // No-op — buttons will revert to default on next render via cache.
          hydrateAll();
        }
      });
    };
    wireAuth();
  });

})(window, document);
