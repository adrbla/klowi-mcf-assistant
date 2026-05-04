import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { head } from "@vercel/blob";
import type { MessageAttachment } from "./db/schema";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "text/markdown",
  "text/plain",
] as const;

export const ACCEPTED_EXTENSIONS = [".pdf", ".md", ".txt"] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export function isAcceptedMime(mime: string): mime is AcceptedMimeType {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(mime);
}

export function extensionFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function isAcceptedExtension(name: string): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(
    extensionFromName(name),
  );
}

/**
 * Resolve mime type for a given filename when the browser-supplied
 * MIME is empty or unhelpful (Safari sometimes sends "" for .md).
 */
export function resolveMime(name: string, browserMime: string): string {
  if (browserMime && isAcceptedMime(browserMime)) return browserMime;
  const ext = extensionFromName(name);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".md") return "text/markdown";
  if (ext === ".txt") return "text/plain";
  return browserMime || "application/octet-stream";
}

async function fetchBlob(blobPath: string): Promise<ArrayBuffer> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN not set");
  const meta = await head(blobPath, { token });
  const res = await fetch(meta.downloadUrl);
  if (!res.ok) {
    throw new Error(
      `failed to fetch blob ${blobPath}: ${res.status} ${res.statusText}`,
    );
  }
  return res.arrayBuffer();
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64");
}

/**
 * Build the Anthropic content blocks for a single attachment.
 * - PDFs become a `document` block (Claude reads natively, sees pages).
 * - Markdown / plain text become a `text` block, framed with the filename.
 *
 * If the blob fetch fails, returns null and logs — caller should skip.
 */
export async function buildAttachmentBlocks(
  att: MessageAttachment,
): Promise<Anthropic.ContentBlockParam[] | null> {
  try {
    const buf = await fetchBlob(att.blobPath);
    if (att.mediaType === "application/pdf") {
      return [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: arrayBufferToBase64(buf),
          },
        },
      ];
    }
    // Text-like (md, txt): inline framed text.
    const text = Buffer.from(buf).toString("utf-8");
    return [
      {
        type: "text",
        text: `[Document attaché : ${att.name}]\n\n${text}`,
      },
    ];
  } catch (err) {
    console.error(
      `[attachments] failed to build blocks for ${att.blobPath}:`,
      err,
    );
    return null;
  }
}
