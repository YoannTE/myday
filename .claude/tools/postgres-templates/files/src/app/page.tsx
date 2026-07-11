import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-xl space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Bienvenue</h1>
        <p className="text-muted-foreground">
          Application prete : Next.js 15, Postgres, Better-auth, MinIO. Commence
          par te connecter ou creer un compte.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/sign-in">Se connecter</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sign-up">Creer un compte</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Admin de test :{" "}
          <code className="rounded bg-muted px-1">admin@admin.com</code> /
          <code className="rounded bg-muted px-1">password</code>
        </p>
      </div>
    </main>
  );
}
