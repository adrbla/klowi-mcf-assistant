# `context/prompt/` — System prompt fragments (committed)

Files in this directory are concatenated server-side (in **numeric-prefix order**) to build the coach's system prompt. They are committed to Git and visible in the repo.

The **private** counterpart lives in `mcf/AUDITIONS (!!)/_prep/` (symlink to Google Drive, gitignored). The assembly logic in `lib/system-prompt.ts` reads both and joins them.

## Naming convention

```
00-identity.md     ← bootstrap : nom à choisir, intro, premier échange. Sera FIGÉ
                     (édité hors-conv) une fois le bootstrap terminé.
10-posture.md      ← posture stable : ton, modes, exigence, dimension psy, langue.
                     Ne change pas au cours d'une prep.
20-chloe-profile.md ← CV analytique, parcours, points sensibles (public-grade).
30-auditions.md    ← Grenoble + Strasbourg : formats, COS factuel, maquettes.
40-strategy.md     ← grandes lignes stratégiques publiables.
```

What stays in `_prep/` (private):
- Concurrent analysis with names
- COS member tactical reads
- Drafts of liminary speeches
- Intimate prep notes

## Convention de découpage

> *Si Chloë le mettrait sur LinkedIn ou son site perso → ici. Si elle le dirait à toi en off → `_prep/`.*
