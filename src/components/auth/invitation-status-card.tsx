import Link from "next/link";

// Carte d'état pour un jeton d'invitation invalide, expiré, déjà utilisé ou
// révoqué - cet état n'a pas d'équivalent dans le mockup, construite avec les
// mêmes tokens que le reste de la page.
export function InvitationStatusCard({ message }: { message: string }) {
  return (
    <div className="fade-in delay-2 rounded-card border border-ink/10 bg-card p-6 shadow-card">
      <h2 className="mb-2 font-display text-xl font-extrabold tracking-[-0.02em] text-ink">
        {message}
      </h2>
      <p className="mb-6 font-body text-sm text-ink/50">
        Ce lien d&apos;invitation ne permet plus de créer un compte. Demande à
        la personne qui t&apos;a invité·e de t&apos;en envoyer un nouveau.
      </p>
      <p className="font-body text-sm text-ink/50">
        Déjà un compte ?{" "}
        <Link href="/sign-in" className="font-medium text-accent">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
