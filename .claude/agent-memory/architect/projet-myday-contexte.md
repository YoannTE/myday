---
name: projet-myday-contexte
description: Contexte et points durs d'architecture récurrents du projet MyDay (cockpit perso Google + IA)
metadata:
  type: project
---

MyDay = cockpit personnel unifié : planning Google Agenda + Gmail + to-do/notes natives + brief IA + assistant conversationnel. Stack FastAPI + Next.js + Postgres, Agent Platform (DBOS) activée, PWA, accès sur invitation, utilisateur final non technique.

**Why:** produit agrégeant des données ultra-sensibles (mails, messages perso) → le risque #1 est la fuite/le mauvais cloisonnement, pas la fonctionnalité.

**How to apply:** lors des revues, insister systématiquement sur ces angles morts identifiés au brief initial (2026-07-09) :
- Jetons OAuth Google décrits seulement comme « chiffrés » sans mécanisme → voir [[pattern-securite-jetons-oauth]].
- Cloisonnement décrété mais aucune couche d'enforcement (asyncpg, pas de RLS par défaut) → voir [[pattern-enforcement-cloisonnement]].
- Sync bidirectionnelle Google Agenda sans conflits/deltas/idempotence → voir [[pattern-resilience-sync-tierce]].
- Contrainte kit : Uvicorn `--workers 1` (DBOS singleton) → sync de fond peut dégrader la latence interactive ; préférer dbos.Queue.
- Push PWA iOS : nécessite installation A2HS, best-effort ; F10/F12 sur-promettent « mêmes fonctions ».
- Google OAuth verification : scopes restricted (gmail.readonly/send), plafond 100 test users, refresh token expire en 7j tant que l'app est en mode Testing → chemin critique à planifier tôt.
- Observabilité kit (set_step_summary) expose des summaries à l'opérateur du tenant → risque de fuite de contenu mail malgré la règle « admin ne voit jamais le contenu ».
