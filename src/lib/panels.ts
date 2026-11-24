// Fills a roof outline with real solar panel rectangles, working in local metres.
export type LL = [number, number]; // [lat, lng]
type XY = [number, number];

export const PANEL_W = 1.7, PANEL_H = 1.0, PANEL_GAP = 0.1, PANEL_SETBACK = 0.6, PANEL_WATTS = 400;
export const PANEL_KW = PANEL_WATTS / 1000;
export const panelArea = PANEL_W * PANEL_H;
/** Rows are split by a walkway every WALKWAY_EVERY rows, but only on roofs with more than WALKWAY_MIN_ROWS rows. */
export const WALKWAY_M = 1.0, WALKWAY_EVERY = 8, WALKWAY_MIN_ROWS = 24;
/** Most panels drawn on the preview map; the count and numbers still use every panel. */
export const MAX_DRAWN_PANELS = 3000;

/** System size for a panel count: 0.4 kW per 400 W panel. */
export const systemKw = (count: number) => count * PANEL_KW;

const M_LAT = 110574, M_LNG = 111320;

/** Outline as a local metre frame around its vertex centroid, plus a way back to lat/lng. */
export function localFrame(ring: LL[]) {
  const lat0 = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lng0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const k = M_LNG * Math.cos((lat0 * Math.PI) / 180);
  const toXY = ([lat, lng]: LL): XY => [(lng - lng0) * k, (lat - lat0) * M_LAT];
  const toLL = ([x, y]: XY): LL => [lat0 + y / M_LAT, lng0 + x / k];
  return { pts: ring.map(toXY), toLL };
}

/** Area of the outline in m² (shoelace in local metres). */
export function ringArea(ring: LL[]): number {
  if (ring.length < 3) return 0;
  const { pts } = localFrame(ring);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

function inside([x, y]: XY, poly: XY[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function segDist([px, py]: XY, [ax, ay]: XY, [bx, by]: XY) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function segsCross(a: XY, b: XY, c: XY, d: XY) {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** Convex hull (monotone chain), used to find the roof's main direction. */
function hull(pts: XY[]): XY[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lo: XY[] = [], hi: XY[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2]!, hi[hi.length - 1]!, q) <= 0) hi.pop(); hi.push(q); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}

/**
 * Angle (radians) that turns the roof so its minimum-area bounding rectangle is axis-aligned
 * with the long side horizontal.
 */
export function roofAngle(pts: XY[]): number {
  const h = hull(pts);
  let best = 0, bestArea = Infinity, bestWide = true;
  for (let i = 0; i < h.length; i++) {
    const a = h[i]!, b = h[(i + 1) % h.length]!;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(-ang), s = Math.sin(-ang);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of h) {
      const rx = x * c - y * s, ry = x * s + y * c;
      x0 = Math.min(x0, rx); x1 = Math.max(x1, rx); y0 = Math.min(y0, ry); y1 = Math.max(y1, ry);
    }
    const area = (x1 - x0) * (y1 - y0);
    if (area < bestArea - 1e-9) { bestArea = area; best = ang; bestWide = x1 - x0 >= y1 - y0; }
  }
  return bestWide ? best : best + Math.PI / 2;
}

/**
 * Where each panel row starts across `span` metres of free roof, for panels `h` metres tall:
 * 0.1 m between rows, widened to a 1 m walkway after every 8 rows only when more than 24 rows fit.
 */
export function rowStarts(span: number, h: number): number[] {
  const plainRows = Math.max(0, Math.floor((span + PANEL_GAP + 1e-9) / (h + PANEL_GAP)));
  const walkway = plainRows > WALKWAY_MIN_ROWS;
  const ys: number[] = [];
  for (let r = 0; ; r++) {
    const y = r * (h + PANEL_GAP) + (walkway ? Math.floor(r / WALKWAY_EVERY) * (WALKWAY_M - PANEL_GAP) : 0);
    if (y + h > span + 1e-9) break;
    ys.push(y);
  }
  return ys;
}

export type PanelLayout = {
  /** Every placed panel as 4 [lat, lng] corners: a→b runs along the panel's width, a→d along its height. */
  panels: LL[][];
  count: number;
  /** Total panel area in m². */
  area: number;
  kw: number;
  angle: number;
  portrait: boolean;
  rows: number;
};

export const EMPTY_LAYOUT: PanelLayout = { panels: [], count: 0, area: 0, kw: 0, angle: 0, portrait: false, rows: 0 };

/**
 * Fills the outline with 1.7 × 1.0 m panels in straight rows (0.1 m gaps), turned to the roof's
 * main direction. A panel is kept only if it sits fully inside the outline and at least 0.6 m from
 * every roof edge, so notches and concave parts are skipped. Landscape and portrait panels, each
 * with two grid offsets, are tried and the layout with the most panels wins.
 */
export function layoutPanels(ring: LL[]): PanelLayout {
  if (ring.length < 3) return EMPTY_LAYOUT;
  const { pts, toLL } = localFrame(ring);
  const angle = roofAngle(pts);
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  const rot = ([x, y]: XY): XY => [x * cos - y * sin, x * sin + y * cos];
  const unrot = ([x, y]: XY): XY => [x * cos + y * sin, -x * sin + y * cos];
  const poly = pts.map(rot);
  const edges = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    return { a, b, x0: Math.min(a[0], b[0]) - PANEL_SETBACK, x1: Math.max(a[0], b[0]) + PANEL_SETBACK, y0: Math.min(a[1], b[1]) - PANEL_SETBACK, y1: Math.max(a[1], b[1]) + PANEL_SETBACK };
  });
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);

  const fits = (x: number, y: number, w: number, h: number): XY[] | null => {
    const c: XY[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    if (!inside([x + w / 2, y + h / 2], poly)) return null;
    for (const e of edges) {
      if (e.x1 < x || e.x0 > x + w || e.y1 < y || e.y0 > y + h) continue; // edge far from this panel
      for (const p of c) if (segDist(p, e.a, e.b) < PANEL_SETBACK - 1e-6) return null;
      for (const v of [e.a, e.b]) {
        const dx = Math.max(x - v[0], 0, v[0] - (x + w)), dy = Math.max(y - v[1], 0, v[1] - (y + h));
        if (Math.hypot(dx, dy) < PANEL_SETBACK - 1e-6) return null;
      }
      for (let k = 0; k < 4; k++) if (segsCross(e.a, e.b, c[k]!, c[(k + 1) % 4]!)) return null;
    }
    return c;
  };

  let best: { found: XY[][]; portrait: boolean; rows: number } = { found: [], portrait: false, rows: 0 };
  for (const portrait of [false, true]) {
    const w = portrait ? PANEL_H : PANEL_W, h = portrait ? PANEL_W : PANEL_H;
    const y0 = minY + PANEL_SETBACK;
    const rowYs = rowStarts(maxY - minY - 2 * PANEL_SETBACK, h).map((y) => y0 + y);
    for (const shift of [0, w / 2]) {
      const found: XY[][] = [];
      let rows = 0;
      for (const y of rowYs) {
        let any = false;
        for (let x = minX + PANEL_SETBACK + shift; x + w <= maxX - PANEL_SETBACK + 1e-9; x += w + PANEL_GAP) {
          const c = fits(x, y, w, h);
          if (c) { found.push(c); any = true; }
        }
        if (any) rows++;
      }
      if (found.length > best.found.length) best = { found, portrait, rows };
    }
  }

  const panels = best.found.map((c) => c.map((p) => toLL(unrot(p))));
  return { panels, count: panels.length, area: panels.length * panelArea, kw: systemKw(panels.length), angle, portrait: best.portrait, rows: best.rows };
}

/** Point inside `poly` farthest from all its edges (pole of inaccessibility). */
function poleOfInaccessibility(poly: XY[], precision = 0.1): XY {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const dist = (p: XY) => {
    let d = Infinity;
    for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i]!, poly[(i + 1) % poly.length]!));
    return inside(p, poly) ? d : -d;
  };
  type Cell = { x: number; y: number; h: number; d: number; max: number };
  const cell = (x: number, y: number, h: number): Cell => { const d = dist([x, y]); return { x, y, h, d, max: d + h * Math.SQRT2 }; };
  const w = maxX - minX, h = maxY - minY, size = Math.min(w, h);
  if (size <= 0) return [(minX + maxX) / 2, (minY + maxY) / 2];
  const step = Math.max(size / 4, precision);
  const queue: Cell[] = [];
  for (let x = minX; x < maxX; x += step) for (let y = minY; y < maxY; y += step) queue.push(cell(x + step / 2, y + step / 2, step / 2));
  let best = cell((minX + maxX) / 2, (minY + maxY) / 2, 0);
  for (const c of queue) if (c.d > best.d) best = c;
  while (queue.length) {
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i]!.max > queue[bi]!.max) bi = i;
    const cur = queue.splice(bi, 1)[0]!;
    if (cur.max - best.d <= precision) break;
    const nh = cur.h / 2;
    for (const [dx, dy] of [[-nh, -nh], [nh, -nh], [-nh, nh], [nh, nh]] as const) {
      const nxt = cell(cur.x + dx, cur.y + dy, nh);
      if (nxt.d > best.d) best = nxt;
      if (nxt.max - best.d > precision) queue.push(nxt);
    }
  }
  return [best.x, best.y];
}

/**
 * Places `count` panels as one compact block of straight rows centered on the roof's pole of
 * inaccessibility, all inside the outline. Falls back to the `count` panels from the full-roof
 * layout closest to that center when the roof is too narrow or irregular for a centered block.
 */
export function layoutPanelBlock(ring: LL[], count: number, full?: PanelLayout): PanelLayout {
  if (ring.length < 3 || count <= 0) return EMPTY_LAYOUT;
  const base = full ?? layoutPanels(ring);
  if (base.count === 0) return EMPTY_LAYOUT;
  const target = Math.min(count, base.count);
  if (target === base.count) return base;

  const { pts, toLL } = localFrame(ring);
  const angle = roofAngle(pts);
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  const rot = ([x, y]: XY): XY => [x * cos - y * sin, x * sin + y * cos];
  const unrot = ([x, y]: XY): XY => [x * cos + y * sin, -x * sin + y * cos];
  const poly = pts.map(rot);
  const edges = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    return { a, b, x0: Math.min(a[0], b[0]) - PANEL_SETBACK, x1: Math.max(a[0], b[0]) + PANEL_SETBACK, y0: Math.min(a[1], b[1]) - PANEL_SETBACK, y1: Math.max(a[1], b[1]) + PANEL_SETBACK };
  });
  const [cx, cy] = poleOfInaccessibility(poly);

  const fits = (x: number, y: number, w: number, h: number): XY[] | null => {
    const c: XY[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    if (!inside([x + w / 2, y + h / 2], poly)) return null;
    for (const e of edges) {
      if (e.x1 < x || e.x0 > x + w || e.y1 < y || e.y0 > y + h) continue;
      for (const p of c) if (segDist(p, e.a, e.b) < PANEL_SETBACK - 1e-6) return null;
      for (const v of [e.a, e.b]) {
        const dx = Math.max(x - v[0], 0, v[0] - (x + w)), dy = Math.max(y - v[1], 0, v[1] - (y + h));
        if (Math.hypot(dx, dy) < PANEL_SETBACK - 1e-6) return null;
      }
      for (let k = 0; k < 4; k++) if (segsCross(e.a, e.b, c[k]!, c[(k + 1) % 4]!)) return null;
    }
    return c;
  };

  // Try compact (rows, cols) blocks in landscape then portrait, most square first.
  for (const portrait of [false, true]) {
    const w = portrait ? PANEL_H : PANEL_W, h = portrait ? PANEL_W : PANEL_H;
    const shapes: { rows: number; cols: number; ratio: number }[] = [];
    for (let rows = 1; rows <= target; rows++) {
      const cols = Math.ceil(target / rows);
      const bw = cols * w + (cols - 1) * PANEL_GAP, bh = rows * h + (rows - 1) * PANEL_GAP;
      shapes.push({ rows, cols, ratio: Math.max(bw / bh, bh / bw) });
    }
    shapes.sort((a, b) => a.ratio - b.ratio || a.rows * a.cols - b.rows * b.cols);
    for (const { rows, cols } of shapes) {
      const bw = cols * w + (cols - 1) * PANEL_GAP, bh = rows * h + (rows - 1) * PANEL_GAP;
      const x0 = cx - bw / 2, y0 = cy - bh / 2;
      const found: XY[][] = [];
      let ok = true;
      for (let r = 0; r < rows && ok; r++) {
        const inRow = r === rows - 1 ? target - r * cols : cols;
        const colStart = Math.floor((cols - inRow) / 2);
        const y = y0 + r * (h + PANEL_GAP);
        for (let k = 0; k < inRow; k++) {
          const c = fits(x0 + (colStart + k) * (w + PANEL_GAP), y, w, h);
          if (!c) { ok = false; break; }
          found.push(c);
        }
      }
      if (ok && found.length === target) {
        const panels = found.map((c) => c.map((p) => toLL(unrot(p))));
        return { panels, count: target, area: target * panelArea, kw: systemKw(target), angle, portrait, rows };
      }
    }
  }

  // Fallback: pick the `target` panels from the full-roof grid closest to the roof center.
  const [latC, lngC] = toLL(unrot([cx, cy]));
  const ranked = base.panels
    .map((p) => {
      const plat = (p[0]![0] + p[2]![0]) / 2, plng = (p[0]![1] + p[2]![1]) / 2;
      return { p, d: (plat - latC) ** 2 + (plng - lngC) ** 2 };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, target)
    .map((x) => x.p);
  return { panels: ranked, count: ranked.length, area: ranked.length * panelArea, kw: systemKw(ranked.length), angle: base.angle, portrait: base.portrait, rows: base.rows };
}

/** A usable outline: at least 3 finite, in-range [lat, lng] corners. */
export const validRing = (r: LL[] | undefined | null): r is LL[] =>
  !!r && r.length >= 3 && r.every(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180);

/** Share of the usable roof the panels take, as a whole percent (never above 100). */
export const panelCoverPct = (panelM2: number, usable: number) => (usable > 0 ? Math.min(100, Math.round((panelM2 / usable) * 100)) : 0);

/** Roof area one panel takes including the gap to its neighbours (m²). */
export const PANEL_FOOTPRINT = (PANEL_W + PANEL_GAP) * (PANEL_H + PANEL_GAP);

/** Share of the usable roof a panel count takes (with gaps), as a whole percent from 1 to 100. */
export const coveragePct = (count: number, usable: number) =>
  count > 0 && usable > 0 ? Math.max(1, Math.min(100, Math.round(((count * PANEL_FOOTPRINT) / usable) * 100))) : 0;

/** Panel count for a wanted coverage percent: whole panels, at least 1, never more than fit on the roof. */
export function panelsForCoverage(percent: number, usable: number, maxPanels: number): number {
  if (maxPanels <= 0) return 0;
  const pct = Math.max(1, Math.min(100, Number.isFinite(percent) ? percent : 1));
  return Math.max(1, Math.min(maxPanels, Math.round(((pct / 100) * usable) / PANEL_FOOTPRINT)));
}
