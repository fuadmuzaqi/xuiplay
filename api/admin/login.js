import { clearSessionCookie, setSessionCookie } from "../_lib/auth.js";
import { getJsonBody } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const body = getJsonBody(req);
  const accessCode = String(body.accessCode || "").trim();

  if (!process.env.ADMIN_ACCESS_CODE || !process.env.ADMIN_SESSION_SECRET) {
    clearSessionCookie(res);
    res.status(500).json({ error: "Admin env is not configured." });
    return;
  }

  if (!accessCode || accessCode !== process.env.ADMIN_ACCESS_CODE) {
    clearSessionCookie(res);
    res.status(401).json({ error: "Access code salah." });
    return;
  }

  setSessionCookie(res);
  res.status(200).json({ ok: true });
}
