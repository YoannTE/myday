"use client";

import { useEffect, useState } from "react";
import { EventCard } from "@/components/planning/event-card";
import {
  estAujourdHui,
  formaterEnteteJour,
  formaterJourLong,
  memeJour,
} from "@/components/planning/date-utils";
import type { EvenementApi } from "@/components/planning/types";

interface PlanningJourProps {
  jours: Date[];
  evenements: EvenementApi[];
  onSuccess: () => void;
}

function indexJourParDefaut(jours: Date[]): number {
  const indexAujourdHui = jours.findIndex((jour) => estAujourdHui(jour));
  return indexAujourdHui >= 0 ? indexAujourdHui : 0;
}

/**
 * Vue jour mobile (< md) : la grille semaine en colonnes (`PlanningSemaine`)
 * est illisible sous 768px (7 colonnes compressées, scroll horizontal peu
 * naturel au doigt). Transposition de la variante « Jour en timeline » de
 * planning.html — chips de jours défilables + liste verticale du jour
 * sélectionné. Toujours affichée avec `md:hidden`, en complément de
 * `PlanningSemaine` qui passe en `hidden md:block`.
 */
export function PlanningJour({ jours, evenements, onSuccess }: PlanningJourProps) {
  const [indexSelectionne, setIndexSelectionne] = useState(() =>
    indexJourParDefaut(jours),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndexSelectionne(indexJourParDefaut(jours));
  }, [jours]);

  const jourSelectionne = jours[indexSelectionne] ?? jours[0];
  const evenementsDuJour = evenements
    .filter((evenement) => memeJour(new Date(evenement.debut), jourSelectionne))
    .sort(
      (a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime(),
    );

  return (
    <div className="fade-in delay-1 rounded-card bg-card p-4 shadow-card md:hidden">
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {jours.map((jour, index) => {
          const actif = index === indexSelectionne;
          const aujourdHui = estAujourdHui(jour);
          return (
            <button
              key={jour.toISOString()}
              type="button"
              onClick={() => setIndexSelectionne(index)}
              className={`flex flex-shrink-0 items-center justify-center rounded-inner px-3 py-1.5 font-mono text-[10px] tracking-[.04em] uppercase transition-colors ${
                actif
                  ? "cta-gradient text-white"
                  : aujourdHui
                    ? "bg-soft text-accent"
                    : "bg-soft/60 text-ink/50"
              }`}
            >
              {formaterEnteteJour(jour)}
            </button>
          );
        })}
      </div>
      <p className="mb-4 font-mono text-[11px] tracking-[.04em] text-accent uppercase">
        {formaterJourLong(jourSelectionne)}
        {estAujourdHui(jourSelectionne) && " · Aujourd'hui"}
      </p>
      {evenementsDuJour.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink/50">
          Aucun événement ce jour-là.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {evenementsDuJour.map((evenement) => (
            <EventCard
              key={evenement.id}
              evenement={evenement}
              onSuccess={onSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
}
