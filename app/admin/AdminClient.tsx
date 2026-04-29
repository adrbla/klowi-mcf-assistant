"use client";

import { useState } from "react";
import type {
  Inventory,
  PromptSection,
  SourceGroup,
} from "@/lib/admin-data";

const KB = (n: number) => (n / 1024).toFixed(1) + " KB";
const KTOK = (n: number) =>
  n < 1000 ? `~${n} tok` : `~${(n / 1000).toFixed(1)}k tok`;

export function AdminClient({
  inventory,
  sections,
}: {
  inventory: Inventory;
  sections: PromptSection[];
}) {
  const [tab, setTab] = useState<"contexte" | "prompt">("contexte");

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border px-6 md:px-10 py-5 flex items-baseline justify-between">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted">
            Admin
          </span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-faint">
            CC · MCF · Prep Companion
          </span>
        </div>
        <nav className="flex items-center gap-1">
          <TabBtn active={tab === "contexte"} onClick={() => setTab("contexte")}>
            Contexte
          </TabBtn>
          <TabBtn active={tab === "prompt"} onClick={() => setTab("prompt")}>
            Prompt
          </TabBtn>
        </nav>
      </header>

      <div className="max-w-[920px] mx-auto px-6 md:px-10 py-10">
        {tab === "contexte" ? (
          <InventoryView inventory={inventory} />
        ) : (
          <PromptView sections={sections} />
        )}
      </div>
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-[11px] tracking-[0.16em] uppercase px-3 py-2 rounded-md transition-colors ${
        active
          ? "text-foreground bg-surface"
          : "text-muted hover:text-foreground hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

function InventoryView({ inventory }: { inventory: Inventory }) {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="font-display text-[28px] leading-[1.1] mb-1">
          Ce qui part dans le system prompt
        </h2>
        <p className="font-prose italic text-muted text-[14.5px]">
          Source de vérité : <code className="font-mono text-[12.5px]">lib/system-prompt.ts</code>.
          Les fichiers ci-dessous sont concaténés à chaque tour, dans l'ordre des
          sources. Les <code className="font-mono text-[12.5px]">README*</code> sont filtrés.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-4 text-[13px]">
          <Stat label="Sources" value={String(inventory.sources.length)} />
          <Stat
            label="Octets"
            value={(inventory.totalBytes / 1024).toFixed(1) + " KB"}
          />
          <Stat label="Tokens (~)" value={KTOK(inventory.totalTokens)} />
        </div>
      </div>

      {inventory.sources.map((s) => (
        <SourceTable key={s.name} source={s} />
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-md px-4 py-3">
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-faint mb-1">
        {label}
      </div>
      <div className="font-display text-[20px] text-foreground">{value}</div>
    </div>
  );
}

function SourceTable({ source }: { source: SourceGroup }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 border-b border-border pb-2">
        <h3 className="font-mono text-[12px] tracking-[0.16em] uppercase text-foreground">
          {source.name}
        </h3>
        <div className="font-mono text-[10.5px] tracking-[0.1em] text-faint">
          {source.files.length} fichier{source.files.length > 1 ? "s" : ""}
          {" · "}
          {KB(source.totalBytes)} {" · "}
          {KTOK(source.totalTokens)}
        </div>
      </div>

      {source.files.length === 0 ? (
        <p className="font-prose italic text-muted text-[14px] py-2">
          Aucun fichier dans cette source.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {source.files.map((f) => (
            <li
              key={f.path}
              className="flex items-baseline justify-between py-2 gap-4"
            >
              <span className="font-mono text-[12.5px] text-foreground truncate">
                {f.path}
              </span>
              <span className="font-mono text-[10.5px] text-muted whitespace-nowrap">
                {KB(f.size)} {" · "} {KTOK(f.tokens)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PromptView({ sections }: { sections: PromptSection[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const expandAll = () => setExpanded(new Set(sections.map(keyOf)));
  const collapseAll = () => setExpanded(new Set());

  const totalBytes = sections.reduce((s, x) => s + x.size, 0);
  const totalTokens = sections.reduce((s, x) => s + x.tokens, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-[28px] leading-[1.1] mb-1">
          Prompt système
        </h2>
        <p className="font-prose italic text-muted text-[14.5px]">
          Chaque section est une variable substituée à l'assemblage. Cliquez
          pour développer le contenu.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={expandAll}
            className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-muted hover:text-foreground"
          >
            Tout déplier
          </button>
          <span className="text-faint">·</span>
          <button
            onClick={collapseAll}
            className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-muted hover:text-foreground"
          >
            Tout replier
          </button>
          <span className="ml-auto font-mono text-[10.5px] text-faint">
            {sections.length} sections {" · "} {KB(totalBytes)} {" · "}
            {KTOK(totalTokens)}
          </span>
        </div>
      </div>

      <ol className="space-y-2">
        {sections.map((s) => {
          const k = keyOf(s);
          const isOpen = expanded.has(k);
          return (
            <li key={k} className="border border-border rounded-md">
              <button
                onClick={() => toggle(k)}
                className="w-full flex items-baseline justify-between px-4 py-3 text-left hover:bg-surface transition-colors"
              >
                <span className="flex items-baseline gap-3 min-w-0">
                  <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-faint shrink-0">
                    {isOpen ? "▾" : "▸"}
                  </span>
                  <code className="font-mono text-[12.5px] text-foreground truncate">
                    {`{{ ${s.source}${s.path} }}`}
                  </code>
                </span>
                <span className="font-mono text-[10px] tracking-[0.08em] text-muted whitespace-nowrap ml-3">
                  {KB(s.size)} {" · "} {KTOK(s.tokens)}
                </span>
              </button>
              {isOpen && (
                <pre className="border-t border-border px-4 py-3 text-[12.5px] leading-[1.55] font-mono whitespace-pre-wrap break-words bg-surface text-foreground max-h-[600px] overflow-auto">
{s.content}
                </pre>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function keyOf(s: PromptSection): string {
  return `${s.source}::${s.path}`;
}
