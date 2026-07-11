Phase 3 du mockup : generer les screenshots PNG des ecrans HTML, finaliser
la galerie, et mettre a jour `.project/app.md` avec les references aux mockups
par feature/page.

Cette commande est invoquee automatiquement par `/mockup` apres `/mockup-screens`,
mais peut aussi etre lancee manuellement pour regenerer les screenshots apres
des modifications HTML.

Prerequis :

- `.project/mockups/pages/*.html` doit contenir au moins un ecran
  (genere par `/mockup-screens`)
- `.project/mockups/index.html` doit exister
- `.project/mockups/roadmap.md` doit etre entierement cochee (tous les ecrans
  generes ET audites schema)
- `.claude/tools/mockups/` doit contenir `package.json` et `screenshot.mjs`
  (ou utiliser le chemin du starterkit si absent du projet)

Sortie :

- `.project/mockups/png/{nom}.png` pour chaque ecran HTML
- `.project/mockups/index.html` (galerie finale avec PNG integres)
- `.project/app.md` enrichi des references HTML + PNG par feature/page

---

## Etape 3A : Installation des outils Playwright

Installer Playwright dans `~/.pi-tools/mockups/` (premiere fois uniquement,
transparent pour l'utilisateur) :

```bash
TOOLS_DIR="$HOME/.pi-tools/mockups"
if [ ! -d "$TOOLS_DIR/node_modules/playwright" ]; then
  echo "Installation des outils de screenshot (premiere fois uniquement)..."
  mkdir -p "$TOOLS_DIR"
  cp .claude/tools/mockups/package.json "$TOOLS_DIR/"
  cd "$TOOLS_DIR" && npm install && npx playwright install chromium
fi
```

Note : si `.claude/tools/mockups/` n'existe pas dans le projet actuel, utiliser
le chemin du starterkit directement.

Copier le script `screenshot.mjs` vers `$TOOLS_DIR/` (toujours a jour) :

```bash
cp .claude/tools/mockups/screenshot.mjs "$TOOLS_DIR/"
```

## Etape 3B : Generation des screenshots

Lancer les screenshots :

```bash
cd "$TOOLS_DIR" && node screenshot.mjs "$PWD/.project/mockups"
```

Retour : un .png par .html dans `.project/mockups/png/`.

## Etape 3C : Galerie finale

Regenerer `.project/mockups/index.html` une derniere fois pour integrer les PNG.
Cette version finale sert de dashboard complet des mockups livres.

L'index doit contenir :

1. Titre et pitch du projet (depuis `.project/index.md`)
2. Section Pages : une carte par page avec mini-apercu (PNG) + lien direct
3. Section Composants partages : liste des composants
4. Section Screenshots : grille des PNG cliquables (reference pour `/code`)
5. Meta : date de derniere maj, nombre d'ecrans, nombre de composants extraits

Style : utiliser `shared/design-system.css` pour coherence visuelle.

## Etape 3D : Mise a jour de `.project/app.md`

Pour CHAQUE page/feature qui a un mockup :

- Ajouter une reference au HTML correspondant : `.project/mockups/pages/{nom}.html`
- Ajouter une reference au PNG correspondant : `.project/mockups/png/{nom}.png`

Pattern d'ajout dans `app.md` (sous chaque feature concernee dans la section
`## Fonctionnalites`) :

```markdown
- Mockup : `.project/mockups/pages/{nom}.html` + `.project/mockups/png/{nom}.png`
```

Cette etape garantit que `/code` (qui lit `app.md` au debut de chaque round)
trouve immediatement le HTML et le PNG de reference pour chaque page a
implementer.

## Etape 3E : Resume final

Verifier que le serveur de preview tourne (gere par `/mockup`).
Afficher le resume :

```
Mockups prets ! [N] ecrans + [M] composants partages.

- Galerie complete : http://localhost:8080/
- HTML : .project/mockups/pages/
- Screenshots PNG : .project/mockups/png/ (reference visuelle pour /code)
- Composants partages : .project/mockups/shared/components/

Le serveur tourne en arriere-plan : tu peux revenir voir les mockups
a tout moment tant que tu ne fermes pas ton terminal Claude Code.
```

---

→ **CHECKPOINT FIN DE PHASE 3 (FIN DU MOCKUP)** :

**1. Verifier que tous les outputs sont en place** :

- Verifier que `.project/mockups/png/` contient un PNG par ecran HTML
  present dans `.project/mockups/pages/`
- Verifier que `.project/mockups/index.html` integre les PNG (section
  Screenshots presente)
- Verifier que `.project/app.md` reference les mockups (HTML + PNG) pour
  chaque feature concernee
- Si un PNG manque → relancer `node screenshot.mjs` pour cet ecran avant
  de cloturer

**2. Cloturer la phase mockup** :

Apres l'affichage du resume, ne rien faire d'autre - attendre que
l'utilisateur lance `/roadmap` ou `/code` pour la suite.

Les fichiers PNG dans `.project/mockups/png/` seront automatiquement
consultes par `/code` (lors de la phase d'implementation des pages)
pour garantir la fidelite visuelle au design valide.
