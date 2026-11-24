import { describe, expect, it } from "vitest";
import { formatInr, panelCoverShare } from "./format";

describe("formatInr", () => {
  it("uses Indian digit grouping below one lakh", () => {
    expect(formatInr(98765)).toBe("₹98,765");
  });
  it("shows lakhs as ₹X.X L", () => {
    expect(formatInr(275000)).toBe("₹2.8 L");
  });
  it("shows crores as ₹X.X Cr", () => {
    expect(formatInr(12_300_000)).toBe("₹1.2 Cr");
  });
  it("keeps the sign for negative values", () => {
    expect(formatInr(-150000)).toBe("−₹1.5 L");
  });
});

describe("panelCoverShare", () => {
  it("equals recommended kW divided by roof max kW", () => {
    expect(panelCoverShare(2, 8)).toBe(0.25);
  });
  it("is capped at 100%", () => {
    expect(panelCoverShare(10, 8)).toBe(1);
  });
});
