import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  estAujourdHui,
  formaterEnteteJour,
  formaterHeure,
} from "@/components/planning/date-utils";
import { EventFormDialog } from "@/components/planning/event-form-dialog";
import { EventCategoryBadge } from "@/components/planning/event-category-badge";
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
            Planning
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
              <EventFormDialog
                key={evenement.id}
                evenement={evenement}
                onSuccess={onSuccess}
                trigger={
                  <button
                    type="button"
                    aria-label={`Modifier « ${evenement.titre} »`}
                    className="group flex w-full items-center gap-4 rounded-inner text-left"
                  />
                }
              >
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
                    "min-w-0 flex-1 rounded-inner px-4 py-3 transition-colors",
                    enCours
                      ? "border-2 border-accent/30 group-hover:bg-soft/40"
                      : "bg-soft group-hover:bg-soft/70",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 font-body break-words text-ink">
                      {evenement.titre}
                    </p>
                    {evenement.categorie && (
                      <EventCategoryBadge
                        categorie={evenement.categorie}
                        className="bg-card"
                      />
                    )}
                  </div>
                  {evenement.lieu && (
                    <p className="mt-0.5 font-body text-xs text-ink/50">
                      {evenement.lieu}
                    </p>
                  )}
                </div>
              </EventFormDialog>
            );
          })
        )}
      </div>
    </section>
  );
}
