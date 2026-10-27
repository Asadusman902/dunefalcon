/* Dune Falcon admin dashboard — leads, schedule, packages, add-ons. Talks to /api/admin/* */
(function () {
  const S = { packages: [], schedule: { slots: [], openDays: [], blocked: [], cutoffHours: 4 }, business: { addons: [] }, leads: [] };
  let tab = "leads", leadFilter = "all", leadSearch = "", editingPkg = null, armed = null, knownIds = null;
  const STATUSES = ["new", "contacted", "confirmed", "completed", "cancelled"];
  const baseTitle = document.title;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const aed = (n) => (S.business.currency || "AED") + " " + Math.round(+n || 0).toLocaleString("en-US");
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const keyParts = (k) => String(k).split("-").map(Number);
  const weekday = (k) => { const [y, m, d] = keyParts(k); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const niceDate = (k) => { if (!k) return "—"; const [, m, d] = keyParts(k); return DOW[weekday(k)] + " " + d + " " + MON[m - 1]; };
  const dubaiKey = (off) => new Date(Date.now() + 4 * 3600e3 + off * 864e5).toISOString().slice(0, 10);
  const slotById = (id) => S.schedule.slots.find((s) => s.id === id);
  const activePkgs = () => S.packages.filter((p) => p.active !== false);
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2400); }

  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (r.status === 401) { window.location.href = "/admin/login"; throw new Error("Logged out"); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Request failed (" + r.status + ")");
    return j;
  }

  async function loadConfig() {
    const c = await api("/api/admin/config");
    S.packages = c.packages; S.schedule = { ...c.schedule, slots: c.schedule.slots || [], blocked: c.schedule.blocked || [], openDays: c.schedule.openDays || [] };
    S.business = { ...c.business, addons: c.business.addons || [] };
  }
  async function loadLeads(silent) {
    try {
      const { leads } = await api("/api/admin/leads");
      if (knownIds) {
        const fresh = leads.filter((l) => !knownIds.has(l._id));
        if (fresh.length) toast(fresh.length === 1 ? "New booking from " + fresh[0].name : fresh.length + " new bookings");
      }
      knownIds = new Set(leads.map((l) => l._id));
      S.leads = leads;
      const n = leads.filter((l) => l.status === "new").length;
      document.title = (n ? "(" + n + ") " : "") + baseTitle;
      $("#liveChip").textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (tab === "leads" || !silent) renderAdmin(); else renderKpis();
    } catch (e) { $("#liveChip").textContent = "Offline · retrying"; }
  }

  function renderAdmin() {
    $("#admGate").innerHTML = ""; $("#admBody").hidden = false;
    renderKpis();
    $$(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
    $$("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab));
    ({ leads: renderLeads, schedule: renderSchedule, packages: renderPackagesAdmin, business: renderBusiness })[tab]();
  }

  function renderKpis() {
    const L = S.leads, today = dubaiKey(0), wk = dubaiKey(7), month = today.slice(0, 7);
    const fresh = L.filter((l) => l.status === "new").length;
    const guests = L.filter((l) => ["new", "contacted", "confirmed"].includes(l.status) && l.date >= today && l.date <= wk).reduce((s, l) => s + (+l.adults || 0) + (+l.kids || 0), 0);
    const rev = L.filter((l) => ["confirmed", "completed"].includes(l.status) && (l.date || "").startsWith(month)).reduce((s, l) => s + (+l.total || 0), 0);
    const conv = L.length ? Math.round((L.filter((l) => ["confirmed", "completed"].includes(l.status)).length / L.length) * 100) : 0;
    $("#kpis").innerHTML = [["New leads to answer", fresh], ["Guests next 7 days", guests], ["Confirmed this month", aed(rev)], ["Lead → booking", conv + "%"]]
      .map(([k, v]) => `<div class="kpi"><small>${k}</small><b>${v}</b></div>`).join("");
  }

  /* ---------- leads ---------- */
  function renderLeads() {
    const pane = $('[data-pane="leads"]'), q = leadSearch.toLowerCase();
    const keepForm = $("#addLeadBox")?.innerHTML ? $("#addLeadBox") : null;
    const rows = S.leads.filter((l) => (leadFilter === "all" || l.status === leadFilter) && (!q || [l.name, l.phone, l.email, l.ref, l.packageName, l.pickup].join(" ").toLowerCase().includes(q)));
    pane.innerHTML = `<div class="toolbar">
        <label class="field">Status<select id="lfStatus"><option value="all">All (${S.leads.length})</option>${STATUSES.map((s) => `<option value="${s}" ${leadFilter === s ? "selected" : ""}>${s[0].toUpperCase() + s.slice(1)} (${S.leads.filter((l) => l.status === s).length})</option>`).join("")}</select></label>
        <label class="field" style="flex:1">Search<input id="lfSearch" value="${esc(leadSearch)}" placeholder="Name, phone, reference, hotel"></label>
        <button class="btn sm gold" id="addLeadBtn" style="align-self:end">Add lead from WhatsApp</button>
      </div>
      <div id="addLeadBox"></div>
      ${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Guest</th><th>Trip</th><th>Guests</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.map((l) => `<tr>
        <td><b>${esc(l.name)}</b><div class="sub mono">${esc(l.phone)}</div>${l.email ? `<div class="sub">${esc(l.email)}</div>` : ""}<div class="sub">${esc(l.country || "")}${l.pickup ? " · " + esc(l.pickup) : ""}</div></td>
        <td>${esc(l.packageName)}<div class="sub">${niceDate(l.date)} · ${esc(l.slotLabel || "")} ${esc(l.slotTime || "")}</div><div class="sub mono">${esc(l.ref || "")} · ${esc(l.source || "")}</div>${l.notes ? `<div class="sub">“${esc(l.notes)}”</div>` : ""}</td>
        <td class="mono">${+l.adults || 0} + ${+l.kids || 0}${(l.addons || []).length ? `<div class="sub">${esc(l.addons.join(", "))}</div>` : ""}</td>
        <td class="mono">${aed(l.total)}</td>
        <td><span class="pill st-${esc(l.status)}">${esc(l.status)}</span><div style="margin-top:6px"><select class="status" data-lead="${esc(l._id)}" aria-label="Change status">${STATUSES.map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`).join("")}</select></div></td>
        <td style="white-space:nowrap"><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${esc(String(l.phone).replace(/\D/g, ""))}?text=${encodeURIComponent("Hi " + l.name + ", this is Dune Falcon Dubai about your booking " + (l.ref || "") + " on " + niceDate(l.date) + ".")}">WhatsApp</a>
          <button class="btn sm ghost danger" data-del-lead="${esc(l._id)}">${armed === "lead:" + l._id ? "Confirm delete" : "Delete"}</button></td>
      </tr>`).join("")}</tbody></table></div>`
      : `<div class="note">${S.leads.length ? "No leads match this filter." : "No leads yet. Website bookings appear here automatically. Add WhatsApp or Instagram enquiries with “Add lead from WhatsApp”."}</div>`}`;
    if (keepForm) $("#addLeadBox").replaceWith(keepForm);
  }

  function addLeadForm() {
    const box = $("#addLeadBox"); if (box.innerHTML) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="panel" style="margin-bottom:14px"><div class="fields">
      <label class="field">Name<input id="nlName"></label><label class="field">WhatsApp<input id="nlPhone" placeholder="+91…"></label>
      <label class="field">Package<select id="nlPkg">${activePkgs().map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
      <label class="field">Date<input type="date" id="nlDate" value="${dubaiKey(1)}"></label>
      <label class="field">Pickup<select id="nlSlot">${S.schedule.slots.map((s) => `<option value="${esc(s.id)}">${esc(s.label)} ${esc(s.time)}</option>`).join("")}</select></label>
      <label class="field">Adults / children<span style="display:flex;gap:8px"><input id="nlA" type="number" min="1" value="2"><input id="nlK" type="number" min="0" value="0"></span></label>
      <label class="field">Source<select id="nlSrc"><option>WhatsApp</option><option>Instagram DM</option><option>Facebook</option><option>Phone call</option><option>Walk-in / agent</option></select></label>
      <label class="field">Hotel / pickup<input id="nlPick"></label>
      <label class="field full">Notes<input id="nlNotes"></label></div>
      <div style="display:flex;gap:8px;margin-top:12px;align-items:center"><button class="btn gold sm" id="nlSave">Save lead</button><button class="btn sm ghost" id="addLeadBtnX">Cancel</button><span class="err" id="nlErr"></span></div></div>`;
  }
  async function saveManualLead() {
    const p = S.packages.find((x) => x.id === $("#nlPkg").value), s = slotById($("#nlSlot").value);
    const a = Math.max(1, +$("#nlA").value || 1), k = Math.max(0, +$("#nlK").value || 0), name = $("#nlName").value.trim();
    if (!name || !p) { $("#nlErr").textContent = "Add a name and package."; return; }
    const total = p.unit === "vehicle" ? Math.ceil((a + k) / (p.maxGuests || 6)) * p.price : a * p.price + k * (p.childPrice || p.price);
    try {
      await api("/api/admin/leads", { method: "POST", body: { name, phone: $("#nlPhone").value.trim(), pickup: $("#nlPick").value.trim(), notes: $("#nlNotes").value.trim(),
        packageId: p.id, packageName: p.name, date: $("#nlDate").value, slot: s?.id || "", slotLabel: s?.label || "", slotTime: s?.time || "", adults: a, kids: k, total, source: $("#nlSrc").value } });
      $("#addLeadBox").innerHTML = ""; toast("Lead saved"); loadLeads();
    } catch (e) { $("#nlErr").textContent = e.message; }
  }

  /* ---------- schedule ---------- */
  const bookedFor = (date, slot) => S.leads.filter((l) => l.date === date && l.slot === slot && ["new", "contacted", "confirmed"].includes(l.status)).reduce((s, l) => s + (+l.adults || 0) + (+l.kids || 0), 0);
  function renderSchedule() {
    const sch = S.schedule, pane = $('[data-pane="schedule"]');
    const next = []; for (let i = 0; i < 7; i++) next.push(dubaiKey(i));
    pane.innerHTML = `<div class="grid2">
     <div class="panel"><h3 style="font-size:22px;margin-bottom:4px">Pickup slots</h3><p class="muted" style="margin:0 0 10px;font-size:13px">Pickup times shown on the booking page (Dubai time). Capacity is total guests per slot per day. Bookings stop when it's full.</p>
       <div id="slotRows">${sch.slots.map((s, i) => `<div class="slot-row" data-i="${i}">
         <label class="field">Name<input data-k="label" value="${esc(s.label)}"></label>
         <label class="field">Pickup<input data-k="time" type="time" value="${esc(s.time)}"></label>
         <label class="field">Capacity<input data-k="capacity" type="number" min="1" value="${+s.capacity || 0}"></label>
         <button class="btn sm ghost danger" data-del-slot="${i}">Remove</button></div>`).join("")}</div>
       <div style="display:flex;gap:8px;margin-top:10px"><button class="btn sm" id="addSlot">Add slot</button></div>
       <h3 style="font-size:22px;margin:22px 0 8px">Open days</h3>
       <div class="days">${DOW.map((d, i) => `<label class="check" style="padding:6px 10px"><input type="checkbox" data-day="${i}" ${sch.openDays.includes(i) ? "checked" : ""}>${d}</label>`).join("")}</div>
       <h3 style="font-size:22px;margin:22px 0 8px">Booking cut-off</h3>
       <label class="field">Hours before pickup that online booking closes<input type="number" id="cutoff" min="0" max="72" value="${+sch.cutoffHours || 0}"></label>
       <h3 style="font-size:22px;margin:22px 0 8px">Closed dates</h3>
       <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap"><label class="field">Date<input type="date" id="blkDate"></label><button class="btn sm" id="addBlk">Close this date</button></div>
       <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${[...sch.blocked].sort().map((d) => `<span class="chip">${niceDate(d)} <button class="btn sm ghost" style="padding:0 4px" data-unblk="${d}" aria-label="Reopen ${d}">×</button></span>`).join("") || '<span class="muted" style="font-size:13px">None. Close dates for sandstorms, Ramadan nights or full days.</span>'}</div>
       <div style="margin-top:20px"><button class="btn gold" id="saveSch">Save schedule</button></div>
     </div>
     <div class="panel"><h3 style="font-size:22px;margin-bottom:4px">Next 7 days</h3><p class="muted" style="margin:0 0 10px;font-size:13px">Guests from new, contacted and confirmed leads against slot capacity.</p>
       ${next.map((d) => {
         const closed = !sch.openDays.includes(weekday(d)) || sch.blocked.includes(d); const [, m, dd] = keyParts(d);
         return `<div class="load-row"><div><b>${DOW[weekday(d)]} ${dd}</b><div class="muted">${MON[m - 1]}</div></div>
         <div class="bars">${closed ? '<span class="pill st-cancelled">Closed</span>' : sch.slots.map((s) => { const b = bookedFor(d, s.id), c = +s.capacity || 1, pct = Math.min(100, (b / c) * 100);
           return `<div class="bar"><span>${esc(s.label)}</span><span class="track"><span class="fill${b >= c ? " full" : ""}" style="width:${pct}%;display:block"></span></span><span class="mono">${b}/${c}</span></div>`; }).join("")}</div></div>`;
       }).join("")}
     </div></div>`;
  }
  const readSlotsFromForm = () => $$("#slotRows .slot-row").map((r, i) => { const o = S.schedule.slots[i] || {}; return { id: o.id || "slot" + Date.now().toString(36) + i, label: $('[data-k="label"]', r).value.trim() || "Slot", time: $('[data-k="time"]', r).value || "15:00", capacity: +$('[data-k="capacity"]', r).value || 1 }; });
  async function saveSchedule() {
    const sch = { ...S.schedule, slots: readSlotsFromForm(), openDays: $$("[data-day]").filter((c) => c.checked).map((c) => +c.dataset.day), cutoffHours: +$("#cutoff").value || 0 };
    try { await api("/api/admin/settings/schedule", { method: "PUT", body: sch }); S.schedule = sch; renderSchedule(); toast("Schedule saved · live on the booking page"); }
    catch (e) { toast(e.message); }
  }

  /* ---------- packages ---------- */
  function renderPackagesAdmin() {
    const pane = $('[data-pane="packages"]');
    const list = [...S.packages].sort((a, b) => (a.order || 0) - (b.order || 0));
    pane.innerHTML = `<div class="toolbar"><button class="btn sm gold" id="newPkg">New package</button><span class="muted" style="font-size:13px">Changes show on the booking page as soon as you save.</span></div>
     <div class="grid2"><div class="pk-admin">${list.map((p) => `<div class="pk-line">
        <div style="min-width:0"><b>${esc(p.name)}</b> ${p.active === false ? '<span class="pill st-cancelled">Hidden</span>' : '<span class="pill st-confirmed">Live</span>'} ${p.popular ? '<span class="pill st-contacted">Most booked</span>' : ""}
        <div class="muted mono" style="font-size:13px">${aed(p.price)} ${p.unit === "vehicle" ? "/ car" : "/ adult"}${p.unit === "person" ? " · child " + aed(p.childPrice || p.price) : ""} · ${esc(p.duration)}</div></div>
        <div style="display:flex;gap:6px"><button class="btn sm" data-edit-pkg="${esc(p.id)}">Edit</button><button class="btn sm ghost danger" data-del-pkg="${esc(p.id)}">${armed === "pkg:" + p.id ? "Confirm" : "Delete"}</button></div></div>`).join("") || '<div class="note">No packages yet. Add your first package.</div>'}</div>
     <div id="pkEditor">${editingPkg ? pkgEditor(editingPkg) : '<div class="note">Choose a package to edit its price, timing and inclusions.</div>'}</div></div>`;
  }
  function pkgEditor(p) {
    return `<div class="panel"><h3 style="font-size:22px;margin-bottom:12px">${p._new ? "New package" : "Edit " + esc(p.name)}</h3><div class="fields">
     <label class="field full">Package name<input id="pe-name" value="${esc(p.name)}"></label>
     <label class="field">Type<select id="pe-type">${["Shared", "Private", "VIP"].map((t) => `<option ${t === p.type ? "selected" : ""}>${t}</option>`).join("")}</select></label>
     <label class="field">Priced per<select id="pe-unit"><option value="person" ${p.unit === "person" ? "selected" : ""}>Person</option><option value="vehicle" ${p.unit === "vehicle" ? "selected" : ""}>Vehicle</option></select></label>
     <label class="field">Price (${esc(S.business.currency || "AED")})<input id="pe-price" type="number" min="0" value="${+p.price || 0}"></label>
     <label class="field">Child price<input id="pe-child" type="number" min="0" value="${+p.childPrice || 0}"></label>
     <label class="field">Guests per vehicle<input id="pe-max" type="number" min="1" value="${+p.maxGuests || 6}"></label>
     <label class="field">Duration<input id="pe-dur" value="${esc(p.duration)}"></label>
     <label class="field">Time window shown<input id="pe-win" value="${esc(p.window)}"></label>
     <label class="field">Order on page<input id="pe-order" type="number" value="${+p.order || 1}"></label>
     <div class="field full">Pickup slots<div class="days">${S.schedule.slots.map((s) => `<label class="check" style="padding:6px 10px"><input type="checkbox" data-pslot="${esc(s.id)}" ${(p.slots || []).includes(s.id) ? "checked" : ""}>${esc(s.label)}</label>`).join("")}</div></div>
     <label class="field full">What's included (one per line)<textarea id="pe-inc" style="min-height:150px">${esc((p.inclusions || []).join("\n"))}</textarea></label>
     <label class="check"><input type="checkbox" id="pe-active" ${p.active !== false ? "checked" : ""}>Show on booking page</label>
     <label class="check"><input type="checkbox" id="pe-pop" ${p.popular ? "checked" : ""}>Mark “Most booked”</label></div>
     <div style="display:flex;gap:8px;margin-top:14px"><button class="btn gold" id="pe-save">Save package</button><button class="btn ghost" id="pe-cancel">Close</button></div></div>`;
  }
  async function savePkg() {
    const p = editingPkg, name = $("#pe-name").value.trim(); if (!name) { toast("Add a package name"); return; }
    const id = p._new ? (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pkg") + "-" + Date.now().toString(36).slice(-4) : p.id;
    const body = { id, name, type: $("#pe-type").value, unit: $("#pe-unit").value, price: +$("#pe-price").value || 0, childPrice: +$("#pe-child").value || 0, maxGuests: +$("#pe-max").value || 6,
      duration: $("#pe-dur").value.trim(), window: $("#pe-win").value.trim(), order: +$("#pe-order").value || 1, slots: $$("[data-pslot]").filter((c) => c.checked).map((c) => c.dataset.pslot),
      inclusions: $("#pe-inc").value.split("\n").map((s) => s.trim()).filter(Boolean), active: $("#pe-active").checked, popular: $("#pe-pop").checked };
    try {
      await api("/api/admin/packages/" + encodeURIComponent(id), { method: "PUT", body });
      const i = S.packages.findIndex((x) => x.id === id); if (i >= 0) S.packages[i] = body; else S.packages.push(body);
      editingPkg = null; renderPackagesAdmin(); toast("Package saved · live on the booking page");
    } catch (e) { toast(e.message); }
  }

  /* ---------- add-ons & business ---------- */
  function renderBusiness() {
    const b = S.business, pane = $('[data-pane="business"]');
    pane.innerHTML = `<div class="grid2"><div class="panel"><h3 style="font-size:22px;margin-bottom:4px">Add-ons</h3><p class="muted" style="margin:0 0 10px;font-size:13px">“Per person” multiplies by guests. “Per booking” is charged once.</p>
      <div id="adRows">${b.addons.map((a, i) => `<div class="ad-row" data-i="${i}"><label class="field">Name<input data-k="name" value="${esc(a.name)}"></label>
        <label class="field">Price<input data-k="price" type="number" min="0" value="${+a.price || 0}"></label>
        <label class="field">Charged<select data-k="unit"><option value="person" ${a.unit === "person" ? "selected" : ""}>Per person</option><option value="booking" ${a.unit === "booking" ? "selected" : ""}>Per booking</option></select></label>
        <button class="btn sm ghost danger" data-del-ad="${i}">Remove</button></div>`).join("")}</div>
      <button class="btn sm" id="addAd" style="margin-top:10px">Add add-on</button></div>
     <div class="panel"><h3 style="font-size:22px;margin-bottom:12px">Business details</h3><div class="fields">
      <label class="field full">WhatsApp number shown to customers<input id="bz-wa" value="${esc(b.whatsapp)}"></label>
      <label class="field full">Email shown to customers<input id="bz-email" value="${esc(b.email)}"></label>
      <label class="field">DTCM licence no.<input id="bz-lic" value="${esc(b.licence)}" placeholder="Shown in the footer"></label>
      <label class="field">Currency<input id="bz-cur" value="${esc(b.currency || "AED")}"></label></div>
      <p class="muted" style="font-size:13px;margin:12px 0 0">Where booking alerts go is set in Vercel (NOTIFY_EMAIL and NOTIFY_WHATSAPP). If those are empty, alerts go to the email and WhatsApp above.</p></div></div>
     <div style="margin-top:16px"><button class="btn gold" id="saveBiz">Save add-ons &amp; details</button></div>`;
  }
  const readAddons = () => $$("#adRows .ad-row").map((r, i) => ({ id: S.business.addons[i]?.id || "ad" + Date.now().toString(36) + i, name: $('[data-k="name"]', r).value.trim() || "Add-on", price: +$('[data-k="price"]', r).value || 0, unit: $('[data-k="unit"]', r).value }));
  async function saveBiz() {
    const b = { ...S.business, addons: readAddons(), whatsapp: $("#bz-wa").value.trim(), email: $("#bz-email").value.trim(), licence: $("#bz-lic").value.trim(), currency: $("#bz-cur").value.trim() || "AED" };
    try { await api("/api/admin/settings/business", { method: "PUT", body: b }); S.business = b; renderBusiness(); toast("Saved · live on the booking page"); }
    catch (e) { toast(e.message); }
  }

  /* ---------- events ---------- */
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.id === "logoutBtn") { await fetch("/api/admin/logout", { method: "POST" }); window.location.href = "/admin/login"; return; }
    if (t.dataset.tab) { tab = t.dataset.tab; armed = null; renderAdmin(); return; }
    if (t.id === "addLeadBtn" || t.id === "addLeadBtnX") { addLeadForm(); return; }
    if (t.id === "nlSave") { saveManualLead(); return; }
    if (t.dataset.delLead) {
      const k = "lead:" + t.dataset.delLead; if (armed !== k) { armed = k; renderLeads(); return; }
      armed = null; try { await api("/api/admin/leads/" + t.dataset.delLead, { method: "DELETE" }); S.leads = S.leads.filter((l) => l._id !== t.dataset.delLead); renderAdmin(); toast("Lead deleted"); } catch (er) { toast(er.message); } return;
    }
    if (t.id === "addSlot") { S.schedule.slots = readSlotsFromForm(); S.schedule.slots.push({ id: "slot" + Date.now().toString(36), label: "Sunrise", time: "05:30", capacity: 20 }); renderSchedule(); return; }
    if (t.dataset.delSlot) { S.schedule.slots = readSlotsFromForm(); S.schedule.slots.splice(+t.dataset.delSlot, 1); renderSchedule(); return; }
    if (t.id === "addBlk") { const v = $("#blkDate").value; if (v && !S.schedule.blocked.includes(v)) { S.schedule.slots = readSlotsFromForm(); S.schedule.blocked.push(v); renderSchedule(); } return; }
    if (t.dataset.unblk) { S.schedule.slots = readSlotsFromForm(); S.schedule.blocked = S.schedule.blocked.filter((d) => d !== t.dataset.unblk); renderSchedule(); return; }
    if (t.id === "saveSch") { saveSchedule(); return; }
    if (t.id === "newPkg") { editingPkg = { _new: true, name: "", type: "Shared", unit: "person", price: 0, childPrice: 0, maxGuests: 6, duration: "6 hours", window: "15:00 – 21:30", slots: S.schedule.slots.map((s) => s.id), inclusions: [], active: true, popular: false, order: S.packages.length + 1 }; renderPackagesAdmin(); return; }
    if (t.dataset.editPkg) { editingPkg = clone(S.packages.find((p) => p.id === t.dataset.editPkg)); renderPackagesAdmin(); return; }
    if (t.id === "pe-cancel") { editingPkg = null; renderPackagesAdmin(); return; }
    if (t.id === "pe-save") { savePkg(); return; }
    if (t.dataset.delPkg) {
      const k = "pkg:" + t.dataset.delPkg; if (armed !== k) { armed = k; renderPackagesAdmin(); return; }
      armed = null; try { await api("/api/admin/packages/" + encodeURIComponent(t.dataset.delPkg), { method: "DELETE" }); S.packages = S.packages.filter((p) => p.id !== t.dataset.delPkg); renderPackagesAdmin(); toast("Package deleted"); } catch (er) { toast(er.message); } return;
    }
    if (t.id === "addAd") { S.business.addons = readAddons(); S.business.addons.push({ id: "ad" + Date.now().toString(36), name: "", price: 0, unit: "person" }); renderBusiness(); return; }
    if (t.dataset.delAd) { S.business.addons = readAddons(); S.business.addons.splice(+t.dataset.delAd, 1); renderBusiness(); return; }
    if (t.id === "saveBiz") { saveBiz(); return; }
  });
  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.id === "lfStatus") { leadFilter = t.value; renderLeads(); return; }
    if (t.dataset.lead) {
      try { await api("/api/admin/leads/" + t.dataset.lead, { method: "PATCH", body: { status: t.value } }); const l = S.leads.find((x) => x._id === t.dataset.lead); if (l) l.status = t.value; renderAdmin(); toast("Marked " + t.value); }
      catch (er) { toast(er.message); }
    }
  });
  let searchTimer;
  document.addEventListener("input", (e) => {
    if (e.target.id !== "lfSearch") return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { leadSearch = e.target.value; renderLeads(); const i = $("#lfSearch"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250);
  });

  (async function start() {
    $("#liveChip").textContent = "Loading…";
    try { await loadConfig(); } catch (e) { $("#admGate").innerHTML = `<div class="note">Couldn't load settings: ${esc(e.message)}. Check the Supabase keys in Vercel.</div>`; return; }
    await loadLeads();
    setInterval(() => { if (!document.hidden) loadLeads(true); }, 20000);
  })();
})();
