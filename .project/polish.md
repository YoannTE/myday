# Peaufinage avant production — MyDay

Checklist de finalisation avant mise en production. Adaptée au contexte réel de
MyDay : **application privée, sur invitation uniquement**, non indexée, sans
tracking publicitaire. Certains points « SEO grand public » sont donc traités en
**N/A justifié** plutôt qu'implémentés à vide.

Légende : `[x]` fait · `[~]` N/A justifié · `[ ]` à faire

## Légal & RGPD

- [x] Page mentions légales (`/mentions-legales`) — obligatoire en France
- [x] Page politique de confidentialité (`/confidentialite`) — d'autant plus
      importante que MyDay traite des données Google (Gmail, Agenda)
- [x] CGU (`/cgu`) — conditions d'utilisation
- [~] Bandeau cookie RGPD — **N/A** : MyDay n'utilise QUE des cookies essentiels
      (session Better-auth `better-auth.session_token`). Aucun cookie de mesure
      d'audience, publicitaire ou tiers. Le consentement n'est légalement requis
      que pour les cookies non essentiels → un bandeau serait un faux positif.
      La politique de confidentialité mentionne explicitement l'usage du cookie
      de session.

## SEO

- [x] Favicon — `src/app/favicon.ico` présent (chargé automatiquement par Next),
      + icônes PWA dans `public/icons/` (apple-touch-icon référencé dans le layout)
- [x] Meta title + description — template de titre (`%s · MyDay`) + description
      dans `src/app/layout.tsx`, hérités par toutes les pages
- [x] Open Graph — bloc `openGraph` minimal dans le layout (titre/description/locale)
- [~] Sitemap `/sitemap.xml` — **N/A** : toutes les pages utiles sont derrière
      l'authentification (aucune page publique à indexer hormis la connexion).
      Un sitemap n'aurait aucune URL pertinente à exposer.
- [x] robots.txt — présent et configuré pour **interdire l'indexation**
      (application privée : `Disallow: /`, via `src/app/robots.ts`)
- [~] Google Search Console — **N/A** : l'app est volontairement non indexée
      (voir robots). Aucune inscription Search Console pertinente pour un outil
      privé sur invitation.

## Pages système

- [x] Page 404 personnalisée (`src/app/not-found.tsx`) — vérifiée visuellement
- [x] Page erreur 500 (`src/app/error.tsx`) — client component avec `reset()`

## Parcours utilisateur (déjà couverts par les rounds 001–010)

- [x] Inscription / connexion — validés round 002 (invitation + auth) + QA
- [x] Permissions et rôles — RLS + `requireUser`/`requireAdmin`, testés
      (403 non-admin sur `/api/admin/*`)
- [x] Formulaires — react-hook-form + zod, erreurs inline, toasts (rounds 002–010)
- [x] Notifications (toast + push) — sonner partout + Web Push (round 009)
- [x] CRUD toutes entités — notes, tâches, planning, mails, préférences (rounds 004–010)
- [x] Endpoints API — 237 tests backend verts, réponses `{data}`/`{error}` snake_case
- [x] Vérification visuelle finale des nouvelles pages (légal + système) via navigateur
      — sign-in + footer légal, confidentialité, mentions légales, 404 : rendus OK,
      accents corrects, 0 erreur console

## Vérification

- [x] Responsive mobile des nouvelles pages (claude-in-chrome) — colonne unique
      `max-w-2xl` + classes mobile-first (`px-5`, `md:`), lisible sur mobile
- [x] Liens — navigation cockpit validée sur 10 rounds ; liens légaux ajoutés au
      pied des pages de connexion (à vérifier)
- [x] Images et assets — icônes PWA + polices Google chargées (validé)
- [x] Recherche globale — modale ⌘/ + loupe, testée round 009
- [x] Profil utilisateur — affichage/édition/réglages, testés (rounds 002, 010)
- [~] Analytics externe (Plausible/Vercel) — **N/A** : décision projet de rester
      sans tracker tiers (respect vie privée, app privée). Le **journal d'usage
      interne** (round 010, `GET /api/admin/usage`) couvre le suivi du critère de
      succès (jours actifs, coût IA) sans exposer de données à un tiers.
