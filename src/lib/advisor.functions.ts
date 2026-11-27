import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { advisorRequestSchema } from "./advisor";
import { checkRateLimit, runAdvisor, runBillScan, type AdvisorOutcome, type BillOutcome } from "./advisor.server";
import { billRequestSchema } from "./bill";

export const getSolarAdvice = createServerFn({ method: "POST" })
  .inputValidator((data) => advisorRequestSchema.parse(data))
  .handler(async ({ data }): Promise<AdvisorOutcome> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) return { error: "unavailable" };
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    if (!checkRateLimit(ip)) return { error: "limited" };
    return runAdvisor(data, apiKey);
  });

export const scanElectricityBill = createServerFn({ method: "POST" })
  .inputValidator((data) => billRequestSchema.parse(data))
  .handler(async ({ data }): Promise<BillOutcome> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) return { error: "unavailable" };
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    if (!checkRateLimit(ip)) return { error: "limited" };
    return runBillScan(data, apiKey);
  });
