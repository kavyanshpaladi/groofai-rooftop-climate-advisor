import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { RoofCounter } from "@/components/RoofCounter";
import greenerImg from "@/assets/greener_rooftop.png.asset.json";
import { Sun, Leaf, Droplets, Snowflake, ArrowRight, MapPin, ListChecks, Sparkles } from "lucide-react";

const HERO = "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80";

const features = [
  { icon: Snowflake, title: "Cooler", text: "Reflective coatings bounce sunlight away and cut indoor heat by several degrees.", img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=800&q=80" },
  { icon: Leaf, title: "Greener", text: "Rooftop gardens absorb rain, clean the air and bring life back to the city.", img: greenerImg.url },
  { icon: Sun, title: "Cleaner", text: "Solar panels turn your idle roof into a quiet power plant that lowers your bill.", img: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=800&q=80" },
];

const steps = [
  {
    n: "01",
    title: "Find your roof",
    text: "Open the live satellite map, search your address or draw the outline by hand. groofai measures the roof area and the usable part of it in seconds.",
    icon: MapPin,
    bar: "bg-rain",
    chip: "bg-rain/15 text-rain",
    num: "text-rain",
  },
  {
    n: "02",
    title: "Answer five questions",
    text: "Roof type, how much shade it gets, how you reach it, what matters most to you and your budget. About two minutes, no sign-up and nothing stored.",
    icon: ListChecks,
    bar: "bg-sun",
    chip: "bg-sun/20 text-sun",
    num: "text-sun",
  },
  {
    n: "03",
    title: "Get your best fit",
    text: "Solar, a rooftop garden, a cool reflective coating or rain harvesting are ranked against your local sun, heat and rain — with plain-language reasons.",
    icon: Sparkles,
    bar: "bg-leaf",
    chip: "bg-leaf/20 text-leaf",
    num: "text-leaf",
  },
];

export function LandingPage() {
  return (
    <main className="min-h-dvh bg-background">
      <section className="relative overflow-hidden">
        <img src={HERO} alt="Solar panels on a sunny rooftop" className="hero-zoom absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/80 via-foreground/60 to-background" />
        <div className="relative mx-auto max-w-5xl px-5 pb-24 pt-20 sm:pt-32">
          <p className="mb-4 inline-flex rounded-full border border-primary-foreground/30 bg-primary/30 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground backdrop-blur">groofai</p>
          <h1 className="hero-3d max-w-3xl text-4xl font-black leading-[1.05] text-primary-foreground sm:text-7xl">Find the best climate upgrade for your rooftop</h1>
          <p className="mt-6 max-w-xl text-lg text-primary-foreground/85">Your roof is the most underused space you own. groofai reads satellite imagery and local sun, heat and rain data to tell you whether solar, a garden, a cool coating or rain harvesting fits you best — free, in two minutes.</p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="h-14 px-8 text-base shadow-xl"><Link to="/map">Find my roof <ArrowRight /></Link></Button>
            <span className="text-sm text-primary-foreground/80"><Droplets className="mr-1 inline size-4" />No sign-up. No cost.</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-3xl font-bold text-foreground sm:text-4xl">Three ways your roof can fight climate change</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3 [perspective:1000px]">
          {features.map((f) => (
            <article key={f.title} className="card-3d group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-xl">
              <div className="h-44 overflow-hidden"><img src={f.img} alt={f.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" /></div>
              <div className="p-5">
                <f.icon className="size-6 text-primary" />
                <h3 className="mt-2 text-xl font-bold text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="howitworks text-primary-foreground">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <p className="mb-4 inline-flex rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] backdrop-blur">Two minutes · no sign-up</p>
          <h2 className="text-3xl font-bold sm:text-4xl">How it works</h2>
          <p className="mt-3 max-w-2xl text-base text-primary-foreground/85">Three steps from a blank rooftop to a decision you can explain — every number comes from your building's own sunlight, heat and rain.</p>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3 [perspective:1000px]">
            {steps.map((s) => (
              <li key={s.n} className="card-3d relative rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl">
                <span className={`inline-block h-1.5 w-12 rounded-full ${s.bar}`} />
                <div className="mt-4 flex items-start justify-between">
                  <span className={`grid size-11 place-items-center rounded-xl ${s.chip}`}>
                    <s.icon className="size-5" />
                  </span>
                  <span className={`text-4xl font-black leading-none ${s.num}`}>{s.n}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild variant="secondary" size="lg" className="h-12 px-6"><Link to="/map">Start now <ArrowRight /></Link></Button>
            <RoofCounter />
          </div>
        </div>
      </section>

      <footer className="bg-footer-bg py-8 text-center">
        <p className="text-sm font-medium text-footer-foreground">© {new Date().getFullYear()} groofai. All rights reserved.</p>
      </footer>
    </main>
  );
}
