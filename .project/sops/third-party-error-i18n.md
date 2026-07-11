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
