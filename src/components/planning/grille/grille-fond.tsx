"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  MINUTES_PAR_JOUR,
  minutesAbsolues,
  numeroJourCivil,
} from "@/components/planning/date-utils";

// Plage affichée : la journée de travail, de 8h à 22h. Un rendez-vous en
// dehors reste visible, collé au bord haut ou bas de la grille.
export const HEURE_DEBUT = 8;
export const HEURE_FIN = 22;
export const MINUTE_DEBUT = HEURE_DEBUT * 60;
export const MINUTE_FIN = HEURE_FIN * 60;
const HEURES = Array.from({ length: HEURE_FIN - HEURE_DEBUT + 1 }, (_, index) => HEURE_DEBUT + index);

// Téléphone : grille compacte, toute la journée tient sans défilement interne
// (le doigt fait défiler la page, pas le planning). Ordinateur : plus aéré.
const HAUTEUR_HEURE_MOBILE = 30;
const HAUTEUR_HEURE_ORDINATEUR = 52;
const REQUETE_ORDINATEUR = "(min-width: 768px)";

function ecouterEcran(rappel: () => void) {
  const requete = window.matchMedia(REQUETE_ORDINATEUR);
  requete.addEventListener("change", rappel);
  return () => requete.removeEventListener("change", rappel);
}

/** Hauteur d'une heure en pixels, selon la taille de l'écran. */
export function useHauteurHeure() {
  return useSyncExternalStore(
    ecouterEcran,
    () => (window.matchMedia(REQUETE_ORDINATEUR).matches ? HAUTEUR_HEURE_ORDINATEUR : HAUTEUR_HEURE_MOBILE),
    () => HAUTEUR_HEURE_ORDINATEUR,
  );
}

/** Position verticale (px) d'une minute de la journée, bornée à la plage affichée. */
export function positionMinute(minute: number, hauteurHeure: number) {
  return ((Math.min(Math.max(minute, MINUTE_DEBUT), MINUTE_FIN) - MINUTE_DEBUT) / 60) * hauteurHeure;
}

/** Colonne des heures, à gauche de la grille. */
export function GoutiereHeures({ hauteurHeure }: { hauteurHeure: number }) {
  return (
    <div className="relative w-10 flex-shrink-0 md:w-12" style={{ height: (HEURE_FIN - HEURE_DEBUT) * hauteurHeure }}>
      {HEURES.map((heure) => (
        <span
          key={heure}
          className="absolute right-1.5 -translate-y-1/2 font-mono text-[9px] text-ink/35 md:text-[10px]"
          style={{ top: (heure - HEURE_DEBUT) * hauteurHeure }}
        >
          {String(heure).padStart(2, "0")}:00
        </span>
      ))}
    </div>
  );
}

/** Lignes des heures, séparateurs de jours et trait de l'heure actuelle. */
export function FondColonnes({ jours, hauteurHeure }: { jours: Date[]; hauteurHeure: number }) {
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
          style={{ top: (heure - HEURE_DEBUT) * hauteurHeure }}
        />
      ))}
      {jours.slice(1).map((jour, index) => (
        <div
          key={jour.toISOString()}
          className="pointer-events-none absolute inset-y-0 border-l border-ink/[.06]"
          style={{ left: `${(index + 1) * largeur}%` }}
        />
      ))}
      {colonneAujourdHui >= 0 && minuteActuelle >= MINUTE_DEBUT && minuteActuelle <= MINUTE_FIN && (
        <div
          className="pointer-events-none absolute z-20 flex items-center"
          style={{
            top: positionMinute(minuteActuelle, hauteurHeure),
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
