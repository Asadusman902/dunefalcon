import { niceDate } from "./booking-rules";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n, cur) => `${cur || "AED"} ${Math.round(n).toLocaleString("en-US")}`;

function rows(lead, business) {
  return [
    ["Reference", lead.ref],
    ["Package", lead.packageName],
    ["Date", niceDate(lead.date)],
    ["Pickup", `${lead.slotLabel} · ${lead.slotTime}`],
    ["Guests", `${lead.adults} adults, ${lead.kids} children`],
    ["Add-ons", lead.addons.length ? lead.addons.join(", ") : "None"],
    ["Hotel / area", lead.pickup || "—"],
    ["Name", lead.name],
    ["WhatsApp", lead.phone],
    ["Email", lead.email || "—"],
    ["Country", lead.country || "—"],
    ["Notes", lead.notes || "—"],
    ["Total (pay at pickup)", money(lead.total, business.currency)],
  ];
}

function emailHtml(title, intro, lead, business, footer) {
  const tr = rows(lead, business)
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#6d6070;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>`)
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#23192c">
  <div style="background:#16121d;color:#dfb062;padding:18px 22px;font-size:18px;letter-spacing:2px">DUNE FALCON DUBAI</div>
  <div style="padding:22px;border:1px solid #e3d9cb;border-top:0">
  <h2 style="margin:0 0 8px;font-size:20px">${esc(title)}</h2><p style="margin:0 0 16px">${intro}</p>
  <table style="border-collapse:collapse;font-size:14px">${tr}</table>
  <p style="margin:18px 0 0;font-size:13px;color:#6d6070">${footer}</p></div></div>`;
}

async function sendEmail({ to, subject, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: "RESEND_API_KEY not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Dune Falcon Bookings <onboarding@resend.dev>",
      to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendWhatsApp(lead, business) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = (process.env.NOTIFY_WHATSAPP || business.whatsapp || "").replace(/\D/g, "");
  if (!token || !phoneId || !to) return { skipped: "WhatsApp env vars not set" };

  const template = process.env.WHATSAPP_TEMPLATE; // e.g. "new_booking"
  const guests = `${lead.adults} adults + ${lead.kids} children`;
  const when = `${niceDate(lead.date)}, ${lead.slotLabel} ${lead.slotTime}`;
  const body = template
    ? {
        messaging_product: "whatsapp", to, type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [{
            type: "body",
            parameters: [lead.ref, lead.name, lead.packageName, when, guests, money(lead.total, business.currency), lead.phone]
              .map((t) => ({ type: "text", text: String(t).slice(0, 200) })),
          }],
        },
      }
    : {
        // Plain text only arrives if you messaged the business number in the last 24h.
        messaging_product: "whatsapp", to, type: "text",
        text: { body: `New booking ${lead.ref}\n${lead.name} · ${lead.phone}\n${lead.packageName}\n${when}\n${guests}\nTotal ${money(lead.total, business.currency)}` },
      };

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
  return res.json();
}

// Never throws: a booking is saved even if a notification fails.
export async function notifyBooking(lead, business) {
  const ownerEmail = process.env.NOTIFY_EMAIL || business.email;
  const jobs = {
    ownerEmail: ownerEmail
      ? sendEmail({
          to: ownerEmail,
          replyTo: lead.email || undefined,
          subject: `New booking ${lead.ref} · ${lead.name} · ${niceDate(lead.date)}`,
          html: emailHtml("New booking request", "A customer just booked on the website. Confirm with them on WhatsApp.", lead, business,
            `Open the admin dashboard to change its status.`),
        })
      : Promise.resolve({ skipped: "no owner email" }),
    customerEmail: lead.email
      ? sendEmail({
          to: lead.email,
          replyTo: business.email,
          subject: `Your Dune Falcon safari request ${lead.ref}`,
          html: emailHtml(`Thanks, ${lead.name.split(" ")[0]}!`, "We have your safari request. Our team will confirm your pickup time on WhatsApp shortly.", lead, business,
            `Questions? WhatsApp us on ${esc(business.whatsapp)}. Free cancellation up to 24 hours before pickup.`),
        })
      : Promise.resolve({ skipped: "customer gave no email" }),
    whatsapp: sendWhatsApp(lead, business),
  };
  return settle(jobs);
}

// Never throws, like notifyBooking.
export async function notifyCancel(lead, business) {
  const ownerEmail = process.env.NOTIFY_EMAIL || business.email;
  return settle({
    ownerEmail: ownerEmail
      ? sendEmail({
          to: ownerEmail,
          replyTo: lead.email || undefined,
          subject: `Cancelled ${lead.ref} · ${lead.name} · ${niceDate(lead.date)}`,
          html: emailHtml("Booking cancelled by the customer", "The customer cancelled this booking on the website. Their seats are free again.", lead, business,
            `The lead is marked cancelled in the admin dashboard.`),
        })
      : Promise.resolve({ skipped: "no owner email" }),
    customerEmail: lead.email
      ? sendEmail({
          to: lead.email,
          replyTo: business.email,
          subject: `Your Dune Falcon booking ${lead.ref} is cancelled`,
          html: emailHtml(`Booking cancelled`, "Your safari booking is cancelled. Nothing was charged.", lead, business,
            `Want a new date? WhatsApp us on ${esc(business.whatsapp)}.`),
        })
      : Promise.resolve({ skipped: "customer gave no email" }),
  });
}

async function settle(jobs) {
  const names = Object.keys(jobs);
  const results = await Promise.allSettled(Object.values(jobs));
  const out = {};
  results.forEach((r, i) => {
    out[names[i]] = r.status === "fulfilled" ? (r.value?.skipped ? `skipped: ${r.value.skipped}` : "sent") : `failed: ${r.reason?.message}`;
    if (r.status === "rejected") console.error(`[notify] ${names[i]}`, r.reason);
  });
  return out;
}
