/* Dune Falcon booking page — renders packages from server config and posts bookings to /api/bookings */
(function () {
  const S = JSON.parse(document.getElementById("df-config").textContent);
  const I = window.DF_I18N;
  const bk = { pkg: null, date: null, slot: null, adults: 2, kids: 0, addons: {}, month: null };
  const cx = { open: false, busy: false, done: "", err: "", ref: "", phone: "" };
  let lastLead = null, sending = false, lang = pickLang();

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const aed = (n) => (S.business.currency || "AED") + " " + Math.round(+n || 0).toLocaleString("en-US");
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ---- language ----
  function pickLang() {
    try { const v = localStorage.getItem("df-lang"); if (v && I.langs[v]) return v; } catch {}
    for (const l of navigator.languages || [navigator.language || "en"]) { const k = String(l).slice(0, 2).toLowerCase(); if (I.langs[k]) return k; }
    return "en";
  }
  const loc = () => I.langs[lang].locale;
  function t(key, vars) {
    const s = (I.strings[lang] || {})[key] ?? I.strings.en[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ""));
  }

  // All dates and pickup times are Dubai time (UTC+4), whatever the visitor's timezone.
  const DXB = 4;
  const keyParts = (k) => k.split("-").map(Number);
  const utc = (k) => { const [y, m, d] = keyParts(k); return new Date(Date.UTC(y, m - 1, d)); };
  const weekday = (k) => utc(k).getUTCDay();
  const dayNum = (k) => keyParts(k)[2];
  const monIdx = (k) => keyParts(k)[1] - 1;
  const niceDate = (k) => (k ? DOW[weekday(k)] + " " + dayNum(k) + " " + MON[monIdx(k)] : "—"); // English, for WhatsApp to the team
  const fmtDate = (k) => (k ? new Intl.DateTimeFormat(loc(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(utc(k)) : "—");
  function dubaiKey(offsetDays) {
    const d = new Date(Date.now() + DXB * 3600e3 + offsetDays * 864e5);
    return d.toISOString().slice(0, 10);
  }
  function pickupEpoch(k, time) { const [y, m, d] = keyParts(k); const [h, mi] = (time || "00:00").split(":").map(Number); return Date.UTC(y, m - 1, d, h - DXB, mi); }
  function slotOpen(k, slot) {
    if (!S.schedule.openDays.includes(weekday(k)) || (S.schedule.blocked || []).includes(k)) return false;
    return pickupEpoch(k, slot.time) - Date.now() >= (S.schedule.cutoffHours || 0) * 3600e3;
  }
  const lastDay = () => dubaiKey(S.schedule.bookAheadDays || 180);

  // ---- countries ----
  const COUNTRIES = I.countries.split(" ").map((c) => ({ iso: c.slice(0, 2), dial: c.slice(2) }));
  const dialOf = (iso) => COUNTRIES.find((c) => c.iso === iso)?.dial || "";
  const flag = (iso) => String.fromCodePoint(...[...iso].map((ch) => 127397 + ch.charCodeAt(0)));
  function regionName(iso, l) { try { return new Intl.DisplayNames([l || loc()], { type: "region" }).of(iso) || iso; } catch { return iso; } }
  function guessCountry() {
    for (const l of navigator.languages || []) { const m = String(l).match(/-([A-Z]{2})$/i); if (m && dialOf(m[1].toUpperCase())) return m[1].toUpperCase(); }
    return "";
  }
  function renderCountries() {
    const sel = $("#fCountry"), cur = sel.value;
    const opt = (c) => `<option value="${c.iso}">${flag(c.iso)}  ${esc(regionName(c.iso))}</option>`;
    const named = COUNTRIES.map((c) => ({ ...c, n: regionName(c.iso) })).sort((a, b) => a.n.localeCompare(b.n, loc()));
    sel.innerHTML = `<option value="">${esc(t("f_country_ph"))}</option>
      <optgroup label="${esc(t("popular"))}">${I.popular.map((iso) => opt({ iso })).join("")}</optgroup>
      <optgroup label="${esc(t("all_countries"))}">${named.map(opt).join("")}</optgroup>`;
    sel.value = cur;
  }

  const waDigits = () => (S.business.whatsapp || "").replace(/[^\d]/g, "");
  const waLink = (tx) => "https://wa.me/" + waDigits() + (tx ? "?text=" + encodeURIComponent(tx) : "");
  const activePkgs = () => S.packages.filter((p) => p.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  const slotById = (id) => S.schedule.slots.find((s) => s.id === id);
  function toast(msg) { const el = document.createElement("div"); el.className = "toast"; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 2200); }

  function quote() {
    const p = S.packages.find((x) => x.id === bk.pkg); if (!p) return { lines: [], total: 0 };
    const guests = bk.adults + bk.kids, lines = []; let total = 0;
    if (p.unit === "vehicle") { const cars = Math.max(1, Math.ceil(guests / (p.maxGuests || 6))); const v = cars * p.price; lines.push([t("cars") + " " + cars + " × " + p.price, v]); total += v; }
    else {
      const a = bk.adults * p.price; lines.push([t("adults") + " " + bk.adults + " × " + p.price, a]); total += a;
      if (bk.kids) { const cp = p.childPrice || p.price, k = bk.kids * cp; lines.push([t("kids") + " " + bk.kids + " × " + cp, k]); total += k; }
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
    $("#langSel").innerHTML = Object.entries(I.langs).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join("");
    const g = guessCountry(); if (g) { renderCountries(); $("#fCountry").value = g; }
    applyLang();
  }

  // Static texts in the booking section, then everything rendered from data.
  function applyLang() {
    const box = $("#book"), L = I.langs[lang];
    box.setAttribute("lang", lang); box.setAttribute("dir", L.dir || "ltr");
    $("#langSel").value = lang;
    box.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    box.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    renderCountries();
    renderBooking(); renderCancel();
  }

  function renderCalendar(pslots) {
    const today = dubaiKey(0), last = lastDay();
    const open = (k) => k >= today && k <= last && pslots.some((s) => slotOpen(k, s));
    if (!bk.date || !open(bk.date)) {
      bk.date = null;
      for (let i = 0; i <= (S.schedule.bookAheadDays || 180); i++) { const k = dubaiKey(i); if (open(k)) { bk.date = k; break; } }
      if (bk.date) bk.month = bk.date.slice(0, 7);
    }
    if (!bk.month) bk.month = today.slice(0, 7);
    const [y, m] = bk.month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const blanks = (first.getUTCDay() + 6) % 7; // weeks start on Monday
    const wd = new Intl.DateTimeFormat(loc(), { weekday: "narrow", timeZone: "UTC" });
    const heads = [...Array(7)].map((_, i) => `<span class="cal-wd">${esc(wd.format(new Date(Date.UTC(2024, 0, 1 + i))))}</span>`).join("");
    let cells = "";
    for (let i = 0; i < blanks; i++) cells += "<span></span>";
    for (let d = 1; d <= days; d++) {
      const k = bk.month + "-" + String(d).padStart(2, "0"), ok = open(k);
      cells += `<button type="button" class="day${k === today ? " today" : ""}" data-date="${k}" aria-pressed="${k === bk.date}" aria-label="${esc(fmtDate(k))}" ${ok ? "" : "disabled"}>${d}</button>`;
    }
    const title = new Intl.DateTimeFormat(loc(), { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
    $("#bDates").innerHTML = `<div class="cal-head">
        <button type="button" class="cal-nav" data-month="-1" aria-label="${esc(t("cal_prev"))}" ${bk.month <= today.slice(0, 7) ? "disabled" : ""}>‹</button>
        <b>${esc(title)}</b>
        <button type="button" class="cal-nav" data-month="1" aria-label="${esc(t("cal_next"))}" ${bk.month >= last.slice(0, 7) ? "disabled" : ""}>›</button>
      </div><div class="cal-grid">${heads}${cells}</div>${bk.date ? "" : `<p class="muted" style="margin:4px 0 0;font-size:13px">${esc(t("cal_none"))}</p>`}`;
  }

  function renderBooking() {
    const pk = activePkgs();
    if (!pk.find((p) => p.id === bk.pkg)) bk.pkg = pk[0]?.id || null;
    const p = pk.find((x) => x.id === bk.pkg);
    $("#bPkg").innerHTML = pk.map((x) => `<button type="button" class="opt" aria-pressed="${x.id === bk.pkg}" data-pkg="${esc(x.id)}">${esc(x.name)}<small class="mono">${aed(x.price)} ${esc(x.unit === "vehicle" ? t("per_car") : t("per_adult"))}</small></button>`).join("");
    const pslots = S.schedule.slots.filter((s) => !p || !(p.slots || []).length || p.slots.includes(s.id));
    renderCalendar(pslots);
    const sl = pslots.map((s) => ({ s, open: bk.date && slotOpen(bk.date, s) }));
    if (!sl.find((x) => x.s.id === bk.slot && x.open)) bk.slot = sl.find((x) => x.open)?.s.id || null;
    $("#bSlots").innerHTML = sl.length ? sl.map(({ s, open }) => `<button type="button" class="opt" data-slot="${esc(s.id)}" aria-pressed="${s.id === bk.slot}" ${open ? "" : "disabled"}>${esc(s.label)}<small class="mono">${esc(t("pickup_t", { t: s.time }))}</small></button>`).join("") : `<span class="muted">${esc(t("no_slots"))}</span>`;
    $("#oAdults").textContent = bk.adults; $("#oKids").textContent = bk.kids;
    $("#guestNote").textContent = p && p.unit === "vehicle" ? t("note_car", { n: bk.adults + bk.kids, c: Math.max(1, Math.ceil((bk.adults + bk.kids) / (p.maxGuests || 6))) }) : t("note_kids");
    $("#bAddons").innerHTML = (S.business.addons || []).map((a) => `<label class="check"><input type="checkbox" id="ad-${esc(a.id)}" data-addon="${esc(a.id)}" ${bk.addons[a.id] ? "checked" : ""}>${esc(a.name)}<span class="p">${aed(a.price)}${a.unit === "person" ? " " + esc(t("pp")) : ""}</span></label>`).join("") || `<span class="muted">${esc(t("no_addons"))}</span>`;
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

  const trust = () => `<ul class="trust-list"><li>${esc(t("trust_pay"))}</li><li>${esc(t("trust_cancel"))}</li><li>${esc(t("trust_wa"))}</li></ul>`;

  function renderSummary(err) {
    const box = $("#summary");
    if (lastLead) {
      const L = lastLead;
      box.innerHTML = `<div class="done"><div class="eyebrow">${esc(t("done_eyebrow"))}</div><h3>${esc(t("done_thanks", { name: L.name.split(" ")[0] }))}</h3>
        <div class="ref-box"><span class="muted">${esc(t("your_ref"))}</span><div class="ref-row"><span class="ref" id="doneRef">${esc(L.ref)}</span><button class="btn sm" type="button" data-copy="doneRef">${esc(t("copy"))}</button></div><small class="muted">${esc(t("done_save"))}</small></div>
        <div class="sl"><span>${esc(L.packageName)}</span><span>${esc(fmtDate(L.date))}</span></div>
        <div class="sl"><span>${esc(t("pickup"))}</span><span>${esc(L.slotLabel)} ${esc(L.slotTime)}</span></div>
        <div class="sl"><span>${esc(t("guests"))}</span><span>${L.adults} + ${L.kids}</span></div>
        <div class="total"><span>${esc(t("pay_pickup"))}</span><b>${aed(L.total)}</b></div>
        <p style="margin:0;font-size:14px">${esc(t("done_note"))}${L.email ? " " + esc(t("done_email")) : ""}</p>
        <a class="btn gold" target="_blank" rel="noopener" href="${waLink(waText(L))}">${esc(t("chat_wa"))}</a>
        <div class="done-act"><button class="btn sm ghost" type="button" id="newBooking">${esc(t("another"))}</button><button class="btn sm ghost danger" type="button" id="cancelThis">${esc(t("cancel_this"))}</button></div></div>`;
      return;
    }
    const q = quote(), sl = slotById(bk.slot), name = $("#fName").value.trim(), pickup = $("#fPickup").value.trim();
    box.innerHTML = `<div class="eyebrow">${esc(t("sum_eyebrow"))}</div><h3>${esc(q.pkg?.name || t("choose_pkg"))}</h3>
      <div class="sl"><span>${esc(t("date"))}</span><span>${esc(fmtDate(bk.date))}</span></div>
      <div class="sl"><span>${esc(t("pickup"))}</span><span>${sl ? esc(sl.label + " " + sl.time) : "—"}</span></div>
      ${q.lines.map((l) => `<div class="sl"><span>${esc(l[0])}</span><span>${aed(l[1])}</span></div>`).join("")}
      ${name ? `<div class="sl"><span>${esc(t("lead_guest"))}</span><span class="txt">${esc(name)}</span></div>` : ""}
      ${pickup ? `<div class="sl"><span>${esc(t("pickup"))}</span><span class="txt">${esc(pickup)}</span></div>` : ""}
      <div class="total"><span>${esc(t("total"))}</span><b>${aed(q.total)}</b></div>
      <div class="err" id="bErr" role="alert">${esc(err || "")}</div>
      <button class="btn gold" type="button" id="submitBk" style="width:100%" ${sending ? "disabled" : ""}>${esc(sending ? t("sending") : t("confirm"))}</button>
      ${trust()}`;
  }

  // ---- details box validation ----
  function fieldErr(id, key) {
    const el = $("#" + id), msg = $("#e-" + id);
    if (msg) msg.textContent = key ? t(key) : "";
    if (el) el.toggleAttribute("aria-invalid", !!key);
    return !key;
  }
  const emailOk = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  function checkField(id) {
    const v = $("#" + id).value.trim();
    if (id === "fName") return fieldErr(id, v ? "" : "err_name");
    if (id === "fPhone") return fieldErr(id, v.replace(/\D/g, "").length >= 8 ? "" : "err_phone");
    if (id === "fEmail") return fieldErr(id, emailOk(v) ? "" : "err_email");
    return true;
  }
  function phoneValue() {
    const v = $("#fPhone").value.trim(), dial = dialOf($("#fCountry").value);
    if (!v || v.startsWith("+") || v.startsWith("00") || !dial) return v;
    return "+" + dial + " " + v.replace(/^0+/, ""); // local number typed without country code
  }

  async function submitBooking() {
    if (!bk.pkg || !bk.date || !bk.slot) return renderSummary(t("err_choose"));
    const bad = ["fName", "fPhone", "fEmail"].filter((id) => !checkField(id));
    if (bad.length) { renderSummary(t(bad[0] === "fName" ? "err_name" : bad[0] === "fPhone" ? "err_phone" : "err_email")); return $("#" + bad[0]).focus(); }
    const iso = $("#fCountry").value;
    sending = true; renderSummary();
    try {
      const r = await fetch("/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: bk.pkg, date: bk.date, slot: bk.slot, adults: bk.adults, kids: bk.kids,
          addons: Object.keys(bk.addons).filter((k) => bk.addons[k]),
          name: $("#fName").value.trim(), phone: phoneValue(), email: $("#fEmail").value.trim(),
          country: iso ? regionName(iso, "en") : "", lang,
          pickup: $("#fPickup").value.trim(), notes: $("#fNotes").value.trim(), company: $("#fCompany").value,
        }),
      });
      const j = await r.json().catch(() => ({}));
      sending = false;
      if (!r.ok) {
        const key = { name: "err_name", phone: "err_phone", email: "err_email", choose: "err_choose", pkg: "err_pkg", closed: "err_closed", full: "err_full", save: "err_save" }[j.code];
        return renderSummary(key ? t(key, { n: j.left }) : j.error || t("err_generic"));
      }
      lastLead = j.lead; renderSummary();
      $("#summary").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      sending = false; renderSummary(t("err_net"));
    }
  }

  // ---- self-cancel ----
  function renderCancel() {
    const p = $("#cxPanel"); p.hidden = !cx.open;
    if (!cx.open) return;
    p.innerHTML = `<div class="cx-in"><div><h3>${esc(t("cx_title"))}</h3><p class="muted">${esc(t("cx_lead"))}</p></div>
      ${cx.done ? `<div class="cx-msg ok" role="status">${esc(cx.done)}</div>` : `<div class="fields">
        <label class="field"><span class="fl">${esc(t("cx_ref"))}</span><input id="cxRef" value="${esc(cx.ref)}" placeholder="DF-1030-ABCD" autocapitalize="characters" autocomplete="off" spellcheck="false"></label>
        <label class="field"><span class="fl">${esc(t("cx_phone"))}</span><input id="cxPhone" value="${esc(cx.phone)}" type="tel" inputmode="tel" autocomplete="tel" placeholder="+971 50 123 4567"></label>
      </div><div class="cx-msg err" role="alert">${esc(cx.err)}</div>`}
      <div class="cx-act">${cx.done ? "" : `<button class="btn danger" type="button" id="cxGo" ${cx.busy ? "disabled" : ""}>${esc(cx.busy ? t("cx_working") : t("cx_btn"))}</button>`}<button class="btn ghost" type="button" id="cxClose">${esc(t("cx_close"))}</button></div></div>`;
  }
  function openCancel(ref, phone) {
    Object.assign(cx, { open: true, done: "", err: "", ref: ref ?? cx.ref, phone: phone ?? cx.phone });
    renderCancel(); $("#cxPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  async function submitCancel() {
    cx.ref = $("#cxRef").value.trim().toUpperCase(); cx.phone = $("#cxPhone").value.trim();
    if (!cx.ref || cx.phone.replace(/\D/g, "").length < 8) { cx.err = t("cx_missing"); return renderCancel(); }
    if (!confirm(t("cx_confirm", { ref: cx.ref }))) return;
    cx.busy = true; cx.err = ""; renderCancel();
    try {
      const r = await fetch("/api/bookings/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: cx.ref, phone: cx.phone }) });
      const j = await r.json().catch(() => ({}));
      cx.busy = false;
      if (!r.ok) { cx.err = { not_found: t("cx_not_found"), too_late: t("cx_too_late"), already: t("cx_already") }[j.code] || j.error || t("err_generic"); return renderCancel(); }
      cx.done = t("cx_done", { ref: j.ref });
      if (lastLead && lastLead.ref === j.ref) { lastLead = null; renderBooking(); }
      renderCancel();
    } catch (e) { cx.busy = false; cx.err = t("err_net"); renderCancel(); }
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("button,a"); if (!el) return;
    if (el.dataset.book) { bk.pkg = el.dataset.book; lastLead = null; renderBooking(); $("#book").scrollIntoView({ behavior: "smooth" }); return; }
    if (el.dataset.pkg) { bk.pkg = el.dataset.pkg; renderBooking(); return; }
    if (el.dataset.date) { bk.date = el.dataset.date; renderBooking(); return; }
    if (el.dataset.month) {
      const [y, m] = bk.month.split("-").map(Number), d = new Date(Date.UTC(y, m - 1 + +el.dataset.month, 1));
      bk.month = d.toISOString().slice(0, 7); renderBooking(); return;
    }
    if (el.dataset.slot) { bk.slot = el.dataset.slot; renderBooking(); return; }
    if (el.dataset.g) { const k = el.dataset.g, min = k === "adults" ? 1 : 0; bk[k] = Math.min(30, Math.max(min, bk[k] + +el.dataset.d)); renderBooking(); return; }
    if (el.id === "submitBk") { submitBooking(); return; }
    if (el.id === "newBooking") { lastLead = null; renderSummary(); return; }
    if (el.id === "cancelThis") { openCancel(lastLead.ref, lastLead.phone); return; }
    if (el.id === "cxOpen" || el.dataset.cx) { e.preventDefault(); openCancel(); return; }
    if (el.id === "cxGo") { submitCancel(); return; }
    if (el.id === "cxClose") { cx.open = false; renderCancel(); return; }
    if (el.dataset.copy) {
      const src = $("#" + el.dataset.copy);
      navigator.clipboard?.writeText(src.textContent).then(() => toast(t("copied")), () => { const r = document.createRange(); r.selectNodeContents(src); getSelection().removeAllRanges(); getSelection().addRange(r); });
    }
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.addon) { bk.addons[el.dataset.addon] = el.checked; renderSummary(); return; }
    if (el.id === "langSel") { lang = el.value; try { localStorage.setItem("df-lang", lang); } catch {} applyLang(); return; }
    if (el.id === "fCountry") {
      const ph = $("#fPhone"), dial = dialOf(el.value);
      if (dial && (!ph.value.trim() || /^\+\d{0,4}\s*$/.test(ph.value.trim()))) ph.value = "+" + dial + " ";
    }
  });
  document.addEventListener("input", (e) => {
    const id = e.target.id;
    if (id === "cxRef") cx.ref = e.target.value; else if (id === "cxPhone") cx.phone = e.target.value;
    if (["fName", "fPhone", "fEmail"].includes(id) && e.target.hasAttribute("aria-invalid")) checkField(id);
    if (id === "fName" || id === "fPickup") renderSummary();
  });
  document.addEventListener("focusout", (e) => { if (["fName", "fPhone", "fEmail"].includes(e.target.id) && e.target.value.trim()) checkField(e.target.id); });

  renderLanding();
})();
