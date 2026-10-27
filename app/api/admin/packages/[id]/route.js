import { isAdmin, unauthorized } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function PUT(req, { params }) {
  if (!isAdmin()) return unauthorized();
  const data = await req.json();
  if (!data.name) return Response.json({ error: "Add a package name." }, { status: 400 });
  const { error } = await supabase().from("packages").upsert({ id: params.id, data: { ...data, id: params.id }, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return unauthorized();
  const { error } = await supabase().from("packages").delete().eq("id", params.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
