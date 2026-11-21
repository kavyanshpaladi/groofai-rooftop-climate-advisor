import { Link } from "@tanstack/react-router";

const cards = [
  { title: "Cooler", text: "Reflective and green roofs lower indoor heat." },
  { title: "Greener", text: "Rooftop gardens bring plants back to the city." },
  { title: "Cleaner", text: "Solar panels turn sunlight into clean power." },
];

export function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-5 py-12">
      <p className="mb-3 text-sm font-semibold tracking-wide text-primary">RoofWise</p>
      <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-5xl">Find the best climate upgrade for your rooftop</h1>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold text-primary">{c.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
          </div>
        ))}
      </div>
      <Link to="/map" className="mt-10 w-fit rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90">Find my roof</Link>
    </main>
  );
}
