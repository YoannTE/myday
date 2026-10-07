"use client";

import { useEffect, useState } from "react";
import {
  MINUTES_PAR_JOUR,
  minutesAbsolues,
  numeroJourCivil,
} from "@/components/planning/date-utils";

export const HAUTEUR_HEURE = 52;
export const HAUTEUR_GRILLE = HAUTEUR_HEURE * 24;
const HEURES = Array.from({ length: 24 }, (_, heure) => heure);

/** Colonne des heures, à gauche de la grille. */
export function GoutiereHeures() {
  return (
    <div className="relative w-10 flex-shrink-0 md:w-12" style={{ height: HAUTEUR_GRILLE }}>
      {HEURES.slice(1).map((heure) => (
        <span
          key={heure}
          className="absolute right-1.5 -translate-y-1/2 font-mono text-[9px] text-ink/35 md:text-[10px]"
          style={{ top: heure * HAUTEUR_HEURE }}
        >
          {String(heure).padStart(2, "0")}:00
        </span>
      ))}
    </div>
  );
}

/** Lignes des heures, séparateurs de jours et trait de l'heure actuelle. */
export function FondColonnes({ jours }: { jours: Date[] }) {
  // Null au premier rendu : l'heure du serveur et celle du navigateur ne
  // coïncident jamais à la seconde près (écart d'hydratation sinon).
  const [maintenant, setMaintenant] = useState<Date | null>(null);

  useEffect(() => {
    const premier = window.setTimeout(() => setMaintenant(new Date()), 0);
    const minuteur = window.setInterval(() => setMaintenant(new Date()), 60_000);
    return () => {
      window.clearTimeout(premier);
      window.clearInterval(minuteur);
    };
  }, []);

  const colonneAujourdHui = maintenant
    ? jours.findIndex((jour) => numeroJourCivil(jour) === numeroJourCivil(maintenant))
    : -1;
  const minuteActuelle = maintenant ? minutesAbsolues(maintenant) % MINUTES_PAR_JOUR : 0;
  const largeur = 100 / jours.length;

  return (
    <>
      {HEURES.map((heure) => (
        <div
          key={heure}
          className="pointer-events-none absolute inset-x-0 border-t border-ink/[.06]"
          style={{ top: heure * HAUTEUR_HEURE }}
        />
      ))}
      {jours.slice(1).map((jour, index) => (
        <div
          key={jour.toISOString()}
          className="pointer-events-none absolute inset-y-0 border-l border-ink/[.06]"
          style={{ left: `${(index + 1) * largeur}%` }}
        />
      ))}
      {colonneAujourdHui >= 0 && (
        <div
          className="pointer-events-none absolute z-20 flex items-center"
          style={{
            top: (minuteActuelle / 60) * HAUTEUR_HEURE,
            left: `${colonneAujourdHui * largeur}%`,
            width: `${largeur}%`,
          }}
        >
          <span className="-ml-1 h-2 w-2 rounded-full bg-accent" />
          <span className="h-px flex-1 bg-accent" />
        </div>
      )}
    </>
  );
}
