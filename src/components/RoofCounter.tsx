import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function RoofCounter() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    supabase.rpc("get_roof_count").then(({ data, error }) => { if (!error && data != null) setCount(Number(data)); }, () => {});
  }, []);
  if (count === null) return null;
  return <p className="mt-4 text-sm font-medium text-primary">{count.toLocaleString("en-IN")} roofs advised</p>;
}
