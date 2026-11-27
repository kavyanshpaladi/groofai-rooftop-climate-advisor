import { z } from "zod";

export const ADVISOR_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ADVISOR_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ADVISOR_RATE_LIMIT = 5;
export const ADVISOR_RATE_WINDOW_MS = 10 * 60 * 1000;
export const APPLIANCES = ["ac", "geyser", "fridge", "washing_machine", "ev_charger", "water_pump", "other"] as const;

/** Decoded size of a base64 string, without decoding it. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export const advisorRequestSchema = z
  .object({
    image: z
      .object({
        mimeType: z.enum(ADVISOR_IMAGE_TYPES),
        data: z
          .string()
          .regex(/^[A-Za-z0-9+/]+={0,2}$/)
          .refine((d) => base64Bytes(d) <= ADVISOR_MAX_IMAGE_BYTES, "Image is larger than 8 MB"),
      })
      .strict(),
    needs: z
      .object({
        billUnit: z.enum(["inr", "kwh"]),
        monthlyBill: z.number().finite().min(0).max(1_000_000),
        people: z.number().int().min(1).max(30),
        appliances: z.array(z.enum(APPLIANCES)).max(APPLIANCES.length),
        daytimeSharePct: z.number().int().min(0).max(100),
        budget: z.enum(["low", "medium", "high"]),
        notes: z.string().trim().max(500),
      })
      .strict(),
    // Roof data from a report the user already made. No address or coordinates, ever.
    roof: z
      .object({
        usableAreaM2: z.number().finite().nonnegative().max(100_000),
        sunKwhM2Day: z.number().finite().nonnegative().max(15),
        tariffInrKwh: z.number().finite().nonnegative().max(100),
      })
      .strict()
      .optional(),
    language: z.enum(["en", "hi", "te"]),
    bill: z.object({
      units_kwh: z.number().finite().nonnegative().nullable(),
      bill_amount_inr: z.number().finite().nonnegative().nullable(),
      billing_period_days: z.number().finite().positive().nullable(),
      cost_per_unit_inr: z.number().finite().nonnegative().nullable(),
      sanctioned_load_kw: z.number().finite().nonnegative().nullable(),
      tariff_category: z.enum(["domestic", "commercial", "industrial", "agricultural", "unknown"]).nullable(),
    }).strict().optional(),
  })
  .strict();

const level = z.enum(["low", "medium", "high"]);
export const advisorResultSchema = z.object({
  photo_assessment: z.object({
    roof_type: z.enum(["flat", "sloped", "tiled", "sheet", "unclear"]),
    visible_obstructions: z.array(z.string()),
    shading_risk: level,
    estimated_usable_fraction: z.number().min(0).max(1),
    photo_quality: z.enum(["good", "fair", "poor"]),
    confidence: level,
  }),
  energy_profile: z.object({ estimated_daily_kwh: z.number(), peak_load_notes: z.string() }),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        type: z.enum(["rooftop_solar", "solar_water_heater", "solar_pump", "battery_storage", "hybrid_with_rainwater", "not_recommended"]),
        suggested_size_kw: z.number(),
        estimated_cost_inr: z.number(),
        estimated_yearly_savings_inr: z.number(),
        payback_years: z.number(),
        priority: z.number().int().min(1).max(3),
        why_this_fits: z.array(z.string()),
        risks_or_caveats: z.array(z.string()),
      }),
    )
    .min(1)
    .max(3),
  explanation: z.string(),
  next_steps: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type AdvisorRequest = z.infer<typeof advisorRequestSchema>;
export type AdvisorNeeds = AdvisorRequest["needs"];
export type AdvisorResult = z.infer<typeof advisorResultSchema>;

/** Sliding-window limiter: returns the kept timestamps and whether this request may go ahead. */
export function rateLimit(hits: number[], now: number, limit = ADVISOR_RATE_LIMIT, windowMs = ADVISOR_RATE_WINDOW_MS) {
  const recent = hits.filter((t) => now - t < windowMs);
  if (recent.length >= limit) return { allowed: false, hits: recent };
  return { allowed: true, hits: [...recent, now] };
}

/** Short summary handed to the chatbot so it can answer questions about an advisor result. */
export const advisorChatSchema = z
  .object({
    roofType: z.string().max(20),
    shadingRisk: z.string().max(10),
    confidence: z.string().max(10),
    estimatedDailyKwh: z.number().finite(),
    recommendations: z
      .array(
        z
          .object({
            title: z.string().max(120),
            sizeKw: z.number().finite(),
            costInr: z.number().finite(),
            yearlySavingsInr: z.number().finite(),
            paybackYears: z.number().finite(),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();
export type AdvisorChat = z.infer<typeof advisorChatSchema>;

export function toAdvisorChat(r: AdvisorResult): AdvisorChat {
  return {
    roofType: r.photo_assessment.roof_type,
    shadingRisk: r.photo_assessment.shading_risk,
    confidence: r.photo_assessment.confidence,
    estimatedDailyKwh: r.energy_profile.estimated_daily_kwh,
    recommendations: [...r.recommendations]
      .sort((a, b) => a.priority - b.priority)
      .map((x) => ({
        title: x.title.slice(0, 120),
        sizeKw: x.suggested_size_kw,
        costInr: x.estimated_cost_inr,
        yearlySavingsInr: x.estimated_yearly_savings_inr,
        paybackYears: x.payback_years,
      })),
  };
}
