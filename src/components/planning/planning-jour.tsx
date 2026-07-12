"use client";

import { EventCard } from "@/components/planning/event-card";
import {
  estAujourdHui,
  formaterJourComplet,
  memeJour,
} from "@/components/planning/date-utils";
import type { EvenementApi } from "@/components/planning/types";

interface PlanningJourProps {
  jour: Date;
  evenements: EvenementApi[];
  onSuccess: () => void;
}

/**
 * Vue jour : liste verticale des événements du jour sélectionné. La
 * navigation jour précédent/suivant est gérée par `PlanningHeader` (le
 * fenêtrage de chargement ne couvre que ce seul jour, cf. `fenetreVue`
 * dans date-utils.ts) — ce composant n'a donc plus de sélecteur de jours
 * interne, transposition simplifiée de la variante « Jour en timeline » de
 * planning.html. Lisible sur mobile comme sur desktop (largeur contrainte
 * par le layout `max-w-4xl` de la page).
 */
export function PlanningJour({ jour, evenements, onSuccess }: PlanningJourProps) {
  const evenementsDuJour = evenements
    .filter((evenement) => memeJour(new Date(evenement.debut), jour))
    .sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());

  return (
    <div className="fade-in delay-1 rounded-card bg-card p-4 shadow-card md:p-6">
      <p className="mb-4 font-mono text-[11px] tracking-[.04em] text-accent uppercase">
        {formaterJourComplet(jour)}
        {estAujourdHui(jour) && " · Aujourd'hui"}
      </p>
      {evenementsDuJour.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink/50">
          Aucun événement ce jour-là.
        </p>
      ) : (
        <div className="flex flex-col gap-2 md:mx-auto md:max-w-md">
          {evenementsDuJour.map((evenement) => (
            <EventCard key={evenement.id} evenement={evenement} onSuccess={onSuccess} />
          ))}
        </div>
      )}
    </div>
  );
}
