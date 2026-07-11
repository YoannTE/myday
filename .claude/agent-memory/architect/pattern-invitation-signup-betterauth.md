---
name: pattern-invitation-signup-betterauth
description: Points durs récurrents du signup sur invitation Better-auth dans MyDay (Round 002) — consommation atomique, enums sans accent, bypass seed
metadata:
  type: feedback
---

Signup sur invitation via hook Better-auth `before`/`after` (remplace `disableSignUp`) dans MyDay. Pièges vérifiés sur le code Round 001 :

1. **Enums statut stockés SANS accent** : `invitations.statut` = `'envoyee'`/`'acceptee'` (CHECK dans `src/lib/db/schema/systeme.ts`). Toute comparaison `WHERE statut='envoyée'` (accentué) matche 0 ligne. Les valeurs métier françaises du projet sont désaccentuées en BDD (`a_faire`, etc.). Vérifier chaque littéral SQL contre le CHECK réel.
2. **Consommation du jeton = atomique et dans `before`**, pas dans `after`. `UPDATE ... WHERE statut='envoyee' RETURNING` avant création user, sinon 2 signups concurrents passent tous deux la validation `before` et créent 2 comptes (le hook `after` conditionnel n'empêche que le double-marquage, pas le double-compte).
3. **Bypass seed** : le seed admin (`MYDAY_SEED_CONTEXT="true"`, `isSeedContext` dans `src/lib/auth.ts`) appelle `signUpEmail` sans jeton. Le nouveau hook `before` DOIT court-circuiter si `isSeedContext`, sinon le seed casse.
4. **CHECK à étendre** : `révoquée`/`revoquee` (DELETE invitation) et colonnes `acceptedBy`/`acceptedAt` n'existent pas au Round 001 → migration obligatoire, sinon violation CHECK / colonne inconnue au runtime.
5. **`additionalFields` sensibles** (`active`, `role`) toujours `input: false` (pattern déjà posé sur `role`) — sinon le client peut se réactiver.
6. **Validité invitation = 1 seul helper** : hook signup + preview public + liste admin FastAPI dupliquent la logique « expirée/utilisée » → source de vérité unique côté TS partagée hook+preview. Voir [[pattern-enforcement-cloisonnement]].
