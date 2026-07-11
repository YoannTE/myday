#!/usr/bin/env bash
# ----------------------------------------------------------
# Init Next.js + Postgres + Better-auth + MinIO (always-latest)
# Usage:
#   bash init.sh backup    - Sauvegarde les fichiers existants
#   bash init.sh install   - Install complet (create-next-app + deps + templates + docker + migrate + seed)
#   bash init.sh restore   - Restaure les fichiers sauvegardes
#   bash init.sh all       - Execute backup + install + restore
# ----------------------------------------------------------
set -e

BACKUP_DIR="/tmp/project-backup-$$"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$(cd "$SCRIPT_DIR/../../../tools/postgres-templates" && pwd)"

check_prereqs() {
  echo "=== Verification des prerequis ==="
  command -v node >/dev/null || { echo "ERREUR : Node.js non trouve. Installer Node 20+."; exit 1; }
  command -v npm  >/dev/null || { echo "ERREUR : npm non trouve."; exit 1; }
  local node_major=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$node_major" -lt 20 ]; then
    echo "ERREUR : Node $node_major detecte. Requis : 20+ (--env-file)."
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "ERREUR : Docker n'est pas en cours d'execution."
    exit 1
  fi
  if [ ! -d "$TEMPLATES_DIR" ]; then
    echo "ERREUR : dossier templates introuvable : $TEMPLATES_DIR"
    exit 1
  fi
  echo "  Node   $(node -v) - OK"
  echo "  npm    $(npm -v) - OK"
  echo "  Docker - OK"
  echo "  Templates : $TEMPLATES_DIR"
}

backup() {
  echo "=== Sauvegarde des fichiers existants ==="
  mkdir -p "$BACKUP_DIR"
  for f in .project BRIEF.md .env.example .gitignore README.md .pi; do
    if [ -e "$f" ]; then
      cp -r "$f" "$BACKUP_DIR/"
      echo "  Sauvegarde: $f"
    fi
  done
  rm -rf .project BRIEF.md .env.example README.md
  echo "=== Dossier pret pour create-next-app ==="
}

install_next_and_deps() {
  echo ""
  echo "=== Creation du projet Next.js (create-next-app@latest, --src-dir) ==="
  npx create-next-app@latest . \
    --ts --tailwind --eslint --app \
    --src-dir --import-alias="@/*" --yes

  echo ""
  echo "=== Installation des deps (@latest) ==="
  npm install \
    better-auth@latest \
    drizzle-orm@latest \
    pg \
    @aws-sdk/client-s3@latest \
    @aws-sdk/s3-request-presigner@latest \
    sonner@latest

  npm install -D \
    drizzle-kit@latest \
    @types/pg \
    tsx@latest

  echo ""
  echo "=== Installation de shadcn/ui (@latest) + composants ==="
  npx shadcn@latest init --defaults --yes
  npx shadcn@latest add button input label card --yes
}

add_npm_scripts() {
  # Ajoute les scripts db:* dans package.json (via Node - pas besoin de jq)
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.scripts = {
      ...pkg.scripts,
      'db:generate': 'drizzle-kit generate',
      'db:migrate': 'tsx --env-file=.env.local src/lib/db/migrate.ts',
      'db:seed':    'tsx --env-file=.env.local src/lib/db/seed.ts',
      'db:studio':  'drizzle-kit studio',
      'db:push':    'drizzle-kit push'
    };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "  Scripts db:* ajoutes dans package.json"
}

copy_templates() {
  echo ""
  echo "=== Copie des templates (auth, db, storage, pages, composants) ==="
  # Fichiers a la racine
  cp "$TEMPLATES_DIR/docker-compose.yml" .
  cp "$TEMPLATES_DIR/drizzle.config.ts" .
  cp "$TEMPLATES_DIR/.env.local.example" .

  # Fichiers source
  cp -r "$TEMPLATES_DIR/files/"* .
  echo "  Templates copies"
  echo ""
  echo "  Note : le Dockerfile production + entrypoint sont generes par l'agent"
  echo "  durant le Round 1 (cf. /roadmap), pour etre adaptes a la stack reelle"
  echo "  du projet (workers, multi-stage, etc.). Voir /auto-migrate pour le pattern."
}

generate_env_local() {
  echo ""
  echo "=== Generation de .env.local (secret aleatoire) ==="
  local secret
  secret=$(openssl rand -base64 32)
  cp .env.local.example .env.local
  # Remplace la ligne BETTER_AUTH_SECRET vide par le secret genere
  # Fonctionne sur macOS (sed -i '') ET Linux (sed -i) via une syntaxe compatible
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=\"$secret\"|" .env.local
  else
    sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=\"$secret\"|" .env.local
  fi
  echo "  .env.local cree avec BETTER_AUTH_SECRET genere"
}

start_docker() {
  echo ""
  echo "=== Demarrage de Postgres + MinIO (docker-compose) ==="
  docker compose up -d
  echo "  Attente que Postgres soit pret..."
  local retries=20
  until docker compose exec -T postgres pg_isready -U app_admin -d app_main >/dev/null 2>&1; do
    sleep 1
    retries=$((retries - 1))
    if [ $retries -le 0 ]; then
      echo "  ERREUR : Postgres ne demarre pas apres 20s"
      exit 1
    fi
  done
  echo "  Postgres pret"
}

run_migrations_and_seed() {
  echo ""
  echo "=== Generation + application des migrations ==="
  npm run db:generate
  npm run db:migrate
  echo ""
  echo "=== Seed admin (admin@admin.com / password) ==="
  npm run db:seed
}

show_versions() {
  echo ""
  echo "=== Versions installees ==="
  echo "  Node        : $(node -v)"
  echo "  Next.js     : $(npm list next --depth=0 2>/dev/null | grep next@ | head -1 | sed 's/.*@//' || echo 'n/a')"
  echo "  React       : $(npm list react --depth=0 2>/dev/null | grep react@ | head -1 | sed 's/.*@//' || echo 'n/a')"
  echo "  Better-auth : $(npm list better-auth --depth=0 2>/dev/null | grep better-auth@ | head -1 | sed 's/.*@//' || echo 'n/a')"
  echo "  Drizzle ORM : $(npm list drizzle-orm --depth=0 2>/dev/null | grep drizzle-orm@ | head -1 | sed 's/.*@//' || echo 'n/a')"
}

install() {
  check_prereqs
  install_next_and_deps
  add_npm_scripts
  copy_templates
  generate_env_local
  start_docker
  run_migrations_and_seed
  show_versions
  echo ""
  echo "=== Installation terminee ==="
  echo ""
  echo "Lancement : npm run dev  →  http://localhost:3000"
  echo "Admin     : admin@admin.com / password"
  echo "MinIO     : http://localhost:9001"
}

restore() {
  echo "=== Restauration des fichiers sauvegardes ==="
  if [ -d "$BACKUP_DIR" ]; then
    cp -r "$BACKUP_DIR"/.project . 2>/dev/null || true
    cp "$BACKUP_DIR"/BRIEF.md . 2>/dev/null || true
    cp "$BACKUP_DIR"/.env.example . 2>/dev/null || true
    cp -r "$BACKUP_DIR"/.pi . 2>/dev/null || true
    rm -rf "$BACKUP_DIR"
    echo "=== Fichiers restaures ==="
  else
    echo "Pas de sauvegarde trouvee dans $BACKUP_DIR"
  fi
}

case "${1:-all}" in
  backup)  backup ;;
  install) install ;;
  restore) restore ;;
  all)     backup && install && restore ;;
  *)       echo "Usage: bash init.sh [backup|install|restore|all]" ;;
esac
