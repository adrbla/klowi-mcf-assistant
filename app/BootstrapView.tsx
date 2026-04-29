"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brand } from "./components/Brand";
import { MessageBubble, type Message } from "./components/MessageBubble";

const KICKOFF = "[OPEN]";
const START_COMMAND = "/start";
const CHAT_ID_KEY = "klowi.chatId";
const BOOTSTRAP_DONE_KEY = "klowi.bootstrap.done";

export function BootstrapView({ onComplete }: { onComplete: () => void }) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const convoRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const kickedOffRef = useRef(false);

  // ── hydrate: load any prior bootstrap-in-progress state
  useEffect(() => {
    const stored = localStorage.getItem(CHAT_ID_KEY);
    if (!stored) {
      setHydrated(true);
      return;
    }
    setChatId(stored);
    fetch(
      `/api/chat/history?chatId=${encodeURIComponent(stored)}`,
      { cache: "no-store" },
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Message[]) => setMessages(data))
      .finally(() => setHydrated(true));
  }, []);

  const sendMessage = useCallback(
    async (text: string, isKickoff = false): Promise<void> => {
      setIsStreaming(true);
      setMessages((m) => [
        ...m,
        ...(isKickoff ? [] : [{ role: "user" as const, content: text }]),
        { role: "assistant" as const, content: "" },
      ]);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, message: text }),
        });
        const newId = res.headers.get("X-Chat-Id");
        if (newId && newId !== chatId) {
          setChatId(newId);
          localStorage.setItem(CHAT_ID_KEY, newId);
        }
        if (!res.body) throw new Error("no stream");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                content: last.content + chunk,
              };
            }
            return next;
          });
        }
      } catch {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            next[next.length - 1] = {
              ...last,
              content: "*Une erreur est survenue. Tu peux réessayer.*",
            };
          }
          return next;
        });
      } finally {
        setIsStreaming(false);
        inputRef.current?.focus();
      }
    },
    [chatId],
  );

  // ── auto-kickoff once on first arrival (no chatId, no messages)
  useEffect(() => {
    if (!hydrated || kickedOffRef.current) return;
    if (messages.length > 0) return;
    if (chatId) return; // resuming an in-progress bootstrap, no need to kickoff
    kickedOffRef.current = true;
    void sendMessage(KICKOFF, true);
  }, [hydrated, messages.length, chatId, sendMessage]);

  // ── auto-scroll
  useEffect(() => {
    const el = convoRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  const finishBootstrap = useCallback(async () => {
    if (chatId) {
      try {
        await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Bootstrap" }),
        });
      } catch {
        /* swallow */
      }
    }
    localStorage.removeItem(CHAT_ID_KEY);
    localStorage.setItem(BOOTSTRAP_DONE_KEY, "1");
    onComplete();
  }, [chatId, onComplete]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isStreaming) return;
      setInput("");

      if (text.toLowerCase() === START_COMMAND) {
        // Send /start to the assistant for an acknowledgement turn,
        // then transition once streaming completes.
        await sendMessage(text);
        await finishBootstrap();
        return;
      }

      await sendMessage(text);
    },
    [input, isStreaming, sendMessage, finishBootstrap],
  );

  // Hide the [OPEN] kickoff marker from the visible thread.
  const visibleMessages = messages.filter((m) => m.content !== KICKOFF);

  if (!hydrated) {
    return <div className="min-h-dvh bg-background" />;
  }

  return (
    <main className="min-h-dvh flex flex-col bg-background text-foreground">
      <div ref={convoRef} className="flex-1 overflow-y-auto pt-16 pb-6 min-h-0">
        <div className="max-w-[640px] mx-auto px-6 md:px-8 flex flex-col gap-6">
          <div className="mb-2">
            <Brand size="xl" />
          </div>
          {visibleMessages.length === 0 && isStreaming && (
            <p className="font-prose italic text-[16px] leading-[1.5] text-muted">
              Klowi se présente…
            </p>
          )}
          {visibleMessages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              isStreaming={
                isStreaming &&
                i === visibleMessages.length - 1 &&
                m.role === "assistant"
              }
            />
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 px-6 md:px-8 pb-6 pt-3 bg-background"
      >
        <div
          className={`max-w-[640px] mx-auto flex items-center gap-2.5 px-4 py-3 bg-surface border rounded-full transition-colors ${
            isStreaming
              ? "border-border opacity-60"
              : "border-border focus-within:border-foreground"
          }`}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder={isStreaming ? "Klowi répond…" : "réponds à Klowi…"}
            className="flex-1 bg-transparent border-none outline-none text-foreground text-[14.5px] placeholder:text-faint disabled:cursor-not-allowed"
            autoFocus
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="w-8 h-8 grid place-items-center bg-foreground text-background rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Envoyer"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-3.5 h-3.5"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>
        </div>
      </form>
    </main>
  );
}
