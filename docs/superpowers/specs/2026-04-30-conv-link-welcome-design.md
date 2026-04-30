# Design — Lien direct vers conv + conv welcome seedée

**Date**: 2026-04-30
**Auteur**: Adrien B. (PO) + Claude (assistant)
**Statut**: Spec validée, prête pour plan d'implémentation

---

## Contexte

Le bootstrap initial (`/bootstrap` + `/?welcome=1`) a été utilisé pour la 1ʳᵉ rencontre de Chloë avec la companion. La conversation "Warm up" générée a été jugée trop directe : la companion répondait frontalement au lieu d'explorer plusieurs angles, proposer des approches et amener Chloë à s'engager dans le processus.

L'objectif : remettre Chloë dans la boucle avec une **2ᵉ entrée recadrée**, plus exploratoire, alignée avec le brief `context/references/brief_message_accueil_chloe_compagnon_de_preparation.md` (compagnon de préparation, pas un outil de production, paysage d'usages, ne jamais faire à sa place).

Le levier : un lien direct envoyable à Chloë, qui ouvre une conversation pré-préparée avec un message d'ouverture calibré qui s'anime à son arrivée. Le bootstrap n'a plus de raison d'exister (Chloë a déjà découvert l'app) et est entièrement retiré.

## Périmètre

**In scope (cette spec / phase 1)** :
1. Suppression complète de la couche bootstrap (route, composant, markers, mentions dans le system prompt liées au 1ᵉʳ contact).
2. Refacto routage : `/conv/[id]` devient le pattern global de la conv active. URL = source de vérité.
3. Mécanisme de conversation seedée : une conv préparée serveur-side avec un message d'accueil rédigé en dur, animée à la 1ʳᵉ ouverture tant que Chloë n'a rien tapé.

**Out of scope (phase 2)** :
- Rédaction du contenu réel du message d'accueil (en collaboration PO).
- Rework du system prompt pour intégrer la posture du nouveau brief (au-delà du strict cleanup bootstrap).

La phase 1 livre la mécanique avec un texte d'ouverture placeholder. La phase 2 calibre le message et la posture conversationnelle qui suit.

---

## 1. Cleanup bootstrap

### Fichiers à supprimer

- `app/bootstrap/page.tsx`
- `app/bootstrap/BootstrapShell.tsx`
- `app/BootstrapView.tsx`
- `app/components/KickoffProgress.tsx` (utilisé uniquement par BootstrapView)

### Fichiers à modifier

**`app/api/chat/route.ts`** :
- Retirer la détection des markers (`isMarker`, comparaison avec `[OPEN]` / `[FIRST]`).
- Retirer le pré-naming "Warm up" pour les chats créés via `[FIRST]`.
- La logique `setTitleIfDefault` reste, sans cas spéciaux markers.

**`app/Chat.tsx`** :
- Retirer la constante `WELCOME_KICKOFF`.
- Retirer `welcomeFiredRef`, `fireWelcomeKickoff`, le `useEffect` qui lit `?welcome=1`.
- Le filtrage des markers à l'affichage devient sans objet (plus de markers en DB).

**Clés localStorage à retirer** :
- `klowi.bootstrap.done`
- `klowi.chatId` (cf. section 2 — devient inutile avec URL = source de vérité)

### System prompt (cleanup minimal phase 1)

Mentions à retirer dans `00-identity.md` / `10-posture.md` (ou autres fichiers de prompt) :

- Markers `[OPEN]` / `[FIRST]`
- Commande `/start` et flow `/bootstrap`
- Pré-naming "Warm up"
- Séquence d'accueil scriptée et règles "premier tour"
- Disclaimer "pas ChatGPT, calibrée pour cette mission"
- Tutoiement-par-défaut-au-1er-message (probablement déjà acquis ailleurs)
- Protocole "signaux d'arrêt" en 4 étapes *si* limité au bootstrap (à confirmer en lecture)

Le rework de fond (intégration de la posture du nouveau brief) est hors scope phase 1.

---

## 2. Refacto routage `/conv/[id]`

### Nouvelles routes

**`app/conv/[id]/page.tsx`** — server component :
- Récupère `id` depuis les params Next.js.
- Vérifie l'existence du chat via `getChat(id)` (depuis `lib/db/queries`).
- Si absent → `notFound()` (renvoie 404).
- Si présent → rend `<Chat initialChatId={id} initialMessages={...} />` (option : pré-charger l'historique côté serveur pour éviter le flash vide).

**`app/page.tsx`** :
- Reste, devient l'état "nouvelle conversation" (vide). Rend `<Chat />` sans `initialChatId`.

### Composant `<Chat>`

Modifications dans `app/Chat.tsx` :
- Accepte deux props optionnelles : `initialChatId?: string`, `initialMessages?: Message[]`.
- Plus d'hydratation depuis `localStorage` pour le `chatId`.
- Gestion des transitions client (sidebar → click) via `next/navigation` `router.push("/conv/${id}")`.

### Comportement URL ↔ état

| Action | Résultat |
|---|---|
| Click conv dans sidebar | `router.push("/conv/${id}")` → server component recharge → `<Chat>` reçoit l'id et l'historique |
| Click "Nouvelle conversation" | `router.push("/")` → état vide |
| 1er message envoyé depuis `/` | Après réception du `X-Chat-Id` du serveur : `router.replace("/conv/${newId}")` (replace, pas push, pour ne pas polluer l'history) |
| Reload sur `/conv/[id]` | Server fetch de l'historique → render direct, pas de flash vide |
| Reload sur `/` | État vide |
| `/conv/[id]` avec id inexistant | 404 (`notFound()`) |

### Décisions associées

- **À l'arrivée sur `/` quand des convs existent** : on **reste sur l'état vide**. Pas d'auto-réouverture de la dernière conv. URL = source de vérité.
- **`localStorage.chatId`** : **supprimé**. La sidebar est la navigation entre convs.

### Rendu serveur vs client

- **`/conv/[id]`** : rendu serveur initial (server component fetch l'historique, passe en props). Évite le flash. Le 404 se fait directement.
- **Transitions sidebar → conv** : navigation client via `router.push` (Next.js soft navigation), pas de full reload.
- **Sidebar elle-même** : continue de fetch via `/api/chats` côté client, inchangé.

### Auth

Inchangé. Middleware déjà compatible (matcher exclut `/login`, `/api/login`, etc.). Si Chloë reçoit `/conv/[id]` sans cookie, elle est redirigée vers `/login?next=/conv/[id]` et le param `next` est honoré (déjà en place — cf. commit `1214742`).

---

## 3. Mécanisme de conversation seedée

### Structure du seed

**`lib/seeded-convs.ts`** (nouveau fichier) :

```ts
export const WELCOME_CONV = {
  id: "<UUID v4 random, généré une fois et hardcodé>",
  title: "Getting the ball rolling",  // titre final à valider phase 2
  openingMessage: `<placeholder phase 1 — texte rédigé phase 2>`,
};
```

L'UUID est :
- Généré une seule fois (via `crypto.randomUUID()` ou similaire) au moment de la création du fichier.
- Hardcodé comme constante. Stable à travers déploiements et resets DB.
- Une chaîne **random** (pas un pattern incrémental ou vanity). Opaque dans l'URL.

### Script de seed

**`scripts/seed-welcome-conv.ts`** + entrée `npm run seed-welcome` dans `package.json`.

Comportement **idempotent / upsert** :

1. Connexion DB (Drizzle, depuis `lib/db`).
2. Si chat avec `WELCOME_CONV.id` existe en table `chats` :
   - Wipe tous les `messages` liés à ce chat (cascade ou DELETE explicit).
3. Sinon :
   - INSERT row dans `chats` avec `id = WELCOME_CONV.id`, `title = WELCOME_CONV.title`.
4. INSERT le `openingMessage` comme premier (et seul) message dans `messages` avec `role = 'assistant'`.
5. UPDATE `chats.updated_at = now()`.
6. Print l'URL en console (relative + absolue si `BASE_URL` env var dispo) :
   ```
   ✓ Welcome conv seeded
     → /conv/<id>
     → https://klowi.dooloob.com/conv/<id>
   ```

Le même script sert à **seeder pour la 1ʳᵉ fois** et à **"vider"** après tests. Workflow PO :
1. Implementation faite.
2. `npm run seed-welcome` → URL printée.
3. PO teste sur `/conv/<id>`, échange avec la companion.
4. PO relance `npm run seed-welcome` pour wiper et restaurer l'état initial.
5. PO envoie l'URL à Chloë.

### Sidebar / visibilité

- La conv welcome apparaît dans la sidebar comme n'importe quelle autre conv.
- Groupement temporel selon `updated_at` (en haut au moment du seed, puis selon l'activité).
- Pas de pinning ni traitement spécial. Si Chloë veut la renommer ou supprimer, elle peut (UX chat normal).

---

## 4. Animation du message d'ouverture

### Détection

À chaque mount de `<Chat>` avec un `initialChatId`, regarder l'historique chargé.

**Critère pour animer** :
```ts
messages.length === 1 && messages[0].role === "assistant"
```

C'est suffisant : un chat normal commence toujours par un user message. Un chat avec un seul message assistant en première position est par construction une conv seedée fraîche. Pas besoin de gating sur l'ID — comportement émergent.

### Composant

Nouveau composant `<TypewriterMessage>` dans `app/components/`. Wrapping ou réutilisation de `<MessageBubble>` pour le rendu final markdown (à décider en impl). Composant séparé plutôt que mode dans `<MessageBubble>` pour isoler la logique d'animation et garder `<MessageBubble>` simple.

**Animation** :
- **Char par char** (pas token par token). On a un texte fixe, pas de streaming réel — char-by-char donne une animation prévisible et fluide.
- Subtilité markdown : pendant l'animation, soit on rend en plain text puis on swap vers markdown à la fin, soit on rend le markdown final et on révèle progressivement via mask/clip CSS. Choix tactique en impl — le 2e est plus joli mais plus complexe. Démarrer simple (plain text → markdown swap) si suffisant.
- Vitesse : ~25-35 ms/char à calibrer en live.
- Pendant l'animation, l'input reste **enabled** (Chloë peut couper et écrire si elle veut).
- Pas de loader / dots préalable — on commence direct le typewriter.

### Re-stream tant qu'elle n'a pas répondu

- Tant que `messages.length === 1 && messages[0].role === "assistant"`, l'animation rejoue à chaque mount/refresh de la page.
- Dès qu'un user message existe en DB (`messages.length >= 2`), render statique normal — plus d'animation.
- **Pas de localStorage flag.** Source de vérité = state DB. Bonus : cross-device / cross-browser cohérent.

### Cas limite assumé

Si Chloë ouvre la page, voit le stream, attend, refresh sans rien taper → l'animation rejoue. Acceptable et même cohérent avec "tant qu'elle n'a rien dit, l'ouverture est encore en cours d'arrivée". Si plus tard on observe que ça gêne, on ajoute un localStorage flag — mais on commence simple.

---

## 5. Phase 2 (out of scope cette spec)

Une fois l'archi en place et testable :

1. **Rédaction du message d'ouverture** : co-rédaction PO + assistant, calibrée sur le brief `brief_message_accueil_chloe_compagnon_de_preparation.md`. Itérations sur ton, structure (entrée / repositionnement / paysage d'usages / amorçage / questions finales), longueur, registre.
2. **Rework system prompt** : intégration de la posture "compagnon / espace de rebond / ne fait pas le travail à sa place" au-delà du cleanup bootstrap. Diff précis sur les fichiers de prompt après lecture.

Ces deux chantiers seront traités dans une session dédiée, à tête reposée, après validation que la mécanique tient.

---

## Workflow d'implémentation suggéré

Plan détaillé à produire dans la skill `writing-plans`. Grandes étapes :

1. **Cleanup bootstrap** — supprimer fichiers, retirer markers du route handler, nettoyer Chat.tsx, retirer mentions bootstrap des fichiers prompt (cleanup minimal). Vérifier qu'aucun import cassé. Build doit passer.
2. **Refacto routage** — créer `app/conv/[id]/page.tsx`, adapter `app/Chat.tsx` pour accepter props et utiliser `next/navigation`, adapter `app/page.tsx`. Tester naviguer entre convs, créer une nouvelle, reload sur `/conv/[id]`, 404 sur id inconnu.
3. **Mécanisme seeded** — créer `lib/seeded-convs.ts`, écrire `scripts/seed-welcome-conv.ts`, ajouter le script dans `package.json`. Tester seed → URL → ouverture page.
4. **Animation typewriter** — composant ou mode dans `<MessageBubble>`, gating via `messages.length === 1 && role === assistant`. Calibrer vitesse.
5. **Test bout en bout** — `npm run seed-welcome`, ouvrir l'URL, voir le placeholder s'animer, répondre, vérifier que l'animation cesse, vérifier que la conv existe normalement dans la sidebar et se comporte comme les autres.
6. **Deploy + commit** — push sur main, vérifier prod.

Phase 2 (séparée) :
7. Rédaction du message réel.
8. Rework system prompt.
9. Re-seed prod, envoi à Chloë.

---

## Risques / points d'attention

- **Refacto routage = risque de régression** sur la navigation existante. Tester chaque chemin (sidebar click, new chat, reload, deep-link).
- **Server component rendering** : le rendu serveur de l'historique nécessite que les queries DB tournent en server context. À vérifier que `lib/db/queries` est server-only compatible (probablement déjà le cas).
- **Animation timing** : trop lent = agaçant, trop rapide = pas perceptible. Calibrer en live. Probable 25 ms/char comme point de départ.
- **Seed idempotent** : bien tester que relancer le script ne casse rien et restaure l'état initial proprement.
- **Cleanup système prompt** : risque de retirer trop ou trop peu. Lire les fichiers ligne par ligne au moment du cleanup, expliciter chaque retrait dans le diff PR.
