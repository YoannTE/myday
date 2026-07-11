// Carte Google - état non connecté (transposition fidèle de la variante
// « État détaillé » de reglages.html). Le bouton navigue vers le Route
// Handler qui construit l'URL Google et redirige (302) : une ancre
// classique, pas un Link Next (ce n'est pas une route interne à préfetcher).
export function GoogleCardDeconnecte() {
  return (
    <div className="rounded-inner border border-ink/10 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-soft font-bold text-accent shadow-card">
          G
        </span>
        <div>
          <p className="font-display text-sm font-semibold text-ink">
            Connexion Google
          </p>
          <p className="font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
            Non connecté
          </p>
        </div>
        <a
          href="/api/google/connect"
          className="ml-auto rounded-inner border border-ink/10 bg-card px-3 py-1.5 font-body text-xs text-ink/70 transition-colors hover:text-accent"
        >
          Continuer avec Google
        </a>
      </div>
      <p className="mt-3 font-body text-xs text-ink/50">
        Agenda (lecture + écriture) · Gmail (lecture + réponses validées) —
        MyDay ne supprime jamais rien dans Gmail.
      </p>
    </div>
  );
}
