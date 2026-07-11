"use client";

import { useEffect, useState } from "react";
import { apiCall } from "@/lib/api";
import { formaterFraicheur, plusRecente } from "@/lib/freshness";

interface GoogleStatusLeger {
  calendar_synced_at: string | null;
  gmail_synced_at: string | null;
}

/**
 * Indicateur de fraîcheur global (fixe bas-gauche, transposition fidèle de
 * .project/mockups/shared/components/fraicheur.html) - reflète la dernière
 * synchronisation Google (Agenda ou Gmail, la plus récente des deux),
 * présent sur le dashboard et les pages internes. Silencieux (n'affiche
 * rien) si l'API est injoignable ou si l'utilisateur n'a encore jamais
 * synchronisé - pas d'erreur intrusive pour un indicateur discret.
 */
export function Freshness() {
  const [derniereSynchro, setDerniereSynchro] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    apiCall<{ data: GoogleStatusLeger }>("/api/google/status")
      .then((reponse) => {
        if (annule) return;
        setDerniereSynchro(
          plusRecente([
            reponse.data.calendar_synced_at,
            reponse.data.gmail_synced_at,
          ]),
        );
      })
      .catch(() => {
        if (!annule) setDerniereSynchro(null);
      });
    return () => {
      annule = true;
    };
  }, []);

  if (!derniereSynchro) return null;

  return (
    <div className="fixed bottom-4 left-4 flex items-center gap-2 font-mono text-[11px] tracking-[.04em] text-ink/40 uppercase">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      À jour {formaterFraicheur(derniereSynchro)}
    </div>
  );
}
