export type Answers = {
  roofType: "flat" | "sloped";
  shade: "none" | "some" | "heavy";
  access: "easy" | "limited";
  priority: "bill" | "cooler" | "garden" | "rainwater";
  budget: "low" | "medium" | "high";
};

export type ScoreInputs = { usable: number; irradiance: number; maxTemp: number; rainfall: number };

export type OptionId = "solar" | "green" | "reflective" | "rainwater" | "hybrid";
export type OptionScore = { id: OptionId; name: string; score: number; reasons: string[] };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function scorer() {
  let score = 50;
  const reasons: string[] = [];
  return {
    add(cond: boolean, delta: number, reason: string) {
      if (!cond) return;
      score += delta;
      reasons.push(reason);
    },
    done: () => ({ score: clamp(score), reasons }),
  };
}

export function scoreOptions(a: Answers, i: ScoreInputs): OptionScore[] {
  const s = scorer();
  s.add(i.irradiance >= 5, 20, "Your area gets strong sunshine.");
  s.add(i.usable >= 30, 10, "There is enough roof space for panels.");
  s.add(a.shade === "heavy", -25, "Heavy shade cuts solar output a lot.");
  s.add(a.shade === "some", -10, "Some shade reduces solar output.");
  s.add(a.roofType === "sloped", -15, "Sloped roofs make mounting harder.");
  s.add(a.priority === "bill", 10, "It directly lowers your electricity bill.");
  s.add(a.budget === "low", -15, "Solar needs a larger upfront budget.");
  const solar = s.done();

  const g = scorer();
  g.add(a.priority === "garden", 20, "You want a garden, and this gives you one.");
  g.add(a.priority === "cooler", 10, "Plants help keep rooms below cooler.");
  g.add(a.shade !== "none", 10, "Shade suits many rooftop plants.");
  g.add(a.roofType === "sloped", -20, "Gardens need a flat roof.");
  g.add(a.access === "limited", -15, "Limited access makes upkeep hard.");
  g.add(a.budget === "low", -15, "Waterproofing and soil add cost.");
  g.add(i.rainfall < 500, -10, "Low rainfall means more watering.");
  const green = g.done();

  const r = scorer();
  r.add(i.maxTemp >= 37, 25, "Your summers are hot, so a reflective roof helps most.");
  r.add(a.priority === "cooler", 15, "It is the quickest way to cooler rooms.");
  r.add(a.budget === "low", 10, "It is the cheapest upgrade.");
  r.add(a.shade === "heavy", -10, "Heavy shade already keeps the roof cool.");
  const reflective = r.done();

  const w = scorer();
  w.add(i.rainfall >= 600, 20, "You get plenty of rain to collect.");
  w.add(a.priority === "rainwater", 25, "You want to save rainwater.");
  w.add(i.usable >= 30, 10, "A larger roof catches more water.");
  w.add(a.budget === "low", -10, "Tanks and filters add cost.");
  const rainwater = w.done();

  const base: OptionScore[] = [
    { id: "solar", name: "Solar", ...solar },
    { id: "green", name: "Green roof", ...green },
    { id: "reflective", name: "Reflective roof", ...reflective },
    { id: "rainwater", name: "Rainwater harvesting", ...rainwater },
  ];

  let hybrid: OptionScore;
  if (i.usable < 40) {
    hybrid = { id: "hybrid", name: "Hybrid", score: 0, reasons: ["The roof is too small to combine options."] };
  } else {
    const top = [...base].sort((x, y) => y.score - x.score).slice(0, 2);
    hybrid = {
      id: "hybrid",
      name: "Hybrid",
      score: clamp((top[0]!.score + top[1]!.score) / 2 + 5),
      reasons: [`Combines ${top[0]!.name.toLowerCase()} and ${top[1]!.name.toLowerCase()}.`, "Your roof has room for both."],
    };
  }

  return [...base, hybrid].sort((x, y) => y.score - x.score);
}
