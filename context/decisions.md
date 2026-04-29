# Decisions – klowi-mcf-assistant

## 2026-04-29 – Companion framing: pas un coach, pas ChatGPT, pas une IA générique

**Context**: PO brief pivots away from « coach » framing — the user is wary of AI, doesn't want a tutor, doesn't want assistant clichés. The companion needs to land as something specifically calibrated for Chloë rather than as another chatbot.

**Decision**: 
- Persona is **companion / pote** — horizontale, sober, warm-but-not-overplayed.
- Explicit anti-AI-cliché register: no « absolument ! », « ravie de t'accompagner », « excellente question ! ». No defensive disclaimers (« en tant qu'IA »…).
- One sober mention at `[FIRST]` — « pas un chatbot, pas ChatGPT, calibrée pour cette mission » — never repeated.
- Credibility through **demonstrated knowledge** (CVs, dossiers, audition specifics) rather than through self-justification.
- Tutoiement par défaut (matches the pote register).
- English as aparté (Brit-in-France bonding, untranslatable expression) — never the default mode, but accepted.

**Rejected alternatives**:
- Coach framing (PO's original) — felt too vertical, too clichéd.
- Cute / playful avatar — would have read as another generic AI persona.
- Hardcoded name — left to Chloë in bootstrap so the relationship is hers.

**Consequences**: every response shape rule traces back to this — short by default, no menu, no inventory, propose to dig before tartining.

***

## 2026-04-29 – Bootstrap = ephemeral conversation at `/bootstrap`

**Context**: Chloë lands cold (PO sends her the link, no prior context). She doesn't know what this is. The first interaction needs to be a brief cadrage (name, light prefs) before the « real » sessions, but it shouldn't pollute her sidebar afterwards.

**Decision**:
- Dedicated `/bootstrap` slug. PO sends Chloë `klowi.dooloob.com/bootstrap`.
- Bootstrap kickoff fires automatically via marker `[OPEN]` (companion greets first, no need for Chloë to type).
- On `/start`, the bootstrap conversation is **DELETED** (cascade messages via FK). It's ephemeral by design — its purpose was the relationship, not the content.
- localStorage flag `klowi.bootstrap.done` set ; subsequent visits to `/bootstrap` show « C'est fait » + link to `/`.
- Redirect to `/?welcome=1` after deletion ; main UI fires a `[FIRST]` marker that creates the first « real » chat, pre-named **« Warm up »**.

**Rejected alternatives**:
- Single `/` route branching on localStorage (initial implementation) — too coupled, hard to share a clean URL with Chloë, and the bootstrap chat lingered in the sidebar with cryptic « [OPEN] » titles.
- Saving the bootstrap as a labelled « Bootstrap » chat — felt cluttered for a meta-session of no real content value.

**Consequences**:
- Chat title auto-derive (`setTitleIfDefault`) skips kickoff markers — covers fresh chats AND post-welcome chats whose first user message was `[FIRST]`.
- Markers `[OPEN]` and `[FIRST]` are filtered server-side from `/api/chat/history` responses but preserved in DB for the API user/assistant alternation invariant.
- Future cross-session memory work will not see bootstrap content (it's gone) — name + prefs Chloë chose during bootstrap are not auto-persisted to a future « identity » file. PO can manually update `00-identity.md` after observing the first interactions if useful.

***

## 2026-04-29 – Brand mark : `CC · MCF · PREP COMPANION` (system label, not brand statement)

**Context**: Initial brand was `Klowi MCF` rendered as italic-serif hero. Two issues: (a) « Klowi » is actually Chloë's own phonetic nickname, not the companion's name — using it as a header risked confusion ; (b) the hero treatment felt too marketing-heavy for an intimate one-user app.

**Decision**: Single-line mono uppercase tag `CC · MCF · PREP COMPANION` with letterspacing (0.18em → 0.24em across sizes), text-muted color. Reads as a system identifier rather than a brand. Same treatment across all surfaces (login, sidebar header, mobile crumb).

**Rejected alternatives**:
- Keeping the italic-serif wordmark — too hero, conflicting with the « it's just one person's space » feel.
- Adding a tagline like « your MCF prep » — read as a SaaS product.
- Hiding the wordmark entirely — needed something to indicate continuity across pages.

**Consequences**: Brand barely visible. The companion conversation carries the personality. Wordmark = pure identification.

***

## 2026-04-29 – Theming architecture : next-themes (palette) + custom hook (mode)

**Context**: 5 themes × {light, dark, auto} = 10 visual states. `next-themes` natively handles a single axis (one class on `<html>`). For two axes we needed a different shape.

**Decision**:
- `next-themes` manages the **palette** axis (5 themes as classes : `theme-seminaire`, `theme-sobre`, etc.).
- A custom hook in `ThemePicker.tsx` manages the **mode** axis (light / dark / auto) via `localStorage["klowi.mode"]` + a `.dark` class added/removed manually on `<html>`.
- CSS convention : `.theme-X { /* light tokens */ } .theme-X.dark { /* dark overrides */ }`. Two classes on `<html>` simultaneously.
- No-flash inline script in `<head>` injected via Next layout to set the right classes before React hydrates.

**Rejected alternatives**:
- 10 flat themes in `next-themes` — would have worked but explodes the picker UX (no clean way to separate « palette » from « mode »).
- Custom-everything provider, no `next-themes` — would have meant rolling our own SSR hydration which is the messy part. `next-themes` solves that.

**Consequences**: ThemePicker maintains both axes independently. Adding a 6th theme = adding a `.theme-X` rule + the picker swatch ; mode logic untouched.

***

## 2026-04-29 – /admin route with separate ADMIN_PASSCODE (two-tier auth)

**Context**: PO needs visibility on what feeds the system prompt (inventory + raw sections) without giving Chloë access to the same. Both share the deployed app.

**Decision**:
- `/admin` route gated by middleware (so Chloë can't reach it without `APP_PASSCODE`) + a SECOND passcode (`ADMIN_PASSCODE` env var, distinct cookie `klowi-admin` signed with the same `AUTH_SECRET`). Two-factor in spirit.
- No link from main UI — slug `/admin` is hidden, PO knows the URL.
- Two tabs : **Contexte** (inventory of sources with sizes / token estimates) + **Prompt** (sections collapsible, content in `<pre>`).
- Read-only for v1 — no editing of fragments yet.

**Rejected alternatives**:
- Single passcode shared with main app — Chloë could trivially guess `/admin` and see her own dossiers from a meta-perspective.
- Separate hosted dashboard (Retool, Tooljet) — overkill for a one-PO-one-user app.
- Dedicated subdomain (`admin.klowi.dooloob.com`) — overhead for no privacy gain.

**Consequences**: Two env vars to maintain (`APP_PASSCODE`, `ADMIN_PASSCODE`). Editing fragments still happens via Git + redeploy ; admin is observability only.

***

## 2026-04-29 – Corpus map : manifest + auto-extracted file titles

**Context**: ~140K tokens of corpus across 23+ files. Without orientation cues, the model has to infer what each file is from its content. Risk: the companion confuses 3 CV variants, the 2 DR per audition, etc.

**Decision**: Two complementary layers.
1. `context/prompt/15-corpus-map.md` — hand-written index that precedes every other document. Groups files by purpose (identity, profile, Grenoble strategic / tactical, Strasbourg strategic / tactical, transversal). Notes intentional duplication explicitly so the model treats them as complementary views.
2. `lib/system-prompt.ts` extracts the first H1/H2/H3 heading from each file (max 120 chars, markdown stripped) and embeds it in the section comment marker : `<!-- DR07 - GRENOBLE.md — Rapport d'expertise : Analyse stratégique… -->`. Zero maintenance — the title travels with the file.

**Rejected alternatives**:
- YAML frontmatter on every file — would require touching every external doc (DRs come from a separate Claude Deep Research tool, would be modified each regen).
- Pure manifest, no per-file labels — manifest can drift from reality if files are renamed.
- Pure auto-extraction, no manifest — model gets titles but no semantic grouping or duplication notes.

**Consequences**: ~+2 KB to the system prompt for the corpus map, plus a few hundred bytes for the extracted titles. Negligible cost given Sonnet 4.6's caching.

***

## 2026-04-29 – Private prep storage on Vercel: Blob (private store)

**Context**: The private corpus (`mcf/_prep/`) lives in a Drive-symlinked folder locally. Vercel deploys can't follow that symlink, and we want the strategic content out of Git permanently.

**Decision**: Store private prep content in **Vercel Blob** (private store, marketplace integration). Sync local → Blob via a one-shot script (`npm run sync-prep`); runtime fetches from Blob via signed `downloadUrl` (5-minute in-memory cache per server instance).

**Rejected alternatives**:
- Commit `_prep/` to the repo (private GitHub) — reverses the Phase-1 public/private split decision. Feasible but undoes deliberate hardening.
- Vercel Blob in **public** mode (default) — slightly simpler but URL = obscurity-as-security only. Private mode forces every read through an authenticated path.
- S3 / Cloudflare R2 — more flexible but adds a separate provider, more secrets, no integration with Vercel project linking.

**Consequences**:
- Local dev: prefer fs via `MCF_PREP_DIR` (faster iteration, no network).
- Prod: only `BLOB_READ_WRITE_TOKEN` set → fetch from Blob.
- Update workflow: PO edits Drive → runs `npm run sync-prep` → done. No git commit, no redeploy needed (5-min cache TTL).
- Private blobs require `downloadUrl` (signed, ephemeral) not `url` (public). Already wired in `lib/system-prompt.ts`.
- Cold starts pay one round-trip per blob — mitigated by parallel `Promise.all` and the 5-min cache.

***

## 2026-04-29 – Auth: custom passcode + HMAC-signed cookie (not Vercel Password Protection)

**Context**: Custom domain `klowi.dooloob.com` is wired (CNAME). Need to gate access for Chloë and Adrien only. Vercel Password Protection requires the Pro plan; the project has been in flux on plan tier and we wanted independence.

**Decision**: Custom auth — `middleware.ts` gates all routes except `/login`, `/api/login`, `/api/logout`, and static assets. A signed cookie (HMAC-SHA256 via Web Crypto, edge-compatible) carries the session. `APP_PASSCODE` is the shared passcode, `AUTH_SECRET` is the HMAC key.

**Rejected alternatives**:
- **Vercel Password Protection** — works, but requires Pro tier and the login screen is Vercel-branded (no custom branding for Klowi).
- **Magic link via Resend + Auth.js** — better UX for adding more users later, but ~2h of setup vs ~30 min for the passcode pattern.
- **IP allowlist / obscure URL** — fragile (Chloë changes networks; URL can be shared accidentally).

**Consequences**:
- Free-tier compatible.
- Custom branded `/login` page.
- Cookie expires in 30 days (configurable via `AUTH_COOKIE_MAX_AGE_S`).
- All API routes (including `/api/chat`) return 401 JSON when unauthed; HTML routes redirect to `/login?next=...`.
- Migration path: when multi-user is needed, swap `lib/auth.ts` for Auth.js without touching the chat code.

***

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
