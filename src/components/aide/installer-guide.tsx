import { Apple, Bell, Share, Smartphone, MoreVertical } from "lucide-react";
import type { ReactNode } from "react";

interface Etape {
  texte: ReactNode;
}

/** Une carte plateforme (iPhone ou Android) avec ses étapes numérotées. */
function CarteInstallation({
  icone,
  plateforme,
  navigateur,
  etapes,
  notif,
}: {
  icone: ReactNode;
  plateforme: string;
  navigateur: string;
  etapes: Etape[];
  notif: ReactNode;
}) {
  return (
    <section className="rounded-card bg-card p-5 shadow-card md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="cta-gradient flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-inner text-white">
          {icone}
        </span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-ink">
            {plateforme}
          </h2>
          <p className="font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
            {navigateur}
          </p>
        </div>
      </div>
      <ol className="flex flex-col gap-2.5">
        {etapes.map((etape, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="cta-gradient flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] text-white">
              {index + 1}
            </span>
            <p className="pt-0.5 font-body text-sm leading-relaxed text-ink">
              {etape.texte}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-start gap-2.5 rounded-inner bg-soft px-3 py-2.5">
        <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
        <p className="font-body text-xs leading-relaxed text-ink/70">{notif}</p>
      </div>
    </section>
  );
}

/**
 * Guide d'installation de MyDay en tant qu'application (PWA), sur iPhone
 * (Safari) et Android (Chrome). Transposition dans l'app des guides PDF, en
 * langage simple pour un public non technique.
 */
export function InstallerGuide() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <CarteInstallation
        icone={<Apple className="h-5 w-5" />}
        plateforme="Sur iPhone"
        navigateur="Avec Safari"
        etapes={[
          {
            texte: (
              <>
                Ouvre <b className="font-semibold">Safari</b>{" "}
                (la boussole bleue). Sur iPhone, l&apos;installation ne marche
                qu&apos;avec Safari.
              </>
            ),
          },
          {
            texte: (
              <>
                Va sur{" "}
                <b className="font-semibold text-accent">
                  myday.aevio-one.com
                </b>{" "}
                et connecte-toi.
              </>
            ),
          },
          {
            texte: (
              <>
                Appuie sur le bouton{" "}
                <b className="font-semibold">Partager</b>{" "}
                <Share className="inline h-3.5 w-3.5 align-[-2px] text-ink/60" />{" "}
                (le carré avec une flèche vers le haut), en bas de l&apos;écran.
              </>
            ),
          },
          {
            texte: (
              <>
                Choisis <b className="font-semibold">« Sur l&apos;écran
                d&apos;accueil »</b>, puis <b className="font-semibold">
                « Ajouter »</b> en haut à droite.
              </>
            ),
          },
          {
            texte: (
              <>
                Ouvre MyDay <b className="font-semibold">depuis l&apos;icône</b>{" "}
                de l&apos;écran d&apos;accueil, comme une vraie application.
              </>
            ),
          },
        ]}
        notif={
          <>
            À la première ouverture, appuie sur{" "}
            <b className="font-semibold text-ink">« Autoriser »</b> pour les
            notifications. Ton iPhone doit être à jour (iOS 16.4 ou plus).
          </>
        }
      />

      <CarteInstallation
        icone={<Smartphone className="h-5 w-5" />}
        plateforme="Sur Android"
        navigateur="Avec Chrome"
        etapes={[
          {
            texte: (
              <>
                Ouvre <b className="font-semibold">Google Chrome</b>{" "}
                (l&apos;icône ronde colorée).
              </>
            ),
          },
          {
            texte: (
              <>
                Va sur{" "}
                <b className="font-semibold text-accent">
                  myday.aevio-one.com
                </b>{" "}
                et connecte-toi.
              </>
            ),
          },
          {
            texte: (
              <>
                Appuie sur le menu{" "}
                <MoreVertical className="inline h-3.5 w-3.5 align-[-2px] text-ink/60" />{" "}
                <b className="font-semibold">(les trois points)</b>, en haut à
                droite.
              </>
            ),
          },
          {
            texte: (
              <>
                Choisis{" "}
                <b className="font-semibold">« Installer l&apos;application »</b>{" "}
                (ou « Ajouter à l&apos;écran d&apos;accueil »), puis{" "}
                <b className="font-semibold">« Installer »</b>.
              </>
            ),
          },
          {
            texte: (
              <>
                Ouvre MyDay <b className="font-semibold">depuis l&apos;icône</b>{" "}
                ajoutée à ton écran d&apos;accueil.
              </>
            ),
          },
        ]}
        notif={
          <>
            À la première ouverture, appuie sur{" "}
            <b className="font-semibold text-ink">« Autoriser »</b>{" "}
            quand MyDay demande les notifications. Avec le navigateur Samsung
            « Internet », l&apos;option est dans le menu, puis « Ajouter la page
            à » et « Écran d&apos;accueil ».
          </>
        }
      />
    </div>
  );
}
