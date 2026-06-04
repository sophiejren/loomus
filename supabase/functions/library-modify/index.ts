// ═══════════════════════════════════════════════════════════════════════
//  library-modify · 2026-06-03
//  ──────────────────────────────────────────────────────────────────────
//  Sibling to library-save. Handles edit / soft-delete / restore.
//  Contract:
//    POST /functions/v1/library-modify
//    Body: { op: 'update' | 'delete' | 'undelete', id: uuid,
//            fields?: { note?, visibility?, display_title?, target_ref? } }
//
//  Responses:
//    200 { ok: true, op, id, fields? }
//    400 { ok: false, error: 'bad_input' }
//    401 { ok: false, error: 'not_signed_in' }
//    403 { ok: false, error: 'not_owner' }
//    500 { ok: false, error: 'modify_failed' }
//
//  Deploy:
//    cd ~/Documents/Claude/Projects/loomus
//    mkdir -p supabase/functions/library-modify
//    cp .../marginalia-v2/04-edge-fn-library-modify.ts \
//       supabase/functions/library-modify/index.ts
//    npx supabase functions deploy library-modify
// ═══════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const ALLOWED_OPS = new Set(["update", "delete", "undelete"]);
const ALLOWED_VIS = new Set(["public", "private"]);
const LIMITS = { note: 5000, display_title: 200, target_ref: 200 };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST")    return json({ ok: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL      = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("missing SUPABASE_URL / SUPABASE_ANON_KEY");
    return json({ ok: false, error: "modify_failed" }, 500);
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

  const op = String(body.op ?? "");
  if (!ALLOWED_OPS.has(op)) return json({ ok: false, error: "bad_input", detail: "op" }, 400);

  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return json({ ok: false, error: "bad_input", detail: "id" }, 400);

  // First — verify ownership. (RLS would also block, but explicit 403 is friendlier.)
  const { data: owned, error: ownerErr } = await supabase
    .from("library_items").select("id, user_id").eq("id", id).maybeSingle();
  if (ownerErr) {
    console.error("ownership probe failed", ownerErr);
    return json({ ok: false, error: "modify_failed" }, 500);
  }
  if (!owned || owned.user_id !== user.id) {
    return json({ ok: false, error: "not_owner" }, 403);
  }

  // ─── op: update ──────────────────────────────────────────────────
  if (op === "update") {
    const fields = (body.fields || {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};

    if ("note" in fields) {
      patch.note = clean(fields.note, LIMITS.note);
    }
    if ("display_title" in fields) {
      patch.display_title = clean(fields.display_title, LIMITS.display_title);
    }
    if ("target_ref" in fields) {
      patch.target_ref = clean(fields.target_ref, LIMITS.target_ref);
    }
    if ("visibility" in fields) {
      const v = String(fields.visibility);
      if (!ALLOWED_VIS.has(v)) {
        return json({ ok: false, error: "bad_input", detail: "visibility" }, 400);
      }
      patch.visibility = v;
    }

    if (Object.keys(patch).length === 0) {
      return json({ ok: false, error: "bad_input", detail: "fields" }, 400);
    }

    const { error: updErr } = await supabase
      .from("library_items").update(patch).eq("id", id);
    if (updErr) {
      console.error("update failed", updErr);
      return json({ ok: false, error: "modify_failed" }, 500);
    }
    return json({ ok: true, op, id, fields: patch });
  }

  // ─── op: delete (soft) ───────────────────────────────────────────
  if (op === "delete") {
    const { error: delErr } = await supabase
      .from("library_items").update({ removed_at: new Date().toISOString() }).eq("id", id);
    if (delErr) {
      console.error("soft delete failed", delErr);
      return json({ ok: false, error: "modify_failed" }, 500);
    }
    return json({ ok: true, op, id });
  }

  // ─── op: undelete (restore from soft-delete) ─────────────────────
  if (op === "undelete") {
    const { error: udErr } = await supabase
      .from("library_items").update({ removed_at: null }).eq("id", id);
    if (udErr) {
      console.error("undelete failed", udErr);
      return json({ ok: false, error: "modify_failed" }, 500);
    }
    return json({ ok: true, op, id });
  }

  return json({ ok: false, error: "bad_input" }, 400);
});
