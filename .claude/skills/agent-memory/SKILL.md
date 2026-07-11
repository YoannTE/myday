---
name: agent-memory
description: >
  Systeme de memoire persistante par fichiers pour les agents reviewers.
  Declenche quand un agent reviewer doit lire ou ecrire sa memoire
  persistante. Fournit les 4 types de memoire (user, feedback, project,
  reference), le schema frontmatter, les regles d'indexation MEMORY.md,
  et le chemin de stockage.
  L'invocateur DOIT passer le chemin absolu complet dans son prompt :
  le skill ne derive jamais de chemin relatif.
  Declencheurs : "souviens-toi de", "mets a jour ta memoire", "oublie",
  "rappelle-toi", ou en debut/fin de revue selon l'instruction de l'agent.
allowed-tools:
  - "Read"
  - "Write"
  - "Edit"
  - "Bash"
---

# Skill agent-memory

## Prerequis : chemin absolu obligatoire

Le chemin de stockage doit etre passe en absolu par l'invocateur :
`<chemin-absolu-projet>/.claude/agent-memory/<nom-agent>/`

Ne construis JAMAIS ce chemin de facon relative. Si le chemin n'est pas
fourni dans ton prompt, demande-le avant d'agir.

## Creation du dossier si necessaire

Avant tout `Write`, verifie que le dossier existe :

```
`bash` avec `mkdir -p <chemin-absolu-projet>/.claude/agent-memory/<nom-agent>`
```

Cette commande est idempotente : elle ne fait rien si le dossier existe deja.

## Lire ta memoire

1. Lire `<chemin>/MEMORY.md` (index)
2. Pour chaque entree pertinente a la tache en cours, lire le fichier
   de memoire correspondant

Si `MEMORY.md` n'existe pas encore, tu pars de zero - c'est normal.

## Types de memoire

<types>
<type>
    <name>user</name>
    <description>Informations sur le role, les objectifs et les preferences
    de l'utilisateur. Permet de tailler les revues a son profil.</description>
    <when_to_save>Quand tu apprends des details sur le role, les preferences
    ou les connaissances de l'utilisateur.</when_to_save>
    <how_to_use>Pour adapter le niveau de detail et le ton de tes revues.</how_to_use>
    <examples>
    utilisateur : « Je suis CTO d'une startup de 5 personnes »
    -> [sauvegarde memoire user : CTO startup early-stage, contexte ressources
    limitees - favoriser les recommandations pragmatiques]
    </examples>
</type>
<type>
    <name>feedback</name>
    <description>Corrections et guidance que l'utilisateur t'a donnees.
    Evite de repeter les memes erreurs.</description>
    <when_to_save>Quand l'utilisateur corrige ton approche d'une facon
    applicable aux conversations futures.</when_to_save>
    <body_structure>Commence par la regle, puis une ligne **Pourquoi :**
    et une ligne **Comment appliquer :**.</body_structure>
    <examples>
    utilisateur : « arrete de proposer des solutions multi-tenant,
    on est mono-tenant pour les 2 prochaines annees »
    -> [sauvegarde memoire feedback : ne pas proposer multi-tenant.
    Pourquoi : decision strategique 2 ans. Comment appliquer : si une
    feature suggere du multi-tenant, la signaler comme hors-scope.]
    </examples>
</type>
<type>
    <name>project</name>
    <description>Informations sur le travail en cours, decisions et
    contexte non derivables du code ou de l'historique git.</description>
    <when_to_save>Quand tu apprends qui fait quoi, pourquoi ou avant
    quelle date. Convertis les dates relatives en dates absolues.</when_to_save>
    <body_structure>Commence par le fait/decision, puis **Pourquoi :**
    et **Comment appliquer :**.</body_structure>
    <examples>
    utilisateur : « on gele les migrations apres jeudi »
    -> [sauvegarde memoire project : gel des migrations a partir du
    2026-03-05. Pourquoi : release mobile. Comment appliquer : signaler
    tout changement de schema prevu apres cette date.]
    </examples>
</type>
<type>
    <name>reference</name>
    <description>Pointeurs vers des ressources externes (Linear, Slack,
    dashboards) et leur role dans le projet.</description>
    <when_to_save>Quand tu apprends ou trouver des informations dans
    des systemes externes.</when_to_save>
    <how_to_use>Quand l'utilisateur reference un systeme externe.</how_to_use>
    <examples>
    utilisateur : « les bugs sont dans le projet Linear ARCH »
    -> [sauvegarde memoire reference : bugs trackes dans Linear projet
    "ARCH"]
    </examples>
</type>
</types>

## Ce qu'il ne faut PAS sauvegarder

- Conventions de code, architecture, chemins de fichiers - derivables du code.
- Historique git ou qui a change quoi - `git log` est autoritaire.
- Solutions de debug ou recettes de fix - le fix est dans le code.
- Ce qui est deja documente dans CLAUDE.md.
- Etat temporaire de la conversation en cours.

## Comment sauvegarder une memoire (2 etapes)

**Etape 1** - ecrire le fichier memoire avec ce frontmatter :

```markdown
---
name: <nom de la memoire>
description: <une ligne - utilisee pour juger la pertinence future>
type: <user | feedback | project | reference>
---

<contenu - pour feedback/project : regle/fait, puis **Pourquoi :** et **Comment appliquer :**>
```

**Etape 2** - ajouter un pointeur dans `MEMORY.md` :

```markdown
- [<nom>](<fichier>.md) - <description courte>
```

`MEMORY.md` est un index pur : pas de frontmatter, pas de contenu memoire
direct. Il est charge dans chaque conversation - garde-le sous 200 lignes.

## Regles de gestion

- Avant d'ecrire une nouvelle memoire, verifie si une existante peut etre mise
  a jour. Pas de doublons.
- Organise par theme, pas chronologiquement.
- Supprime ou corrige les memoires devenues fausses.
- Les memoires de type `project` ont une duree de vie courte : inclure le
  **Pourquoi** aide a juger si elles sont encore valides.

## Quand acceder aux memoires

- Quand des memoires semblent pertinentes pour la tache en cours.
- Quand l'utilisateur semble referencer un travail anterieur.
- **Obligatoire** quand l'utilisateur demande explicitement de verifier
  ou rappeler quelque chose.
