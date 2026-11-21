import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/pages/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RoofWise — Climate upgrades for your rooftop" },
      { name: "description", content: "Find the best climate upgrade for your rooftop: cooler, greener, cleaner." },
      { property: "og:title", content: "RoofWise — Climate upgrades for your rooftop" },
      { property: "og:description", content: "Find the best climate upgrade for your rooftop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPage,
});
