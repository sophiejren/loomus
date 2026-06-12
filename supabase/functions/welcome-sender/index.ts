// welcome-sender · 2026-06-12 · 新手引导 #1(deployed via Supabase MCP v1;本文件为 git 存档真源)
// 每小时(:12)由 pg_cron 调一次:给注册 15min~72h、未收过欢迎信的用户发 welcome dispatch。
// 三扇门:每晨三选 / your space / your star。幂等靠 profiles.welcome_sent_at。
// 配套 migration: welcome_dispatch_infra(welcome_sent_at + get_welcome_batch + mark_welcome_sent)
// cron: jobname 'welcome-sender',模式同 ops-watchdog(net.http_post + X-Cron-Secret)。
// ⚠️ 改信件内容 = 改本文件 + 重新 deploy(supabase functions deploy welcome-sender 或 MCP)。
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

function welcomeHtml(name: string): string {
  const hello = name ? name.split(" ")[0] : "reader";
  return `<!doctype html><html><body style="margin:0;background:#f5efe4;padding:34px 16px;font-family:Georgia,serif;color:#1f1d18">
  <div style="max-width:560px;margin:0 auto;background:#fbf8f1;border:1px solid #e6dcc4;border-radius:16px;overflow:hidden">
    <div style="padding:26px 34px 20px;border-bottom:1px solid #eee4cf">
      <img src="https://loomus.ai/loomus-logo.png" alt="LOOMUS" height="30" style="display:block">
      <div style="font-family:ui-monospace,monospace;font-size:9.5px;letter-spacing:.26em;color:#c19a3e;margin-top:10px">DISPATCH · MMXXVI · WELCOME</div>
    </div>
    <div style="padding:28px 34px 8px">
      <p style="font-style:italic;font-size:21px;line-height:1.4;margin:0 0 14px">Welcome to the library, ${hello}.</p>
      <p style="font-size:15px;line-height:1.65;color:#4a463c;margin:0 0 18px">You arrived through a distillation — but you’ve stepped into something larger: a library for the AI era, free forever, woven in public. Three doors are open to you:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14.5px;line-height:1.6">
        <tr><td style="padding:12px 0;border-top:1px solid #eee4cf"><b style="color:#a87f25">I · Tomorrow’s three picks</b><br><span style="color:#6b6557">Every morning Marginalia chooses a book, a paper, an essay — by taste, not algorithm.</span><br><a href="https://loomus.ai" style="color:#a87f25">see today’s →</a></td></tr>
        <tr><td style="padding:12px 0;border-top:1px solid #eee4cf"><b style="color:#a87f25">II · Your space</b><br><span style="color:#6b6557">Your distillations live at /you — keep a line from one and it becomes your first star.</span><br><a href="https://loomus.ai/you" style="color:#a87f25">open your sky →</a></td></tr>
        <tr><td style="padding:12px 0;border-top:1px solid #eee4cf"><b style="color:#a87f25">III · Your star</b><br><span style="color:#6b6557">Every reader sails under one of eight stars — chosen once, for life. No hurry; the sky keeps your seat.</span><br><a href="https://loomus.ai/you/choosing" style="color:#a87f25">meet the eight →</a></td></tr>
      </table>
      <p style="font-size:13.5px;font-style:italic;color:#6b6557;line-height:1.6;margin:20px 0 4px">One small secret: read your cards again tomorrow. The second pass is where memory sets.</p>
    </div>
    <div style="padding:18px 34px 26px;border-top:1px solid #eee4cf">
      <p style="font-size:13px;color:#6b6557;margin:0">— Sophie, and the LOOMUS Foundation<br><span style="color:#9a917c">A commons, woven in public · write back any time — a person reads every letter.</span></p>
    </div>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: batch, error } = await sb.rpc("get_welcome_batch");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  let sent = 0, failed = 0;
  for (const u of batch ?? []) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "loomus-welcome/1.0" },
        body: JSON.stringify({
          from: "Sophie at LOOMUS <hello@loomus.ai>",
          to: [u.email],
          subject: "Welcome to the library — three doors are open",
          html: welcomeHtml(u.display_name ?? ""),
          text: `Welcome to the library.\n\nI · Tomorrow's three picks — loomus.ai\nII · Your space — loomus.ai/you\nIII · Your star — loomus.ai/you/choosing\n\nOne secret: read your cards again tomorrow — the second pass is where memory sets.\n\n— Sophie`,
        }),
      });
      if (r.ok) { await sb.rpc("mark_welcome_sent", { target: u.uid }); sent++; }
      else { failed++; console.warn("resend fail", u.email, r.status, await r.text()); }
    } catch (e) { failed++; console.warn("send error", u.email, String(e)); }
  }
  return new Response(JSON.stringify({ checked: (batch ?? []).length, sent, failed }), { headers: { "Content-Type": "application/json" } });
});
