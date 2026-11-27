import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Find my roof — groofai" },
      { name: "description", content: "Select or draw your roof on a satellite map to measure its area." },
      { property: "og:title", content: "Find my roof — groofai" },
      { property: "og:description", content: "Select or draw your roof to measure its usable area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const RoofMap = lazy(() => import("@/components/RoofMap"));
const Fallback = () => <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">Loading map…</div>;

function MapPage() {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}><RoofMap /></Suspense>
    </ClientOnly>
  );
}
