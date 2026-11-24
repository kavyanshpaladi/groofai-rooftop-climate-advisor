import { describe, expect, it } from "vitest";
import { LANGUAGES, TRANSLATIONS, type TKey } from "./translations";

const slots = (s: string) => [...s.matchAll(/\{\w+\}|<\/?(?:b|sup)>/g)].map((m) => m[0]).sort();

describe("translations", () => {
  it("offers English, Hindi and Telugu", () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(["en", "hi", "te"]);
  });

  it("keeps every runtime value (amounts, kW, counts) in each language", () => {
    for (const key of Object.keys(TRANSLATIONS.en) as TKey[]) {
      for (const lang of ["hi", "te"] as const) {
        expect(TRANSLATIONS[lang][key].trim(), `${lang}.${key}`).not.toBe("");
        expect(slots(TRANSLATIONS[lang][key]), `${lang}.${key}`).toEqual(slots(TRANSLATIONS.en[key]));
      }
    }
  });

  it("leaves fixed figures in the subsidy text untouched", () => {
    for (const lang of ["hi", "te"] as const) {
      expect(TRANSLATIONS[lang].loanHelper).toContain("5.75–7%");
      expect(TRANSLATIONS[lang].loanHelper).toContain("3 kW");
      expect(TRANSLATIONS[lang].src5d).toContain("6.00%");
    }
  });
});
