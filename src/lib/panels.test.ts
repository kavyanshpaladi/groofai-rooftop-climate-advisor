import { describe, expect, it } from "vitest";
import { coveragePct, panelsForCoverage, layoutPanelBlock, layoutPanels, localFrame, panelCoverPct, ringArea, rowStarts, systemKw, type LL } from "./panels";
import { SAMPLE_ROOF_POLYGON } from "./roof";

const LAT = 17.4, LNG = 78.45, K = 111320 * Math.cos((LAT * Math.PI) / 180);
// Local metres (x east, y north) → [lat, lng] near Hyderabad.
const ll = ([x, y]: [number, number]): LL => [LAT + y / 110574, LNG + x / K];
const rect = (w: number, h: number): LL[] => [[0, 0], [w, 0], [w, h], [0, h]].map((p) => ll(p as [number, number]));
const rotated = (w: number, h: number, deg: number): LL[] => {
  const t = (deg * Math.PI) / 180;
  return ([[0, 0], [w, 0], [w, h], [0, h]] as [number, number][]).map(([x, y]) => ll([x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]));
};
// L-shaped roof of about 1000 m²: 40 × 30 m with a 20 × 10 m corner cut out.
const L_ROOF = ([[0, 0], [40, 0], [40, 20], [20, 20], [20, 30], [0, 30]] as [number, number][]).map(ll);

function inPoly([x, y]: [number, number], poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function edgeDist([px, py]: [number, number], [ax, ay]: [number, number], [bx, by]: [number, number]) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

describe("systemKw", () => {
  it("is 0.4 kW per 400 W panel (7 panels → 2.8 kW)", () => {
    expect(systemKw(7)).toBeCloseTo(2.8, 9);
  });
});

describe("layoutPanels fills the roof", () => {
  it("fills a 20 × 15 m roof with 120 panels (10 across × 12 rows), not just a typical home's 7", () => {
    const l = layoutPanels(rect(20, 15));
    expect(l.count).toBe(120);
    expect(l.kw).toBeCloseTo(48, 6);
    expect(l.area).toBeCloseTo(120 * 1.7, 5);
  });

  it("turns with the roof: the same roof rotated 30° fits the same 120 panels", () => {
    expect(layoutPanels(rotated(20, 15, 30)).count).toBe(120);
  });

  it("keeps every panel corner inside the outline and at least 0.6 m from every edge (L-shaped roof)", () => {
    const l = layoutPanels(L_ROOF);
    const { pts } = localFrame([...L_ROOF, ...l.panels.flat()]);
    const poly = pts.slice(0, L_ROOF.length), corners = pts.slice(L_ROOF.length);
    for (const c of corners) {
      expect(inPoly(c, poly)).toBe(true);
      for (let i = 0; i < poly.length; i++) expect(edgeDist(c, poly[i]!, poly[(i + 1) % poly.length]!)).toBeGreaterThanOrEqual(0.6 - 1e-6);
    }
  });

  it("fills most of an L-shaped ~1000 m² roof", () => {
    expect(ringArea(L_ROOF)).toBeCloseTo(1000, 0);
    const l = layoutPanels(L_ROOF);
    expect(l.area / 1000).toBeGreaterThan(0.6);
  });

  it("never overlaps two panels", () => {
    const l = layoutPanels(L_ROOF);
    const { pts } = localFrame([...L_ROOF, ...l.panels.flat()]);
    const boxes = l.panels.map((_, i) => {
      const c = pts.slice(L_ROOF.length + i * 4, L_ROOF.length + i * 4 + 4);
      return { x0: Math.min(...c.map((q) => q[0])), x1: Math.max(...c.map((q) => q[0])), y0: Math.min(...c.map((q) => q[1])), y1: Math.max(...c.map((q) => q[1])) };
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.05 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.05;
      expect(overlap).toBe(false);
    }
  });

  it("adds no walkway when 24 rows or fewer fit", () => {
    // 26.3 m of free roof fits exactly 24 one-metre rows with 0.1 m gaps
    const ys = rowStarts(26.3, 1.0);
    expect(ys).toHaveLength(24);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeCloseTo(1.1, 9);
  });

  it("adds a 1 m walkway after every 8 rows when more than 24 rows fit", () => {
    const ys = rowStarts(38.8, 1.0); // 35 rows without walkways
    expect(ys).toHaveLength(32);
    expect(ys[8]! - ys[7]!).toBeCloseTo(2.0, 9); // 1 m panel + 1 m walkway
    expect(ys[16]! - ys[15]!).toBeCloseTo(2.0, 9);
    expect(ys[7]! - ys[6]!).toBeCloseTo(1.1, 9);
  });

  it("fits panels on the notched sample roof", () => {
    expect(layoutPanels(SAMPLE_ROOF_POLYGON).count).toBeGreaterThan(100);
  });

  it("fits nothing on a roof smaller than one panel plus setback", () => {
    expect(layoutPanels(rect(2, 1.5)).count).toBe(0);
  });
});

describe("ringArea / panelCoverPct", () => {
  it("measures a 20 × 15 m roof as 300 m²", () => {
    expect(ringArea(rect(20, 15))).toBeCloseTo(300, 0);
  });
  it("cover % = panel area ÷ usable area, rounded", () => {
    expect(panelCoverPct(11.9, 100)).toBe(12);
  });
  it("cover % is capped at 100", () => {
    expect(panelCoverPct(250, 200)).toBe(100);
  });
});

describe("layoutPanelBlock", () => {
  it("places exactly the recommended count (6 panels) as a compact centered block inside the sample roof", () => {
    const b = layoutPanelBlock(SAMPLE_ROOF_POLYGON, 6);
    expect(b.count).toBe(6);
    expect(b.kw).toBeCloseTo(2.4, 6);
    expect(b.area).toBeCloseTo(6 * 1.7, 5);
    const { pts } = localFrame([...SAMPLE_ROOF_POLYGON, ...b.panels.flat()]);
    const poly = pts.slice(0, SAMPLE_ROOF_POLYGON.length), corners = pts.slice(SAMPLE_ROOF_POLYGON.length);
    for (const c of corners) {
      expect(inPoly(c, poly)).toBe(true);
      for (let i = 0; i < poly.length; i++) expect(edgeDist(c, poly[i]!, poly[(i + 1) % poly.length]!)).toBeGreaterThanOrEqual(0.6 - 1e-6);
    }
  });

  it("places 2 panels for a low-budget recommendation and stays inside an L-shaped roof", () => {
    const b = layoutPanelBlock(L_ROOF, 2);
    expect(b.count).toBe(2);
    expect(b.kw).toBeCloseTo(0.8, 6);
    const { pts } = localFrame([...L_ROOF, ...b.panels.flat()]);
    const poly = pts.slice(0, L_ROOF.length), corners = pts.slice(L_ROOF.length);
    for (const c of corners) expect(inPoly(c, poly)).toBe(true);
  });

  it("caps at the roof maximum when more panels are requested than fit", () => {
    const small = rect(5, 4);
    const max = layoutPanels(small).count;
    expect(layoutPanelBlock(small, 50).count).toBe(max);
  });
});

describe("editable roof coverage", () => {
  // one panel with gaps takes 1.8 × 1.1 = 1.98 m²
  it("percent → whole panels: round(percent/100 × usable ÷ 1.98)", () => {
    expect(panelsForCoverage(40, 100, 50)).toBe(20);
  });
  it("is at least 1 panel and never more than fit on the roof", () => {
    expect(panelsForCoverage(1, 20, 50)).toBe(1);
    expect(panelsForCoverage(100, 100, 30)).toBe(30);
  });
  it("0, over 100 and non-numbers fall back to the nearest valid percent", () => {
    expect(panelsForCoverage(0, 100, 50)).toBe(panelsForCoverage(1, 100, 50));
    expect(panelsForCoverage(250, 100, 80)).toBe(panelsForCoverage(100, 100, 80));
    expect(panelsForCoverage(NaN, 100, 50)).toBe(1);
  });
  it("shows the actual percent after rounding to whole panels", () => {
    expect(coveragePct(20, 100)).toBe(40);
    expect(coveragePct(3, 20)).toBe(30);
  });
});
