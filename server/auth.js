import crypto from "node:crypto";

const COOKIE = "pl_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export const passwordSet = () => !!process.env.APP_PASSWORD;

// The session value is derived from the password, so changing APP_PASSWORD signs everyone out.
function sessionToken() {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  return crypto.createHmac("sha256", pw).update("prompt-library-session-v1").digest("base64url");
}

const digest = s => crypto.createHash("sha256").update(String(s)).digest();

export function checkPassword(input) {
  const pw = process.env.APP_PASSWORD;
  if (!pw || typeof input !== "string") return false;
  return crypto.timingSafeEqual(digest(input), digest(pw));
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function isAuthed(req) {
  const expected = sessionToken();
  const got = readCookie(req, COOKIE);
  if (!expected || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function startSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=${sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
}

export function endSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
