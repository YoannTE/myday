# Configuration après init-postgres

Ce fichier documente la stack installée et comment la personnaliser.

## Structure du projet

```
projet/
├── docker-compose.yml        # Postgres + MinIO
├── drizzle.config.ts         # Config drizzle-kit
├── .env.local                # Secrets (genere par init.sh)
├── .env.local.example        # Template
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Layout + Toaster
│   │   ├── page.tsx          # Home
│   │   ├── sign-in/page.tsx  # Connexion
│   │   ├── sign-up/page.tsx  # Inscription
│   │   ├── dashboard/page.tsx # Protegee
│   │   └── api/auth/[...all]/route.ts  # Better-auth handler
│   ├── lib/
│   │   ├── auth.ts           # Better-auth server config
│   │   ├── auth-client.ts    # Better-auth React client
│   │   ├── session.ts        # getSession + requireUser
│   │   ├── storage/          # S3/MinIO client (index.ts + helpers)
│   │   └── db/
│   │       ├── index.ts      # Drizzle client
│   │       ├── schema.ts     # Tables (user, session, account, verification + metier)
│   │       ├── migrate.ts    # Script migrations
│   │       └── seed.ts       # Admin seed
│   └── components/
│       ├── auth-form.tsx     # Sign-in/sign-up form
│       ├── sign-out-button.tsx
│       └── ui/               # shadcn/ui (button, input, label, card, sonner)
└── drizzle/                  # Migrations generees
```

## Variables d'environnement (.env.local)

```bash
DATABASE_URL="postgres://app_admin:app_password_dev@localhost:5433/app_main"
BETTER_AUTH_SECRET="<secret aleatoire, genere par init.sh>"
BETTER_AUTH_URL="http://localhost:3000"

# Google OAuth (optionnel)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# MinIO
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_BUCKET="app-files"
S3_ACCESS_KEY_ID="app_minio_admin"
S3_SECRET_ACCESS_KEY="app_minio_password_dev"
S3_FORCE_PATH_STYLE="true"
S3_PUBLIC_URL="http://localhost:9000/app-files"
```

## Ajouter une table metier

Dans `src/lib/db/schema.ts`, apres les tables Better-auth :

```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Puis :

```bash
npm run db:generate    # cree la migration SQL
npm run db:migrate     # l'applique
```

## Proteger une page (Server Component)

```typescript
import { requireUser } from "@/lib/session";

export default async function MaPage() {
  const user = await requireUser();  // redirect /sign-in si pas connecte
  return <div>Hello {user.email}</div>;
}
```

## Ajouter un endpoint API authentifie

```typescript
// src/app/api/posts/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }
  const body = await req.json();
  const [row] = await db
    .insert(posts)
    .values({
      userId: session.user.id,
      title: body.title,
    })
    .returning();
  return NextResponse.json({ data: row });
}
```

## Uploader un fichier

Voir `src/lib/storage/index.ts` :

```typescript
import { buildObjectKey, uploadBuffer, getPublicFileUrl } from "@/lib/storage";

const key = buildObjectKey(userId, file.name);
await uploadBuffer(key, buffer, file.type);
const url = getPublicFileUrl(key);
```

Note : l'import `@/lib/storage` reste valide ; il est resolu automatiquement vers `src/lib/storage/index.ts` par le path mapping TypeScript. Pour ajouter d'autres helpers (avatars, documents, etc.), creer `src/lib/storage/avatar.ts` ou re-exporter depuis `index.ts`.

## Activer Google OAuth

1. Creer un projet sur https://console.cloud.google.com/
2. OAuth 2.0 Client ID > Web application
3. Authorized redirect URI : `http://localhost:3000/api/auth/callback/google`
4. Copier `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env.local`
5. Redemarrer `npm run dev`
6. Le bouton "Continuer avec Google" apparait automatiquement sur les pages sign-in/sign-up

## Visualiser la base de donnees

```bash
npm run db:studio
```

Ouvre une interface web (Drizzle Studio) pour explorer les tables.
Zero RAM en prod, lance a la demande uniquement.

## Production

En production :

1. Changer `admin@admin.com` / `password`
2. Generer un nouveau `BETTER_AUTH_SECRET` (openssl rand -base64 32)
3. Pointer `DATABASE_URL` vers un Postgres partage (Dokploy `dokploy-network`)
4. Pointer `S3_*` vers un MinIO mutualise ou Cloudflare R2
5. Mettre `BETTER_AUTH_URL` sur le domaine de prod (ex: https://monapp.com)
