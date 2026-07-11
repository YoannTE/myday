import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CockpitEvent } from "@/components/cockpit/types";

function formaterHeure(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function estEnCours(evenement: CockpitEvent): boolean {
  const maintenant = Date.now();
  return (
    new Date(evenement.debut).getTime() <= maintenant &&
    maintenant <= new Date(evenement.fin).getTime()
  );
}

/**
 * Bloc « Ta journée » du cockpit (transposition fidèle de la variante V0
 * « Timeline produit ») : événements du jour, pastille `.pulse-now` sur
 * l'événement en cours.
 */
export function JourneeTimeline({ evenements }: { evenements: CockpitEvent[] }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
          Ta journée
        </h2>
        <Link href="/planning" className="font-body text-sm text-accent">
          Tout voir →
        </Link>
      </div>
      <div className="flex flex-col gap-4 rounded-card bg-card p-6 shadow-card">
        {evenements.length === 0 ? (
          <p className="text-center font-body text-sm text-ink/50">
            Aucun événement aujourd&apos;hui.
          </p>
        ) : (
          evenements.map((evenement) => {
            const enCours = estEnCours(evenement);
            return (
              <div key={evenement.id} className="flex items-center gap-4">
                <span
                  className={cn(
                    "flex w-16 items-center gap-1.5 font-mono text-xs",
                    enCours ? "text-accent" : "text-ink/40",
                  )}
                >
                  {enCours && (
                    <span className="pulse-now inline-block h-2 w-2 rounded-full bg-accent" />
                  )}
                  {formaterHeure(evenement.debut)}
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
