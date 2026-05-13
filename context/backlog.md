# Backlog – klowi-mcf-assistant

## Now (immediate priority)

- [ ] **Streaming UI sur 1ʳᵉ réponse avec doc** : observer en prod si Chloë voit du blanc trop longtemps après l'envoi d'un PDF. Cause probable : cache cold + Anthropic processing du document = latence avant le 1ᵉʳ chunk. Si récurrent, options : (a) cache mémoire 5min des bytes Blob côté serveur (cf. pattern `lib/system-prompt.ts`), (b) indicateur UI "lecture du document…" pendant l'attente, (c) timeout côté client avec retry.
- [ ] **Wrap seed script in transaction** : `scripts/seed-welcome-conv.ts` enchaîne UPSERT chat → DELETE messages → INSERT opening. Si l'INSERT échoue après le DELETE, conv reste vide (UX cassée). Wrap en `db.transaction(...)` Drizzle (raw `BEGIN/COMMIT` via `@vercel/postgres` ne tient pas le pool de connexions).
- [ ] **Race condition switch-pendant-streaming** : si Chloë clique une autre conv pendant que le streaming d'un assistant message est en cours, le `useEffect` prop-sync de `Chat.tsx` peut écraser `messages` pendant que la boucle de stream y écrit encore. Probabilité faible (single-user, switch rare en cours de stream), mais réel. Fix : `AbortController` sur le `fetch`, ou snapshot du chatId au début du stream et garde sur les `setMessages` updates.
- [ ] **Observer le 1er échange réel de Chloë** sur `/conv/[welcome-id]`. Friction points, tone, perception « pas ChatGPT ». Resserrer si nécessaire.
- [ ] **Nommage de la companion + édition par Chloë** : (a) stocker un nom companion par utilisateur, persistant ; (b) afficher ce nom **discrètement en bas à gauche de la sidebar** (sous le theme picker ou intégré au footer), avec une affordance d'édition inline (clic → input → save) ; (c) injecter `Tu t'appelles {nom}.` dans le system prompt quand le nom est défini ; (d) mettre à jour `00-identity.md` en cohérence (la phrase "tu n'as pas encore de nom" devient conditionnelle). Schéma : ajouter une colonne `companion_name TEXT NULL` sur une nouvelle table `user_preferences (user_id PRIMARY KEY)`, ou un fichier KV-store si on veut éviter d'introduire une nouvelle table. La companion est déjà briefée pour répondre proprement quand Chloë demande son nom (`00-identity.md` § « Si Chloë te demande comment tu t'appelles »).
- [ ] **Cross-session memory** : pipeline de summarization à la fin de chaque chat (titre + résumé court + tags), injection dans le system prompt des sessions suivantes (titres + résumés courts seulement, pas les détails). La companion sait qu'elle a *connaissance* d'autres sessions sans en avoir le détail. Schéma DB : `chat_summaries (chat_id, title, summary, tags, created_at)`. Documenter dans `10-posture.md`.
- [ ] **Page logs + numéro de version discret** : `/admin/logs` récap commits récents + token usage / cache hit ratio + erreurs récentes. Numéro de version (depuis package.json ou VERSION file) injecté dans le system prompt pour que la companion puisse répondre à « il y a eu des modifs ? ».
- [ ] **Édition côté admin** des fragments de prompt (00-identity, 10-posture, 15-corpus-map) — write-back en Git via une route serveur ou via Blob. Pour itérer sans redeploy systématique côté PO.
- [ ] **Génération `.md` à la demande** : la companion peut suggérer cette feature quand un livrable formel serait utile (déjà documenté dans `10-posture.md`). À implémenter quand un cas concret se présente : route serveur qui fait répondre Anthropic en mode « produire le doc complet » + download Blob/file.

## Next (upcoming)

- [ ] Streaming SSE typé (au lieu de text/plain brut) — permettrait de pousser thinking blocks, tool_use events, errors au client.
- [ ] shadcn/ui init quand on a besoin d'un primitive (Dialog, DropdownMenu, etc.).
- [ ] Telemetry : dashboard simple des token counts par chat (input / output / cache_read / cache_creation) — déjà persistés en DB.
- [ ] Mode « show thinking » optionnel dans l'UI (toggle pour afficher les blocs `thinking` du modèle).
- [ ] Citations web search rendues dans l'UI (liens cliquables).
- [ ] Dédup proactive du corpus : 3 CVs, 2 DR par audition. Voir si on peut réduire ~140K → ~80K tokens sans perte sémantique. Réduit le 1er-tour latency.

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

- [x] Corpus map + posture mis à jour pour la reprise post-Strasbourg/Grenoble (S/G passées non retenue, focus Brest 20 mai + Eiffel TBC), 10 fichiers `eiffel/`+`brest/` synced Blob — *2026-05-13*
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
- [x] Premier deploy prod via CLI Vercel + custom domain `klowi.dooloob.com` aliasé — *Phase 3*
- [x] Permission rule Claude Code locale pour `git push` — *Phase 3*
- [x] Brief PO assistant (`brief_assistante_chloe_mcf.md`) intégré dans `00-identity.md` + `10-posture.md` — *Phase 4*
- [x] `context/deeper-context/` (CVs, DR, fiches) commit + walked recursively dans le system prompt — *Phase 4*
- [x] Brief UI rédigé (`brief_ui_klowi.md`) puis package Claude Design intégré — *Phase 4*
- [x] 5 thèmes × light/dark + ThemePicker (next-themes palette + custom hook mode) — *Phase 4*
- [x] Sidebar collapsible « cahier de notes », time-bucket grouping, ChatListItem avec rename inline / delete — *Phase 4*
- [x] Brand mark pivot : `Klowi MCF` italic serif → `CC · MCF · PREP COMPANION` mono uppercase — *Phase 4*
- [x] /admin avec auth séparée (ADMIN_PASSCODE) + onglets Contexte (inventaire) + Prompt (sections collapsibles) — *Phase 4*
- [x] Routage bootstrap dédié `/bootstrap` + ephemeral conversation deleted on `/start` + redirect `/?welcome=1` — *Phase 5*
- [x] Markers techniques `[OPEN]` (kickoff bootstrap) et `[FIRST]` (kickoff welcome) — filtrés UI, conservés DB — *Phase 5*
- [x] Welcome chat pré-nommé « Warm up », auto-titre des autres chats sur 1er message non-marker — *Phase 5*
- [x] Corpus map `15-corpus-map.md` + auto-extraction du 1er heading dans le marker `<!-- file — Titre -->` — *Phase 5*
- [x] KickoffProgress (séquence scriptée 1er tour) + ThinkingIndicator (random court autres tours) — *Phase 5*
- [x] Posture anti-IA-cliché (no « absolument », no disclaimers défensifs ; « pas ChatGPT » mentionné une seule fois au [FIRST]) — *Phase 5*
- [x] Anglais en aparté (Brits-en-France, intraduisible) ; tutoiement par défaut — *Phase 5*
- [x] Format des réponses : court par défaut, propose de creuser, clarifications sur ambiguïté, chat ≠ doc generator — *Phase 5*
- [x] Bootstrap UX serré : meta-clair, signal-aware (lecture des cues d'arrêt), soft cap 2-3 tours — *Phase 5*
- [x] `npm run clean-chats` script + DB wipée pour le launch — *Phase 5*
- [x] Retrait complet de la couche bootstrap (`/bootstrap`, `BootstrapView`, `KickoffProgress`, markers `[OPEN]`/`[FIRST]`, `?welcome=1` flow, "Warm up" naming) — *Phase 6*
- [x] Routage URL-driven `/conv/[id]` (server component fetch + `<Chat>` props, sidebar `router.push`, `router.replace` sur 1er message, 404 sur conv inexistante) — *Phase 6*
- [x] Mécanisme seeded conv : `lib/seeded-convs.ts` (UUID hardcodé, titre, opening message), `npm run seed-welcome` idempotent (sert au seed initial *et* au reset après tests) — *Phase 6*
- [x] Animation typewriter char-par-char (`<TypewriterMessage>`, 28 ms/char), gating client-side `messages.length === 1 && role === assistant` — re-streame tant que Chloë n'a pas répondu, statique ensuite — *Phase 6*
- [x] Upload de documents (`.md`, `.txt`, `.pdf`) : paperclip + chip, `/api/upload` Blob, colonne `attachments JSONB` sur `messages`, expansion en content blocks Anthropic (PDF natif page-aware, MD/TXT inline), cache breakpoint sur le dernier message-avec-doc, awareness dans `10-posture.md` — *Phase 7*

***
*Last updated: 2026-05-13 (reprise post-S/G — focus Brest + Eiffel)*
