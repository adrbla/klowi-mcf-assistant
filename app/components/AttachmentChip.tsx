"use client";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentChip({
  name,
  sizeBytes,
  onRemove,
}: {
  name: string;
  sizeBytes?: number;
  onRemove?: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-md text-foreground text-[13px] max-w-full">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        className="w-3.5 h-3.5 flex-shrink-0 opacity-70"
        aria-hidden
      >
        <path d="M10.5 2.5 5 8a2 2 0 0 0 2.83 2.83l5-5a3.5 3.5 0 0 0-4.95-4.95L3 6.27a5 5 0 0 0 7.07 7.07l4.43-4.43" />
      </svg>
      <span className="truncate min-w-0" title={name}>
        {name}
      </span>
      {sizeBytes !== undefined && (
        <span className="font-mono text-[11px] text-faint flex-shrink-0">
          {formatBytes(sizeBytes)}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="w-4 h-4 grid place-items-center text-muted hover:text-foreground flex-shrink-0"
          aria-label={`Retirer ${name}`}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-3 h-3"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
