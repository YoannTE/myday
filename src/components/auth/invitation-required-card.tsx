import Link from "next/link";

// Carte affichée sur /sign-up quand aucun jeton d'invitation n'est fourni -
// aucun formulaire d'inscription : la règle produit est « sur invitation
// uniquement » (cf. .project/app.md).
export function InvitationRequiredCard() {
  return (
    <div className="fade-in delay-2 rounded-card border border-ink/10 bg-card p-6 shadow-card">
      <h2 className="mb-2 font-display text-xl font-extrabold tracking-[-0.02em] text-ink">
        MyDay est accessible sur invitation uniquement
      </h2>
      <p className="mb-6 font-body text-sm text-ink/50">
        Pour créer ton compte, tu dois utiliser le lien d&apos;invitation
        envoyé par un membre de MyDay. Sans ce lien, la création de compte
        n&apos;est pas possible.
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
