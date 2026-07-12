"use client";

import { EventCard } from "@/components/planning/event-card";
import {
  estAujourdHui,
  formaterEnteteJour,
  memeJour,
} from "@/components/planning/date-utils";
import type { EvenementApi } from "@/components/planning/types";

interface PlanningSemaineProps {
  jours: Date[];
  evenements: EvenementApi[];
  onSuccess: () => void;
}

// Vue semaine en colonnes (transposition fidèle de la variante « Semaine en
// colonnes » de planning.html) : une colonne par jour, la journée en cours
// mise en avant. Les 7 colonnes tiennent dans la largeur disponible (pas de
// défilement horizontal) : espacements et rembourrages réduits sur mobile
// pour que les 7 jours restent visibles d'un coup d'œil.
export function PlanningSemaine({
  jours,
  evenements,
  onSuccess,
}: PlanningSemaineProps) {
  return (
    <div className="fade-in delay-1 rounded-card bg-card p-2 shadow-card md:p-6">
      <div className="grid grid-cols-7 gap-1 md:gap-3">
        {jours.map((jour) => {
          const aujourdHui = estAujourdHui(jour);
          const evenementsDuJour = evenements
            .filter((evenement) => memeJour(new Date(evenement.debut), jour))
            .sort(
              (a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime(),
            );

          return (
            <div
              key={jour.toISOString()}
              className={
                aujourdHui
                  ? "rounded-inner border border-accent/20 bg-soft/50 p-0.5 md:p-1"
                  : undefined
              }
            >
              <p
                className={`mb-2 text-center font-mono text-[9px] tracking-[.02em] break-words uppercase md:mb-3 md:text-[10px] md:tracking-[.04em] ${
                  aujourdHui ? "mt-1 text-accent md:mt-2" : "text-ink/40"
                }`}
              >
                {formaterEnteteJour(jour)}
                {aujourdHui && " · Auj."}
              </p>
              {evenementsDuJour.map((evenement) => (
                <EventCard
                  key={evenement.id}
                  evenement={evenement}
                  onSuccess={onSuccess}
                />
              ))}
            </div>
          );
        })}
      </div>
      {evenements.length === 0 && (
        <p className="mt-4 text-center text-sm text-ink/50">
          Aucun événement cette semaine.
        </p>
      )}
    </div>
  );
}
