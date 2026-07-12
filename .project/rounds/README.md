# Rounds — MyDay

Roadmap générée le 2026-07-10 depuis `.project/app.md` (13 features MVP + 5 Phase 2),
selon le séquencement en 3 paliers validé par la revue d'experts :
Palier 1 « cockpit utile » (rounds 002-005), Palier 2 « l'IA entre en scène »
(rounds 006-007), Palier 3 « différenciateur + confort » (rounds 008-009).

Hors roadmap (volontaire) : F19 WhatsApp/SMS, F20 monétisation, F21 commande
vocale, F22 liste d'attente — réservés dans decisions.md à une exploration
future conditionnelle.

| Round | Titre | Statut | Dépend de |
| --- | --- | --- | --- |
| 001 | Fondations | done (2026-07-10) | — |
| 002 | Comptes et invitations | done (2026-07-10) | 001 |
| 003 | Connexion Google et synchronisation | done (2026-07-10) | 002 |
| 004 | Cockpit : dashboard, planning, notes, tâches | done (2026-07-11) | 003 |
| 005 | Onboarding et PWA | done (2026-07-11) | 004 |
| 006 | L'IA entre en scène : tri des mails | done (2026-07-11) | 005 |
| 007 | Brief IA quotidien | done (2026-07-11) | 006 |
| 008 | Assistant conversationnel | done (2026-07-11) | 007 |
| 009 | Notifications push et recherche | done (2026-07-11) | 008 |
| 010 | Finitions | done (2026-07-11) | 009 |
| 011 | Phase 2 produit (post-MVP) | available | 010 |
| 012 | Tâches : dates & catégories | done (2026-07-12) | 010 |
| 013 | Planning : vues jour/semaine/mois/année + heure de fin | done (2026-07-12) | 012 |
| 014 | Cockpit & brief repensés | done (2026-07-12) | 012, 013 |

## Comptes-rendus

- **010 — Finitions** (2026-07-11) : dernier round MVP — vue admin du journal d'usage (jours actifs par user/semaine, coût IA par agent, métadonnées uniquement), dark mode complet (fix systémique `bg-white`→`bg-card` sur 44 fichiers), a11y de base, README + `.env.example`. MVP jugé prêt pour l'usage quotidien. 237 tests backend verts, 0 bug QA.
- **009 — Notifications push et recherche** (2026-07-11) : le confort — notifications push web (VAPID) branchées sur les alertes des workflows + rappels d'événements, cloche dans la navbar, recherche globale (modale ⌘/ + loupe) sur notes/tâches/mails/événements. 230 tests backend verts, 0 bug QA.
- **008 — Assistant conversationnel** (2026-07-11) : le différenciateur — assistant IA à qui on parle (crée tâches/notes/événements, prépare des réponses mail avec validation obligatoire avant tout envoi), page chat + barre ⌘K. Clé Anthropic activée (vraie IA sur tri/brief/assistant). Garantie « au plus un envoi » (SOP). 202 tests backend verts.
- **007 — Brief IA quotidien** (2026-07-11) : le moment signature — workflow `daily_brief` (service FastAPI), carte hero brief en tête du cockpit (accroche, priorités, synthèses, alertes), scheduler quotidien à l'heure choisie + génération à la demande + fin d'onboarding, ton dans les réglages. Mode « règles » (brief express, prêt-pour-IA). 172 tests backend verts.
- **006 — L'IA entre en scène : tri des mails** (2026-07-11) : premier round IA — workflow `mail_triage` en service FastAPI (pré-filtre + scoring + résumés + notifications plafonnées), page `/mails` scorée avec boucle de feedback, mails importants au cockpit. Mode « règles d'abord » (fallback heuristique, prêt-pour-IA dès qu'une clé Anthropic est fournie). Validé sur 24 mails réels. 160 tests backend verts.
- **005 — Onboarding et PWA** (2026-07-11) : l'arrivée dans l'app — onboarding 4 étapes (Google, préférences, installation PWA, écran final), app installable sur mobile (manifest + service worker + icônes), table de préférences avec RLS, bannière de reprise. 1 bug d'intégration corrigé (assets PWA à rendre publics dans le middleware Next 16). 133 tests backend verts.
- **004 — Cockpit : dashboard, planning, notes, tâches** (2026-07-11) : le cœur fonctionnel de l'app — cockpit connecté aux vraies données, planning avec écriture Google Agenda idempotente, to-do et notes natives, journal d'usage. 14 endpoints, 0 migration (schéma déjà posé), 123 tests backend verts.
- **003 — Connexion Google et synchronisation** (2026-07-10) : connexion Google OAuth (PKCE + état signé) bout en bout, jetons chiffrés au repos, synchronisation incrémentale Agenda + Gmail avec verrou anti-chevauchement et carte de statut dans les réglages. Sync réelle validée (2 événements + 23 mails).
- **002 — Comptes et invitations** (2026-07-10) : cycle de vie complet des comptes — inscription sur invitation avec claim atomique prouvé sous concurrence, pages auth AEVIO One, espace admin, gardes dernier-admin.
- **001 — Fondations** (2026-07-10) : socle dual-stack complet et opérationnel — Next.js 16 + FastAPI + Postgres + MinIO + Better-auth, schéma des 13 entités avec RLS, design system AEVIO One, Dockerfiles de production avec migrations automatiques.
