import { describe, expect, it } from "vitest";
import { parsePhoton } from "./geocode";

const feat = (name: string, city = "Hyderabad", lon = 78.4, lat = 17.4) => ({
  geometry: { coordinates: [lon, lat] },
  properties: { name, city, state: "Telangana", country: "India" },
});

describe("parsePhoton", () => {
  it("builds name and area line, reading lat/lon in the right order", () => {
    const [s] = parsePhoton({ features: [feat("Charminar")] });
    expect(s).toMatchObject({ name: "Charminar", detail: "Hyderabad, Telangana, India", lat: 17.4, lon: 78.4 });
  });
  it("skips duplicates", () => {
    expect(parsePhoton({ features: [feat("Charminar"), feat("Charminar")] })).toHaveLength(1);
  });
  it("caps results at 6", () => {
    const features = Array.from({ length: 9 }, (_, i) => feat(`Place ${i}`));
    expect(parsePhoton({ features })).toHaveLength(6);
  });
});
