# Document Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Chloë to attach `.md`, `.txt`, `.pdf` files to her chat messages via a paperclip button. PDFs use Anthropic's native document support (page-aware). Attachments persist across all turns of a conversation via history rebuild.

**Architecture:** Client uploads through new `/api/upload` endpoint to Vercel Blob. Metadata stored in a new `attachments JSONB` column on the `messages` table. The chat route reads attachments at send time and at every history rebuild, building Anthropic content arrays with `document` blocks (PDFs) or framed text blocks (MD/TXT). Cache breakpoint on the latest message with attachments avoids re-paying tokens on each turn.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Drizzle ORM + Vercel Postgres, Vercel Blob (`@vercel/blob`), `@anthropic-ai/sdk`.

**Spec reference:** `docs/superpowers/specs/2026-05-04-document-upload-design.md`

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `lib/attachments.ts` | Type definitions, MIME/extension/size validation, blob fetch helpers, content-block builders for Anthropic |
| `app/api/upload/route.ts` | POST endpoint: validates and uploads files to Vercel Blob, returns metadata |
| `app/components/AttachmentChip.tsx` | Visual chip for showing attached/sent files (inline in input area + inside user bubble) |

### Files to modify

| Path | Reason |
|---|---|
| `lib/db/schema.ts` | Add `attachments JSONB` column to `messages` |
| `lib/db/queries.ts` | Extend `addUserMessage` to accept attachments; add `listMessagesWithAttachments` (or extend `listMessages` to always return attachments) |
| `app/api/chat/route.ts` | Accept `attachments` in POST body, persist them, build Anthropic content arrays, place cache breakpoint |
| `app/Chat.tsx` | Wire paperclip button, file picker, upload progress state, include attachmentIds in POST |
| `app/components/MessageBubble.tsx` | Render attachment chips in user bubbles when `message.attachments?.length > 0` |
| `context/prompt/10-posture.md` | Add a paragraph in `## Outils` describing the upload feature for the companion's awareness |

### Files NOT to touch

- `middleware.ts` — already gates `/api/upload` automatically (matcher pattern excludes only `login`, `api/login`, `api/logout`, `_next`, `favicon`).
- `lib/anthropic.ts`, `lib/system-prompt.ts` — no changes needed.

---

## Constants used across tasks

- **Size cap**: `10 * 1024 * 1024` bytes (10 MB)
- **Accepted MIME types**: `application/pdf`, `text/markdown`, `text/plain`
- **Accepted extensions**: `.pdf`, `.md`, `.txt`
- **Blob path pattern**: `attachments/<uuid>.<ext>`

---

## Phase A — DB schema

### Task 1: Add `attachments` column to the `messages` schema

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Add the JSONB column to `messages`**

In `lib/db/schema.ts`, locate the `messages` table definition. Add a new column after the existing `blocks` column (at approximately line 19):

Current state (excerpt):
```ts
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  // Optional: store raw Anthropic content blocks (tool_use, tool_result, etc.) for replay
  blocks: jsonb("blocks"),
  // Token accounting (filled when streaming completes)
  inputTokens: integer("input_tokens"),
  // …
});
```

Modify to add the `attachments` column right after `blocks`:

```ts
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  blocks: jsonb("blocks"),
  attachments: jsonb("attachments").$type<MessageAttachment[]>(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  cacheCreationTokens: integer("cache_creation_tokens"),
  cacheReadTokens: integer("cache_read_tokens"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Define and export the `MessageAttachment` type**

At the top of `lib/db/schema.ts`, just after the imports, add:

```ts
export type MessageAttachment = {
  id: string;          // UUID generated server-side at upload
  name: string;        // original filename
  mediaType: string;   // "application/pdf" | "text/markdown" | "text/plain"
  sizeBytes: number;
  blobPath: string;    // path within Vercel Blob, e.g. "attachments/<uuid>.pdf"
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors. The `MessageAttachment` type is now exported from `lib/db/schema.ts`.

### Task 2: Push the schema change to Postgres

**Files:**
- None (uses `drizzle-kit`)

- [ ] **Step 1: Run drizzle-kit push**

```bash
npx drizzle-kit push
```

Expected: prompt asking if you want to add the `attachments` column to the `messages` table. Confirm. If `drizzle-kit push` runs non-interactively in this project, no prompt — it just applies. The CLI will print the SQL it executed.

- [ ] **Step 2: Verify the column exists**

```bash
node --env-file=.env.local -e 'import("@vercel/postgres").then(async ({ sql }) => { const r = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '"'"'messages'"'"' AND column_name = '"'"'attachments'"'"'`; console.log(r.rows); })'
```

Expected: prints `[ { column_name: 'attachments', data_type: 'jsonb' } ]`.

### Task 3: Extend `addUserMessage` to accept attachments

**Files:**
- Modify: `lib/db/queries.ts`

- [ ] **Step 1: Update the `addUserMessage` signature and body**

Find the current definition:

```ts
export async function addUserMessage(chatId: string, content: string): Promise<Message> {
  const [m] = await db
    .insert(messages)
    .values({ chatId, role: "user", content })
    .returning();
  return m;
}
```

Replace with:

```ts
export async function addUserMessage(
  chatId: string,
  content: string,
  attachments?: MessageAttachment[],
): Promise<Message> {
  const [m] = await db
    .insert(messages)
    .values({
      chatId,
      role: "user",
      content,
      attachments: attachments && attachments.length > 0 ? attachments : null,
    })
    .returning();
  return m;
}
```

Add the import at the top of the file. Find the existing import block:

```ts
import { chats, messages, type Chat, type Message } from "./schema";
```

Replace with:

```ts
import {
  chats,
  messages,
  type Chat,
  type Message,
  type MessageAttachment,
} from "./schema";
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors. Existing call sites of `addUserMessage` (which pass only 2 args) still work because `attachments` is optional.

- [ ] **Step 3: Commit Phase A**

```bash
git add lib/db/schema.ts lib/db/queries.ts
git commit -m "$(cat <<'EOF'
feat(db): add attachments JSONB column to messages

Adds a per-message metadata array for file attachments uploaded via
the chat input. Type MessageAttachment exported from schema.ts.
addUserMessage accepts an optional attachments param.

Schema change pushed via drizzle-kit push.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase B — Attachment library

### Task 4: Create `lib/attachments.ts` with validation + helpers

**Files:**
- Create: `lib/attachments.ts`

This file owns all attachment-related logic shared between the upload endpoint, the chat endpoint, and the rebuild path.

- [ ] **Step 1: Create the file**

Write `lib/attachments.ts`:

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors. The functions are exported and ready to use from server-only contexts.

- [ ] **Step 3: Commit**

```bash
git add lib/attachments.ts
git commit -m "$(cat <<'EOF'
feat(attachments): library for validation, blob fetch, content blocks

Centralizes the attachment lifecycle:
- Constants (size cap, accepted MIME types and extensions)
- Validation helpers (isAcceptedMime, isAcceptedExtension, resolveMime)
- buildAttachmentBlocks turns a MessageAttachment into Anthropic content
  blocks (document for PDFs, framed text for md/txt). Logs and returns
  null on blob fetch failure so callers can skip gracefully.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase C — Upload endpoint

### Task 5: Create the `/api/upload` route

**Files:**
- Create: `app/api/upload/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p app/api/upload
```

- [ ] **Step 2: Write the route handler**

Create `app/api/upload/route.ts`:

```ts
import "server-only";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import {
  MAX_ATTACHMENT_BYTES,
  isAcceptedExtension,
  isAcceptedMime,
  resolveMime,
  extensionFromName,
} from "@/lib/attachments";

export const runtime = "nodejs";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return Response.json(
      { error: "BLOB_READ_WRITE_TOKEN not configured" },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "missing file" }, { status: 400 });
  }

  // Validate size (server-side filet de sécurité; client also validates).
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return Response.json(
      {
        error: `file too large (${file.size} bytes; max ${MAX_ATTACHMENT_BYTES})`,
      },
      { status: 413 },
    );
  }

  // Validate extension and resolve MIME (browsers vary on .md → text/markdown).
  if (!isAcceptedExtension(file.name)) {
    return Response.json(
      { error: "unsupported file type — accepted: .pdf, .md, .txt" },
      { status: 400 },
    );
  }
  const mediaType = resolveMime(file.name, file.type);
  if (!isAcceptedMime(mediaType)) {
    return Response.json(
      { error: "unsupported MIME type" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const ext = extensionFromName(file.name); // includes the dot
  const blobPath = `attachments/${id}${ext}`;

  const buffer = await file.arrayBuffer();
  await put(blobPath, buffer, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: mediaType,
    token,
  });

  return Response.json({
    id,
    name: file.name,
    mediaType,
    sizeBytes: file.size,
    blobPath,
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify build picks up the new route**

Run: `npm run build`
Expected: build succeeds. The route table in the build output includes `/api/upload` as a dynamic (`ƒ`) route.

- [ ] **Step 5: Quick smoke test of the endpoint**

Start the dev server in the background, then hit the endpoint with a small text file. From the project root:

```bash
echo "Hello world from Strasbourg." > /tmp/test-attachment.md
```

Then in your browser, log in to `http://localhost:3000/login` (you need a session cookie for this to work). Once logged in, in the same browser, run this in the DevTools console:

```js
const fd = new FormData();
const blob = new Blob(["Hello world from Strasbourg."], { type: "text/markdown" });
fd.append("file", blob, "test.md");
const r = await fetch("/api/upload", { method: "POST", body: fd });
console.log(r.status, await r.json());
```

Expected: `200 { id, name: "test.md", mediaType: "text/markdown", sizeBytes: 28, blobPath: "attachments/<uuid>.md" }`.

- [ ] **Step 6: Commit Phase C**

```bash
git add app/api/upload/route.ts
git commit -m "$(cat <<'EOF'
feat(api): /api/upload endpoint for chat attachments

Multipart POST that validates extension, MIME, and size (10 MB cap),
generates a UUID, and stores the file in Vercel Blob under
attachments/<uuid>.<ext>. Returns metadata for the client to attach
to its next chat message.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase D — Chat route integration

### Task 6: Extend `/api/chat` to handle attachments

**Files:**
- Modify: `app/api/chat/route.ts`

The route must:
1. Accept `attachments` in the POST body (an array of `MessageAttachment`).
2. Persist them on the user message.
3. When building the Anthropic payload, expand each message's attachments into content blocks.
4. Place a cache breakpoint on the latest user message that has attachments (saves tokens on subsequent turns).

- [ ] **Step 1: Update body parsing and `addUserMessage` call**

In `app/api/chat/route.ts`, find the body type and parsing:

```ts
let body: { chatId?: string; message?: string };
```

Replace with:

```ts
let body: {
  chatId?: string;
  message?: string;
  attachments?: MessageAttachment[];
};
```

Find the line at ~line 46:

```ts
await addUserMessage(chatId, userMessage);
```

Replace with:

```ts
await addUserMessage(chatId, userMessage, body.attachments);
```

- [ ] **Step 2: Update imports**

Find the existing imports block at the top of the file. Replace it with this expanded version:

```ts
import "server-only";
import type { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic";
import { assembleSystemPrompt } from "@/lib/system-prompt";
import {
  createChat,
  getChat,
  listMessages,
  addUserMessage,
  addAssistantMessage,
  touchChat,
  setTitleIfDefault,
} from "@/lib/db/queries";
import type { Message as DbMessage, MessageAttachment } from "@/lib/db/schema";
import { buildAttachmentBlocks } from "@/lib/attachments";
```

- [ ] **Step 3: Build per-message content arrays**

Replace the current `historyForApi` construction (lines ~55-72) with:

```ts
  // Re-fetch attachments listed on each historical message and rebuild the
  // Anthropic content array. This means the companion sees previously
  // shared documents on every turn — not just the turn they were sent.
  const allMessages: DbMessage[] = [...history];
  // Note: the user message we just inserted via addUserMessage is NOT in
  // history (history was loaded before insert). We add it explicitly below
  // so the new attachments are included on this turn too.

  const historyForApi: Anthropic.MessageParam[] = await Promise.all(
    allMessages.map(async (m) => {
      const baseText = m.content;
      const atts = (m.attachments ?? []) as MessageAttachment[];
      if (atts.length === 0) {
        return {
          role: m.role as "user" | "assistant",
          content: baseText,
        };
      }
      const blocks: Anthropic.ContentBlockParam[] = [];
      for (const att of atts) {
        const built = await buildAttachmentBlocks(att);
        if (built) blocks.push(...built);
      }
      blocks.push({ type: "text", text: baseText });
      return {
        role: m.role as "user" | "assistant",
        content: blocks,
      };
    }),
  );

  // Seeded conversations open with an assistant message (the welcome
  // opening). Without a prior user message, the model assumes there was
  // an earlier exchange it doesn't have access to, and may hallucinate
  // referencing it ("I wrote it above…"). Prepend a synthetic user
  // opener so the assistant's first turn is anchored as a true greeting,
  // not a continuation. Stays out of the DB and out of the UI.
  if (historyForApi.length > 0 && historyForApi[0].role === "assistant") {
    historyForApi.unshift({
      role: "user",
      content:
        "[Méta : début de conversation. Chloë vient d'ouvrir un lien dédié vers cette session, elle n'a encore rien écrit. Le message qui suit est ton accueil — pas une continuation.]",
    });
  }

  // Build the current user message — may include attachments uploaded
  // alongside this turn.
  const currentAttachments = body.attachments ?? [];
  const currentBlocks: Anthropic.ContentBlockParam[] = [];
  for (const att of currentAttachments) {
    const built = await buildAttachmentBlocks(att);
    if (built) currentBlocks.push(...built);
  }
  currentBlocks.push({ type: "text", text: userMessage });

  // Cache breakpoint: place it on the LAST content block of the LATEST
  // message that carries attachments. Anthropic caches everything up to
  // and including that block, so subsequent turns don't re-pay attachment
  // tokens. If no attachments anywhere in the conversation, no extra
  // breakpoint is added (the system prompt already has one).
  const currentUserContent: Anthropic.ContentBlockParam[] | string =
    currentAttachments.length > 0
      ? withCacheBreakpointOnLast(currentBlocks)
      : currentBlocks.length === 1
        ? userMessage
        : currentBlocks;

  const anthropicMessages: Anthropic.MessageParam[] = [
    ...historyForApi,
    { role: "user", content: currentUserContent },
  ];
```

- [ ] **Step 4: Add the cache breakpoint helper at the bottom of the file**

After the closing brace of the `POST` function, add:

```ts
function withCacheBreakpointOnLast(
  blocks: Anthropic.ContentBlockParam[],
): Anthropic.ContentBlockParam[] {
  if (blocks.length === 0) return blocks;
  const result = [...blocks];
  const last = result[result.length - 1];
  // Only attach cache_control on block types that support it (document, text).
  if (last.type === "document" || last.type === "text") {
    result[result.length - 1] = {
      ...last,
      cache_control: { type: "ephemeral" },
    };
  }
  return result;
}
```

- [ ] **Step 5: Remove the now-redundant top-level `cache_control` on the stream call**

Find the `anthropic.messages.stream({...})` call. The current code has both `cache_control: { type: "ephemeral" }` at the top level (redundant / not part of the documented API surface) and the system block with cache_control. Keep the system one, remove the top-level one.

Current state:
```ts
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: systemText,
        cache_control: { type: "ephemeral" },
      },
    ],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    messages: anthropicMessages,
    cache_control: { type: "ephemeral" },
  });
```

Replace with:

```ts
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: systemText,
        cache_control: { type: "ephemeral" },
      },
    ],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    messages: anthropicMessages,
  });
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit Phase D**

```bash
git add app/api/chat/route.ts
git commit -m "$(cat <<'EOF'
feat(chat): /api/chat handles attachments end-to-end

POST body now accepts an attachments array. They're persisted on the
user message and expanded into Anthropic content blocks via
buildAttachmentBlocks (PDFs as document, md/txt as framed text).

Historical messages with attachments are also rebuilt on every turn,
so the companion sees previously shared documents in subsequent
exchanges. A cache breakpoint is placed on the last block of the
latest user message that has attachments, avoiding re-paying tokens
on each turn.

Removed the redundant top-level cache_control on the stream call.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase E — UI

### Task 7: Build the `<AttachmentChip>` component

**Files:**
- Create: `app/components/AttachmentChip.tsx`

Used in two places: pending chip above the input (with `onRemove`), and inline in user bubbles (without).

- [ ] **Step 1: Create the file**

Write `app/components/AttachmentChip.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

### Task 8: Wire paperclip + upload state in `Chat.tsx`

**Files:**
- Modify: `app/Chat.tsx`

- [ ] **Step 1: Add imports**

In `app/Chat.tsx`, replace the current imports block at the top:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./components/Brand";
import { Sidebar } from "./components/Sidebar";
import { MessageBubble, type Message } from "./components/MessageBubble";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import type { ChatSummary } from "./components/ChatListItem";
```

With:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./components/Brand";
import { Sidebar } from "./components/Sidebar";
import { MessageBubble, type Message } from "./components/MessageBubble";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import { AttachmentChip } from "./components/AttachmentChip";
import type { ChatSummary } from "./components/ChatListItem";
import type { MessageAttachment } from "@/lib/db/schema";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".md", ".txt"] as const;
```

- [ ] **Step 2: Add state for the pending attachment + upload status**

Just after the existing `useState` declarations (around line 23, after `const [isStreaming, setIsStreaming] = useState(false);`), add:

```ts
  const [pendingAttachment, setPendingAttachment] =
    useState<MessageAttachment | null>(null);
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "error"
  >("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: Add the file picker handler**

Inside the component body, after `handleDeleteChat`, add:

```ts
  const handlePickFile = useCallback(() => {
    if (uploadState === "uploading" || isStreaming) return;
    fileInputRef.current?.click();
  }, [uploadState, isStreaming]);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so selecting the same file twice still fires onChange.
      e.target.value = "";
      if (!file) return;

      // Client-side validation (filet, server re-validates).
      const lower = file.name.toLowerCase();
      const acceptedExt = ACCEPTED_EXTENSIONS.some((x) => lower.endsWith(x));
      if (!acceptedExt) {
        setUploadError(
          "Je lis les .md, .txt et .pdf pour l'instant. Si tu as un .docx ou autre, convertis en markdown ou en PDF — markdown préféré.",
        );
        setUploadState("error");
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        setUploadError(
          `Le fichier fait ${mb} MB, je suis capée à 10 MB.`,
        );
        setUploadState("error");
        return;
      }

      setUploadState("uploading");
      setUploadError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || `upload failed (${res.status})`);
        }
        const att = (await res.json()) as MessageAttachment;
        setPendingAttachment(att);
        setUploadState("idle");
      } catch (err) {
        setUploadError(
          err instanceof Error
            ? err.message
            : "L'upload a échoué. Tu peux réessayer.",
        );
        setUploadState("error");
      }
    },
    [],
  );

  const handleRemoveAttachment = useCallback(() => {
    setPendingAttachment(null);
    setUploadState("idle");
    setUploadError(null);
  }, []);
```

- [ ] **Step 4: Update `handleSubmit` to include the attachment**

Find the current `handleSubmit` body. The fetch call currently sends:

```ts
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, message: text }),
        });
```

Replace with:

```ts
        const attachmentsForRequest = pendingAttachment ? [pendingAttachment] : [];
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            message: text,
            attachments: attachmentsForRequest,
          }),
        });
```

Also update the optimistic message append to include the attachment so the UI shows the chip immediately. Find:

```ts
      setMessages((m) => [
        ...m,
        { role: "user", content: text, createdAt: new Date().toISOString() },
        { role: "assistant", content: "" },
      ]);
```

Replace with:

```ts
      setMessages((m) => [
        ...m,
        {
          role: "user",
          content: text,
          createdAt: new Date().toISOString(),
          attachments: pendingAttachment ? [pendingAttachment] : undefined,
        },
        { role: "assistant", content: "" },
      ]);
```

Also clear the pending attachment after the optimistic insert. Just after the `setMessages` for the optimistic insert, add:

```ts
      const sentAttachment = pendingAttachment;
      setPendingAttachment(null);
```

And in the fetch call, replace `pendingAttachment` with `sentAttachment` (state may have been cleared in flight):

```ts
        const attachmentsForRequest = sentAttachment ? [sentAttachment] : [];
```

Update the dependency array of `handleSubmit` to include `pendingAttachment`:

```ts
    [input, isStreaming, chatId, refreshChats, router, pendingAttachment],
```

- [ ] **Step 5: Update the form JSX — add the paperclip button + chip + hidden input**

Find the form section at the bottom of the JSX (around line 268). Currently:

```tsx
        <form
          onSubmit={handleSubmit}
          className="flex-shrink-0 px-6 md:px-8 pb-6 pt-3 bg-background"
        >
          <div
            className={`max-w-[720px] mx-auto flex items-center gap-2.5 px-4 py-3 bg-surface border rounded-full transition-colors ${
              isStreaming
                ? "border-border opacity-60"
                : "border-border focus-within:border-foreground"
            }`}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              placeholder={isStreaming ? "…" : "écris ici…"}
              className="flex-1 bg-transparent border-none outline-none text-foreground text-[14.5px] placeholder:text-faint disabled:cursor-not-allowed"
              autoFocus
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="w-8 h-8 grid place-items-center bg-foreground text-background rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Envoyer"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-3.5 h-3.5"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          </div>
        </form>
```

Replace with:

```tsx
        <form
          onSubmit={handleSubmit}
          className="flex-shrink-0 px-6 md:px-8 pb-6 pt-3 bg-background"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
            className="hidden"
            onChange={handleFileSelected}
          />
          <div className="max-w-[720px] mx-auto flex flex-col gap-2">
            {(pendingAttachment || uploadState === "uploading") && (
              <div className="flex items-center">
                {uploadState === "uploading" ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-md text-muted text-[13px]">
                    <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
                      Envoi…
                    </span>
                  </div>
                ) : pendingAttachment ? (
                  <AttachmentChip
                    name={pendingAttachment.name}
                    sizeBytes={pendingAttachment.sizeBytes}
                    onRemove={handleRemoveAttachment}
                  />
                ) : null}
              </div>
            )}
            {uploadError && (
              <div className="text-[12.5px] text-red-500 leading-[1.4] font-prose">
                {uploadError}
              </div>
            )}
            <div
              className={`flex items-center gap-2.5 px-4 py-3 bg-surface border rounded-full transition-colors ${
                isStreaming
                  ? "border-border opacity-60"
                  : "border-border focus-within:border-foreground"
              }`}
            >
              <button
                type="button"
                onClick={handlePickFile}
                disabled={isStreaming || uploadState === "uploading"}
                className="w-7 h-7 grid place-items-center text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                aria-label="Joindre un document"
                title="Joindre un .md, .txt ou .pdf"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  className="w-4 h-4"
                >
                  <path d="M10.5 2.5 5 8a2 2 0 0 0 2.83 2.83l5-5a3.5 3.5 0 0 0-4.95-4.95L3 6.27a5 5 0 0 0 7.07 7.07l4.43-4.43" />
                </svg>
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isStreaming}
                placeholder={isStreaming ? "…" : "écris ici…"}
                className="flex-1 bg-transparent border-none outline-none text-foreground text-[14.5px] placeholder:text-faint disabled:cursor-not-allowed"
                autoFocus
              />
              <button
                type="submit"
                disabled={
                  isStreaming ||
                  uploadState === "uploading" ||
                  (!input.trim() && !pendingAttachment)
                }
                className="w-8 h-8 grid place-items-center bg-foreground text-background rounded-full disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                aria-label="Envoyer"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="w-3.5 h-3.5"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </button>
            </div>
          </div>
        </form>
```

- [ ] **Step 6: Verify build + lint**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run lint`
Expected: no NEW lint errors. Pre-existing apostrophe errors in `AdminClient.tsx` and `Sidebar.tsx` may still appear — leave them.

### Task 9: Render attachment chips inside user bubbles

**Files:**
- Modify: `app/components/MessageBubble.tsx`

The `Message` type currently lacks an `attachments` field. Extend it, and render chips when present.

- [ ] **Step 1: Extend the `Message` type and import `AttachmentChip`**

In `app/components/MessageBubble.tsx`, find the imports and the `Message` type (lines 3-10):

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { StreamingDots } from "./StreamingDots";

export type Message = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};
```

Replace with:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { StreamingDots } from "./StreamingDots";
import { AttachmentChip } from "./AttachmentChip";
import type { MessageAttachment } from "@/lib/db/schema";

export type Message = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  attachments?: MessageAttachment[];
};
```

- [ ] **Step 2: Render chips above the user bubble's text**

Find the user-role branch (around line 40-53):

```tsx
  if (message.role === "user") {
    const stamp = message.createdAt ? formatTimestamp(message.createdAt) : null;
    return (
      <div className="flex flex-col items-end gap-1">
        {stamp && (
          <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-faint">
            {stamp}
          </div>
        )}
        <div className="max-w-[78%] rounded-[18px] rounded-br-[6px] bg-foreground text-background px-4 py-2.5 text-[14.5px] leading-[1.5] whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }
```

Replace with:

```tsx
  if (message.role === "user") {
    const stamp = message.createdAt ? formatTimestamp(message.createdAt) : null;
    const atts = message.attachments ?? [];
    return (
      <div className="flex flex-col items-end gap-1.5">
        {stamp && (
          <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-faint">
            {stamp}
          </div>
        )}
        {atts.length > 0 && (
          <div className="flex flex-col items-end gap-1 max-w-[78%]">
            {atts.map((att) => (
              <AttachmentChip key={att.id} name={att.name} />
            ))}
          </div>
        )}
        {message.content && (
          <div className="max-w-[78%] rounded-[18px] rounded-br-[6px] bg-foreground text-background px-4 py-2.5 text-[14.5px] leading-[1.5] whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}
      </div>
    );
  }
```

(The `message.content && ...` guard handles the edge case of an attachment-only message with no text. The current chat input requires either text or an attachment to enable Send, so empty-text-with-attachment is a possibility.)

- [ ] **Step 3: Update history endpoint to return attachments**

The `/api/chat/history` endpoint maps DB rows to a public shape. It currently strips off `attachments`. Open `app/api/chat/history/route.ts`:

Find the response building:

```ts
  return Response.json(
    messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  );
```

Replace with:

```ts
  return Response.json(
    messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      attachments: m.attachments ?? undefined,
    })),
  );
```

- [ ] **Step 4: Update the server-rendered `app/conv/[id]/page.tsx` to pass attachments**

Open `app/conv/[id]/page.tsx`:

Find the message mapping:

```tsx
  const initialMessages: Message[] = rawMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
```

Replace with:

```tsx
  const initialMessages: Message[] = rawMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    attachments: (m.attachments ?? undefined) as Message["attachments"],
  }));
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit Phase E**

```bash
git add app/components/AttachmentChip.tsx app/Chat.tsx app/components/MessageBubble.tsx app/api/chat/history/route.ts app/conv/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(ui): paperclip + attachment chip + bubble rendering

- New AttachmentChip component (paperclip icon, name, optional size,
  optional remove ✕). Reused in input area and inside user bubbles.
- Chat.tsx: paperclip button, hidden file input, client-side validation
  (extension, 10 MB), upload state machine (idle/uploading/error),
  pending attachment chip above input, attachmentIds passed in POST
  /api/chat body. Submit disabled while uploading.
- MessageBubble: Message type carries optional attachments; renders
  chips above the bubble text in user messages.
- /api/chat/history and /conv/[id]/page.tsx now pass attachments
  through to the client so re-loading a conv shows the chips.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase F — System prompt awareness

### Task 10: Add the upload paragraph to `10-posture.md`

**Files:**
- Modify: `context/prompt/10-posture.md`

- [ ] **Step 1: Find the `## Outils` section**

In `context/prompt/10-posture.md`, find the section starting with:

```markdown
## Outils

- **Web search** : tu peux chercher sur le web. Utilise-le quand l'info que Chloë mentionne est plus récente que ton training, ou quand il faut vérifier un nom, une date, une publication, une actualité de labo. Ne préviens pas systématiquement avant de chercher — fais-le et cite si pertinent.
- **Pas d'autres outils pour l'instant.** Tu n'écris pas dans des fichiers, tu n'ouvres pas de pages côté Chloë, tu ne fais pas d'opérations système. Tout passe par la conversation.
```

- [ ] **Step 2: Replace with the expanded section**

Replace that whole `## Outils` section with:

```markdown
## Outils

- **Web search** : tu peux chercher sur le web. Utilise-le quand l'info que Chloë mentionne est plus récente que ton training, ou quand il faut vérifier un nom, une date, une publication, une actualité de labo. Ne préviens pas systématiquement avant de chercher — fais-le et cite si pertinent.
- **Upload de documents.** Chloë peut joindre un `.md`, `.txt` ou `.pdf` à un message via le paperclip de la barre d'envoi (les PDF sont lus avec leur structure de pages — tu peux référencer « page 3 », etc., si ça aide). Si elle colle un long passage qu'il serait plus pratique d'avoir en fichier, ou si elle évoque un document qu'elle a sous la main, tu peux le suggérer — sobrement, pas un réflexe à chaque tour. Quand un document est joint, le principe « tu ne produis pas à sa place » continue de s'appliquer : tu commentes, tu questionnes, tu pointes — tu ne réécris pas.
- **Pas d'autres outils pour l'instant.** Tu n'écris pas dans des fichiers, tu n'ouvres pas de pages côté Chloë, tu ne fais pas d'opérations système. Tout passe par la conversation.
```

- [ ] **Step 3: Commit**

```bash
git add context/prompt/10-posture.md
git commit -m "$(cat <<'EOF'
prompt: companion awareness of document upload

Adds an "Upload de documents" bullet in § Outils explaining the
paperclip mechanism, the file types supported, and how to reference
PDF pages. Reaffirms that "ne produit pas à sa place" applies even
when she shares a draft.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase G — End-to-end smoke test + ship

### Task 11: Manual e2e walkthrough

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Server starts at `http://localhost:3000`.

- [ ] **Step 2: Test markdown upload**

In the browser:
1. Log in.
2. Open the welcome conv (or any conv).
3. Click the paperclip → pick a `.md` file you have lying around. (If you don't, create one: `echo "# Strasbourg liminaire — brouillon\n\nMa première phrase." > /tmp/test.md` then upload `/tmp/test.md`.)
4. Verify chip appears above the input with the filename + size.
5. Type a short message: "Voici mon brouillon, qu'en penses-tu ?"
6. Send.

Expected:
- The user bubble shows the chip ABOVE the text.
- Companion streams a response that references the content of the markdown (e.g., mentions "Strasbourg liminaire").
- The Socratic posture holds (no rewrite of the brouillon).

- [ ] **Step 3: Test PDF upload**

Find or create a small PDF (any 1-3 page PDF). Repeat steps 2-6.

Expected:
- Chip shows the .pdf filename.
- Companion can reference page numbers if the PDF has multiple pages.

- [ ] **Step 4: Test continuity (the doc persists across turns)**

After step 3 (PDF turn complete), send a follow-up: "Et la page 2, comment tu la vois ?"

Expected: companion answers with reference to page 2 specifically (proving the document is still in the API context).

- [ ] **Step 5: Test rejection of unsupported format**

Try to upload a `.docx` (rename a `.txt` to `.docx` if needed). The file picker should not show it (because of `accept`). Test the validation by dragging it in or by editing the file picker filter:

The simpler test: pick a `.txt`, send with the test message. Inspect that it works (it should — `.txt` is supported). For an unsupported test, see step 6.

- [ ] **Step 6: Test oversize rejection**

Create a 12 MB file:

```bash
dd if=/dev/zero of=/tmp/big.pdf bs=1M count=12 2>/dev/null
```

Try to attach it via the paperclip.

Expected: client-side validation rejects with the 10 MB error message. No upload request fires.

- [ ] **Step 7: Test reload — attachments survive**

Reload the welcome conv URL. The conv re-renders from server. The user bubbles with attachments should still show the chips.

- [ ] **Step 8: Stop dev server**

`Ctrl+C` in the terminal running `npm run dev`.

- [ ] **Step 9: Clean up test attachments from DB**

The smoke test added user messages + assistant responses to the welcome conv. Re-seed:

```bash
npm run seed-welcome
```

Expected: `wiped N prior message(s)` where N is whatever you sent.

### Task 12: Push to main + final close-the-loop

- [ ] **Step 1: Update journal**

Open `context/journal.md`. Prepend a new section after the title and the comment line, and BEFORE the existing "2026-04-30 — Phase 6 archi" entry:

```markdown
## 2026-05-04 — Document upload (.md, .txt, .pdf) (Adrien B.)

**Goal**: Permettre à Chloë de joindre des fichiers à ses messages plutôt que de copier-coller de gros blocs de texte. PDFs avec support natif des pages.

### Livraison

- **DB** : nouvelle colonne `attachments JSONB` sur `messages`, type `MessageAttachment` exporté depuis `lib/db/schema.ts`. `addUserMessage` accepte un argument optionnel.
- **Lib** : `lib/attachments.ts` centralise validation (extension/MIME/taille), fetch Blob, et la construction des content blocks Anthropic (`document` pour PDF, texte framé pour MD/TXT). Logge et skip si Blob renvoie une erreur.
- **Endpoint** : `POST /api/upload` (multipart, valide, upload Blob `attachments/<uuid>.<ext>`, retourne metadata).
- **Chat route** : accepte `attachments[]` dans le body, persiste sur le user message, reconstruit les content blocks pour TOUS les messages historiques avec attachements à chaque tour. Cache breakpoint placé sur le dernier bloc du dernier user message qui porte des attachements (économise les tokens sur les tours ultérieurs).
- **UI** : paperclip dans la barre d'input, file picker filtré sur `.pdf,.md,.txt`, validation client (extension + 10 MB), chip pendant + dans la bulle user. `<AttachmentChip>` réutilisable (avec/sans bouton ✕).
- **System prompt** : ajout d'une bullet « Upload de documents » dans `10-posture.md` § Outils. Awareness sans inflation didactique.

### Concerns notés

- **Re-fetch Blob à chaque tour** : pas de cache mémoire en v1. Si la latence d'un tour devient gênante (>2s additionnels), ajouter un cache 5min comme `lib/system-prompt.ts` ou stocker les bytes dans `messages.blocks`.
- **Orphan blobs** : pas de sweep automatique, accepté pour single-user. Path namespace `attachments/<id>.<ext>` permet un audit manuel.

***
```

- [ ] **Step 2: Commit journal**

```bash
git add context/journal.md
git commit -m "$(cat <<'EOF'
chore: journal — document upload phase 7 closed

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push to main**

```bash
git push origin main
```

Expected: push succeeds. Vercel auto-deploys.

- [ ] **Step 4: Verify prod is live**

After Vercel deploy completes (~1-2 minutes), open the welcome conv URL in an incognito window. Log in, attach a small `.md`, send a message. Confirm everything works on prod.

**Phase 7 shipped.**

---

## Self-Review

After completing all tasks above, verify:

1. **Spec coverage** — every requirement in `docs/superpowers/specs/2026-05-04-document-upload-design.md`:
   - § 1 UI (paperclip, chip, validation, errors) → Tasks 7, 8, 9 ✓
   - § 2 Storage and pipeline (`/api/upload`, schema, chat route content array) → Tasks 1, 2, 3, 5, 6 ✓
   - § 3 Errors / cas limites (upload failures, blob 4xx/5xx fallback, backward compat) → Tasks 4, 5, 6 ✓
   - § 4 System prompt awareness → Task 10 ✓
   - § 5 Sécurité (auth via middleware, double validation, size cap) → Tasks 5, 8 ✓

2. **No placeholders** — every code block contains the actual code; every command has expected output; no "TBD" / "TODO" / "fill in details".

3. **Type/identifier consistency**:
   - `MessageAttachment` type defined in `lib/db/schema.ts` (Task 1), imported and used in `lib/db/queries.ts` (Task 3), `lib/attachments.ts` (Task 4), `app/api/chat/route.ts` (Task 6), `app/Chat.tsx` (Task 8), `app/components/MessageBubble.tsx` (Task 9).
   - `MAX_ATTACHMENT_BYTES` defined in `lib/attachments.ts` (Task 4), redeclared with same value in `app/Chat.tsx` (Task 8) — duplication is intentional (server vs client boundary, no shared isomorphic constants module).
   - `ACCEPTED_EXTENSIONS` similarly defined in both places.
   - `buildAttachmentBlocks` function name consistent in lib/attachments.ts (Task 4) and chat route (Task 6).
   - `pendingAttachment` state name consistent across Task 8 steps.
   - `withCacheBreakpointOnLast` helper defined and called in Task 6.
