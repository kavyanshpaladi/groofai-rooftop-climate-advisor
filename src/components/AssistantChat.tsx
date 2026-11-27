import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "@tanstack/react-router";
import { Bot, MessageCircle, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { askAssistant } from "@/lib/chat.functions";
import { MAX_USER_MESSAGES, recentMessages, sendGate, type ChatMessage } from "@/lib/chat";
import { useAdvisorChat, useChatReport } from "@/lib/chat-report";
import { cn } from "@/lib/utils";

const GREETING =
  "Hi! I can help you choose a rooftop upgrade, understand your report, or explain the government solar subsidy. What would you like to know?";
const SUGGESTIONS = [
  "Which upgrade is best for me?",
  "How much subsidy can I get?",
  "How does groofai work?",
  "What documents do I need?",
];

type DisplayMessage = ChatMessage & { id: number };

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [messages, setMessages] = useState<DisplayMessage[]>([
    { id: 0, role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [userMessageCount, setUserMessageCount] = useState(0);
  const nextId = useRef(1);
  const lastSentAt = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const report = useChatReport();
  const { advisor, openRequest } = useAdvisorChat();
  useEffect(() => {
    if (openRequest > 0) setOpen(true);
  }, [openRequest]);
  const pathname = useLocation({ select: (location) => location.pathname });
  const limitReached = userMessageCount >= MAX_USER_MESSAGES;

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, busy, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const gate = sendGate(userMessageCount, lastSentAt.current, Date.now());
    if (gate === "wait") {
      setNotice("Please wait 3 seconds between messages.");
      return;
    }
    if (gate === "limit") {
      setNotice("You've reached the 15-message limit for this session.");
      return;
    }

    const userMessage: DisplayMessage = { id: nextId.current++, role: "user", content };
    const requestMessages = recentMessages([...messages, userMessage]);
    setMessages((current) => [...current, userMessage]);
    setUserMessageCount((count) => count + 1);
    setInput("");
    setNotice("");
    setBusy(true);
    lastSentAt.current = Date.now();

    try {
      const result = await askAssistant({
        data: {
          messages: requestMessages,
          ...(pathname === "/results" && report ? { report } : {}),
          ...(pathname === "/advisor" && advisor ? { advisor } : {}),
        },
      });
      const answer =
        result.error === "busy"
          ? "I'm busy right now, please try again in a minute."
          : result.error === "unavailable"
            ? "I couldn't get an answer right now. Please try again."
            : result.answer;
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          content: answer ?? "I couldn't get an answer right now. Please try again.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          content: "I couldn't get an answer right now. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  if (!mounted) return null;

  return createPortal(
    <div className="print:hidden">
      {open && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="groofai assistant"
          className="chat-panel-enter fixed bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] right-4 z-[60] flex h-[min(520px,80vh)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:bottom-[6.5rem] sm:right-6 sm:h-[min(520px,calc(100dvh-8rem))] sm:w-[380px]"
        >
          <header className="flex h-16 shrink-0 items-center justify-between bg-linear-to-r from-primary to-primary/80 px-4 text-primary-foreground">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
                <Bot className="size-5" aria-hidden />
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-primary bg-emerald-300" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight">GroofAI Assistant</p>
                <p className="text-xs text-primary-foreground/80">Online</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
            >
              <X className="size-5" />
            </Button>
          </header>

          <div
            ref={messageListRef}
            className="flex-1 space-y-3 overflow-y-auto bg-muted/35 p-4"
            aria-live="polite"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    message.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border bg-card text-card-foreground",
                  )}
                >
                  {message.content}
                </p>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="chip"
                    size="sm"
                    className="h-auto whitespace-normal py-2 text-left"
                    onClick={() => void send(suggestion)}
                    disabled={busy || limitReached}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            )}
            {busy && (
              <div className="flex justify-start" aria-label="Assistant is typing">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
                      style={{ animationDelay: `${dot * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-card p-3">
            {notice && (
              <p className="mb-2 text-xs text-muted-foreground" role="status">
                {notice}
              </p>
            )}
            {limitReached && !notice && (
              <p className="mb-2 text-xs text-muted-foreground">
                You've reached the 15-message limit for this session.
              </p>
            )}
            <form onSubmit={submit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={1000}
                disabled={busy || limitReached}
                placeholder={limitReached ? "Session limit reached" : "Ask about your rooftop…"}
                aria-label="Message the groofai assistant"
                className="min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              <Button
                type="submit"
                size="icon"
                className="size-10 shrink-0 rounded-full"
                disabled={busy || limitReached || !input.trim()}
                aria-label="Send message"
              >
                <SendHorizontal className="size-4" />
              </Button>
            </form>
            <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
              AI assistant. Estimates only, not professional advice.
            </p>
          </div>
        </section>
      )}

      {!open && (
        <div className="fixed bottom-[calc(1rem_+_env(safe-area-inset-bottom))] right-4 z-[60] sm:bottom-6 sm:right-6">
          <Button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open groofai chat"
            aria-haspopup="dialog"
            className="h-12 gap-2 rounded-full px-4 text-sm font-semibold tracking-[0.01em] text-primary-foreground shadow-xl transition-transform hover:-translate-y-0.5 min-[480px]:pl-4 min-[480px]:pr-5"
          >
            <MessageCircle className="size-5" aria-hidden />
            <span className="hidden lowercase min-[480px]:inline">groofai</span>
          </Button>
        </div>
      )}
    </div>,
    document.body,
  );
}
