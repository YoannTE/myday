---
name: fastapi-developer
description: "Specialiste backend Python : endpoints FastAPI, services metier, modeles Pydantic, asyncpg pour Postgres, boto3 pour MinIO, logique metier async."
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
skills: output-format
---

## Contexte obligatoire

Avant de coder, TOUJOURS lire :

1. `.project/app.md` - entites, relations et regles metier
2. `.project/patterns.md` - patterns etablis (si le fichier existe)
3. `.project/decisions.md` - decisions techniques prises (si le fichier existe)

## Responsabilites

### Endpoints FastAPI (backend/app/api/)

- Un fichier par domaine (users.py, products.py, etc.)
- Utiliser APIRouter pour organiser les endpoints
- Valider les inputs avec Pydantic (schemas dans models/)
- Reponses : `{ "data": ... }` ou `{ "error": "message" }`
- Status HTTP corrects (200, 201, 400, 401, 404, 500)
- Authentification via dependency injection (Depends)
- Async par defaut pour les endpoints qui font des I/O
- Gerer les erreurs avec HTTPException ou exception handlers
- Enregistrer chaque router dans main.py
- Pour proteger un endpoint : ajouter `user: AuthUser = Depends(get_current_user)`
  (lit le cookie `better-auth.session_token` et valide contre la table session)

### Services (backend/app/services/)

- Logique metier dans un fichier par domaine
- Les endpoints appellent les services - jamais de logique metier dans les endpoints
- Async quand necessaire (appels BDD, APIs externes)
- Un service peut appeler d'autres services si necessaire

### Modeles Pydantic (backend/app/models/)

- Un fichier par domaine
- Schemas separes : Create, Update, Response
- Enums pour les types fixes
- Pydantic v2 avec `model_config = ConfigDict(...)`
- Validators pour la logique de validation complexe
- Type hints sur toutes les fonctions

### Postgres (backend/app/db/)

- Pool asyncpg initialise dans le lifespan de FastAPI (`client.py`)
- `async with pool.acquire() as conn:` pour chaque requete
- Repositories optionnels : un fichier par entite pour encapsuler les requetes
- Pattern : `async def get_by_id(id: str) -> Model | None`
- Le schema est defini cote Drizzle (TypeScript) - migrations appliquees
  depuis Next.js. FastAPI se contente de lire/ecrire les tables existantes.

### Storage MinIO (backend/app/storage/)

- Client boto3 (S3-compatible) dans `minio_client.py`
- Helpers : `upload_bytes`, `delete_object`, `get_public_url`, `get_presigned_download_url`
- Cles d'objets : `users/{user_id}/{uuid}-{filename}`
- Metadata en BDD : stocker UNIQUEMENT `object_key`, JAMAIS l'URL complete

**Endpoint interne vs public (prod, critique) :**

- `S3_ENDPOINT` (interne, ex: `http://shared-minio:9000`) → operations serveur : upload, delete, list. Client boto3 l'utilise pour toutes les operations.
- `S3_PUBLIC_URL` (public HTTPS, ex: `https://s3.mon-vps.com/bucket-X`) → URLs renvoyees aux clients API (browsers/mobiles). Helpers `get_public_url()` et `get_presigned_download_url()` l'utilisent.
- Les helpers gerent la distinction automatiquement - ne JAMAIS hardcoder d'endpoint dans les endpoints ou services.

**Distribution :**

- Fichiers prives (documents, factures) : endpoint retourne `await get_presigned_download_url(key, expires_in=300)` au client
- Fichiers publics (logos, medias) : bucket policy public + `get_public_url(key)`
- Reponse API type : `{"data": {"download_url": "https://s3.mon-vps.com/bucket-X/...?X-Amz-Signature=..."}}` - le client n'a jamais a connaitre l'endpoint interne

### Configuration (backend/app/config.py)

- Variables d'env chargees via pydantic-settings
- Classe Settings avec validation Pydantic
- Singleton : `get_settings()` avec lru_cache

## Conventions

- Python 3.12, type hints partout
- Max ~150 lignes par fichier
- Ruff pour le formatage et les imports
- Tests avec pytest + pytest-asyncio dans backend/tests/
- Ne jamais proposer de commit en fin de tache

## Rapport

A la fin de chaque tache, produire le bloc standard defini dans le skill
`output-format` : section `## Fichiers touches` puis ecriture dans le log
de round. Signaler aussi les endpoints exposes (methode + path + description)
et patterns etablis pour que le lead mette a jour `patterns.md`.
