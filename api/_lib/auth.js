const COOKIE_NAME = "admin_session";

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((acc, item) => {
    const [key, ...rest] = item.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

export function isAuthorized(req) {
  const cookies = parseCookies(req);
  return Boolean(
    process.env.ADMIN_SESSION_SECRET &&
    cookies[COOKIE_NAME] === process.env.ADMIN_SESSION_SECRET
  );
}

export function requireAdmin(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized." });
    return false;
  }
  return true;
}

export function setSessionCookie(res) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(process.env.ADMIN_SESSION_SECRET)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`
  );
}

export function clearSessionCookie(res) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
}
