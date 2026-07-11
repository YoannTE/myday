---
name: plan-antipatterns-myday
description: Anti-patterns récurrents repérés dans les plans de round MyDay (parallélisme agents, races, réutilisation socle)
metadata:
  type: project
---

Anti-patterns vus en revue de plans de round MyDay.

**Parallélisme multi-agents** :
- Fichiers partagés non assignés = collision. Navbar/layout global, `components/ui`
  (shadcn `npx shadcn add` concurrent → collision package.json + fichiers), `main.py`.
  Toujours désigner UN propriétaire par fichier partagé, et pré-installer les
  composants shadcn avant de lancer les agents front en parallèle.
- Dépendance d'import cachée : agent A possède `main.py` et importe les routers créés
  par agent B → si A tourne avant B, l'import casse aux tests. Séquencer ou stubs.

**Races récurrentes** :
- Compteur/émission d'event produit dans un PATCH (ex. `task_completed` quand
  statut→faite) : double PATCH / double-clic optimiste → double insert (pas de contrainte
  unique sur usage_events). Rendre atomique : `UPDATE ... WHERE statut<>'faite' RETURNING`,
  n'émettre que si une row a changé.
- Écriture idempotente vers tiers : vérifier que la clé d'idempotence (client_uuid) est
  persistée AVANT l'appel réseau, et que l'état d'échec reste re-tentable par le scheduler.

**Réutilisation du socle** : les plans pointent souvent le mauvais module
(cf. [[google-sync-round003]] : token via `sync.load_connection`, pas `oauth.py`).
Toujours vérifier la signature réelle avant d'approuver « réutilise le helper existant ».

**Contrainte DB manquante** : table `events` n'a AUCUN CHECK `fin > debut`. La validation
fin<debut repose uniquement sur l'API + zod. Pas de garde-fou base.

**Migration RLS = migration journalisée, pas un .sql orphelin** : les policies/grants
RLS vivent dans `drizzle/0002_enable_rls.sql`, ENREGISTRÉ dans `drizzle/meta/_journal.json`
(idx 2, tag `0002_enable_rls`). `db:migrate` (drizzle-kit) n'applique QUE les migrations
du journal. Un plan qui dit « fichier SQL dédié appliqué après db:generate » sans parler
du journal produit une table sans RLS (échec silencieux). Bon pattern : appendre le SQL RLS
DANS le fichier généré par `db:generate` (avec `--> statement-breakpoint`). Policies :
`USING (user_id = current_setting('app.current_user_id', true))`, sans WITH CHECK séparé,
sans cast ::uuid (id Better-auth = texte cuid). Les GRANT app_rls sur nouvelles tables sont
déjà couverts par `ALTER DEFAULT PRIVILEGES … TO app_rls` (0002) tant que la table est créée
par app_admin. `scoped_connection(user_id)` (backend/app/db/client.py) pose le SET LOCAL.

**PWA / Next 16** : `themeColor` va dans l'export `viewport` (PAS dans `metadata`, sorti
depuis Next 14). Le `<link rel=manifest>` est auto-injecté par `src/app/manifest.ts` — ne pas
l'ajouter à la main. Service worker : ne l'enregistrer qu'en `NODE_ENV==='production'` (Turbopack
dev + SW cache-first = HMR cassé / cache zombie). `beforeinstallprompt` doit être bufferisé dans
un singleton au niveau layout (il se déclenche avant le montage d'une étape wizard, sinon perdu ;
absent sur iOS / déjà installé / desktop rejeté → prévoir fallback UI + détection display-mode standalone).
