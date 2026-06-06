"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ApiResponse = {
  data?: { message?: string };
  error?: { message?: string };
  message?: string;
};

const starterQuestions = [
  "Bagaimana performa penjualan hari ini?",
  "Produk apa yang stoknya perlu diperhatikan?",
  "Promo aktif apa saja?",
];

export function AiChatWidget({ enabled }: { enabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Halo, saya bisa bantu menjawab data dan cara kerja aplikasi web Smart POS ERP.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageIdRef = useRef(0);

  const apiMessages = useMemo(
    () =>
      messages
        .filter((message) => message.id !== "welcome")
        .slice(-12)
        .map(({ role, content }) => ({ role, content })),
    [messages],
  );

  if (!enabled) {
    return null;
  }

  async function sendMessage(nextText?: string) {
    const text = (nextText ?? input).trim();
    if (!text || isSending) return;

    messageIdRef.current += 1;
    const userMessage: ChatMessage = {
      id: `user-${messageIdRef.current}`,
      role: "user",
      content: text,
    };
    const nextMessages = [
      ...apiMessages,
      { role: "user" as const, content: text },
    ];
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const json = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok) {
        throw new Error(
          json.error?.message ?? json.message ?? "Chat AI belum bisa menjawab.",
        );
      }
      const answer = json.data?.message?.trim();
      if (!answer) {
        throw new Error("Chat AI tidak mengirim jawaban.");
      }
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${messageIdRef.current}`,
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Chat AI belum bisa menjawab.",
      );
    } finally {
      setIsSending(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden sm:bottom-5 sm:right-5">
      {isOpen ? (
        <section className="flex h-[min(680px,calc(100vh-2rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border bg-card shadow-2xl sm:w-[420px]">
          <header className="flex items-center gap-3 border-b bg-[#1D3557] px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#A8DADC] text-[#1D3557]">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              {/* <p className="truncate font-semibold">Chat with AI</p> */}
              <p className="truncate text-xs text-[#F1FAEE]/80">
                Khusus data dan cara kerja web POS
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup Chat with AI"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-[#E63946] text-white"
                      : "border bg-background text-foreground"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isSending ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menjawab...
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t bg-card p-3">
            {error ? (
              <p className="mb-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
            {messages.length === 1 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {starterQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    onClick={() => void sendMessage(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder="Tanya data atau cara kerja web..."
                className="min-h-11 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#E63946] text-white hover:bg-[#E63946]/90 disabled:opacity-60"
                disabled={isSending || !input.trim()}
                aria-label="Kirim chat"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </section>
      ) : (
        <button
          type="button"
          className="inline-flex h-14 items-center gap-2 rounded-lg bg-[#E63946] px-4 text-sm font-semibold text-white shadow-xl hover:bg-[#E63946]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setIsOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <MessageCircle className="h-5 w-5" />
          Chat with AI
        </button>
      )}
    </div>
  );
}
