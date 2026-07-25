"use client";

import { EventCard } from "@/components/planning/event-card";
import { PlanningTacheBloc } from "@/components/planning/planning-tache-bloc";
import { estAujourdHui, formaterEnteteJour } from "@/components/planning/date-utils";
import { elementsDuJour } from "@/components/planning/element-jour";
import { cn } from "@/lib/utils";
import type { EvenementApi } from "@/components/planning/types";
import type { Task } from "@/components/taches/types";

interface PlanningSemaineProps {
  jours: Date[];
  evenements: EvenementApi[];
  tachesPlanifiees?: Task[];
  onSuccess: () => void;
}

/**
 * Vue semaine. Desktop (md et +) : grille 7 colonnes (transposition fidèle
 * de la variante « Semaine en colonnes » de planning.html), la journée en
 * cours mise en avant. Mobile (< md, Round 017) : liste verticale des 7
 * jours, plus lisible qu'une grille compressée — en-tête par jour (jour
 * courant mis en avant, badge « Aujourd'hui »), événements/tâches en
 * dessous en pleine largeur, jours vides réduits à leur seul en-tête. Les
 * tâches planifiées (time-blocking) sont fusionnées avec les événements de
 * chaque jour, triées par heure de début (`elementsDuJour`, partagé avec
 * `PlanningJour`).
 */
export function PlanningSemaine({
  jours,
  evenements,
  tachesPlanifiees = [],
  onSuccess,
}: PlanningSemaineProps) {
  return (
    <div className="fade-in delay-1 rounded-card bg-card p-2 shadow-card md:p-6">
      {/* Liste verticale mobile */}
      <div className="flex flex-col divide-y divide-ink/5 md:hidden">
        {jours.map((jour) => {
          const aujourdHui = estAujourdHui(jour);
          const elements = elementsDuJour(evenements, tachesPlanifiees, jour);
          return (
            <div key={jour.toISOString()} className="py-2.5">
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "font-mono text-[11px] tracking-[.04em] uppercase",
                    aujourdHui ? "text-accent" : "text-ink/40",
                  )}
                >
                  {formaterEnteteJour(jour)}
                </p>
                {aujourdHui && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[9px] tracking-[.04em] text-accent uppercase">
                    Aujourd&apos;hui
                  </span>
                )}
              </div>
              {elements.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {elements.map((element) =>
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
              )}
            </div>
          );
        })}
      </div>

      {/* Grille 7 colonnes desktop */}
      <div className="hidden md:grid md:grid-cols-7 md:gap-3">
        {jours.map((jour) => {
          const aujourdHui = estAujourdHui(jour);
          const elements = elementsDuJour(evenements, tachesPlanifiees, jour);

          return (
            <div
              key={jour.toISOString()}
              className={cn(
                "min-w-0",
                aujourdHui && "rounded-inner border border-accent/20 bg-soft/50 p-1",
              )}
            >
              <p
                className={cn(
                  "mb-3 text-center font-mono text-[10px] tracking-[.04em] break-words uppercase",
                  aujourdHui ? "mt-2 text-accent" : "text-ink/40",
                )}
              >
                {formaterEnteteJour(jour)}
                {aujourdHui && " · Auj."}
              </p>
              {elements.map((element) =>
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
