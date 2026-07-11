"use client";

import { cn } from "@/lib/utils";
import type { FiltreMail } from "@/components/mails/types";

interface MailEnteteProps {
  filtre: FiltreMail;
  onFiltreChange: (filtre: FiltreMail) => void;
  onRafraichir: () => void;
  rafraichissementEnCours: boolean;
}

const ONGLETS: { valeur: FiltreMail; label: string }[] = [
  { valeur: "important", label: "Importants" },
  { valeur: "tous", label: "Tous" },
];

/**
 * Entête `/mails` (transposition de la V0 « Filtres + rafraîchir » du
 * mockup) : titre + bascule Importants/Tous + bouton de rafraîchissement
 * manuel du tri.
 */
export function MailEntete({
  filtre,
  onFiltreChange,
  onRafraichir,
  rafraichissementEnCours,
}: MailEnteteProps) {
  return (
    <div className="fade-in mb-6 flex flex-wrap items-center gap-3">
      <h1 className="font-display text-xl font-extrabold tracking-[-0.02em] text-ink md:text-2xl">
        Mails
      </h1>
      <div className="ml-auto inline-flex rounded-full bg-card p-1 shadow-card">
        {ONGLETS.map((onglet) => (
          <button
            key={onglet.valeur}
            type="button"
            onClick={() => onFiltreChange(onglet.valeur)}
            className={cn(
              "rounded-full px-3 py-1.5 font-body text-xs transition-colors",
              filtre === onglet.valeur ? "cta-gradient text-white" : "text-ink/50",
            )}
          >
            {onglet.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onRafraichir}
        disabled={rafraichissementEnCours}
        aria-label="Rafraîchir le tri"
        title="Rafraîchir le tri"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-inner bg-card text-ink/50 shadow-card disabled:opacity-50",
          rafraichissementEnCours && "animate-spin",
        )}
      >
        ⟳
      </button>
    </div>
  );
}
