# Mise en ligne — MyDay

Checklist de préparation au déploiement. Le déploiement effectif (envoi du code,
build de l'image, mise en ligne) est **orchestré par l'application Reborn** quand
tu cliques sur « Publier » — je ne le lance pas depuis le terminal.

Statut global : **✅ le code est prêt à être publié.** Il reste uniquement de la
**configuration à poser côté hébergement** (variables secrètes + connexion Google),
que tu fais depuis le panneau de déploiement.

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
| `BETTER_AUTH_URL` | Adresse publique du site | ex. `https://myday.tondomaine.com` |
| `NEXT_PUBLIC_API_URL` | Adresse publique du moteur (API) | ex. `https://api.myday.tondomaine.com` |
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
redirection autorisés »), en remplaçant par ton vrai domaine :

- `https://TON-DOMAINE/api/auth/callback/google`
- `https://TON-DOMAINE/api/google/callback`

C'est une manipulation que tu fais toi-même dans la console Google (je ne touche
pas à tes accès Google).

### c) La clé Anthropic exposée (rappel)

La clé actuelle a été affichée en clair pendant nos échanges. À réviser quand tu
veux : révoquer sur console.anthropic.com, en créer une neuve, et l'utiliser
comme valeur `ANTHROPIC_API_KEY` en ligne.

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
