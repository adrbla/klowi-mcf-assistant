"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { StreamingDots } from "./StreamingDots";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export function MessageBubble({
  message,
  isStreaming = false,
  timestamp,
}: {
  message: Message;
  isStreaming?: boolean;
  timestamp?: string;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-[18px] rounded-br-[6px] bg-foreground text-background px-4 py-2.5 text-[14.5px] leading-[1.5] whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <article className="max-w-full">
      {timestamp && (
        <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-faint mb-2">
          Klowi · {timestamp}
        </div>
      )}
      <div className="prose-klowi text-foreground text-[15px] leading-[1.6]">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p className="my-2 first:mt-0 last:mb-0">{children}</p>
            ),
            h1: ({ children }) => (
              <h1 className="font-display text-[24px] mt-5 mb-2 leading-[1.2]">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="font-display text-[20px] mt-4 mb-2 leading-[1.25]">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted mt-4 mb-1">
                {children}
              </h3>
            ),
            ul: ({ children }) => (
              <ul className="my-2 pl-5 list-disc marker:text-muted">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="my-2 pl-5 list-decimal marker:text-muted">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="my-0.5">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-border-strong pl-4 my-3 text-muted italic">
                {children}
              </blockquote>
            ),
            code: ({ children, ...props }: { children?: React.ReactNode; inline?: boolean }) =>
              props.inline ? (
                <code className="font-mono text-[13px] bg-surface px-1.5 py-0.5 rounded-[3px]">
                  {children}
                </code>
              ) : (
                <pre className="font-mono text-[13px] bg-surface border border-border rounded-md p-3 my-3 overflow-x-auto">
                  <code>{children}</code>
                </pre>
              ),
            a: ({ children, href }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline underline-offset-2 decoration-1 hover:decoration-2"
              >
                {children}
              </a>
            ),
            em: ({ children }) => <em className="prose-em">{children}</em>,
            strong: ({ children }) => (
              <strong className="prose-strong">{children}</strong>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
        {isStreaming && <StreamingDots />}
      </div>

      {/* Per-theme em/strong styling — drives the Shiny "highlighter" effect */}
      <style jsx>{`
        :global(.prose-klowi) {
          font-family: var(--font-prose);
        }
        :global(.prose-klowi .prose-em) {
          font-style: var(--em-style, italic);
          font-weight: var(--em-weight);
          color: var(--em-color);
          background: var(--em-bg);
          padding: var(--em-padding);
          border-radius: var(--em-radius);
        }
        :global(.prose-klowi .prose-strong) {
          color: var(--strong-color);
          font-weight: var(--strong-weight);
        }
      `}</style>
    </article>
  );
}
