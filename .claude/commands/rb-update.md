Vérifie si la structure .project/ du projet est alignée avec la version courante du kit, et propose un plan de migration si nécessaire. À lancer après chaque MAJ du kit (typiquement après ./install.sh --from=...).


# /rb-update - Vérification post-MAJ du kit

## Quand l'utiliser

À lancer dans deux situations :

1. **Après une MAJ du kit** : tu viens de faire `./install.sh --from=...`
   et le script t'a affiché un message du genre « Kit mis à jour : 0.1.0 →
   0.2.0. Lance `/rb-update` pour vérifier les migrations. »
2. **En cas de doute** : tu te demandes si ton `.project/` est encore
   conforme à ce que le kit attend (typiquement après un long laps de temps
   sans MAJ, ou après avoir cloné le kit dans un projet existant pour la
   première fois).

## Ce que cette commande fait

Tu **invoques le sous-agent `kit-migrator`** via le tool Claude Code `kit_agent_dispatch`, point.

L'agent fait tout le travail :

1. Audit la structure actuelle de `.project/`
2. Compare avec ce que le kit (rules + prompts + section MIGRATIONS CONNUES)
   attend
3. Propose un plan de migration en langage humain
4. Te demande l'OK explicite via `request_user_choice`
5. Exécute après ton OK
6. Vérifie le résultat
7. Te rend un rapport final court

## Délégation

Lance une délégation Claude Code avec `kit_agent_dispatch` :

```
kit_agent_dispatch({
  tasks: [{
    agent: "kit-migrator",
    task: "Audit la structure .project/ du projet et propose un plan de migration si nécessaire. Suis ton workflow standard (5 phases). Si aucune divergence : rapport court. Si divergences : plan + demande OK + exécution."
  }]
})
```

Pas de prompt complexe à construire : l'agent a toutes ses règles dans son
propre fichier.

## Après l'exécution

Une fois la délégation terminée, affiche son rapport final à l'utilisateur tel quel.
Ne le reformule pas, ne le résume pas. C'est déjà court et factuel.

Si l'utilisateur a des questions de suivi, tu peux relancer la délégation
`kit-migrator` avec une consigne ciblée (ex. « re-vérifie le dossier rounds/
en détail »).

## Périmètre - ce que cette commande NE FAIT PAS

- Elle ne touche PAS au code applicatif (`src/`, `backend/`, etc.)
- Elle ne touche PAS au kit lui-même (`.claude/`)
- Elle ne lance PAS `install.sh` (c'est à l'utilisateur de le lancer en amont)
- Elle ne met PAS à jour les dépendances
