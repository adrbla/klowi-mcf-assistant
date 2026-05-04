"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./components/Brand";
import { Sidebar } from "./components/Sidebar";
import { MessageBubble, type Message } from "./components/MessageBubble";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import { AttachmentChip } from "./components/AttachmentChip";
import type { ChatSummary } from "./components/ChatListItem";
import type { MessageAttachment } from "@/lib/db/schema";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".md", ".txt"] as const;

export default function Chat({
  initialChatId = null,
  initialMessages = [],
}: {
  initialChatId?: string | null;
  initialMessages?: Message[];
}) {
  const router = useRouter();
  const [chatId, setChatId] = useState<string | null>(initialChatId);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [pendingAttachment, setPendingAttachment] =
    useState<MessageAttachment | null>(null);
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "error"
  >("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const convoRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // ── refresh chat list on mount
  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  // ── auto-scroll on new messages / streaming chunks
  useEffect(() => {
    const el = convoRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  const handleSelectChat = useCallback(
    (id: string) => {
      router.push(`/conv/${id}`);
    },
    [router],
  );

  const handleNewChat = useCallback(() => {
    setMobileOpen(false);
    router.push("/");
  }, [router]);

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
      if (id === chatId) {
        router.push("/");
      }
      try {
        await fetch(`/api/chats/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      } catch {
        /* swallow */
      }
    },
    [chatId, router],
  );

  const handlePickFile = useCallback(() => {
    if (uploadState === "uploading" || isStreaming) return;
    fileInputRef.current?.click();
  }, [uploadState, isStreaming]);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so selecting the same file twice still fires onChange.
      e.target.value = "";
      if (!file) return;

      // Client-side validation (filet, server re-validates).
      const lower = file.name.toLowerCase();
      const acceptedExt = ACCEPTED_EXTENSIONS.some((x) => lower.endsWith(x));
      if (!acceptedExt) {
        setUploadError(
          "Je lis les .md, .txt et .pdf pour l'instant. Si tu as un .docx ou autre, convertis en markdown ou en PDF — markdown préféré.",
        );
        setUploadState("error");
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        setUploadError(
          `Le fichier fait ${mb} MB, je suis capée à 10 MB.`,
        );
        setUploadState("error");
        return;
      }

      setUploadState("uploading");
      setUploadError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || `upload failed (${res.status})`);
        }
        const att = (await res.json()) as MessageAttachment;
        setPendingAttachment(att);
        setUploadState("idle");
      } catch (err) {
        setUploadError(
          err instanceof Error
            ? err.message
            : "L'upload a échoué. Tu peux réessayer.",
        );
        setUploadState("error");
      }
    },
    [],
  );

  const handleRemoveAttachment = useCallback(() => {
    setPendingAttachment(null);
    setUploadState("idle");
    setUploadError(null);
  }, []);

  // ── submit + stream
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isStreaming) return;

      setInput("");
      setMessages((m) => [
        ...m,
        {
          role: "user",
          content: text,
          createdAt: new Date().toISOString(),
          attachments: pendingAttachment ? [pendingAttachment] : undefined,
        },
        { role: "assistant", content: "" },
      ]);
      const sentAttachment = pendingAttachment;
      setPendingAttachment(null);
      setIsStreaming(true);

      try {
        const attachmentsForRequest = sentAttachment ? [sentAttachment] : [];
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            message: text,
            attachments: attachmentsForRequest,
          }),
        });

        const newId = res.headers.get("X-Chat-Id");
        if (newId && newId !== chatId) {
          setChatId(newId);
          // Reflect the new chat id in the URL without adding a history entry.
          router.replace(`/conv/${newId}`);
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
    [input, isStreaming, chatId, refreshChats, router, pendingAttachment],
  );

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
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
            className="hidden"
            onChange={handleFileSelected}
          />
          <div className="max-w-[720px] mx-auto flex flex-col gap-2">
            {(pendingAttachment || uploadState === "uploading") && (
              <div className="flex items-center">
                {uploadState === "uploading" ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-md text-muted text-[13px]">
                    <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
                      Envoi…
                    </span>
                  </div>
                ) : pendingAttachment ? (
                  <AttachmentChip
                    name={pendingAttachment.name}
                    sizeBytes={pendingAttachment.sizeBytes}
                    onRemove={handleRemoveAttachment}
                  />
                ) : null}
              </div>
            )}
            {uploadError && (
              <div className="text-[12.5px] text-red-500 leading-[1.4] font-prose">
                {uploadError}
              </div>
            )}
            <div
              className={`flex items-center gap-2.5 px-4 py-3 bg-surface border rounded-full transition-colors ${
                isStreaming
                  ? "border-border opacity-60"
                  : "border-border focus-within:border-foreground"
              }`}
            >
              <button
                type="button"
                onClick={handlePickFile}
                disabled={isStreaming || uploadState === "uploading"}
                className="w-7 h-7 grid place-items-center text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                aria-label="Joindre un document"
                title="Joindre un .md, .txt ou .pdf"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  className="w-4 h-4"
                >
                  <path d="M10.5 2.5 5 8a2 2 0 0 0 2.83 2.83l5-5a3.5 3.5 0 0 0-4.95-4.95L3 6.27a5 5 0 0 0 7.07 7.07l4.43-4.43" />
                </svg>
              </button>
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
                disabled={
                  isStreaming ||
                  uploadState === "uploading" ||
                  (!input.trim() && !pendingAttachment)
                }
                className="w-8 h-8 grid place-items-center bg-foreground text-background rounded-full disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
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
          </div>
        </form>
      </main>
    </div>
  );
}
