"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) { window.location.href = "/admin"; return; }
    const j = await r.json().catch(() => ({}));
    setErr(j.error || "Couldn't log in."); setBusy(false);
  }
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingBlock: "12vh" }}>
      <div className="eyebrow">Dune Falcon Dubai</div>
      <h1 style={{ fontSize: 32, margin: "6px 0 20px" }}>Admin login</h1>
      <form className="panel" onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <label className="field">Password
          <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        <div className="err">{err}</div>
        <button className="btn gold" disabled={busy || !pw}>{busy ? "Checking…" : "Log in"}</button>
      </form>
    </main>
  );
}
