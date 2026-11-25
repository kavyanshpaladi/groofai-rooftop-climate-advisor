import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export function RoofCounter() {
  const { tx } = useI18n();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    // The counter is optional: with no backend connected the client throws on first use, so stay hidden instead of crashing the page.
    try {
      supabase.rpc("get_roof_count").then(({ data, error }) => { if (!error && data != null) setCount(Number(data)); }, () => {});
    } catch {
      setCount(null);
    }
  }, []);
  if (count === null) return null;
  return <p className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2 text-sm font-semibold text-primary-foreground backdrop-blur"><span className="size-2 rounded-full bg-leaf" />{count.toLocaleString("en-IN")} {tx(count === 1 ? "roof advised" : "roofs advised")}</p>;
}
