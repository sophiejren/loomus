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
  // Only the supabase session cookie(s) for our project — including the
  // chunked form (name.0, name.1, …) that loomus-auth.js writes when the
  // session JSON exceeds one cookie. Nothing else is touched.
  const re = /(?:^|;\s*)(sb-nfcpqwamlykhggsrcsjb-auth-token(?:\.\d+)?)=([^;]+)/g;
  const setCookies = [];
  let m;
  while ((m = re.exec(cookieHeader)) !== null) {
    // 4096-byte cookie limit guard — never emit a header that would truncate.
    if ((m[1].length + m[2].length) > 3900) continue;
    setCookies.push(
      m[1] + "=" + m[2] +
      "; Domain=.loomus.ai; Path=/; Max-Age=31536000; SameSite=Lax; Secure"
    );
  }
  if (!setCookies.length) return { statusCode: 204, headers: base };
  return {
    statusCode: 204,
    headers: base,
    multiValueHeaders: { "Set-Cookie": setCookies },
  };
};
