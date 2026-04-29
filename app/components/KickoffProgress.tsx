"use client";

import { useEffect, useState } from "react";
import { StreamingDots } from "./StreamingDots";

/**
 * Shown in place of an empty assistant bubble while waiting for the first
 * streaming chunk from the model. Cycles through reassuring lines so the
 * user never sees a blank pulsing indicator on a slow first turn (~10s
 * with a large uncached system prompt + private blob fetches).
 */

const STEPS: { at: number; text: string }[] = [
  { at: 0, text: "Une seconde…" },
  { at: 1500, text: "Je rassemble le contexte…" },
  { at: 5000, text: "Encore un instant…" },
  { at: 9000, text: "Presque prête…" },
  { at: 15000, text: "Cette première fois prend toujours un peu plus de temps." },
];

export function KickoffProgress() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timers = STEPS.map((s, i) =>
      setTimeout(() => setStepIndex(i), s.at),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex items-baseline gap-3 text-muted min-h-[24px]">
      <span
        key={stepIndex}
        className="kp-text font-prose italic text-[15px] leading-[1.6]"
      >
        {STEPS[stepIndex].text}
      </span>
      <StreamingDots className="opacity-70" />
      <style jsx>{`
        .kp-text {
          animation: kp-fadein 600ms ease-out both;
        }
        @keyframes kp-fadein {
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
