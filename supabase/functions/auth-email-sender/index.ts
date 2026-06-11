// =============================================================
// LOOMUS · auth-email-sender — Supabase Auth "Send Email" hook
// ──────────────────────────────────────────────────────────
// Built 2026-06-11 (pre-launch audit P1-3). WHY: auth emails via
// Supabase SMTP showed 0s–3min delivery jitter and zero
// observability. This hook hands every auth email to the Resend
// API directly — same proven path as the watchdog/distill mails
// (observable in resend.com/emails, retryable, branded).
//
// Flow: GoTrue → POST here (standardwebhooks signature) →
//       render v6 dispatch template → Resend API → 200 {}.
// On ANY failure we return 500 so GoTrue falls back to its error
// path (user sees "try again") rather than silently losing mail.
//
// Template: _playbook/PRIVATE/dispatch/auth-otp-email-v6-final.html
// (inlined below; {{ .Token }} → spaced digits, ConfirmationURL
// rebuilt from token_hash).
//
// Required secrets:
//   RESEND_API_KEY          (already set — shared with daily-digest)
//   SEND_EMAIL_HOOK_SECRET  (copy from Dashboard → Auth → Hooks after enabling)
// Enable: Dashboard → Authentication → Hooks → Send Email →
//   HTTPS · https://nfcpqwamlykhggsrcsjb.supabase.co/functions/v1/auth-email-sender
// =============================================================

import { Webhook } from "npm:standardwebhooks@1.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const HOOK_SECRET    = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") ?? "https://nfcpqwamlykhggsrcsjb.supabase.co";
const FROM_ADDRESS   = Deno.env.get("AUTH_FROM_ADDRESS") ?? "LOOMUS <hello@loomus.ai>";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

const SUBJECTS: Record<string, string> = {
  magiclink:      "Your LOOMUS sign-in code",
  signup:         "Confirm your email address",
  recovery:       "Your LOOMUS recovery code",
  email_change:   "Confirm your new email · LOOMUS",
  invite:         "You're invited to LOOMUS",
  reauthentication: "Your LOOMUS confirmation code",
};

function renderEmail(token: string, confirmUrl: string): string {
  const spaced = String(token || "").split("").join(" ");
  return TEMPLATE
    .replaceAll("8 3 6 4 1 9", spaced)
    .replaceAll("{{CONFIRMATION_URL}}", confirmUrl);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const payloadText = await req.text();

  // ── verify standardwebhooks signature (fail closed when secret is set) ──
  let event: any;
  try {
    if (HOOK_SECRET) {
      const wh = new Webhook(HOOK_SECRET.replace(/^v1,whsec_/, ""));
      event = wh.verify(payloadText, {
        "webhook-id":        req.headers.get("webhook-id") ?? "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
        "webhook-signature": req.headers.get("webhook-signature") ?? "",
      });
    } else {
      console.warn("[auth-email-sender] SEND_EMAIL_HOOK_SECRET unset — accepting unverified (bootstrap mode, set it!)");
      event = JSON.parse(payloadText);
    }
  } catch (_e) {
    return json({ error: "invalid signature" }, 401);
  }

  try {
    const user  = event?.user ?? {};
    const ed    = event?.email_data ?? {};
    const email = user?.email;
    const token = ed?.token ?? "";
    const type  = String(ed?.email_action_type ?? "magiclink");
    if (!email || !token) return json({ error: "missing email/token" }, 400);

    const redirectTo = ed?.redirect_to || "https://loomus.ai/";
    const confirmUrl = `${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(ed?.token_hash ?? "")}` +
                       `&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(redirectTo)}`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // CF in front of api.resend.com 403s default/empty UAs (lesson 2026-06-10)
        "User-Agent": "loomus-auth-email-sender/1.0 (+https://loomus.ai)",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: email,
        subject: SUBJECTS[type] ?? SUBJECTS.magiclink,
        html: renderEmail(token, confirmUrl),
        text: `Your LOOMUS code: ${token}\nValid 60 minutes. Enter it at loomus.ai — or ignore this if you didn't request it.`,
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      console.error("[auth-email-sender] resend failed", r.status, body.slice(0, 300));
      return json({ error: "send failed" }, 500);
    }
    const out = await r.json().catch(() => ({}));
    console.log("[auth-email-sender] sent", type, "resend_id:", out?.id ?? "?");
    return json({});
  } catch (e) {
    console.error("[auth-email-sender] error", String((e as Error)?.message || e));
    return json({ error: "internal" }, 500);
  }
});

// ── v6 editorial dispatch template (auth-otp-email-v6-final.html) ──
const TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Dispatch · LOOMUS</title>
</head>
<body style="margin:0;padding:0;background:#e8ddc6;font-family:-apple-system,BlinkMacSystemFont,'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:#e8ddc6;">
  A small dispatch from the margin — your cipher is inside.
</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#e8ddc6;">
  <tr>
    <td align="center" style="padding:40px 16px 56px;">
      <table role="presentation" width="580" cellspacing="0" cellpadding="0" border="0" style="max-width:580px;background:#f5efe4;border-radius:6px;overflow:hidden;box-shadow:0 26px 64px -22px rgba(31,29,24,0.22);">
        <tr><td style="background:#2d4a3e;height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td align="center" style="padding:22px 40px 8px;">
            <p style="margin:0;font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;font-size:9.5px;letter-spacing:0.34em;color:#6b3a4a;text-transform:uppercase;">
              Dispatch &nbsp;·&nbsp; MMXXVI &nbsp;·&nbsp; N&deg;&nbsp;001
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 56px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td style="border-top:1px solid #d4caba;height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:34px 40px 0;">
            <a href="https://loomus.ai" target="_blank" style="text-decoration:none;display:inline-block;">
              <img src="https://loomus.ai/loomus-logo.png" alt="LOOMUS" width="104" height="auto" style="display:block;width:104px;max-width:104px;height:auto;border:0;outline:none;">
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:12px 40px 44px;">
            <p style="margin:0;font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;font-size:9.5px;letter-spacing:0.40em;color:#8b8474;text-transform:uppercase;">
              The library for the AI era
            </p>
          </td>
        </tr>
        <tr>
          <td align="left" style="padding:0 56px 8px;">
            <p style="margin:0;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;font-size:32px;line-height:1.16;letter-spacing:-0.014em;color:#1f1d18;">
              <span style="font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:500;font-size:62px;line-height:0.9;color:#c19a3e;float:left;margin:6px 10px 0 -2px;">W</span>elcome back<br>
              to the margin.
            </p>
          </td>
        </tr>
        <tr>
          <td align="left" style="padding:18px 56px 32px;">
            <p style="margin:0;font-family:'Newsreader',Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;font-size:16px;line-height:1.6;color:#4a463d;">
              A small dispatch. Your cipher waits below &mdash; slip it where you left off, and the library opens.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 40px 12px;">
            <p style="margin:0;font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;font-size:9.5px;letter-spacing:0.34em;color:#6b3a4a;text-transform:uppercase;">
              Your cipher &nbsp;·&nbsp; valid 60 minutes
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 40px 28px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;border-collapse:separate;border-spacing:0;">
              <tr>
                <td style="background:#faf3e3;border:1px solid #2d4a3e;border-top:3px solid #c19a3e;border-radius:3px;padding:26px 42px;box-shadow:0 8px 22px rgba(45,74,62,0.10);">
                  <span style="font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;font-size:40px;line-height:1;letter-spacing:0.16em;color:#1f1d18;white-space:nowrap;">
                    8 3 6 4 1 9
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 56px 8px;">
            <p style="margin:0;font-family:'Newsreader',Georgia,'Times New Roman',serif;font-style:italic;font-size:14px;line-height:1.6;color:#8b8474;">
              On the same device?
              <a href="{{CONFIRMATION_URL}}" target="_blank" style="color:#c66b3d;text-decoration:none;border-bottom:1px solid rgba(198,107,61,0.42);padding-bottom:1px;">Tap here to enter</a>
              without typing.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:42px 56px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td style="border-top:1px solid #d4caba;height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="left" style="padding:28px 56px 0;">
            <p style="margin:0;font-family:'Newsreader',Georgia,'Times New Roman',serif;font-style:italic;font-size:14.5px;line-height:1.7;color:#4a463d;">
              No password to remember.<br>
              Your reading is yours.
            </p>
          </td>
        </tr>
        <tr>
          <td align="left" style="padding:18px 56px 6px;">
            <p style="margin:0;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;font-size:19px;color:#2d4a3e;">
              &mdash; Marginalia
            </p>
          </td>
        </tr>
        <tr>
          <td align="left" style="padding:0 56px 44px;">
            <p style="margin:0;font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;font-size:9px;letter-spacing:0.30em;color:#a99e84;text-transform:uppercase;">
              June &nbsp;·&nbsp; MMXXVI &nbsp;·&nbsp; new dispatch soon
            </p>
          </td>
        </tr>
        <tr><td style="background:#2d4a3e;height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>
      </table>
      <table role="presentation" width="580" cellspacing="0" cellpadding="0" border="0" style="max-width:580px;margin-top:28px;">
        <tr>
          <td align="center" style="padding:0 24px 14px;">
            <a href="https://loomus.ai" target="_blank" style="font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;font-size:11px;letter-spacing:0.32em;color:#4a463d;text-decoration:none;text-transform:uppercase;">
              loomus.ai
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 24px;">
            <p style="margin:0;font-family:'Newsreader',Georgia,'Times New Roman',serif;font-style:italic;font-size:11.5px;line-height:1.55;color:#8b8474;">
              a quiet space in a loud era
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:18px 24px 0;">
            <p style="margin:0;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:10.5px;line-height:1.5;color:#a99e84;">
              Received because someone (hopefully you) requested a sign-in code at <strong style="color:#8b8474;font-weight:500;">loomus.ai</strong>.<br>
              If not, ignore &mdash; no action will be taken.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
