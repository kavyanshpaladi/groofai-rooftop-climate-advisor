/** True when a database is connected. The generated client throws on first use without one, so pages check this before touching it. */
export function backendConnected(): boolean {
  return Boolean(import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
}
