# MyDay

Cockpit personnel unifié : dashboard vivant qui réunit planning, to-do, notes et mails importants avec des agents IA (brief quotidien, priorisation des mails, assistant conversationnel). PWA desktop + mobile, accès sur invitation.

## Stack

FastAPI + Next.js + Postgres (dual-stack) + Agents IA (Agent Platform)

## Périmètre MVP

- Sources : Google Agenda + Gmail (OAuth officiel) uniquement — WhatsApp/SMS/iCloud exclus (pas d'API fiable)
- To-do et notes natives MyDay
- Brief IA à heure choisie + priorisation continue
- Assistant conversationnel (validation obligatoire avant envoi de mail)
- Notifications push, recherche globale, espace admin invitations

## Règles clés

- Cloisonnement strict par utilisateur ; l'admin ne voit jamais le contenu
- MyDay ne supprime jamais rien dans Gmail
- Synchronisation périodique, pas de temps réel promis

## Fichiers

- `BRIEF.md` (racine) : brief formel validé
- `.project/app.md` : mémoire détaillée (problème, utilisateurs, marché, parcours, fonctionnalités, entités, règles)
- `.project/decisions.md` : stack, Agent Platform, décisions produit
