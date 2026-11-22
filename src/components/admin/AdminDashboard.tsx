import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { computeStats, optionLabel, OPTIONS, toCsv, type ReportRow } from "./stats";

const ReportsMap = lazy(() => import("./ReportsMap"));
const num = (n: number) => Math.round(n).toLocaleString("en-IN");

export function AdminDashboard({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
        <h1 className="text-2xl font-bold text-foreground">Not authorised</h1>
        <p className="mt-2 text-sm text-muted-foreground">{email} does not have admin access.</p>
        <div className="mt-6 flex gap-2">
          <Button asChild><Link to="/">Back to home</Link></Button>
          <Button variant="outline" onClick={logout}>Logout</Button>
        </div>
      </main>
    );
  }
  return <Dashboard email={email} onLogout={logout} />;
}

function Dashboard({ email, onLogout }: { email: string; onLogout: () => void }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const { data: rows, isLoading, error } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roof_reports").select("id,created_at,latitude,longitude,roof_area,usable_area,answers,best_option,estimates").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as ReportRow[];
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roof_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  const stats = useMemo(() => computeStats(rows ?? []), [rows]);
  const filtered = useMemo(() => (rows ?? []).filter((r) => filter === "all" || r.best_option === filter), [rows, filter]);
  const latest = filtered.slice(0, 50);
  const maxCount = Math.max(1, ...Object.values(stats.counts));

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `roof-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const cards = [
    { label: "Total roofs advised", value: num(stats.total) },
    { label: "Today", value: num(stats.today) },
    { label: "Last 7 days", value: num(stats.week) },
    { label: "Avg usable area", value: `${num(stats.avgUsable)} m²` },
    { label: "Est. yearly solar", value: `${num(stats.kwh)} kWh` },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">RoofWise admin</p>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
          <Button variant="outline" onClick={onLogout}>Logout</Button>
        </div>
      </header>

      {error && <p className="mb-4 rounded-lg bg-muted p-3 text-sm text-destructive">Could not load reports.</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            {isLoading ? <div className="mt-2 h-7 w-20 animate-pulse rounded bg-muted" /> : <p className="mt-1 text-2xl font-bold text-primary">{c.value}</p>}
          </div>
        ))}
      </section>

      {!isLoading && !rows?.length ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">No reports yet</div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-semibold text-foreground">Best option recommended</h2>
              {isLoading ? <div className="h-40 animate-pulse rounded bg-muted" /> : (
                <ul className="space-y-2">
                  {OPTIONS.map((o) => {
                    const n = stats.counts[o.id] ?? 0;
                    return (
                      <li key={o.id} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{o.label}</span>
                        <div className="h-5 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${(n / maxCount) * 100}%` }} /></div>
                        <span className="text-right font-medium text-foreground">{n}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              {isLoading ? <div className="h-80 animate-pulse rounded-xl bg-muted" /> : (
                <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}><ReportsMap rows={rows ?? []} /></Suspense>
              )}
            </div>
          </section>

          <section className="mt-6 rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-foreground">Latest reports</h2>
              <div className="flex gap-2">
                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  <option value="all">All options</option>
                  {OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-2 pr-3">Date</th><th className="pr-3">Best option</th><th className="pr-3">Roof area</th><th className="pr-3">Priority</th><th className="pr-3">Budget</th><th /></tr>
                </thead>
                <tbody>
                  {isLoading && [0, 1, 2].map((i) => <tr key={i}><td colSpan={6} className="py-2"><div className="h-6 animate-pulse rounded bg-muted" /></td></tr>)}
                  {latest.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="pr-3">{optionLabel(r.best_option)}</td>
                      <td className="pr-3">{num(Number(r.roof_area ?? 0))} m²</td>
                      <td className="pr-3 capitalize">{String(r.answers?.["priority"] ?? "—")}</td>
                      <td className="pr-3 capitalize">{String(r.answers?.["budget"] ?? "—")}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" className="text-destructive" disabled={del.isPending}
                          onClick={() => { if (window.confirm("Delete this report? This cannot be undone.")) del.mutate(r.id); }}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && !latest.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No reports yet</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
