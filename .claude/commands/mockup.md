Genere les mockups des interfaces du projet en HTML statique
et exporte des PNG de reference pour la phase de code.

**REGLE UI** : avant chaque Write/Edit long de
`.project/mockups/**/*.html` ou `.project/mockups/roadmap.md`, appelle
d'abord `notify_writing({ file_path: "<chemin>" })` pour afficher
l'animation plume cote UI pendant la redaction. Cf. CLAUDE.md section
« Hook `notify_writing` ». Ignorer si tu n'as pas ce tool.

Cette commande est un orchestrateur. Elle verifie les prerequis, lance le
serveur de preview, puis delegue la generation a 3 sous-commandes :

1. `/mockup-prepare` (Phase 1) - identification des ecrans + ecran-pilote +
   construction du glossaire data → schema + sauvegarde dans
   `.project/mockups/roadmap.md`. Si la roadmap existe deja, cette phase est
   sautee et la generation reprend au prochain ecran non coche.
2. `/mockup-screens` (Phase 2) - generation iterative des ecrans HTML,
   validation visuelle d'abord (avec ajustements eventuels), PUIS audit
   schema vs UI une fois le HTML fige (gaps tranches en concertation avec
   l'utilisateur), coherence inter-mockups, ecrans coches au fur et a mesure
   dans la roadmap (reprise possible apres interruption).
3. `/mockup-export` (Phase 3) - screenshots PNG + galerie finale + maj
   `.project/app.md` avec les references mockups par feature.

Chaque sous-commande peut aussi etre relancee manuellement.

---

## Prerequis

Cette commande necessite que le design soit deja valide.
Verifier que `.project/design.md` ET `.project/mockups/shared/design-system.css`
existent.

Si l'un des deux manque → s'arreter immediatement :

> « Le design n'est pas encore valide. Lance `/design` d'abord pour explorer
> les directions et valider l'identite visuelle. »

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
> Les pages touchant aux workflows IA seront esquissees a haut niveau (sans connaître les paramètres exposés, les points HITL, ni les feedbacks utilisateur pendant l'exécution). Ces mockups risquent d'etre a refaire apres `/agent-design`.
>
> **Recommande** : interrompre maintenant, lancer `/agent-design`, puis relancer `/mockup`.
>
> Tu peux continuer quand meme si tu veux un brouillon rapide.

Si `HAS_AGENT_DESIGN` = "yes" ET `HAS_AGENT_DETAIL` = "0" (section absente ou vide) :

> ⚠ **Le workflow SDK-native est conçu mais le détail des steps n'est pas cadré (`/agent-detail` pas lancé).**
>
> Tu peux continuer `/mockup`, les pages utilisateur qui déclenchent les workflows seront utilisables. Mais si certaines pages exposent les **paramètres Config** des workflows ou les UI **HITL**, lance `/agent-detail` d'abord pour avoir le détail.

(Ne pas bloquer la commande - continuer dans tous les cas apres l'avertissement.)

## Serveur de preview (auto)

L'utilisateur est NON-TECHNIQUE. Il ne doit JAMAIS avoir a lancer un serveur
HTTP lui-meme. TOI tu lances le serveur en arriere-plan et tu lui donnes
juste l'URL a ouvrir.

**Des qu'il y a quelque chose a visualiser** (ecran-pilote, ecrans suivants,
galerie finale), verifier que le serveur tourne et donner l'URL.
N'ATTENDS PAS que l'utilisateur le fasse.

Procedure :

1. Verifier si le serveur tourne deja :

   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null || echo "down"
   ```

   Si la reponse est 200 ou un autre code HTTP (pas "down"), le serveur tourne
   deja → skip le demarrage.

2. Sinon, lancer le serveur Python en arriere-plan avec le Bash tool
   `run_in_background: true` :

   ```bash
   python3 -m http.server 8080 -d .project/mockups
   ```

   Si le port 8080 est deja pris, essayer 8081, 8082... jusqu'a trouver un
   port libre.

3. Donner a l'utilisateur UNIQUEMENT l'URL a ouvrir (jamais la commande shell) :

   > « Ouvre http://localhost:8080/ dans ton navigateur pour suivre l'avancement. »

4. Quand la session se termine, laisser le serveur tourner : il est pratique
   que l'utilisateur puisse revenir voir les mockups plus tard. Python sert
   dynamiquement le filesystem donc pas besoin de le redemarrer apres
   modification de fichiers.

## Sequence des phases

Apres les prerequis et le lancement du serveur :

### 1. Phase 1 - Preparation

Invoquer `/mockup-prepare`.

Cette commande :

- Verifie si `.project/mockups/roadmap.md` existe deja → si oui, saute Phase 1
  et signale a l'utilisateur le prochain ecran a generer (reprise)
- Sinon, lit `.project/design.md`, `.project/app.md` (sections `## Entites`
  et `## Fonctionnalites`), et `.project/decisions.md` (decisions
  structurantes de display)
- Identifie 5 a 8 ecrans, designe l'ecran-pilote
- Construit un glossaire data → schema par ecran (chaque donnee affichee
  mappee a `table.colonne`, jointure, agregation, ou champ JSONB)
- Sauvegarde la roadmap (checklist + glossaire + decisions) dans
  `.project/mockups/roadmap.md`
- Demande validation de la transition vers Phase 2

Attendre la fin de `/mockup-prepare` avant de continuer.

### 2. Phase 2 - Generation des ecrans

Invoquer le skill `mockup-screens-generator` via l'outil Skill, en lui passant :

- Le chemin de `.project/design.md` (tokens, direction, principes design)
- Le chemin de `.project/mockups/roadmap.md` (checklist + glossaire + decisions)
- Le chemin de `.project/app.md` (entites courantes)

Le skill s'execute dans une fenetre forkee (n'occupe pas la fenetre principale)
et :

- Genere l'ecran-pilote en invoquant `frontend-design`, puis les ecrans suivants
- Pour CHAQUE ecran : validation visuelle (boucle avec l'utilisateur), audit
  schema vs UI, gaps tranches par l'utilisateur, mise a jour `app.md` si besoin
- Trace toutes ses decisions de Phase 2 dans `.project/mockups/_phase2-decisions.md`
  (ecrans generes, gaps acceptes/rejetes, champs ajoutes a `app.md`, iterations)

Attendre la fin du skill avant de continuer.

**Apres la fin du skill, AVANT de passer en Phase 3 :**

- Relire `.project/mockups/_phase2-decisions.md` pour recuperer le contexte
  des decisions prises pendant la Phase 2 (le skill forke ne pollue pas la
  fenetre principale, donc le parent ne les voit qu'a travers ce fichier).
- Relire `.project/app.md` (qui a pu evoluer si des champs ont ete ajoutes
  pendant la Phase 2).
- Confirmer a l'utilisateur le passage en Phase 3.

### 3. Phase 3 - Export PNG + galerie

Invoquer `/mockup-export`.

Cette commande :

- Installe Playwright (premiere fois uniquement)
- Genere un PNG par ecran HTML dans `.project/mockups/png/`
- Regenere `.project/mockups/index.html` final avec les PNG integres
- Met a jour `.project/app.md` avec les references HTML + PNG par feature
- Affiche le resume final

## Bilan final

A la fin des 3 phases, confirmer brievement :

```
Mockups termines : [N] ecrans HTML + [N] PNG generes, schema audite.

- Galerie : http://localhost:8080/
- Reference visuelle pour /code : .project/mockups/png/
- Schema (`## Entites` de app.md) eventuellement enrichi des champs ajoutes
  pendant l'audit pour combler les gaps UX

Tu peux maintenant lancer /roadmap pour planifier les rounds de code,
ou /code directement si la roadmap de developpement est deja prete.
```

## Principes (rappel)

- Generer ecran par ecran avec validation, pas tout d'un coup
- Expliquer ce qui a ete genere a chaque fois, pas juste montrer
- Les composants partages garantissent la coherence
- Les PNG generes servent de reference visuelle pendant `/code`
  (les images marchent mieux que le HTML seul pour l'inspiration)
- HTML + PNG sont complementaires : le PNG donne l'intention,
  le HTML donne la structure exacte
- TOUJOURS relire `design.md` avant de generer un ecran pour respecter
  les tokens, composants et principes valides
- TOUJOURS auditer le schema vs UI avant validation : un mockup qui affiche
  des donnees non-mappables est un mockup faux
- La roadmap `.project/mockups/roadmap.md` est la source de verite pour la
  reprise : si interruption, `/mockup-prepare` la detecte et reprend au
  prochain ecran non coche

## Fichiers generes

```
.project/mockups/
  roadmap.md                     # Liste des ecrans + glossaire + decisions (source de verite reprise)
  index.html                     # Galerie
  shared/
    design-system.css            # Tokens du projet (par /design)
    tailwind-tokens.js           # Config Tailwind JS (par /design)
    base.css                     # Reset (par /design)
    components-loader.js         # Loader data-include (par /design)
    components/
      navbar.html
      sidebar.html
      footer.html
  pages/
    home.html                    # Ecrans finaux
    ...
  png/
    home.png                     # Screenshots pour /code
    ...
```
