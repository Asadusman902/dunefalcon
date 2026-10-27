import { passwordOk, makeToken, COOKIE, cookieOptions } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  if (!passwordOk(password)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  cookies().set(COOKIE, makeToken(), cookieOptions);
  return Response.json({ ok: true });
}
