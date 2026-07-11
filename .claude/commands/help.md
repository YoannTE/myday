Affiche un guide rapide du framework et de ses commandes.

Ne lis aucun fichier. Affiche directement le texte suivant a l'utilisateur,
tel quel, en markdown :

---

## Comment ca marche

Ce framework te guide de l'idee au deploiement. Tu decris ce que tu veux
en francais, et les commandes font le travail technique.

Chaque commande correspond a une etape du projet. Tu les lances dans
l'ordre, mais tu peux revenir en arriere a tout moment.

## Les commandes

### Creer le projet

| Commande        | Quand l'utiliser                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/start`        | **Premiere etape.** Tu decris ton idee, on construit ensemble le cahier des charges (pages, fonctionnalites, utilisateurs, modele economique).                                                                      |
| `/design`       | Explore 3 directions de design sur ta vraie page d'accueil. Tu choisis les couleurs, la typo, l'ambiance. Tout se teste en live dans le navigateur.                                                                 |
| `/mockup`       | Genere les maquettes HTML de toutes les pages du projet, basees sur le design valide.                                                                                                                               |
| `/agent-design` | Conçois le workflow agent-platform SDK-native (steps, state, config, HITL, observabilité, recovery). Produit `.project/agent-design.md`. A lancer entre `/design` et `/mockup` si ton projet utilise des agents IA. |
| `/agent-detail` | Cadre le fonctionnement détaillé de chaque step LLM/tool/HITL : prompt système, schema, inputs/outputs, failure modes, tests. A lancer apres `/agent-design` si ton graph contient des sous-agents IA.              |
| `/roadmap`      | Decoupe le projet en rounds de developpement (etapes progressives).                                                                                                                                                 |

### Developper

| Commande   | Quand l'utiliser                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/code`    | Execute un ou plusieurs rounds de la roadmap. C'est la que le vrai code est genere. Exemples : `/code 1`, `/code 3 4 5`, `/code all`. |
| `/feature` | Ajoute une fonctionnalite apres le developpement initial. Exemple : `/feature ajouter un systeme de favoris`.                         |

### Verifier et livrer

| Commande     | Quand l'utiliser                                                                           |
| ------------ | ------------------------------------------------------------------------------------------ |
| `/review`    | Fait relire un document (plan, brief, roadmap) par 4 reviewers specialises avant de coder. |
| `/qa-tester` | Teste les pages et fonctionnalites (smoke tests + tests automatises).                      |
| `/polish`    | Checklist de finition avant mise en production : legal, SEO, accessibilite, performance.   |

### Utilitaires

| Commande                | Quand l'utiliser                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/onboard`              | Reprend un projet existant qui n'a pas encore de memoire projet (.project/). Analyse le code et genere la documentation. |
| `/setup-dokploy-shared` | Configure l'infrastructure partagee sur un VPS (Postgres + MinIO). A faire une seule fois par serveur.                   |
| `/migrate-off-supabase` | Migre un projet Supabase vers Postgres natif + MinIO (supprime la dependance Supabase).                                  |

## Le parcours typique

```
/start  →  /design  →  [/agent-design → /agent-detail]  →  /mockup  →  /roadmap  →  /code  →  /polish
```

`/agent-design` est suggere automatiquement par `/start` si ton projet utilise des agents IA.
A lancer entre `/design` et `/mockup` pour que les maquettes puissent representer correctement
les workflows IA (parametres exposes, points HITL, feedbacks user).
`/agent-detail` est lance apres `/agent-design` si des steps LLM/tool/HITL ou agents autonomes sont présents. Elle cadre les prompts, schemas, contrats state, recovery et tests avant le code.
Tu peux aussi ajouter des fonctionnalites a tout moment avec `/feature`.

## La memoire projet (.project/)

Tout ce qui est decide est sauvegarde dans le dossier `.project/` :

- **index.md** - resume du projet (lu a chaque nouvelle session)
- **app.md** - cahier des charges complet (pages, entites, permissions)
- **design.md** - direction visuelle validee (couleurs, typo, composants)
- **roadmap.md** - plan de developpement en rounds
- **patterns.md** - conventions UI etablies (pour garder la coherence)
- **decisions.md** - choix techniques et fonctionnels

Meme si la conversation est coupee, rien n'est perdu.
