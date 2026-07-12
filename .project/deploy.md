# Mise en ligne — MyDay

Checklist de préparation au déploiement. Le déploiement effectif (envoi du code,
build de l'image, mise en ligne) est **orchestré par l'application Reborn** quand
tu cliques sur « Publier » — je ne le lance pas depuis le terminal.

Statut global : **✅ le code est prêt à être publié.** Il reste uniquement de la
**configuration à poser côté hébergement** (variables secrètes + connexion Google),
que tu fais depuis le panneau de déploiement.

**Adresse retenue** : MyDay vit sur son propre sous-domaine de la marque Aevio,
`myday.aevio-one.com` (site) + `api.myday.aevio-one.com` (moteur API). Choix d'un
sous-domaine dédié plutôt qu'un sous-chemin `/MyDay` : plus simple, PWA propre,
aucun changement de code, et `www.aevio-one.com` reste libre pour la vitrine Aevio.

**Dépôt GitHub** : https://github.com/YoannTE/myday (**public** — choix assumé pour
déploiement Dokploy sans clé ; aucun secret commité, `.env.local` exclu).

## ✅ EN LIGNE (12/07/2026)

MyDay est **déployé et fonctionnel en production** : `https://myday.aevio-one.com`
(+ API `https://api.myday.aevio-one.com`), **certificats Let's Encrypt valides**.

- Cert : l'émission ne se déclenchait pas sur les domaines créés avant que le DNS
  existe. **Fix** : supprimer puis recréer les domaines dans Dokploy (config Traefik
  neuve) → certificats délivrés immédiatement.
- Sécurité : compte admin par défaut `admin@admin.com` **désactivé** via l'espace admin.
- Reste : rotation de la clé Anthropic exposée (à faire quand souhaité).

## Provisionné sur Dokploy (fait le 11/07/2026)

Projet « MyDay » créé, avec :
- **Base Postgres 16** (`myday-postgres-kzllsp`, interne) — démarrée. Superuser
  `app_admin` ; rôle `app_rls` créé par les migrations (mot de passe par défaut,
  base non exposée → à durcir plus tard).
- **App site** `myday-web` (Dockerfile.web) → `myday.aevio-one.com` (HTTPS auto).
- **App moteur** `myday-api` (backend/Dockerfile.api) → `api.myday.aevio-one.com` (HTTPS auto).
- **Variables** posées sur les deux apps (base, secrets générés, VAPID, URLs, CORS,
  cookie cross-sous-domaines). Correctifs code poussés (build-arg + cookie).

### Reste à faire par toi (puis je déclenche le déploiement)

1. **DNS** chez le gestionnaire de `aevio-one.com` — 2 enregistrements **A** vers
   l'IP du serveur (la même qu'Aevio One) : `116.203.233.204`
   - `myday`      → `116.203.233.204`
   - `api.myday`  → `116.203.233.204`
2. **Identifiants à coller** (panneau Dokploy → app → Environment) :
   - Sur **myday-web** : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
     `ADMIN_EMAIL`, `ADMIN_PASSWORD` (ton vrai mot de passe admin de prod)
   - Sur **myday-api** : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`
3. **Google** : ajouter les 2 URI de redirection (voir ci-dessus).

---

## 1. Ce qui est déjà prêt (rien à faire)

- ✅ **Build de l'app** validé (frontend `npm run build` : 24 pages, 0 erreur ; 237 tests backend verts).
- ✅ **Images de production** : `Dockerfile.web` (site) et `backend/Dockerfile.api` (moteur).
- ✅ **Base de données automatique** : au démarrage, l'app applique elle-même les
  migrations et crée le compte admin (rien à lancer à la main).
- ✅ **`.dockerignore`**, **README de lancement**, **`.env.local.example`** complets.
- ✅ App **non indexée** par Google (robots.txt) + pages légales en ligne.

---

## 2. À poser AVANT de cliquer « Publier »

### a) Les variables de configuration (dans le panneau de déploiement)

Ce sont les réglages secrets de la version en ligne. À renseigner une fois.
Celles marquées 🔑 doivent être des valeurs **neuves**, différentes du dev.

| Variable | Rôle | Note |
| --- | --- | --- |
| `DATABASE_URL` | Base de données (admin, migrations) | fournie par l'hébergeur Postgres |
| `BACKEND_DATABASE_URL` | Base de données (rôle applicatif `app_rls`) | 🔑 mot de passe `app_rls` neuf |
| `BETTER_AUTH_SECRET` | Sécurité des sessions | 🔑 générer une valeur aléatoire |
| `BETTER_AUTH_URL` | Adresse publique du site | `https://myday.aevio-one.com` |
| `NEXT_PUBLIC_API_URL` | Adresse publique du moteur (API) | `https://api.myday.aevio-one.com` |
| `TOKEN_ENCRYPTION_KEY` | Chiffrement des jetons Google | 🔑 clé 32 octets neuve (voir README) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Connexion Google | mêmes identifiants, + voir (b) |
| `ANTHROPIC_API_KEY` | Assistant IA / tri / brief | 🔑 la clé Anthropic (idéalement rotée) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Notifications push | réutilisables ou régénérables |
| `S3_ENDPOINT` / `S3_PUBLIC_URL` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_REGION` / `S3_FORCE_PATH_STYLE` | Stockage fichiers (MinIO/R2) | fournis par l'hébergeur de stockage |

> Le détail de chaque variable est déjà documenté dans `.env.local.example`.

### b) Autoriser Google sur l'adresse en ligne

Aujourd'hui, la connexion Google ne marche que sur `localhost`. Pour qu'elle
marche en ligne, il faut ajouter **deux adresses de retour** dans la console
Google (console.cloud.google.com → tes identifiants OAuth → « URI de
redirection autorisés ») :

- `https://myday.aevio-one.com/api/auth/callback/google`
- `https://myday.aevio-one.com/api/google/callback`

C'est une manipulation que tu fais toi-même dans la console Google (je ne touche
pas à tes accès Google).

### c) La clé Anthropic exposée (rappel)

La clé actuelle a été affichée en clair pendant nos échanges. À réviser quand tu
veux : révoquer sur console.anthropic.com, en créer une neuve, et l'utiliser
comme valeur `ANTHROPIC_API_KEY` en ligne.

### d) Faire pointer les sous-domaines

Chez le gestionnaire du domaine `aevio-one.com`, faire pointer les deux
sous-domaines `myday` et `api.myday` vers le serveur qui héberge l'app (celui de
ton Dokploy). En général, ça se règle directement dans le panneau de déploiement
au moment de rattacher `myday.aevio-one.com` — il t'indique quoi mettre en DNS.

---

## 3. Comment publier

Une fois le point 2 prêt : clique sur **« Publier »** dans l'application Reborn.
C'est elle qui envoie le code, construit l'image et met le site en ligne. Le
premier démarrage appliquera automatiquement la base et créera le compte admin.

## 4. Après la première mise en ligne (vérifs rapides)

- Ouvrir l'adresse du site → la page de connexion s'affiche.
- Se connecter avec le compte admin (identifiants du README, **change le mot de
  passe admin** en prod).
- Créer une invitation, connecter Google, vérifier le cockpit + le brief.
