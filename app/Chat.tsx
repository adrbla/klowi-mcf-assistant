"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brand } from "./components/Brand";
import { Sidebar } from "./components/Sidebar";
import { MessageBubble, type Message } from "./components/MessageBubble";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import type { ChatSummary } from "./components/ChatListItem";

const CHAT_ID_KEY = "klowi.chatId";
const WELCOME_KICKOFF = "[FIRST]";

export default function Chat() {
  const [hydrated, setHydrated] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const convoRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const welcomeFiredRef = useRef(false);

  const refreshChats = useCallback(async () => {
    try {
      const r = await fetch("/api/chats", { cache: "no-store" });
      if (!r.ok) return;
      const data: ChatSummary[] = await r.json();
      setChats(data);
    } catch {
      /* swallow */
    }
  }, []);

  const loadHistory = useCallback(async (id: string) => {
    try {
      const r = await fetch(
        `/api/chat/history?chatId=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      if (r.status === 404) {
        // Chat is gone (deleted server-side, or localStorage points at a
        // chat that no longer exists). Reset state + storage so the rest
        // of the app behaves as a fresh visit.
        setMessages([]);
        setChatId(null);
        localStorage.removeItem(CHAT_ID_KEY);
        return;
      }
      if (!r.ok) {
        setMessages([]);
        return;
      }
      const data: Message[] = await r.json();
      setMessages(data);
    } catch {
      setMessages([]);
    }
  }, []);

  // ── hydrate from localStorage on mount (one-shot)
  useEffect(() => {
    const stored = localStorage.getItem(CHAT_ID_KEY);
    setChatId(stored);
    refreshChats();
    if (stored) loadHistory(stored);
    setHydrated(true);
  }, [refreshChats, loadHistory]);

  // ── post-bootstrap welcome kickoff: when arriving on /?welcome=1 with no
  //    active chat, fire a [FIRST] marker so the companion opens with an
  //    inviting question. Strip the param from the URL so a refresh doesn't
  //    re-trigger.
  const fireWelcomeKickoff = useCallback(async () => {
    setIsStreaming(true);
    setMessages([{ role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: null, message: WELCOME_KICKOFF }),
      });
      const newId = res.headers.get("X-Chat-Id");
      if (newId) {
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
      setMessages([
        {
          role: "assistant",
          content: "*Une erreur est survenue. Tu peux réessayer.*",
        },
      ]);
    } finally {
      setIsStreaming(false);
      refreshChats();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [refreshChats]);

  useEffect(() => {
    if (!hydrated || welcomeFiredRef.current) return;
    if (chatId || messages.length > 0) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") !== "1") return;
    welcomeFiredRef.current = true;
    url.searchParams.delete("welcome");
    window.history.replaceState({}, "", url.pathname + url.search);
    void fireWelcomeKickoff();
  }, [hydrated, chatId, messages.length, fireWelcomeKickoff]);

  // ── auto-scroll on new messages / streaming chunks
  useEffect(() => {
    const el = convoRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  const handleSelectChat = useCallback(
    async (id: string) => {
      setChatId(id);
      localStorage.setItem(CHAT_ID_KEY, id);
      await loadHistory(id);
      inputRef.current?.focus();
    },
    [loadHistory],
  );

  const handleNewChat = useCallback(() => {
    setChatId(null);
    setMessages([]);
    localStorage.removeItem(CHAT_ID_KEY);
    setMobileOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleRenameChat = useCallback(
    async (id: string, title: string) => {
      setChats((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c)));
      try {
        await fetch(`/api/chats/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
      } catch {
        /* keep optimistic value */
      }
    },
    [],
  );

  const handleDeleteChat = useCallback(
    async (id: string) => {
      setChats((cs) => cs.filter((c) => c.id !== id));
      if (id === chatId) handleNewChat();
      try {
        await fetch(`/api/chats/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      } catch {
        /* swallow */
      }
    },
    [chatId, handleNewChat],
  );

  // ── submit + stream
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isStreaming) return;

      setInput("");
      setMessages((m) => [
        ...m,
        { role: "user", content: text, createdAt: new Date().toISOString() },
        { role: "assistant", content: "" },
      ]);
      setIsStreaming(true);

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
        refreshChats();
        inputRef.current?.focus();
      }
    },
    [input, isStreaming, chatId, refreshChats],
  );

  if (!hydrated) {
    // suppress hydration mismatch w/ next-themes
    return <div className="min-h-dvh bg-background" />;
  }

  const activeTitle =
    chats.find((c) => c.id === chatId)?.title ??
    (messages.length ? "Conversation en cours" : null);

  return (
    <div className="min-h-dvh flex bg-background text-foreground">
      <Sidebar
        chats={chats}
        activeChatId={chatId}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
      />

      <main className="flex-1 flex flex-col h-dvh overflow-hidden">
        {/* desktop crumb */}
        <header className="hidden md:flex items-center justify-between h-[60px] px-6 border-b border-border flex-shrink-0">
          <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-muted truncate">
            {activeTitle ? (
              <>
                <span>Conversation</span>
                <span className="px-2 opacity-40">/</span>
                <span className="text-foreground">{activeTitle}</span>
              </>
            ) : (
              <span>Nouvelle conversation</span>
            )}
          </div>
          {messages.length > 0 && (
            <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-faint">
              {messages.length} message{messages.length > 1 ? "s" : ""}
            </div>
          )}
        </header>

        {/* mobile head */}
        <header className="md:hidden flex items-center justify-between h-[52px] px-4 border-b border-border flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-8 h-8 grid place-items-center text-foreground"
            aria-label="Ouvrir le menu"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              className="w-4 h-4"
            >
              <path d="M3 5h10M3 11h10" />
            </svg>
          </button>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted truncate max-w-[200px]">
            {activeTitle ?? "CC · MCF"}
          </div>
          <div className="w-8" />
        </header>

        {/* convo */}
        <div
          ref={convoRef}
          className="flex-1 overflow-y-auto pt-8 pb-6 min-h-0"
        >
          <div className="max-w-[720px] mx-auto px-6 md:px-8 flex flex-col gap-5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-start gap-4 pt-12">
                <Brand size="lg" />
                <p className="font-prose italic text-[18px] leading-[1.45] text-muted max-w-[44ch]">
                  Rien à préparer pour entrer ici. Écris ce qui te traverse.
                </p>
              </div>
            ) : (
              messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                const isWaitingChunk =
                  isStreaming &&
                  isLast &&
                  m.role === "assistant" &&
                  m.content === "";
                if (isWaitingChunk) {
                  return <ThinkingIndicator key={i} />;
                }
                return (
                  <MessageBubble
                    key={i}
                    message={m}
                    isStreaming={isStreaming && isLast && m.role === "assistant"}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* input */}
        <form
          onSubmit={handleSubmit}
          className="flex-shrink-0 px-6 md:px-8 pb-6 pt-3 bg-background"
        >
          <div
            className={`max-w-[720px] mx-auto flex items-center gap-2.5 px-4 py-3 bg-surface border rounded-full transition-colors ${
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
              placeholder={isStreaming ? "…" : "écris ici…"}
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
    </div>
  );
}
