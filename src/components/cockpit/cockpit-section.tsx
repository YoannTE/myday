"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ZoneActionsProvider } from "@/components/cockpit/section-actions";
import { cn } from "@/lib/utils";

interface CockpitSectionProps {
  titre: string;
  peutMonter: boolean;
  peutDescendre: boolean;
  onMonter: () => void;
  onDescendre: () => void;
  children: ReactNode;
}

/**
 * Section réordonnable du cockpit unique (Round 016) : bandeau plein
 * (libellé + flèches haut/bas sur fond `soft`) qui sépare visuellement les
 * sections, au-dessus du contenu réutilisé tel quel (`MeteoWidget`,
 * `PlanningClient`, `TachesClient`, `NotesClient`).
 * La zone `zoneActions` accueille les boutons propres à chaque section
 * (roue crantée des catégories, bouton rond « + »), projetés depuis le
 * contenu via `CockpitSectionActions` pour éviter de remonter leur état.
 */
export function CockpitSection({
  titre,
  peutMonter,
  peutDescendre,
  onMonter,
  onDescendre,
  children,
}: CockpitSectionProps) {
  const [zoneActions, setZoneActions] = useState<HTMLDivElement | null>(null);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2 rounded-inner bg-soft px-3 py-2">
        <p className="font-display font-bold tracking-[.04em] text-ink uppercase">
          {titre}
        </p>
        <div className="flex items-center gap-1.5">
          <div ref={setZoneActions} className="flex items-center gap-1.5" />
          <button
            type="button"
            aria-label={`Monter la section ${titre}`}
            disabled={!peutMonter}
            onClick={onMonter}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-ink/10 hover:text-ink",
              !peutMonter && "opacity-30",
            )}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Descendre la section ${titre}`}
            disabled={!peutDescendre}
            onClick={onDescendre}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-ink/10 hover:text-ink",
              !peutDescendre && "opacity-30",
            )}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <ZoneActionsProvider value={zoneActions}>{children}</ZoneActionsProvider>
    </section>
  );
}
