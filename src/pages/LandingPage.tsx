import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { RoofCounter } from "@/components/RoofCounter";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import greenerImg from "@/assets/greener_rooftop.png.asset.json";
import { Sun, Leaf, Droplets, Snowflake, ArrowRight, MapPin, ListChecks, Sparkles } from "lucide-react";

const HERO = "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80";

const features = [
  { icon: Snowflake, title: "Cooler", stat: "Up to 5 °C cooler indoors", text: "A white reflective coating bounces up to 80% of sunlight back to the sky. Rooms under the roof stay cooler, fans and ACs work less, and your whole street feels less like an oven on summer afternoons.", points: ["Cheapest upgrade", "Done in a day"], img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=800&q=80" },
  { icon: Leaf, title: "Greener", stat: "Soaks up to 70% of rain", text: "A rooftop garden insulates your home, holds back storm water, filters dust from the air and gives birds and bees a place to live. It turns bare concrete into a calm green space you can actually enjoy.", points: ["Natural insulation", "Cleaner air"], img: greenerImg.url },
  { icon: Sun, title: "Cleaner", stat: "Cut your power bill up to 90%", text: "Solar panels turn your idle roof into a silent power plant. Every panel saves tonnes of carbon over its 25-year life and pays itself back in a few years through lower electricity bills.", points: ["25-year lifespan", "Pays itself back"], img: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=800&q=80" },
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
  const { t, tx } = useI18n();
  return (
    <main className="min-h-dvh bg-background">
      <section className="relative overflow-hidden">
        <img src={HERO} alt={t("heroAlt")} className="hero-zoom absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/80 via-foreground/60 to-background" />
        <LanguageSwitcher className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6" />
        <div className="relative mx-auto max-w-5xl px-5 pb-24 pt-20 sm:pt-32">
          <p className="mb-4 inline-flex rounded-full border border-primary-foreground/30 bg-primary/30 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground backdrop-blur">groofai</p>
          <h1 className="hero-3d max-w-3xl text-4xl font-black leading-[1.05] text-primary-foreground sm:text-7xl">{t("heroTitle")}</h1>
          <p className="mt-6 max-w-xl text-lg text-primary-foreground/85">{t("heroText")}</p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="h-14 px-8 text-base shadow-xl"><Link to="/map">{t("heroCta")} <ArrowRight /></Link></Button>
            <span className="text-sm text-primary-foreground/80"><Droplets className="mr-1 inline size-4" />{t("heroNote")}</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">{tx("Three upgrades, one roof")}</p>
        <h2 className="mt-2 text-3xl font-black text-foreground sm:text-5xl">{tx("Three ways your roof can fight climate change")}</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{tx("Cities trap heat, flood in heavy rain and burn fossil fuels for power. Your roof can help with all three. groofai checks your local sun, heat and rainfall to show which upgrade gives your roof the biggest win.")}</p>
        <div className="mt-12 grid gap-8 sm:grid-cols-3 [perspective:1000px]">
          {features.map((f) => (
            <article key={f.title} className="feature-card group relative overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
              <div className="relative h-52 overflow-hidden">
                <img src={f.img} alt={tx(f.title)} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/10 to-transparent" />
                <span className="absolute left-4 top-4 grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"><f.icon className="size-6" /></span>
                <h3 className="absolute bottom-3 left-4 text-3xl font-black text-primary-foreground">{tx(f.title)}</h3>
              </div>
              <div className="p-6">
                <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{tx(f.stat)}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tx(f.text)}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {f.points.map((pt) => <li key={pt} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground">✓ {tx(pt)}</li>)}
                </ul>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100" />
            </article>
          ))}
        </div>
      </section>

      <section className="howitworks text-primary-foreground">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <p className="badge-glow mb-5 inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary shadow-xl"><span className="badge-dot size-2 rounded-full bg-primary" />{tx("Two minutes")}<span className="text-sun">✦</span>{tx("No sign-up")}</p>
          <h2 className="text-3xl font-bold sm:text-4xl">{tx("How it works")}</h2>
          <p className="mt-3 max-w-2xl text-base text-primary-foreground/85">{tx("Three steps from a blank rooftop to a decision you can explain — every number comes from your building's own sunlight, heat and rain.")}</p>
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
                <h3 className="mt-4 text-lg font-bold text-foreground">{tx(s.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tx(s.text)}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild variant="secondary" size="lg" className="h-12 px-6"><Link to="/map">{tx("Start now")} <ArrowRight /></Link></Button>
            <RoofCounter />
          </div>
        </div>
      </section>

      <footer className="bg-footer-bg py-8 text-center">
        <p className="text-sm font-medium text-footer-foreground">© {new Date().getFullYear()} {tx("groofai. All rights reserved.")}</p>
      </footer>
    </main>
  );
}
