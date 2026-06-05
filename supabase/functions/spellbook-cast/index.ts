// ═══════════════════════════════════════════════════════════════════════
//  spellbook-cast · v0 (stub) · 2026-06-04
//  ────────────────────────────────────────────────────────────────────
//  Endpoint:   POST /spellbook-cast
//  Body:       { term: string, slug: string }
//  Returns:    { ok: true, feynman: string, fp: string, next_at: ISO }
//              { ok: false, error: 'quota_exhausted', next_at: ISO }
//              { ok: false, error: 'not_signed_in' | 'bad_input' | ... }
//
//  Behavior:
//    1. Reject if no auth
//    2. Validate term (2..80 chars)
//    3. Check spellbook_quota for current ISO week. If exists → 429.
//    4. Resolve curated spell text for the term (case-insensitive lookup,
//       with a default fallback that's still useful)
//    5. INSERT cast-trace into library_items (kind='cast-trace',
//       target_ref='term:{slugified}', note=NULL, tags=['#cast'])
//    6. INSERT into spellbook_quota (user, ISO year+week, term)
//    7. Return spell text + next_at = next Monday 00:00 user-local UTC
//
//  v0 vs v3.5:
//    · v0 (this file): CURATED stub library, no LLM call, $0 / cast.
//      Ships the UX, the quota, the cast-trace, the edges. Lets nebula
//      light up immediately.
//    · v3.5: replace SPELLS map with a Sonnet 4.5 call (temp 0.9, both
//      lenses in one response, ~$0.009/cast). Cached by (term, week) so
//      same term in same week serves the same text (deterministic recall).
// ═══════════════════════════════════════════════════════════════════════

import { serve }        from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Slugify a term for stable target_ref (predictive coding → predictive-coding)
function slugify(t: string): string {
  return t.toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// ISO week (year, week) for a given Date (Monday-based, per ISO 8601)
function isoWeek(d: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;          // Mon=0
  target.setUTCDate(target.getUTCDate() - dayNr + 3);   // Thursday of this week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000
                              - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return { year: target.getUTCFullYear(), week };
}

// Next Monday 00:00 UTC after `from`
function nextMondayUTC(from = new Date()): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const dayNr = d.getUTCDay();              // Sun=0..Sat=6
  const daysUntilMon = (8 - dayNr) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMon);
  return d;
}

// ─── Curated spell library (v0) ──────────────────────────────────────
// Hand-written for the picks we know we'll see early. The default
// fallback uses a meta-formula that still says something useful for
// arbitrary terms.
const SPELLS: Record<string, { feynman: string; fp: string }> = {
  "predictive coding": {
    feynman:
      "Imagine the brain as a kid catching a ball — it doesn't see and then move, " +
      "it guesses where the ball will be before it gets there. That guess is the world. " +
      "Reality is only the surprises that contradict it.",
    fp:
      "Three things must be true. One — the brain runs a model, not a sensor stream. " +
      "Two — error, not signal, is the currency. Three — stillness equals confidence. " +
      "Strike any one and the theory falls.",
  },
  "neural reuse": {
    feynman:
      "Think of an old castle — the builders kept adding rooms, but every new room had to " +
      "share walls with the old ones. Brains do the same: language reuses motion circuits, " +
      "math reuses space. Nothing is ever truly new.",
    fp:
      "Three things must be true. One — evolution can't start from scratch, biology re-purposes. " +
      "Two — circuits operate on patterns, not domains. Three — behind every high cognition is " +
      "a low one borrowed. Strike any one and the theory falls.",
  },
  "embodied cognition": {
    feynman:
      "Your body is part of the thinking. Make someone hold a pencil between their teeth — " +
      "forcing a smile — and they'll rate jokes as funnier. The thought needs the muscle. " +
      "Cut the body off, you cut the thought off too.",
    fp:
      "Three things must be true. One — the brain evolved to move, not to compute. Two — sensors " +
      "and effectors are substrate, not periphery. Three — thought without action has no anchor. " +
      "Strike any one and the theory falls.",
  },
  "the great filter": {
    feynman:
      "The galaxy is a long staircase. Most civilizations slip on a step we haven't named yet. " +
      "The question isn't where are they — it's which step are we on, and is it behind us or ahead.",
    fp:
      "Three things must be true. One — life is common or universally lucky. Two — some barrier " +
      "between molecules and starships is brutally selective. Three — the silence in the sky " +
      "implies the filter is not behind us. Strike any one and the theory falls.",
  },
  "attention is all you need": {
    feynman:
      "Old translation models read a sentence word by word, like a kid reading by following their " +
      "finger. Attention says: glance at the whole sentence first, and weigh which other words " +
      "matter for each word you're predicting. The whole picture before any detail.",
    fp:
      "Three things must be true. One — sequence order is data, not architecture. Two — " +
      "every token can attend to every other token in parallel. Three — depth replaces recurrence. " +
      "Strike any one and the theory falls.",
  },
  "scaling laws": {
    feynman:
      "A bigger oven doesn't just cook faster — past a certain size, it cooks things smaller ovens " +
      "literally can't. Scaling laws are the recipe card that tells you which dish unlocks at which " +
      "size. The dish, not the speed, is what matters.",
    fp:
      "Three things must be true. One — loss falls smoothly with compute, data, and parameter count. " +
      "Two — the smooth fall hides abrupt capability jumps. Three — you cannot predict what a model " +
      "can do without scaling it. Strike any one and the theory falls.",
  },
};

const DEFAULT: { feynman: string; fp: string } = {
  feynman:
    "A child asks why the kettle whistles. The answer 'pressure' is too small — the whistle is what " +
    "steam looks like when a small hole forces it to scream. Your concept is the whistle. The " +
    "pressure is the part we usually forget to name.",
  fp:
    "Three things must be true. One — it has a substrate, something physical, something measurable. " +
    "Two — it has a contrast, without which it doesn't mean anything. Three — it has a cost, if it " +
    "were free nature would be drowning in it. Strike any one and the idea collapses.",
};

function spellFor(term: string): { feynman: string; fp: string } {
  const key = term.trim().toLowerCase();
  return SPELLS[key] ?? DEFAULT;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST")    return json({ ok: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL      = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SVC_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SVC_KEY) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ ok: false, error: "not_signed_in" }, 401);

  // User-context client (RLS-bound) — for identity + library_items insert
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  // Service-role client — only used for spellbook_quota insert (no policy)
  const admin = createClient(SUPABASE_URL, SUPABASE_SVC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json({ ok: false, error: "not_signed_in" }, 401);
  const user = userData.user;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad_input" }, 400); }

  const term = String(body.term ?? "").trim();
  if (term.length < 2 || term.length > 80) {
    return json({ ok: false, error: "bad_input", detail: "term length" }, 400);
  }
  const slug = String(body.slug ?? "").trim().slice(0, 80);   // book slug, e.g. 'brief-history-intelligence'

  const now = new Date();
  const { year, week } = isoWeek(now);
  const next_at = nextMondayUTC(now).toISOString();

  // ─── 1. quota check ──────────────────────────────────────────────
  const { data: existing } = await admin
    .from("spellbook_quota")
    .select("term, cast_at")
    .eq("user_id", user.id)
    .eq("iso_year", year)
    .eq("iso_week", week)
    .maybeSingle();

  if (existing) {
    return json({
      ok: false,
      error: "quota_exhausted",
      next_at,
      previous_term: existing.term,
    }, 429);
  }

  // ─── 2. resolve spell (curated for v0, LLM in v3.5) ──────────────
  const spell = spellFor(term);
  const termSlug = slugify(term);
  const targetRef = `term:${termSlug}`;
  const refBookPrefix = slug ? `${slug}:` : "";

  // ─── 3. insert cast-trace into library_items ─────────────────────
  // ref = '{slug}:cast:{term}'  → unique per (user, book, term)
  // target_ref = 'term:{slug}'  → joins with reflection rows for nebula
  const ref = `${refBookPrefix}cast:${termSlug}`;
  const { error: castErr } = await supabase
    .from("library_items")
    .insert({
      user_id: user.id,
      kind: "cast-trace",
      ref,
      target_ref: targetRef,
      visibility: "private",          // cast-traces are private by default
      tags: ["#cast", "#" + termSlug], // term tag lets Atlas dominant_terms surface this
      note: null,                     // the spell is ephemeral by design
    });
  if (castErr && (castErr as any).code !== "23505") {
    console.error("cast-trace insert failed", castErr);
    return json({ ok: false, error: "save_failed" }, 500);
  }

  // ─── 4. consume the weekly quota ─────────────────────────────────
  const { error: quotaErr } = await admin
    .from("spellbook_quota")
    .insert({ user_id: user.id, iso_year: year, iso_week: week, term });
  if (quotaErr) {
    console.error("quota insert failed", quotaErr);
    // Fall through — user got their spell, quota mismatch is a soft error
  }

  return json({
    ok:       true,
    term,
    target_ref: targetRef,
    feynman:  spell.feynman,
    fp:       spell.fp,
    next_at,
    source:   SPELLS[term.toLowerCase()] ? "curated" : "default",
  });
});
