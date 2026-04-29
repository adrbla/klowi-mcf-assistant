"use client";

import { useState, useRef, useEffect } from "react";

export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string; // ISO
};

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor(
    (startOfToday.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000,
  );
  if (dayDiff === 1) return "hier";
  if (dayDiff < 7) return `il y a ${dayDiff} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function ChatListItem({
  chat,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  chat: ChatSummary;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== chat.title) onRename(trimmed);
    setEditing(false);
  };

  return (
    <div
      className={`group relative grid grid-cols-[4px_1fr_auto] items-stretch cursor-pointer ${
        active ? "is-active" : ""
      }`}
      onClick={() => !editing && onSelect()}
    >
      {/* vertical rule — the only marker for "active" */}
      <span
        className={`block ${active ? "bg-active-rule" : "bg-transparent"}`}
      />

      <div
        className={`min-w-0 px-3.5 py-2.5 group-hover:bg-surface ${
          active ? "bg-surface" : ""
        }`}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(chat.title);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent border-b border-border-strong text-[13.5px] text-foreground outline-none"
          />
        ) : (
          <div
            className={`text-[13.5px] leading-[1.35] truncate text-foreground ${
              active ? "font-medium" : "font-normal"
            }`}
            title={chat.title}
          >
            {chat.title}
          </div>
        )}
        <div className="font-mono text-[10px] tracking-[0.04em] text-faint mt-0.5">
          {relativeTime(chat.updatedAt)}
        </div>
      </div>

      <div
        ref={menuRef}
        className={`relative flex items-center pr-3 pl-1.5 ${
          menuOpen
            ? ""
            : "opacity-0 group-hover:opacity-100 transition-opacity"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="w-6 h-6 grid place-items-center rounded-[3px] text-muted hover:bg-surface hover:text-foreground"
          aria-label="Actions sur la conversation"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <circle cx="3" cy="8" r="1.2" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="13" cy="8" r="1.2" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute top-7 right-2 z-20 bg-background border border-border-strong rounded-md shadow-md py-1 min-w-[140px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                setEditing(true);
              }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-foreground hover:bg-surface"
            >
              Renommer
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-foreground hover:bg-surface"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
