import { createFileRoute } from "@tanstack/react-router";
import { ResultsPage } from "@/pages/ResultsPage";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Your rooftop report — groofai" },
      { name: "description", content: "Suitability scores and rough impact estimates for your rooftop upgrade." },
      { property: "og:title", content: "Your rooftop report — groofai" },
      { property: "og:description", content: "See which climate upgrade fits your roof best." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});
