---
name: foundations-pull
description: Pose les fondations d'un projet client à partir d'une image Docker pré-cuite (catalogue R45) au lieu de tout scaffolder via init-postgres. À utiliser pendant le Round 000 « Fondations » de /code, quand la roadmap a sélectionné une image et que `.project/.foundations.json` n'existe pas encore en `status: "complete"`. Tire l'image par digest épinglé depuis le registry privé, extrait le scaffold, installe les dépendances localement, démarre les services et fait un smoke check. Fallback systématique vers init-postgres / init-postgres-fastapi si l'image est indisponible, incompatible ou si une étape échoue - le projet n'est jamais bloqué ni à moitié posé.
---

# Foundations pull - phase 0 « Fondations » (R45)

## Vue d'ensemble

Au lieu de scaffolder un projet de zéro (`init-postgres`, long et coûteux en
points), on tire une **image de fondations** déjà cuite (scaffold source +
lockfile portable + `docker-compose.yml`, **sans `node_modules`**) depuis un
registry Docker privé, on extrait le scaffold, on installe les dépendances
localement et on démarre les services. Le Round 1 de `/code` part de
fondations posées.

Deux marqueurs distincts encadrent l'opération :

- `project.init_step = 'foundations_pulled'` (BDD) - progression, posé **après
  extraction validée**, avant l'installation et le smoke check.
- `.project/.foundations.json` avec `status: "complete"` (fichier) - succès
  complet, écrit **seulement après le smoke check passé**.

Cette séparation permet de distinguer « jamais lancé » d'« interrompu à
mi-chemin ». La phase 0 est **gratuite** pour le client (0 point débité).

## Quand utiliser

- Pendant le Round 000 « Fondations » de `/code`, quand la roadmap a inscrit ce
  round (cf. `.claude/commands/roadmap.md`).
- Uniquement si `.project/.foundations.json` est absent ou a
  `status: "partial"` (sinon les fondations sont déjà posées : ne rien faire).

## Pré-requis d'environnement

Le process kit dispose, en mode Reborn productif, des variables d'environnement
suivantes (posées par le sidecar) :

- `REBORN_PROXY_URL` - base URL du backend Reborn (les endpoints REST `/api/*`
  passent par cette URL au même titre que les appels LLM).
- `REBORN_DEVICE_TOKEN` - token de session de l'agence (consommé en
  `Authorization: Bearer …`, accepté par `get_current_user`).
- `REBORN_PROJECT_ID` - UUID du projet client courant.

Si l'une de ces variables est absente (mode CLI standalone, hors Reborn), la
phase 0 n'est pas applicable : **basculer immédiatement sur le scaffolding
classique** (`init-postgres` / `init-postgres-fastapi`) sans message d'erreur.

Outils requis : `docker` (login, pull, create, cp, compose), `curl`, `jq`,
`npm`. Si `docker` n'est pas disponible ou que le daemon ne tourne pas →
fallback `init-*` avec le message : « Docker n'est pas démarré - on pose les
fondations depuis zéro. »

## Timeout

La phase 0 a un **timeout dédié de 20 minutes**, distinct du timeout standard
des rounds. Le téléchargement d'une image peut être long sur une connexion
lente. Au-delà de 20 minutes sans progression → rollback + fallback `init-*`.

---

## Séquence d'exécution stricte (9 étapes)

Toute la séquence se fait depuis la racine du projet client. Les jalons UX
(jamais le log brut) sont annoncés via `notify_activity` quand le tool est
disponible. **Français correctement accentué partout. Jamais de tiret cadratin
(remplacer par un tiret simple, deux-points ou virgule).**

### Préambule - variables et trap logout

Définir les variables et **armer immédiatement le trap de logout** : `docker
logout` doit être appelé en sortie de séquence (succès comme échec), confirmé
dans le log. C'est la garantie SOP 1 (aucun credential ne reste dans
`~/.docker/config.json`).

```bash
set -euo pipefail

BACKEND_URL="${REBORN_PROXY_URL:?phase 0 non applicable sans backend}"
AUTH="Authorization: Bearer ${REBORN_DEVICE_TOKEN:?token agence manquant}"
PROJECT_ID="${REBORN_PROJECT_ID:?projet courant manquant}"
KIT_VERSION="$(cat .claude/.installed-version 2>/dev/null || echo '0.0.0')"

# Renseigné dès que le login registry a réussi (utilisé par le trap).
REGISTRY_HOST=""
# Renseigné dès que l'image est tirée (utilisé par le rollback).
CONTAINER_ID=""

cleanup_logout() {
  if [ -n "$REGISTRY_HOST" ]; then
    docker logout "$REGISTRY_HOST" >/dev/null 2>&1 \
      && echo "[fondations] docker logout $REGISTRY_HOST : OK" \
      || echo "[fondations] docker logout $REGISTRY_HOST : échec (non bloquant)"
  fi
}
trap cleanup_logout EXIT
```

`set -euo pipefail` garantit qu'une commande qui échoue interrompt la séquence
et déclenche le rollback (cf. section « Rollback »), tout en laissant le trap
`EXIT` exécuter le logout dans tous les cas.

### Étape 1 - Re-fetch du catalogue (zéro confiance au slug stocké)

Au moment de l'exécution, **re-appeler** `GET /api/app-images`. Ne jamais faire
confiance au slug ni au digest stockés dans la roadmap : l'image a pu être
désactivée ou republiée entre `/roadmap` et `/code`.

Jalon UX : « Connexion au catalogue... »

```bash
CATALOG="$(curl -sf -H "$AUTH" \
  "$BACKEND_URL/api/app-images?kit_version=$KIT_VERSION" || true)"
```

- Si l'appel échoue (registry/backend injoignable, `$CATALOG` vide) →
  **fallback registry indisponible** (cf. « Messages de fallback »).
- Le slug visé est celui décidé par `/roadmap` (lu dans les décisions du projet
  client). Extraire la fiche correspondante :

```bash
IMAGE="$(echo "$CATALOG" | jq -c \
  --arg slug "$TARGET_SLUG" '.data.images[] | select(.slug == $slug)')"
```

- Si `$IMAGE` est vide (l'image visée n'est plus active/publiée, ou plus
  compatible avec ce kit) → **fallback `init-*`** avec le message adapté.
  **Ne JAMAIS re-sélectionner silencieusement une autre image** : le choix doit
  rester celui justifié dans les décisions du projet, ou bien on tombe sur le
  scaffolding classique.

Extraire les coordonnées de pull (structure imbriquée `version`) :

```bash
REGISTRY_REF="$(echo "$IMAGE" | jq -r '.registry_ref')"
DIGEST="$(echo "$IMAGE" | jq -r '.version.digest')"
TAG="$(echo "$IMAGE" | jq -r '.version.tag')"
VERSION_ID="$(echo "$IMAGE" | jq -r '.version.id')"
SIZE_BYTES="$(echo "$IMAGE" | jq -r '.version.compressed_size_bytes // 0')"
NAME="$(echo "$IMAGE" | jq -r '.name')"
MIN_KIT="$(echo "$IMAGE" | jq -r '.version.min_kit_version // "0.0.0"')"
REGISTRY_HOST="${REGISTRY_REF%%/*}"   # ex: registry.reborn.dev
IMAGE_PINNED="${REGISTRY_REF}@${DIGEST}"
```

Le backend filtre déjà par `min_kit_version` (le `?kit_version` exclut les
versions incompatibles). Si malgré tout `$IMAGE` est vide alors que le slug
existe au catalogue sans `kit_version`, c'est un cas `min_kit_version` non
satisfaite → **message « kit trop ancien »** (cf. fallback).

### Étape 2 - Check du cache local par digest

Si l'image est déjà présente localement (2e projet de la même agence), on saute
le téléchargement.

```bash
if docker image inspect "$IMAGE_PINNED" >/dev/null 2>&1; then
  echo "[fondations] Image déjà présente - pull ignoré."
  IMAGE_CACHED=1
else
  IMAGE_CACHED=0
fi
```

Si `IMAGE_CACHED=1` : jalon UX « Image déjà présente, fondations posées en ~30
secondes. » et passer directement à l'étape 5 (extraction). **Ne pas faire de
`docker login` ni de pull inutiles.**

### Étape 3 - Annonce taille + durée AVANT le pull

Si l'image n'est pas en cache, annoncer **avant** de lancer le pull la taille et
une estimation de durée. Ne jamais lancer un téléchargement de plusieurs Go en
silence.

```bash
SIZE_GO="$(awk "BEGIN { printf \"%.1f\", $SIZE_BYTES / 1073741824 }")"
# Estimation prudente : ~3 min par Go (couvre une connexion modeste).
EST_MIN="$(awk "BEGIN { m = ($SIZE_BYTES / 1073741824) * 3; printf \"%d\", (m < 1 ? 1 : m) }")"
```

Jalon UX : « Téléchargement des fondations (~${SIZE_GO} Go, environ ${EST_MIN}
min)... »

### Étape 4 - Login + pull par digest épinglé

Récupérer les credentials pull-only **au moment du pull** (ne jamais les
persister), puis `docker login` via **`--password-stdin` uniquement** (jamais
`-p`, jamais le mot de passe dans une commande visible : SOP 1, `ps aux` lit les
arguments). Pull **par digest** (immuable), jamais par tag.

```bash
CREDS="$(curl -sf -H "$AUTH" \
  "$BACKEND_URL/api/app-images/registry-credentials")" \
  || { echo "[fondations] credentials registry indisponibles"; exit 1; }

REG_URL="$(echo "$CREDS" | jq -r '.data.registry_url')"
REG_USER="$(echo "$CREDS" | jq -r '.data.username')"
REG_PASS="$(echo "$CREDS" | jq -r '.data.password')"
REGISTRY_HOST="${REG_URL#http*://}"   # normalise pour login/logout

printf '%s' "$REG_PASS" | docker login "$REGISTRY_HOST" \
  --username "$REG_USER" --password-stdin
unset REG_PASS CREDS   # ne pas garder le secret en mémoire shell

docker pull "$IMAGE_PINNED"
```

- **Ne jamais `echo` le mot de passe, ne jamais le passer en argument, ne jamais
  l'écrire dans un fichier.** Le seul transit autorisé est stdin de `docker
login`.
- Échec du login (401) ou du pull → rollback + fallback (registry indisponible).

### Étape 5 - Extraction + validation des fichiers attendus

Extraire le scaffold de l'image via un container éphémère
(`docker create` + `docker cp /scaffold/.`), puis valider la présence des
fichiers attendus avant d'aller plus loin.

Jalon UX : « Extraction du projet... »

```bash
CONTAINER_ID="$(docker create "$IMAGE_PINNED")"
docker cp "$CONTAINER_ID:/scaffold/." .
docker rm "$CONTAINER_ID" >/dev/null
CONTAINER_ID=""   # container retiré : plus rien à nettoyer côté Docker

# Validation : fichiers minimaux d'un scaffold valide.
for f in package.json package-lock.json docker-compose.yml; do
  [ -f "$f" ] || { echo "[fondations] fichier attendu manquant : $f"; exit 1; }
done
```

Toute absence d'un fichier attendu déclenche le rollback (l'image est corrompue
ou non conforme).

### Étape 6 - PATCH init_step='foundations_pulled'

Le scaffold est extrait et validé. Marquer la progression côté BDD. **À partir
de ce point, tout échec ultérieur devra re-PATCHer `init_step` vers l'état
précédent** (cf. « Rollback BDD »).

```bash
PREV_INIT_STEP="ram_mounted"   # état réel posé avant la phase 0 (cf. note ci-dessous)

curl -sf -X PATCH -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"init_step":"foundations_pulled"}' \
  "$BACKEND_URL/api/projects/$PROJECT_ID" >/dev/null \
  || { echo "[fondations] PATCH init_step a échoué"; exit 1; }

INIT_STEP_PATCHED=1   # à partir d'ici, le rollback doit re-PATCHer
```

Note état précédent : à la fin de la création du draft, le projet est en
`init_step='ram_mounted'` (orchestration `create-draft-project.ts` : draft →
`cloned_locally` → `ram_mounted`). La phase 0 le fait passer à
`foundations_pulled`. Le rollback restaure donc **`ram_mounted`**.

### Étape 7 - Ports libres + install + services + smoke check

Attribuer des ports libres (le compose du scaffold lit ses ports depuis des
variables d'env, ex. `POSTGRES_EXTERNAL_PORT`, `MINIO_EXTERNAL_PORT`,
`APP_PORT`), installer les dépendances (lockfile portable fourni), démarrer les
services et faire un smoke check précis.

Jalons UX : « Installation des dépendances... » puis « Démarrage des
services... ».

```bash
# Helper : trouve un port TCP libre.
free_port() {
  python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
}

APP_PORT="$(free_port)"
POSTGRES_EXTERNAL_PORT="$(free_port)"
MINIO_EXTERNAL_PORT="$(free_port)"
MINIO_CONSOLE_PORT="$(free_port)"
export APP_PORT POSTGRES_EXTERNAL_PORT MINIO_EXTERNAL_PORT MINIO_CONSOLE_PORT

npm install                       # lockfile portable : install reproductible
docker compose up -d              # Postgres + MinIO sur les ports attribués
```

Smoke check : healthchecks des services puis `curl -sf` sur le port applicatif
**lu depuis le compose extrait** (ne pas deviner le port), avec timeout
explicite.

```bash
# Attente bornée des healthchecks Postgres + MinIO (90 s max).
deadline=$(( $(date +%s) + 90 ))
until docker compose ps --format json | jq -e \
  'all(.[]; .Health == "healthy" or .Health == "")' >/dev/null 2>&1; do
  [ "$(date +%s)" -lt "$deadline" ] || { echo "[fondations] services pas sains"; exit 1; }
  sleep 3
done

# Le scaffold démarre l'app en dev local (hors compose, sur le Mac).
npm run dev >/tmp/foundations-dev.log 2>&1 &
DEV_PID=$!

ok=0
deadline=$(( $(date +%s) + 60 ))
until [ "$(date +%s)" -ge "$deadline" ]; do
  if curl -sf "http://localhost:${APP_PORT}" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
kill "$DEV_PID" >/dev/null 2>&1 || true

[ "$ok" -eq 1 ] || { echo "[fondations] smoke check KO sur le port $APP_PORT"; exit 1; }
```

- **Conflit de port détecté** (compose ou dev qui échoue à binder) → message
  explicite « Un port est déjà occupé. » + rollback + fallback. Ne jamais
  laisser une erreur silencieuse.
- **Échec du smoke check** → rollback **complet, y compris le re-PATCH BDD**
  (cf. ci-dessous), puis fallback `init-*`.

### Étape 8 - Écriture de `.foundations.json` (APRÈS smoke check seulement)

Le smoke check est passé : on peut acter les fondations. Écrire
`.project/.foundations.json` **seulement maintenant**.

```bash
mkdir -p .project
cat > .project/.foundations.json <<JSON
{
  "slug": "$TARGET_SLUG",
  "name": "$NAME",
  "tag": "$TAG",
  "digest": "$DIGEST",
  "app_image_version_id": "$VERSION_ID",
  "status": "complete",
  "pulled_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
```

Schéma de `.foundations.json` :

| Champ                  | Type   | Rôle                                                  |
| ---------------------- | ------ | ----------------------------------------------------- |
| `slug`                 | string | Slug de l'image (ex: `base-nextjs`)                   |
| `name`                 | string | Nom affiché dans la fiche projet                      |
| `tag`                  | string | Tag de la version posée (ex: `v1.0.0`)                |
| `digest`               | string | Digest épinglé tiré (sha256...)                       |
| `app_image_version_id` | string | Id de version, requis pour `POST .../pulled`          |
| `status`               | string | `"complete"` (smoke check OK) ou `"partial"` (repris) |
| `pulled_at`            | string | Horodatage ISO 8601 UTC                               |

### Étape 9 - Télémétrie pulled + commit + logout

Signaler le pull au backend (fire-and-forget, idempotent), faire le commit
initial « fondations », puis laisser le trap exécuter le `docker logout`.

```bash
curl -sf -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"project_id\":\"$PROJECT_ID\",\"app_image_version_id\":\"$VERSION_ID\"}" \
  "$BACKEND_URL/api/app-images/$TARGET_SLUG/pulled" >/dev/null \
  || echo "[fondations] télémétrie pulled non enregistrée (non bloquant)"

git add -A
git commit -q -m "fondations : $NAME $TAG" || true
# Le trap EXIT exécute docker logout et le confirme dans le log.
```

La télémétrie est **non bloquante** : un échec ici ne doit pas annuler des
fondations valides (smoke check déjà passé, `.foundations.json` déjà écrit).

Message de clôture quantifié (jalon UX) :

« Fondations posées en ~N min - 0 point débité sur votre wallet projet. »

---

## Rollback

Tout échec **avant** l'écriture de `.foundations.json` (étape 8) doit laisser le
projet propre : l'utilisateur ne voit jamais un projet à moitié scaffoldé.

### Rollback fichiers + Docker

1. Supprimer les fichiers extraits partiellement (le scaffold copié à l'étape
   5). Retirer le container éphémère s'il reste (`$CONTAINER_ID` non vide).
2. `docker compose down -v` si des services ont été démarrés.
3. Le trap `EXIT` exécute le `docker logout` dans tous les cas.

```bash
rollback_files() {
  if [ -f docker-compose.yml ]; then docker compose down -v >/dev/null 2>&1 || true; fi
  [ -n "$CONTAINER_ID" ] && docker rm -f "$CONTAINER_ID" >/dev/null 2>&1 || true
  # Supprimer les fichiers de scaffold extraits (laisser .project/ et .git/).
  git clean -fdx -e .project -e .git >/dev/null 2>&1 || true
}
```

### Rollback BDD (BLOQUANT review)

Si l'échec survient **après** le PATCH `init_step='foundations_pulled'`
(étape 6), par exemple un smoke check raté à l'étape 7, le rollback doit
**re-PATCHer `init_step` vers l'état précédent** (`ram_mounted`). Sans ce
re-PATCH, la BDD indiquerait des fondations posées alors qu'aucun
`.foundations.json` n'existe : un marqueur orphelin qui bloquerait les
diagnostics et le cron de cleanup.

```bash
rollback_bdd() {
  if [ "${INIT_STEP_PATCHED:-0}" -eq 1 ]; then
    curl -sf -X PATCH -H "$AUTH" -H "Content-Type: application/json" \
      -d "{\"init_step\":\"$PREV_INIT_STEP\"}" \
      "$BACKEND_URL/api/projects/$PROJECT_ID" >/dev/null \
      && echo "[fondations] init_step restauré à $PREV_INIT_STEP" \
      || echo "[fondations] ATTENTION : restauration init_step échouée"
  fi
}
```

À enchaîner sur tout chemin d'échec, dans cet ordre : `rollback_bdd` puis
`rollback_files`, puis bascule sur le scaffolding classique :

```bash
on_failure() {
  rollback_bdd
  rollback_files
  echo "[fondations] bascule sur le scaffolding classique (init-*)."
}
trap 'on_failure' ERR   # à armer juste après le préambule
```

Après le rollback, **toujours** poser les fondations avec le skill classique :
`init-postgres` (frontend-only) ou `init-postgres-fastapi` (dual-stack), selon
la stack du brief. Le projet repart de `ram_mounted` comme s'il n'y avait jamais
eu de tentative d'image.

---

## Messages de fallback distincts

Le message dépend de la cause. Toujours en français accentué, sans tiret
cadratin.

| Cause                                          | Message utilisateur                                                                                                             | Suite                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `min_kit_version` non satisfaite               | « Votre kit nécessite une mise à jour pour utiliser les fondations prêtes à l'emploi. Pour l'instant, on démarre depuis zéro. » | scaffolding `init-*`   |
| Registry indisponible / backend injoignable    | « Le catalogue de fondations est momentanément indisponible. On pose les fondations depuis zéro. »                              | scaffolding `init-*`   |
| Aucune image compatible / image désactivée     | « Aucune fondation prête à l'emploi ne correspond à ce projet. On part d'un scaffold classique. »                               | scaffolding `init-*`   |
| Docker absent ou daemon arrêté                 | « Docker n'est pas démarré, on pose les fondations depuis zéro. »                                                               | scaffolding `init-*`   |
| Échec à mi-chemin (pull, install, smoke check) | « Une étape des fondations a échoué, le projet a été nettoyé. On repart d'un scaffold classique. »                              | rollback puis `init-*` |
| Conflit de port                                | « Un port nécessaire est déjà occupé. On pose les fondations depuis zéro. »                                                     | rollback puis `init-*` |

**Jamais de re-sélection silencieuse d'une autre image** : si l'image visée
n'est plus disponible, on tombe sur le scaffolding classique, pas sur une autre
image du catalogue.

---

## Reprise (`status: "partial"`)

Si `.project/.foundations.json` existe avec `status: "partial"` (tentative
précédente interrompue, ou écrite par `/roadmap` en mode reprise), reprendre la
séquence depuis le début en re-vérifiant le catalogue (étape 1). L'idempotence
du `POST .../pulled` et du commit garantit qu'une reprise ne crée pas de
doublon. À la réussite, écraser `status` par `"complete"`.

## À retenir

- Re-fetch du catalogue à l'exécution, jamais de confiance au slug stocké.
- Login `--password-stdin` uniquement, pull par digest, logout via trap.
- `.foundations.json status:"complete"` seulement après smoke check passé.
- Rollback complet sur échec, **y compris re-PATCH `init_step` vers
  `ram_mounted`** si le PATCH `foundations_pulled` a déjà eu lieu.
- Fallback `init-*` systématique : le projet n'est jamais bloqué.
