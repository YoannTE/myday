---
name: output-format
description: >
  Standardise le bloc de sortie des agents de code (nextjs-developer,
  postgres-developer, fastapi-developer) : section "Fichiers touches"
  avec annotations cree/modifie/supprime, puis ecriture idempotente
  dans le log de round.
  Declencheurs : fin de toute tache de code impliquant des fichiers.
---

# Skill output-format - Rapport de fichiers touches

A la fin de toute tache, produis les deux blocs ci-dessous dans cet ordre.

---

## Bloc 1 - Section "## Fichiers touches"

Produis une section markdown avec **exactement** ce titre et ce format :

```markdown
## Fichiers touches

- src/components/mon-composant.tsx (cree)
- src/lib/db/schema.ts (modifie)
- src/lib/db/migrations/0005_xxx.sql (cree)
```

Regles :

- Une ligne par fichier, chemin relatif depuis la racine du projet
- Annotation obligatoire entre parentheses : `(cree)`, `(modifie)` ou `(supprime)`
- Ne lister que les fichiers que TU as crees/modifies/supprimes dans cette tache
- Exclure les fichiers lus en lecture seule (Read, Glob, Grep ne comptent pas)
- Pour les fichiers generes par CLI (ex: `drizzle/0004_xxx.sql` apres `npm run db:generate`),
  faire un `Glob` pour recuperer les chemins exacts avant d'ecrire ce bloc
- Si aucun fichier modifie : produire `Aucun fichier modifie.` a la place de la liste

---

## Bloc 2 - Ecriture dans le log de round

NOTE : ce mecanisme suppose que `## Fichiers touches` est la derniere section
du log de round. C'est garanti par la structure definie dans `commands/code.md`
(ETAPE B INIT et ETAPE E CLOTURE).

A la fin de ta tache, execute un bloc Bash qui ajoute tes VRAIS fichiers
au log de round.

ATTENTION : les lignes `REMPLACER_PAR_...` sont des marqueurs intentionnels.
Tu DOIS les remplacer par les memes lignes que tu viens de produire dans ton
bloc `## Fichiers touches` ci-dessus. Ne JAMAIS executer ce patron tel quel.

```bash
# Etape 1 : definir l'id du round depuis la variable ROUND_ID de ton prompt
# ROUND_ID doit etre le numero 3 chiffres avec padding (ex: 001, 002, 015)
export ROUND_ID=<valeur de ROUND_ID dans ton prompt>
ROUND_LOG=".project/rounds/${ROUND_ID}/log.md"

# Etape 2 : si le log existe, ajouter UNE LIGNE PAR FICHIER que TU as touche
# Remplacer ci-dessous par TES vrais chemins, exactement comme dans ton
# bloc "## Fichiers touches" produit juste au-dessus
if [ -f "$ROUND_LOG" ]; then
  for entry in \
    "REMPLACER_PAR_TON_PREMIER_FICHIER (cree)" \
    "REMPLACER_PAR_TON_DEUXIEME_FICHIER (modifie)"; do
    grep -qF "$entry" "$ROUND_LOG" || echo "- $entry" >> "$ROUND_LOG"
  done
fi
```

Si aucun fichier modifie : ne pas executer le bloc Bash (pas d'entree vide
dans le log).

Si le log de round n'existe pas (ROUND_LOG absent) : exit 0 silencieux,
ne pas creer le fichier.

---

## Regles strictes

- Ne JAMAIS omettre l'annotation `(cree)`, `(modifie)` ou `(supprime)`
- Ne JAMAIS lister un fichier que tu as seulement lu
- Ne JAMAIS copier le patron Bash tel quel avec les marqueurs `REMPLACER_PAR_...`
- Ne JAMAIS creer le log de round s'il n'existe pas deja
- Le `export ROUND_ID=` doit utiliser la valeur reelle de ROUND_ID
  transmise dans le prompt par `round-implement`, pas un placeholder
