"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

type Mode = "light" | "dark" | "auto";

const THEMES = [
  {
    id: "theme-seminaire",
    name: "Séminaire",
    swatch: { tl: "#efece2", tr: "#7a2e2a", bl: "#1f2a24", br: "#1f2a24" },
  },
  {
    id: "theme-sobre",
    name: "Sobre",
    swatch: { tl: "#ffffff", tr: "#0e0e0f", bl: "#fafafa", br: "#e4e4e7" },
  },
  {
    id: "theme-poudre",
    name: "Poudré",
    swatch: { tl: "#f3e3df", tr: "#9b3344", bl: "#3b2a2e", br: "#3b2a2e" },
  },
  {
    id: "theme-nuit",
    name: "Nuit",
    swatch: { tl: "#131a2a", tr: "#c7a86a", bl: "#0a0f1c", br: "#ece4cf" },
  },
  {
    id: "theme-shiny",
    name: "Shiny",
    swatch: { tl: "#f4eee2", tr: "#0e3df0", bl: "#ffd84d", br: "#d83a52" },
  },
] as const;

function applyMode(mode: Mode) {
  const root = document.documentElement;
  const apply = (m: "light" | "dark") =>
    root.classList.toggle("dark", m === "dark");
  if (mode === "auto") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches ? "dark" : "light");
  } else {
    apply(mode);
  }
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [mode, setMode] = useState<Mode>("auto");
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const trigRef = useRef<HTMLButtonElement>(null);

  // hydrate mode from localStorage on mount and listen to system if auto
  useEffect(() => {
    const saved = (localStorage.getItem("klowi.mode") as Mode) ?? "auto";
    setMode(saved);
    applyMode(saved);
    if (saved !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // commit mode change
  useEffect(() => {
    localStorage.setItem("klowi.mode", mode);
    applyMode(mode);
  }, [mode]);

  // close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        !popRef.current?.contains(e.target as Node) &&
        !trigRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[1];

  return (
    <div className="relative">
      <button
        ref={trigRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md border border-transparent hover:bg-surface hover:border-border text-foreground text-[12.5px] text-left transition-colors"
        aria-label="Choisir le thème"
      >
        <span className="flex flex-shrink-0">
          <i
            className="block w-3 h-3 rounded-full border border-white/40"
            style={{ background: current.swatch.tl }}
          />
          <i
            className="block w-3 h-3 rounded-full border border-white/40 -ml-1"
            style={{ background: current.swatch.tr }}
          />
          <i
            className="block w-3 h-3 rounded-full border border-white/40 -ml-1"
            style={{ background: current.swatch.bl }}
          />
        </span>
        <span className="flex-1 sidebar-label">{current.name}</span>
        <span className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-muted sidebar-label">
          {mode}
        </span>
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute bottom-12 left-0 right-0 z-30 bg-background border border-border-strong rounded-lg p-3.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.25)]"
        >
          <h4 className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-muted m-0 mb-2.5">
            Thème
          </h4>
          <div className="grid grid-cols-5 gap-2">
            {THEMES.map((t) => {
              const isActive = t.id === current.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`p-0 rounded-md overflow-hidden border ${
                    isActive
                      ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "border-border"
                  }`}
                  aria-label={t.name}
                  aria-pressed={isActive}
                >
                  <div className="h-12 grid grid-rows-2">
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: "2fr 1fr" }}
                    >
                      <div style={{ background: t.swatch.tl }} />
                      <div style={{ background: t.swatch.tr }} />
                    </div>
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: "1fr 2fr" }}
                    >
                      <div style={{ background: t.swatch.bl }} />
                      <div style={{ background: t.swatch.br }} />
                    </div>
                  </div>
                  <div
                    className={`font-mono text-[9px] tracking-[0.1em] uppercase py-1 ${
                      isActive ? "text-foreground" : "text-muted"
                    }`}
                  >
                    {t.name}
                  </div>
                </button>
              );
            })}
          </div>

          <h4 className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-muted m-0 mt-3.5 mb-1.5">
            Mode
          </h4>
          <div className="grid grid-cols-3 gap-1 p-1 bg-surface border border-border rounded-md">
            {(["light", "auto", "dark"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-[12px] py-1.5 rounded ${
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted"
                }`}
              >
                {m === "light" ? "Light" : m === "dark" ? "Dark" : "Auto"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
