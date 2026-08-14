"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  calculerMois,
  deMois,
  euros,
  eurosSignes,
  libelleMois,
  parCategorie,
  projeter,
  totalComptes,
  type SourcesBudget,
} from "@/lib/budget/calculs";
import type { BudgetDonnees, Prevision } from "@/lib/budget/types";
import { CarteBudget, LigneBudget, ListeVide } from "@/components/budget/elements";
import { GraphiqueProjection } from "@/components/budget/graphique-projection";
import { cn } from "@/lib/utils";

const MOIS_PROJETES = 13;

interface VueEnsembleProps {
  donnees: BudgetDonnees;
  mois: string;
  onOuvrirPrevision: (prevision: Prevision) => void;
}

/**
 * Écran d'accueil du budget. Le chiffre en vedette est le **reste à vivre**
 * ordinaire (récurrent + quotidien), délibérément SANS l'exceptionnel : une
 * commission de 15 000 € tombant sur le mois ne doit pas laisser croire qu'il
 * reste 15 000 € à dépenser. L'exceptionnel est annoncé juste en dessous, et
 * c'est la projection de solde qui, elle, l'intègre.
 */
export function VueEnsemble({
  donnees,
  mois,
  onOuvrirPrevision,
}: VueEnsembleProps) {
  const sources: SourcesBudget = donnees;
  const calcul = calculerMois(mois, sources);
  const postes = parCategorie(mois, sources);
  const capital = totalComptes(donnees.comptes);
  const projection = projeter(mois, MOIS_PROJETES, sources, donnees.comptes);

  const partFixe =
    calcul.entreesOrdinaires > 0
      ? Math.min(1, calcul.recurrentSorties / calcul.entreesOrdinaires)
      : 0;
  const partVariable =
    calcul.entreesOrdinaires > 0
      ? Math.min(1 - partFixe, calcul.ponctuelSorties / calcul.entreesOrdinaires)
      : 0;
  const tauxEngage =
    calcul.entreesOrdinaires > 0
      ? Math.round((calcul.sortiesOrdinaires / calcul.entreesOrdinaires) * 100)
      : 0;

  const plusGrosPoste = postes[0]?.montant ?? 1;

  const prochaines = donnees.previsions
    .filter(
      (prevision) =>
        !prevision.fait &&
        prevision.echeance !== null &&
        prevision.echeance >= mois &&
        prevision.echeance <= projection[3]?.cle,
    )
    .sort((a, b) => (a.echeance ?? "").localeCompare(b.echeance ?? ""));

  const zoneRef = useRef<HTMLDivElement>(null);

  // Les jauges et les barres se remplissent depuis la gauche, le chiffre en
  // vedette se compte : l'animation dit « voici comment ce total se forme ».
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const contexte = gsap.context(() => {
      gsap.fromTo(
        "[data-anim='jauge']",
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: "left center",
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
        },
      );
      gsap.fromTo(
        "[data-anim='barre']",
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: "left center",
          duration: 0.6,
          stagger: 0.04,
          ease: "power3.out",
        },
      );
      const vedette = zone.querySelector<HTMLElement>("[data-anim='vedette']");
      if (vedette) {
        const compteur = { valeur: 0 };
        gsap.to(compteur, {
          valeur: calcul.resteAVivre,
          duration: 0.8,
          ease: "power2.out",
          onUpdate: () => {
            vedette.textContent = eurosSignes(Math.round(compteur.valeur));
          },
          onComplete: () => {
            vedette.textContent = eurosSignes(calcul.resteAVivre);
          },
        });
      }
    }, zone);
    return () => {
      contexte.revert();
      // Le compteur écrit dans le DOM, hors du rendu React : si le tween est
      // interrompu (changement de mois, démontage), le montant affiché doit
      // repartir à la valeur exacte, jamais rester figé à mi-parcours. Sur un
      // chiffre d'argent, un nombre faux à l'écran n'est pas une option.
      const vedette = zone.querySelector<HTMLElement>("[data-anim='vedette']");
      if (vedette) vedette.textContent = eurosSignes(calcul.resteAVivre);
    };
  }, [calcul.resteAVivre, mois]);

  const deficit = calcul.resteAVivre < 0;

  return (
    <div ref={zoneRef} className="flex flex-col gap-5">
      <section className="fade-in overflow-hidden rounded-card bg-card shadow-card">
        <div className="grid gap-0 md:grid-cols-[1.15fr_1fr]">
          <div className="p-6">
            <p className="label-mono text-ink/45">
              Reste à vivre · {libelleMois(mois)}
            </p>
            <p
              data-anim="vedette"
              className={cn(
                "mt-2 font-display text-4xl font-extrabold tracking-[-0.03em] tabular-nums md:text-5xl",
                deficit ? "text-destructive" : "text-accent",
              )}
            >
              {eurosSignes(calcul.resteAVivre)}
            </p>
            <p className="mt-2 max-w-[46ch] font-body text-sm text-ink/55">
              {deficit
                ? `Le mois ordinaire est déficitaire : il manque ${euros(
                    Math.abs(calcul.resteAVivre),
                  )} pour l'équilibrer.`
                : "Ce qu'il te reste une fois les charges et le quotidien payés."}
              {calcul.exceptionnel !== 0 ? (
                <>
                  {" "}
                  S&apos;y ajoutent{" "}
                  <strong className="font-bold text-ink">
                    {eurosSignes(calcul.exceptionnel)}
                  </strong>{" "}
                  d&apos;exceptionnel ce mois-ci — mouvement réel{" "}
                  {eurosSignes(calcul.mouvement)}.
                </>
              ) : null}
            </p>

            <div className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-soft">
              <span
                data-anim="jauge"
                className="block h-full rounded-full bg-accent"
                style={{ width: `${(partFixe * 100).toFixed(2)}%` }}
              />
              <span
                data-anim="jauge"
                className="block h-full rounded-full bg-accent/40"
                style={{ width: `${(partVariable * 100).toFixed(2)}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-body text-xs text-ink/55">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-accent" aria-hidden="true" />
                Charges fixes {euros(calcul.recurrentSorties)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-accent/40" aria-hidden="true" />
                Quotidien {euros(calcul.ponctuelSorties)}
              </span>
              <span className="tabular-nums">
                <strong className="font-bold text-ink">{tauxEngage} %</strong> des
                revenus engagés
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-ink/5 md:border-t-0 md:border-l">
            <Tuile
              libelle="Revenus ordinaires"
              valeur={euros(calcul.entreesOrdinaires)}
              note={`dont ${euros(calcul.recurrentEntrees)} de récurrent`}
              accent
            />
            <Tuile
              libelle="Dépenses ordinaires"
              valeur={euros(calcul.sortiesOrdinaires)}
              note={`${calcul.operations.length} écriture${
                calcul.operations.length > 1 ? "s" : ""
              } au quotidien`}
              bordGauche
            />
            <Tuile
              libelle="Capital disponible"
              valeur={euros(capital)}
              note={`${donnees.comptes.length} compte${
                donnees.comptes.length > 1 ? "s" : ""
              }`}
              sansBordBas
            />
            <Tuile
              libelle="Projets sans échéance"
              valeur={euros(
                donnees.previsions
                  .filter((p) => !p.fait && p.sens === "sortie" && !p.echeance)
                  .reduce((total, p) => total + p.montant, 0),
              )}
              note="à caler dans le temps"
              bordGauche
              sansBordBas
            />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
        <CarteBudget
          className="fade-in delay-1"
          titre="Solde projeté"
          sous="Ton capital, puis mois après mois"
          droite={
            <span className="label-mono text-ink/45">{MOIS_PROJETES - 1} mois</span>
          }
        >
          <GraphiqueProjection points={projection} />
        </CarteBudget>

        <CarteBudget
          className="fade-in delay-2"
          titre="Où part l'argent"
          sous={`Dépenses ${deMois(mois)}`}
          droite={
            <span className="font-body text-sm font-bold text-ink tabular-nums">
              {euros(calcul.sortiesOrdinaires + Math.max(0, -calcul.exceptionnel))}
            </span>
          }
        >
          {postes.length === 0 ? (
            <ListeVide>Aucune dépense ce mois-ci.</ListeVide>
          ) : (
            <div className="flex flex-col gap-3 px-5 pb-5">
              {postes.map((poste) => (
                <div key={poste.categorie}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-body text-sm text-ink">
                      {poste.categorie}
                    </span>
                    <span className="font-body text-sm font-bold text-ink/60 tabular-nums">
                      {euros(poste.montant)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft">
                    <span
                      data-anim="barre"
                      className="block h-full rounded-full bg-accent"
                      style={{
                        width: `${((poste.montant / plusGrosPoste) * 100).toFixed(2)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CarteBudget>
      </div>

      <CarteBudget
        className="fade-in delay-3"
        titre="Les trois prochains mois"
        sous="Échéances et rentrées déjà planifiées"
        droite={
          <span className="font-body text-sm font-bold text-ink tabular-nums">
            {eurosSignes(
              prochaines.reduce(
                (total, p) => total + (p.sens === "entree" ? p.montant : -p.montant),
                0,
              ),
            )}
          </span>
        }
      >
        {prochaines.length === 0 ? (
          <ListeVide>
            Rien de planifié d&apos;ici {libelleMois(projection[3]?.cle ?? mois)}.
          </ListeVide>
        ) : (
          <div>
            {prochaines.map((prevision) => (
              <LigneBudget
                key={prevision.id}
                libelle={prevision.libelle}
                meta={`${libelleMois(prevision.echeance as string)} · ${prevision.categorie}`}
                montant={prevision.montant}
                sens={prevision.sens}
                onClick={() => onOuvrirPrevision(prevision)}
              />
            ))}
          </div>
        )}
      </CarteBudget>
    </div>
  );
}

function Tuile({
  libelle,
  valeur,
  note,
  accent = false,
  bordGauche = false,
  sansBordBas = false,
}: {
  libelle: string;
  valeur: string;
  note: string;
  accent?: boolean;
  bordGauche?: boolean;
  sansBordBas?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-5 py-4",
        !sansBordBas && "border-b border-ink/5",
        bordGauche && "border-l border-ink/5",
      )}
    >
      <p className="font-body text-xs text-ink/50">{libelle}</p>
      <p
        className={cn(
          "mt-1 font-display text-lg font-extrabold tracking-[-0.02em] tabular-nums",
          accent ? "text-accent" : "text-ink",
        )}
      >
        {valeur}
      </p>
      <p className="mt-0.5 font-body text-[11px] text-ink/40">{note}</p>
    </div>
  );
}
