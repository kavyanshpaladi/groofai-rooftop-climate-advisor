import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const RoofMap = lazy(() => import("@/components/RoofMap"));
const Fallback = () => <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">Loading map…</div>;

export function MapPage() {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}><RoofMap /></Suspense>
    </ClientOnly>
  );
}
