import Link from "next/link";

// Carte affichée quand le jeton de réinitialisation est invalide ou expiré
// (Better-auth redirige alors avec `?error=INVALID_TOKEN`).
export function ResetPasswordInvalidCard() {
  return (
    <div className="fade-in delay-2 rounded-card border border-ink/10 bg-card p-6 shadow-card">
      <h2 className="mb-2 font-display text-xl font-extrabold tracking-[-0.02em] text-ink">
        Lien de réinitialisation invalide ou expiré
      </h2>
      <p className="mb-6 font-body text-sm text-ink/50">
        Ce lien ne fonctionne plus. Demande un nouveau lien de
        réinitialisation.
      </p>
      <Link
        href="/mot-de-passe-oublie"
        className="font-body text-sm font-medium text-accent"
      >
        Demander un nouveau lien
      </Link>
    </div>
  );
}
