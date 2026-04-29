"use client";

import { useEffect, useMemo } from "react";
import { Brand } from "./Brand";
import { ThemePicker } from "./ThemePicker";
import { ChatListItem, type ChatSummary } from "./ChatListItem";

const COLLAPSE_KEY = "klowi-sidebar-collapsed";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketOf(iso: string): "this-week" | "last-week" | "earlier" {
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const days = Math.floor(
    (today.getTime() - startOfDay(d).getTime()) / 86400000,
  );
  if (days < 7) return "this-week";
  if (days < 14) return "last-week";
  return "earlier";
}

const BUCKET_LABEL: Record<string, string> = {
  "this-week": "cette semaine",
  "last-week": "semaine passée",
  earlier: "plus tôt",
};

export function Sidebar({
  chats,
  activeChatId,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
}: {
  chats: ChatSummary[];
  activeChatId: string | null;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onRenameChat: (id: string, title: string) => void;
  onDeleteChat: (id: string) => void;
}) {
  // hydrate collapse state once
  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved === "1") setCollapsed(true);
  }, [setCollapsed]);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Esc closes mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, setMobileOpen]);

  const grouped = useMemo(() => {
    const sorted = [...chats].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const buckets: Record<string, ChatSummary[]> = {
      "this-week": [],
      "last-week": [],
      earlier: [],
    };
    for (const c of sorted) buckets[bucketOf(c.updatedAt)].push(c);
    return buckets;
  }, [chats]);

  const handleSelect = (id: string) => {
    onSelectChat(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* mobile scrim */}
      <div
        onClick={() => setMobileOpen(false)}
        className={`md:hidden fixed inset-0 bg-foreground/40 z-40 transition-opacity ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />

      <aside
        className={`
          flex flex-col h-full bg-background border-r border-border overflow-hidden flex-shrink-0
          transition-[width,transform] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]
          md:relative md:translate-x-0
          ${collapsed ? "md:w-[56px]" : "md:w-[280px]"}
          fixed inset-y-0 left-0 z-50 w-[280px]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:transform-none
        `}
        data-collapsed={collapsed ? "true" : "false"}
      >
        {/* head */}
        <div className="flex items-center gap-2 h-[60px] px-[18px] py-3.5 flex-shrink-0">
          <div
            className={`flex-1 min-w-0 overflow-hidden ${
              collapsed ? "md:hidden" : ""
            }`}
          >
            <Brand size="md" />
          </div>
          <button
            onClick={() => {
              if (window.matchMedia("(min-width: 768px)").matches)
                setCollapsed(!collapsed);
              else setMobileOpen(false);
            }}
            className={`w-7 h-7 grid place-items-center rounded text-muted hover:bg-surface hover:text-foreground ${
              collapsed ? "md:mx-auto" : ""
            }`}
            aria-label={
              collapsed ? "Ouvrir la sidebar" : "Réduire la sidebar"
            }
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={`w-4 h-4 transition-transform ${
                collapsed ? "rotate-180" : ""
              }`}
            >
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
        </div>

        {/* new chat */}
        <button
          onClick={onNewChat}
          className={`flex items-center gap-2.5 mx-3.5 mb-3.5 px-3 py-2.5 bg-surface border border-border rounded-md text-foreground text-[13px] hover:border-border-strong transition-colors text-left
            ${collapsed ? "md:justify-center md:px-2 md:mx-2" : ""}
          `}
          aria-label="Nouvelle conversation"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-3.5 h-3.5 flex-shrink-0 opacity-70"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
          <span
            className={`sidebar-label ${collapsed ? "md:hidden" : ""}`}
          >
            Nouvelle conversation
          </span>
        </button>

        {/* list */}
        <div
          className={`flex-1 overflow-y-auto pb-4 min-h-0 ${
            collapsed ? "md:hidden" : ""
          }`}
        >
          {chats.length === 0 ? (
            <div className="px-6 py-8 text-muted font-prose italic text-[14px] leading-[1.5]">
              Rien encore. C'est ouvert dès que tu veux.
              <span className="block font-mono not-italic text-[11px] tracking-[0.14em] uppercase text-faint mt-2.5">
                ↓ ouvre une conversation
              </span>
            </div>
          ) : (
            (["this-week", "last-week", "earlier"] as const).map((bucket) =>
              grouped[bucket].length === 0 ? null : (
                <div key={bucket}>
                  <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-faint px-[22px] pt-3.5 pb-1.5">
                    {BUCKET_LABEL[bucket]}
                  </div>
                  {grouped[bucket].map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      active={chat.id === activeChatId}
                      onSelect={() => handleSelect(chat.id)}
                      onRename={(title) => onRenameChat(chat.id, title)}
                      onDelete={() => onDeleteChat(chat.id)}
                    />
                  ))}
                </div>
              ),
            )
          )}
        </div>

        {/* footer = theme picker */}
        <div
          className={`border-t border-border p-3.5 flex-shrink-0 ${
            collapsed ? "md:p-2" : ""
          }`}
        >
          <ThemePicker />
        </div>

        {/* labels collapse helper */}
        <style jsx>{`
          aside[data-collapsed="true"] :global(.sidebar-label) {
            display: none;
          }
          @media (max-width: 767px) {
            aside[data-collapsed="true"] :global(.sidebar-label) {
              display: revert;
            }
          }
        `}</style>
      </aside>
    </>
  );
}
