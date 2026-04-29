type Size = "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, { fs: string; tracking: string }> = {
  sm: { fs: "text-[9px]", tracking: "tracking-[0.18em]" },
  md: { fs: "text-[10px]", tracking: "tracking-[0.20em]" },
  lg: { fs: "text-[12px]", tracking: "tracking-[0.22em]" },
  xl: { fs: "text-[14px]", tracking: "tracking-[0.24em]" },
};

/**
 * Brand mark for the app. Discreet, label-style — no italic serif wordmark,
 * no hero treatment. Reads as a system identifier rather than a brand
 * statement. Always one line, mono uppercase, muted color, scales by
 * letterspacing more than by font size.
 */
export function Brand({
  size = "md",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <span
      className={`font-mono uppercase text-muted ${s.fs} ${s.tracking} ${className}`}
      aria-label="CC MCF Prep Companion"
    >
      CC · MCF · PREP COMPANION
    </span>
  );
}
