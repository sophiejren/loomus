// ═══════════════════════════════════════════════════════════════════════
//  library-save · v3 (NOTES v3.4) · 2026-06-04
//  ────────────────────────────────────────────────────────────────────
//  Deltas from v2:
//    · ALLOWED_KINDS adds 'reflection' and 'cast-trace'
//    · cast-trace items can have NULL note (the spell vanished by design)
//    · accepts `tags` (string[], optional, capped at 8 entries × 40 chars)
//    · after a successful insert, writes structural edges to
//      library_edges (best-effort, never blocks the response):
//        - same-node : new item shares target_ref like 'node:X' with
//                      existing items of this user
//        - same-term : new item shares target_ref like 'term:X' with
//                      existing items of this user
//        - same-book : new item shares the {slug} prefix in ref/target
//      Weights: 1.0 / 0.85 / 0.40 (matches alignment doc).
//      Edges write directed both ways (A↔B = 2 rows) so the nebula
//      query side doesn't need a UNION.
//
//  Backward compatible with v2 callers. New optional fields are tolerant
//  to absence.
//
//  Deploy:
//    cp .../notes-v3-4/02-edge-fn-library-save-v3.ts \
//       supabase/functions/library-save/index.ts
//    npx supabase functions deploy library-save
// ═══════════════════════════════════════════════════════════════════════

import { serve }        from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const ALLOWED_KINDS = new Set([
  "reading", "graph", "node", "note", "quote",
  "reflection", "cast-trace",          // ← v3.4 additions
]);
const ALLOWED_VIS = new Set(["public", "private"]);

const LIMITS = {
  ref:            200,
  target_ref:     200,
  display_title:  200,
  display_source: 200,
  source_url:     500,
  note:           5000,
  tag:            40,
  tags_max:       8,
};

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

function clean(v: unknown, max: number): string | null {
  if (v == null || typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t.slice(0, max);
}

function cleanTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const t of v) {
    const s = clean(t, LIMITS.tag);
    if (s) out.push(s);
    if (out.length >= LIMITS.tags_max) break;
  }
  return out;
}

// Parse "node:X" / "term:X" / "quote:X" / "piece" patterns out of target_ref
function parseAnchor(target_ref: string | null): { kind: string; key: string } | null {
  if (!target_ref) return null;
  const idx = target_ref.indexOf(":");
  if (idx <= 0) return { kind: target_ref, key: "" };  // bare 'piece'
  return { kind: target_ref.slice(0, idx), key: target_ref.slice(idx + 1) };
}

// "{slug}:..." → "{slug}"  (used for same-book edges)
// Per IA §6: book slug can live in EITHER `ref` first segment OR
// inside `target_ref` after a typed prefix. Examples:
//   ref="sapiens:cast:gossip"          → "sapiens"
//   ref="card:sapiens:5"               → null (no slug in first seg)
//   target_ref="card:sapiens:5"        → "sapiens"
//   target_ref="node:sapiens:gossip"   → "sapiens"
//   target_ref="term:predictive-coding"→ null (no book)
function bookSlugOf(ref: string | null, target_ref: string | null = null): string | null {
  // 1) First-segment lookup in ref
  if (ref) {
    const i = ref.indexOf(":");
    if (i > 0) {
      const head = ref.slice(0, i);
      // Reject typed prefixes (they would falsely match across users)
      if (!["card","node","graph","book","term","distill","quote","reading"].includes(head)) {
        return head;
      }
    } else {
      return ref;
    }
  }
  // 2) Typed-prefix lookup in target_ref — for card:/node:/graph:/book:
  if (target_ref) {
    const m = target_ref.match(/^(card|node|graph|book):([^:]+)/);
    if (m) return m[2];
  }
  return null;
}

// Best-effort edge writer. Errors are swallowed (logged) — we never want
// edge bookkeeping to block a successful margin save.
async function writeStructuralEdges(
  supabase: any, user_id: string, newItemId: number,
  ref: string | null, target_ref: string | null,
) {
  try {
    const anchor = parseAnchor(target_ref);
    const bookSlug = bookSlugOf(ref, target_ref);

    // Pull candidate peer items (cap 200 for speed). We pick recent items
    // because nebula edge density should favor recency anyway.
    const { data: peers } = await supabase
      .from("library_items")
      .select("id, ref, target_ref")
      .eq("user_id", user_id)
      .neq("id", newItemId)
      .is("removed_at", null)
      .order("saved_at", { ascending: false })
      .limit(200);
    if (!peers?.length) return;

    const edges: any[] = [];
    for (const p of peers) {
      const pAnchor = parseAnchor(p.target_ref);
      const pBookSlug = bookSlugOf(p.ref, p.target_ref);

      // same-term (strongest): both target_ref = 'term:X' with matching X
      if (anchor && pAnchor &&
          anchor.kind === "term" && pAnchor.kind === "term" &&
          anchor.key && anchor.key === pAnchor.key) {
        edges.push({ user_id, source_id: newItemId, target_id: p.id, kind: "same-term", weight: 1.0 });
        edges.push({ user_id, source_id: p.id, target_id: newItemId, kind: "same-term", weight: 1.0 });
        continue;
      }
      // same-node: both target_ref = 'node:X' with matching X
      if (anchor && pAnchor &&
          anchor.kind === "node" && pAnchor.kind === "node" &&
          anchor.key && anchor.key === pAnchor.key) {
        edges.push({ user_id, source_id: newItemId, target_id: p.id, kind: "same-node", weight: 0.85 });
        edges.push({ user_id, source_id: p.id, target_id: newItemId, kind: "same-node", weight: 0.85 });
        continue;
      }
      // same-book (weakest): same {slug} prefix in ref
      if (bookSlug && pBookSlug && bookSlug === pBookSlug) {
        edges.push({ user_id, source_id: newItemId, target_id: p.id, kind: "same-book", weight: 0.40 });
        edges.push({ user_id, source_id: p.id, target_id: newItemId, kind: "same-book", weight: 0.40 });
      }
    }

    if (!edges.length) return;
    // Insert with on-conflict ignore (unique on (source,target,kind))
    const { error } = await supabase
      .from("library_edges")
      .upsert(edges, { onConflict: "source_id,target_id,kind", ignoreDuplicates: true });
    if (error) console.warn("library_edges upsert warn", error);
  } catch (e) {
    console.warn("writeStructuralEdges threw", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST")    return json({ ok: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL      = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("missing SUPABASE_URL / SUPABASE_ANON_KEY env");
    return json({ ok: false, error: "save_failed" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ ok: false, error: "not_signed_in" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json({ ok: false, error: "not_signed_in" }, 401);
  const user = userData.user;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ ok: false, error: "bad_input" }, 400); }

  // ─── required ────────────────────────────────────────────────────
  const kind = String(body.kind ?? "");
  if (!ALLOWED_KINDS.has(kind))
    return json({ ok: false, error: "bad_input", detail: "kind" }, 400);

  const ref = clean(body.ref, LIMITS.ref);
  if (!ref) return json({ ok: false, error: "bad_input", detail: "ref" }, 400);

  // ─── optional ────────────────────────────────────────────────────
  const display_title  = clean(body.display_title,  LIMITS.display_title);
  const display_source = clean(body.display_source, LIMITS.display_source);
  const source_url     = clean(body.source_url,     LIMITS.source_url);
  const note           = clean(body.note,           LIMITS.note);
  const target_ref     = clean(body.target_ref,     LIMITS.target_ref);
  let   visibility     = typeof body.visibility === "string" ? body.visibility : "public";
  if (!ALLOWED_VIS.has(visibility)) visibility = "public";
  const tags           = cleanTags(body.tags);

  // ─── kind-specific rules ─────────────────────────────────────────
  // cast-trace MUST have target_ref starting with 'term:' AND note=null.
  if (kind === "cast-trace") {
    if (!target_ref || !target_ref.startsWith("term:"))
      return json({ ok: false, error: "bad_input", detail: "cast-trace requires target_ref=term:<slug>" }, 400);
  }
  // reflection should target 'term:' and have note text.
  if (kind === "reflection") {
    if (!target_ref || !target_ref.startsWith("term:"))
      return json({ ok: false, error: "bad_input", detail: "reflection requires target_ref=term:<slug>" }, 400);
    if (!note)
      return json({ ok: false, error: "bad_input", detail: "reflection requires note text" }, 400);
    // auto-tag #yours
    if (!tags.includes("#yours")) tags.push("#yours");
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    kind, ref,
    display_title, display_source, source_url, note,
    visibility, target_ref,
    tags,                                  // v3.4 addition (must exist on table)
  };
  // cast-trace explicitly nulls note (the spell vanishes)
  if (kind === "cast-trace") row.note = null;

  const { data: inserted, error: insertErr } = await supabase
    .from("library_items")
    .insert(row)
    .select("id")
    .single();

  if (insertErr) {
    if ((insertErr as any).code === "23505") {
      const { data: existing } = await supabase
        .from("library_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("ref", ref)
        .is("removed_at", null)
        .maybeSingle();
      if (existing?.id) return json({ ok: true, id: existing.id, already_saved: true });
      const { data: retried, error: retryErr } = await supabase
        .from("library_items").insert(row).select("id").single();
      if (retryErr || !retried) {
        console.error("library-save retry failed", retryErr);
        return json({ ok: false, error: "save_failed" }, 500);
      }
      // Best-effort edges on the retry too
      writeStructuralEdges(supabase, user.id, retried.id, ref, target_ref);
      return json({ ok: true, id: retried.id, just_added: true });
    }
    // 23514 = check_violation. Most common: tags column doesn't exist yet
    // (migration not applied). Surface a clear hint.
    if ((insertErr as any).code === "42703") {
      console.error("library_items.tags column missing — run migration 0004");
      return json({ ok: false, error: "save_failed", detail: "schema_out_of_date" }, 500);
    }
    console.error("library-save insert failed", insertErr);
    return json({ ok: false, error: "save_failed" }, 500);
  }

  // Fire-and-forget edge writing (don't block the response)
  writeStructuralEdges(supabase, user.id, inserted.id, ref, target_ref);

  return json({
    ok: true, id: inserted.id, just_added: true,
    visibility, target_ref, tags,
  });
});
