# Journal – klowi-mcf-assistant

<!-- Reverse chronological order: newest entries first. Always prepend below this line. -->

## 2026-05-13 — Reprise post-Strasbourg / Grenoble : focus Brest + Eiffel (Adrien B.)

**Contexte** : Strasbourg (11 mai) et Grenoble (12 mai) sont passées, Chloë n'a pas été retenue. Restent Brest (20 mai) et Eiffel (date à confirmer, probablement fin mai – début juin). Adrien a déposé les sous-dossiers `eiffel/` et `brest/` dans `_prep/` (5 fichiers chacun : dossier stratégique, DR prep, discours liminaire, questions anticipées, prompt DR).

### Updates pour que la companion soit alignée

- **`context/prompt/15-corpus-map.md`** refondu :
  - Nouvelle section « État de la campagne » en tête : tableau récap (statut passée/à venir, dates, non-sélection).
  - Sections Brest (poste UBO/HCTI, format 10 min bilingue + 25 min Q&A, enjeu Master L3C en crise) et Eiffel (poste UGE/LISAA équipe SEA, Axe 4 « Ville et représentation », initiative FUTURE, atout ATER-UPEC) ajoutées en tête (avant les passées).
  - Sections Strasbourg / Grenoble repositionnées en « passées, non retenue », matériau toujours accessible pour debrief / leçons réutilisables.
  - Note « Comment t'en servir » enrichie : auditions passées = matière utile sans en faire un sujet ; ne pas inventer un COS Eiffel non confirmé.
  - Tous les paths sous-dossiers (`brest/bst_*`, `eiffel/efl_*`, `grenoble/gre_*`, `strasbourg/str_*`) explicités pour cohérence avec le walk récursif.
- **`context/prompt/10-posture.md` § Dimension psychologique** : retrait du « deux auditions à 3 semaines d'intervalle » (obsolète).
- **`context/prompt/10-posture.md` — nouveau § « État de la campagne »** : section courte et factuelle, posée après Dimension psychologique. Liste les dates (S 11 mai et G 12 mai passées non retenue, B 20 mai à venir, E TBC), interdit explicitement à la companion de référencer S/G comme à venir / cibles / opportunités, et cadre le comportement si Chloë y revient (neutre, pas de consolation, débrief seulement à la demande). Le matériau S/G reste réutilisable (un argumentaire qui marchait, une formulation) sans se reprojeter sur ces auditions. Première itération via un bullet dans Dimension psychologique, resserrée dans la foulée à la demande PO en section dédiée plus opérationnelle (commit `91a7106`).
- **`context/prompt/10-posture.md` § Langue** : « Strasbourg notamment » remplacé par une formulation durable mentionnant que Brest et Eiffel attendent un discours liminaire bilingue FR/EN.

### Sync Blob

- `npm run sync-prep` : 26 fichiers uploadés (16 existants + 10 nouveaux Eiffel/Brest). Prod alignée.

### Smoke check

- TypeScript / lint pas re-runnés (changements limités aux fichiers `.md` du prompt — pas de code). Le walk récursif côté `lib/system-prompt.ts` ramassait déjà les sous-dossiers (logique inchangée depuis Phase 3).
- Le system prompt va passer de ~140K tokens à ~+25K tokens (5 nouveaux fichiers de ~15-30 KB chacun × 2 auditions). Premier tour de chaque session = cache cold + warm, ensuite cache hit. Acceptable pour la phase.

### Concerns notés

- **Volume du corpus en croissance** : on n'a rien retiré (S/G servent encore pour debrief / réutilisation d'argumentaires). Si on dépasse un seuil gênant en latence cold-start, l'item backlog « Dédup proactive du corpus » devient prioritaire. Aujourd'hui : pas urgent.
- **Date Eiffel non confirmée** : la corpus map et la posture le disent explicitement. Quand Chloë la confirme, à mettre à jour côté `15-corpus-map.md` (et éventuellement la mentionner dans `efl_dossier-strategique.md` mais ce dernier est sourcé externe — il faut le faire mettre à jour côté Drive).
- **Fiches absentes pour Brest/Eiffel** : pas de `fiche-cv_*` ni `fiche-soutenance_*` pour ces deux auditions dans `context/deeper-context/` (contrairement à Strasbourg/Grenoble). Si le PO produit ces fiches, elles seront automatiquement embarquées (walk récursif). Non bloquant : les dossiers stratégiques + DR prep couvrent l'essentiel.

### Open questions

**For PO** :

- **Confirmation de la date Eiffel** dès que Chloë l'a.
- **Faut-il enlever Strasbourg/Grenoble du corpus en prod ?** Aujourd'hui : non, on les garde pour le debrief. À reposer si Chloë signale qu'elle ne veut plus en entendre parler, ou si la latence cold-start devient gênante.

***

## 2026-05-04 — Phase 7 : upload de documents (.md, .txt, .pdf) (Adrien B.)

**Goal**: permettre à Chloë de joindre des fichiers à ses messages plutôt que de copier-coller de gros blocs de texte. PDFs lus avec leur structure de pages (support natif Anthropic).

### Livraison

- **DB** : nouvelle colonne `attachments JSONB` sur `messages`, type `MessageAttachment` exporté depuis `lib/db/schema.ts`. `addUserMessage` accepte un argument optionnel.
- **Lib** : `lib/attachments.ts` centralise validation (extension/MIME/taille), fetch Blob via `get(path, { access: "private" })` (pattern aligné sur `system-prompt.ts`), et la construction des content blocks Anthropic (`document` pour PDF, texte framé pour MD/TXT). Logge et skip si Blob renvoie une erreur.
- **Endpoint** : `POST /api/upload` (multipart, valide extension + MIME + taille [10 MB cap], rejette les fichiers vides, génère un UUID, upload Blob `attachments/<uuid>.<ext>`, retourne metadata).
- **Chat route** : accepte `attachments[]` dans le body, persiste sur le user message, reconstruit les content blocks pour TOUS les messages historiques avec attachements à chaque tour (la companion voit les documents partagés sur tous les tours suivants). Cache breakpoint placé sur le dernier bloc du dernier user message qui porte des attachements (économise les tokens sur les tours ultérieurs). Top-level `cache_control` redondant sur `messages.stream()` retiré (la cache_control va sur les content blocks individuels).
- **UI** : paperclip dans la barre d'input (gauche du champ texte), file picker filtré sur `.pdf,.md,.txt`, validation client (extension + 10 MB), chip pendant + dans la bulle user. `<AttachmentChip>` réutilisable (avec/sans bouton ✕). State machine upload (idle/uploading/error) avec error message inline. **AbortController** sur la requête upload : si Chloë retire le chip pendant que ça monte, la requête est abort et aucun blob orphelin n'est résurrigé en state.
- **System prompt** : ajout d'une bullet « Upload de documents » dans `10-posture.md` § Outils. Awareness sans inflation didactique. Le principe « tu ne produis pas à sa place » est rappelé pour les documents joints (commenter, questionner, pointer — pas réécrire).

### Smoke test

- Upload `.md` testé en local : chip apparaît, contenu lu par la companion, posture socratique tient.
- **À surveiller** : Adrien a noté qu'il a dû *rafraîchir la page* pour voir la réponse au 1ᵉʳ tour. Cause probable : 1ʳᵉ réponse avec doc = cache cold + processing du document = stream lent à arriver. À observer en prod sur les premiers usages réels ; si récurrent, investiguer (timeout côté client ? streaming chunks qui n'arrivent pas ?).
- Test chat technique (`dfc37e8c…`) supprimé manuellement. Welcome conv re-seedée.

### Concerns notés

- **Re-fetch Blob à chaque tour** : pas de cache mémoire en v1. Si la latence d'un tour devient gênante (>2s additionnels), ajouter un cache 5min comme `lib/system-prompt.ts` ou stocker les bytes dans `messages.blocks`.
- **Orphan blobs** : pas de sweep automatique, accepté pour single-user. Path namespace `attachments/<id>.<ext>` permet un audit manuel.
- **Constants client/server dupliquées** : `MAX_ATTACHMENT_BYTES` / `ACCEPTED_EXTENSIONS` définis à la fois dans `lib/attachments.ts` (server-only) et au top de `Chat.tsx`. Commenté pour rappel mutuel ; à extraire dans un module partagé non-server-only le jour où ça diverge.

### Open questions

**For PO** :

- **Délai de la 1ʳᵉ réponse avec PDF** : à monitorer sur les premiers tours réels de Chloë. Si elle voit du *blanc* trop longtemps (>5s), on calibrera (cache mémoire des bytes, ou timeout côté client avec retry, ou indicateur "lecture du document…").
- **Multi-attachement** : v1 = 1 attachement par message. Le schema (JSONB array) le supporte déjà, l'UI ne le fait pas. À évoluer si Chloë attache fréquemment plusieurs fichiers d'un coup.

***

## 2026-04-30 — Phase 6 archi : `/conv/[id]` URL-driven + seeded welcome conv (Adrien B.)

**Goal**: remplacer le bootstrap (Chloë l'a déjà fait, page de découverte vue) par une 2ᵉ entrée recadrée. Préparer un lien direct partageable type `/conv/[id]` et seeder une conversation d'accueil dont le 1ᵉʳ message s'anime à l'arrivée. Phase 1 = archi (livrée). Phase 2 = texte du message + rework prompt (à venir, session séparée).

### Pourquoi cette phase

L'expérience "Warm up" générée au [FIRST] était trop directe : la companion répondait frontalement au lieu d'explorer plusieurs angles avec Chloë. Le brief `context/references/brief_message_accueil_chloe_compagnon_de_preparation.md` recadre la posture vers un compagnon / espace de rebond, pas un outil de production. Le bootstrap n'a plus de raison d'exister — Chloë a déjà découvert l'app.

### Cleanup bootstrap

- Suppression de `/bootstrap`, `app/BootstrapView.tsx`, `app/components/KickoffProgress.tsx`, des markers `[OPEN]` / `[FIRST]` dans `/api/chat` et `/api/chat/history`, du `fireWelcomeKickoff` + flow `?welcome=1` dans `Chat.tsx`, du flag `klowi.bootstrap.done`.
- `00-identity.md` réduit à l'identité durable (vocabulaire / réponse à "comment tu t'appelles" / pronom féminin). Tout le bootstrap intro flow / "pas ChatGPT calibrée" / `/start` retiré.
- `10-posture.md` : retrait du seul bullet ancré `[FIRST]` ("Une seule fois au moment du `[FIRST]`..."). Le reste de la section "se méfie de l'IA" intact.
- 2 commentaires stales nettoyés en suite (`ThinkingIndicator.tsx`, `lib/db/queries.ts`).

### Routage `/conv/[id]` URL-driven

- Server component `app/conv/[id]/page.tsx` : fetch chat + messages, `notFound()` si absent, passe `<Chat initialChatId initialMessages>`.
- `Chat.tsx` accepte les props ; plus de `localStorage.chatId`. Sidebar select → `router.push("/conv/${id}")`. Click "nouvelle conv" → `router.push("/")`. 1ᵉʳ message d'une conv neuve → `router.replace("/conv/${newId}")` (pas de pollution history). Delete chat actif → `router.push("/")`.
- Deux `useEffect` ajoutés : prop-sync (reset state quand `initialChatId`/`initialMessages` change — couvre le soft-nav Next.js qui réutilise le component) et `refreshChats()` au mount.
- `app/page.tsx` reste : rend `<Chat />` sans props = état "nouvelle conversation" vide.

### Seeded conv + script idempotent

- `lib/seeded-convs.ts` : `WELCOME_CONV` constante (UUID `7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b`, title "Getting the ball rolling", opening message **placeholder phase 1**).
- `scripts/seed-welcome-conv.ts` : UPSERT chat row (idempotent), DELETE messages liés, INSERT message d'ouverture. `npm run seed-welcome`. Le même script sert au seed initial **et** au reset après tests PO.
- `tsconfig.json` : ajout `"allowImportingTsExtensions": true` pour que TypeScript accepte les imports `.ts` cross-file utilisés par les scripts node `--experimental-strip-types`. Safe avec `"noEmit": true` déjà en place.

### Animation typewriter — *finalement retirée*

Posée puis virée dans la même session. Le composant `<TypewriterMessage>` (reveal char-par-char 28 ms/char + curseur Unicode `▍` puis swap vers `<MessageBubble>`) marchait techniquement, mais à l'usage : trop lent, plus distrayant qu'accueillant. PO call après live test → suppression. Le message d'ouverture de la welcome conv s'affiche désormais en statique, comme un message historique normal. Le mécanisme de seed reste (la conv a bien un message assistant en première position).

### Phase 2 (livrée dans la même session)

- **Texte du message d'accueil** co-rédigé : ancrage sur le discours liminaire de Strasbourg → normalise la distance → reframe l'espace (sparring partner + interlocuteur solide) → paysage micro/macro → 3 portes d'entrée concrètes pour Strasbourg avec interdiction explicite de produire à sa place → 2 questions ouvertes. Draft itéré dans `context/references/message_accueil_chloe_v1.md` (PO a édité directement la v1 avant intégration). Texte final dans `lib/seeded-convs.ts`.
- **Rework `10-posture.md` § Principe fondamental** : hardening "Tu ne produis pas à sa place. Jamais." Pas d'échappatoire "si elle te demande explicitement". Ajout d'une procédure pour les requêtes "écris-moi X" (rediriger vers son propre travail via questions, angles, fausses pistes). Posture par défaut explicitée comme **socratique** (question qui ouvre > réponse qui ferme), sans philosopher, sans psychologiser. Exception préservée : feedback / relecture sur un texte qu'**elle** a soumis.

### Hallucination attrapée en smoke test prod, fix en route handler

À l'envoi du 1ᵉʳ message dans la welcome conv, la companion répondait avec une dérive du genre « je te l'ai écrit juste au-dessus — tu peux le relire là » alors qu'elle n'avait rien produit. Cause : la conv commence par un message **assistant** ; sans message user préalable, le modèle suppose qu'il y a eu un échange antérieur dont il aurait perdu l'accès, et hallucine pour combler.

Fix dans `app/api/chat/route.ts` : avant l'appel Anthropic, si `history[0].role === "assistant"`, on **prepend un message user synthétique** au payload (`[Méta : début de conversation. Chloë vient d'ouvrir un lien dédié vers cette session, elle n'a encore rien écrit. Le message qui suit est ton accueil — pas une continuation.]`). Hors DB, hors UI — uniquement côté payload API. Ancre l'accueil comme une vraie ouverture, plus comme une continuation imaginaire. La règle d'alternation Anthropic est satisfaite, l'hallucination disparaît.

### Bug attrapé en smoke test live

Le `useEffect` de prop-sync ajouté en Phase B a causé une **boucle infinie de renders**. Le défaut `initialMessages = []` crée une nouvelle référence à chaque render → dep array change → setMessages → re-render → loop, jusqu'à React's max update depth → page freezée (sidebar clicks unresponsive). Le code reviewer Phase B avait flaggué un "double render" mais avait sous-estimé la conséquence.

Fix en commit `c122b4e` : suppression complète de l'useEffect de prop-sync, remplacé par une `key` sur `<Chat>` au niveau page (`key="new"` dans `app/page.tsx`, `key={id}` dans `app/conv/[id]/page.tsx`). Naviguer entre routes (ou entre deux convs différentes) force un remount complet de `<Chat>` — state reset propre via les `useState` initializers, pas de loop possible.

### Concerns notés en backlog (Now)

- **Transaction manquante** dans le seed script. Risque marginal pour un script manuel single-user, à wrapper en `db.transaction()` Drizzle avant prod-grade.
- **Race condition** sidebar-switch pendant streaming. Probabilité faible single-user. Fix futur : `AbortController` ou snapshot chatId.

### État final au close-the-loop

- **18 commits poussés sur main**, Vercel auto-deploy live.
- Smoke test browser local OK (sidebar nav, send message, posture socratique vérifiée par déviation correcte sur "écris-moi le 1er paragraphe").
- DB partagée local↔prod : welcome conv déjà seedée dans la même base, donc URL prod `https://klowi.dooloob.com/conv/7b9e4f2c-3a8d-4c1e-9b5a-6d8e2f0c4a7b` directement utilisable sans re-seed.
- Chat orphelin "Nouvelle conversation" supprimé manuellement de la DB partagée pour propreté.

### Open questions

**For PO** :

- **Retour de Chloë sur le nouveau cadre** : posture socratique trop frustrante sur des demandes pratiques ? Message d'ouverture trop long / trop court / mal calibré ? La 2ᵉ question finale (« qu'est-ce qui te résiste le plus ») servait-elle ? Le ré-itérer sur v2 sans push (juste re-seed) si besoin.
- **Cleanup ancien "Warm up"** dans la DB partagée : on garde sa 1ʳᵉ conv historique ou on wipe pour partir net ? Pas urgent, mais à décider.
- **Deprecation `middleware.ts` → `proxy.ts`** Next 16 : warning au build, à migrer un jour mais non bloquant.

***

## 2026-04-29 — Phase 3 + 4 + 5 closed : prêt à envoyer à Chloë (Adrien B.)

**Goal**: clore l'arc « scaffold → app utilisable par Chloë sans assistance ». Cette session a tout couvert : provisioning final, intégration design, bootstrap UX, admin, corpus map, comportement de la companion.

### Plumbing infra (suite Phase 3)

- **Vercel Blob (private store)** provisionné via marketplace Neon-style. 16 fichiers `.md` du `_prep/` synchronisés via `npm run sync-prep`.
- **`vercel link` + `vercel env pull`** pour aligner le local au projet Vercel.
- **`drizzle-kit push`** pour appliquer le schéma (`chats`, `messages`) sur Neon.
- **Passcode auth** : middleware + cookie HMAC, `lib/auth.ts`, `/api/login`, `/api/logout`. Marche sur free tier, branding custom, pas de Vercel Password Protection.
- **Custom domain** `klowi.dooloob.com` aliasé.
- **Permission rule** Claude Code locale (`.claude/settings.local.json`) pour autoriser `Bash(git push:*)` — agent peut désormais pousser direct sur main pour ce repo.
- **`vercel --prod --force`** plusieurs fois après ajout d'env vars (Vercel n'auto-redéploie pas sur ajout d'env, il faut forcer).

### Phase 4 — UI

- **Brief design** rédigé dans `context/references/brief_ui_klowi.md` (157 lignes : voix de marque, 5 surfaces, anti-patterns, process « 5 thèmes en parallèle » + format de livraison technique).
- **Brief envoyé à Claude Design**, retour reçu : package handoff complet (5 thèmes × light/dark, sidebar collapsible « cahier de notes », chat surface, login).
- **5 thèmes intégrés** : Séminaire (académique sans cliché terracotta) / Sobre (Linear/Vercel) / Poudré (girly rose comme papier) / Nuit bleue (Pléiade) / Shiny (cobalt + jaune signal éditorial pop). 10 jeux de variables CSS dans `app/globals.css`. Théming via `next-themes` pour la palette + custom hook pour le mode (light/dark/auto via `localStorage["klowi.mode"]` + classe `.dark`).
- **Composants posés** : `Brand`, `Sidebar` (collapsible desktop + drawer mobile), `ChatListItem` (rename inline + menu), `ThemePicker` (popover 5 swatches + toggle mode), `MessageBubble` (markdown + Shiny `em`/`strong` style), `StreamingDots` (3 barres pulsées), `KickoffProgress` (séquence scriptée premier tour), `ThinkingIndicator` (phrase random pour les autres tours).
- **Sidebar parti pris** : groupement temporel (cette semaine / semaine passée / plus tôt) dérivé du `updatedAt`, filet vertical 4px pour active chat, theme picker en bas. Pas une « thread list ChatGPT ».
- **Brand pivot** : `Klowi MCF` (italic serif hero) → `CC · MCF · PREP COMPANION` (mono uppercase, tag discret, tracking-led). « Klowi » = surnom phonétique de **Chloë**, jamais le nom de la companion.
- **Page /admin** posée : auth séparée via `ADMIN_PASSCODE` + cookie `klowi-admin`. Deux onglets : **Contexte** (inventaire des sources avec sizes/tokens) + **Prompt** (sections collapsibles avec contenu en `<pre>`). Read-only pour v1.

### Phase 5 — Bootstrap & companion

- **Brief PO `brief_assistante_chloe_mcf.md`** intégré dans `00-identity.md` + `10-posture.md`. Pivot complet : pas un coach, **une companion / pote** ; relation horizontale ; ton chaud + clair + sobre ; exigence implicite ; 5 modes (Clarification / Inspiration / Drill / Feedback / Cadrage) ; ne psychologise jamais ; contexte perso jamais évoqué spontanément.
- **Routage bootstrap** : `/bootstrap` slug dédié (sans sidebar) → companion auto-greete via marker `[OPEN]` (pas de message à taper côté Chloë). Sur `/start` : conversation **supprimée** (éphémère) + flag `klowi.bootstrap.done` posé + redirect vers `/?welcome=1`. Sur `/`, marker `[FIRST]` déclenche un message d'accueil enrichi (qui-je-suis / pas-ChatGPT / ce-que-j'ai-en-main / par-quoi-on-commence). Welcome chat pré-nommé **« Warm up »**.
- **Markers techniques** `[OPEN]` et `[FIRST]` filtrés de l'UI mais conservés en DB pour l'alternance user/assistant côté Anthropic.
- **Auto-titre des chats** : `setTitleIfDefault` qui ne fire que si le titre est encore le défaut (« Nouvelle conversation »). Skip pour markers. Le 1er message non-marker dérive le titre (60 chars max).
- **Corpus map `15-corpus-map.md`** : TOC manuel des 23+ fichiers (CVs / DR / fiches / Grenoble / Strasbourg / transversal) avec notes sur les doublons intentionnels. **Plus** auto-extraction du 1er heading H1/H2/H3 dans le marker `<!-- file.md — Titre extrait -->` côté `lib/system-prompt.ts`. Zéro maintenance.
- **Bootstrap UX serré après tests live** :
  - Tutoiement par défaut dès le 1er message.
  - Premier message en **une phrase de présentation** (pas de meta, pas de `/start`). Bilingue (FR + EN sentence en continuité).
  - `/start` glissé au **2e message** (après le nom).
  - Soft cap : max 2-3 tours de cadrage après l'intro.
  - Lecture des **signaux d'arrêt** (« on verra à l'usage », « je ne sais pas trop ») : protocole 4 étapes (acquiesce / ne pousse pas / rappelle `/start` / rends la main).
- **Posture anti-IA-cliché** : Chloë est réfractaire à l'IA. Pas de tics « absolument ! », « ravie de t'accompagner », « excellente question ! ». Pas de disclaimer défensif. Une seule mention « pas ChatGPT, calibrée pour cette mission » au `[FIRST]`, jamais répétée.
- **Anglais en aparté** : Chloë est britannique en France, peut glisser de l'anglais (bonding Brits-en-France, ou intraduisible). Companion peut suivre dans le même registre, ponctuellement, sans basculer tout en anglais. Code « Brits-en-France » : si elle laisse poindre l'agacement classique vis-à-vis des français « arrogants », companion entend / sourit / hoche, sans en faire un sujet.
- **Format des réponses** : commence court par défaut, **propose de creuser** plutôt que de tartiner. Sujet nouveau → vérifie l'angle d'abord. Demande ambiguë → 2-3 questions de clarification. **Chat = chat, pas un éditeur de docs** ; copy-paste OK ; si livrable structuré utile, **suggérer à Adrien d'ajouter une feature `.md`** (loggé en backlog).

### Outils additionnels posés

- `npm run clean-chats` — wipe la table `chats` (cascade messages). Déjà roulé en fin de session pour partir propre.
- KickoffProgress (séquence) vs ThinkingIndicator (random court) — différencier le 1er tour (slow, ~10s, séquence rassurante) des suivants (~1-2s avec cache, phrase courte unique).

### Bugs trouvés et corrigés en live

- Symlink `mcf/` → Drive a fait crasher Turbopack au build. Fix : path lu depuis env var `MCF_PREP_DIR` au lieu d'être en dur.
- `glossary.md` symlink dangling → supprimé.
- Vercel CLI uploadait le symlink `mcf` même gitignored → ajout `.vercelignore`.
- Blob private = `fetch(b.downloadUrl)` renvoie 403. Switch vers `get(pathname, { access: "private" })` qui passe par le SDK auth.
- Stale `klowi.chatId` en localStorage causait 404 sur `/api/chat/history` qui bloquait le welcome kickoff. Fix : clear localStorage + state au 404.
- ANTHROPIC_API_KEY pasted en clair dans la conv (incident léger) → rotation de clé immédiate.

### État au moment de fermer

- 17 commits poussés sur main, tous deployés.
- DB wipée (0 chats).
- URL ready pour Chloë : `https://klowi.dooloob.com/bootstrap`.
- Auditions à 13 jours (Strasbourg ~11 mai, Grenoble 12 mai).

### Open questions

**For PO** :

- **Retour de Chloë** sur le 1er échange : tone, friction, perception « pas ChatGPT ». Si elle ressent du « scripté », on serrera la posture.
- **Cross-session memory** (en backlog Now) : pertinent à mettre en place avant qu'elle accumule plusieurs sessions, pour que la companion ait une notion des autres conversations. Sinon chaque nouvelle conv repart à zéro côté contexte conversationnel.
- **Page /logs + numéro de version visible** (en backlog Now) : à wirer dès qu'une 1re modif post-launch est faite, pour que Chloë puisse demander à la companion « il y a eu un changement ? ».
- **Production de docs** (`.md` generation) : Chloë va-t-elle vouloir générer des fiches autonomes ? À évaluer après quelques sessions. Le prompt actuel **suggère explicitement** à la companion de proposer cette feature à toi si ça vient.
- **Feedback bootstrap** : si elle reste bloquée dans le bootstrap au-delà de 2-3 tours, signal qu'on doit serrer encore. Si elle arrive à `/start` rapidement, c'est calibré.

***

## 2026-04-29 — Phase 3 (en cours) : storage Blob + passcode auth (Adrien B.)

**Goal**: rendre l'app deployable. (1) faire arriver le contenu privé `_prep/` jusqu'à Vercel sans le commit dans Git ; (2) gater l'accès derrière un passcode.

### Vercel Blob — storage du corpus privé

- PO a provisionné un Blob store (`klowi-mcf-assistant-blob`) en mode **private** depuis le marketplace Vercel. `BLOB_READ_WRITE_TOKEN` auto-injecté dans les env du projet.
- `lib/system-prompt.ts` retravaillé :
  - **Walk récursif** des sous-dossiers (`grenoble/`, `strasbourg/`) — le code précédent ne lisait que la racine de `_prep/`.
  - **Resolver hybride** : `MCF_PREP_DIR` set → fs (local dev, itération rapide) ; sinon `BLOB_READ_WRITE_TOKEN` set → fetch Blob ; sinon vide.
  - **Cache 5 min en mémoire** côté Blob path pour éviter de re-fetch tous les blobs à chaque turn.
- `scripts/sync-prep.ts` créé : walk local de `MCF_PREP_DIR`, upload vers Blob avec `addRandomSuffix: false` + `allowOverwrite: true`, prune des orphans qui ne sont plus locaux. Lancé via `npm run sync-prep`.
- 16 fichiers .md uploadés au premier sync (le corpus complet : `fiche-audition-blanche`, `journal`, `pistes_prep`, `notes-chloe`, + sous-dossiers `grenoble/` et `strasbourg/` avec discours, dossiers stratégiques, questions anticipées, etc.).
- Pour un Blob **privé**, on ne peut pas lire `b.url` (URL publique non fonctionnelle) — il faut utiliser `b.downloadUrl` (URL signée temporaire). Code adapté.

### Passcode + cookie HMAC

- `lib/auth.ts` : sign/verify HMAC-SHA256 via Web Crypto (edge-compatible, pas de `node:crypto`). Cookie format `<expiry>.<sig>`. Compare-time constant-time pour la signature et le passcode.
- `middleware.ts` : matcher exclut `/login`, `/api/login`, `/api/logout`, `/_next/`, `/favicon.ico`. Tout le reste est gated. Renvoie `redirect /login?next=...` pour les pages, `401 JSON` pour les API.
- `app/login/page.tsx` : form passcode minimaliste, gestion des erreurs via `?error=1`.
- `app/api/login/route.ts` : POST → vérifie passcode → set cookie HttpOnly Secure SameSite=Lax (max-age 30 jours) → 303 vers `next` ou `/`. Validation du `next` (rejette les redirects externes).
- `app/api/logout/route.ts` : POST/GET → clear cookie → 303 vers `/login`.
- Smoke test local OK : 6/6 scénarios verts (no cookie → 307, wrong passcode → 303 + erreur, right passcode → 303 + Set-Cookie, cookie → 200 chat, /api/chat sans cookie → 401).

### À faire pour le deploy (avant push)

**For PO** :

1. **Sur Vercel → Settings → Environment Variables, ajouter pour Production + Preview + Development** :
   - `APP_PASSCODE` : choisis le passcode (ex: une phrase mémorable que tu donnes à Chloë).
   - `AUTH_SECRET` : généré via `openssl rand -hex 32` côté ton terminal — c'est la clé HMAC qui signe les cookies.
   - **Important** : ces deux vars doivent être présentes AVANT le push, sinon le 1er request prod renverra 500.
2. **Custom domain** : `klowi.dooloob.com` est déjà CNAME → vérifier que le projet Vercel l'a bien adopté côté Settings → Domains.
3. **Push** : moi je commite, toi `! git push origin main`. Vercel auto-deploy.
4. **Test prod** : aller sur `klowi.dooloob.com` → /login → entrer le passcode → chat doit fonctionner avec contenu Blob.

***

## 2026-04-29 — Phase 2 : chat live (streaming + DB + caching) (Adrien B.)

**Goal**: passer du squelette à un chat utilisable de bout en bout, branché Anthropic + Postgres + cache.

### Plumbing infra (avant Phase 2 code)

- **Vercel project linké** : `adrien-blaises-projects/klowi-mcf-assistant`, repo GitHub privé.
- **Neon Postgres provisionné** via le marketplace Vercel (Frankfurt). L'intégration injecte les deux conventions de noms — `POSTGRES_URL` (legacy) et `DATABASE_URL` (Neon). Notre code lit `POSTGRES_URL` ; rien à changer.
- **Schéma Drizzle pushé** : `chats` + `messages` créées, vérifiées par requête live.
- **`ANTHROPIC_API_KEY` rotée** (la première a fuité dans une conv, le PO l'a révoquée + recréée → coché Dev/Preview/Prod sur Vercel → re-pull local OK).

### Code livré

- `lib/db/queries.ts` — helpers `createChat`, `listMessages`, `addUserMessage`, `addAssistantMessage`, `touchChat`.
- `app/api/chat/route.ts` — POST streaming :
  - `messages.stream()` Anthropic, modèle `claude-sonnet-4-6`, `max_tokens: 8192`.
  - **Adaptive thinking** + `effort: "medium"`.
  - **Web search** : tool natif `web_search_20260209`.
  - **Caching** : `cache_control: ephemeral` à la fois sur le bloc système ET en top-level (couvre system + history multi-tours).
  - Persiste user msg avant stream, assistant msg après `finalMessage()`, avec token accounting (input/output/cache_creation/cache_read).
  - `preferredRegion: "fra1"` pour matcher la région Neon → minimise la latence DB.
  - Réponse : `Content-Type: text/plain` streaming + headers `X-Chat-Id` / `X-New-Chat`.
- `app/api/chat/history/route.ts` — GET pour rehydration côté client à l'ouverture de page.
- `app/Chat.tsx` (client) + `app/page.tsx` (server shell) — UI minimaliste : header, liste de messages, textarea auto-resize, streaming display, markdown rendu (sans plugin typography, composants stylés inline). `chatId` persisté dans `localStorage`. Bouton "Nouvelle conversation".

### Dur de la session : Turbopack + symlink Google Drive

- Le build a planté : `Symlink mcf/AUDITIONS (!!)/_prep/README-KLOWI.md is invalid, it points out of the filesystem root`. Turbopack analyse statiquement les `path.join(process.cwd(), "mcf", ...)` et tente de tracer le dossier comme asset au build → Google Drive croisant le filesystem root, panic.
- **Fix** : `lib/system-prompt.ts` lit le path privé via `process.env.MCF_PREP_DIR` (pas de chaîne littérale du chemin dans le code source). Ajouté `MCF_PREP_DIR=...` à `.env.local` (gitignored) + entrée vide dans `.env.local.example`.
- À noter pour Vercel : il faudra copier `_prep/` dans les build artifacts via un script `prebuild` (Phase 3) et pointer `MCF_PREP_DIR` en conséquence.

### Smoke test end-to-end

- Tour 1 : envoi de "Bonjour, présente-toi rapidement." → streaming OK, chat créé en DB, **18 131 tokens écrits dans le cache** (= taille de notre system prompt actuel).
- Tour 2 : envoi de "Va pour Iris. Quelle est la question la plus piégée à Grenoble ?" → **18 131 tokens lus du cache**, 506 nouveaux écrits (le précédent tour ajouté à la prefix), 3 tokens "frais". **Cache opérationnel.**
- L'assistante montre une vraie compétence métier : a parlé de LEA, ESP, du contexte agrégation, a proposé spontanément une question d'audition pertinente. Le `00-identity.md` a fonctionné — elle a proposé Vera/Nora/Ada/Iris/Clio.

### Decisions notables

- **Path privé via env var** : structurel, ajouté à `decisions.md`. Pas un workaround temporaire — c'est le bon pattern pour une source de prompt qui peut bouger entre dev local (Drive) et prod (build artifact).

### Ce qui reste

**For PO** :
- **Brief `00-identity.md`** : tes 3-4 questions exactes pour le mini-onboarding du tout premier tour.
- **Brief `10-coach-behavior.md`** : version dérivée de `CONTEXT-COACH.md` avec ce que tu veux garder/affiner (modes, ton, tabous).
- **Brief `20-chloe-profile.md`** : CV analytique à intégrer côté commit.
- **Vérifier le live** : tu peux ouvrir `npm run dev` localement et essayer une conv avec Chloë (ou seul) pour voir si le ressenti tient.

**Tech à venir** :
- **Build-time copy** de `_prep/` pour Vercel deploy : script `prebuild` qui rsync le contenu dans `./prep-build/` (commité ? non — gitignored, juste utilisé au build) et set `MCF_PREP_DIR=./prep-build` côté Vercel env. À designer Phase 3.
- **Multi-chat UI** : sidebar avec liste des conversations, switch entre elles. (Aujourd'hui c'est multi-chat-DB-ready mais single-chat-UI.)
- **Admin zone** (cf. backlog) : éditer les fragments de prompt, voir le prompt assemblé, suivre les tokens. Phase 3.
- **Streaming SSE proprement** au lieu de text/plain : permettrait de pousser des événements typés (thinking/tool_use/error) au client. Optimisation v1.5.
- **Custom domain `klowi.dooloob.com`** + **Password Protection** côté Vercel.

***

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
