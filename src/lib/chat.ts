import { z } from "zod";
import { advisorChatSchema } from "./advisor";

export const MAX_USER_MESSAGES = 15;
export const MESSAGE_INTERVAL_MS = 3000;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const chatReportSchema = z
  .object({
    usableAreaM2: z.number().finite().nonnegative(),
    bestFitOption: z.string().max(40),
    bestFitScore: z.number().finite().min(0).max(100),
    systemSizeKw: z.number().finite().nonnegative(),
    costInr: z.number().finite().nonnegative(),
    subsidyInr: z.number().finite().nonnegative(),
    netCostInr: z.number().finite(),
    yearlySavingsInr: z.number().finite().nonnegative(),
    paybackYears: z.number().finite().nonnegative().nullable(),
    solarIrradianceKwhM2Day: z.number().finite().nonnegative(),
    maxTemperatureC: z.number().finite(),
    rainfallMmYear: z.number().finite().nonnegative(),
    heatRisk: z.enum(["Low", "Moderate", "High", "Extreme"]),
    otherOptionScores: z
      .array(
        z
          .object({ option: z.string().max(40), score: z.number().finite().min(0).max(100) })
          .strict(),
      )
      .max(4),
  })
  .strict();

export const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(10),
    report: chatReportSchema.optional(),
    advisor: advisorChatSchema.optional(),
  })
  .strict();

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatReport = z.infer<typeof chatReportSchema>;
export type ChatRequest = z.input<typeof chatRequestSchema>;

export type SendGate = "ok" | "wait" | "limit";

export function sendGate(
  userMessageCount: number,
  lastSentAt: number | null,
  now: number,
): SendGate {
  if (userMessageCount >= MAX_USER_MESSAGES) return "limit";
  if (lastSentAt !== null && now - lastSentAt < MESSAGE_INTERVAL_MS) return "wait";
  return "ok";
}

export function recentMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-10);
}
