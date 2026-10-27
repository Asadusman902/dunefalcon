import { getConfig, bookedGuests, leadIn } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { slotOpen, quote, makeRef } from "@/lib/booking-rules";
import { notifyBooking } from "@/lib/notify";

export const dynamic = "force-dynamic";

const str = (v, max) => String(v ?? "").trim().slice(0, max);
const bad = (msg, status = 400) => Response.json({ error: msg }, { status });

export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return bad("Invalid request."); }

  // Spam trap: real people never fill the hidden "company" field.
  if (b.company) return Response.json({ ok: true, ref: "DF-0000-OK" });

  const name = str(b.name, 80), phone = str(b.phone, 30), email = str(b.email, 120);
  const adults = Math.max(1, Math.min(30, parseInt(b.adults, 10) || 0));
  const kids = Math.max(0, Math.min(30, parseInt(b.kids, 10) || 0));
  const date = str(b.date, 10);
  if (!name) return bad("Add the lead guest's name.");
  if (phone.replace(/\D/g, "").length < 8) return bad("Add a WhatsApp number with country code.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("That email address doesn't look right.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("Choose a date.");

  const { packages, schedule, business } = await getConfig();
  const pkg = packages.find((p) => p.id === b.packageId);
  if (!pkg) return bad("That package isn't available any more. Please refresh the page.");
  const slot = schedule.slots.find((s) => s.id === b.slot);
  if (!slot || ((pkg.slots || []).length && !pkg.slots.includes(slot.id))) return bad("Choose a pickup time for this package.");
  if (!slotOpen(schedule, date, slot)) return bad("That date or pickup time is closed for online booking. Please pick another or message us on WhatsApp.");

  const already = await bookedGuests(date, slot.id);
  if (already + adults + kids > (slot.capacity || 0)) {
    return bad(`Only ${Math.max(0, (slot.capacity || 0) - already)} seats left for that pickup. Choose another date or message us on WhatsApp.`, 409);
  }

  const addonIds = Array.isArray(b.addons) ? b.addons.map(String) : [];
  const q = quote(pkg, adults, kids, addonIds, business.addons || []);

  const lead = {
    ref: makeRef(date), status: "new", source: "Booking page",
    name, phone, email, country: str(b.country, 60), pickup: str(b.pickup, 120), notes: str(b.notes, 600),
    packageId: pkg.id, packageName: pkg.name, date, slot: slot.id, slotLabel: slot.label, slotTime: slot.time,
    adults, kids, addons: q.addonNames, total: q.total,
  };

  const { error } = await supabase().from("leads").insert(leadIn(lead));
  if (error) {
    console.error("[bookings] insert failed", error);
    return bad("We couldn't save your booking. Please message us on WhatsApp.", 500);
  }

  const notified = await notifyBooking(lead, business);
  console.log("[bookings]", lead.ref, notified);

  return Response.json({ ok: true, lead });
}
