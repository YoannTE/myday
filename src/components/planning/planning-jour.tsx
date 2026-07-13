"use client";

import { EventCard } from "@/components/planning/event-card";
import { PlanningTacheBloc } from "@/components/planning/planning-tache-bloc";
import {
  estAujourdHui,
  formaterJourComplet,
  memeJour,
} from "@/components/planning/date-utils";
import type { EvenementApi } from "@/components/planning/types";
import type { Task } from "@/components/taches/types";

interface PlanningJourProps {
  jour: Date;
  evenements: EvenementApi[];
  tachesPlanifiees?: Task[];
  onSuccess: () => void;
}

type ElementJour =
  | { type: "evenement"; debut: string; evenement: EvenementApi }
  | { type: "tache"; debut: string; tache: Task };

/**
 * Vue jour : liste verticale des événements du jour sélectionné, fusionnée
 * avec les tâches planifiées (créneau de time-blocking) sur ce même jour. La
 * navigation jour précédent/suivant est gérée par `PlanningHeader` (le
 * fenêtrage de chargement ne couvre que ce seul jour, cf. `fenetreVue`
 * dans date-utils.ts) — ce composant n'a donc plus de sélecteur de jours
 * interne, transposition simplifiée de la variante « Jour en timeline » de
 * planning.html. Lisible sur mobile comme sur desktop (largeur contrainte
 * par le layout `max-w-4xl` de la page).
 */
export function PlanningJour({
  jour,
  evenements,
  tachesPlanifiees = [],
  onSuccess,
}: PlanningJourProps) {
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
          tache.planifie_debut && memeJour(new Date(tache.planifie_debut), jour),
      )
      .map((tache): ElementJour => ({
        type: "tache",
        debut: tache.planifie_debut as string,
        tache,
      })),
  ].sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());

  return (
    <div className="fade-in delay-1 rounded-card bg-card p-4 shadow-card md:p-6">
      <p className="mb-4 font-mono text-[11px] tracking-[.04em] text-accent uppercase">
        {formaterJourComplet(jour)}
        {estAujourdHui(jour) && " · Aujourd'hui"}
      </p>
      {elementsDuJour.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink/50">
          Aucun événement ce jour-là.
        </p>
      ) : (
        <div className="flex flex-col gap-2 md:mx-auto md:max-w-md">
          {elementsDuJour.map((element) =>
            element.type === "evenement" ? (
              <EventCard
                key={element.evenement.id}
                evenement={element.evenement}
                onSuccess={onSuccess}
              />
            ) : (
              <PlanningTacheBloc key={element.tache.id} tache={element.tache} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
