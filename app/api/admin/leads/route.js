import { isAdmin, unauthorized } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { leadOut, leadIn } from "@/lib/data";
import { makeRef } from "@/lib/booking-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdmin()) return unauthorized();
  const { data, error } = await supabase().from("leads").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ leads: data.map(leadOut) });
}

// Manual lead (WhatsApp / Instagram enquiry entered by staff)
export async function POST(req) {
  if (!isAdmin()) return unauthorized();
  const l = await req.json();
  if (!l.name || !l.packageId || !/^\d{4}-\d{2}-\d{2}$/.test(l.date || "")) {
    return Response.json({ error: "Add a name, package and date." }, { status: 400 });
  }
  const row = leadIn({ ...l, ref: makeRef(l.date), status: "new", addons: l.addons || [] });
  const { data, error } = await supabase().from("leads").insert(row).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ lead: leadOut(data) });
}
