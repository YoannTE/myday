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
// mise en avant. La grille (min-w-[900px]) défile horizontalement sur
// mobile (`overflow-x-auto`) : c'est le prix accepté d'une vue "semaine en
// colonnes" choisie explicitement par l'utilisateur via le sélecteur de vue.
export function PlanningSemaine({
  jours,
  evenements,
  onSuccess,
}: PlanningSemaineProps) {
  return (
    <div className="fade-in delay-1 overflow-x-auto rounded-card bg-card p-4 shadow-card md:p-6">
      <div className="grid min-w-[900px] grid-cols-7 gap-3">
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
                  ? "rounded-inner border border-accent/20 bg-soft/50 p-1"
                  : undefined
              }
            >
              <p
                className={`mb-3 text-center font-mono text-[10px] tracking-[.04em] uppercase ${
                  aujourdHui ? "mt-2 text-accent" : "text-ink/40"
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
