"use client";

import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { formaterPlageHoraire } from "@/components/planning/date-utils";
import type { Task } from "@/components/taches/types";

interface PlanningTacheBlocProps {
  tache: Task;
}

/**
 * Bloc en lecture seule représentant une tâche planifiée dans le planning
 * (vues jour/semaine uniquement, Round time-blocking). Distinct visuellement
 * d'un `EventCard` : fond `accent`, icône dédiée et libellé « Tâche ». Le
 * clic renvoie vers `/taches` (pas d'édition inline ici, cf. contrat de la
 * tâche).
 */
export function PlanningTacheBloc({ tache }: PlanningTacheBlocProps) {
  if (!tache.planifie_debut || !tache.planifie_fin) return null;
  const plageHoraire = formaterPlageHoraire(
    tache.planifie_debut,
    tache.planifie_fin,
  );

  return (
    <Link
      href="/taches"
      className="mb-1.5 block min-w-0 rounded-inner border border-accent/30 bg-accent/10 px-1.5 py-1.5 text-left transition-colors hover:bg-accent/20 md:mb-2 md:px-3 md:py-2.5"
    >
      <p className="flex flex-wrap items-center gap-1 font-mono text-[10px] leading-tight text-accent">
        <CheckSquare className="h-3 w-3 flex-shrink-0" />
        <span>Tâche</span>
        <span className="text-ink/40">· {plageHoraire}</span>
      </p>
      <p className="min-w-0 break-words font-body text-[11px] text-ink md:text-xs">
        {tache.titre}
      </p>
    </Link>
  );
}
