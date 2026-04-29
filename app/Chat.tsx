"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "klowi.chatId";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

export default function Chat() {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setChatId(stored);
      void loadHistory(stored);
    }
    setHydrated(true);
    inputRef.current?.focus();
  }, []);

  async function loadHistory(id: string) {
    try {
      const res = await fetch(`/api/chat/history?chatId=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      } else if (res.status === 404) {
        localStorage.removeItem(STORAGE_KEY);
        setChatId(null);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const userText = input.trim();
    if (!userText || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    const tempUserId = `temp-user-${Date.now()}`;
    const tempAssistantId = `temp-asst-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: tempUserId, role: "user", content: userText },
      { id: tempAssistantId, role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: userText }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const newChatId = res.headers.get("X-Chat-Id");
      const isNew = res.headers.get("X-New-Chat") === "1";
      if (newChatId && (isNew || !chatId)) {
        setChatId(newChatId);
        localStorage.setItem(STORAGE_KEY, newChatId);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Pas de body en réponse");
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) =>
          m.map((msg) =>
            msg.id === tempAssistantId
              ? { ...msg, content: msg.content + chunk }
              : msg,
          ),
        );
      }

      setMessages((m) =>
        m.map((msg) =>
          msg.id === tempAssistantId ? { ...msg, isStreaming: false } : msg,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === tempAssistantId
            ? {
                ...msg,
                content: `⚠️ Erreur : ${message}`,
                isStreaming: false,
              }
            : msg,
        ),
      );
    } finally {
      setIsStreaming(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e as unknown as React.FormEvent);
    }
  }

  function handleNewChat() {
    if (isStreaming) return;
    localStorage.removeItem(STORAGE_KEY);
    setChatId(null);
    setMessages([]);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Klowi
            </p>
            <h1 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              MCF Coach
            </h1>
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            disabled={isStreaming || messages.length === 0}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 disabled:opacity-30 transition"
          >
            Nouvelle conversation
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {hydrated && messages.length === 0 && (
            <div className="text-zinc-500 dark:text-zinc-400 pt-16 text-center">
              <p className="text-sm">Pose une première question pour commencer.</p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4"
      >
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Pose ta question…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-zinc-950 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none py-1 max-h-40 leading-relaxed"
              style={{ minHeight: "1.75rem" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="shrink-0 h-8 px-3 rounded-md bg-zinc-950 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-950 text-sm font-medium hover:opacity-90 disabled:opacity-30 transition"
            >
              {isStreaming ? "…" : "Envoyer"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500 text-center">
            Entrée pour envoyer · Shift+Entrée pour ligne nouvelle
          </p>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-zinc-950 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-950"
            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <MarkdownContent
            content={message.content}
            isStreaming={message.isStreaming}
          />
        )}
      </div>
    </div>
  );
}

function MarkdownContent({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  if (!content && isStreaming) {
    return (
      <span className="inline-flex items-center gap-1 text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:200ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:400ms]" />
      </span>
    );
  }
  return (
    <div className="text-[15px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
          ul: (props) => (
            <ul className="my-2 list-disc list-outside pl-5 space-y-1" {...props} />
          ),
          ol: (props) => (
            <ol className="my-2 list-decimal list-outside pl-5 space-y-1" {...props} />
          ),
          li: (props) => <li {...props} />,
          h1: (props) => (
            <h1 className="text-lg font-semibold mt-4 mb-2 first:mt-0" {...props} />
          ),
          h2: (props) => (
            <h2 className="text-base font-semibold mt-3 mb-1.5 first:mt-0" {...props} />
          ),
          h3: (props) => (
            <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0" {...props} />
          ),
          code: (props) => (
            <code
              className="bg-zinc-200 dark:bg-zinc-800 rounded px-1 py-0.5 text-[13px] font-mono"
              {...props}
            />
          ),
          pre: (props) => (
            <pre
              className="bg-zinc-200 dark:bg-zinc-800 rounded-lg p-3 my-2 overflow-x-auto text-[13px]"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="border-l-2 border-zinc-300 dark:border-zinc-700 pl-3 my-2 italic text-zinc-700 dark:text-zinc-300"
              {...props}
            />
          ),
          a: ({ href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80"
              {...props}
            />
          ),
          strong: (props) => <strong className="font-semibold" {...props} />,
          em: (props) => <em className="italic" {...props} />,
          hr: () => <hr className="my-3 border-zinc-300 dark:border-zinc-700" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
