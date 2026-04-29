# Decisions – klowi-mcf-assistant

## 2026-04-29 – Private prep corpus path injected via env var (`MCF_PREP_DIR`)

**Context**: Phase 2 build broke when Turbopack walked `path.join(process.cwd(), "mcf", "AUDITIONS (!!)", "_prep")` as a literal directory reference and crossed the Google Drive symlink boundary, panicking on what it perceived as an out-of-root symlink.

**Decision**: The private prep directory path is read from `process.env.MCF_PREP_DIR` at runtime — no literal path string of the private corpus appears in source. The committed `context/prompt/` directory keeps a normal `path.join(process.cwd(), …)`; only the symlinked external corpus is env-resolved.

**Rejected alternatives**:
- Patch `next.config.ts` with `outputFileTracingExcludes` — too fragile, doesn't reliably stop Turbopack's `DirAssetReference` static analysis.
- Move `mcf/` symlink target onto the local filesystem (out of Drive) — defeats Drive sync, which is how the PO and contributors keep prep material in sync across machines.
- Use dynamic-import or `eval()` tricks to hide the path string — fragile and obscure.

**Consequences**:
- Local dev sets `MCF_PREP_DIR` in `.env.local` to the Drive-symlinked absolute path.
- Vercel deploy will need a `prebuild` script (Phase 3) that copies `_prep/**.md` into a build-side directory (e.g. `./prep-build/`) and sets `MCF_PREP_DIR=/var/task/prep-build` (or equivalent) in the Vercel project env.
- Empty `MCF_PREP_DIR` is a valid state — assembly silently uses only the public corpus. Useful for previews/PR builds where private content shouldn't leak.

***

## 2026-04-29 – Persistence: Vercel Postgres + Drizzle ORM

**Context**: Need a chat/messages store accessible from Vercel-deployed route handlers. Single user, low write volume, schema trivial.

**Decision**: Vercel Postgres (Neon under the hood) accessed via `@vercel/postgres`, ORM = Drizzle (`drizzle-orm/vercel-postgres`). Migrations via `drizzle-kit`.

**Rejected alternatives**:
- Supabase — overkill (we don't need its auth/storage/realtime).
- Turso (libSQL) — solid for edge, but we have no edge requirement.
- SQLite + Prisma — Vercel's filesystem is ephemeral, would need an external SQLite host (Turso again).

**Consequences**: One env var (`POSTGRES_URL`) to pull via `vercel env pull`. Schema lives in `lib/db/schema.ts`. Drizzle is lighter and serverless-friendlier than Prisma.

***

## 2026-04-29 – Auth v1: Vercel Password Protection

**Context**: Single primary user (Chloë), single secondary user (Adrien). Need to gate the deployed app, not build a real auth system.

**Decision**: Vercel Password Protection at the project level. No code, single shared password.

**Rejected alternatives**:
- Magic link (Resend + Auth.js) — proper UX but overkill for 1 user.
- Obscure URL + IP allowlist — fragile (Chloë changes networks) and opaque.

**Consequences**: User identity is hardcoded (`DEFAULT_USER_ID=chloe` in env). When/if multi-user is needed, switch to Auth.js — schema is already user-scoped via `chats.userId`.

***

## 2026-04-29 – System prompt assembly: static concat + prompt caching

**Context**: Need to inject a substantial coach corpus (briefing + audition formats + COS + prep notes). Three options on the table.

**Decision**: Concatenate the full corpus into the `system` parameter, leverage Anthropic prompt caching (5-min TTL) so the cost amortizes across consecutive turns.

**Rejected alternatives**:
- RAG (embed `_prep`, retrieve top-k) — smaller per-call payload, but adds an embedding pipeline, retrieval-quality risk, and tuning effort. Time we don't have (auditions in ~13 days).
- Hybrid (CONTEXT-COACH always-on + `_prep` per-mode) — best of both, but added complexity for unclear v1 benefit.

**Consequences**: Prompt size is large but caching makes this cheap. Re-rolling on a prompt change blows the cache once, then re-warms. We must keep the corpus stable during a session (no per-turn modifications) for the cache to bite.

***

## 2026-04-29 – Source-of-truth split: committed scaffold + private runtime

**Context**: System prompt content has two natures: behavioral/factual (good to version, share) vs. strategic/intimate (must stay private even with a private repo).

**Decision**: 
- `context/prompt/*.md` — committed in Git. Coach behavior, factual audition formats, public-grade CV, factual COS membership.
- `mcf/AUDITIONS (!!)/_prep/**.md` — symlinked from Google Drive, gitignored, runtime-only. Strategy, competitor analysis, drafts, intimate notes.

**Decision rule**: *« Si Chloë le mettrait sur LinkedIn ou son site perso → commit. Si elle le dirait en off → `_prep/`. »*

**Rejected alternatives**:
- Everything committed — repo is private *today*, but a future leak/fork/visibility flip would expose strategic material that has no business being on GitHub.
- Everything in `_prep/` — would prevent the project from being forkable / shareable as a template, contradicts `vision.md`.

**Consequences**: `lib/system-prompt.ts` reads both directories at runtime. On Vercel, the private corpus must reach the build artifacts (build-time copy via `prebuild` script — to wire in Phase 2/3).

***

## 2026-04-29 – API Anthropic directe (not Bedrock) for v1

**Context**: AWS credentials are available locally — Bedrock was floated as an alternative.

**Decision**: Use the Anthropic API directly (`@anthropic-ai/sdk`) for v1.

**Rejected alternatives**: AWS Bedrock — primary blocker is the **`web_search` hosted tool**, which is exposed only on the Anthropic API and not on Bedrock. We'd need to wire a custom search tool (SerpAPI/Brave + handler) — 2-3 days we don't have.

**Consequences**: Single env var (`ANTHROPIC_API_KEY`) instead of AWS creds + region + Bedrock model id. Migration to Bedrock later is feasible (SDK has `AnthropicBedrock`) — only the web_search tool would need a swap. Revisit if AWS billing consolidation, data residency, or VPC requirements emerge.

***

## 2026-04-29 – Bootstrap meta-session for assistant naming + onboarding

**Context**: The assistant is single-tenant ("Chloë's coach"), not generic. Hardcoding a name picked by Adrien would feel imposed.

**Decision**: First-run flow — `00-identity.md` instructs the assistant to introduce herself, propose 4-5 candidate names with explanations, let Chloë pick (or suggest her own), then run a 3-4-question mini-onboarding (most-stressful audition / anticipated modes / topics to avoid / feedback format). The chosen name + onboarding summary are then committed back into `00-identity.md`.

**Rejected alternatives**:
- Hardcode a name (e.g., "Iris") — loses the buy-in moment.
- DB-backed name — overkill; the name should be visible in Git history alongside the prompt evolution.

**Consequences**: One-time bootstrap step before deploy is "live for prep". Mechanism is purely a file edit + redeploy — no runtime persistence needed for identity.

***

## 2026-04-29 – Markdown everywhere for prompt content (no JSON, no DB)

**Context**: Question raised whether prompt context should be MD, JSON, or DB-backed.

**Decision**: All prompt fragments are Markdown files. Git versions the static; Postgres versions the dynamic (chats/messages).

**Rejected alternatives**:
- JSON for structured pieces (COS members, audition formats) — adds serialization layer for zero retrieval/query benefit.
- DB-backed prompt — wrong tool; we never query/mutate prompt content from the running app.

**Consequences**: Editable by hand, readable diffs, no parsing layer. Structured sub-blocks live as MD tables or YAML frontmatter when needed.

***

## 2026-04-29 – Stack: Next.js (App Router, TypeScript) + Anthropic SDK

**Context**: Need a deployed text chat assistant with streaming and persistence. Single-tenant, single primary user, solo dev.

**Decision**: Next.js App Router in TypeScript, Anthropic SDK (`@anthropic-ai/sdk`) for the model layer, deployment target Vercel.

**Rejected alternatives**:
- Streamlit (Python) — faster to ship but weaker UI control and ecosystem fit for a long-lived deployed product.
- CLI / terminal — friction for a non-dev primary user.
- Wrappers (Chainlit, Open WebUI, LibreChat) — opaque to customize for the coach's specific modes.

**Consequences**: TypeScript everywhere; Vercel as default host; Anthropic API key handled server-side; prompt caching available via the SDK.

***

## 2026-04-29 – Stage: MVP

**Context**: Cycle is short and the deliverable must be usable for live audition prep. Foundation phase would over-invest in architecture; Exploration would under-invest in shippability.

**Decision**: Project stage is MVP. Default expectations: ship over polish, tests for non-trivial logic only, document decisions but don't gold-plate.

**Rejected alternatives**: Foundation (too heavy upfront), Exploration (too thin for a deployed product).

**Consequences**: Reviewers should not block on test coverage or architectural perfection during this phase. Any push toward Growth-stage rigor (broad tests, full CI matrix, observability stack) should be flagged in the journal and re-decided when the MVP is in service.

***

## 2026-04-29 – Voice (TTS/STT) out of scope for v1

**Context**: The auditions are oral exercises, so a voice mode is conceptually appealing. It would, however, multiply the integration surface (audio capture, streaming TTS, latency tuning) at a moment when the text product itself is not yet built.

**Decision**: Text only for v1. Voice is parked as a post-v1 candidate.

**Rejected alternatives**: Voice in scope from day one (rejected on cost/scope), voice as a feature flag (rejected to keep the codebase minimal).

**Consequences**: No audio dependencies, no realtime API integration. The coach behavior must work well in a pure text context (which is fine — the candidate will rehearse aloud while reading prompts/feedback on screen).

***
