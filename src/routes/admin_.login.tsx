import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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

  // Coming back from Google (or already signed in): go straight to the dashboard.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function signInWithGoogle() {
    setBusy(true);
    setMsg(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/admin/login`,
    });
    if (result.error) {
      setBusy(false);
      return setMsg({ kind: "error", text: result.error.message || "Google sign-in failed. Please try again." });
    }
    if (result.redirected) return;
    navigate({ to: "/admin", replace: true });
  }

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
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-md border px-3 text-sm font-medium leading-5 transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#747775", color: "#1F1F1F" }}
      >
        <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
        Continue with Google
      </button>
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={submit} className="space-y-3">
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
