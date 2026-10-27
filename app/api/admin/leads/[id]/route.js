import { isAdmin, unauthorized } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const STATUSES = ["new", "contacted", "confirmed", "completed", "cancelled"];

export async function PATCH(req, { params }) {
  if (!isAdmin()) return unauthorized();
  const { status } = await req.json();
  if (!STATUSES.includes(status)) return Response.json({ error: "Unknown status." }, { status: 400 });
  const { error } = await supabase().from("leads").update({ status }).eq("id", params.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return unauthorized();
  const { error } = await supabase().from("leads").delete().eq("id", params.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
