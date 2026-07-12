"use client";

import {
  cleJourIso,
  estAujourdHui,
  estMemeMois,
  formaterNomMois,
  joursGrilleMois,
  moisDeLAnnee,
} from "@/components/planning/date-utils";
import type { CompteurJourApi } from "@/components/planning/types";

const JOURS_INITIALES = ["L", "M", "M", "J", "V", "S", "D"];

interface PlanningAnneeProps {
  reference: Date;
  compteurs: CompteurJourApi[];
  onSelectionnerMois: (mois: Date) => void;
}

/** Intensité visuelle (opacité de l'accent) selon le nombre d'événements du jour. */
function intensiteCompteur(count: number): string {
  if (count <= 0) return "bg-transparent";
  if (count === 1) return "bg-accent/25";
  if (count === 2) return "bg-accent/50";
  return "bg-accent/80";
}

/**
 * Vue année : 12 mini-mois avec densité d'événements (heatmap légère à
 * partir de `GET /api/events/counts`, jamais tous les événements de
 * l'année). Transposition compacte des tokens AEVIO (cartes `bg-card`,
 * accent bleu). Un clic sur un mois bascule la page en vue mois.
 */
export function PlanningAnnee({
  reference,
  compteurs,
  onSelectionnerMois,
}: PlanningAnneeProps) {
  const compteurParJour = new Map(compteurs.map((c) => [c.jour, c.count]));
  const mois = moisDeLAnnee(reference);

  return (
    <div className="fade-in delay-1 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {mois.map((premierJourMois) => {
        const joursDuMois = joursGrilleMois(premierJourMois);
        return (
          <button
            key={premierJourMois.toISOString()}
            type="button"
            onClick={() => onSelectionnerMois(premierJourMois)}
            className="rounded-card bg-card p-3 text-left shadow-card transition-colors hover:bg-soft/40"
          >
            <p className="mb-2 font-display text-sm font-semibold text-ink">
              {formaterNomMois(premierJourMois)}
            </p>
            <div className="grid grid-cols-7 gap-0.5">
              {JOURS_INITIALES.map((initiale, index) => (
                <span
                  key={index}
                  className="text-center font-mono text-[7px] text-ink/30 uppercase"
                >
                  {initiale}
                </span>
              ))}
              {joursDuMois.map((jourGrille) => {
                const horsMois = !estMemeMois(jourGrille, premierJourMois);
                const count = compteurParJour.get(cleJourIso(jourGrille)) ?? 0;
                const aujourdHui = estAujourdHui(jourGrille);
                return (
                  <span
                    key={jourGrille.toISOString()}
                    className={`h-3.5 w-3.5 rounded-[3px] ${
                      horsMois
                        ? "bg-transparent"
                        : aujourdHui
                          ? "bg-accent"
                          : intensiteCompteur(count)
                    }`}
                  />
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
