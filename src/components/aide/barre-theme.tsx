import { Info } from "lucide-react";
import type { ReactNode } from "react";

/** Une carte thème (clair ou sombre) avec son aperçu de couleur. */
function CarteTheme({
  apercu,
  titre,
  texte,
}: {
  apercu: ReactNode;
  titre: string;
  texte: ReactNode;
}) {
  return (
    <section className="rounded-card bg-card p-5 shadow-card md:p-6">
      <div className="flex items-start gap-3">
        {apercu}
        <div>
          <h3 className="font-display text-base font-bold tracking-[-0.02em] text-ink">
            {titre}
          </h3>
          <p className="mt-1 font-body text-sm leading-relaxed text-ink/70">
            {texte}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Explique que la barre en haut de la fenêtre (sur ordinateur) suit
 * automatiquement le thème clair ou sombre de l'ordinateur.
 */
export function BarreTheme() {
  return (
    <div className="mt-12">
      <div className="mb-6">
        <p className="font-mono text-[11px] tracking-[.04em] text-accent uppercase">
          Sur ordinateur
        </p>
        <h2 className="mt-1 font-display text-xl font-extrabold tracking-[-0.02em] text-ink md:text-2xl">
          La barre du haut s&apos;adapte à ton thème
        </h2>
        <p className="mt-2 max-w-2xl font-body text-sm text-ink/60">
          Sur ordinateur, la barre au-dessus de MyDay change de couleur toute
          seule pour s&apos;accorder au réglage clair ou sombre de ton
          ordinateur. Tu n&apos;as rien à faire, c&apos;est automatique.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <CarteTheme
          apercu={
            <span className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-inner border border-ink/15 bg-[#f5f7fb]" />
          }
          titre="Ton ordinateur est en thème clair"
          texte={
            <>
              La barre prend la même couleur que le fond clair de MyDay : elle
              se fond dans le design de l&apos;application.
            </>
          }
        />
        <CarteTheme
          apercu={
            <span className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-inner border border-ink/15 bg-black" />
          }
          titre="Ton ordinateur est en thème sombre"
          texte={<>La barre est noire, en harmonie avec le mode sombre.</>}
        />
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-card bg-card p-5 shadow-card">
        <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
        <p className="font-body text-sm leading-relaxed text-ink/70">
          <b className="font-semibold text-ink">Bon à savoir :</b> la barre suit
          le thème de ton <b className="font-semibold text-ink">ordinateur</b>{" "}
          (son réglage clair ou sombre), et non le bouton clair/sombre à
          l&apos;intérieur de MyDay. Si ton ordinateur est en thème clair mais
          que tu utilises MyDay en mode sombre, la barre restera claire.
          C&apos;est une limite du navigateur, pas un bug.
        </p>
      </div>
    </div>
  );
}
