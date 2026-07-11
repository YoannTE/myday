---
description: Conventions MinIO/S3 (clients, clés d'objet, URLs, uploads)
globs:
  - "src/lib/storage/**"
  - "backend/app/storage/**"
  - "**/*upload*.ts"
  - "**/*upload*.py"
---

# Conventions S3 / MinIO

- Dev local : MinIO (S3-compatible), démarré via `docker compose up -d`
- Prod : MinIO partagé via Dokploy ou Cloudflare R2
- Client Next.js : `src/lib/storage/index.ts` (AWS SDK v3)
- Client FastAPI : `backend/app/storage/minio_client.py` (boto3)

## Convention des clés d'objet

- Format obligatoire : `users/{userId}/{uuid}-{filename}`
- Stocker UNIQUEMENT `objectKey` en BDD, JAMAIS l'URL complète
- Reconstruire l'URL à la volée depuis `S3_PUBLIC_URL` + `objectKey`
- Raison : résistance aux changements de domaine/bucket sans migration

## Variables d'environnement

- `S3_ENDPOINT` : URL interne (opérations serveur, ex: `http://minio:9000`)
- `S3_PUBLIC_URL` : URL publique HTTPS (URLs navigateur, ex: `https://cdn.monapp.com`)
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`

## Fichiers privés vs publics

- Fichiers privés : générer des URLs pré-signées (expiration courte, ex: 1h)
- Fichiers publics : bucket policy public + URL directe via `S3_PUBLIC_URL`
- Ne jamais exposer `S3_ENDPOINT` interne dans le HTML/JSON frontend
