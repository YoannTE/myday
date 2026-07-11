"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Affiche le toast de résultat OAuth (?google=connected|error) une seule
// fois puis nettoie l'URL, pour ne pas re-déclencher au prochain rendu ou
// au rafraîchissement de la page. `useSearchParams` exige une frontière
// Suspense (posée par le composant appelant `GoogleCard`).
export function GoogleCardToasts() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dejaTraite = useRef(false);

  useEffect(() => {
    if (dejaTraite.current) return;
    const resultat = searchParams.get("google");
    if (!resultat) return;
    dejaTraite.current = true;

    if (resultat === "connected") {
      toast.success("Ton compte Google est bien connecté.");
    } else if (resultat === "error") {
      toast.error("La connexion à Google a échoué. Réessaie depuis Réglages.");
    }
    router.replace("/reglages");
  }, [searchParams, router]);

  return null;
}
