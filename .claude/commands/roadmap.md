Lis BRIEF.md et .project/app.md pour comprendre le projet.
La source de vérité pour les features est .project/app.md - c'est la liste
complète des fonctionnalités à réaliser. Ne pas inventer de features :
utilise celles qui sont documentées dans app.md.

Lis .project/design.md pour le contexte visuel.

**REGLE UI** : avant chaque Write/Edit long d'un fichier `.project/rounds/`,
appelle d'abord `notify_writing({ file_path: "<chemin>" })` pour afficher
l'animation plume cote UI pendant la redaction. Cf. CLAUDE.md section
« Hook `notify_writing` ». Ignorer si tu n'as pas ce tool.

## Avertissement preliminaire - workflows IA

Avant de lancer les phases, verifier :

```bash
HAS_AGENT_PLATFORM=$(grep -l "^## Agent Platform" .project/decisions.md 2>/dev/null)
HAS_AGENT_DESIGN=$([ -f .project/agent-design.md ] && echo "yes" || echo "no")
HAS_AGENT_DETAIL=$(grep -c "## 11. Détail par step" .project/agent-design.md 2>/dev/null || echo "0")
```

Si `HAS_AGENT_PLATFORM` est non-vide ET `HAS_AGENT_DESIGN` = "no" :

> ⚠ **Ton projet contient des features d'agents IA mais `.project/agent-design.md` est absent.**
>
> Les rounds touchant aux workflows IA seront decoupes a l'aveugle (sans savoir combien d'étapes SDK ils contiennent, quels tools, quelles configs, quels HITL). Les rounds risquent d'etre sur- ou sous-dimensionnes.
>
> **Recommande** : interrompre maintenant, lancer `/agent-design` (et `/agent-detail` pour détailler les steps LLM/tool/HITL), puis relancer `/roadmap`.

Si `HAS_AGENT_DESIGN` = "yes" ET `HAS_AGENT_DETAIL` = "0" (section absente ou vide) :

> ⚠ **Le workflow SDK-native est conçu mais les steps ne sont pas détaillés (`/agent-detail` pas lancé).**
>
> Tu peux continuer `/roadmap`, mais les rounds touchant aux agents/steps seront approximatifs sur les prompts, schemas, failure modes et tests. Si possible, lance `/agent-detail` d'abord.

(Ne pas bloquer la commande - continuer dans tous les cas apres l'avertissement.)

---

## ETAPE 0 - Garde-fou avant generation

### Cas A : ancien format `roadmap.md` sans dossier `rounds/`

Verifier :

- Si `.project/rounds/` n'existe pas MAIS `.project/roadmap.md` existe :

Afficher :
"Detection d'un ancien format `roadmap.md` (rounds sans index.json).
Veux-tu :
(m) MIGRER : extraire les rounds existants de roadmap.md, preserver leur statut,
et generer la nouvelle structure rounds/ a partir de cette base
(n) IGNORER l'ancien fichier et generer une nouvelle roadmap depuis app.md
(le roadmap.md ancien sera ignore, ne sera pas supprime)
(c) ANNULER"

Si **(m) - Migration** :

1. Parser `.project/roadmap.md` : pour chaque section `## Round N - Titre`, extraire :
   - L'ID (N -> NNN sur 3 chiffres)
   - Le titre
   - Les features (lignes `- [ ] ...` ou `- [x] ...`)
   - Les liens mockup (pattern `- mockup: pages/X.html + png/X.png`)
   - Le statut deductible : si toutes les features ont `[x]` -> `done` ;
     sinon `available` pour le premier round non-done, `pending` pour les suivants
2. Pour chaque round extrait, creer le dossier `.project/rounds/NNN/` puis `.project/rounds/NNN/spec.md` avec :
   - Frontmatter (id, title, status, depends_on=[round precedent sauf R001])
   - Section `## Objectifs` (deduite du titre)
   - Section `## Perimetre` avec les features extraites
   - Section `## Mockups lies` avec les paires extraites
   - Section `## Tests fin de round` vide (info absente de l'ancien format)
   - Section `## Compte-rendu` :
     - Si round done : compte-rendu generique
       "Round migre depuis roadmap.md ancien format. Detail des realisations non disponible."
       (pas de marqueur `<!-- COMPTE_RENDU -->`)
     - Sinon : marqueur `<!-- COMPTE_RENDU -->` suivi du commentaire HTML
3. Generer `.project/rounds/index.json` avec tous les rounds
4. Generer `.project/rounds/README.md` avec table + section "Comptes-rendus"
   (entrees minimales pour rounds done)
5. NE PAS supprimer `roadmap.md` ancien
6. Apres migration, demander :
   "Migration OK. Veux-tu :
   (1) lancer la PHASE 1 normale pour integrer d'eventuelles nouvelles features de app.md
   (2) arreter ici (les rounds migres suffisent)"

Si **(n)** : passer directement a la PHASE 1 (generer depuis zero).

Si **(c)** : arreter.

### Cas B : dossier `rounds/` existe avec des rounds `done`

Si `.project/rounds/index.json` existe ET contient au moins un round avec
`"status": "done"` :

Afficher :
"Des rounds termines existent deja dans rounds/. Que veux-tu faire ?
(a) Ajouter uniquement les nouveaux rounds (conserver les rounds existants intacts)
(b) Regenerer toute la roadmap (ecraser les fichiers existants - les comptes-rendus
des rounds done seront perdus)
(c) Annuler"

**Option (a) - Ajouter uniquement les nouveaux rounds :**

1. Lire `index.json` existant, noter l'ID maximum present
   (ex: si rounds 001, 002, 003 existent, max = 3)
2. Generer la nouvelle roadmap depuis `app.md` (PHASE 1 en memoire, ne pas ecrire)
3. Comparer round par round :
   - Pour chaque round existant (001, 002, ...) : NE PAS TOUCHER, garder le
     fichier `.project/rounds/NNN/spec.md` et l'entree `index.json` tels quels
   - Si la nouvelle generation propose un round avec un ID existant mais un
     titre/perimetre DIFFERENT : ARRETER, afficher :
     "Conflit : le round NNN existant ('[titre-existant]') differe de la nouvelle
     generation ('[titre-nouveau]'). L'option (a) ne peut pas resoudre ce conflit.
     Bascule en option (b) ou (c)."
4. Ajouter UNIQUEMENT les rounds avec ID > max existant :
   creer les fichiers `.project/rounds/NNN/spec.md` manquants + mettre a jour `index.json`
5. Mettre a jour `README.md` via Edit cible (ajouter les nouvelles lignes a la
   table, pas Write complet)

**Option (b)** : continuer vers PHASE 1 (generation complete, ecrase tout).

**Option (c)** : arreter.

### Cas C : aucun round existant

Passer directement a la PHASE 1.

---

## PHASE 0bis - Round 000 « Fondations » (conditionnel, R45)

But : insérer en tête de roadmap un **Round 000 « Fondations »** qui pose les
fondations du projet à partir d'une image Docker pré-cuite du catalogue (au lieu
de tout scaffolder via `init-postgres`). Cette phase remplace, pour le Round 1,
le bootstrap classique quand une image adaptée existe.

### Garde anti-doublon

```bash
FOUND_STATUS=$(jq -r '.status // empty' .project/.foundations.json 2>/dev/null || echo "")
```

- Si `.project/.foundations.json` existe avec `status: "complete"` : les
  fondations sont **déjà posées**. **Ne PAS réinsérer le Round 000** (pas de
  doublon à la relance de `/roadmap`). Passer directement à la PHASE 1.
- Si `status: "partial"` : le Round 000 est réinséré **avec une note de
  reprise** (« Reprise : une tentative de fondations a été interrompue, elle
  sera reprise au lancement de `/code`. »).
- Si le fichier est absent : appliquer la sélection raisonnée ci-dessous.

### Sélection raisonnée de l'image (zéro re-sélection silencieuse)

1. Lire la stack du projet depuis le brief (`.project/index.md` section
   `## Stack`, ou `BRIEF.md`) : `nextjs-postgres` ou `nextjs-fastapi`.
2. Re-appeler le catalogue à jour (la base URL et le token sont dans l'env du
   process kit, cf. skill `foundations-pull`) :

   ```bash
   curl -sf -H "Authorization: Bearer ${REBORN_DEVICE_TOKEN}" \
     "${REBORN_PROXY_URL}/api/app-images?kit_version=$(cat .claude/.installed-version 2>/dev/null || echo 0.0.0)" \
     | jq '.data.images'
   ```

3. Sélectionner l'image dont la `stack` correspond à celle du brief ET dont la
   `description` + les `keywords` matchent le mieux le besoin (type d'app décrit
   dans le brief). Le contrat de sélection est la description rédigée par
   l'éditeur dans la console : pas de classifieur, un raisonnement explicite.
4. **Si aucune image ne correspond** (catalogue vide, backend injoignable,
   stack non couverte) : **ne PAS insérer de Round 000**. La roadmap part avec
   un Round 1 « Fondations » classique (bootstrap `init-*`). Ne jamais forcer
   une image hors sujet.

### Justification écrite dans les décisions du projet client

Quand une image est sélectionnée, écrire la justification dans
`.project/decisions.md` (créer la section si absente) :

```markdown
## Fondations (Round 000)

Image retenue : `{slug}` ({name}, stack `{stack}`).
Raison : {1-2 phrases reliant la stack du brief et le besoin décrit aux
keywords/description de l'image}.
Le pull réel (par digest épinglé) a lieu au lancement de `/code`.
```

Le slug retenu sert au Round 000 ; `/code` re-vérifiera le catalogue au moment
de l'exécution (le digest n'est jamais figé dans la roadmap).

### Insertion du Round 000

Quand une image est retenue, créer `.project/rounds/000/spec.md` AVANT les
autres rounds, avec ce périmètre (le détail d'exécution est dans le skill
`foundations-pull`, ne pas le dupliquer ici) :

```markdown
---
id: "000"
title: "Fondations"
status: "available"
depends_on: []
---

## Objectifs

Poser les fondations du projet à partir de l'image `{slug}` ({name}) au lieu de
scaffolder de zéro. Pull par digest épinglé, extraction, installation locale,
démarrage des services, smoke check. Phase gratuite (0 point débité).

## Périmètre

- [ ] Fondations : pull de l'image `{slug}` via le skill `foundations-pull`,
      extraction du scaffold, `npm install`, services up, smoke check, écriture
      de `.project/.foundations.json` (status "complete"). Fallback `init-*` si
      l'image est indisponible ou si une étape échoue.

## Mockups liés

<!-- Aucun (round technique) -->

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

<!-- COMPTE_RENDU -->
```

Conséquences sur la génération PHASE 1 :

- Le Round 1 classique « Fondations » (PHASE 1, point 2) ne refait **pas** le
  bootstrap `init-*` : il dépend du Round 000 (`depends_on: ["000"]`) et part de
  fondations posées. Renuméroter ou marquer le Round 1 en conséquence.
- Si aucune image n'a été retenue (pas de Round 000), la PHASE 1 reste
  inchangée : le Round 1 fait le bootstrap classique comme aujourd'hui.
- Mettre à jour `index.json` et `README.md` pour refléter le Round 000 quand il
  est présent (id `"000"`, status `"available"`, `depends_on: []`).

---

## PHASE 1 - Génération de la roadmap

1. Reprends TOUTES les features listées dans app.md
2. Organise-les en rounds progressifs :
   - Round 1 : Fondations - DOIT inclure SYSTÉMATIQUEMENT, en plus des features
     spécifiques au projet :
     - Bootstrap via init-postgres ou init-postgres-fastapi (selon stack)
     - Schema Drizzle initial + admin seed
     - Layout principal + design system shadcn/ui
     - docker-compose.yml local (Postgres + MinIO)
     - **Dockerfile production + entrypoint.sh + .dockerignore** adaptés à la
       stack du projet, avec **migrations Drizzle automatiques au démarrage**
       (pattern : esbuild bundle de `src/lib/db/migrate.ts` → `migrate.js`,
       puis entrypoint qui lance `node migrate.js && exec node server.js`).
       Si le projet a Celery/workers/etc, le Dockerfile multi-stage doit prévoir
       les stages correspondants (runner, worker, beat). Détails dans
       `/auto-migrate` que l'agent peut consulter pour la structure attendue.
   - Round 2 : CRUD principal (les entités centrales de l'app)
   - Round 3+ : Logique métier (règles, permissions, workflows, notifications)
   - Rounds suivants : Interfaces avancées (dashboards, filtres, exports, recherche)
   - Dernier round : Finitions (polish UI, tests, perf, SEO, documentation)
3. Dans chaque round, les features doivent être indépendantes entre elles
   (pour pouvoir être codées en parallèle par des agents)
4. Chaque feature a un titre court et une description de 1-2 lignes

Pour chaque round, créer le dossier `.project/rounds/NNN/` puis `.project/rounds/NNN/spec.md` avec ce template :

```markdown
---
id: "NNN"
title: "Titre du round"
status: "available"
depends_on: []
---

## Objectifs

Description courte de l'objectif du round (1-2 phrases).

## Périmètre

- [ ] Feature 1 : description
- [ ] Feature 2 : description

## Mockups liés

<!-- Rempli par /roadmap PHASE 3 -->

## Tests fin de round

<!-- À compléter par /round-plan -->

## Compte-rendu

<!-- COMPTE_RENDU -->
<!-- Note : `/round-debrief` remplace la ligne ci-dessus par le compte-rendu structuré. Les notes ajoutées ici seront préservées mais apparaîtront sous le compte-rendu. -->
```

Créer aussi `.project/rounds/index.json` :

```json
{
  "version": 1,
  "rounds": [
    {
      "id": "001",
      "title": "Fondations",
      "status": "available",
      "depends_on": []
    },
    {
      "id": "002",
      "title": "CRUD principal",
      "status": "pending",
      "depends_on": ["001"]
    }
  ]
}
```

Et `.project/rounds/README.md` avec un tableau des rounds et une section
`## Comptes-rendus` vide (sera alimentée par `/round-debrief`).

Ne pas ajouter les liens mockup à cette étape - une phase dédiée s'en charge.

## PHASE 2 - Vérification exhaustive des features (OBLIGATOIRE)

Vérifier que CHAQUE feature de `app.md` est présente dans les fichiers `.project/rounds/*/spec.md`.

Procédure en boucle :

1. Appelle `kit_agent_dispatch` avec un agent d'exploration qui :
   - Relit app.md et extrait la liste complète des features
   - Relit tous les `.project/rounds/*/spec.md` et extrait la liste des features planifiées
   - Compare les deux listes
   - Retourne les features manquantes

2. Si features manquantes :
   - Les ajouter dans le round approprié (`.project/rounds/NNN/spec.md` + `index.json`)
   - Relancer la vérification
   - Répéter jusqu'à 0 feature manquante

3. Le rapport final doit être explicite :
   "VÉRIFICATION OK - X features dans app.md, X features dans rounds/, 0 manquante"

## PHASE 3 - Liaison des mockups (OBLIGATOIRE si `.project/mockups/pages/` existe)

But : garantir que chaque mockup HTML/PNG est référencé dans la (ou les) feature(s)
correspondante(s) des fichiers `.project/rounds/*/spec.md`, pour que `/code` puisse les transmettre
aux agents d'implémentation.

Si `.project/mockups/pages/` n'existe pas → skipper cette phase.

Sinon, procédure en boucle :

1. Appelle `kit_agent_dispatch` avec un agent d'exploration dédié et le prompt suivant :

```
Ton unique mission : mapper les mockups aux features des rounds.

Étapes :
1. Liste tous les fichiers `.project/mockups/pages/*.html` et `.project/mockups/png/*.png`
2. Lis tous les fichiers `.project/rounds/*/spec.md`
3. Pour CHAQUE mockup (par paire html + png de même nom) :
   - Déduis la page/feature que le mockup représente depuis son nom de fichier
     (ex: `restos-list.html` → page liste des restaurants)
   - Optionnel : ouvre le fichier HTML et lis le `<title>` + premiers `<h1>` pour confirmer
   - Identifie la (ou les) feature(s) dans les NNN/spec.md qui correspondent à cette page
     (une feature = 1 ligne `- [ ] Feature : description`)
   - Une même page peut être liée à PLUSIEURS features

4. Retourne un mapping strict au format JSON :
   {
     "pages/restos-list.html": [
       "002/spec.md > Liste des restaurants",
       "003/spec.md > Filtres par cuisine"
     ],
     "pages/dashboard.html": ["002/spec.md > Dashboard accueil"]
   }

5. Si un mockup ne match aucune feature → le signaler dans un champ séparé "unmapped".
6. Si une feature est clairement liée à une UI mais qu'aucun mockup ne correspond →
   pas besoin de le signaler (normal, les mockups ne sont pas exhaustifs).
```

2. Avec le mapping retourné, éditer chaque `.project/rounds/NNN/spec.md` concerné :
   - Dans la section `## Mockups liés`, ajouter pour chaque paire (mockup, feature) :
     `- Feature : pages/{nom}.html + png/{nom}.png`
   - Si la feature a déjà un lien mockup dans la section : ne pas dupliquer

3. Vérification finale : relancer un agent Explore avec le prompt :

   ```
   Compte le nombre de features dans les NNN/spec.md qui ont un lien mockup dans
   la section "## Mockups liés" et compare au nombre de mockups dans
   .project/mockups/pages/.
   Rapporte :
   - N mockups dans pages/
   - M features avec lien mockup
   - Liste des mockups non-référencés (si présents) dans "unmapped"
   ```

4. Si des mockups sont "unmapped" → afficher à l'utilisateur :
   "Ces mockups n'ont pas trouvé de feature correspondante : [liste].
   Veux-tu ajouter une feature pour chacun, ou les ignorer ?"
   Attendre sa réponse avant de continuer.

## PHASE 4 - Présentation à l'utilisateur

Ne JAMAIS présenter la roadmap avant d'avoir obtenu :

- "VÉRIFICATION OK - 0 feature manquante" (Phase 2)
- Mapping mockups complet ou explicitement validé avec des "unmapped" acceptés (Phase 3)

Affiche le plan visuellement et demande validation. L'utilisateur peut ajuster
(ajouter, supprimer, déplacer des features entre rounds).

Note : les autres fichiers `.project/` (app.md, design.md, index.md) ont déjà
été créés par `/start` et `/mockup`. Cette commande crée le dossier
`.project/rounds/` avec `index.json`, `README.md` et un dossier par round contenant `spec.md`.
