import { useState } from "react";
import { searchAddress, type Place } from "@/lib/geocode";

export function SearchBox({ onResult }: { onResult: (p: Place) => void }) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const p = await searchAddress(q);
      if (p) onResult(p); else setMsg("No place found.");
    } catch { setMsg("Search is unavailable right now."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an address"
          className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring" />
        <button disabled={busy} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm disabled:opacity-60">{busy ? "…" : "Go"}</button>
      </div>
      {msg && <p className="mt-1 rounded bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">{msg}</p>}
    </form>
  );
}
