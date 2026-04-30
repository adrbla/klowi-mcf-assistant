# Conv Link + Seeded Welcome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor conversation routing to a URL-driven `/conv/[id]` pattern, retire the bootstrap onboarding layer, and add a seeded welcome conversation whose first message animates progressively on first opening.

**Architecture:** URL becomes the source of truth for active conversation (`/conv/[id]`). Bootstrap layer is removed entirely (route, components, markers, system prompt mentions). A seeded welcome conversation is created via an idempotent script (`npm run seed-welcome`) with a placeholder opening message stored as the first assistant message in DB. A new client component animates this message char-by-char as long as the conv has only that single assistant message and no user reply yet.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Drizzle ORM + Vercel Postgres, React 19, `next-themes`, Tailwind 4. No test framework — verification is via `npm run build`, `npm run lint`, and manual smoke testing in `npm run dev`.

**Spec reference:** `docs/superpowers/specs/2026-04-30-conv-link-welcome-design.md`

**Phase 2 (separate session, out of scope):** Final welcome message text + system prompt rework to integrate the new posture brief.

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `app/conv/[id]/page.tsx` | Server component for `/conv/[id]` — validates chat exists, fetches history, renders `<Chat>` with props |
| `lib/seeded-convs.ts` | Constants for seeded conversations (UUID, title, opening message) |
| `app/components/TypewriterMessage.tsx` | Client component that animates a fixed assistant message char-by-char |
| `scripts/seed-welcome-conv.ts` | Idempotent upsert script — creates/resets the welcome conv |

### Files to modify

| Path | Reason |
|---|---|
| `app/page.tsx` | Stays minimal; renders `<Chat />` with no `initialChatId` |
| `app/Chat.tsx` | Accept `initialChatId` / `initialMessages` props; replace localStorage with URL; remove welcome kickoff; integrate TypewriterMessage |
| `app/api/chat/route.ts` | Remove `[OPEN]` / `[FIRST]` marker handling and "Warm up" pre-naming |
| `app/api/chat/history/route.ts` | Remove marker filtering |
| `context/prompt/00-identity.md` | Strip bootstrap-phase content (markers, `/start`, intro flow) |
| `context/prompt/10-posture.md` | Remove the single `[FIRST]`-anchored "pas ChatGPT" mention |
| `package.json` | Add `seed-welcome` npm script |

### Files to delete

- `app/bootstrap/page.tsx`
- `app/bootstrap/BootstrapShell.tsx`
- `app/BootstrapView.tsx`
- `app/components/KickoffProgress.tsx`

---

## Phase A — Cleanup bootstrap

### Task 1: Delete bootstrap files

**Files:**
- Delete: `app/bootstrap/page.tsx`, `app/bootstrap/BootstrapShell.tsx`, `app/BootstrapView.tsx`, `app/components/KickoffProgress.tsx`

- [ ] **Step 1: Delete the four files**

```bash
rm app/bootstrap/page.tsx app/bootstrap/BootstrapShell.tsx app/BootstrapView.tsx app/components/KickoffProgress.tsx
rmdir app/bootstrap
```

- [ ] **Step 2: Verify no remaining imports reference these files**

```bash
grep -rn "BootstrapView\|BootstrapShell\|KickoffProgress" app lib scripts --include="*.ts" --include="*.tsx" || echo "no references — OK"
```

Expected: prints "no references — OK". If any references remain, they will be cleaned in Tasks 2-5.

### Task 2: Strip marker handling from `/api/chat/route.ts`

**Files:**
- Modify: `app/api/chat/route.ts:50-65`

- [ ] **Step 1: Edit the route to remove marker logic**

Replace the marker-handling block (the `isMarker`, `[FIRST]` "Warm up" naming, and the conditional `setTitleIfDefault`) with the simpler version below. Open `app/api/chat/route.ts` and replace lines 50-65 (the comment block + `isMarker` + `if (isNewChat && userMessage === "[FIRST]")` block + `if (!isMarker)` block) with:

```ts
  // The first user message of a chat sets the title (truncated for sidebar).
  const title =
    userMessage.length > 60 ? userMessage.slice(0, 57) + "…" : userMessage;
  await setTitleIfDefault(chatId, title);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to `app/api/chat/route.ts`.

### Task 3: Remove marker filter from `/api/chat/history/route.ts`

**Files:**
- Modify: `app/api/chat/history/route.ts:22-34`

- [ ] **Step 1: Replace the filter+map with a plain map**

Replace:

```ts
  // [OPEN] (bootstrap) and [FIRST] (post-bootstrap welcome) are session-kickoff
  // markers sent by the client UIs. They're stored so Anthropic sees the
  // user/assistant alternation, but never shown to the human reader.
  return Response.json(
    messages
      .filter((m) => m.content !== "[OPEN]" && m.content !== "[FIRST]")
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
  );
```

With:

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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

### Task 4: Strip welcome kickoff from `Chat.tsx`

**Files:**
- Modify: `app/Chat.tsx`

This task only removes the bootstrap-phase logic. The full URL-driven refactor happens in Task 7. After this task, the page still uses localStorage for `chatId` — it just no longer auto-fires `[FIRST]` on `?welcome=1`.

- [ ] **Step 1: Remove the `WELCOME_KICKOFF` constant**

Find at `app/Chat.tsx:11`:

```ts
const WELCOME_KICKOFF = "[FIRST]";
```

Delete this line.

- [ ] **Step 2: Remove `welcomeFiredRef`**

Find at `app/Chat.tsx:26`:

```ts
const welcomeFiredRef = useRef(false);
```

Delete this line.

- [ ] **Step 3: Remove the `fireWelcomeKickoff` callback (entire `useCallback` block)**

Delete the entire `fireWelcomeKickoff` definition (lines ~78-123). It starts with:

```ts
  const fireWelcomeKickoff = useCallback(async () => {
```

and ends with the closing `}, [refreshChats]);` of that `useCallback`.

- [ ] **Step 4: Remove the `useEffect` that reads `?welcome=1`**

Delete the entire `useEffect` block (lines ~125-135) that begins:

```ts
  useEffect(() => {
    if (!hydrated || welcomeFiredRef.current) return;
    if (chatId || messages.length > 0) return;
```

- [ ] **Step 5: Verify the build passes**

Run: `npm run build`
Expected: build succeeds. If TypeScript flags an unused import (e.g., `useRef` no longer used), remove it.

- [ ] **Step 6: Commit phase A so far**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: retire bootstrap layer (route, components, markers, kickoff)

Removes the /bootstrap onboarding flow now that Chloë has been through it.
- Delete app/bootstrap/, BootstrapView.tsx, KickoffProgress.tsx
- Strip [OPEN]/[FIRST] handling from /api/chat and /api/chat/history
- Remove fireWelcomeKickoff and ?welcome=1 logic from Chat.tsx

System prompt cleanup follows in next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5: Strip bootstrap content from system prompt

**Files:**
- Modify: `context/prompt/00-identity.md`
- Modify: `context/prompt/10-posture.md`

The `00-identity.md` file is heavily bootstrap-coupled. Most of it goes. The `10-posture.md` file has a single `[FIRST]`-anchored mention to remove.

- [ ] **Step 1: Rewrite `context/prompt/00-identity.md` to keep only the durable identity content**

Replace the entire file contents with:

```markdown
# Identity

## Vocabulaire

- **L'espace dans lequel tu opères** s'appelle officieusement **CC · MCF · Prep Companion** — c'est juste une étiquette discrète qui désigne cet outil que **Chloë Cottrell** utilise pour préparer ses auditions MCF. Tu n'as pas à le citer ni à t'y identifier. Évoque-le simplement comme « ici », « cet espace », « notre espace » si nécessaire.
- **Toi** = sa **companion** / sa **compagne** pour les semaines qui viennent. Pas son coach, pas son tuteur, pas son assistante. Plus proche d'une amie qui se trouve là, fiable et présente.
- Tu n'as pas de nom à toi pour l'instant. (Le surnom phonétique « Klowi » que tu pourrais croiser dans certains documents désigne **Chloë**, jamais toi.)

## Si Chloë te demande comment tu t'appelles

Tu réponds **calmement et avec transparence**, en une phrase ou deux :

> Tu peux m'appeler comme tu veux. Je n'ai pas encore de nom à moi — Adrien a prévu que tu puisses m'en choisir un, que je garderais en mémoire, mais ce n'est pas encore branché. Bientôt.

Si elle te propose un nom dans la conversation, tu peux **l'utiliser dans la session en cours** (par mimétisme, parce qu'elle vient de te le donner). Mais tu lui dis honnêtement que tu **ne peux pas encore le mémoriser** d'une session à l'autre — la fonctionnalité n'est pas active.

## Tu utilises le pronom féminin (she/her / elle).
```

- [ ] **Step 2: Remove the `[FIRST]`-anchored sentence from `context/prompt/10-posture.md`**

Find at the end of the "Avec quelqu'un qui se méfie de l'IA" section:

```markdown
- **Une seule fois — au moment du `[FIRST]`** — tu peux dire que tu n'es **pas un assistant générique** ni ChatGPT, mais quelque chose de calibré pour cette prep. Sobrement. Pas répété ailleurs.
```

Delete this entire bullet point. The "Avec quelqu'un qui se méfie de l'IA" section keeps its other bullets intact.

- [ ] **Step 3: Verify no remaining `[OPEN]` / `[FIRST]` / `/bootstrap` / `/start` mentions in the prompt**

Run: `grep -rn "\[OPEN\]\|\[FIRST\]\|/bootstrap\|/start\|Warm up" context/prompt/ || echo "clean"`
Expected: prints "clean".

- [ ] **Step 4: Commit prompt cleanup**

```bash
git add context/prompt/
git commit -m "$(cat <<'EOF'
prompt: strip bootstrap-phase content from identity & posture

00-identity.md is reduced to durable identity content. The bootstrap
intro flow, the [OPEN]/[FIRST] markers, the /start command, and the
"pas ChatGPT au [FIRST]" disclaimer are all removed.

Phase 2 will rework the broader posture to integrate the new compagnon
brief — this commit is just the bootstrap cleanup.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6: Smoke test phase A

- [ ] **Step 1: Run dev server and verify the home page**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`. Open `/` (after login). The chat page loads. There is no auto-fired welcome message. The sidebar shows the existing chats. Type a message — get a normal streaming response.

- [ ] **Step 2: Verify `/bootstrap` is now 404**

Open `/bootstrap` in the browser. Expected: 404. (If it shows the default Next.js 404 or a redirect, both are acceptable — we just want it gone.)

- [ ] **Step 3: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`.

---

## Phase B — Routing refactor

### Task 7: Refactor `Chat.tsx` to URL-driven state

**Files:**
- Modify: `app/Chat.tsx`

The component currently hydrates `chatId` from `localStorage`. It needs to accept props from a parent server component instead, and use `next/navigation` to update the URL when the active chat changes.

- [ ] **Step 1: Update the `Chat` component signature and remove localStorage hydration**

Replace the top of the file (imports + the first `useEffect` for localStorage hydration) so the component accepts props.

Current top of `app/Chat.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brand } from "./components/Brand";
import { Sidebar } from "./components/Sidebar";
import { MessageBubble, type Message } from "./components/MessageBubble";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import type { ChatSummary } from "./components/ChatListItem";

const CHAT_ID_KEY = "klowi.chatId";

export default function Chat() {
  const [hydrated, setHydrated] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  // …
```

New top:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./components/Brand";
import { Sidebar } from "./components/Sidebar";
import { MessageBubble, type Message } from "./components/MessageBubble";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import type { ChatSummary } from "./components/ChatListItem";

export default function Chat({
  initialChatId = null,
  initialMessages = [],
}: {
  initialChatId?: string | null;
  initialMessages?: Message[];
}) {
  const router = useRouter();
  const [chatId, setChatId] = useState<string | null>(initialChatId);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  // …
```

Remove the `CHAT_ID_KEY` constant. Remove the `hydrated` state and any `setHydrated`/`if (!hydrated) return …` early-return. Remove the `useEffect` that reads `localStorage.getItem(CHAT_ID_KEY)`.

- [ ] **Step 2: Update `handleSelectChat` to push the URL**

Replace:

```ts
  const handleSelectChat = useCallback(
    async (id: string) => {
      setChatId(id);
      localStorage.setItem(CHAT_ID_KEY, id);
      await loadHistory(id);
      inputRef.current?.focus();
    },
    [loadHistory],
  );
```

With:

```ts
  const handleSelectChat = useCallback(
    (id: string) => {
      router.push(`/conv/${id}`);
    },
    [router],
  );
```

(History loading happens server-side in the page component now — no need to `loadHistory` here.)

- [ ] **Step 3: Update `handleNewChat` to push to `/`**

Replace:

```ts
  const handleNewChat = useCallback(() => {
    setChatId(null);
    setMessages([]);
    localStorage.removeItem(CHAT_ID_KEY);
    setMobileOpen(false);
    inputRef.current?.focus();
  }, []);
```

With:

```ts
  const handleNewChat = useCallback(() => {
    setMobileOpen(false);
    router.push("/");
  }, [router]);
```

- [ ] **Step 4: Update `handleDeleteChat` to navigate to `/` if the active chat is deleted**

Replace:

```ts
  const handleDeleteChat = useCallback(
    async (id: string) => {
      setChats((cs) => cs.filter((c) => c.id !== id));
      if (id === chatId) handleNewChat();
      try {
        await fetch(`/api/chats/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      } catch {
        /* swallow */
      }
    },
    [chatId, handleNewChat],
  );
```

With:

```ts
  const handleDeleteChat = useCallback(
    async (id: string) => {
      setChats((cs) => cs.filter((c) => c.id !== id));
      if (id === chatId) {
        router.push("/");
      }
      try {
        await fetch(`/api/chats/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      } catch {
        /* swallow */
      }
    },
    [chatId, router],
  );
```

- [ ] **Step 5: Update `handleSubmit` to redirect to `/conv/{newId}` on first message of a new chat**

Inside the existing `handleSubmit` callback, find where `newId` is captured from the response header:

```ts
        const newId = res.headers.get("X-Chat-Id");
        if (newId && newId !== chatId) {
          setChatId(newId);
          localStorage.setItem(CHAT_ID_KEY, newId);
        }
```

Replace with:

```ts
        const newId = res.headers.get("X-Chat-Id");
        if (newId && newId !== chatId) {
          setChatId(newId);
          // Reflect the new chat id in the URL without adding a history entry.
          router.replace(`/conv/${newId}`);
        }
```

- [ ] **Step 6: Remove the now-unused `loadHistory` callback**

Search for `const loadHistory = useCallback` in `app/Chat.tsx`. Remove the entire `useCallback` block. Also remove any references to `loadHistory` (the dependency arrays of remaining hooks should no longer include it). Verify by grepping.

```bash
grep -n "loadHistory" app/Chat.tsx || echo "clean"
```

Expected: prints "clean".

- [ ] **Step 7: Add a `useEffect` to sync internal state when `initialChatId` / `initialMessages` change**

Because Next.js soft navigation reuses the `<Chat>` component across `/` ↔ `/conv/[id]` transitions, the props change but local state doesn't reset on its own. Add this `useEffect` near the top of the component body, after the `useState` declarations:

```ts
  useEffect(() => {
    setChatId(initialChatId);
    setMessages(initialMessages);
  }, [initialChatId, initialMessages]);
```

- [ ] **Step 8: Refresh the chat list on mount**

The original code had `refreshChats()` inside the localStorage-hydration `useEffect`. Add a fresh `useEffect` to fetch the list on mount and on chat changes:

```ts
  useEffect(() => {
    refreshChats();
  }, [refreshChats]);
```

- [ ] **Step 9: Remove unused imports**

After all edits, ensure imports are tight. `useRef` may still be used (for `inputRef`, `convoRef`); keep what's used, remove what isn't.

Run: `npm run lint`
Expected: no warnings about unused vars/imports in `app/Chat.tsx`.

- [ ] **Step 10: Verify build**

Run: `npm run build`
Expected: build succeeds.

### Task 8: Create the `/conv/[id]` server component

**Files:**
- Create: `app/conv/[id]/page.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/conv/\[id\]
```

(The `[id]` segment must be a literal Next.js dynamic route folder name.)

- [ ] **Step 2: Write the server component**

Create `app/conv/[id]/page.tsx`:

```tsx
import "server-only";
import { notFound } from "next/navigation";
import Chat from "../../Chat";
import type { Message } from "../../components/MessageBubble";
import { getChat, listMessages } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ConvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const chat = await getChat(id);
  if (!chat) notFound();

  const rawMessages = await listMessages(id);
  const initialMessages: Message[] = rawMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));

  return <Chat initialChatId={id} initialMessages={initialMessages} />;
}
```

- [ ] **Step 3: Verify build and types**

Run: `npm run build`
Expected: build succeeds. The route `/conv/[id]` should appear in Next's build output.

### Task 9: Smoke test phase B

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify navigation flows**

Manually walk through:
1. Open `/` (after login). Expected: empty state (no active chat). Sidebar shows existing chats if any.
2. Send a message from `/`. Expected: message goes through; URL updates to `/conv/{id}` via `router.replace`; response streams in.
3. Click a different chat in the sidebar. Expected: URL becomes `/conv/{otherId}`; conv content loads (server-rendered, no flash).
4. Click "Nouvelle conversation" in the sidebar. Expected: URL goes back to `/`, page is empty.
5. Click an existing chat, then refresh the page. Expected: same conv loads from URL, no flash, sidebar still highlights the active one.
6. Visit `/conv/00000000-0000-0000-0000-000000000000` (an obviously-fake UUID). Expected: 404 page from `notFound()`.

- [ ] **Step 3: Stop dev server**

- [ ] **Step 4: Commit phase B**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: URL-driven /conv/[id] routing — URL is source of truth

- New server component app/conv/[id]/page.tsx fetches chat + messages
  server-side and passes them to <Chat> as props (no flash on reload).
- Chat.tsx now accepts initialChatId / initialMessages props.
  localStorage chatId hydration is gone — URL drives state.
- Sidebar select pushes /conv/[id], new chat pushes /, first message
  of a new chat router.replace("/conv/[newId]").
- Delete: if active chat deleted, navigate to /.
- 404 on /conv/[id] when chat doesn't exist (via notFound()).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase C — Seeded conversation mechanism

### Task 10: Create `lib/seeded-convs.ts`

**Files:**
- Create: `lib/seeded-convs.ts`

- [ ] **Step 1: Create the file with the welcome conv constants**

Write `lib/seeded-convs.ts`:

```ts
/**
 * Seeded conversations — predefined chats with a known UUID and a
 * pre-authored opening assistant message. Created/reset via
 * `npm run seed-welcome`.
 *
 * The opening message is rendered as a regular DB-stored assistant
 * message; the client-side typewriter animation is gated by the
 * conversation having exactly one assistant message and zero user
 * replies, not by the chat ID.
 */

export const WELCOME_CONV = {
  id: "7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b",
  title: "Getting the ball rolling",
  // Phase 1 placeholder — final wording is co-authored in phase 2.
  openingMessage: `**[Placeholder phase 1 — message d'accueil à rédiger]**

Bienvenue. Cet espace est nouveau pour toi. Je n'ai pas encore décidé exactement quoi te dire à l'arrivée — on y travaille avec Adrien.

En attendant, parle-moi de ce qui te préoccupe en ce moment dans ta préparation, et on regarde ensemble.`,
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

### Task 11: Create the seed script

**Files:**
- Create: `scripts/seed-welcome-conv.ts`

This script follows the pattern in `scripts/clean-chats.ts` (raw SQL via `@vercel/postgres`).

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-welcome-conv.ts`:

```ts
/**
 * Seeds (or resets) the welcome conversation in Postgres.
 *
 * Idempotent: running this multiple times always lands on the same
 * fresh state — chat row exists with the predefined ID, and the only
 * message is the opening assistant message. Used both for initial
 * seeding and for "wiping" after PO test runs.
 *
 * Run: `npm run seed-welcome`
 *
 * Env vars required:
 *   POSTGRES_URL  auto-injected by Vercel Postgres
 *   DEFAULT_USER_ID  optional, defaults to "chloe"
 *   BASE_URL  optional, used to print absolute URL after seeding
 */

import { sql } from "@vercel/postgres";
import { WELCOME_CONV } from "../lib/seeded-convs.ts";

function fail(msg: string): never {
  console.error(`[seed-welcome] ${msg}`);
  process.exit(1);
}

async function main() {
  if (!process.env.POSTGRES_URL) {
    fail("POSTGRES_URL is not set (run `vercel env pull .env.local`)");
  }

  const userId = process.env.DEFAULT_USER_ID ?? "chloe";
  const { id, title, openingMessage } = WELCOME_CONV;

  // Upsert the chat row. If the row already exists, refresh title and
  // updated_at; otherwise insert it.
  await sql`
    INSERT INTO chats (id, user_id, title, updated_at)
    VALUES (${id}, ${userId}, ${title}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      updated_at = NOW()
  `;

  // Wipe any messages that may have been added during testing.
  const wiped = await sql`DELETE FROM messages WHERE chat_id = ${id}`;

  // Insert the opening assistant message.
  await sql`
    INSERT INTO messages (chat_id, role, content)
    VALUES (${id}, 'assistant', ${openingMessage})
  `;

  console.log(`[seed-welcome] ✓ welcome conv seeded`);
  console.log(`[seed-welcome]   wiped ${wiped.rowCount ?? 0} prior message(s)`);
  console.log(`[seed-welcome]   → /conv/${id}`);
  if (process.env.BASE_URL) {
    console.log(`[seed-welcome]   → ${process.env.BASE_URL}/conv/${id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script to `package.json`**

Open `package.json` and locate the `scripts` section:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "sync-prep": "node --env-file=.env.local --experimental-strip-types scripts/sync-prep.ts",
    "clean-chats": "node --env-file=.env.local --experimental-strip-types scripts/clean-chats.ts"
  },
```

Add a new line after `clean-chats`:

```json
    "seed-welcome": "node --env-file=.env.local --experimental-strip-types scripts/seed-welcome-conv.ts"
```

The final `scripts` block becomes:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "sync-prep": "node --env-file=.env.local --experimental-strip-types scripts/sync-prep.ts",
    "clean-chats": "node --env-file=.env.local --experimental-strip-types scripts/clean-chats.ts",
    "seed-welcome": "node --env-file=.env.local --experimental-strip-types scripts/seed-welcome-conv.ts"
  },
```

(Mind the comma after `clean-chats`'s value.)

- [ ] **Step 3: Run the seed script**

```bash
npm run seed-welcome
```

Expected output:

```
[seed-welcome] ✓ welcome conv seeded
[seed-welcome]   wiped 0 prior message(s)
[seed-welcome]   → /conv/7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b
```

- [ ] **Step 4: Verify the conv appears in the UI**

Run: `npm run dev`. Open `/`. Expected: sidebar now lists "Getting the ball rolling" at the top. Click it. Expected: navigates to `/conv/7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b`, opening message renders (statically for now — animation comes in Task 12). Stop dev server.

- [ ] **Step 5: Re-run seed to verify idempotency**

After typing a reply in the dev server (which adds a user message to the conv), run:

```bash
npm run seed-welcome
```

Expected: `wiped 1 prior message(s)`. Re-open the conv in dev — only the opening message should remain.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: seeded welcome conversation + idempotent seed script

- lib/seeded-convs.ts holds the welcome conv constants (UUID, title,
  opening message). Phase 1 message is a placeholder — phase 2 will
  co-author the final text.
- scripts/seed-welcome-conv.ts upserts the chat row and resets its
  messages to the opening one. Same script seeds initially and "wipes"
  after PO testing — workflow: test → re-seed → ship URL to user.
- New npm run seed-welcome.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase D — Typewriter animation

### Task 12: Build `<TypewriterMessage>` component

**Files:**
- Create: `app/components/TypewriterMessage.tsx`

This component animates a fixed assistant message char-by-char. To keep markdown rendering simple, it renders a plain-text growing slice during the animation, then swaps to the full markdown render once complete.

- [ ] **Step 1: Create the component**

Write `app/components/TypewriterMessage.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

### Task 13: Wire `<TypewriterMessage>` into `Chat.tsx`

**Files:**
- Modify: `app/Chat.tsx`

The animation triggers when the conv has exactly one message (assistant role) and no user reply yet. The condition is computed at render time, not stored — so it auto-resolves once Chloë's first message lands.

- [ ] **Step 1: Add the import**

At the top of `app/Chat.tsx`, alongside the other component imports, add:

```tsx
import { TypewriterMessage } from "./components/TypewriterMessage";
```

- [ ] **Step 2: Compute the "should animate first message" flag**

Inside the `Chat` component body, before the return, add:

```ts
  const shouldAnimateFirst =
    messages.length === 1 &&
    messages[0].role === "assistant" &&
    !isStreaming;
```

The `!isStreaming` guard prevents animation while a real LLM streaming is happening (it shouldn't happen with `length === 1` from server hydration, but it's a cheap safety).

- [ ] **Step 3: Branch the message render**

Find the existing message render block:

```tsx
              messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                const isWaitingChunk =
                  isStreaming &&
                  isLast &&
                  m.role === "assistant" &&
                  m.content === "";
                if (isWaitingChunk) {
                  return <ThinkingIndicator key={i} />;
                }
                return (
                  <MessageBubble
                    key={i}
                    message={m}
                    isStreaming={isStreaming && isLast && m.role === "assistant"}
                  />
                );
              })
```

Replace with:

```tsx
              messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                const isWaitingChunk =
                  isStreaming &&
                  isLast &&
                  m.role === "assistant" &&
                  m.content === "";
                if (isWaitingChunk) {
                  return <ThinkingIndicator key={i} />;
                }
                if (i === 0 && shouldAnimateFirst) {
                  return <TypewriterMessage key={i} content={m.content} />;
                }
                return (
                  <MessageBubble
                    key={i}
                    message={m}
                    isStreaming={isStreaming && isLast && m.role === "assistant"}
                  />
                );
              })
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds.

### Task 14: Smoke test phase D

- [ ] **Step 1: Reset the welcome conv**

```bash
npm run seed-welcome
```

- [ ] **Step 2: Run dev server**

Run: `npm run dev`

- [ ] **Step 3: Verify the animation**

Open `/conv/7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b` (the welcome URL printed by the seed script).

Expected:
- The opening message types in char-by-char with a blinking cursor.
- After full reveal (a few seconds), the cursor disappears and the message renders as styled markdown (the placeholder's `**bold**` becomes bold, etc.).
- The input below remains usable during the animation.

- [ ] **Step 4: Verify animation stops once she replies**

Type any reply (e.g., "ok"). Send.

Expected:
- Reply goes through. Streaming response from the model arrives below.
- Refresh the page. Welcome message now renders statically as a normal historic assistant message — **no animation rerun**.

- [ ] **Step 5: Verify reload-before-reply re-animates**

Run `npm run seed-welcome` again to wipe Adrien's test reply. Refresh the conv page.

Expected: the opening message animates again (because `messages.length === 1`).

- [ ] **Step 6: Verify other chats are unaffected**

Click "Nouvelle conversation". Type a message. Get a streaming response. Reload that chat at `/conv/{id}`.

Expected: no animation. The first message is a user message, so the gating condition fails. Normal chat behavior.

- [ ] **Step 7: Stop dev server**

- [ ] **Step 8: Tune speed if needed**

If 28 ms/char feels off, edit `CHAR_INTERVAL_MS` in `app/components/TypewriterMessage.tsx`. Common range: 20–40 ms. Re-run dev to feel.

- [ ] **Step 9: Commit phase D**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: typewriter animation on first opening of seeded welcome conv

New TypewriterMessage component animates a fixed assistant message
char-by-char, then swaps to the full markdown render. Gated in Chat.tsx
by messages.length === 1 && role === "assistant" — purely emergent from
DB state, no IDs hardcoded, no localStorage flag.

Re-streams on reload until Chloë's first reply lands, then permanently
becomes a normal historic message.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase E — Final verification & ship

### Task 15: End-to-end walkthrough

- [ ] **Step 1: Reset welcome conv to clean state**

```bash
npm run seed-welcome
```

- [ ] **Step 2: Run dev server and walk through the full flow**

Run: `npm run dev`. Then:

1. Log in at `/login` with the passcode.
2. Land on `/`. Verify: empty state, no active chat, sidebar shows "Getting the ball rolling" at the top.
3. Open the welcome URL `/conv/7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b` directly. Verify: animation plays.
4. Reply with a short message. Verify: assistant streams a response.
5. Click "Nouvelle conversation". Verify: URL = `/`, empty state.
6. Send a message from `/`. Verify: response streams; URL becomes `/conv/{newId}` after first chunk.
7. Click the welcome conv in the sidebar. Verify: URL changes; conv loads with opening + Adrien's reply (no animation, since `messages.length > 1`).
8. Hover the welcome chat in the sidebar → rename to "Welcome" → verify rename persists.
9. Hover → delete. Verify chat is gone, navigated back to `/`.
10. Re-run `npm run seed-welcome` → verify the conv re-appears at the predictable URL.

- [ ] **Step 3: Verify auth deep-link**

Log out (`/api/logout`). Visit `/conv/7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b` directly. Expected: redirect to `/login?next=%2Fconv%2F7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b`. Log in. Expected: lands directly on the welcome conv with animation.

- [ ] **Step 4: Verify 404 on unknown conv**

Visit `/conv/00000000-0000-0000-0000-000000000000`. Expected: Next.js 404 page.

- [ ] **Step 5: Stop dev server**

### Task 16: Update context files & ship

- [ ] **Step 1: Add a journal entry**

Edit `context/journal.md`. Prepend (below the title and the reverse-chronological comment) a new section:

```markdown
## 2026-04-30 — Refacto routing /conv/[id] + seeded welcome conv (Adrien B.)

**Goal**: remplacer le bootstrap (Chloë l'a déjà fait, page de découverte vue) par une 2ᵉ entrée recadrée. Préparer un lien direct partageable type `/conv/[id]` et seeder une conversation d'accueil avec un message qui s'anime à l'arrivée.

### Phase 1 — archi (livrée)

- **Cleanup bootstrap** : suppression de `/bootstrap`, `BootstrapView.tsx`, `KickoffProgress.tsx`, des markers `[OPEN]` / `[FIRST]` dans le route handler et l'history filter, du `fireWelcomeKickoff` + `?welcome=1` dans `Chat.tsx`. `00-identity.md` réduit à l'identité durable. Dans `10-posture.md`, retrait de la mention `[FIRST]`-anchored "pas ChatGPT".
- **Routing URL-driven** : `app/conv/[id]/page.tsx` (server component) fetch chat + messages serveur-side, passe en props à `<Chat>`. `Chat.tsx` accepte `initialChatId` / `initialMessages`, plus de `localStorage.chatId`, navigation via `router.push` (sidebar select, new chat) et `router.replace` (1er message d'une conv neuve). 404 sur conv inconnue via `notFound()`.
- **Seeded conv** : `lib/seeded-convs.ts` (UUID hardcodé + titre + message placeholder). Script `scripts/seed-welcome-conv.ts` idempotent, lancé via `npm run seed-welcome` — sert pour le seed initial et le reset après tests.
- **Animation typewriter** : `<TypewriterMessage>` (28 ms/char), gating client-side `messages.length === 1 && role === "assistant"`. Pure UI, pas de flag DB ou localStorage. Re-stream tant qu'elle n'a pas répondu, statique ensuite.

### Phase 2 (à faire séparément)

- **Co-rédaction du message d'accueil** : remplacer le placeholder dans `lib/seeded-convs.ts` par un texte calibré sur le brief `brief_message_accueil_chloe_compagnon_de_preparation.md`.
- **Rework system prompt** : intégrer la posture compagnon / espace de rebond / ne fait pas le travail à sa place dans `10-posture.md` au-delà du strict cleanup bootstrap.
- **Seed prod** : `npm run seed-welcome` sur prod via Vercel (ou via Postgres direct), envoi du lien à Chloë.

### Open questions

**For PO** :
- **Texte d'ouverture** : à co-rédiger phase 2. Le brief est riche — on commence par un draft court ?
- **Rework prompt** : ampleur du diff dans `10-posture.md` à valider une fois qu'on a le ton du message d'accueil calé.
```

- [ ] **Step 2: Update `context/backlog.md` if needed**

Open `context/backlog.md`. If the bootstrap cleanup or `/conv/[id]` routing was listed in **Now** or **Next**, mark them done. If a phase 2 entry doesn't exist yet, add under **Now**:

```markdown
- [ ] **Phase 2 welcome message** : co-rédaction du texte d'accueil dans `lib/seeded-convs.ts`, rework de `10-posture.md` selon le brief compagnon, re-seed prod, envoi à Chloë.
```

(If you can't easily find a matching slot, just append a new "Now" item — manual review can re-organize.)

- [ ] **Step 3: Commit context updates**

```bash
git add context/journal.md context/backlog.md
git commit -m "$(cat <<'EOF'
chore: journal + backlog — phase 1 closed, phase 2 queued

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

Expected: push succeeds. Vercel auto-deploys.

- [ ] **Step 5: After deploy, seed the prod welcome conv**

Wait for Vercel deploy to finish (check dashboard or `vercel inspect`). Then run the seed script against prod. Two options:

**Option A** — Adrien runs locally with prod credentials:

```bash
vercel env pull .env.local  # ensure POSTGRES_URL is prod
npm run seed-welcome
```

**Option B** — Adrien adds a one-shot Vercel CLI exec or a temporary admin endpoint. (Out of scope for this plan; option A is the default.)

Expected output prints the URL to share with Chloë:
`→ https://klowi.dooloob.com/conv/7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b`

(only if `BASE_URL` env var is set; otherwise the relative path is fine.)

- [ ] **Step 6: Smoke test prod**

Open the URL printed in step 5 (in an incognito window for a clean cookie state). Log in. Verify the animation plays once.

**At this point phase 1 is shipped.** Phase 2 (real message + prompt rework) happens in a separate session.

---

## Self-Review

After completing all tasks above, verify:

1. **Spec coverage** — every requirement in `docs/superpowers/specs/2026-04-30-conv-link-welcome-design.md`:
   - § 1 Cleanup bootstrap → Tasks 1–5 ✓
   - § 2 Refacto routage `/conv/[id]` → Tasks 7–8 ✓
   - § 3 Mécanisme seeded conv → Tasks 10–11 ✓
   - § 4 Animation message d'ouverture → Tasks 12–13 ✓
   - § 5 Phase 2 (out of scope) → not implemented (correct) ✓

2. **No placeholders** — every code block contains the actual code; every command has expected output; no "TBD" / "TODO" / "fill in details".

3. **Type/identifier consistency** — names used consistently across tasks:
   - `WELCOME_CONV` (in `lib/seeded-convs.ts`, used by seed script)
   - `WELCOME_CONV.id` is `7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b` everywhere
   - `initialChatId` / `initialMessages` props on `<Chat>` consistent in Tasks 7 & 8
   - `TypewriterMessage` component signature `{ content: string }` consistent in Tasks 12 & 13
