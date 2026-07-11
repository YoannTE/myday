---
name: drizzle-manual-migrations
description: Piège — un fichier SQL RLS écrit à la main est ignoré par db:migrate s'il n'est pas dans meta/_journal.json
metadata:
  type: project
---

drizzle-kit ne génère PAS les policies/grants RLS : ils sont ajoutés à la main dans un fichier `drizzle/NNNN_*.sql`.

**Piège :** `db:migrate` n'exécute que les migrations listées dans `drizzle/meta/_journal.json`. Un fichier SQL simplement déposé dans `drizzle/` sans entrée journal est **silencieusement sauté** → la table est créée sans RLS/grants activés au moment attendu, ou (si la table est bien créée mais RLS jamais posée) cloisonnement absent.

**How to apply :** quand un plan dit « fichier SQL RLS dédié appliqué après db:generate », vérifier qu'il précise COMMENT il est appliqué :
- soit ajouter les statements RLS à la FIN du fichier de migration généré par `db:generate` (le plus simple, déjà dans le journal) ;
- soit créer un fichier numéroté correctement ET l'enregistrer dans `_journal.json` (fragile à la main).
Ne jamais laisser « appliqué séparément » sans mécanisme explicite.
