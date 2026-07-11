---
name: project-myday-integrations
description: Faisabilité réelle des intégrations de sources de données pour MyDay et périmètre MVP recommandé
metadata:
  type: project
---

Faisabilité des sources de données MyDay (classées par réalité technique, pas par envie) :
- **Google Agenda + Gmail** : faisable via API officielle OAuth (lecture + écriture). = socle MVP.
- **Apple iCloud** : Calendrier via CalDAV + mot de passe d'application (fragile) ; Mail via IMAP (fragile) ; Notes = quasi infaisable proprement. Non officiel, instable.
- **SMS** : impossible depuis une app web (iOS ne donne aucun accès). Hors MVP.
- **WhatsApp perso** : pas d'API officielle, solutions non officielles = risque de bannissement. Hors MVP.
- **Apps de niche (Padel Club...)** : pas d'API. Oublier.

**Why:** La promesse marketing (messagerie unifiée WhatsApp/SMS) repose sur les sources les MOINS faisables — exactement celles censées différencier de Sunsama/Motion. Risque de livrer des connexions qui cassent une semaine sur deux, fatal pour un outil de confiance consulté en continu. De plus Yoann (utilisateur principal) est massivement Apple/WhatsApp, donc sur les sources infaisables.

**How to apply:** Recommander un MVP centré Google (Agenda + Gmail) + to-do/notes natives MyDay + brief IA + assistant conversationnel. SMS/WhatsApp reportés en « exploration V2 » avec contrainte technique documentée, pas en différenciateur de lancement. Toujours trancher lecture vs écriture source par source. Ne jamais promettre du « temps réel » : la plupart des sources seront en polling différé. Voir [[user-yoann]].
