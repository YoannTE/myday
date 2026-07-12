"use client";

import { EventFormDialog } from "@/components/planning/event-form-dialog";
import { formaterPlageHoraire } from "@/components/planning/date-utils";
import type { EvenementApi } from "@/components/planning/types";

function estEnCours(evenement: EvenementApi): boolean {
  const maintenant = Date.now();
  return (
    new Date(evenement.debut).getTime() <= maintenant &&
    new Date(evenement.fin).getTime() >= maintenant
  );
}

function estNonSynchronise(evenement: EvenementApi): boolean {
  return (
    evenement.sync_status === "sync_pending" ||
    evenement.sync_status === "sync_error"
  );
}

interface EventCardProps {
  evenement: EvenementApi;
  onSuccess: () => void;
}

// Carte d'un événement dans la grille semaine. Cliquer ouvre le dialog de
// modification. Badge « Non synchronisé » uniquement (jamais « via
// l'assistant » : la table events n'a pas de colonne origine).
export function EventCard({ evenement, onSuccess }: EventCardProps) {
  const enCours = estEnCours(evenement);
  const plageHoraire = formaterPlageHoraire(evenement.debut, evenement.fin);

  return (
    <EventFormDialog
      evenement={evenement}
      onSuccess={onSuccess}
      trigger={
        <button
          type="button"
          className={`mb-2 w-full rounded-inner px-3 py-2.5 text-left transition-colors ${
            enCours
              ? "border-2 border-accent/40 bg-card"
              : "bg-soft hover:bg-soft/70"
          }`}
        />
      }
    >
      <p className="flex flex-wrap items-center gap-1 font-mono text-[10px] leading-tight text-ink/40">
        {enCours && (
          <span className="pulse-now inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        )}
        <span className={enCours ? "text-accent" : undefined}>{plageHoraire}</span>
      </p>
      <p className="font-body text-xs text-ink">{evenement.titre}</p>
      {estNonSynchronise(evenement) && (
        <span className="mt-1 inline-block rounded-full border border-ink/10 bg-card px-1.5 py-0.5 font-mono text-[9px] tracking-[.04em] text-ink/50 uppercase">
          Non synchronisé
        </span>
      )}
    </EventFormDialog>
  );
}
