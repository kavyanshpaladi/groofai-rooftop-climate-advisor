import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ChatReport } from "./chat";
import type { AdvisorChat } from "./advisor";

const ChatReportContext = createContext<ChatReport | null>(null);
const SetChatReportContext = createContext<(report: ChatReport | null) => void>(() => {});

type AdvisorChatState = { advisor: AdvisorChat | null; openRequest: number; askAbout: (a: AdvisorChat) => void; clear: () => void };
const AdvisorChatContext = createContext<AdvisorChatState>({ advisor: null, openRequest: 0, askAbout: () => {}, clear: () => {} });

export function ChatReportProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<ChatReport | null>(null);
  const [advisor, setAdvisor] = useState<AdvisorChat | null>(null);
  const [openRequest, setOpenRequest] = useState(0);
  const askAbout = useCallback((a: AdvisorChat) => {
    setAdvisor(a);
    setOpenRequest((n) => n + 1);
  }, []);
  const clear = useCallback(() => setAdvisor(null), []);
  const advisorState = useMemo(() => ({ advisor, openRequest, askAbout, clear }), [advisor, openRequest, askAbout, clear]);
  return (
    <SetChatReportContext.Provider value={setReport}>
      <AdvisorChatContext.Provider value={advisorState}>
        <ChatReportContext.Provider value={report}>{children}</ChatReportContext.Provider>
      </AdvisorChatContext.Provider>
    </SetChatReportContext.Provider>
  );
}

export const useChatReport = () => useContext(ChatReportContext);
export const useSetChatReport = () => useContext(SetChatReportContext);
/** Advisor result shared with the chatbot, plus a counter that opens the chat when bumped. */
export const useAdvisorChat = () => useContext(AdvisorChatContext);
