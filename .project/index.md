# MyDay

Cockpit personnel unifié : dashboard vivant qui réunit planning, to-do, notes et mails importants avec des agents IA (brief quotidien, priorisation des mails, assistant conversationnel). PWA desktop + mobile, accès sur invitation.

## Stack

FastAPI + Next.js + Postgres (dual-stack) + Agents IA (Agent Platform)

## Périmètre MVP

- Cockpit unique : tout sur la page `/` (brief IA, météo, planning, tâches, notes), sections réordonnables, plus de sous-pages
- Google (Agenda + Gmail) et mails RETIRÉS temporairement depuis le 2026-07-25 (code conservé, désactivé par flags, cf. decisions.md)
- Planning, to-do et notes 100 % natifs MyDay
- Brief IA à heure choisie (sans mails)
- Assistant conversationnel (tâches, notes, événements ; capacités mails désactivées)
- Notifications push, recherche globale, espace admin invitations

## Règles clés

- Cloisonnement strict par utilisateur ; l'admin ne voit jamais le contenu
- MyDay ne supprime jamais rien dans Gmail
- Synchronisation périodique, pas de temps réel promis

## Fichiers

- `BRIEF.md` (racine) : brief formel validé
- `.project/app.md` : mémoire détaillée (problème, utilisateurs, marché, parcours, fonctionnalités, entités, règles)
- `.project/decisions.md` : stack, Agent Platform, décisions produit
