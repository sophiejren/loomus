/* =================================================================
 * LOOMUS account system v0 — client library
 *
 *   Single self-contained module (no build step). Loads
 *   @supabase/supabase-js on demand from esm.sh.
 *
 *   Set keys BEFORE this script loads (any of the three patterns):
 *
 *     1) <script>window.LOOMUS_AUTH_CONFIG = {supabaseUrl, supabaseAnonKey};</script>
 *     2) <script>window.SUPABASE_URL = "https://xxx.supabase.co";
 *                window.SUPABASE_ANON_KEY = "ey...";</script>
 *     3) <script src="loomus-auth.js"></script>
 *        <script>LoomusAuth.init({supabaseUrl, supabaseAnonKey});</script>
 *
 *   Falls back transparently to localStorage-only when keys absent.
 *
 *   localStorage key conventions (preserved from existing surfaces):
 *     loomus.notes.v1.{slug}:{anchor}  →  JSON array [{slug,anchor,ts,text}]
 *     saved:{slug}                      →  "1"
 *     saved:distill:{id}                →  "1"
 *     loomus.reads.v1                   →  JSON array [{slug,surface,ts}]
 *     loomus_synced                     →  "1" once cloud merge done
 * =================================================================*/
;(function (global) {
  "use strict";

  if (global.LoomusAuth) return;          // idempotent — never double-init

  // ── config & state ────────────────────────────────────────────
  var SB_URL  = null;
  var SB_KEY  = null;
  var sb      = null;                       // supabase client (or null)
  var loaded  = false;                      // sdk loaded?
  var cachedUser = null;                    // {id,email} | null
  var listeners  = [];                      // onAuthChange subscribers
  var loadingSdk = null;                    // Promise<sdk> while loading

  var SUPABASE_CDN = "https://esm.sh/@supabase/supabase-js@2";

  // ── v4: tier / usage / events ─────────────────────────────────
  // Per contract account-billing-v4-contract.html §1, §4.
  var TIER_RANK = { reader:0, student:1, scholar:2, patron:3, benefactor:4 };

  // Tier-indexed monthly limits per metric (contract §2.2).
  // null/undefined = not allowed for that tier.
  // Infinity used as the sentinel for "unlimited" (UI can render as ∞).
  var TIER_LIMITS = {
    byo_distill:    { reader:0, student:3,  scholar:5,  patron:30,       benefactor:Infinity },
    byo_graph:      { reader:0, student:1,  scholar:2,  patron:10,       benefactor:Infinity },
    voice_memo:     { reader:0, student:0,  scholar:0,  patron:100,      benefactor:Infinity }, // soft cap
    ask_marginalia: { reader:0, student:0,  scholar:0,  patron:1,        benefactor:Infinity },
    patron_distill: { reader:0, student:0,  scholar:0,  patron:5,        benefactor:Infinity }
  };

  // Stripe Payment Link mapping (contract §7).
  // Two flavors:
  //   - Direct Stripe Payment Links (buy.stripe.com/...) — no edge fn needed.
  //   - /checkout edge function URLs — server creates a Stripe Checkout Session
  //     from a price_id, stamps user_id metadata, then 302-redirects to Stripe.
  // The edge function needs the user's JWT (top-level nav doesn't carry it),
  // so checkoutUrl() appends `?jwt=<access_token>` when one is available.
  var CHECKOUT_BASE = "https://nfcpqwamlykhggsrcsjb.supabase.co/functions/v1/checkout";
  var CHECKOUT_URLS = {
    // Direct Payment Links (live, no server step)
    "patron_monthly":    "https://buy.stripe.com/eVq14obMd3Hx12PfeD6Vq02",
    "gift_oneoff":       "https://buy.stripe.com/dRmeVe03v3Hxh1N4zZ6Vq03",
    "distill_oneoff":    "https://distill.loomus.ai/",  // legacy $3.99 flow
    // Edge-function-mediated (7 Stripe Price IDs)
    "patron_annual":     CHECKOUT_BASE + "?tier=patron&freq=annual",
    "scholar_monthly":   CHECKOUT_BASE + "?tier=scholar&freq=monthly",
    "scholar_annual":    CHECKOUT_BASE + "?tier=scholar&freq=annual",
    "student_monthly":   CHECKOUT_BASE + "?tier=student&freq=monthly",
    "student_annual":    CHECKOUT_BASE + "?tier=student&freq=annual",
    "benefactor_annual": CHECKOUT_BASE + "?tier=benefactor&freq=annual",
    "knowledge_map_oneoff": CHECKOUT_BASE + "?product=knowledge_map"
  };

  // Internal tier/usage state.
  // tier defaults to 'reader' (anonymous + new signups).
  var state = {
    tier: "reader",
    tierUntil: null,
    status: "active",
    usage: {} // metric_key → { count, period_key, fetchedAt }
  };

  // event-bus separate from v0 listeners[]
  var bus = { "tier-changed": [], "usage-changed": [] };
  function fire(evt, payload) {
    var arr = bus[evt] || [];
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](payload); } catch (e) { /* swallow */ }
    }
  }

  function currentPeriodKey() {
    var d = new Date();
    var y = d.getUTCFullYear();
    var m = d.getUTCMonth() + 1;
    return y + "-" + (m < 10 ? "0" + m : m);
  }

  // First day of next UTC month → ISO; used for resets_at convenience.
  function nextPeriodResetIso() {
    var d = new Date();
    var y = d.getUTCFullYear();
    var m = d.getUTCMonth() + 1;
    if (m === 12) { y += 1; m = 1; } else { m += 1; }
    return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString();
  }

  // ── tiny utilities ────────────────────────────────────────────
  function safeLS(op, key, val) {
    try {
      if (op === "get")  return localStorage.getItem(key);
      if (op === "set")  return localStorage.setItem(key, val);
      if (op === "del")  return localStorage.removeItem(key);
      if (op === "keys") return Object.keys(localStorage);
    } catch (e) { return null; }
  }
  function emit(evt) {
    try { listeners.forEach(function (cb) { cb(evt, cachedUser); }); } catch (e) {}
  }
  function isConfigured() { return !!(SB_URL && SB_KEY && SB_KEY.length > 20); }

  // Load Supabase SDK from CDN; returns Promise<sdk module>
  function loadSdk() {
    if (loaded) return Promise.resolve(global.__supabaseJs);
    if (loadingSdk) return loadingSdk;
    if (!isConfigured()) return Promise.resolve(null);
    loadingSdk = import(SUPABASE_CDN).then(function (mod) {
      loaded = true;
      global.__supabaseJs = mod;
      sb = mod.createClient(SB_URL, SB_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      // Surface session changes
      sb.auth.onAuthStateChange(function (event, session) {
        cachedUser = session && session.user
          ? { id: session.user.id, email: session.user.email }
          : null;
        if (cachedUser && safeLS("get", "loomus_synced") !== "1") {
          // First time signing in on this device → fire sync once
          LoomusAuth.syncLocalToCloud().catch(function () {});
        }
        // v4: refresh tier on sign-in; reset to 'reader' on sign-out
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          LoomusAuth.refreshTier().catch(function () {});
        } else if (event === "SIGNED_OUT") {
          var prev = state.tier;
          state.tier = "reader"; state.tierUntil = null; state.status = "active";
          state.usage = {};
          if (prev !== "reader") fire("tier-changed", { tier: "reader" });
        }
        emit(event);
      });
      // Pull initial session
      return sb.auth.getSession().then(function (r) {
        var s = r && r.data && r.data.session;
        cachedUser = s && s.user ? { id: s.user.id, email: s.user.email } : null;
        // v4: prime tier from server when we boot up signed-in
        if (cachedUser) LoomusAuth.refreshTier().catch(function () {});
        emit("INIT");
        return mod;
      });
    }).catch(function (e) {
      console.warn("[LoomusAuth] SDK load failed; staying anonymous", e);
      loaded = false;
      return null;
    });
    return loadingSdk;
  }

  // ── PUBLIC API ────────────────────────────────────────────────
  var LoomusAuth = {

    // ── init ────────────────────────────────────────────────────
    init: function (opts) {
      opts = opts || global.LOOMUS_AUTH_CONFIG || {};
      SB_URL = opts.supabaseUrl  || global.SUPABASE_URL  || null;
      SB_KEY = opts.supabaseAnonKey || global.SUPABASE_ANON_KEY || null;
      if (!isConfigured()) {
        // Surfaces still render — just no cloud
        emit("INIT");
        return Promise.resolve(false);
      }
      return loadSdk().then(function () { return true; });
    },

    // ── auth ────────────────────────────────────────────────────
    signIn: function (email) {
      if (!isConfigured()) {
        return Promise.resolve({ ok: false, error: "not_configured" });
      }
      // v4 rough-edge #4: save the current page so /auth/callback can resume.
      // One save here propagates to every surface (marginalia · library · books ·
      // graphs · distill · /you). Cleared by callback handler after redirect.
      try {
        if (global.location && global.location.href) {
          safeLS("set", "loomus_resume_url", global.location.href);
        }
      } catch (e) {}
      return loadSdk().then(function () {
        return sb.auth.signInWithOtp({
          email: email,
          options: {
            emailRedirectTo: (global.location && global.location.origin)
              ? global.location.origin + "/auth/callback"
              : undefined,
          },
        }).then(function (res) {
          if (res.error) return { ok: false, error: res.error.message };
          return { ok: true };
        });
      });
    },

    getUser: function () { return cachedUser; },

    signOut: function () {
      if (!sb) return Promise.resolve();
      return sb.auth.signOut().then(function () {
        cachedUser = null;
        emit("SIGNED_OUT");
      });
    },

    onAuthChange: function (cb) {
      if (typeof cb !== "function") return function () {};
      listeners.push(cb);
      // fire immediately with current state
      try { cb("CACHED", cachedUser); } catch (e) {}
      return function () {
        listeners = listeners.filter(function (l) { return l !== cb; });
      };
    },

    // ── notes ───────────────────────────────────────────────────
    saveNote: function (note) {
      var slug   = note.slug;
      var anchor = note.anchor || "piece";
      var text   = note.text || "";
      var ts     = note.ts || Date.now();
      // Always mirror to localStorage (so /you offline works)
      var lkey = "loomus.notes.v1." + slug + ":" + anchor;
      var arr  = [];
      try { arr = JSON.parse(safeLS("get", lkey) || "[]"); } catch (e) {}
      if (anchor === "piece") {
        arr.push({ slug: slug, anchor: anchor, ts: ts, text: text });
      } else {
        // single note per anchor — replace
        arr = [{ slug: slug, anchor: anchor, ts: ts, text: text }];
      }
      safeLS("set", lkey, JSON.stringify(arr));

      if (!cachedUser || !sb) return Promise.resolve({ ok: true, where: "local" });
      var row = {
        user_id: cachedUser.id, slug: slug, anchor: anchor, text: text,
        updated_at: new Date(ts).toISOString(),
      };
      if (anchor === "piece") {
        return sb.from("notes").insert(row).then(function (r) {
          return { ok: !r.error, where: r.error ? "local" : "cloud", error: r.error };
        });
      }
      return sb.from("notes")
        .upsert(row, { onConflict: "user_id,slug,anchor" })
        .then(function (r) {
          return { ok: !r.error, where: r.error ? "local" : "cloud", error: r.error };
        });
    },

    getNotes: function (slug) {
      // Merge cloud + local; cloud wins on conflict (id-based dedup).
      var local = [];
      var keys = safeLS("keys") || [];
      keys.forEach(function (k) {
        if (k.indexOf("loomus.notes.v1." + slug + ":") === 0) {
          try { local = local.concat(JSON.parse(safeLS("get", k) || "[]")); } catch (e) {}
        }
      });
      if (!cachedUser || !sb) return Promise.resolve(local);
      return sb.from("notes").select("*").eq("slug", slug)
        .order("created_at", { ascending: false })
        .then(function (r) {
          if (r.error) return local;
          var cloud = (r.data || []).map(function (n) {
            return { id: n.id, slug: n.slug, anchor: n.anchor, text: n.text,
                     ts: +new Date(n.created_at) };
          });
          // dedup by (anchor + text + ts within 2s)
          var seen = {};
          var out  = [];
          cloud.concat(local).forEach(function (n) {
            var key = n.anchor + "|" + n.text + "|" + Math.floor((n.ts || 0)/2000);
            if (!seen[key]) { seen[key] = true; out.push(n); }
          });
          out.sort(function (a,b) { return (b.ts||0) - (a.ts||0); });
          return out;
        });
    },

    deleteNote: function (id) {
      if (!cachedUser || !sb || !id) return Promise.resolve({ ok: false });
      return sb.from("notes").delete().eq("id", id).then(function (r) {
        return { ok: !r.error, error: r.error };
      });
    },

    // ── saves (library) ─────────────────────────────────────────
    saveSave: function (s) {
      var slug    = s.slug;
      var surface = s.surface || "piece";
      var ts      = s.ts || Date.now();
      // Always mirror to localStorage (book pages already read this format)
      var lkey = surface === "book" ? "saved:" + slug
               : surface === "distill" ? "saved:distill:" + slug
               : "saved:" + surface + ":" + slug;
      safeLS("set", lkey, "1");

      if (!cachedUser || !sb) return Promise.resolve({ ok: true, where: "local" });
      return sb.from("saves").upsert({
        user_id: cachedUser.id, slug: slug, surface: surface,
        saved_at: new Date(ts).toISOString(),
      }, { onConflict: "user_id,slug,surface", ignoreDuplicates: true })
        .then(function (r) {
          return { ok: !r.error, where: r.error ? "local" : "cloud", error: r.error };
        });
    },

    removeSave: function (s) {
      var slug    = s.slug;
      var surface = s.surface || "piece";
      var lkey = surface === "book" ? "saved:" + slug
               : surface === "distill" ? "saved:distill:" + slug
               : "saved:" + surface + ":" + slug;
      safeLS("del", lkey);
      if (!cachedUser || !sb) return Promise.resolve({ ok: true });
      return sb.from("saves").delete()
        .eq("user_id", cachedUser.id).eq("slug", slug).eq("surface", surface)
        .then(function (r) { return { ok: !r.error, error: r.error }; });
    },

    getSaves: function () {
      // Aggregate local + cloud
      var local = [];
      (safeLS("keys") || []).forEach(function (k) {
        if (k.indexOf("saved:") !== 0) return;
        if (safeLS("get", k) !== "1") return;
        var rest = k.slice("saved:".length);
        var surface = "book", slug = rest;
        if (rest.indexOf("distill:") === 0) { surface = "distill"; slug = rest.slice("distill:".length); }
        else if (rest.indexOf("graph:") === 0) { surface = "graph"; slug = rest.slice("graph:".length); }
        else if (rest.indexOf("piece:") === 0) { surface = "piece"; slug = rest.slice("piece:".length); }
        local.push({ slug: slug, surface: surface, ts: 0 });
      });
      if (!cachedUser || !sb) return Promise.resolve(local);
      return sb.from("saves").select("*")
        .order("saved_at", { ascending: false })
        .then(function (r) {
          if (r.error) return local;
          var cloud = (r.data || []).map(function (s) {
            return { slug: s.slug, surface: s.surface, ts: +new Date(s.saved_at) };
          });
          var seen = {};
          var out  = [];
          cloud.concat(local).forEach(function (s) {
            var k = s.surface + "|" + s.slug;
            if (!seen[k]) { seen[k] = true; out.push(s); }
          });
          return out;
        });
    },

    // ── reads (history) ─────────────────────────────────────────
    markRead: function (r) {
      var slug    = r.slug;
      var surface = r.surface || "piece";
      var ts      = r.ts || Date.now();
      // local append (cap at 200 to stay polite)
      var arr = [];
      try { arr = JSON.parse(safeLS("get", "loomus.reads.v1") || "[]"); } catch (e) {}
      arr.push({ slug: slug, surface: surface, ts: ts });
      if (arr.length > 200) arr = arr.slice(-200);
      safeLS("set", "loomus.reads.v1", JSON.stringify(arr));
      if (!cachedUser || !sb) return Promise.resolve({ ok: true, where: "local" });
      return sb.from("reads").insert({
        user_id: cachedUser.id, slug: slug, surface: surface,
        read_at: new Date(ts).toISOString(),
      }).then(function (res) {
        return { ok: !res.error, where: res.error ? "local" : "cloud", error: res.error };
      });
    },

    // ── sync ────────────────────────────────────────────────────
    syncLocalToCloud: function () {
      if (!cachedUser || !sb) return Promise.resolve({ ok: false, error: "not_signed_in" });
      if (safeLS("get", "loomus_synced") === "1") {
        return Promise.resolve({ ok: true, skipped: true });
      }
      // Scrape localStorage
      var notes = [];
      var saves = [];
      var reads = [];
      (safeLS("keys") || []).forEach(function (k) {
        if (k.indexOf("loomus.notes.v1.") === 0) {
          // key shape: loomus.notes.v1.{slug}:{anchor}
          var rest = k.slice("loomus.notes.v1.".length);
          var ix   = rest.lastIndexOf(":");
          var slug   = ix > 0 ? rest.slice(0, ix) : rest;
          var anchor = ix > 0 ? rest.slice(ix + 1) : "piece";
          var raw = safeLS("get", k);
          try {
            var arr = JSON.parse(raw || "[]");
            arr.forEach(function (n) {
              if (!n || !n.text) return;
              notes.push({
                slug: n.slug || slug, anchor: n.anchor || anchor,
                text: n.text, ts: n.ts || Date.now(),
              });
            });
          } catch (e) {}
        } else if (k.indexOf("saved:") === 0) {
          if (safeLS("get", k) !== "1") return;
          var rest2 = k.slice("saved:".length);
          var surface = "book", slug2 = rest2;
          if (rest2.indexOf("distill:") === 0) { surface = "distill"; slug2 = rest2.slice("distill:".length); }
          else if (rest2.indexOf("graph:") === 0) { surface = "graph"; slug2 = rest2.slice("graph:".length); }
          else if (rest2.indexOf("piece:") === 0) { surface = "piece"; slug2 = rest2.slice("piece:".length); }
          saves.push({ slug: slug2, surface: surface, ts: Date.now() });
        }
      });
      try {
        var ra = JSON.parse(safeLS("get", "loomus.reads.v1") || "[]");
        ra.forEach(function (r) {
          if (r && r.slug && r.surface) reads.push({ slug: r.slug, surface: r.surface, ts: r.ts || Date.now() });
        });
      } catch (e) {}

      if (!notes.length && !saves.length && !reads.length) {
        safeLS("set", "loomus_synced", "1");
        return Promise.resolve({ ok: true, merged: { notes: 0, saves: 0, reads: 0 } });
      }

      return sb.auth.getSession().then(function (sr) {
        var token = sr && sr.data && sr.data.session && sr.data.session.access_token;
        if (!token) return { ok: false, error: "no_token" };
        return fetch(SB_URL + "/functions/v1/sync", {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": "Bearer " + token,
            "apikey":         SB_KEY,
          },
          body: JSON.stringify({ notes: notes, saves: saves, reads: reads }),
        }).then(function (resp) { return resp.json(); }).then(function (out) {
          if (out && out.ok) safeLS("set", "loomus_synced", "1");
          return out;
        }).catch(function (e) { return { ok: false, error: String(e) }; });
      });
    },

    // ── /you aggregate ──────────────────────────────────────────
    getMyLibrary: function () {
      if (!cachedUser || !sb) {
        return Promise.all([this.getNotesAll(), this.getSaves()])
          .then(function (parts) {
            return { user: null, notes: parts[0], saves: parts[1], reads: [] };
          });
      }
      var p1 = sb.from("notes").select("*").order("created_at", { ascending: false });
      var p2 = sb.from("saves").select("*").order("saved_at",   { ascending: false });
      var p3 = sb.from("reads").select("*").order("read_at",    { ascending: false }).limit(50);
      var self = this;
      return Promise.all([p1, p2, p3]).then(function (rs) {
        return {
          user:  cachedUser,
          notes: (rs[0].data || []).map(function (n) {
                   return { id: n.id, slug: n.slug, anchor: n.anchor, text: n.text, ts: +new Date(n.created_at) };
                 }),
          saves: (rs[1].data || []).map(function (s) {
                   return { slug: s.slug, surface: s.surface, ts: +new Date(s.saved_at) };
                 }),
          reads: (rs[2].data || []).map(function (r) {
                   return { slug: r.slug, surface: r.surface, ts: +new Date(r.read_at) };
                 }),
        };
      }).catch(function () {
        return self.getMyLibraryLocal();
      });
    },

    // Helper — aggregate all local notes across slugs
    getNotesAll: function () {
      var out = [];
      (safeLS("keys") || []).forEach(function (k) {
        if (k.indexOf("loomus.notes.v1.") !== 0) return;
        try {
          var arr = JSON.parse(safeLS("get", k) || "[]");
          out = out.concat(arr);
        } catch (e) {}
      });
      out.sort(function (a, b) { return (b.ts||0) - (a.ts||0); });
      return Promise.resolve(out);
    },

    getMyLibraryLocal: function () {
      var self = this;
      return Promise.all([self.getNotesAll(), self.getSaves()])
        .then(function (p) { return { user: null, notes: p[0], saves: p[1], reads: [] }; });
    },

    // ── status helpers used by chrome ───────────────────────────
    isConfigured: function () { return isConfigured(); },

    // =================================================================
    // v4: tier / usage / billing
    // Contract: account-billing-v4-contract.html §1, §4
    // =================================================================

    // sync · returns current cached tier (defaults 'reader' when anon or pre-init)
    getTier: function () {
      return state.tier || "reader";
    },

    // sync · soft check used by UI gating. true ⇔ current tier ≥ min.
    requireTier: function (min) {
      var have = TIER_RANK[state.tier] != null ? TIER_RANK[state.tier] : 0;
      var need = TIER_RANK[min] != null ? TIER_RANK[min] : 0;
      return have >= need;
    },

    // async · re-fetch effective tier from server (tier_effective view).
    // Fires 'tier-changed' if the tier actually changes.
    refreshTier: function () {
      if (!cachedUser || !sb) {
        var prev0 = state.tier;
        state.tier = "reader"; state.tierUntil = null; state.status = "active";
        if (prev0 !== "reader") fire("tier-changed", { tier: "reader" });
        return Promise.resolve("reader");
      }
      return sb.from("tier_effective")
        .select("tier,tier_until,status")
        .eq("user_id", cachedUser.id)
        .maybeSingle()
        .then(function (r) {
          var prev = state.tier;
          if (r && r.data && r.data.tier) {
            state.tier      = r.data.tier;
            state.tierUntil = r.data.tier_until || null;
            state.status    = r.data.status || "active";
          } else {
            // no row → reader
            state.tier      = "reader";
            state.tierUntil = null;
            state.status    = "active";
          }
          if (prev !== state.tier) {
            fire("tier-changed", { tier: state.tier, tier_until: state.tierUntil, status: state.status });
          }
          return state.tier;
        })
        .catch(function () { return state.tier; });
    },

    // async · current-period usage for a metric.
    // Returns { count, limit, period_key, resets_at, metric }.
    // 'limit' is computed from TIER_LIMITS[metric][currentTier].
    // Anonymous users get { count: 0, limit: 0 }.
    getUsage: function (metric) {
      var tier   = state.tier || "reader";
      var pk     = currentPeriodKey();
      var resets = nextPeriodResetIso();
      var limTbl = TIER_LIMITS[metric] || {};
      var limit  = (limTbl[tier] != null) ? limTbl[tier] : 0;

      if (!cachedUser || !sb) {
        return Promise.resolve({
          metric: metric, count: 0, limit: limit,
          period_key: pk, resets_at: resets
        });
      }
      return sb.from("usage")
        .select("count,period_key,updated_at")
        .eq("user_id", cachedUser.id)
        .eq("metric_key", metric)
        .eq("period_key", pk)
        .maybeSingle()
        .then(function (r) {
          var count = (r && r.data && typeof r.data.count === "number") ? r.data.count : 0;
          // cache + fire usage-changed if count moved
          var prev = state.usage[metric] && state.usage[metric].count;
          state.usage[metric] = { count: count, period_key: pk, fetchedAt: Date.now() };
          if (prev !== count) fire("usage-changed", { metric: metric, count: count, limit: limit, period_key: pk });
          return { metric: metric, count: count, limit: limit, period_key: pk, resets_at: resets };
        })
        .catch(function () {
          return { metric: metric, count: 0, limit: limit, period_key: pk, resets_at: resets };
        });
    },

    // sync · returns a checkout URL.
    // freq: 'monthly' | 'annual' for subs; 'oneoff' for one-off products.
    //
    // Returns either:
    //   - A direct Stripe Payment Link (buy.stripe.com/...), navigate as-is.
    //   - A /checkout edge function URL — we append ?jwt=<access_token> so
    //     the server can resolve user_id (top-level nav drops the
    //     Authorization header). If no session is loaded yet, we still
    //     return the URL; the edge fn will redirect to sign-in.
    checkoutUrl: function (tier, freq) {
      // normalize 'month'/'year' synonyms
      if (freq === "month") freq = "monthly";
      if (freq === "year")  freq = "annual";
      // benefactor is annual-only; default freq if caller omits
      if (tier === "benefactor" && !freq) freq = "annual";
      // one-off shorthand: caller may pass tier='knowledge_map' or 'gift' or 'distill'
      if (!freq && (tier === "knowledge_map" || tier === "gift" || tier === "distill")) {
        freq = "oneoff";
      }
      var key = tier + "_" + freq;
      var url = CHECKOUT_URLS[key];
      // Fallback: unknown combo → route through edge fn anyway (it'll 400)
      if (!url) url = CHECKOUT_BASE + "?tier=" + encodeURIComponent(tier) + "&freq=" + encodeURIComponent(freq || "");
      // For edge-fn URLs, append jwt so the server can identify the user.
      // (top-level navigation strips the Authorization header).
      if (url.indexOf(CHECKOUT_BASE) === 0) {
        var jwt = null;
        // Try Supabase client session first (cached in memory).
        try {
          if (sb && sb.auth && typeof sb.auth.getSession === "function") {
            // getSession() is async-but-also-sync-from-cache; read internal storage.
            // Fall through to localStorage if not available synchronously.
          }
        } catch (_) {}
        // Reliable sync read: pull access_token from localStorage where supabase-js stores it.
        if (!jwt) {
          try {
            var ref = (SB_URL || "").replace(/^https?:\/\//, "").split(".")[0];
            var raw = global.localStorage && global.localStorage.getItem("sb-" + ref + "-auth-token");
            if (raw) {
              var tok = JSON.parse(raw);
              jwt = tok && tok.access_token ? tok.access_token : null;
            }
          } catch (_) {}
        }
        if (jwt) url += "&jwt=" + encodeURIComponent(jwt);
      }
      return url;
    },

    // event subscriber.
    //   evt: 'tier-changed' | 'usage-changed'
    //   cb : function(payload) {}
    // returns an unsubscribe function.
    on: function (evt, cb) {
      if (typeof cb !== "function") return function () {};
      if (!bus[evt]) bus[evt] = [];
      bus[evt].push(cb);
      return function () {
        bus[evt] = (bus[evt] || []).filter(function (l) { return l !== cb; });
      };
    }
  };

  global.LoomusAuth = LoomusAuth;

  // Auto-init if config was set before us loading.
  if (global.LOOMUS_AUTH_CONFIG || global.SUPABASE_URL) {
    try { LoomusAuth.init(); } catch (e) {}
  } else {
    // Still fire INIT once so listeners know we're alive
    setTimeout(function () { emit("INIT"); }, 0);
  }
})(typeof window !== "undefined" ? window : this);
