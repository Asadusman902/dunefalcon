import { isAdmin, unauthorized } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function PUT(req, { params }) {
  if (!isAdmin()) return unauthorized();
  if (!["schedule", "business"].includes(params.key)) return Response.json({ error: "Unknown setting." }, { status: 400 });
  const value = await req.json();
  const { error } = await supabase().from("settings").upsert({ key: params.key, value, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
