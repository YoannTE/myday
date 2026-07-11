import { requireUser } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Connecte en tant que <strong>{user.email}</strong>
          </p>
        </div>
        <SignOutButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bienvenue</CardTitle>
          <CardDescription>
            Le projet est initialise. Ajoute tes tables metier dans
            <code className="mx-1 rounded bg-muted px-1">
              src/lib/db/schema.ts
            </code>
            puis regenere les migrations avec{" "}
            <code className="rounded bg-muted px-1">npm run db:generate</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Outils utiles :</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <code>npm run db:studio</code> - voir la base de donnees (Drizzle
              Studio)
            </li>
            <li>
              MinIO Console - http://localhost:9001 (login dans .env.local)
            </li>
            <li>Drizzle docs - https://orm.drizzle.team</li>
            <li>Better-auth docs - https://www.better-auth.com</li>
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
