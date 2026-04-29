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

# 2. Env
cp .env.local.example .env.local
# Fill in ANTHROPIC_API_KEY (and POSTGRES_URL once Vercel Postgres is provisioned)

# 3. Run
npm run dev   # http://localhost:3000
```

### Connecting to Vercel Postgres (later, when wired)

```bash
npx vercel link
npx vercel env pull .env.local
npx drizzle-kit push   # apply schema to the DB
```

---

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |

---

## Project layout

```
app/                 Next.js App Router (routes, layouts, API handlers)
lib/                 Server-side libs (Anthropic client, Drizzle, prompt assembly)
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
