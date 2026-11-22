import { createFileRoute } from "@tanstack/react-router";
import { MapPage } from "@/pages/MapPage";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Find my roof — GroofAI" },
      { name: "description", content: "Select or draw your roof on a satellite map to measure its area." },
      { property: "og:title", content: "Find my roof — GroofAI" },
      { property: "og:description", content: "Select or draw your roof to measure its usable area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});
