"use client";

import { useState } from "react";
import { StreamingDots } from "./StreamingDots";

/**
 * Discreet "still working" indicator shown in place of an empty assistant
 * bubble while waiting for the first streaming chunk. Picks one short
 * phrase at random and holds it for the full wait.
 */

const PHRASES: readonly string[] = [
  "Je réfléchis…",
  "J'arrive…",
  "Un instant…",
  "Je regarde…",
  "Je formule…",
  "Je creuse un peu…",
  "Je rassemble…",
  "Une seconde…",
  "Je tourne ça…",
  "Je cherche…",
  "Je vérifie…",
  "Je vois…",
];

export function ThinkingIndicator() {
  const [phrase] = useState(
    () => PHRASES[Math.floor(Math.random() * PHRASES.length)],
  );

  return (
    <div className="flex items-baseline gap-3 text-muted min-h-[24px]">
      <span className="ti-text font-prose italic text-[15px] leading-[1.6]">
        {phrase}
      </span>
      <StreamingDots className="opacity-70" />
      <style jsx>{`
        .ti-text {
          animation: ti-fadein 350ms ease-out both;
        }
        @keyframes ti-fadein {
          from {
            opacity: 0;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
