"use client";

import { estAujourdHui, formaterJourComplet } from "@/components/planning/date-utils";
import { GrilleHoraire } from "@/components/planning/grille/grille-horaire";
import type { ElementPlanning } from "@/components/planning/grille/disposition";
import type { EvenementApi } from "@/components/planning/types";
import type { Task } from "@/components/taches/types";

interface PlanningJourProps {
  jour: Date;
  evenements: EvenementApi[];
  tachesPlanifiees?: Task[];
  onSuccess: () => void;
  onDeposer: (element: ElementPlanning, debut: Date, fin: Date) => void;
  onChangerJour: (delta: -1 | 1) => void;
}

/**
 * Vue jour : grille horaire de la journée (rendez-vous et tâches planifiées).
 * Sur téléphone comme à la souris, on déplace un bloc à une autre heure ;
 * le garder au bord gauche ou droit de la grille passe au jour précédent ou
 * suivant, comme sur iPhone. La navigation par flèches reste dans
 * `PlanningHeader`.
 */
export function PlanningJour({
  jour,
  evenements,
  tachesPlanifiees = [],
  onSuccess,
  onDeposer,
  onChangerJour,
}: PlanningJourProps) {
  return (
    <div className="fade-in delay-1 rounded-card bg-card p-3 shadow-card md:p-6">
      <p className="mb-2 font-mono text-[11px] tracking-[.04em] text-accent uppercase">
        {formaterJourComplet(jour)}
        {estAujourdHui(jour) && " · Aujourd'hui"}
      </p>
      <GrilleHoraire
        jours={[jour]}
        evenements={evenements}
        taches={tachesPlanifiees}
        onDeposer={onDeposer}
        onSuccess={onSuccess}
        onBord={onChangerJour}
      />
    </div>
  );
}
