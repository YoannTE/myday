# Configuration après init-postgres-fastapi

Ce fichier documente la stack dual-stack et comment ajouter des endpoints authentifies.

## Structure du projet

```
projet/
├── docker-compose.yml        # Postgres + MinIO
├── drizzle.config.ts         # Frontend migrations
├── .env.local                # Variables communes (frontend + backend)
├── .env.local.example
├── src/                      # Frontend Next.js
│   ├── app/...
│   ├── lib/
│   │   ├── auth.ts, auth-client.ts, session.ts
│   │   ├── api.ts            # Helper pour appeler FastAPI
│   │   ├── db/
│   │   └── storage/
│   └── components/
├── backend/                  # Backend FastAPI
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py         # Settings pydantic
│   │   ├── db/client.py      # Pool asyncpg
│   │   ├── auth/session.py   # get_current_user dependency
│   │   ├── storage/minio_client.py
│   │   ├── api/
│   │   │   ├── health.py
│   │   │   └── me.py
│   │   ├── models/           # Schemas Pydantic metier
│   │   └── services/         # Logique metier
│   └── tests/
└── drizzle/                  # Migrations SQL (appliquees par Drizzle)
```

## Variables d'environnement (.env.local racine)

Le meme `.env.local` sert pour Next.js ET pour FastAPI (pydantic-settings lit
`../.env.local` depuis le dossier `backend/`).

Variables principales :

- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optionnel)
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, etc.
- `NEXT_PUBLIC_API_URL="http://localhost:8000"` - URL du backend

## Ajouter un endpoint FastAPI authentifie

```python
# backend/app/api/posts.py
from fastapi import APIRouter, Depends

from app.auth.session import AuthUser, get_current_user
from app.db.client import get_pool

router = APIRouter(tags=["posts"])


@router.get("/posts")
async def list_posts(user: AuthUser = Depends(get_current_user)):
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, title, created_at FROM posts WHERE user_id = $1 ORDER BY created_at DESC",
            user["id"],
        )
    return {"data": [dict(r) for r in rows]}
```

Puis enregistrer le router dans `main.py` :

```python
from app.api.posts import router as posts_router
app.include_router(posts_router, prefix="/api")
```

## Appeler FastAPI depuis Next.js

```typescript
// Depuis un composant client
import { apiCall } from "@/lib/api";

const { data } = await apiCall<{ data: Post[] }>("/api/posts");
```

Le helper `apiCall` envoie automatiquement les cookies (pour l'auth).

## Ajouter une table metier

1. Dans `src/lib/db/schema.ts`, ajouter la table (Drizzle)
2. `npm run db:generate && npm run db:migrate`
3. Depuis FastAPI, utiliser directement le pool asyncpg (pas besoin d'ORM Python,
   le schema est deja defini cote Drizzle et migrate depuis Next.js)

Si le backend a besoin d'ORM Python, ajouter `SQLAlchemy` ou `tortoise-orm`
dans `requirements.txt`.

## Uploader un fichier via FastAPI

```python
# backend/app/api/upload.py
from fastapi import APIRouter, Depends, UploadFile, HTTPException

from app.auth.session import AuthUser, get_current_user
from app.storage.minio_client import build_object_key, upload_bytes, get_public_url
from app.db.client import get_pool

router = APIRouter(tags=["upload"])

MAX_SIZE = 10 * 1024 * 1024  # 10 Mo


@router.post("/upload")
async def upload_file(
    file: UploadFile,
    user: AuthUser = Depends(get_current_user),
):
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "Fichier trop volumineux (max 10 Mo)")

    key = build_object_key(user["id"], file.filename or "file")
    upload_bytes(key, content, file.content_type or "application/octet-stream")

    return {"data": {"key": key, "url": get_public_url(key)}}
```

## Auth cross-stack en detail

Flow :

1. L'utilisateur signe-in cote Next.js → Better-auth cree une session en BDD
   (table `session` avec un token unique) et depose le cookie
   `better-auth.session_token=<token>`
2. Le frontend appelle FastAPI avec `fetch(..., { credentials: "include" })`
   (fait par `apiCall`)
3. Le navigateur envoie le cookie automatiquement (CORS permet credentials)
4. FastAPI recoit le cookie, extrait le token, query la table `session`
5. Si token trouve + non expire → renvoie le user ; sinon 401

Pas de dependance runtime a Next.js depuis FastAPI. Source de verite unique : la table session en BDD.

## Production

- Changer `admin@admin.com` / `password`
- Regenerer `BETTER_AUTH_SECRET`
- Pointer `DATABASE_URL` vers le Postgres mutualise (ex: Dokploy `dokploy-network`)
- Pointer `S3_*` vers le MinIO mutualise
- `BETTER_AUTH_URL` sur le domaine de prod
- `NEXT_PUBLIC_API_URL` sur le domaine du backend deploye
