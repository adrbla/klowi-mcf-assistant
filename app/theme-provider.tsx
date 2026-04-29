"use client";

/**
 * Klowi theme provider — manages two independent axes:
 *
 *   1. theme  : one of the 5 named themes (serieux / academique / neutre / rose / surprise)
 *   2. mode   : light | dark | auto (auto follows prefers-color-scheme)
 *
 * Both axes are persisted to localStorage. The provider sets two classes on <html>:
 *   - `theme-{name}` (always one)
 *   - `dark`         (only when resolved mode is dark)
 *
 * The CSS convention (in app/globals.css) is:
 *   .theme-serieux { ... light tokens ... }
 *   .theme-serieux.dark { ... dark tokens ... }
 *
 * A no-flash inline script (NO_FLASH_SCRIPT) is injected in <head> by app/layout.tsx
 * so the correct classes are applied synchronously before React hydrates — no flash
 * of unstyled / wrong-theme content on first paint or navigation.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const THEMES = [
  "theme-serieux",
  "theme-academique",
  "theme-neutre",
  "theme-rose",
  "theme-surprise",
] as const;

export type ThemeName = (typeof THEMES)[number];

export type ModePreference = "light" | "dark" | "auto";
export type ResolvedMode = "light" | "dark";

const THEME_KEY = "klowi-theme";
const MODE_KEY = "klowi-mode";

const DEFAULT_THEME: ThemeName = "theme-neutre";
const DEFAULT_MODE: ModePreference = "auto";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  mode: ModePreference;
  setMode: (m: ModePreference) => void;
  resolvedMode: ResolvedMode;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isThemeName(v: string | null): v is ThemeName {
  return v !== null && (THEMES as readonly string[]).includes(v);
}

function isModePreference(v: string | null): v is ModePreference {
  return v === "light" || v === "dark" || v === "auto";
}

function resolve(mode: ModePreference): ResolvedMode {
  if (mode === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

function applyClasses(theme: ThemeName, resolved: ResolvedMode) {
  const html = document.documentElement;
  for (const cls of Array.from(html.classList)) {
    if (cls.startsWith("theme-")) html.classList.remove(cls);
  }
  html.classList.add(theme);
  if (resolved === "dark") html.classList.add("dark");
  else html.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);
  const [mode, setModeState] = useState<ModePreference>(DEFAULT_MODE);
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>("light");

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY);
    const storedMode = localStorage.getItem(MODE_KEY);
    if (isThemeName(storedTheme)) setThemeState(storedTheme);
    if (isModePreference(storedMode)) setModeState(storedMode);
  }, []);

  // Whenever theme or mode changes (after hydration), resolve and apply classes.
  useEffect(() => {
    const next = resolve(mode);
    setResolvedMode(next);
    applyClasses(theme, next);
  }, [theme, mode]);

  // Track prefers-color-scheme changes when mode === "auto".
  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next: ResolvedMode = mq.matches ? "dark" : "light";
      setResolvedMode(next);
      applyClasses(theme, next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, theme]);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  }, []);

  const setMode = useCallback((m: ModePreference) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, mode, setMode, resolvedMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/**
 * Inline script injected in <head> to set theme/mode classes on <html>
 * before React hydrates. Prevents flash on first paint and navigation.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}'),m=localStorage.getItem('${MODE_KEY}'),h=document.documentElement,T=${JSON.stringify(THEMES)};if(!t||T.indexOf(t)<0)t='${DEFAULT_THEME}';if(m!=='light'&&m!=='dark'&&m!=='auto')m='${DEFAULT_MODE}';h.classList.add(t);var d=m==='dark'||(m==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)h.classList.add('dark');}catch(e){}})();`;
