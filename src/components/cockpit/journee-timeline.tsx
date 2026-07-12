import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  estAujourdHui,
  formaterEnteteJour,
  formaterHeure,
} from "@/components/planning/date-utils";
import { EventFormDialog } from "@/components/planning/event-form-dialog";
import { SectionAddButton } from "@/components/cockpit/section-add-button";
import type { CockpitEvent } from "@/components/cockpit/types";

function estEnCours(evenement: CockpitEvent): boolean {
  const maintenant = Date.now();
  return (
    new Date(evenement.debut).getTime() <= maintenant &&
    maintenant <= new Date(evenement.fin).getTime()
  );
}

interface JourneeTimelineProps {
  evenements: CockpitEvent[];
  onSuccess: () => void;
}

/**
 * Bloc « Ton planning » du cockpit (F8, Round 014 — anciennement
 * « Ta journée ») : les 10 prochains événements à venir (`prochains`, tri
 * croissant fourni par le backend), pas seulement ceux du jour. Pastille
 * `.pulse-now` sur l'événement en cours ; date affichée uniquement pour les
 * jours différents d'aujourd'hui (fuseau Europe/Paris, `date-utils.ts`).
 * Bouton « + » (F7) : création rapide d'événement sans quitter le cockpit.
 */
export function JourneeTimeline({ evenements, onSuccess }: JourneeTimelineProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
            Ton planning
          </h2>
          <EventFormDialog
            onSuccess={onSuccess}
            trigger={<SectionAddButton aria-label="Ajouter un événement" />}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </EventFormDialog>
        </div>
        <Link href="/planning" className="font-body text-sm text-accent">
          Tout voir →
        </Link>
      </div>
      <div className="flex flex-col gap-4 rounded-card bg-card p-6 shadow-card">
        {evenements.length === 0 ? (
          <p className="text-center font-body text-sm text-ink/50">
            Aucun rendez-vous prévu.
          </p>
        ) : (
          evenements.map((evenement) => {
            const enCours = estEnCours(evenement);
            const debut = new Date(evenement.debut);
            const aujourdHui = estAujourdHui(debut);
            return (
              <div key={evenement.id} className="flex items-center gap-4">
                <span
                  className={cn(
                    "flex w-16 flex-shrink-0 flex-col items-start gap-0.5 font-mono text-xs",
                    enCours ? "text-accent" : "text-ink/40",
                  )}
                >
                  {!aujourdHui && (
                    <span className="text-[10px] text-ink/30 uppercase">
                      {formaterEnteteJour(debut)}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    {enCours && (
                      <span className="pulse-now inline-block h-2 w-2 rounded-full bg-accent" />
                    )}
                    {formaterHeure(evenement.debut)}
                  </span>
                </span>
                <div
                  className={cn(
                    "flex-1 rounded-inner px-4 py-3",
                    enCours ? "border-2 border-accent/30" : "bg-soft",
                  )}
                >
                  <p className="font-body text-ink">{evenement.titre}</p>
                  {evenement.lieu && (
                    <p className="mt-0.5 font-body text-xs text-ink/50">
                      {evenement.lieu}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
