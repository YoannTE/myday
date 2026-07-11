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
