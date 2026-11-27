import { describe, expect, it } from "vitest";
import { chatReportSchema, recentMessages, sendGate, type ChatMessage } from "./chat";

describe("assistant session rules", () => {
  it("allows the 15th user message but not the 16th", () => {
    expect(sendGate(14, null, 10000)).toBe("ok");
    expect(sendGate(15, null, 10000)).toBe("limit");
  });

  it("requires 3 seconds between user messages", () => {
    expect(sendGate(1, 10000, 12999)).toBe("wait");
    expect(sendGate(1, 10000, 13000)).toBe("ok");
  });

  it("sends only the last 10 messages", () => {
    const messages: ChatMessage[] = Array.from({ length: 12 }, (_, index) => ({
      role: "user",
      content: `message ${index + 1}`,
    }));
    expect(recentMessages(messages).map((message) => message.content)).toEqual([
      "message 3",
      "message 4",
      "message 5",
      "message 6",
      "message 7",
      "message 8",
      "message 9",
      "message 10",
      "message 11",
      "message 12",
    ]);
  });

  it("rejects coordinates or other unexpected report fields", () => {
    const result = chatReportSchema.safeParse({ lat: 17.385, lon: 78.4867 });
    expect(result.success).toBe(false);
  });
});
