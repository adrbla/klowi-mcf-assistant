# Brief UI — Klowi (à coller dans Claude.ai)

> Prompt à coller tel quel dans Claude.ai (avec la skill `frontend-design` activée si dispo). Demande explicitement 4 directions visuelles **avant** de coder, pour casser le style par défaut "cream + serif + terracotta" qu'Opus 4.7 produit en l'absence de cadre. Tu reviens ici avec la direction choisie + les composants générés ; je les intègre.

---

Tu vas concevoir l'UI de **Klowi** — une web app privée, mono-utilisatrice, qui offre à Chloë (universitaire francophone) une présence accompagnante pendant qu'elle prépare ses auditions de Maître de Conférences sur 13 jours.

## Le projet en 30 secondes

Une seule personne l'utilise. Un chat texte, en français. Un message → une réponse markdown qui se déroule en streaming. Multi-tours, multi-conversations (Chloë organise sa prep en plusieurs sessions parallèles : une pour Grenoble, une pour Strasbourg, une pour le drill, etc.). Pas de dashboard, pas de tabs, pas d'analytics. C'est un objet hand-built pour une personne, pas un produit SaaS.

## Personnalité (= la marque, à incarner dans chaque détail)

- **Pas un coach.** Pas un tuteur. Pas un chatbot. Une *présence*. Plus proche d'une amie qui connaît le métier que d'un service.
- **Horizontale, jamais en surplomb.** Aucun motivational quote, aucune barre de progression, aucune énergie "let's crush this".
- **Chaude + claire + sobre.** Jamais surjoué, jamais familiarité forcée.
- **Autorité tranquille.** Confiante sans être assertive, calme sous pression.
- **Français par défaut** (UI en FR ; switch EN possible côté contenu).
- L'utilisatrice s'appelle Chloë. La marque s'appelle **Klowi MCF**. C'est le nom complet — pas de descripteur en plus type "MCF Coach", "préparation auditions", "votre coach IA". Tu peux jouer avec la composition typo entre "Klowi" et "MCF" (poids différents, tracking, secondaire, etc.) si ça sert la direction.

## Surfaces à designer (toutes nécessaires)

1. **Login** — passcode unique. Une input, un bouton, un titre. ~5 éléments visuels max.
2. **Empty state** — header + input + un message discret pour amorcer.
3. **Conversation active** — liste de messages (alignement utilisateur vs assistante à ton choix), markdown rendu pour les réponses, **état de streaming** quand la réponse se déroule (le bubble grandit token par token, l'input est disabled pendant ce temps — donne ça une présence visuelle calme).
4. **Header** — brand mark + affordance discrète "nouvelle conversation" + **affordance de thème** (cf. ci-dessous).
5. **Theme picker** — popover ouvert depuis le header. Liste des 5 thèmes (swatches visuels) + toggle mode (auto / light / dark). Persistance via localStorage gérée par `next-themes` (j'intègre côté code, pas ton souci).

## Contraintes techniques (le code doit pouvoir drop dans le repo existant)

- **Next.js 16 App Router** + **React 19** + **Tailwind v4** (avec `@theme inline` et CSS variables).
- Geist Sans / Geist Mono sont chargées via `next/font/google` mais **swappables** — choisis ce qui sert la marque, indique-moi les fonts à charger.
- Markdown via **`react-markdown` + `remark-gfm`** déjà câblés. Style les éléments markdown via la prop `components` (h1/p/ul/li/code/blockquote/a). Pas besoin de `@tailwindcss/typography`.
- Pas de shadcn/ui pour l'instant — tu peux recommander d'initier shadcn pour un primitive précis, mais signale-le.
- TypeScript strict.
- N'ajoute aucune nouvelle dépendance sans le flagger explicitement.

## Intention de design

- **Calme éditorial**, mais sans cliché éditorial (cf. anti-patterns).
- Whitespace généreux. Hiérarchie typo discrète mais nette.
- Doit *sentir* qu'il a été fait pour une personne, pas pour mille.
- Dark mode supporté mais pas la mood par défaut — palette diurne d'abord.
- Micro-interactions subtiles (focus, hover, transition pendant le streaming) — pas de cascades d'animations.

## Anti-patterns à éviter (durs)

- ❌ Esthétique générique "AI chat" : avatars stylisés, "thinking…" avec trois points, emojis intro (👋), bulles corporate gris-bleu façon ChatGPT/Claude.
- ❌ Gradients violet/purple/indigo. Ni dans la marque, ni en accent.
- ❌ **Style maison "cream/off-white + serif (Georgia/Fraunces/Playfair) + terracotta"** — c'est le default éditorial d'Opus 4.7, ça lit "blog hospitality", ça ne va pas pour Klowi. Pars sur autre chose.
- ❌ Dark mode + accents néons (vert acide, magenta).
- ❌ Familles de fonts qui sentent le système : Inter, Roboto, Arial, plain `system-ui`. Choisis quelque chose avec du caractère.
- ❌ Vocabulaire coach-y nulle part : pas de "préparons-nous", pas d'icône fusée, pas de streaks, pas de badges, pas de niveau XP.
- ❌ Footer encombré, copyright, mentions techniques. Le pied de page n'existe pas.

## 5 thèmes à livrer (tous, ensemble — l'utilisatrice choisira en runtime)

Différence majeure avec un brief design classique : on **n'élit pas un seul thème**, on en livre **5 distincts** qui shippent tous dans l'app, et l'utilisatrice switch via le theme picker.

Couvre un spectre large — de l'austère au chaleureux. Catégories indicatives (libre à toi d'affiner les noms exacts) :

1. **Sérieux** — institutionnel, restreint, presque protocolaire. Pour les jours où elle veut juste bosser.
2. **Académique** — papier chaud, encre, séminaire. Sans tomber dans le cliché humanités-cream-serif (cf. anti-patterns).
3. **Neutre** — greyscale propre, accent minimal. La direction "Linear / Notion sober".
4. **Girly rose** — soft pink, peach, rose poudré. Doit rester sobre dans la mise en forme — pas Instagram, pas wellness app.
5. **Ta surprise** — la 5e est ta carte blanche, à condition qu'elle soit clairement distincte des 4 autres et qu'elle ait un caractère affirmé.

Pour **chaque** thème, livre :
- **Mode light** : background, surface, foreground, text-secondary, accent, border, focus-ring.
- **Mode dark** : les mêmes 7 tokens, ré-équilibrés.
- **Typo** : si la typo varie selon le thème (par ex. sérieux = sans grotesque, académique = serif), précise-le. Sinon, une typo cohérente sur les 5 est OK.
- **Feeling** (1 phrase) — l'ambiance de la direction.
- **Référence** (optionnel, 1 ligne) — designer, période, publication.

## Process — fais ça AVANT d'écrire la moindre ligne de code

1. Présente d'abord **les 5 thèmes en texte structuré** (palettes hex + typo + feeling). Aucune image générée.
2. J'arbitre s'il y a quelque chose qui cloche. Sinon je dis "go" et tu implémentes les 5.
3. Tu implémentes ensuite tout : composants React + `globals.css` avec les 10 jeux de variables.

## Format de livraison (une fois les 5 thèmes validés)

Code drop-in pour ces fichiers exacts :

```
app/
  globals.css          ← surcharge complète : tokens de base + 5 × 2 = 10 jeux de variables
  layout.tsx           ← font wiring + métadonnées
  Chat.tsx             ← UI chat (client component, déjà existant — réécris-le entier)
  login/page.tsx       ← page login
  components/
    Brand.tsx          ← brand mark "Klowi MCF" réutilisable (header + login)
    ThemePicker.tsx    ← popover : 5 swatches + toggle light/dark (utilise useTheme de next-themes)
    MessageBubble.tsx  ← (ou inline dans Chat.tsx si plus simple)
    StreamingDots.tsx  ← indicateur visuel pendant le streaming
```

Convention pour les variables CSS (à respecter pour que `next-themes` plumb proprement) :

```css
/* dans globals.css */

:root {
  /* tokens partagés / fallback (= thème "neutre" mode light) */
  --color-bg: ...;
  --color-surface: ...;
  --color-fg: ...;
  --color-fg-muted: ...;
  --color-accent: ...;
  --color-border: ...;
  --color-focus: ...;
}

.theme-serieux { /* light */ ... }
.theme-serieux.dark { /* dark */ ... }

.theme-academique { ... }
.theme-academique.dark { ... }

.theme-neutre { ... }
.theme-neutre.dark { ... }

.theme-rose { ... }
.theme-rose.dark { ... }

.theme-{ta-surprise} { ... }
.theme-{ta-surprise}.dark { ... }

@theme inline {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-fg);
  /* etc. — fait remonter les CSS vars vers les utilities Tailwind */
}
```

Pour le théming côté layout : j'ai un provider custom (`app/theme-provider.tsx`) qui gère deux axes indépendants — le **thème** (5 options) et le **mode** (`light` / `dark` / `auto`). Il pose les classes `theme-X` et `dark` sur `<html>` exactement selon la convention CSS ci-dessus. Ton `ThemePicker.tsx` importe `useTheme()` depuis `@/app/theme-provider` et reçoit :

```ts
type ThemeContextValue = {
  theme: ThemeName;          // "theme-serieux" | "theme-academique" | …
  setTheme: (t: ThemeName) => void;
  mode: "light" | "dark" | "auto";
  setMode: (m: "light" | "dark" | "auto") => void;
  resolvedMode: "light" | "dark";  // = ce qui est affiché actuellement
};
```

Côté markup tu peux assumer que `<html>` a déjà `class="theme-X [dark]"` quand le composant rend (un script inline dans le `<head>` empêche tout flash sur navigation).

Garde la logique métier intacte de `app/Chat.tsx` actuel (state management, fetch streaming, localStorage chatId, gestion d'erreur). Tu ne touches qu'à la couche visuelle. Je te colle le fichier actuel à la fin de ce brief si tu veux le voir.

Pour les fonts : indique les imports `next/font/google` (ou bunny.net si Google n'a pas la font). Une font globale ou des fonts par thème — à toi.

## Tu peux ajouter

- Composants helpers (`MessageBubble`, `StreamingDots`, `Brand`, etc.) dans `app/` ou `components/` — découpe propre.
- Recommandations sur la favicon / icon (concept seulement, pas de SVG à générer).

## Anti-AI-slop reminder (à intégrer en fin de génération)

> Évite les esthétiques génériques générées par IA : familles de fonts surutilisées (Inter, Roboto, Arial, system fonts), schémas de couleurs clichés (notamment gradients violet sur fond blanc ou sombre), layouts et composants prévisibles, design cookie-cutter qui manque de caractère contextuel. Utilise des fonts uniques, des couleurs et thèmes cohérents, et des animations pour les effets et micro-interactions.

---

**Effort recommandé pour la génération** : `xhigh` (Opus 4.7).

**Brand-mark** : `Klowi MCF` — c'est tout. Pas de tagline, pas de descripteur additionnel. La page sait ce qu'elle est.

---

# Followup — à envoyer après la passe themes/inspiration

> À coller dans la même conversation Claude.ai, **après** que les 5 thèmes ont été proposés et discutés. Remplir le bloc `[NOTES SUR LES THÈMES]` avant d'envoyer.

---

Bien reçu pour les 5 thèmes. Voici mon arbitrage :

[NOTES SUR LES THÈMES — affiner / valider / ajuster ici. Par exemple : « le sérieux est trop sombre, descends d'un cran », « remplace le rose par X », « garde tel hex pour l'accent du neutre », ou simplement « OK les 5, go ».]

Maintenant, **on passe à l'implémentation complète**. Quelques précisions et un ajout important avant que tu codes.

## Ajout : la sidebar (oubli du brief initial)

Klowi MCF est multi-conversations — Chloë organise sa prep en sessions parallèles (une pour Grenoble, une pour Strasbourg, une pour drill, etc.). Il faut donc une **barre latérale collapsible**.

### Spec sidebar

- **Position** : à gauche, sur toute la hauteur. Le chat est dans le panel droit.
- **État collapsible** :
  - **Étendue** : largeur ~260-300px. Brand mark `Klowi MCF` en haut, bouton `+ Nouvelle conversation`, liste des chats, theme picker en bas.
  - **Réduite** : largeur ~48-56px (ou cachée totalement, à toi). Juste un bouton pour rouvrir + éventuellement le bouton « + » en mini.
  - Toggle via un bouton dans le header de la sidebar (ou en pliure entre sidebar et main). État persisté en localStorage côté code (clé `klowi-sidebar-collapsed`).
- **Liste des chats** :
  - Titre (auto-dérivé du premier message — déjà géré côté code, max 60 chars).
  - Temps relatif discret (`il y a 2h`, `hier`, `12 mars`).
  - Active chat : surligné (background différent, accent côté du bord).
  - Survol : affordance discrète pour renommer / supprimer (3-dot menu, ou apparition au hover — à toi).
  - **Empty state** quand aucun chat : un mot doux, juste de quoi inviter à démarrer.
- **Mobile** : la sidebar devient un drawer overlay qui slide depuis la gauche. Bouton hamburger dans un header simplifié.

Côté code, j'ajoute ces routes API (tu n'as pas à les implémenter, juste à les appeler depuis le client) :
- `GET /api/chats` → renvoie `[{ id, title, updatedAt }]`
- `PATCH /api/chats/[id]` body `{ title }` → rename
- `DELETE /api/chats/[id]` → delete avec cascade des messages

### Modèle de navigation

Reste **state-based** (pas d'URL par chat). Le `chatId` actif est en state React + localStorage. Click sur un chat dans la sidebar : `setChatId(...)` + fetch `/api/chat/history?chatId=...`. Pas de routing Next à toucher. Plus simple, marche bien pour un user unique.

## Surfaces complètes (récap final)

1. **Sidebar étendue** — brand + new chat + liste + theme picker.
2. **Sidebar réduite** — état rétracté.
3. **Login** — passcode.
4. **Empty state** (chat vide, pas de messages) — header minimal + input + un mot doux.
5. **Conversation active** — messages + input + état de streaming.
6. **Theme picker (popover)** — 5 swatches + toggle light/dark/auto.
7. **États mobile** des points 1-5 (drawer pour la sidebar, layouts adaptés).

## Format de livraison (mis à jour)

```
app/
  globals.css           ← tokens de base + 5 × 2 = 10 jeux de variables CSS
  layout.tsx            ← font wiring + métadonnées
                          (je wrappe avec ThemeProvider côté code, tu peux le mentionner)
  Chat.tsx              ← UI chat — réécriture complète, logique métier préservée
  login/page.tsx        ← page login
  components/
    Brand.tsx           ← brand mark « Klowi MCF » (header sidebar + login)
    Sidebar.tsx         ← sidebar collapsible avec liste de chats
    ChatListItem.tsx    ← item liste (titre + temps + actions au hover)
    ThemePicker.tsx     ← popover : 5 swatches + toggle light/dark/auto
                          (importe `useTheme` depuis `@/app/theme-provider`)
    MessageBubble.tsx   ← bulle de message (user vs assistant)
    StreamingDots.tsx   ← indicateur visuel pendant le streaming
```

## Logique métier de Chat.tsx à préserver

Le fichier actuel fait :
- State : `chatId`, `messages`, `input`, `isStreaming`, `hydrated`.
- Au mount : lit `localStorage["klowi.chatId"]` → fetch `/api/chat/history?chatId=...` → hydrate `messages`.
- Submit : POST `/api/chat` avec `{ chatId, message }`, lit `X-Chat-Id` du header de réponse, stream le body avec `getReader()` + `TextDecoder`, append les chunks au dernier message assistant.
- Bouton « Nouvelle conversation » : clear localStorage + state.

Avec la sidebar, ajoute :
- Au mount, fetch aussi `GET /api/chats` → met dans state `chats`.
- Sidebar reçoit `chats`, `activeChatId`, `onSelectChat(id)`, `onNewChat()`, `onRenameChat(id, title)`, `onDeleteChat(id)` en props.
- Sélectionner un chat : appelle `onSelectChat(id)` → setState `chatId` + fetch history pour cet id → update localStorage.
- Renommer/supprimer : appelle l'API + refresh la liste.

Tu peux factoriser le state en hook custom (`useChatSession`) si ça allège.

## Anti-AI-slop reminder (à intégrer en fin de génération, à nouveau)

> Évite les esthétiques génériques générées par IA : familles de fonts surutilisées (Inter, Roboto, Arial, system fonts), schémas de couleurs clichés (notamment gradients violet sur fond blanc ou sombre), layouts et composants prévisibles, design cookie-cutter qui manque de caractère contextuel. La sidebar en particulier ne doit PAS ressembler à ChatGPT ou Claude.ai — trouve un parti pris.

## Ce que tu me rends

- Tous les fichiers ci-dessus, complets et drop-in.
- Une note rapide en fin de réponse sur :
  - Les fonts à charger (`next/font/google` import à mettre dans `layout.tsx`).
  - Toute dépendance que je dois ajouter côté code (au-delà de `next-themes`, que je gère).
  - Toute hypothèse que tu as faite et que je devrais valider.

Effort : `xhigh`. Pas de placeholder, pas de « TODO » — c'est la version finale.
