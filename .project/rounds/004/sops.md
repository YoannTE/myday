# SOPs pré-matchés — Round 004

> Fusion des SOPs pertinents pour ce round (CRUD tâches/notes/événements, formulaires, réponses API consommées par le frontend, écriture Google Agenda). Appliquer strictement avant d'écrire du code.

---

# SOP — Contrat de casse des réponses API (snake_case) entre FastAPI et le frontend

**ID** : general-api-response-casing-contract
**Catégorie** : General
**Difficulté** : intermediate
**Tags** : api-contract, snake-case, pydantic, typescript, dual-stack, serialization
**Créé le** : 2026-07-10
**Origine** : Round 003 (Connexion Google) — bug bloquant, 2 itérations QA

## Symptôme

Le frontend affiche des valeurs vides / des états par défaut permanents alors
que l'API renvoie bien les données : une carte reste « Pas encore synchronisé »,
une fraîcheur ne s'affiche jamais, une bannière conditionnelle ne se déclenche
jamais. Aucune erreur console, aucune 4xx/5xx — les champs lus valent juste
`undefined`.

## Cause racine

Désalignement de casse entre la réponse JSON de l'API et les accès côté
frontend. Dans ce projet dual-stack :

- **FastAPI / Pydantic** sérialise en **snake_case** (nom des attributs du
  modèle), SANS alias camelCase. `model_dump()` produit donc
  `calendar_synced_at`, `reauth_required`, `last_manual_sync_at`.
- **Le helper `src/lib/api.ts` (`apiCall`) ne transforme AUCUNE clé** : le JSON
  arrive tel quel dans le code TypeScript.
- Si le composant / l'interface TS lit `calendarSyncedAt` (camelCase par réflexe
  JS), la valeur est `undefined` en silence → l'UI retombe sur son état par défaut.

C'est un bug **silencieux** : ça compile (TS ne détecte rien si l'interface est
elle-même en camelCase), ça ne lève aucune exception au runtime.

## Convention du projet (source de vérité)

**Les réponses API sont en snake_case, de bout en bout.** Confirmé sur plusieurs
domaines : `last_connexion`, `invite_url` (admin R002), `calendar_synced_at`,
`gmail_synced_at`, `reauth_required` (Google R003).

- Côté FastAPI : modèles Pydantic en snake_case, PAS d'`alias`/`populate_by_name`
  camelCase. `model_dump()` sans `by_alias`.
- Côté frontend : les interfaces TS qui typent une réponse API DOIVENT être en
  snake_case, et le code les lit en snake_case.
- Le seul endroit où le camelCase est légitime : les **noms de propriétés Drizzle**
  dans `src/lib/db/schema/*.ts` (mappés explicitement vers des colonnes SQL
  snake_case via `timestamp("calendar_synced_at", ...)`). Ce n'est PAS une
  consommation de réponse API — ne pas confondre.

## Checklist anti-bug (à appliquer dès qu'on crée/consomme un endpoint)

1. Le modèle Pydantic de réponse est en snake_case, sans alias camelCase.
2. L'interface TypeScript qui type cette réponse est en snake_case, champ pour
   champ, identique au modèle Pydantic.
3. Aucun accès camelCase dans les composants qui lisent cette réponse.
   Vérification rapide :
   ```bash
   # Adapter les noms de champs au domaine. Attendu : 0 hit hors src/lib/db/schema/.
   grep -rnE "calendarSyncedAt|gmailSyncedAt|reauthRequired|lastManualSyncAt" src/ \
     | grep -v "src/lib/db/schema/"
   ```
4. `apiCall` (`src/lib/api.ts`) ne fait aucune conversion de casse — ne pas
   compter dessus pour « corriger » un camelCase côté composant.
5. Test de non-régression le plus simple : afficher la donnée réelle dans l'UI
   et vérifier visuellement qu'elle n'est pas à l'état par défaut (une valeur
   `undefined` passe tous les tests de compilation mais pas l'œil).

## Règle de décision

Si un jour on veut du camelCase côté frontend, on l'impose **d'un seul côté et
explicitement** (alias Pydantic `by_alias=True` OU couche de mapping dans
`apiCall`), jamais en laissant chaque composant deviner. Tant que la convention
projet est snake_case, on ne mélange pas.

---

---
id: frontend-third-party-error-i18n
category: frontend
tags: i18n, better-auth, error-handling, ux, francais, sdk-tiers
difficulty: intermediate
created_from: round 002 - bug MAJEUR sign-in-form.tsx (message Better-auth en anglais)
last_updated: 2026-07-10
version: 1.0.0
---

# Mapper les messages d'erreur par défaut des SDK/frameworks tiers vers le français

## Contexte

Stack dual-stack (FastAPI + Next.js + Postgres), auth via Better-auth. Le
round 002 a livré des hooks Better-auth déjà traduits en français, mais le
formulaire de connexion affichait tel quel le message d'erreur **par défaut**
du SDK (« Invalid email or password ») dès que l'erreur ne passait pas par un
hook custom. Le piège se reproduit avec n'importe quel SDK tiers (Stripe,
APIs Google/OAuth, providers d'email) : leurs messages par défaut sont
toujours en anglais et ne sont jamais traduits automatiquement par nos
wrappers custom.

---

## 1. Le piège : traduire NOS messages ne traduit pas CEUX du SDK

Un projet i18n-français a en général deux sources d'erreurs distinctes :

- les messages **que l'on écrit nous-mêmes** (hooks, validations zod/Pydantic) → déjà en français si on suit la règle orthographique
- les messages **générés par le SDK tiers lui-même** quand aucun hook custom
  n'intercepte le cas (ex. `signIn.email()` de Better-auth qui renvoie
  directement `error.message = "Invalid email or password"`)

Le second cas est invisible tant qu'on ne teste pas explicitement un scénario
d'échec (mauvais mot de passe, carte refusée, token OAuth invalide) en
observant le texte affiché à l'écran plutôt que juste le code HTTP/statut.

---

## 2. Pattern de correction : mapper par CODE, jamais par texte

Ne jamais faire de `if (error.message === "Invalid email or password")` : le
texte peut changer entre versions du SDK. Toujours mapper sur un identifiant
stable (`error.code`, `error.type`, code d'erreur documenté par le SDK), avec
un fallback regex uniquement si le SDK ne fournit aucun code exploitable.

```typescript
// src/components/auth/sign-in-form.tsx
import { AUTH_ERROR_MESSAGES_FR } from "@/lib/auth-errors";

async function handleSignIn(email: string, password: string) {
  const { error } = await authClient.signIn.email({ email, password });

  if (error) {
    const messageFr = mapAuthErrorToFrench(error);
    toast.error(messageFr);
    return;
  }
}
```

```typescript
// src/lib/auth-errors.ts
export const AUTH_ERROR_MESSAGES_FR: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  EMAIL_NOT_VERIFIED: "Merci de vérifier ton adresse email avant de te connecter.",
  USER_NOT_FOUND: "Aucun compte ne correspond à cet email.",
  RATE_LIMITED: "Trop de tentatives, réessaie dans quelques instants.",
};

const FALLBACK_PATTERNS: Array<[RegExp, string]> = [
  [/invalid email or password/i, "Email ou mot de passe incorrect."],
  [/rate limit/i, "Trop de tentatives, réessaie dans quelques instants."],
];

export function mapAuthErrorToFrench(error: { code?: string; message?: string }): string {
  if (error.code && AUTH_ERROR_MESSAGES_FR[error.code]) {
    return AUTH_ERROR_MESSAGES_FR[error.code];
  }

  const rawMessage = error.message ?? "";
  for (const [pattern, messageFr] of FALLBACK_PATTERNS) {
    if (pattern.test(rawMessage)) {
      return messageFr;
    }
  }

  return "Une erreur est survenue. Réessaie ou contacte le support.";
}
```

---

## 3. Où appliquer ce pattern dans le starterkit

| SDK tiers concerné                     | Fichier typique à vérifier                          |
| --------------------------------------- | ----------------------------------------------------- |
| Better-auth (sign-in, sign-up, reset)   | `src/components/auth/*-form.tsx`                      |
| Stripe (paiement, webhook côté client)  | Composants de checkout, page « Erreur de paiement »   |
| OAuth (Google, GitHub via Better-auth)  | Callback OAuth, message d'échec de connexion sociale  |
| Upload S3/MinIO (erreurs SDK AWS)       | Composants d'upload, messages de type `AccessDenied`  |

Le réflexe : dès qu'un composant appelle directement une méthode d'un SDK
tiers et affiche `error.message` sans passer par un mapper français, c'est un
candidat à corriger.

---

## 4. Tester explicitement le cas d'erreur en français

Un test QA qui vérifie uniquement le statut HTTP (401, 400) ou la présence
d'un toast **quelconque** ne détecte pas ce bug. Le test doit lire le texte
affiché et vérifier qu'il ne contient aucun mot anglais résiduel (`invalid`,
`error`, `failed`, `not found`...).

---

## 5. Pièges classiques - résumé

| Piège                                                                    | Symptôme                                                        | Fix                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Message d'erreur par défaut du SDK affiché tel quel                       | Toast/erreur en anglais malgré une UI 100% française               | Mapper `error.code` vers `AUTH_ERROR_MESSAGES_FR` (ou équivalent par SDK)     |
| Mapping fait sur `error.message` (texte brut) plutôt que sur `error.code` | Le mapping casse silencieusement à la prochaine version du SDK     | Toujours mapper par code stable, garder le texte en fallback regex uniquement |
| Test QA qui vérifie le statut HTTP mais pas le texte affiché              | Le bug passe la QA automatisée sans être détecté                   | Ajouter une assertion sur le contenu textuel du message d'erreur             |
| Nouveau SDK tiers ajouté (Stripe, OAuth, upload) sans vérifier ses erreurs par défaut | Même bug se reproduit sur un autre flux (paiement, upload, OAuth) | Appliquer la checklist section 3 à chaque nouvelle intégration SDK tierce    |

---

---
id: general-audit-templates-starterkit
category: general
tags: starterkit, templates, accents, better-auth, boilerplate, redirection
difficulty: beginner
created_from: round 001 - BUG-2/3/4/5 + NOUVEAU-1/2 (auth-form.tsx, sign-out-button.tsx, seed.ts, sign-up/page.tsx, card.tsx)
last_updated: 2026-07-10
version: 1.0.0
---

# Auditer les fichiers issus des templates du starterkit à chaque round qui les touche

## Contexte

Stack dual-stack initialisée via `init-postgres-fastapi` (tools/postgres-templates).
Le round 001 a introduit 6 bugs (BUG-2, BUG-3, BUG-4, BUG-5, NOUVEAU-1, NOUVEAU-2)
tous situés dans des fichiers **copiés tels quels depuis le starterkit**
(`auth-form.tsx`, `sign-out-button.tsx`, `seed.ts`, `sign-up/page.tsx`,
`card.tsx`), pas écrits par les agents dev. Le réflexe implicite « les
templates du kit sont déjà conformes » est faux : ils contiennent des
placeholders génériques qui ne respectent ni les règles du projet
(accents français), ni son contexte produit (page cible réelle, pas
`/dashboard`).

---

## 1. Le piège : un fichier « déjà là » n'est pas un fichier « déjà audité »

Quand un agent (postgres-developer, nextjs-developer) génère un projet via un
template starterkit, les fichiers copiés le sont **sans passage par le
pipeline de revue habituel** (ils ne sont pas « écrits » au sens génération,
donc aucun agent ne les relit spontanément avec les règles du projet en tête).
Ils contiennent typiquement :

- du texte UI en anglais approximatif ou en français sans accents (le
  starterkit est générique, pas franco-spécifique)
- des redirections codées en dur vers des pages boilerplate du kit
  (`/dashboard`) qui n'existent pas ou plus dans le produit réel
- des pages de démo/boilerplate non liées au produit final
- des manques d'accessibilité de base (rôle ARIA manquant, etc.)

---

## 2. Checklist d'audit (à appliquer dès qu'un template starterkit est utilisé)

| Point à vérifier                                                         | Où chercher typiquement                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Accents français corrects sur TOUS les textes visibles (UI, metadata, console.error) | Composants auth (`auth-form.tsx`, `sign-out-button.tsx`), pages `sign-up`/`sign-in`, `seed.ts` |
| Redirections post-action pointent vers de vraies pages du produit, pas des pages boilerplate (`/dashboard`) | Formulaires de login/signup, guards d'auth, `middleware.ts`             |
| Pages boilerplate du kit (ex. `/dashboard` de démo) transformées en redirect ou supprimées | `src/app/**` — chercher les pages non présentes dans `.project/app.md` |
| Rôles ARIA / sémantique de base sur les composants shadcn du kit         | `src/components/ui/*.tsx` copiés tel quels (Card, Dialog, etc.)         |
| Variables d'environnement placeholder remplacées par les vraies valeurs projet | `.env.example`, `docker-compose.yml`                                    |

---

## 3. Quand appliquer cette checklist

- Immédiatement après tout `/start-structure` ou bootstrap qui invoque un
  template starterkit (`init-postgres-fastapi`, `init-nextjs-postgres`, etc.)
- Avant de considérer le round de fondations comme « terminé », en complément
  de la revue `code-reviewer` habituelle
- Ne PAS attendre le `qa-tester` : ces défauts sont souvent invisibles en test
  automatisé (accents = pas d'erreur fonctionnelle, redirection dure = marche
  quand même en dev si la page existe encore)

---

## 4. Pièges classiques - résumé

| Piège                                                              | Symptôme                                                          | Fix                                                                 |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Texte UI du template sans accents (« Echec », « Creer », « Deja »)   | Violation silencieuse de la règle orthographique, invisible aux tests automatisés | Relire tous les fichiers copiés depuis le starterkit, corriger les accents |
| Redirection post-login codée en dur vers `/dashboard` (page démo du kit) | Le parcours réel n'atteint jamais la page produit livrée              | Rediriger vers la vraie page d'accueil du produit ; transformer `/dashboard` en redirect |
| Page boilerplate du kit encore présente et accessible                  | Confusion utilisateur, incohérence avec `.project/app.md`              | Supprimer ou rediriger la page vers le vrai parcours produit             |
| Composant shadcn copié tel quel sans rôle ARIA (ex. `CardTitle`)        | Accessibilité dégradée, non détecté par les tests fonctionnels          | Ajouter le rôle/élément sémantique manquant (ex. `role="heading"`)        |
| Supposer que « le kit est déjà fini donc pas besoin de le relire »      | Bugs template qui remontent uniquement en revue manuelle tardive       | Appliquer systématiquement la checklist section 2 après bootstrap        |
