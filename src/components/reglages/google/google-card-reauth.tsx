// Carte Google - état « reconnexion nécessaire » (jeton refusé/expiré côté
// Google, ex. `invalid_grant`). Bandeau soft bien visible plutôt qu'un
// simple rappel de statut, pour inciter à l'action.
export function GoogleCardReauth() {
  return (
    <div className="rounded-inner border border-accent/20 bg-soft p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-soft font-bold text-accent shadow-card">
          G
        </span>
        <div>
          <p className="font-display text-sm font-semibold text-ink">
            Reconnexion à Google nécessaire
          </p>
          <p className="font-body text-xs text-ink/60">
            L&apos;accès à ton Agenda et Gmail a expiré ou a été révoqué.
          </p>
        </div>
        <a
          href="/api/google/connect"
          className="cta-gradient ml-auto rounded-inner px-3 py-1.5 font-display text-xs font-semibold text-white shadow-cta"
        >
          Se reconnecter
        </a>
      </div>
    </div>
  );
}
