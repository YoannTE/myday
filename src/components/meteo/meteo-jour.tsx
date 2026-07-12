"use client";

import { meteoMeta } from "@/components/meteo/meteo-icon";
import type { MeteoJour } from "@/components/meteo/meteo-api";

// Abréviation du jour de la semaine (français), ou « Auj. » pour le jour
// courant. On ancre l'heure à midi pour éviter tout décalage de date.
function libelleJour(dateIso: string, estAujourdHui: boolean): string {
  if (estAujourdHui) return "Auj.";
  const court = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(`${dateIso}T12:00:00`));
  return court.replace(".", "").toUpperCase();
}

interface MeteoJourColonneProps {
  jour: MeteoJour;
  estAujourdHui: boolean;
}

// Une colonne du widget (transposition de l'exemple fourni) : jour, icône,
// température max (en avant) et min (atténuée).
export function MeteoJourColonne({ jour, estAujourdHui }: MeteoJourColonneProps) {
  const { Icone, libelle } = meteoMeta(jour.code);
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-inner px-1 py-2 ${
        estAujourdHui ? "bg-soft/60" : ""
      }`}
    >
      <p
        className={`font-mono text-[9px] tracking-[.04em] uppercase md:text-[10px] ${
          estAujourdHui ? "text-accent" : "text-ink/40"
        }`}
      >
        {libelleJour(jour.date, estAujourdHui)}
      </p>
      <Icone className="h-5 w-5 text-accent md:h-7 md:w-7" aria-label={libelle} />
      <p className="font-body text-[11px] font-semibold text-ink md:text-sm">
        {jour.tempMax}°
      </p>
      <p className="font-mono text-[10px] text-ink/40 md:text-xs">
        {jour.tempMin}°
      </p>
    </div>
  );
}
