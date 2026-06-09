/* ============================================================================
   loomus-interactions.js · v1 · 2026-06-08
   Progressive-enhancement for the shared interaction layer. Adds the
   accessibility + ergonomics the markup was missing, WITHOUT replacing any
   existing page behavior. It observes the page's own nav/menu state instead
   of re-binding clicks, so it can never double-fire or fight inline handlers.
   No-ops gracefully if an element isn't present on a given page.
   ========================================================================= */
(function () {
  "use strict";
  var prefersReduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1 · Skip-to-content link (keyboard a11y) ------------------------- */
  try {
    var main = document.querySelector("main") || document.querySelector("[role=main]");
    if (main && !document.querySelector(".lm-skip")) {
      if (!main.id) main.id = "lm-main";
      var skip = document.createElement("a");
      skip.className = "lm-skip";
      skip.href = "#" + main.id;
      skip.textContent = "Skip to content";
      document.body.insertBefore(skip, document.body.firstChild);
      main.setAttribute("tabindex", "-1");
    }
  } catch (e) {}

  /* ---- 2 · Mobile nav hardening (observe, don't re-bind) ---------------- */
  (function () {
    var toggle = document.getElementById("navToggle");
    var panel  = document.getElementById("navLinks");
    if (!toggle || !panel) return;

    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", panel.id || "navLinks");
    var lastFocus = null;

    function isOpen() { return panel.classList.contains("open"); }

    function sync() {
      var open = isOpen();
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("lm-nav-open", open);
      if (open) {
        lastFocus = document.activeElement;
        var first = panel.querySelector("a, button");
        if (first && !prefersReduced) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
      } else if (lastFocus) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
        lastFocus = null;
      }
    }
    // Mirror the page's own .open toggling into aria + scroll-lock + focus.
    new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ["class"] });

    // Close on Escape and on outside tap (additive — page only closed on link click).
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) { panel.classList.remove("open"); toggle.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (isOpen() && !panel.contains(e.target) && !toggle.contains(e.target)) {
        panel.classList.remove("open");
      }
    });
  })();

  /* ---- 3 · Language menu: reflect open state to AT --------------------- */
  (function () {
    var btn = document.getElementById("langBtn");
    var menu = document.getElementById("langMenu");
    if (!btn || !menu) return;
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    new MutationObserver(function () {
      btn.setAttribute("aria-expanded", menu.classList.contains("open") ? "true" : "false");
    }).observe(menu, { attributes: true, attributeFilter: ["class"] });
    // Roving arrow-key nav inside the language list.
    menu.addEventListener("keydown", function (e) {
      var items = Array.prototype.slice.call(menu.querySelectorAll("a"));
      var i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
      if (e.key === "ArrowUp")   { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
      if (e.key === "Escape")    { menu.classList.remove("open"); btn.focus(); }
    });
  })();

  /* ---- 4 · Horizontal rails: arrow-key + wheel-to-scroll ergonomics ----- */
  Array.prototype.forEach.call(
    document.querySelectorAll(".rail, .scroller, [data-scroll-x]"),
    function (rail) {
      rail.setAttribute("tabindex", rail.getAttribute("tabindex") || "0");
      rail.setAttribute("role", rail.getAttribute("role") || "group");
      rail.addEventListener("keydown", function (e) {
        var step = rail.clientWidth * 0.8;
        if (e.key === "ArrowRight") { e.preventDefault(); rail.scrollBy({ left: step, behavior: prefersReduced ? "auto" : "smooth" }); }
        if (e.key === "ArrowLeft")  { e.preventDefault(); rail.scrollBy({ left: -step, behavior: prefersReduced ? "auto" : "smooth" }); }
      });
    }
  );
})();
