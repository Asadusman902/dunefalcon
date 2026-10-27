// Dubai is UTC+4 all year (no daylight saving).
const DXB_OFFSET_H = 4;

export function dubaiToday() {
  const d = new Date(Date.now() + DXB_OFFSET_H * 3600e3);
  return d.toISOString().slice(0, 10);
}

export function weekday(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function pickupEpoch(dateKey, time) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, mi] = String(time || "00:00").split(":").map(Number);
  return Date.UTC(y, m - 1, d, h - DXB_OFFSET_H, mi);
}

export function slotOpen(schedule, dateKey, slot) {
  if (!schedule.openDays.includes(weekday(dateKey))) return false;
  if ((schedule.blocked || []).includes(dateKey)) return false;
  return pickupEpoch(dateKey, slot.time) - Date.now() >= (schedule.cutoffHours || 0) * 3600e3;
}

export function quote(pkg, adults, kids, addonIds, addons) {
  const guests = adults + kids;
  const lines = [];
  let total = 0;
  if (pkg.unit === "vehicle") {
    const cars = Math.max(1, Math.ceil(guests / (pkg.maxGuests || 6)));
    total += cars * pkg.price;
    lines.push([`${cars} × vehicle`, cars * pkg.price]);
  } else {
    total += adults * pkg.price;
    lines.push([`${adults} adult(s) × ${pkg.price}`, adults * pkg.price]);
    if (kids) {
      const cp = pkg.childPrice || pkg.price;
      total += kids * cp;
      lines.push([`${kids} child(ren) × ${cp}`, kids * cp]);
    }
  }
  const chosen = addons.filter((a) => addonIds.includes(a.id));
  for (const a of chosen) {
    const n = a.unit === "person" ? guests : 1;
    total += n * a.price;
    lines.push([a.name, n * a.price]);
  }
  return { total, lines, addonNames: chosen.map((a) => a.name) };
}

export function makeRef(dateKey) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return `DF-${dateKey.slice(5).replace("-", "")}-${r}`;
}

export function niceDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}
