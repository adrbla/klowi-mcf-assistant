# Backlog – klowi-mcf-assistant

## Now (immediate priority)

- [ ] **PO sets `APP_PASSCODE` + `AUTH_SECRET` on Vercel** (Production + Preview + Development) — bloquant pour le 1er deploy fonctionnel.
- [ ] **Push + premier deploy prod** : `git push origin main` → Vercel auto-deploy → vérifier `klowi.dooloob.com`.
- [ ] **Phase 3 — Briefs PO intégrés** : `context/prompt/00-identity.md` (questions onboarding), `10-coach-behavior.md` (dérivé CONTEXT-COACH), `20-chloe-profile.md` (CV).
- [ ] **Phase 3 — Multi-chat sidebar** : DB-side déjà multi, manque l'UI (liste + switch + rename + delete).
- [ ] **Phase 3 — Admin zone** : interface réservée PO pour éditer les fragments de prompt, voir le prompt assemblé, déclencher `sync-prep` à distance, suivre les tokens.
- [ ] **Phase 3 — UI redesign** (PO mentionne "Claude Design") : à attendre, tu reviens avec une direction.

## Next (upcoming)

- [ ] **Persistance transverse / cross-session memory** — pipeline de summarization à la fin de chaque chat (titre + résumé court + tags), injection dans le system prompt des sessions suivantes (titres + résumés courts seulement, pas les détails). La companion sait qu'elle a *connaissance* d'autres sessions sans en avoir le détail ; elle peut suggérer à Chloë de « repartir de la session X » si ça pertinent. Documenter dans `10-posture.md` côté prompt. Schéma DB : table `chat_summaries (chat_id, title, summary, tags, created_at)`.
- [ ] **Page logs côté /admin** + **numéro de version discret visible à la companion** — le numéro est injecté dans le system prompt (par ex. `version: 0.X.Y` extrait du package.json ou d'un VERSION file). Permet à Chloë de savoir « si Adrien a fait des modifs depuis la dernière fois » via la companion. La page logs récapitule : commits récents (depuis git ou un changelog), token usage / cache hit ratio par jour, erreurs récentes.
- [ ] Première session end-to-end validée par Chloë (= bootstrap meta-session live)
- [ ] Streaming SSE typé (au lieu de text/plain brut) — permettrait de pousser thinking blocks, tool_use events, errors au client
- [ ] shadcn/ui init quand on a besoin d'un primitive (Dialog, DropdownMenu, etc.)
- [ ] Telemetry : dashboard simple des token counts par chat (input / output / cache_read / cache_creation) — déjà persistés en DB
- [ ] Mode "show thinking" optionnel dans l'UI (toggle pour afficher les blocs `thinking` du modèle)
- [ ] Citations web search rendues dans l'UI (liens cliquables)

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
- [x] Vercel project + Neon Postgres provisionné, env vars synced, schema pushé — *Phase 2*
- [x] DB queries helpers (`lib/db/queries.ts`) — *Phase 2*
- [x] Streaming chat endpoint `/api/chat` avec caching + web_search + adaptive thinking + persistence — *Phase 2*
- [x] History endpoint `/api/chat/history` pour rehydration — *Phase 2*
- [x] Chat UI minimaliste avec markdown, streaming, localStorage de chatId — *Phase 2*
- [x] Path privé via `MCF_PREP_DIR` env var (contournement panic Turbopack) — *Phase 2*
- [x] Smoke test end-to-end : streaming OK, cache hit confirmé sur tour 2 (18 131 tokens lus) — *Phase 2*
- [x] Vercel Blob (private store) provisionné, `sync-prep` script, runtime hybrid fs/Blob — *Phase 3*
- [x] Walk récursif de `_prep/` (sous-dossiers `grenoble/`, `strasbourg/` inclus) — *Phase 3*
- [x] Passcode auth : middleware + cookie HMAC + /login + /api/{login,logout} — *Phase 3*

***
*Last updated: 2026-04-29 (Phase 3 partiel — auth + storage prêts, deploy en attente)*
