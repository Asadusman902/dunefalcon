import { getConfig, leadOut } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { pickupEpoch } from "@/lib/booking-rules";
import { notifyCancel } from "@/lib/notify";

export const dynamic = "force-dynamic";

const LIVE = ["new", "contacted", "confirmed"];
const FREE_CANCEL_H = 24;
const fail = (code, msg, status) => Response.json({ code, error: msg }, { status });

// Customer self-cancel: needs the booking reference plus the WhatsApp number it was booked with.
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return fail("bad", "Invalid request.", 400); }

  const ref = String(b.ref ?? "").trim().toUpperCase().slice(0, 20);
  const digits = String(b.phone ?? "").replace(/\D/g, "");
  const notFound = async () => {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return fail("not_found", "We couldn't find an active booking with that reference and number.", 404);
  };
  if (!/^DF-\d{4}-[A-Z0-9]{4}$/.test(ref) || digits.length < 8) return notFound();

  const { data, error } = await supabase().from("leads").select("*").eq("ref", ref).limit(5);
  if (error) {
    console.error("[cancel] lookup failed", error);
    return fail("server", "Something went wrong. Please message us on WhatsApp.", 500);
  }
  // Match on the last 8 digits so "+971 50…" and "050…" both work.
  const row = (data || []).find((r) => String(r.phone || "").replace(/\D/g, "").slice(-8) === digits.slice(-8));
  if (!row) return notFound();
  if (row.status === "cancelled") return fail("already", "This booking is already cancelled.", 409);
  if (!LIVE.includes(row.status)) return notFound();
  if (pickupEpoch(row.date, row.slot_time) - Date.now() < FREE_CANCEL_H * 3600e3) {
    return fail("too_late", "Pickup is less than 24 hours away, so it can't be cancelled online. Please message us on WhatsApp.", 409);
  }

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const notes = [row.notes, `Cancelled by customer online ${stamp} UTC`].filter(Boolean).join("\n");
  const upd = await supabase().from("leads").update({ status: "cancelled", notes }).eq("id", row.id).eq("status", row.status);
  if (upd.error) {
    console.error("[cancel] update failed", upd.error);
    return fail("server", "Something went wrong. Please message us on WhatsApp.", 500);
  }

  const lead = leadOut({ ...row, status: "cancelled", notes });
  const { business } = await getConfig();
  const notified = await notifyCancel(lead, business);
  console.log("[cancel]", ref, notified);
  return Response.json({ ok: true, ref });
}
