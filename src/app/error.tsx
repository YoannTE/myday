"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Trace côté client pour diagnostic (le détail serveur reste côté logs).
    console.error("Erreur inattendue :", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <RotateCcw className="h-7 w-7" aria-hidden />
      </div>
      <p className="mt-6 font-mono text-sm font-medium text-muted">
        Une erreur est survenue
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-3xl">
        Quelque chose s'est mal passé
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        Ce n'est pas de ta faute. Réessaie dans un instant — si le problème
        persiste, recharge la page.
      </p>
      <Button onClick={reset} className="mt-8">
        Réessayer
      </Button>
    </main>
  );
}
