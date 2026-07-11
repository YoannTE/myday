---
id: devops-docker-multistage-runtime-assets
category: devops
tags: docker, multi-stage, drizzle, migrations, esbuild, runtime-assets
difficulty: intermediate
created_from: round 001 - BUG-1 Dockerfile.web (drizzle/ manquant au runtime)
last_updated: 2026-07-10
version: 1.0.0
---

# Docker multi-stage : copier explicitement les fichiers lus sur disque au runtime

## Contexte

Stack Next.js standalone + Drizzle ORM, buildée en Docker multi-stage
(`builder` → `runner`). Le build passait au vert, mais le conteneur crashait
au tout premier démarrage sur une base fraîche avec
`Can't find meta/_journal.json`. Le dossier `drizzle/` (migrations `.sql` +
`meta/_journal.json`) n'était tout simplement pas copié dans le stage final.

---

## 1. Le piège : esbuild ne bundle PAS les fichiers lus via `fs` au runtime

`drizzle-orm/node-postgres/migrator` (ou équivalent) lit `migrationsFolder`
en tant que **chemin disque au runtime**, pas comme un import JS. Or `esbuild`
(utilisé par `npm run db:bundle-migrate` pour produire `dist/migrate.js`) ne
bundle que le graphe d'imports JS/TS. Les fichiers `.sql` référencés par
lecture de fichier (`fs.readFileSync`, glob sur un dossier) sont **invisibles**
pour esbuild et donc absents de `dist/`.

Résultat : `dist/migrate.js` est généré avec succès, le build Docker est vert,
mais au premier `docker run` sur un environnement neuf (pas de cache, pas de
bind-mount du repo), le process plante car `./drizzle` n'existe pas dans le
conteneur.

---

## 2. Pourquoi un build vert ne prouve rien

| Ce qui est testé          | Ce que ça prouve                                  |
| -------------------------- | -------------------------------------------------- |
| `docker build` réussit     | Le code compile, les imports JS/TS sont résolus     |
| `docker build` réussit     | **PAS** que les fichiers lus via `fs` au runtime existent dans l'image finale |
| `docker run` sur repo local avec bind-mount | Rien — le dossier existe via le mount, pas via l'image |
| `docker run` sur base de données fraîche, sans bind-mount | **Seul test qui prouve que le stage `runner` est complet** |

**Règle** : pour tout Dockerfile multi-stage qui exécute des migrations, des
scripts de seed, ou tout code qui lit des fichiers statiques (SQL, templates,
assets non importés en JS) au runtime, valider avec un `docker run` isolé
(nouvelle base, pas de volume du repo monté) avant de considérer le
Dockerfile fonctionnel.

---

## 3. Fix appliqué

Dans le stage `runner` du `Dockerfile.web`, copier explicitement le dossier
`drizzle/` généré/nécessaire au runtime, en plus du bundle JS :

```dockerfile
# Stage runner
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist ./dist
# OBLIGATOIRE : dist/migrate.js lit ce dossier sur disque au runtime,
# esbuild ne l'a PAS bundlé (fichiers .sql non importés en JS)
COPY --from=builder /app/drizzle ./drizzle

ENTRYPOINT ["./entrypoint.web.sh"]
```

---

## 4. Réflexe de revue pour tout futur Dockerfile multi-stage

Avant de valider un `Dockerfile` multi-stage qui build une app Next.js/Node
avec migrations, seed, ou tout script lisant des fichiers statiques :

1. Lister tous les chemins lus via `fs.*` ou équivalent (pas via `import`)
   dans le code exécuté au runtime (migrate, seed, templates d'emails, etc.).
2. Vérifier que CHACUN de ces chemins a une ligne `COPY --from=builder` (ou
   `COPY` direct) explicite dans le stage final.
3. Tester avec `docker run` sur un environnement neuf (base de données vide,
   pas de bind-mount) — pas seulement `docker build`.

---

## 5. Pièges classiques - résumé

| Piège                                                                 | Symptôme                                                        | Fix                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Dossier `drizzle/` (migrations SQL) non copié dans le stage `runner`   | Crash au premier démarrage : `Can't find meta/_journal.json`     | `COPY --from=builder /app/drizzle ./drizzle` dans le stage final       |
| Build Docker vert utilisé comme preuve que le runtime fonctionne       | Bug invisible en CI/local (repo monté en volume), visible en prod | Toujours valider par `docker run` sur base/environnement fraîche       |
| Fichiers statiques lus via `fs` (SQL, templates, assets) non trackés  | esbuild bundle silencieusement sans erreur, fichier absent au runtime | Lister explicitement tous les chemins `fs.*` du code runtime et les copier |
| Seed/migrate testés uniquement en dev avec `docker compose up` répété | Le volume du repo masque l'absence du dossier dans l'image        | Supprimer le volume ou tester avec une image fraîche isolée            |
