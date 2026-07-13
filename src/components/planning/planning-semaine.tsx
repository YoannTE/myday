"use client";

import { EventCard } from "@/components/planning/event-card";
import { PlanningTacheBloc } from "@/components/planning/planning-tache-bloc";
import {
  estAujourdHui,
  formaterEnteteJour,
  memeJour,
} from "@/components/planning/date-utils";
import type { EvenementApi } from "@/components/planning/types";
import type { Task } from "@/components/taches/types";

interface PlanningSemaineProps {
  jours: Date[];
  evenements: EvenementApi[];
  tachesPlanifiees?: Task[];
  onSuccess: () => void;
}

type ElementJour =
  | { type: "evenement"; debut: string; evenement: EvenementApi }
  | { type: "tache"; debut: string; tache: Task };

// Vue semaine en colonnes (transposition fidèle de la variante « Semaine en
// colonnes » de planning.html) : une colonne par jour, la journée en cours
// mise en avant. Les tâches planifiées (time-blocking) sont fusionnées avec
// les événements de chaque jour, triées par heure de début. Les 7 colonnes
// tiennent dans la largeur disponible (pas de défilement horizontal) :
// espacements et rembourrages réduits sur mobile pour que les 7 jours
// restent visibles d'un coup d'œil.
export function PlanningSemaine({
  jours,
  evenements,
  tachesPlanifiees = [],
  onSuccess,
}: PlanningSemaineProps) {
  return (
    <div className="fade-in delay-1 rounded-card bg-card p-2 shadow-card md:p-6">
      <div className="grid grid-cols-7 gap-1 md:gap-3">
        {jours.map((jour) => {
          const aujourdHui = estAujourdHui(jour);
          const elementsDuJour: ElementJour[] = [
            ...evenements
              .filter((evenement) => memeJour(new Date(evenement.debut), jour))
              .map((evenement): ElementJour => ({
                type: "evenement",
                debut: evenement.debut,
                evenement,
              })),
            ...tachesPlanifiees
              .filter(
                (tache) =>
                  tache.planifie_debut &&
                  memeJour(new Date(tache.planifie_debut), jour),
              )
              .map((tache): ElementJour => ({
                type: "tache",
                debut: tache.planifie_debut as string,
                tache,
              })),
          ].sort(
            (a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime(),
          );

          return (
            <div
              key={jour.toISOString()}
              className={
                aujourdHui
                  ? "min-w-0 rounded-inner border border-accent/20 bg-soft/50 p-0.5 md:p-1"
                  : "min-w-0"
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
              {elementsDuJour.map((element) =>
                element.type === "evenement" ? (
                  <EventCard
                    key={element.evenement.id}
                    evenement={element.evenement}
                    onSuccess={onSuccess}
                  />
                ) : (
                  <PlanningTacheBloc
                    key={element.tache.id}
                    tache={element.tache}
                  />
                ),
              )}
            </div>
          );
        })}
      </div>
      {evenements.length === 0 && tachesPlanifiees.length === 0 && (
        <p className="mt-4 text-center text-sm text-ink/50">
          Aucun événement cette semaine.
        </p>
      )}
    </div>
  );
}
