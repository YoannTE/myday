---
name: pattern-resilience-sync-tierce
description: Checklist de résilience pour toute sync bidirectionnelle avec une API tierce (Google Agenda/Gmail, etc.)
metadata:
  type: feedback
---

Une sync bidirectionnelle avec une API tierce annoncée sans détail cache toujours les mêmes manques structurants.

**Why:** sans ces garanties, la feature génère doublons et pertes d'édition dès la première semaine, et explose les quotas.

**How to apply:** exiger la couverture des 5 points :
1. Curseur incrémental persisté (Calendar syncToken, Gmail historyId) — jamais de full-list périodique, jamais « depuis maintenant ».
2. Résolution de conflit explicite (source de vérité par origine + last-write-wins sur timestamp `updated`, perdant journalisé).
3. Idempotence de création (unicité (userId, providerId) pour dé-dupliquer les objets créés localement puis relus).
4. Gestion de la révocation (détecter invalid_grant → statut needs_reconnect + bandeau UI, suspendre le workflow au lieu de boucler).
5. Reprise sur cycle raté via curseur (s'appuyer sur la durabilité DBOS, workflow idempotent).
Vérifier aussi les quotas et le coût LLM : pré-filtre heuristique bon marché avant tout appel LLM sur chaque item. Voir [[pattern-securite-jetons-oauth]].
