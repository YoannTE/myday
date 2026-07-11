---
name: pattern-enforcement-cloisonnement
description: Le cloisonnement multi-utilisateur en dual-stack FastAPI/asyncpg doit être enforced (RLS + scoping), jamais seulement déclaré
metadata:
  type: feedback
---

En stack dual-stack (FastAPI + asyncpg, sans ORM à scoping automatique), un cloisonnement « chaque user ne voit que ses données » repose entièrement sur des `WHERE user_id = :current_user` écrits à la main → ~50 points de défaillance manuels pour 10 entités × CRUD.

**Why:** un seul WHERE oublié = fuite cross-compte. Le déclaratif ne protège de rien ; c'est le défaut le plus grave et le plus facile à introduire silencieusement.

**How to apply:** exiger dans toute revue une stratégie à deux niveaux :
1. Service/repository : helper obligatoire injectant le filtre propriétaire (pas de requête brute non scopée).
2. Filet terminal Postgres RLS : `SET LOCAL app.current_user_id` positionné par get_current_user sur la connexion asyncpg + policy sur toutes les tables de contenu.
Traiter l'absence de couche d'enforcement comme un Fail bloquant. Voir aussi [[pattern-securite-jetons-oauth]].
