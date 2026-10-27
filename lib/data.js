import { supabase } from "./supabase";
import { DEFAULT_PACKAGES, DEFAULT_SCHEDULE, DEFAULT_BUSINESS } from "./defaults";

const LIVE = ["new", "contacted", "confirmed"];

export async function getConfig({ includeHidden = false } = {}) {
  const sb = supabase();
  const [pk, st] = await Promise.all([
    sb.from("packages").select("id, data"),
    sb.from("settings").select("key, value"),
  ]);
  if (pk.error) throw pk.error;
  if (st.error) throw st.error;

  let packages = pk.data.length ? pk.data.map((r) => ({ ...r.data, id: r.id })) : DEFAULT_PACKAGES;
  packages = packages.sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!includeHidden) packages = packages.filter((p) => p.active !== false);

  const map = Object.fromEntries(st.data.map((r) => [r.key, r.value]));
  const schedule = { ...DEFAULT_SCHEDULE, ...(map.schedule || {}) };
  const business = { ...DEFAULT_BUSINESS, ...(map.business || {}) };
  return { packages, schedule, business };
}

export async function bookedGuests(date, slot) {
  const { data, error } = await supabase()
    .from("leads")
    .select("adults, kids")
    .eq("date", date)
    .eq("slot", slot)
    .in("status", LIVE);
  if (error) throw error;
  return data.reduce((s, r) => s + (r.adults || 0) + (r.kids || 0), 0);
}

// DB row (snake_case) -> API shape (camelCase)
export function leadOut(r) {
  return {
    _id: r.id, ref: r.ref, createdAt: r.created_at, status: r.status, source: r.source,
    name: r.name, phone: r.phone, email: r.email, country: r.country, pickup: r.pickup, notes: r.notes,
    packageId: r.package_id, packageName: r.package_name, date: r.date, slot: r.slot,
    slotLabel: r.slot_label, slotTime: r.slot_time, adults: r.adults, kids: r.kids,
    addons: r.addons || [], total: Number(r.total) || 0,
  };
}

export function leadIn(l) {
  return {
    ref: l.ref, status: l.status || "new", source: l.source || "Booking page",
    name: l.name, phone: l.phone, email: l.email || null, country: l.country || null,
    pickup: l.pickup || null, notes: l.notes || null,
    package_id: l.packageId, package_name: l.packageName, date: l.date, slot: l.slot,
    slot_label: l.slotLabel, slot_time: l.slotTime, adults: l.adults, kids: l.kids,
    addons: l.addons || [], total: l.total,
  };
}
