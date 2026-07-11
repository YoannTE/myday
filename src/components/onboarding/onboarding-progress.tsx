import { Fragment } from "react";

const ETAPES = [
  { numero: 1, label: "Google" },
  { numero: 2, label: "Préférences" },
  { numero: 3, label: "Sur ton téléphone" },
  { numero: 4, label: "Ton brief" },
];

/**
 * Barre de progression du wizard d'onboarding (variante « Étapes numérotées »
 * de onboarding.html, choisie par défaut) : cercles numérotés reliés par des
 * traits, labels masqués sur mobile sauf via le numéro.
 */
export function OnboardingProgress({
  etapeActuelle,
}: {
  etapeActuelle: number;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 md:gap-4">
      {ETAPES.map((etape, index) => {
        const franchie = etape.numero <= etapeActuelle;
        const estActuelle = etape.numero === etapeActuelle;
        return (
          <Fragment key={etape.numero}>
            <div className="flex items-center gap-2">
              <span
                className={
                  franchie
                    ? "cta-gradient flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs text-white"
                    : "flex h-7 w-7 items-center justify-center rounded-full bg-soft font-mono text-xs text-ink/50"
                }
              >
                {etape.numero}
              </span>
              <span
                className={
                  estActuelle
                    ? "hidden font-body text-sm font-medium text-ink md:inline"
                    : franchie
                      ? "hidden font-body text-sm text-ink/70 md:inline"
                      : "hidden font-body text-sm text-ink/40 md:inline"
                }
              >
                {etape.label}
              </span>
            </div>
            {index < ETAPES.length - 1 && (
              <div
                className={
                  franchie
                    ? "h-px flex-1 bg-accent/30"
                    : "h-px flex-1 bg-ink/10"
                }
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
