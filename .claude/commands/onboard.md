Analyse un projet existant et genere la memoire projet (.project/).
A utiliser quand on reprend un projet qui a deja du code mais pas de .project/.

Si .project/ existe deja → prevenir l'utilisateur et demander confirmation
avant d'ecraser.

=== PHASE 1 : SCANNER LE PROJET ===

Detecter la stack : si backend/ existe → dual-stack (FastAPI), sinon → frontend-only.

Analyser le codebase en profondeur avec des agents Explore en parallele :

Agent 1 - Frontend (pages et composants) :

- Lister toutes les pages dans app/ (routes, layouts, pages)
- Lister tous les composants dans components/
- Identifier la navigation (header, sidebar, menu)
- Detecter les pages publiques vs protegees

Agent 2 - Donnees et logique :

- Lister les tables dans src/lib/db/schema.ts (Drizzle) et les migrations dans drizzle/
- Si frontend-only : identifier les Server Actions dans lib/actions/ ou app/
- Si dual-stack : lister endpoints (backend/app/api/), services (backend/app/services/),
  modeles Pydantic (backend/app/models/)
- Reperer les services tiers (Stripe, Resend, etc.)

Agent 3 - Design et patterns :

- Analyser tailwind.config (couleurs, fonts, theme)
- Analyser globals.css (CSS variables shadcn)
- Identifier les composants shadcn installes
- Reperer les patterns recurrents (formulaires, listes, modales, tableaux)

Agent 4 (si dual-stack) - Infra :

- Analyser docker-compose.yml (services, ports, volumes)
- Detecter les Dockerfiles (backend, frontend)
- Identifier la config (variables d'env, pydantic-settings)

=== PHASE 2 : COMPLETER AVEC L'UTILISATEUR ===

Le code ne dit pas tout. Poser ces questions pour completer :

1. **Le projet en une phrase** :
   "Comment tu decrirais ton projet a quelqu'un qui ne le connait pas ?"

2. **Le probleme** :
   "Quel probleme ca resout ? Pour qui ?"

3. **Les utilisateurs** :
   Presenter les roles detectes dans le code et demander :
   "J'ai detecte ces types d'utilisateurs : [liste]. C'est correct ?
   Il en manque ?"

4. **Les features** :
   Presenter la liste des features detectees et demander :
   "Voici les fonctionnalites que j'ai trouvees dans le code : [liste].
   Est-ce qu'il en manque ? Est-ce que certaines sont en cours ou abandonnees ?"

5. **Les priorites** :
   "Quelles sont les prochaines fonctionnalites prevues ?
   Y a-t-il des bugs ou des choses a corriger en priorite ?"

6. **Le design** :
   "Le design actuel te convient ? Tu prevois des changements visuels ?"

7. **Les decisions** :
   "Y a-t-il des choix importants que tu as faits et que le code ne montre pas ?
   Par exemple : pas de dark mode, tout dockerise, choix d'un prestataire..."

→ CHECKPOINT : valider les reponses avant de generer les fichiers.

=== PHASE 3 : GENERER LA MEMOIRE ===

A partir du scan ET des reponses de l'utilisateur, generer les fichiers suivants :

1. `.project/index.md` (~20 lignes max)
   - Nom du projet
   - Description en une phrase
   - **## Stack** : `Next.js + Postgres` ou `FastAPI + Next.js + Postgres`
   - Etat actuel (nombre de pages, entites, features)
   - Fichiers cles

2. `.project/app.md` - specification fonctionnelle
   - ## Probleme : quel probleme le projet resout
   - ## Utilisateurs : types d'utilisateurs detectes (roles, permissions)
   - ## Fonctionnalites : liste de TOUTES les features,
     groupees par domaine. Marquer chaque feature : implementee, en cours, ou prevue
   - ## Entites : tables detectees avec leurs champs et relations
   - Si dual-stack : ## API : endpoints detectes, groupes par domaine
   - ## Regles metier : contraintes et logique detectees

3. `.project/design.md` - systeme de design
   - Palette de couleurs (extraite de tailwind/CSS variables)
   - Typographie
   - Composants shadcn utilises
   - Style general (arrondi, espacement, densite)

4. `.project/patterns.md` - patterns etablis
   - Pattern de formulaire (librairies, validation, soumission)
   - Pattern de liste/tableau
   - Pattern de layout (sidebar, header, responsive)
   - Pattern de navigation
   - Pattern d'authentification
   - Si dual-stack : pattern d'appel API, pattern de service backend
   - Tout pattern recurrent detecte dans le code

5. `.project/decisions.md` - choix techniques
   - Stack choisie et pourquoi
   - Librairies tierces installees
   - Conventions detectees (nommage, structure)
   - Si dual-stack : configuration Docker (services, ports)
   - Ce qui n'est PAS implemente (dark mode, i18n, etc.)

=== PHASE 4 : VALIDATION ===

Presenter un resume structure a l'utilisateur :

"J'ai analyse ton projet. Voici ce que j'ai trouve :

- [x] pages
- [x] entites (tables)
- [x] features implementees
- Stack : [stack detectee]

Les fichiers .project/ ont ete generes.
Tu peux les consulter et me dire si quelque chose manque ou est incorrect.

Pour la suite, tu peux lancer :

- /design pour explorer les directions de design et valider l'identite visuelle
- /mockup pour generer les maquettes HTML + PNG de reference (apres /design)
- /roadmap pour planifier les prochaines features
- /feature pour ajouter une nouvelle fonctionnalite"

=== REGLES ===

- Ne PAS inventer de features qui n'existent pas dans le code
- Ne PAS supposer des intentions - documenter ce qui EST
- Rester factuel : le but est de creer une photo du projet tel qu'il est
- Si un aspect est ambigu, poser la question a l'utilisateur
- Chaque fichier genere doit etre concis et utile, pas verbeux
