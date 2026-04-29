# Backlog – klowi-mcf-assistant

## Now (immediate priority)

- [ ] **Phase 2 — Streaming chat endpoint** : `app/api/chat/route.ts` avec `messages.stream`, prompt caching breakpoints, message persistence côté Postgres
- [ ] **Phase 2 — Wire system prompt assembly** : `lib/system-prompt.ts` branché sur la route, build-time copy de `mcf/_prep/**.md` pour Vercel
- [ ] **Phase 2 — Bootstrap meta-session UX** : conversation amorcée par `00-identity.md`, capture du nom choisi, écriture back dans le file (script `tools/finalize-identity.ts` ?)
- [ ] **Phase 2 — Web search tool** : enable Anthropic native `web_search`, server-side tool execution loop
- [ ] **Phase 2 — Chat UI** : message list + input, markdown rendering (`react-markdown` + `remark-gfm`), streaming display
- [ ] **Phase 2 — Provision Vercel Postgres** : `vercel link`, créer la DB, `vercel env pull .env.local`, `drizzle-kit push`

## Next (upcoming)

- [ ] Conversation list (sidebar) : new / rename / delete, multi-chats v1
- [ ] Vercel deploy + Password Protection activée
- [ ] Première session end-to-end validée par Chloë (= bootstrap meta-session live)
- [ ] Migrer `context/references/CONTEXT-COACH.md` → `context/prompt/10-coach-behavior.md` (et fragmenter en 20/30/40)
- [ ] Compléter `context/prompt/20-chloe-profile.md` à partir du CV analytique de `mcf/CV/`
- [ ] shadcn/ui init quand on a besoin d'un primitive (Dialog, DropdownMenu, etc.)
- [ ] Telemetry légère : log côté serveur des token counts par message (input / output / cache_read / cache_creation)

## Later (à explorer)

- [ ] Mode quiz/sparring avec UI affordance dédiée
- [ ] Export « partager avec PO » d'une conversation
- [ ] Voice mode (TTS + STT) — phase 2
- [ ] Re-usability pour campagnes suivantes (agrégation, autres auditions)
- [ ] Coverage / progression tracking par sujet d'audition
- [ ] Model routing (Sonnet default, Opus pour review, Haiku pour quiz)
- [ ] Migration Auth.js si multi-user devient utile
- [ ] Migration Bedrock si consolidation AWS / data-residency

## Done

- [x] Scaffold Next.js (App Router, TS, Tailwind v4, ESLint, Turbopack) — *Phase 1*
- [x] Décider stratégie d'assemblage du system prompt (= static concat + caching) — *Phase 1*
- [x] Décider la persistence (= Vercel Postgres + Drizzle) — *Phase 1*
- [x] Décider l'auth v1 (= Vercel Password Protection) — *Phase 1*
- [x] Squelette code : `lib/anthropic.ts`, `lib/db/{schema,client}.ts`, `lib/system-prompt.ts`, `drizzle.config.ts` — *Phase 1*
- [x] Layout `context/prompt/` (public-grade) vs `mcf/_prep/` (privé) — *Phase 1*
- [x] `tech-stack.md` régénéré, `README.md` créé — *Phase 1*

***
*Last updated: 2026-04-29 (Phase 1 closed)*
