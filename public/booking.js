/* Dune Falcon booking page — renders packages from server config and posts bookings to /api/bookings */
(function () {
  const S = JSON.parse(document.getElementById("df-config").textContent);
  const bk = { pkg: null, date: null, slot: null, adults: 2, kids: 0, addons: {} };
  let lastLead = null, sending = false;

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const aed = (n) => (S.business.currency || "AED") + " " + Math.round(+n || 0).toLocaleString("en-US");
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // All dates and pickup times are Dubai time (UTC+4), whatever the visitor's timezone.
  const DXB = 4;
  const keyParts = (k) => k.split("-").map(Number);
  const weekday = (k) => { const [y, m, d] = keyParts(k); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const dayNum = (k) => keyParts(k)[2];
  const monIdx = (k) => keyParts(k)[1] - 1;
  const niceDate = (k) => (k ? DOW[weekday(k)] + " " + dayNum(k) + " " + MON[monIdx(k)] : "—");
  function dubaiKey(offsetDays) {
    const d = new Date(Date.now() + DXB * 3600e3 + offsetDays * 864e5);
    return d.toISOString().slice(0, 10);
  }
  function pickupEpoch(k, time) { const [y, m, d] = keyParts(k); const [h, mi] = (time || "00:00").split(":").map(Number); return Date.UTC(y, m - 1, d, h - DXB, mi); }
  function slotOpen(k, slot) {
    if (!S.schedule.openDays.includes(weekday(k)) || (S.schedule.blocked || []).includes(k)) return false;
    return pickupEpoch(k, slot.time) - Date.now() >= (S.schedule.cutoffHours || 0) * 3600e3;
  }

  const waDigits = () => (S.business.whatsapp || "").replace(/[^\d]/g, "");
  const waLink = (t) => "https://wa.me/" + waDigits() + (t ? "?text=" + encodeURIComponent(t) : "");
  const activePkgs = () => S.packages.filter((p) => p.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  const slotById = (id) => S.schedule.slots.find((s) => s.id === id);
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

  function quote() {
    const p = S.packages.find((x) => x.id === bk.pkg); if (!p) return { lines: [], total: 0 };
    const guests = bk.adults + bk.kids, lines = []; let total = 0;
    if (p.unit === "vehicle") { const cars = Math.max(1, Math.ceil(guests / (p.maxGuests || 6))); const v = cars * p.price; lines.push([cars + " × vehicle", v]); total += v; }
    else {
      const a = bk.adults * p.price; lines.push([bk.adults + " adult" + (bk.adults == 1 ? "" : "s") + " × " + p.price, a]); total += a;
      if (bk.kids) { const cp = p.childPrice || p.price, k = bk.kids * cp; lines.push([bk.kids + " child" + (bk.kids == 1 ? "" : "ren") + " × " + cp, k]); total += k; }
    }
    for (const ad of S.business.addons || []) { if (!bk.addons[ad.id]) continue; const n = ad.unit === "person" ? guests : 1; lines.push([ad.name + (n > 1 ? " × " + n : ""), n * ad.price]); total += n * ad.price; }
    return { lines, total, pkg: p };
  }

  function renderLanding() {
    const wa = waLink("Hi Dune Falcon, I'd like to ask about a desert safari.");
    $("#heroWa").href = wa; $("#waFloat").href = wa;
    $("#ftPhone").textContent = S.business.whatsapp; $("#ftEmail").textContent = S.business.email;
    $("#ftLicence").textContent = "Desert safari & city tours · Dubai, UAE" + (S.business.licence ? " · DTCM licence " + S.business.licence : "");
    $("#slotGlance").innerHTML = S.schedule.slots.map((s) => {
      const pk = activePkgs().filter((p) => (p.slots || []).includes(s.id));
      const from = pk.length ? Math.min(...pk.map((p) => (p.unit === "person" ? p.price : p.price / (p.maxGuests || 6)))) : null;
      return `<div class="row"><span><b>${esc(s.label)}</b><br><span class="muted mono">${esc(s.time)} pickup</span></span><span class="mono" style="text-align:right">${from != null ? "from<br>" + aed(from) : ""}</span></div>`;
    }).join("");
    const pk = activePkgs();
    $("#pkGrid").innerHTML = pk.length ? pk.map((p) => `<article class="pk${p.popular ? " pop" : ""}">
      ${p.popular ? '<span class="flag">Most booked</span>' : ""}
      <div><div class="type">${esc(p.type)} · ${esc(p.duration)}</div><h3>${esc(p.name)}</h3></div>
      <div class="price"><b>${aed(p.price)}</b><span class="muted">${p.unit === "vehicle" ? "per car, up to " + (p.maxGuests || 6) : "per adult"}</span></div>
      <div class="meta"><span class="chip mono">${esc(p.window)}</span>${p.unit === "person" && p.childPrice ? `<span class="chip">Child ${aed(p.childPrice)}</span>` : ""}</div>
      <ul>${(p.inclusions || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
      <div class="foot"><button class="btn gold sm" data-book="${esc(p.id)}">Book this</button><a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink("Hi, I'm interested in the " + p.name + ".")}">Ask a question</a></div>
    </article>`).join("") : '<p class="muted">Packages are being updated. Message us on WhatsApp for today\'s offers.</p>';
    $("#adList").innerHTML = (S.business.addons || []).map((a) => `<div class="ad"><b>${esc(a.name)}</b><span class="mono muted">${aed(a.price)}${a.unit === "person" ? " / person" : ""}</span></div>`).join("") || '<p class="muted">No add-ons listed right now.</p>';
    renderBooking();
  }

  function renderBooking() {
    const pk = activePkgs();
    if (!pk.find((p) => p.id === bk.pkg)) bk.pkg = pk[0]?.id || null;
    const p = pk.find((x) => x.id === bk.pkg);
    $("#bPkg").innerHTML = pk.map((x) => `<button type="button" class="opt" aria-pressed="${x.id === bk.pkg}" data-pkg="${esc(x.id)}">${esc(x.name)}<small class="mono">${aed(x.price)} ${x.unit === "vehicle" ? "/ car" : "/ adult"}</small></button>`).join("");
    const pslots = S.schedule.slots.filter((s) => !p || !(p.slots || []).length || p.slots.includes(s.id));
    const dates = []; for (let i = 0; i < 21; i++) { const k = dubaiKey(i); dates.push({ k, closed: !pslots.some((s) => slotOpen(k, s)) }); }
    if (!dates.find((o) => o.k === bk.date && !o.closed)) bk.date = dates.find((o) => !o.closed)?.k || null;
    $("#bDates").innerHTML = dates.map((o) => `<button type="button" class="opt" data-date="${o.k}" aria-pressed="${o.k === bk.date}" ${o.closed ? "disabled" : ""}><small>${DOW[weekday(o.k)]}</small><b>${dayNum(o.k)}</b><small>${MON[monIdx(o.k)]}</small></button>`).join("");
    const sl = pslots.map((s) => ({ s, open: bk.date && slotOpen(bk.date, s) }));
    if (!sl.find((x) => x.s.id === bk.slot && x.open)) bk.slot = sl.find((x) => x.open)?.s.id || null;
    $("#bSlots").innerHTML = sl.length ? sl.map(({ s, open }) => `<button type="button" class="opt" data-slot="${esc(s.id)}" aria-pressed="${s.id === bk.slot}" ${open ? "" : "disabled"}>${esc(s.label)}<small class="mono">Pickup ${esc(s.time)} (Dubai time)</small></button>`).join("") : '<span class="muted">No pickup times set for this package.</span>';
    $("#oAdults").textContent = bk.adults; $("#oKids").textContent = bk.kids;
    $("#guestNote").textContent = p && p.unit === "vehicle" ? `Price is per Land Cruiser. ${bk.adults + bk.kids} guests need ${Math.max(1, Math.ceil((bk.adults + bk.kids) / (p.maxGuests || 6)))} car(s).` : "Children under 3 ride free and don't need a seat.";
    $("#bAddons").innerHTML = (S.business.addons || []).map((a) => `<label class="check"><input type="checkbox" id="ad-${esc(a.id)}" data-addon="${esc(a.id)}" ${bk.addons[a.id] ? "checked" : ""}>${esc(a.name)}<span class="p">${aed(a.price)}${a.unit === "person" ? "/pp" : ""}</span></label>`).join("") || '<span class="muted">No add-ons available.</span>';
    renderSummary();
  }

  function waText(L) {
    return `Hi Dune Falcon, I just booked on your website.
Reference: ${L.ref}
Package: ${L.packageName}
Date: ${niceDate(L.date)} · ${L.slotLabel} pickup ${L.slotTime}
Guests: ${L.adults} adults, ${L.kids} children
Pickup: ${L.pickup || "-"}
Name: ${L.name}
Total: ${aed(L.total)}`;
  }

  function renderSummary(err) {
    const box = $("#summary");
    if (lastLead) {
      const L = lastLead;
      box.innerHTML = `<div class="done"><div class="eyebrow">Booking received</div><h3>Thank you, ${esc(L.name.split(" ")[0])}!</h3>
        <div>Your reference<div class="ref">${esc(L.ref)}</div></div>
        <div class="sl"><span>${esc(L.packageName)}</span><span>${niceDate(L.date)}</span></div>
        <div class="sl"><span>Pickup</span><span>${esc(L.slotLabel)} ${esc(L.slotTime)}</span></div>
        <div class="sl"><span>Guests</span><span>${L.adults} + ${L.kids}</span></div>
        <div class="total"><span>Pay at pickup</span><b>${aed(L.total)}</b></div>
        <p style="margin:0;font-size:14px">We'll confirm your exact pickup time on WhatsApp shortly.${L.email ? " A copy is on its way to your email." : ""}</p>
        <a class="btn gold" target="_blank" rel="noopener" href="${waLink(waText(L))}">Chat with us on WhatsApp</a>
        <button class="btn sm ghost" type="button" id="newBooking">Make another booking</button></div>`;
      return;
    }
    const q = quote(), sl = slotById(bk.slot);
    box.innerHTML = `<div class="eyebrow">Your booking</div><h3>${esc(q.pkg?.name || "Choose a package")}</h3>
      <div class="sl"><span>Date</span><span>${niceDate(bk.date)}</span></div>
      <div class="sl"><span>Pickup</span><span>${sl ? esc(sl.label + " " + sl.time) : "—"}</span></div>
      ${q.lines.map((l) => `<div class="sl"><span>${esc(l[0])}</span><span>${aed(l[1])}</span></div>`).join("")}
      <div class="total"><span>Total</span><b>${aed(q.total)}</b></div>
      <div class="err" id="bErr" role="alert">${esc(err || "")}</div>
      <button class="btn gold" type="button" id="submitBk" style="width:100%" ${sending ? "disabled" : ""}>${sending ? "Sending…" : "Confirm booking"}</button>
      <p class="muted" style="font-size:13px;margin:10px 0 0">Pay at pickup. Free cancellation up to 24h before.</p>`;
  }

  async function submitBooking() {
    const name = $("#fName").value.trim(), phone = $("#fPhone").value.trim();
    if (!bk.pkg || !bk.date || !bk.slot) return renderSummary("Choose a package, date and pickup time.");
    if (!name) { renderSummary("Add the lead guest's name."); return $("#fName").focus(); }
    if (phone.replace(/\D/g, "").length < 8) { renderSummary("Add a WhatsApp number with country code."); return $("#fPhone").focus(); }
    sending = true; renderSummary();
    try {
      const r = await fetch("/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: bk.pkg, date: bk.date, slot: bk.slot, adults: bk.adults, kids: bk.kids,
          addons: Object.keys(bk.addons).filter((k) => bk.addons[k]),
          name, phone, email: $("#fEmail").value.trim(), country: $("#fCountry").value.trim(),
          pickup: $("#fPickup").value.trim(), notes: $("#fNotes").value.trim(), company: $("#fCompany").value,
        }),
      });
      const j = await r.json().catch(() => ({}));
      sending = false;
      if (!r.ok) return renderSummary(j.error || "Something went wrong. Please message us on WhatsApp.");
      lastLead = j.lead; renderSummary();
      $("#summary").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      sending = false; renderSummary("No connection. Check your internet and try again, or message us on WhatsApp.");
    }
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button,a"); if (!t) return;
    if (t.dataset.book) { bk.pkg = t.dataset.book; lastLead = null; renderBooking(); $("#book").scrollIntoView({ behavior: "smooth" }); return; }
    if (t.dataset.pkg) { bk.pkg = t.dataset.pkg; renderBooking(); return; }
    if (t.dataset.date) { bk.date = t.dataset.date; renderBooking(); return; }
    if (t.dataset.slot) { bk.slot = t.dataset.slot; renderBooking(); return; }
    if (t.dataset.g) { const k = t.dataset.g, min = k === "adults" ? 1 : 0; bk[k] = Math.min(30, Math.max(min, bk[k] + +t.dataset.d)); renderBooking(); return; }
    if (t.id === "submitBk") { submitBooking(); return; }
    if (t.id === "newBooking") { lastLead = null; renderSummary(); return; }
    if (t.dataset.copy) {
      const el = $("#" + t.dataset.copy);
      navigator.clipboard?.writeText(el.textContent).then(() => toast("Copied"), () => { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); });
    }
  });
  document.addEventListener("change", (e) => { if (e.target.dataset.addon) { bk.addons[e.target.dataset.addon] = e.target.checked; renderSummary(); } });

  renderLanding();
})();
