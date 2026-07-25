"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ZonesSectionProvider } from "@/components/cockpit/section-actions";
import { cn } from "@/lib/utils";

interface CockpitSectionProps {
  titre: string;
  peutMonter: boolean;
  peutDescendre: boolean;
  onMonter: () => void;
  onDescendre: () => void;
  children: ReactNode;
}

const CLASSE_FLECHE =
  "flex h-6 w-6 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/20 hover:text-white";

/**
 * Section réordonnable du cockpit unique (Round 016) : bandeau plein bleu
 * (même dégradé que le bouton rond « + ») qui sépare visuellement les
 * sections, au-dessus du contenu réutilisé tel quel (`MeteoWidget`,
 * `PlanningClient`, `TachesClient`, `NotesClient`). Tout ce qui est posé
 * dessus est blanc : libellé, roue crantée, flèches.
 * Deux zones accueillent les boutons propres à chaque section, projetés
 * depuis le contenu via `CockpitSectionActions` pour éviter de remonter leur
 * état : `titre` (bouton rond « + », collé au libellé) et `actions` (roue
 * crantée, à droite avant les flèches).
 */
export function CockpitSection({
  titre,
  peutMonter,
  peutDescendre,
  onMonter,
  onDescendre,
  children,
}: CockpitSectionProps) {
  const [zoneTitre, setZoneTitre] = useState<HTMLDivElement | null>(null);
  const [zoneActions, setZoneActions] = useState<HTMLDivElement | null>(null);
  const zones = useMemo(
    () => ({ titre: zoneTitre, actions: zoneActions }),
    [zoneTitre, zoneActions],
  );

  return (
    <section>
      <div className="cta-gradient mb-3 flex items-center justify-between gap-2 rounded-inner px-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <p className="truncate font-display font-bold tracking-[.04em] text-white uppercase">
            {titre}
          </p>
          <div ref={setZoneTitre} className="flex items-center gap-1.5" />
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <div ref={setZoneActions} className="flex items-center gap-1.5" />
          <button
            type="button"
            aria-label={`Monter la section ${titre}`}
            disabled={!peutMonter}
            onClick={onMonter}
            className={cn(CLASSE_FLECHE, !peutMonter && "opacity-30")}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Descendre la section ${titre}`}
            disabled={!peutDescendre}
            onClick={onDescendre}
            className={cn(CLASSE_FLECHE, !peutDescendre && "opacity-30")}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <ZonesSectionProvider value={zones}>{children}</ZonesSectionProvider>
    </section>
  );
}
