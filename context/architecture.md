# Architecture – klowi-mcf-assistant

> **Status**: Draft. Open architectural questions live in `journal.md`. Decisions get promoted to `decisions.md` once made.

## High-level shape

```
[Browser] ─── HTTPS ───> [Next.js on Vercel]
                              │
                              ├── App Router pages — chat UI, conversation list
                              │
                              ├── API route /api/chat — streaming
                              │       │
                              │       ├── Server-side system prompt assembly
                              │       │     (CONTEXT-COACH.md + selected _prep/*.md)
                              │       │
                              │       ├── Anthropic SDK call (streaming + prompt caching)
                              │       │
                              │       └── Persistence (chats / messages)
                              │             │
                              │             └── DB — TBD (Postgres / Supabase / Turso / SQLite)
                              │
                              └── Auth — TBD (see Open Questions)
```

## Components to design

### 1. System prompt

**Status**: To design. `context/references/CONTEXT-COACH.md` is a **starting point**, not the final prompt.

Decisions to make:
- **Assembly strategy**: static concat (simple, large prompt, leverages Anthropic prompt caching) vs. RAG (smaller per-call payload, retrieval quality risk, more code) vs. hybrid (per-mode loading).
- **Source layout**: committed markdown in the repo (versioned, public on GitHub) vs. read from the private `mcf/` symlink at runtime (kept private) vs. hybrid (committed prompt structure + private content references).
- **Versioning**: how to roll back if a prompt change degrades behavior. Likely: keep prompt fragments in markdown, commit changes, rely on git history.
- **Mode handling**: do we wire mode switches as system-prompt sections (always-on) or as per-call instructions (cheaper, but less reliable)?

Anthropic prompt caching is highly relevant if we go static-concat and the prompt is long (which it likely is, given the prep corpus).

### 2. Chat endpoint

- Streaming response via `@anthropic-ai/sdk` (`messages.stream`).
- Server-side; the client never sees the API key.
- Message history loaded from the DB and passed in the `messages` parameter.
- Token / cost telemetry logged server-side (light, no observability stack at this stage).

### 3. Persistence

**Status**: DB needed. Granularity of chats/sessions to confirm.

Minimal viable schema:
- `users` — single user for now, but schema-ready for later.
- `chats` — `id`, `user_id`, `title`, `created_at`, `updated_at`.
- `messages` — `id`, `chat_id`, `role`, `content`, `created_at`.

Open: do we model "modes" (Socratic / quiz / briefing / review) as a column on `chats` or as runtime-only metadata?

### 4. UI

- Conversation list sidebar, message stream, input box.
- Markdown rendering for the coach's responses.
- Mode hints surfaced — UI affordance (mode picker) vs. natural language only is itself a decision worth making once we have the system prompt drafted.

### 5. Auth

**Status**: Open Question — see `journal.md`.

Whatever the choice, the constraint is: only the candidate (and the PO) should be able to reach the deployed app.

### 6. Secrets / env

- `ANTHROPIC_API_KEY` (server only).
- DB connection string (when DB is chosen).
- Auth secrets (when strategy is chosen).

`.env.local.example` lists the variables; never commit `.env.local`.

## Out of scope (v1)

- Voice (TTS / STT).
- Multi-user.
- Fine-grained analytics / progression dashboards.
- File upload from the user's side (the prep material is injected via the system prompt, not uploaded by Chloë).
- Realtime collaboration (PO and candidate viewing the same conversation live).
