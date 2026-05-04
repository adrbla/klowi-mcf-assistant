# Design — Upload de documents (.md, .txt, .pdf)

**Date**: 2026-05-04
**Auteur**: Adrien B. (PO) + Claude (assistant)
**Statut**: Spec validée, prête pour plan d'implémentation

---

## Contexte

Chloë travaille sur ses discours liminaires, ses dossiers stratégiques, des fiches d'audition. Pour les partager avec la companion, elle doit aujourd'hui copier-coller le contenu dans le chat. Pour des documents longs (un discours liminaire complet, une fiche de plusieurs pages), c'est friction et ça dégrade l'expérience.

Objectif : permettre l'upload de fichiers via la barre d'input, supportés et lus par la companion, accessibles pour le reste de la conversation.

## Périmètre

**In scope** :
1. UI : bouton paperclip dans la barre d'input du chat, file picker filtré sur `.md` `.txt` `.pdf`.
2. Pipeline d'upload : endpoint `/api/upload`, stockage Vercel Blob, validation côté serveur.
3. Intégration API Anthropic : PDF en `document` content block (support natif, pages reconnues), `.md`/`.txt` en texte inline préfixé.
4. Persistance par message : nouvelle colonne `attachments JSONB` sur `messages`, ré-injection dans l'historique au rebuild de chaque tour.
5. Cache prompt Anthropic pour ne pas re-payer les tokens du document à chaque tour.
6. Awareness côté system prompt : la companion sait que la feature existe, peut la suggérer si pertinent.

**Out of scope (v1)** :
- Drag-and-drop (juste click → file picker).
- Multi-attachment par message (le schema JSONB le supporterait, l'UI ne le fera pas v1).
- Viewer PDF inline dans la conv UI (juste un chip avec le nom du fichier).
- Conversion automatique `.docx`/`.pptx` → `.md` (rejet poli avec instruction).
- Sweep automatique des orphan blobs.
- Recherche / search dans les documents uploadés.

---

## 1. UI

### Bouton paperclip

Icône paperclip dans la barre d'input du chat, à gauche du champ texte (avant l'input). Click → ouvre le file picker système avec `accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"`.

### Chip d'attachment

Une fois un fichier sélectionné, avant l'envoi, un chip s'affiche au-dessus (ou intégré à) la barre d'input :

```
📎 mon-discours.pdf · 234 KB · ✕
```

Le ✕ retire l'attachement (rien n'est envoyé au serveur tant qu'elle n'a pas cliqué Send).

### Validation

**Côté client (avant upload)** :
- Extension : doit être `.pdf` / `.md` / `.txt`.
- Taille : ≤ 10 MB.
- Si invalide : message inline rouge sous l'input, *« Je lis les .md, .txt et .pdf pour l'instant. Si tu as un .docx ou autre, convertis en markdown ou en PDF — markdown préféré. »* ou pour la taille, *« Le fichier fait XX MB, je suis capée à 10 MB. »*.

**Côté serveur (`/api/upload`)** :
- Re-valide MIME type + extension + taille (filet de sécurité — le `accept` du file picker n'est qu'un hint).
- En cas d'erreur, renvoie un JSON `{ error: "..." }` avec le code HTTP approprié (400, 413).

### Pendant l'upload

Indicateur de progression discret (barre fine en bas du chip, ou un état "envoi en cours…"). Le bouton Send est désactivé tant que l'upload n'a pas retourné un `attachment_id`.

### Bulle user après envoi

Sous (ou au-dessus de) le texte de Chloë, le même chip non-cliquable :

```
📎 mon-discours.pdf
```

Pas de viewer inline, pas de download (au moins pour la v1).

### Drag-and-drop

**Pas implémenté en v1**. Si elle drop un fichier sur la barre d'input, l'événement default browser le télécharge ou navigue. Acceptable.

---

## 2. Storage et Pipeline

### Endpoint `/api/upload`

**Method** : `POST`
**Body** : `multipart/form-data` avec un champ `file` (le fichier).
**Headers** : cookies d'auth (middleware déjà gate la route).

**Comportement** :
1. Vérifie auth (middleware).
2. Lit le fichier depuis le multipart.
3. Valide :
   - MIME type / extension dans la whitelist.
   - Taille ≤ 10 MB.
4. Génère `attachment_id = crypto.randomUUID()`.
5. Upload vers Vercel Blob avec le path `attachments/<attachment_id>.<ext>`.
   - Note : pas de `<chatId>` dans le path car au moment de l'upload, on ne sait pas encore quel chat ça va atterrir (le message n'est envoyé qu'après). Le mapping `attachment → message → chat` se fait au moment du POST `/api/chat`.
6. Retourne `{ id, name, sizeBytes, mediaType, blobPath }`.

### Schema DB

Nouvelle colonne `attachments` sur la table `messages` :

```ts
attachments: jsonb("attachments").$type<MessageAttachment[]>(),
```

Type :
```ts
type MessageAttachment = {
  id: string;          // UUID retourné par /api/upload
  name: string;        // filename original
  mediaType: string;   // "application/pdf" | "text/markdown" | "text/plain"
  sizeBytes: number;
  blobPath: string;    // "attachments/<id>.<ext>"
};
```

Migration : `drizzle-kit push` ajoute la colonne, nullable. Pas de migration des anciens messages.

### Pipeline d'envoi

Le client envoie POST `/api/chat` avec un body étendu :

```ts
{
  chatId: string | undefined,
  message: string,
  attachmentIds: string[],  // optionnel, vide par défaut
}
```

Le route handler :
1. Reçoit `attachmentIds` (déjà uploadés en Blob).
2. Reconstruit la metadata des attachments (nom, mediaType, etc.). En v1, le client renvoie directement l'objet metadata complet pour simplifier — pas besoin de re-lookup.
3. Persiste le user message en DB avec `attachments` rempli.
4. Construit le `content` du user message comme un **array de content blocks** :

```ts
const userContent: Anthropic.ContentBlockParam[] = [];

// PDFs : document blocks (Claude lit nativement)
for (const att of pdfAttachments) {
  const bytes = await fetchBlobAsBase64(att.blobPath);
  userContent.push({
    type: "document",
    source: {
      type: "base64",
      media_type: "application/pdf",
      data: bytes,
    },
  });
}

// .md / .txt : texte inline préfixé
for (const att of textAttachments) {
  const text = await fetchBlobAsText(att.blobPath);
  userContent.push({
    type: "text",
    text: `[Document attaché: ${att.name}]\n\n${text}`,
  });
}

// Le texte qu'elle a tapé en dernier
userContent.push({ type: "text", text: userMessage });
```

5. Au rebuild de l'historique pour les tours suivants, on lit `messages.attachments` de chaque message et on reconstruit le même content array. La companion *voit toujours* les documents partagés précédemment.

### Persistance du content

Pour minimiser le re-fetch Blob à chaque tour, on a deux options :

**Option A** : Re-fetch les bytes depuis Blob à chaque rebuild d'historique.
- Pros : Blob = source of truth, simple.
- Cons : N appels Blob par tour (N = nombre d'attachments dans la conv). Latence supplémentaire ~100-500ms par fetch.

**Option B** : Stocker le contenu directement dans `messages.blocks` (JSONB existant) au moment de la première persistance, en base64 pour PDF / texte brut pour MD/TXT.
- Pros : Rebuild en mémoire, pas de fetch.
- Cons : Rows lourdes si gros PDFs, redondance avec Blob.

**Recommandation** : Option A en v1 pour la simplicité. Si la latence d'un tour devient gênante (>2s additionnels), on bascule vers B ou un cache mémoire en local au server (similaire au cache de 5 min déjà présent dans `lib/system-prompt.ts`).

### Anthropic prompt caching

Pour éviter de re-payer les tokens du PDF à chaque tour :
- On marque le **dernier user message contenant un document** avec `cache_control: { type: "ephemeral" }` sur l'un de ses content blocks.
- Anthropic cache tout ce qui précède ce point (system prompt + early conv history). Les tours suivants ré-utilisent le cache.

L'API Anthropic supporte jusqu'à 4 cache breakpoints. Le code actuel utilise déjà 1 (sur le system prompt). On en ajoute 1 supplémentaire sur le dernier message-avec-doc s'il existe.

---

## 3. Erreurs / cas limites

### Upload

| Cas | Comportement |
|---|---|
| Réseau/timeout côté client | Chip retiré, message inline *« L'upload a échoué. Tu peux réessayer. »* |
| Taille > 10 MB (client) | Pré-validé avant upload, message *« Le fichier fait XX MB, je suis capée à 10 MB. »* |
| Taille > 10 MB (serveur, double check) | 413, frontend affiche le même message |
| Extension invalide | Client + serveur, message *« Je lis les .md, .txt et .pdf pour l'instant... »* |
| Vercel Blob 5xx | 500 → frontend re-essai possible |

### Rebuild historique

| Cas | Comportement |
|---|---|
| Blob renvoie 4xx/5xx pour un attachment passé | Skip ce content block, log server-side, le tour continue sans cet attachement |
| Attachment metadata corrompue (parse JSON fail) | Skip, log |
| Anthropic rejette le payload (PDF malformé) | Le route handler catch, renvoie l'erreur stream comme d'habitude |

### Orphan blobs

Pas de cleanup automatique en v1. Acceptable pour single-user. Path namespace `attachments/<id>.<ext>` permet un audit/sweep manuel plus tard si nécessaire.

### Backward compat

Les messages antérieurs à l'ajout de la colonne ont `attachments = NULL`. Le rebuild check `if (m.attachments?.length)` avant d'ajouter des content blocks. Pas de migration de données.

---

## 4. System prompt — awareness

Ajouter une section `## Outils` (ou compléter celle existante) dans `10-posture.md` avec :

```markdown
- **Upload de documents.** Chloë peut joindre un `.md`, `.txt` ou `.pdf` à un message via le paperclip de la barre d'envoi (les PDF sont lus avec leur structure de pages — tu peux référencer "page 3", etc., si ça aide). Si elle colle un long passage qu'il serait plus pratique d'avoir en fichier, ou si elle évoque un document qu'elle a sous la main, tu peux le suggérer — sobrement, pas un réflexe à chaque tour.
```

Pas de changement structurel ailleurs. Le principe "ne produit pas à sa place" couvre déjà le cas "elle upload son draft, tu ne le réécris pas".

---

## 5. Sécurité

- Auth : middleware existant gate `/api/upload` automatiquement.
- File type : validé deux fois (client + serveur).
- Size cap : 10 MB pour éviter abuse + rester dans les limites Anthropic (32 MB max par PDF).
- Blob path : namespacé pour éviter collisions et permettre cleanup ciblé.
- Pas d'exécution de contenu uploadé (PDF passé tel quel à Anthropic, MD/TXT lu en texte). Pas de surface XSS / injection.

---

## 6. Décisions tactiques laissées pour l'impl

- Forme exacte du chip d'attachement (visual design).
- Position du paperclip (gauche / droite, séparé / intégré).
- Animation pendant l'upload (spinner, barre de progression, etc.).
- Le client renvoie la metadata complète au POST `/api/chat`, ou ré-fetch côté serveur depuis un cache temporaire.
- Le re-fetch Blob est avec ou sans cache mémoire local (5 min comme le system prompt) — à décider à l'impl si la latence se fait sentir.

---

## Workflow d'implémentation suggéré

Plan détaillé à produire dans la skill `writing-plans`. Grandes étapes :

1. **DB migration** — ajout colonne `attachments JSONB` sur `messages` via Drizzle.
2. **Endpoint `/api/upload`** — multipart, validation, Vercel Blob upload, retour metadata.
3. **UI — paperclip + chip** — composant React, file picker, état d'upload, display dans la bubble.
4. **POST `/api/chat` étendu** — body inclut attachmentIds, persiste avec attachments, construit le content array Anthropic, ajoute cache_control.
5. **Rebuild historique** — au tour suivant, lecture de `attachments` de chaque message, reconstruction du content array, re-fetch Blob.
6. **System prompt** — ajout du paragraphe dans `10-posture.md`.
7. **Smoke test** — upload PDF, MD, TXT ; envoi ; ré-référencement au tour suivant ; cas d'erreur (>10 MB, mauvais format) ; cas où la companion référence "page 3".
8. **Deploy + commit** — push, vérifier prod.

---

## Risques / points d'attention

- **Latence du rebuild d'historique** avec re-fetch Blob — à mesurer. Si gênant, cache mémoire ou Option B.
- **Token cost** — un PDF de 10 pages = ~3-5K tokens, multipliés par le nombre de tours. Le cache prompt mitige fortement à partir du tour 3+.
- **Comportement de la companion sur un upload** — observer en live. Risque de sur-référencer le document, ou au contraire de l'ignorer. À calibrer dans le prompt si nécessaire.
- **Cleanup des Blobs orphelins** — accepté en v1, sweep manuel possible. À automatiser si l'app grandit.
