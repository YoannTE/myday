# Phase 2 - Décisions

## Écrans générés

- [x] dashboard.html - validé visuellement (« c'est conforme ») + audit OK (14 alignés, 1 gap tranché)
- [x] login.html - validé visuellement + audit OK (6 alignés, 0 gap)
- [x] onboarding.html - validé visuellement + audit OK (6 alignés, 0 gap)
- [x] planning.html - validé visuellement + audit OK (7 alignés, 1 gap tranché : événement.syncStatus ajouté)
- [x] notes.html - validé visuellement + audit OK (7 alignés, 0 gap)
- [x] mails.html - validé visuellement + audit OK (9 alignés, 3 gaps tranchés : mail.raisonScore + entités préférenceExpéditeur et brouillonMail ajoutées)
- [x] assistant.html - validé visuellement + audit OK (8 alignés, 0 gap — les entités nécessaires avaient été ajoutées à l'audit mails)
- [x] reglages.html - validé visuellement + audit OK (10 alignés, 0 gap)

## Schema evolutions (`app.md` mis à jour pendant Phase 2)

- 2026-07-10 : ajout `note.origine` (text : manuelle/assistant, défaut manuelle) — badge « via l'assistant » sur les notes (gap accepté par l'utilisateur)
- 2026-07-10 : ajout `événement.syncStatus` (text : synced/sync_pending/sync_error, défaut synced) — badge « Non synchronisé » du planning (gap accepté)
- 2026-07-10 : ajout `mail.raisonScore` (text) — raison courte du score affichée sur le mail ouvert (gap accepté)
- 2026-07-10 : ajout entité `préférenceExpéditeur` (userId, email, statut important/muet) — boutons feedback du tri (gap accepté)
- 2026-07-10 : ajout entité `brouillonMail` (destinataire, objet, corps, statut machine à états, gmailId envoyé, mail d'origine) — validation avant envoi (gap accepté)

## Itérations notables

- Navigation ajoutée à la demande de l'utilisateur : liens « Tout voir → » sur les sections du dashboard (notes/planning/mails) + lien « ← Cockpit » en haut des pages internes. Pas de page tâches dédiée en v1 (la liste complète vit sur le dashboard).
- Largeur unifiée à la demande de l'utilisateur : TOUT sur max-w-4xl (navbar + brief inclus) — règle mise à jour dans design.md. Les futurs écrans doivent suivre.

- Contexte : l'écran-pilote dashboard reproduit la configuration validée pendant /design (direction 3 « AEVIO One », variantes choisies par l'utilisateur : topbar Barre produit avec assistant intégré + date + bouton ☾, brief Carte hero, notes Liste épinglée par défaut, planning Timeline produit, tâches Checklist nette, mails Inbox scorée, chips suggestions en bas). Validation visuelle du pilote attendue rapide.
