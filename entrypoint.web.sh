#!/bin/sh
# Entrypoint du conteneur web (Next.js) : applique les migrations Postgres
# (avec advisory lock, cf. src/lib/db/migrate.ts), pose l'admin par defaut
# de facon idempotente (src/lib/db/seed.ts), puis demarre le serveur Next.js
# standalone. Les bundles dist/migrate.js et dist/seed.js sont produits par
# `npm run db:bundle-migrate` (agent postgres-developer) - ne PAS les
# reecrire ici.
set -e

echo "[entrypoint.web] Application des migrations..."
node dist/migrate.js

echo "[entrypoint.web] Verification/creation de l'admin par defaut..."
node dist/seed.js

echo "[entrypoint.web] Demarrage du serveur Next.js..."
exec node server.js
