import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function RoofCounter() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    supabase.rpc("get_roof_count").then(({ data, error }) => { if (!error && data != null) setCount(Number(data)); }, () => {});
  }, []);
  if (count === null) return null;
  return <p className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2 text-sm font-semibold text-primary-foreground backdrop-blur"><span className="size-2 rounded-full bg-leaf" />{count.toLocaleString("en-IN")} {count === 1 ? "roof" : "roofs"} advised</p>;
}
