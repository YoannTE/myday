Run deterministic QA for one implementation round with inventory, qa-tester dispatch, extension validation, retries and final report write


Lance la phase de test complete sur le round `$1`.

Le contenu metier des tests reste delegue a `qa-tester`, mais le verdict
officiel est **toujours** recalcule par l'extension `kit-qa-guard`. Ne jamais
marquer le round comme teste ou `done` sur la seule base du texte libre du
rapport.

## Ordre deterministe obligatoire

Tu DOIS executer les tools dans cet ordre exact. Ne saute aucune etape.

1. Appeler `qa_round_inventory` avec `round_id: "$1"`.
2. Attendre le resultat.
   - Si `ok=false`, STOPPER et afficher les `issues` a l'utilisateur.
3. Appeler `kit_agent_dispatch` avec `agent="qa-tester"` et une `task` contenant
   le contrat JSON `reborn.qa.testRound.v1` construit depuis l'inventaire.
4. Attendre le rapport complet du `qa-tester`.
5. Appeler `qa_report_validate` avec :
   - `round_id: "$1"`
   - `report_markdown: <rapport complet du qa-tester>`
6. Si `qa_report_validate.ok=false`, relancer `qa-tester` via
   `kit_agent_dispatch` avec les erreurs de validation.
   - Maximum 2 retries pour rapport invalide/incomplet.
   - Apres 2 echecs, STOPPER et demander une decision utilisateur.
7. Si `qa_report_validate.ok=true` mais `recalculatedVerdict="FAIL"` :
   - corriger les bugs ou deleguer les corrections selon les regles existantes ;
   - appeler `qa_iteration_record` pour tracer bugs/fixes/statut ;
   - relancer le meme cycle QA depuis l'etape 3.
8. Quand `qa_report_validate.ok=true` ET `recalculatedVerdict="PASS"`, appeler
   `qa_final_report_write` avec le rapport source valide.
9. Afficher a l'utilisateur le chemin du rapport final retourne par
   `qa_final_report_write` et la section `## Parcours a valider par toi`.

Interdictions :

- Ne jamais ecrire directement `.project/rounds/$1/test-report.md` avec write,
  edit ou bash.
- Ne jamais inventer `VERDICT: PASS` depuis le texte libre du rapport.
- Ne jamais passer le round `done` sans appel reussi a `qa_final_report_write`.

## Contrat a envoyer a `qa-tester`

La `task` de `kit_agent_dispatch` DOIT inclure ce contrat, en remplacant les
valeurs par celles retournees par `qa_round_inventory` :

```json
{
  "schema": "reborn.qa.testRound.v1",
  "roundId": "$1",
  "mode": "happy-path-and-adversarial",
  "inventory": {
    "filesTouched": "<qa_round_inventory.filesTouched>",
    "endpointsTouched": "<qa_round_inventory.endpointsTouched>",
    "pagesTouched": "<qa_round_inventory.pagesTouched>",
    "backendOnly": "<qa_round_inventory.backendOnly>",
    "dockerPresent": "<qa_round_inventory.dockerPresent>",
    "playwrightApplicable": "<qa_round_inventory.playwrightApplicable>"
  },
  "requiredOutput": {
    "humanReport": true,
    "jsonBlock": {
      "begin": "BEGIN_QA_RESULT_JSON",
      "end": "END_QA_RESULT_JSON",
      "schema": "reborn.qa.testRound.result.v1"
    }
  },
  "constraints": {
    "readOnly": true,
    "mustNotWriteFinalReport": true,
    "mustCoverSmoke": true,
    "mustCoverDockerWhenPresent": true,
    "mustCoverPlaywrightWhenApplicable": true,
    "mustProduceChecksByCategory": true
  }
}
```

## Protocole attendu du `qa-tester`

Demande au `qa-tester` de couvrir deux angles dans son rapport :

1. **Happy path** : build/types/tests existants, Docker si present, endpoints et
   pages du round, boutons/formulaires nominaux.
2. **Adversarial** : formulaires invalides, endpoints avec payloads invalides,
   etats vides/erreur, navigation/concurrence basique.

Le rapport humain DOIT contenir :

- `## Smoke`
- `## Docker`
- `## Playwright`
- `## Bugs trouves`
- `## Parcours a valider par toi`

Il DOIT terminer par exactement un bloc `BEGIN_QA_RESULT_JSON` /
`END_QA_RESULT_JSON` conforme a `reborn.qa.testRound.result.v1`.

## Rapport final

Seul `qa_final_report_write` ecrit `.project/rounds/$1/test-report.md`. Ce tool
ajoute la preuve structuree `validatedByExtension: true` consommee par
`kit-workflow-policy` avant d'autoriser le passage du round a `done`.
