---
description: Conventions Python et FastAPI pour le backend dual-stack
globs:
  - "backend/**"
---

# Conventions Python / FastAPI

## Structure backend

- Code dans `backend/app/`
- Endpoints dans `backend/app/api/` (un fichier par domaine, utiliser APIRouter)
- Logique metier dans `backend/app/services/` (un fichier par domaine)
- Modeles Pydantic dans `backend/app/models/` (un fichier par domaine)
- Acces BDD dans `backend/app/db/` (pool asyncpg dans `client.py`, repositories optionnels)
- Auth dans `backend/app/auth/` (dependency `get_current_user`)
- Storage dans `backend/app/storage/` (client boto3 pour MinIO/S3)
- Utilitaires dans `backend/app/utils/`

## FastAPI

- Valider les inputs avec Pydantic (schemas dans models/)
- Reponses : `{ "data": ... }` ou `{ "error": "message" }`
- Status HTTP corrects (200, 201, 400, 401, 404, 500)
- Authentification via `Depends(get_current_user)` (lit table session partagee avec Next.js)
- Async par defaut pour les endpoints qui font des I/O
- Gerer les erreurs avec HTTPException ou exception handlers

## Pydantic

- Schemas Create/Update/Response separes
- Enums pour les types fixes
- Validators pour la logique de validation complexe
- Config model avec `model_config = ConfigDict(...)` (Pydantic v2)

## Qualite

- Type hints sur toutes les fonctions
- Max ~150 lignes par fichier
- Pas de logique metier dans les endpoints (deleguer aux services)
- Ruff pour le formatage et les imports
- Tests avec pytest + pytest-asyncio
