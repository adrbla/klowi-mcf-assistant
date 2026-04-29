# Journal – klowi-mcf-assistant

<!-- Reverse chronological order: newest entries first. Always prepend below this line. -->

## 2026-04-29 — Phase 1 : framing technique + scaffold (Adrien B.)

**Goal**: arbitrer les Open Questions structurantes et poser le squelette Next.js avant Phase 2 (chat).

### Décisions prises (voir `decisions.md`)

- **Persistence** : Vercel Postgres (Neon) + Drizzle ORM. Rejets : Supabase (overkill), Turso (pas besoin d'edge), SQLite + Prisma (FS éphémère sur Vercel).
- **Auth v1** : Vercel Password Protection (1 mot de passe global, 0 ligne de code). Migration Auth.js plus tard si multi-user devient utile.
- **Stratégie d'assemblage du system prompt** : static concat de tout le corpus + prompt caching Anthropic. Rejets : RAG (qualité retrieval à valider, code à écrire), hybride (complexité disproportionnée v1).
- **Source-of-truth split** : `context/prompt/*.md` commité (squelette public-grade) + `mcf/AUDITIONS (!!)/_prep/**.md` privé runtime. Règle : *« Si Chloë le mettrait sur LinkedIn → commit. Si elle le dirait en off → privé. »*
- **Modèle par défaut** : `claude-sonnet-4-6` partout en v1. Switch Opus 4.7 sur mode review uniquement si nécessaire.
- **API Anthropic directe** (pas Bedrock) en v1. Bloqueur dur sur Bedrock : tool natif `web_search` non exposé.
- **Web search** : tool Anthropic natif, sans allowlist v1.
- **Multi-chats dès v1** (séparer Grenoble / Strasbourg / quiz / révisions).
- **Format du contexte** : Markdown partout. Pas de JSON. Pas de DB pour le prompt (Git versionne le statique, Postgres versionne les conversations).
- **Bootstrap meta-session** : pas de nom hardcodé. Au tout premier échange l'assistante propose des noms à Chloë et l'onboarde brièvement. Le résultat est figé dans `context/prompt/00-identity.md` (commit après).

### Ce qu'on a fait côté code

- Scaffold `create-next-app` (Next.js 16.2.4, React 19.2.4, Tailwind v4, ESLint, App Router, Turbopack, no `src/`).
- Deps installées : `@anthropic-ai/sdk`, `@vercel/postgres`, `drizzle-orm`, `drizzle-kit`, `react-markdown`, `remark-gfm`, `clsx`, `tailwind-merge`, `server-only`.
- `lib/anthropic.ts`, `lib/db/{schema,client}.ts`, `lib/system-prompt.ts`, `lib/utils.ts`, `drizzle.config.ts`.
- `app/page.tsx` + `app/layout.tsx` minimalisés (français, métadonnées Klowi, suppression du contenu boilerplate Next.js).
- `context/prompt/{README.md, 00-identity.md}` créés.
- `.env.local.example` mis à jour (POSTGRES_URL, DEFAULT_USER_ID).
- `.gitignore` enrichi (`.vercel`, `*.pem`, `/coverage`, suppression de l'entrée `glossary.md`).
- `tech-stack.md` régénéré à partir du repo réel (au lieu du placeholder).
- `README.md` créé.

### Surprises / nettoyage

- **Symlink `glossary.md → ../glossary.md`** : dangling, faisait crasher `next build` (Turbopack stat() les symlinks à la racine). Supprimé. PO peut le recréer une fois `_klowi/glossary.md` existant.
- **`context/references/meetings/`** : retiré (pas utilisé pour ce projet). Section « Meeting transcript imports » de `CLAUDE.md` retirée en cohérence.
- 2 vulnérabilités modérées au `npm audit` (esbuild via drizzle-kit, postcss via Next 16). **Dev-only**, pas d'impact runtime — non corrigées.

### Build vert

- `npx tsc --noEmit` : ✅
- `npm run lint` : ✅
- `npm run build` : ✅ (4 pages statiques générées)

### Open questions

**For PO** (Adrien) :

- **Onboarding flow détaillé** — Pour la meta-session, quelles questions concrètes pose-t-elle au premier échange ? (J'ai listé : audition la + stressante / modes anticipés / sujets à éviter / format de feedback préféré — à valider/affiner.)
- **Provisioning Postgres** — Tu provisionnes Vercel Postgres maintenant (pour pouvoir wire la persistance dans Phase 2) ou plus tard ? Si maintenant : `npx vercel link` + `vercel postgres create` côté dashboard.
- **Vercel project** — Le project Vercel existe-t-il déjà ou faut-il le créer ?
- **Domaine** — URL prévue ? `mcf.klowi.app` / `klowi.vercel.app` / autre ?
- **Migration vers `00-coach.md`** — On dérive `context/prompt/10-coach-behavior.md` à partir de `context/references/CONTEXT-COACH.md` quand ? (Maintenant ou en Phase 2 ?)

***

## Cowork session – 2026-04-29 (Adrien B.)

**Goal**: Initial framing of the project and Nexus generation.

**What we did**:
- Cloned the empty `klowi-mcf-assistant` repo (remote: `github.com/adrbla/klowi-mcf-assistant`).
- Created a symlink `mcf/` → Google Drive `MCF/` folder (private prep material; gitignored).
- Created `glossary.md` symlink → `../glossary.md` at the Nexus root (dangling for now — harmless).
- Moved `CONTEXT-COACH.md` (initial coach briefing) into `context/references/` as a starting point — explicitly **not** the final system prompt.
- Generated the Nexus: `CLAUDE.md`, `DEVS.md`, `context/{vision,backlog,decisions,journal,tech-stack,architecture}.md`.

**Important decisions** (see `decisions.md`):
- Stack: Next.js (App Router, TypeScript) + Anthropic SDK, target Vercel.
- Stage: MVP.
- Voice / TTS-STT out of scope for v1.
- Solo workflow (PO + Claude Code).

**Next steps**:
- Start the first Claude Code session: scaffold Next.js, follow the "First session on this project" workflow in `CLAUDE.md` (auto-generate `tech-stack.md` from the actual code, scan for surprises, generate README, clean up macOS metadata in `.gitignore`).
- Resolve the Open Questions below before committing to a structural shape.

### Open questions

**For PO** (Adrien):

- **Auth strategy** — three options on the table: (a) Vercel password protection (no code), (b) magic link via Resend + Auth.js, (c) obscure URL + IP allowlist. To decide before deploy.
- **Persistence layer** — pick one: Vercel Postgres, Supabase, Turso, or SQLite via Prisma. Affects schema, deploy config, and local dev story.
- **System prompt assembly strategy** — static concat of all `_prep/*.md` (simple, large prompt, leverage Anthropic prompt caching) vs. RAG (smaller per-call payload, more code, retrieval quality risk) vs. hybrid (per-mode). Drives both architecture and cost profile.
- **Source of truth for the system prompt** — committed markdown in the repo (versioned, public on GitHub) vs. read from `mcf/` at runtime (kept private) vs. hybrid (committed structure + private content references). Probably hybrid; confirm.
- **Model choice** — Sonnet 4.6 default? Opus 4.6 for review/feedback mode? Haiku 4.5 for quiz?
- **Chat granularity** — a single rolling conversation, or chats/sessions with topics (e.g. one per audition, one per mode)?

***
