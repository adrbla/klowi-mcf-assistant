"use client";

import { useEffect, useState } from "react";
import { Brand } from "../components/Brand";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Honor the `next` query param the middleware sets when it redirects
  // unauthenticated users here. Restricted to same-origin relative paths.
  const [nextPath, setNextPath] = useState<string>("/");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const candidate = new URLSearchParams(window.location.search).get("next");
    if (candidate && candidate.startsWith("/") && !candidate.startsWith("//")) {
      setNextPath(candidate);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: code, next: nextPath }),
      });
      if (!r.ok) {
        setError("Ce n'est pas le bon code.");
      } else {
        // Hard navigation so the new auth cookie is sent on the next request.
        window.location.assign(nextPath);
      }
    } catch {
      setError("Quelque chose n'a pas marché.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center bg-background text-foreground px-6">
      <form onSubmit={submit} className="w-full max-w-[340px] flex flex-col gap-7">
        <Brand size="lg" />
        <input
          type="password"
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          placeholder="passcode"
          className="bg-transparent border-0 border-b border-border-strong text-foreground text-[18px] py-2 outline-none focus:border-foreground placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={!code.trim() || busy}
          className="self-start font-mono text-[11px] tracking-[0.2em] uppercase px-5 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-30"
        >
          {busy ? "…" : "entrer"}
        </button>
        {error && (
          <p className="font-prose italic text-[14px] text-muted -mt-3">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
