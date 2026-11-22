import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin_/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin sign in — RoofWise" },
      { name: "description", content: "Sign in to the RoofWise admin dashboard." },
      { property: "og:title", content: "Admin sign in — RoofWise" },
      { property: "og:description", content: "Sign in to the RoofWise admin dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg({ kind: "error", text: error.message });
      navigate({ to: "/admin", replace: true });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
      setBusy(false);
      if (error) return setMsg({ kind: "error", text: error.message });
      setMsg({ kind: "info", text: "Check your email and click the confirmation link, then sign in." });
      setMode("signin");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <p className="text-sm font-semibold text-primary">RoofWise admin</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">{mode === "signin" ? "Sign in" : "Create account"}</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        {msg && <p className={msg.kind === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>{msg.text}</p>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
      </form>
      <Button variant="link" className="mt-2" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
      </Button>
      <Button asChild variant="link"><Link to="/">← Back to home</Link></Button>
    </main>
  );
}
