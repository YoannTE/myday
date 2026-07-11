import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Compass className="h-7 w-7" aria-hidden />
      </div>
      <p className="mt-6 font-mono text-sm font-medium text-muted">Erreur 404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-3xl">
        Cette page est introuvable
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        Le lien que tu as suivi n'existe pas ou a été déplacé. Reviens à ton
        cockpit pour retrouver ta journée.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-8" })}>
        Retour au cockpit
      </Link>
    </main>
  );
}
