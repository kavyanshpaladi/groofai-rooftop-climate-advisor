import area from "@turf/area";
import centroid from "@turf/centroid";
import type { Feature, Polygon } from "geojson";

export const USABLE_FRACTION = 0.65;

export function roofStats(f: Feature<Polygon>) {
  const a = area(f);
  const c = centroid(f).geometry.coordinates;
  return { area: a, usable: a * USABLE_FRACTION, lat: c[1]!, lon: c[0]! };
}

export const START: [number, number] = [17.385, 78.4867];

// Hard-coded sample building near the start point (~25m x 18m).
export const SAMPLE_ROOF: Feature<Polygon> = {
  type: "Feature",
  id: "sample",
  properties: { id: "sample" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [78.48655, 17.38515],
      [78.48679, 17.38515],
      [78.48679, 17.38531],
      [78.48655, 17.38531],
      [78.48655, 17.38515],
    ]],
  },
};
