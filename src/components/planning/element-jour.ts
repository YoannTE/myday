import { memeJour } from "@/components/planning/date-utils";
import type { EvenementApi } from "@/components/planning/types";
import type { Task } from "@/components/taches/types";

export type ElementJour =
  | { type: "evenement"; debut: string; evenement: EvenementApi }
  | { type: "tache"; debut: string; tache: Task };

/**
 * Fusionne les événements et les tâches planifiées (time-blocking) d'un jour
 * donné, triés par heure de début. Logique partagée entre `PlanningJour` et
 * `PlanningSemaine` (Round 017).
 */
export function elementsDuJour(
  evenements: EvenementApi[],
  tachesPlanifiees: Task[],
  jour: Date,
): ElementJour[] {
  return [
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
          tache.planifie_debut && memeJour(new Date(tache.planifie_debut), jour),
      )
      .map((tache): ElementJour => ({
        type: "tache",
        debut: tache.planifie_debut as string,
        tache,
      })),
  ].sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());
}
