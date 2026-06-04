/* ═══════════════════════════════════════════════════════════════════════
 *  loomus-margin.js · Marginalia thesis client lib · 2026-06-03
 *  ──────────────────────────────────────────────────────────────────────
 *  Deploy to:   https://loomus.ai/loomus-margin.js
 *  Loaded by:   every page that has a [data-loomus-margin] slot
 *  Depends on:  loomus-auth.js, loomus-save.js (for the modal + magic-link
 *               round-trip if user is anonymous)
 *
 *  Usage — drop a slot anywhere the 2-line margin form should appear:
 *
 *    <div data-loomus-margin
 *         data-loomus-margin-target-ref="secret-of-our-success:henrich-cultural-brain"
 *         data-loomus-margin-source="from The Secret of Our Success · Henrich"
 *         data-loomus-margin-url="https://graphs.loomus.ai/secret-of-our-success#henrich"
 *    ></div>
 *
 *  The slot will be HYDRATED into:
 *      ┌─ Quote field (italic, ochre left-rule, your underlined line)
 *      ├─ Reaction field (280-char counter, your take)
 *      ├─ Privacy toggle (🌿 In the margin / 🔒 Just for me, default public)
 *      └─ "Pin to my wall" button
 *
 *  On submit:
 *    · signed-in   → POST /functions/v1/library-save with
 *                    kind='note', ref={target_ref}:{slug(quote)},
 *                    display_title=quote, note=take,
 *                    target_ref=…, visibility=public|private
 *    · anonymous   → write loomus.pending_margin to localStorage, hand off
 *                    to loomus-save.js's magic-link modal. After signin,
 *                    we replay the margin save.
 *
 *  All styling inlined; no external CSS. Mobile-first (44px tap targets,
 *  safe-area inset on submit row, prefers-reduced-motion respect).
 * ═══════════════════════════════════════════════════════════════════════ */

(function (window, document) {
  "use strict";

  const CFG = {
    get supabaseUrl() {
      return (window.LOOMUS_AUTH_CONFIG || {}).supabaseUrl || "";
    },
    get edgeFnUrl() {
      const base = this.supabaseUrl.replace(/\/$/, "");
      return base ? `${base}/functions/v1/library-save` : "";
    },
    PENDING_MARGIN_KEY: "loomus.pending_margin",
    REACTION_MAX: 280,
    TOAST_MS: 2400,
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
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }
  function haptic(ms = 12) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch {}
  }

  // ─── CSS injection ─────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById("loomus-margin-css")) return;
    const css = `
      .loomus-margin-form {
        margin: 18px 0;
        padding-top: 18px;
        border-top: 1px dashed rgba(193,154,62,0.32);
        font-family: 'Inter', -apple-system, sans-serif;
      }
      .loomus-margin-form .lmm-label {
        font-family: 'Geist Mono', 'SF Mono', monospace;
        font-weight: 600; font-size: 10px;
        letter-spacing: 0.22em; text-transform: uppercase;
        color: var(--lmm-accent, #c19a3e);
        margin: 0 0 10px;
      }
      .loomus-margin-form .lmm-label .lmm-helper {
        font-family: 'Newsreader', Georgia, serif;
        font-style: italic; font-weight: 400;
        color: rgba(243,234,212,0.45);
        text-transform: none; letter-spacing: 0;
        font-size: 13px; margin-left: 8px;
      }

      .loomus-margin-form textarea.lmm-quote {
        width: 100%; min-height: 58px; box-sizing: border-box;
        background: rgba(193,154,62,0.06);
        border: none; border-left: 3px solid var(--lmm-accent, #c19a3e);
        padding: 14px 18px;
        font-family: 'Fraunces', Georgia, serif;
        font-style: italic; font-weight: 400;
        font-size: 18px; line-height: 1.4;
        color: var(--lmm-quote-color, #d4ac4a);
        resize: vertical; outline: none;
        margin-bottom: 20px;
        -webkit-appearance: none;
      }
      .loomus-margin-form textarea.lmm-quote::placeholder {
        color: rgba(193,154,62,0.42); font-style: italic;
      }

      .loomus-margin-form textarea.lmm-take {
        width: 100%; min-height: 80px; box-sizing: border-box;
        background: transparent;
        border: 1px solid rgba(243,234,212,0.18);
        border-radius: 4px;
        padding: 14px 16px;
        font-family: 'Newsreader', Georgia, serif;
        font-style: italic;
        font-size: 15px; line-height: 1.5;
        color: var(--lmm-take-color, #f3ead4);
        resize: vertical; outline: none;
        margin-bottom: 6px;
        transition: border-color 0.15s ease;
        -webkit-appearance: none;
      }
      .loomus-margin-form textarea.lmm-take:focus {
        border-color: var(--lmm-accent, #c19a3e);
      }
      .loomus-margin-form textarea.lmm-take::placeholder {
        color: rgba(243,234,212,0.32); font-style: italic;
      }

      .loomus-margin-form .lmm-counter {
        font-family: 'Geist Mono', 'SF Mono', monospace;
        font-weight: 500; font-size: 9.5px;
        letter-spacing: 0.18em;
        color: rgba(243,234,212,0.45);
        text-align: right; margin-bottom: 18px;
      }
      .loomus-margin-form .lmm-counter strong {
        color: var(--lmm-accent, #c19a3e); font-weight: 600;
      }
      .loomus-margin-form .lmm-counter[data-warn="true"] strong {
        color: #c66b3d;
      }

      .loomus-margin-form .lmm-priv-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 14px; padding: 8px 0; margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .loomus-margin-form .lmm-toggle {
        display: inline-flex;
        background: rgba(243,234,212,0.06);
        border-radius: 99px; padding: 4px;
        border: 1px solid rgba(243,234,212,0.10);
      }
      .loomus-margin-form .lmm-toggle button {
        background: transparent; border: none;
        padding: 9px 14px; cursor: pointer;
        font-family: 'Geist Mono', 'SF Mono', monospace;
        font-weight: 600; font-size: 10px;
        letter-spacing: 0.18em; text-transform: uppercase;
        color: rgba(243,234,212,0.45);
        border-radius: 99px;
        display: inline-flex; align-items: center; gap: 6px;
        min-height: 36px;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .loomus-margin-form .lmm-toggle button[aria-pressed="true"][data-vis="public"] {
        background: var(--lmm-accent, #c19a3e); color: #0e0d0a;
      }
      .loomus-margin-form .lmm-toggle button[aria-pressed="true"][data-vis="private"] {
        background: rgba(243,234,212,0.14); color: #f3ead4;
      }
      .loomus-margin-form .lmm-priv-note {
        font-family: 'Newsreader', Georgia, serif;
        font-style: italic; font-size: 13px;
        color: rgba(243,234,212,0.55);
        max-width: 260px; line-height: 1.45;
      }
      .loomus-margin-form .lmm-priv-note em {
        color: var(--lmm-accent, #c19a3e); font-style: italic;
      }

      .loomus-margin-form .lmm-pin {
        display: inline-flex; align-items: center; justify-content: center;
        gap: 10px; width: 100%;
        background: var(--lmm-accent, #c19a3e); color: #0e0d0a;
        border: none;
        padding: 16px 22px;
        border-radius: 99px;
        font-family: 'Geist Mono', 'SF Mono', monospace;
        font-weight: 600; font-size: 11px;
        letter-spacing: 0.22em; text-transform: uppercase;
        cursor: pointer;
        min-height: 48px;
        box-shadow: 0 8px 22px -4px rgba(193,154,62,0.45);
        transition: transform .12s ease, background .2s ease;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .loomus-margin-form .lmm-pin:active { transform: scale(0.98); }
      .loomus-margin-form .lmm-pin:hover  { background: #d4ac4a; }
      .loomus-margin-form .lmm-pin[disabled] {
        opacity: 0.55; cursor: wait;
      }

      .loomus-margin-form[data-state="saved"] {
        padding: 24px 24px;
        background: rgba(193,154,62,0.10);
        border: 1px dashed rgba(193,154,62,0.5);
        border-radius: 6px;
        border-top: 1px dashed rgba(193,154,62,0.5);
        text-align: center;
      }
      .loomus-margin-form[data-state="saved"] > :not(.lmm-saved-msg) { display: none; }
      .loomus-margin-form .lmm-saved-msg {
        font-family: 'Fraunces', Georgia, serif;
        font-style: italic; font-size: 17px;
        color: var(--lmm-quote-color, #d4ac4a);
        line-height: 1.5; margin: 0;
      }
      .loomus-margin-form .lmm-saved-msg em {
        color: var(--lmm-accent, #c19a3e);
      }
      .loomus-margin-form .lmm-saved-msg .lmm-edit {
        display: inline-block; margin-top: 10px;
        font-family: 'Geist Mono', monospace;
        font-size: 10px; letter-spacing: 0.18em;
        text-transform: uppercase; color: rgba(243,234,212,0.55);
        cursor: pointer; background: none; border: none;
        -webkit-tap-highlight-color: transparent;
      }

      /* Mobile pass */
      @media (max-width: 640px) {
        .loomus-margin-form textarea.lmm-quote {
          font-size: 16px;            /* prevents iOS Safari zoom */
        }
        .loomus-margin-form textarea.lmm-take { font-size: 16px; }
        .loomus-margin-form .lmm-priv-row { flex-direction: column; align-items: stretch; }
        .loomus-margin-form .lmm-priv-note { max-width: 100%; }
        .loomus-margin-form .lmm-pin { padding: 18px 22px; min-height: 54px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .loomus-margin-form .lmm-pin { transition: none; }
      }
    `;
    const style = document.createElement("style");
    style.id = "loomus-margin-css";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── slot hydration ────────────────────────────────────────────────
  function hydrateSlot(slot) {
    if (slot.dataset.loomusMarginBound === "1") return;
    slot.dataset.loomusMarginBound = "1";

    const targetRef = slot.getAttribute("data-loomus-margin-target-ref") || "";
    const sourceTxt = slot.getAttribute("data-loomus-margin-source")     || "";
    const sourceUrl = slot.getAttribute("data-loomus-margin-url")        || window.location.href;
    const initialVis = (slot.getAttribute("data-loomus-margin-default-visibility")
                        || "public").toLowerCase();
    const vis0 = initialVis === "private" ? "private" : "public";

    // Render the form
    const form = document.createElement("div");
    form.className = "loomus-margin-form";
    form.innerHTML = `
      <p class="lmm-label">
        The line that hit you
        <span class="lmm-helper">— paste / type it here</span>
      </p>
      <textarea class="lmm-quote" rows="2" maxlength="600"
                placeholder="“…the sentence you stopped on.”"
                inputmode="text" enterkeyhint="next"></textarea>

      <p class="lmm-label">
        Your reaction
        <span class="lmm-helper">— ${CFG.REACTION_MAX} characters, no more</span>
      </p>
      <textarea class="lmm-take" rows="3" maxlength="${CFG.REACTION_MAX}"
                placeholder="One thought, one connection, one disagreement — keep it small."
                inputmode="text" enterkeyhint="done"></textarea>
      <p class="lmm-counter"><strong>0</strong> / ${CFG.REACTION_MAX}</p>

      <div class="lmm-priv-row">
        <div class="lmm-toggle" role="group" aria-label="Margin visibility">
          <button type="button" data-vis="public"
                  aria-pressed="${vis0 === "public"}">🌿&nbsp; In the margin</button>
          <button type="button" data-vis="private"
                  aria-pressed="${vis0 === "private"}">🔒&nbsp; Just for me</button>
        </div>
        <p class="lmm-priv-note" data-loomus-priv-note>
          ${vis0 === "public"
            ? `Public margins live <em>here</em>, anonymously.`
            : `This one's just for you — only you'll see it on your wall.`}
        </p>
      </div>

      <button type="button" class="lmm-pin">📍&nbsp; Pin to my wall</button>

      <p class="lmm-saved-msg" hidden>
        <span data-loomus-saved-text>Saved — <em>it's on your wall.</em></span>
        <br><button type="button" class="lmm-edit" data-loomus-margin-edit>Edit this margin →</button>
      </p>
    `;
    slot.appendChild(form);

    // Wire up
    const quote   = form.querySelector(".lmm-quote");
    const take    = form.querySelector(".lmm-take");
    const counter = form.querySelector(".lmm-counter");
    const toggle  = form.querySelector(".lmm-toggle");
    const privNote = form.querySelector("[data-loomus-priv-note]");
    const pinBtn  = form.querySelector(".lmm-pin");

    let visibility = vis0;

    function updateCounter() {
      const n = take.value.length;
      counter.querySelector("strong").textContent = String(n);
      counter.dataset.warn = (n >= CFG.REACTION_MAX - 20) ? "true" : "false";
    }
    take.addEventListener("input", updateCounter);

    toggle.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-vis]");
      if (!btn) return;
      visibility = btn.getAttribute("data-vis");
      toggle.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      privNote.innerHTML = visibility === "public"
        ? `Public margins live <em>here</em>, anonymously.`
        : `This one's just for you — only you'll see it on your wall.`;
      haptic(8);
    });

    pinBtn.addEventListener("click", async () => {
      const q = quote.value.trim();
      const t = take.value.trim();
      if (!q || q.length < 3) { quote.focus(); return; }
      if (!t || t.length < 3) { take.focus();  return; }

      pinBtn.disabled = true;
      pinBtn.textContent = "Pinning…";

      const intent = {
        kind: "note",
        ref:  (targetRef ? targetRef + ":" : "") + slugify(q.slice(0, 60)),
        target_ref: targetRef || null,
        display_title:  q.slice(0, 200),
        display_source: sourceTxt || null,
        source_url:     sourceUrl,
        note:           t,
        visibility:     visibility,
      };

      try {
        await saveMargin(intent);
        haptic(18);
        form.dataset.state = "saved";
        const msgText = form.querySelector("[data-loomus-saved-text]");
        msgText.innerHTML = visibility === "public"
          ? `Saved — <em>it's on your wall, and in the public margin.</em>`
          : `Saved — <em>it's on your wall, just for you.</em>`;
        form.querySelector(".lmm-saved-msg").hidden = false;
      } catch (err) {
        console.error("loomus-margin pin failed", err);
        if (err && err.code === "anon_pending") {
          // The Save modal opened — clean up our button state and let
          // the magic-link round-trip do the rest. consumePending() in
          // this script picks up after SIGNED_IN.
          pinBtn.disabled = false;
          pinBtn.textContent = "📍  Pin to my wall";
        } else {
          pinBtn.disabled = false;
          pinBtn.textContent = "Try again";
        }
      }
    });

    // Edit (resave) — clear saved state and re-show form
    form.addEventListener("click", (e) => {
      if (!e.target.matches("[data-loomus-margin-edit]")) return;
      form.dataset.state = "";
      pinBtn.disabled = false;
      pinBtn.textContent = "📍  Pin to my wall";
      form.querySelector(".lmm-saved-msg").hidden = true;
      take.focus();
    });

    updateCounter();
  }

  // ─── core save ─────────────────────────────────────────────────────
  async function saveMargin(intent) {
    const La = window.LoomusAuth;
    if (!La) throw new Error("LoomusAuth not loaded");

    const user = (typeof La.getUser === "function") ? La.getUser() : null;

    // Anon path: write pending + open the same magic-link modal Save uses.
    if (!user) {
      try {
        localStorage.setItem(CFG.PENDING_MARGIN_KEY, JSON.stringify({
          ...intent, return_to: window.location.href, at: Date.now(),
        }));
      } catch {}
      if (window.LoomusSave && typeof window.LoomusSave.save === "function") {
        // Reuse the Save modal — it knows how to ask for the email.
        window.LoomusSave.save(intent);
      }
      const e = new Error("anon_pending"); e.code = "anon_pending";
      throw e;
    }

    if (!CFG.edgeFnUrl) throw new Error("no edge fn url");

    const tokenInfo = La.getAccessToken ? await La.getAccessToken() : null;
    const accessToken =
      (typeof tokenInfo === "string" && tokenInfo) ||
      (tokenInfo && tokenInfo.access_token) ||
      (La.client && La.client.auth &&
        (await La.client.auth.getSession()).data?.session?.access_token);
    if (!accessToken) throw new Error("no_session");

    const resp = await fetch(CFG.edgeFnUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(intent),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      const code = data.error || "save_failed";
      const err = new Error(code); err.code = code;
      throw err;
    }
    return data;
  }

  // ─── post-signin: replay any pending margin ───────────────────────
  async function consumePending() {
    let pending;
    try {
      const raw = localStorage.getItem(CFG.PENDING_MARGIN_KEY);
      pending = raw ? JSON.parse(raw) : null;
    } catch { pending = null; }
    if (!pending) return;
    const La = window.LoomusAuth;
    if (!La) return;
    const user = (typeof La.getUser === "function") ? La.getUser() : null;
    if (!user) return;

    try {
      await saveMargin(pending);
      try { localStorage.removeItem(CFG.PENDING_MARGIN_KEY); } catch {}
      // Soft-redirect to wall to show the new card
      const target = "/you/wall";
      if (window.location.pathname !== target) {
        setTimeout(() => { window.location.replace(target); }, 400);
      }
    } catch (err) {
      console.error("loomus-margin consumePending failed", err);
    }
  }

  // ─── boot ──────────────────────────────────────────────────────────
  function hydrateAll() {
    document.querySelectorAll("[data-loomus-margin]").forEach(hydrateSlot);
  }

  ready(() => {
    injectCSS();
    hydrateAll();
    // Dynamic content (e.g. graph node panel re-renders on node click)
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.matches && n.matches("[data-loomus-margin]")) hydrateSlot(n);
          if (n.querySelectorAll) {
            n.querySelectorAll("[data-loomus-margin]").forEach(hydrateSlot);
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });

    // After signin, run consumePending() to replay pending margin
    const wireAuth = () => {
      const La = window.LoomusAuth;
      if (!La || typeof La.onAuthChange !== "function") {
        setTimeout(wireAuth, 100); return;
      }
      consumePending();
      La.onAuthChange((event) => {
        if (event === "SIGNED_IN" || event === "CACHED" || event === "INIT") {
          consumePending();
        }
      });
    };
    wireAuth();
  });

  // Public API for programmatic use
  window.LoomusMargin = {
    hydrateAll, hydrateSlot, save: saveMargin,
  };

})(window, document);
