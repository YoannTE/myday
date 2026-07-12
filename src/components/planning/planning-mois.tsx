"use client";

import {
  cleJourIso,
  estAujourdHui,
  estMemeMois,
  formaterHeure,
  jourCivil,
  joursGrilleMois,
  memeJour,
} from "@/components/planning/date-utils";
import type { EvenementApi } from "@/components/planning/types";

const JOURS_ENTETE = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MAX_EVENEMENTS_VISIBLES = 2;

interface PlanningMoisProps {
  reference: Date;
  evenements: EvenementApi[];
  onSelectionnerJour: (jour: Date) => void;
}

/**
 * Vue mois : grille calendaire 7 colonnes x 4-6 semaines (transposition des
 * tokens AEVIO — cellules `bg-soft`, jour courant bordé accent). Chaque
 * cellule affiche jusqu'à 2 événements en pastille + un compteur "+N"
 * au-delà. Toute la cellule est cliquable : un clic bascule la page en vue
 * jour sur cette date (géré par `PlanningClient`).
 */
export function PlanningMois({
  reference,
  evenements,
  onSelectionnerJour,
}: PlanningMoisProps) {
  const jours = joursGrilleMois(reference);

  return (
    <div className="fade-in delay-1 rounded-card bg-card p-2 shadow-card md:p-6">
      <div className="mb-1 grid grid-cols-7 gap-1 md:gap-3">
        {JOURS_ENTETE.map((jour) => (
          <p
            key={jour}
            className="text-center font-mono text-[9px] tracking-[.04em] text-ink/40 uppercase md:text-[10px]"
          >
            {jour}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 md:gap-3">
        {jours.map((date) => {
          const horsMois = !estMemeMois(date, reference);
          const aujourdHui = estAujourdHui(date);
          const { jour: numeroJour } = jourCivil(date);
          const evenementsDuJour = evenements
            .filter((evenement) => memeJour(new Date(evenement.debut), date))
            .sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());
          const visibles = evenementsDuJour.slice(0, MAX_EVENEMENTS_VISIBLES);
          const reste = evenementsDuJour.length - visibles.length;

          return (
            <button
              key={cleJourIso(date)}
              type="button"
              onClick={() => onSelectionnerJour(date)}
              className={`flex min-h-16 flex-col items-start gap-1 rounded-inner p-1 text-left transition-colors md:min-h-24 md:p-2 ${
                aujourdHui
                  ? "border border-accent/40 bg-soft/50"
                  : "bg-soft/20 hover:bg-soft/40"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] md:h-6 md:w-6 md:text-xs ${
                  aujourdHui
                    ? "cta-gradient text-white"
                    : horsMois
                      ? "text-ink/25"
                      : "text-ink/60"
                }`}
              >
                {numeroJour}
              </span>
              <div className="flex w-full min-w-0 flex-col gap-0.5">
                {visibles.map((evenement) => (
                  <span
                    key={evenement.id}
                    className={`truncate rounded-[4px] px-1 py-0.5 font-mono text-[8px] tracking-[.02em] md:text-[9px] ${
                      horsMois ? "bg-transparent text-ink/25" : "bg-card text-ink/60"
                    }`}
                  >
                    {formaterHeure(evenement.debut)} {evenement.titre}
                  </span>
                ))}
                {reste > 0 && (
                  <span className="font-mono text-[8px] text-accent md:text-[9px]">
                    +{reste}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
