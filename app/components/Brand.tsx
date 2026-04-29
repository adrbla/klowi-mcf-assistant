type Size = "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, { k: string; mcf: string; gap: string }> = {
  sm: { k: "text-[18px]", mcf: "text-[9px]", gap: "gap-[6px]" },
  md: { k: "text-[22px]", mcf: "text-[10px]", gap: "gap-[8px]" },
  lg: { k: "text-[34px]", mcf: "text-[11px]", gap: "gap-[10px]" },
  xl: { k: "text-[56px]", mcf: "text-[13px]", gap: "gap-[14px]" },
};

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
      className={`inline-flex items-baseline ${s.gap} ${className}`}
      aria-label="Klowi MCF"
    >
      <span
        className={`font-display italic leading-none tracking-[-0.01em] text-foreground ${s.k}`}
      >
        Klowi
      </span>
      <span
        className={`font-mono uppercase tracking-[0.22em] text-muted ${s.mcf}`}
      >
        MCF
      </span>
    </span>
  );
}
