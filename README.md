# klowi-mcf-assistant

Single-tenant AI coach to support **Chloë Cottrell**'s preparation for university lecturer (MCF) auditions in British studies (Grenoble + Strasbourg, May 2026).

Web app: text chat, persistent conversations, system prompt assembled server-side from a coach briefing plus private prep material.

> **Stage**: MVP. See [`context/vision.md`](./context/vision.md).

---

## Stack

Next.js 16 (App Router, TypeScript) · React 19 · Tailwind v4 · Anthropic SDK (Claude Sonnet 4.6) · Vercel Postgres + Drizzle ORM · deployed on Vercel.

Full breakdown: [`context/tech-stack.md`](./context/tech-stack.md).

---

## Setup

```bash
# 1. Install
npm install

# 2. Pull env from Vercel
npx vercel link        # one-time, links the local repo to the Vercel project
npx vercel env pull .env.local
# Then add the local-only var:
echo 'MCF_PREP_DIR="/absolute/path/to/_prep"' >> .env.local

# 3. (First time only) Apply DB schema
npx drizzle-kit push

# 4. Sync the private prep corpus to Vercel Blob (so prod can fetch it)
npm run sync-prep

# 5. Run
npm run dev   # http://localhost:3000 (or 3001 if 3000 is taken)
# → /login, enter APP_PASSCODE
```

When you edit prep content in Drive, re-run `npm run sync-prep` to push to Blob.
Local dev reads from `MCF_PREP_DIR` directly (no sync needed for local), but prod always reads from Blob.

---

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run sync-prep` | Upload `MCF_PREP_DIR/**.md` to Vercel Blob (`_prep/<relPath>`) |

---

## Project layout

```
app/                 Next.js App Router (routes, layouts, API handlers)
  api/chat/          Streaming chat endpoint + history
  api/login,logout/  Auth endpoints
  login/             Passcode page
  Chat.tsx           Client component (chat UI)
lib/                 Server-side libs
  anthropic.ts       SDK client
  auth.ts            Edge-compatible HMAC cookie sign/verify
  db/                Drizzle schema + queries
  system-prompt.ts   Assembly (fs or Blob)
  utils.ts
middleware.ts        Edge middleware: gates all routes via signed cookie
scripts/
  sync-prep.ts       Uploads private corpus to Vercel Blob
context/             Project state (vision, journal, decisions, backlog, prompts)
  prompt/            System prompt fragments (committed, public-grade)
  references/        Original briefings (CONTEXT-COACH.md)
mcf/                 SYMLINK → private prep material (Google Drive, gitignored)
public/              Static assets
```

---

## Privacy

- `mcf/` is a symlink to a Google Drive folder containing private prep material (drafts, COS analysis, intimate notes). It is **never** committed, **never** pushed, **never** bundled client-side.
- The system prompt assembly happens **server-side only** (`lib/system-prompt.ts`). The browser never sees raw prep content.
- Even though the GitHub repo is private, intimate/strategic content stays in `mcf/_prep/`. See `context/prompt/README.md` for the public-vs-private split rule.

---

## Working on this project

The project follows a lightweight context-file convention (the *Nexus*) shared with other Cowork projects. AI assistants (Claude Code in particular) read `CLAUDE.md` and the `context/*.md` files to stay aligned with vision, decisions, and current backlog.

For day-to-day workflow with AI pair programming, see [`DEVS.md`](./DEVS.md).

---

## Maintainer

Adrien B. (PO + solo developer · `ab@ubyx.com`)
