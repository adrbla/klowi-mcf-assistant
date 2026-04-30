"use client";

import { useEffect, useState } from "react";
import { MessageBubble } from "./MessageBubble";

const CHAR_INTERVAL_MS = 28;

export function TypewriterMessage({ content }: { content: string }) {
  const [revealedChars, setRevealedChars] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (revealedChars >= content.length) {
      setDone(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setRevealedChars((n) => Math.min(n + 1, content.length));
    }, CHAR_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [revealedChars, content.length]);

  // While typing, render plain text char-by-char (no markdown parsing on
  // partial input). Once complete, swap to the full MessageBubble for the
  // final markdown render — same DOM as a normal historic message.
  if (!done) {
    return (
      <article className="max-w-full">
        <div className="prose-klowi text-foreground text-[15px] leading-[1.6] whitespace-pre-wrap">
          {content.slice(0, revealedChars)}
          <span className="inline-block w-[1ch] animate-pulse opacity-60">
            ▍
          </span>
        </div>
      </article>
    );
  }

  return (
    <MessageBubble
      message={{ role: "assistant", content }}
      isStreaming={false}
    />
  );
}
