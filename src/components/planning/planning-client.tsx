"use client";

import { useCallback, useEffect, useState } from "react";
import { apiCall } from "@/lib/api";
import { PlanningHeader } from "@/components/planning/planning-header";
import { PlanningJour } from "@/components/planning/planning-jour";
import { PlanningSemaine } from "@/components/planning/planning-semaine";
import { PlanningSkeleton } from "@/components/planning/planning-skeleton";
import {
  debutSemaine,
  finSemaine,
  formaterPlageSemaine,
  joursDeLaSemaine,
} from "@/components/planning/date-utils";
import type { EvenementApi } from "@/components/planning/types";

// Orchestrateur client de la page Planning : navigation semaine, fetch des
// événements de la plage affichée, rechargement après chaque création/
// modification/suppression (le dialog appelle `onSuccess`).
export function PlanningClient() {
  const [reference, setReference] = useState(() => new Date());
  const [evenements, setEvenements] = useState<EvenementApi[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const debut = debutSemaine(reference);
  const fin = finSemaine(debut);
  const jours = joursDeLaSemaine(debut);

  const recharger = useCallback(async () => {
    const bornesDebut = debutSemaine(reference);
    const bornesFin = finSemaine(bornesDebut);
    try {
      const reponse = await apiCall<{ data: EvenementApi[] }>(
        `/api/events?from=${encodeURIComponent(bornesDebut.toISOString())}&to=${encodeURIComponent(bornesFin.toISOString())}`,
      );
      setEvenements(reponse.data);
      setErreur(null);
    } catch (erreurChargement) {
      setErreur(
        erreurChargement instanceof Error
          ? erreurChargement.message
          : "Impossible de charger le planning.",
      );
    }
  }, [reference]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEvenements(null);
    recharger();
  }, [recharger]);

  return (
    <div>
      <PlanningHeader
        libellePlage={formaterPlageSemaine(debut, fin)}
        onSemainePrecedente={() =>
          setReference((actuelle) => {
            const suivante = new Date(actuelle);
            suivante.setDate(suivante.getDate() - 7);
            return suivante;
          })
        }
        onSemaineSuivante={() =>
          setReference((actuelle) => {
            const suivante = new Date(actuelle);
            suivante.setDate(suivante.getDate() + 7);
            return suivante;
          })
        }
        onSuccess={recharger}
      />
      {erreur ? (
        <p className="rounded-card bg-card p-6 text-sm text-destructive shadow-card">
          {erreur}
        </p>
      ) : evenements === null ? (
        <PlanningSkeleton />
      ) : (
        <>
          <PlanningJour
            jours={jours}
            evenements={evenements}
            onSuccess={recharger}
          />
          <PlanningSemaine
            jours={jours}
            evenements={evenements}
            onSuccess={recharger}
          />
        </>
      )}
    </div>
  );
}
