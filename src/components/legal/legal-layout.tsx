import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Mise en page commune des pages légales (mentions, confidentialité, CGU).
 * Colonne lisible centrée, cohérente avec l'identité AEVIO One.
 */
export function LegalLayout({
  titre,
  miseAJour,
  children,
}: {
  titre: string;
  miseAJour: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg px-5 py-10 md:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à MyDay
        </Link>

        <article className="rounded-2xl border border-ink/10 bg-card p-6 md:p-10">
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
            {titre}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Dernière mise à jour : {miseAJour}
          </p>
          <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-ink">
            {children}
          </div>
        </article>
      </div>
    </main>
  );
}

/** Section titrée réutilisable dans une page légale. */
export function LegalSection({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">{titre}</h2>
      <div className="space-y-3 text-muted">{children}</div>
    </section>
  );
}
