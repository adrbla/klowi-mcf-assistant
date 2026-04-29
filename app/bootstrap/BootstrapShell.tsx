"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brand } from "../components/Brand";
import { BootstrapView } from "../BootstrapView";

const BOOTSTRAP_DONE_KEY = "klowi.bootstrap.done";

type State = "loading" | "ready" | "already-done";

export function BootstrapShell() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const done = localStorage.getItem(BOOTSTRAP_DONE_KEY) === "1";
    setState(done ? "already-done" : "ready");
  }, []);

  if (state === "loading") {
    return <div className="min-h-dvh bg-background" />;
  }

  if (state === "already-done") {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-background text-foreground px-6">
        <div className="w-full max-w-[420px] flex flex-col gap-6 items-start">
          <Brand size="md" />
          <p className="font-prose italic text-[16px] leading-[1.55] text-muted">
            On a déjà fait le tour ensemble. Tu peux aller directement à
            l'espace de travail.
          </p>
          <Link
            href="/"
            className="self-start font-mono text-[11px] tracking-[0.2em] uppercase px-5 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            entrer
          </Link>
        </div>
      </main>
    );
  }

  return <BootstrapView />;
}
