import { describe, expect, it } from "vitest";
import { advisorRequestSchema, base64Bytes, rateLimit } from "./advisor";

const needs = { billUnit: "inr", monthlyBill: 2000, people: 4, appliances: ["ac"], daytimeSharePct: 50, budget: "medium", notes: "" };

describe("advisor", () => {
  it("allows 5 requests per 10 minutes, then blocks", () => {
    let hits: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = rateLimit(hits, 1000 + i);
      expect(r.allowed).toBe(true);
      hits = r.hits;
    }
    expect(rateLimit(hits, 2000).allowed).toBe(false);
    expect(rateLimit(hits, 1000 + 10 * 60 * 1000).allowed).toBe(true);
  });

  it("rejects images over 8 MB and non jpg/png/webp types", () => {
    const big = "A".repeat(Math.ceil((8 * 1024 * 1024 + 10) * 4 / 3));
    expect(base64Bytes(big)).toBeGreaterThan(8 * 1024 * 1024);
    expect(advisorRequestSchema.safeParse({ image: { mimeType: "image/jpeg", data: big }, needs, language: "en" }).success).toBe(false);
    expect(advisorRequestSchema.safeParse({ image: { mimeType: "image/gif", data: "AAAA" }, needs, language: "en" }).success).toBe(false);
    expect(advisorRequestSchema.safeParse({ image: { mimeType: "image/png", data: "AAAA" }, needs, language: "en" }).success).toBe(true);
  });

  it("never accepts coordinates in roof data", () => {
    const roof = { usableAreaM2: 50, sunKwhM2Day: 5, tariffInrKwh: 7, lat: 17.4 };
    expect(advisorRequestSchema.safeParse({ image: { mimeType: "image/png", data: "AAAA" }, needs, roof, language: "en" }).success).toBe(false);
  });
});
