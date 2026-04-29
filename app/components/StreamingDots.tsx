export function StreamingDots({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-end gap-[2px] h-3 ml-1.5 align-middle ${className}`}
      aria-label="Klowi écrit"
      role="status"
    >
      <i
        className="block w-[2px] rounded-[1px] bg-current animate-[klowi-bar_1.1s_ease-in-out_infinite]"
        style={{ height: 6, animationDelay: "0s" }}
      />
      <i
        className="block w-[2px] rounded-[1px] bg-current animate-[klowi-bar_1.1s_ease-in-out_infinite]"
        style={{ height: 10, animationDelay: "0.15s" }}
      />
      <i
        className="block w-[2px] rounded-[1px] bg-current animate-[klowi-bar_1.1s_ease-in-out_infinite]"
        style={{ height: 7, animationDelay: "0.3s" }}
      />

      <style jsx>{`
        @keyframes klowi-bar {
          0%,
          100% {
            transform: scaleY(0.4);
            opacity: 0.5;
            transform-origin: bottom;
          }
          50% {
            transform: scaleY(1);
            opacity: 1;
            transform-origin: bottom;
          }
        }
      `}</style>
    </span>
  );
}
