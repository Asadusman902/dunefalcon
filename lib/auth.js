import crypto from "crypto";
import { cookies } from "next/headers";

export const COOKIE = "df_admin";
const MAX_AGE_S = 14 * 24 * 3600;

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 24) throw new Error("ADMIN_SESSION_SECRET must be set (24+ characters)");
  return s;
}
function sign(v) {
  return crypto.createHmac("sha256", secret()).update(v).digest("hex");
}
function safeEqual(a, b) {
  const A = crypto.createHash("sha256").update(String(a)).digest();
  const B = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(A, B);
}

export function passwordOk(input) {
  const pw = process.env.ADMIN_PASSWORD;
  return !!pw && safeEqual(input || "", pw);
}

export function makeToken() {
  const exp = String(Date.now() + MAX_AGE_S * 1000);
  return `${exp}.${sign(exp)}`;
}

export function tokenValid(token) {
  if (!token || !token.includes(".")) return false;
  const [exp, sig] = token.split(".");
  if (!safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

export function isAdmin() {
  try {
    return tokenValid(cookies().get(COOKIE)?.value);
  } catch {
    return false;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: MAX_AGE_S,
};

export function unauthorized() {
  return Response.json({ error: "Please log in again." }, { status: 401 });
}
