import { createServerFn } from "@tanstack/react-start";
import { chatRequestSchema } from "./chat";

const MODEL = "gemini-3.5-flash-lite";
const BUSY_MESSAGE = "I'm busy right now, please try again in a minute.";

const SYSTEM_INSTRUCTION = `You are the groofai assistant. groofai is a free tool that reads satellite imagery and local sun, heat and rain data to suggest the best rooftop climate upgrade (solar, rainwater harvesting, reflective roof, green roof or hybrid) for a home in India. Users draw or tap their roof, answer five questions, and get a report. Explain things in simple, friendly words for a homeowner. Keep answers under 90 words unless asked for more. Reply in the user's language (English, Hindi or Telugu).
Rules: Use ONLY the numbers in the provided report or the facts below. Never invent numbers, never promise savings, subsidy or approval, and never give engineering or legal approval. If the report is missing, say 'open your report first and I can explain your numbers.' If asked something outside rooftops, solar, rainwater, heat or the subsidy, politely say you can't help with that. If a question depends on current rules, say to confirm on pmsuryaghar.gov.in.
Facts (checked 24 Nov 2026):
- PM Surya Ghar central subsidy for homes: ₹30,000 per kW for the first 2 kW, ₹18,000 for the third kW, nothing above 3 kW, maximum ₹78,000. Special-category states (North-East, Uttarakhand, Himachal Pradesh, J&K, Ladakh, Sikkim, Andaman and Nicobar, Lakshadweep): ₹33,000 and ₹19,800, maximum ₹85,800. Housing societies and RWAs: ₹18,000 per kW for common areas, up to 500 kW.
- The subsidy is paid after installation, inspection and commissioning, usually within about 15-30 days of the claim. The household pays the full cost first.
- The scheme is scheduled to close on 31 March 2027. An extension has been reported but not announced.
- Needs: residential electricity connection, own roof or owner's permission, no earlier solar subsidy, grid-connected system with net metering, a registered installer, Made-in-India (DCR) panels, and 5 years free maintenance from the vendor. Off-grid and lease models don't qualify.
- Telangana has no state top-up that we found. Other states may.
- Documents: Aadhaar, PAN, latest electricity bill, cancelled cheque (name should match bill and Aadhaar), property proof.
- Loans: banks offer collateral-free loans up to about ₹2 lakh for systems up to 3 kW, at roughly 5.75-7%, up to 10 years.
- In Telangana, surplus solar sent to the grid is paid at a low solar tender rate, far below the normal tariff, so it's best to use most of the power at home.`;

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((data) => chatRequestSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) return { error: "unavailable" as const };

    const reportInstruction = data.report
      ? `\nCurrent report (the only report numbers you may use):\n${JSON.stringify(data.report)}`
      : "\nNo report is available for this conversation.";
    const advisorInstruction = data.advisor
      ? `\nThe user also has an AI Solar Advisor estimate from a rooftop photo (estimates only; you may explain these numbers):\n${JSON.stringify(data.advisor)}`
      : "";

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION + reportInstruction + advisorInstruction }] },
            contents: data.messages.map((message) => ({
              role: message.role === "assistant" ? "model" : "user",
              parts: [{ text: message.content }],
            })),
            generationConfig: { maxOutputTokens: 200 },
          }),
        },
      );

      if (!response.ok) {
        const details = await response.text();
        if (response.status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(details)) {
          return { error: "busy" as const, message: BUSY_MESSAGE };
        }
        console.error(`Gemini request failed with status ${response.status}`);
        return { error: "unavailable" as const };
      }

      const result = (await response.json()) as GeminiResponse;
      const answer = result.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!answer) return { error: "unavailable" as const };
      return { answer };
    } catch {
      return { error: "unavailable" as const };
    }
  });
