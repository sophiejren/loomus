// ═══════════════════════════════════════════════════════════════════
// session-refresh — Auth v2 P1b · Safari ITP cookie extension
// ───────────────────────────────────────────────────────────────────
// WHY: Safari's Intelligent Tracking Prevention caps *script-written*
// cookies (document.cookie) at 7 days, ignoring max-age. Our session
// cookie (sb-…-auth-token, Domain=.loomus.ai) is written by
// loomus-auth.js in JS → Safari users get signed out weekly.
//
// Cookies set by a first-party SERVER response keep their real
// lifetime. This function echoes the session cookie it received back
// to the browser via HTTP Set-Cookie with Max-Age = 1 year.
// loomus-auth.js pings this endpoint (credentials:'include') at most
// once per 12h per device.
//
// SECURITY: we never read, parse, log, or store the token — the value
// goes straight back to the same browser that sent it. No CORS wildcard:
// only *.loomus.ai origins get credentialed responses.
// ═══════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
  const originOk = /^https:\/\/([a-z0-9-]+\.)?loomus\.ai$/.test(origin);
  const base = {
    "Access-Control-Allow-Origin": originOk ? origin : "https://loomus.ai",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: base };
  }
  const cookieHeader = (event.headers && (event.headers.cookie || event.headers.Cookie)) || "";
  // Only the supabase session cookie for our project; nothing else is touched.
  const m = cookieHeader.match(/(?:^|;\s*)(sb-nfcpqwamlykhggsrcsjb-auth-token)=([^;]+)/);
  if (!m) return { statusCode: 204, headers: base };
  const name = m[1];
  const value = m[2]; // still URL-encoded exactly as the browser sent it
  // 4096-byte cookie limit guard — never emit a header that would truncate.
  if ((name.length + value.length) > 3900) return { statusCode: 204, headers: base };
  return {
    statusCode: 204,
    headers: Object.assign({}, base, {
      "Set-Cookie":
        name + "=" + value +
        "; Domain=.loomus.ai; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    }),
  };
};
