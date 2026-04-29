"use client";

import { useState } from "react";

export function AdminLogin() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: code }),
      });
      if (r.ok) {
        location.reload();
      } else {
        setError("Code admin incorrect.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-background text-foreground px-6">
      <form onSubmit={submit} className="w-full max-w-[340px] flex flex-col gap-7">
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted">
          Admin
        </span>
        <input
          type="password"
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          placeholder="passcode admin"
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
