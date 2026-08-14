"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, Plus, ShieldCheck } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import {
  apiBudget,
  estVerrouille,
  lireJeton,
  oublierJeton,
} from "@/lib/budget/acces";
import {
  calculerMois,
  euros,
  eurosSignes,
  libelleMois,
  moisCourant,
  totalComptes,
} from "@/lib/budget/calculs";
import type { BudgetDonnees } from "@/lib/budget/types";
import { VerrouBudget } from "@/components/budget/verrou-budget";
import {
  DialogLigne,
  ligneVierge,
  type LigneEnEdition,
} from "@/components/budget/dialog-ligne";
import { CockpitSectionActions } from "@/components/cockpit/section-actions";
import { SectionAddButton } from "@/components/cockpit/section-add-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface EtatAcces {
  code_defini: boolean;
  bloque_jusqua: string | null;
}

/**
 * Section Budget du cockpit, réordonnable comme les quatre autres.
 *
 * Rien de chiffré ne s'affiche tant que le code à 4 chiffres n'a pas été saisi :
 * le cockpit est la page d'accueil, elle s'ouvre devant n'importe qui passe
 * derrière l'écran. Une fois déverrouillée, la section montre l'essentiel du
 * mois en cours, pas les cinq écrans : le détail reste sur la page dédiée, vers
 * laquelle un lien renvoie. Le bouton cadenas du bandeau permet de refermer
 * immédiatement, sans attendre l'expiration des 12 heures.
 */
export function BudgetSection() {
  const [etat, setEtat] = useState<EtatAcces | null>(null);
  const [donnees, setDonnees] = useState<BudgetDonnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ligne, setLigne] = useState<LigneEnEdition | null>(null);
  const mois = moisCourant();

  const charger = useCallback(async () => {
    try {
      const reponse = await apiBudget<{ data: BudgetDonnees }>("/api/budget");
      setDonnees(reponse.data);
      setErreur(null);
    } catch (echec) {
      if (estVerrouille(echec)) {
        setDonnees(null);
        return;
      }
      setErreur(messageErreurApi(echec, "Impossible de charger ton budget."));
    }
  }, []);

  const lireEtat = useCallback(async () => {
    try {
      const reponse = await apiCall<{ data: EtatAcces }>("/api/budget/acces");
      setEtat(reponse.data);
      return reponse.data;
    } catch {
      // Le budget ne doit pas faire tomber le cockpit : on retombe sur l'état
      // « pas encore configuré », qui ne montre aucun chiffre.
      setEtat({ code_defini: false, bloque_jusqua: null });
      return null;
    }
  }, []);

  useEffect(() => {
    let annule = false;
    (async () => {
      const etatLu = await lireEtat();
      if (annule || !etatLu?.code_defini) return;
      if (lireJeton()) await charger();
    })();
    return () => {
      annule = true;
    };
  }, [charger, lireEtat]);

  if (etat === null) {
    return <Skeleton className="h-40 w-full rounded-card" />;
  }

  // --- Aucun code posé : on invite à en créer un, sans rien afficher d'autre.
  if (!etat.code_defini) {
    return (
      <div className="fade-in rounded-card bg-card p-6 text-center shadow-card">
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-soft text-accent">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="mx-auto max-w-[42ch] font-body text-sm text-ink/55">
          Ton budget n&apos;est pas encore configuré. Choisis un code à 4 chiffres
          pour le protéger, il te sera demandé à chaque ouverture.
        </p>
        <Link
          href="/budget"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-body text-sm font-bold text-white transition-transform hover:scale-105"
        >
          Configurer le budget
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  // --- Verrouillé : le pavé, et rien d'autre.
  if (!donnees) {
    return (
      <>
        {erreur ? (
          <p className="mb-3 text-center font-body text-sm text-ink/60">{erreur}</p>
        ) : null}
        <VerrouBudget
          etat={etat}
          onOuvert={async () => {
            await lireEtat();
            await charger();
          }}
        />
      </>
    );
  }

  // --- Déverrouillé : l'essentiel du mois.
  const calcul = calculerMois(mois, donnees);
  const capital = totalComptes(donnees.comptes);
  const partFixe =
    calcul.entreesOrdinaires > 0
      ? Math.min(1, calcul.recurrentSorties / calcul.entreesOrdinaires)
      : 0;
  const partVariable =
    calcul.entreesOrdinaires > 0
      ? Math.min(1 - partFixe, calcul.ponctuelSorties / calcul.entreesOrdinaires)
      : 0;
  const deficit = calcul.resteAVivre < 0;

  return (
    <>
      <CockpitSectionActions emplacement="titre">
        <SectionAddButton
          aria-label="Ajouter une dépense"
          onClick={(evenement) => {
            evenement.stopPropagation();
            setLigne(ligneVierge(mois));
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </SectionAddButton>
      </CockpitSectionActions>

      <CockpitSectionActions>
        <button
          type="button"
          aria-label="Verrouiller le budget"
          title="Verrouiller le budget"
          onClick={() => {
            oublierJeton();
            setDonnees(null);
          }}
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </CockpitSectionActions>

      <div className="fade-in overflow-hidden rounded-card bg-card shadow-card">
        <div className="grid gap-0 sm:grid-cols-[1.15fr_1fr]">
          <div className="p-5">
            <p className="label-mono text-ink/45">
              Reste à vivre · {libelleMois(mois)}
            </p>
            <p
              className={cn(
                "mt-1.5 font-display text-3xl font-extrabold tracking-[-0.03em] tabular-nums",
                deficit ? "text-destructive" : "text-accent",
              )}
            >
              {eurosSignes(calcul.resteAVivre)}
            </p>

            <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-soft">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${(partFixe * 100).toFixed(2)}%` }}
              />
              <span
                className="block h-full rounded-full bg-accent/40"
                style={{ width: `${(partVariable * 100).toFixed(2)}%` }}
              />
            </div>
            <p className="mt-2 font-body text-xs text-ink/50">
              Charges fixes {euros(calcul.recurrentSorties)} · quotidien{" "}
              {euros(calcul.ponctuelSorties)}
              {calcul.exceptionnel !== 0
                ? ` · ${eurosSignes(calcul.exceptionnel)} d'exceptionnel`
                : ""}
            </p>
          </div>

          <div className="grid grid-cols-3 border-t border-ink/5 sm:border-t-0 sm:border-l">
            <Chiffre libelle="Revenus" valeur={euros(calcul.entreesOrdinaires)} accent />
            <Chiffre
              libelle="Dépenses"
              valeur={euros(calcul.sortiesOrdinaires)}
              bordGauche
            />
            <Chiffre libelle="Capital" valeur={euros(capital)} bordGauche />
          </div>
        </div>

        <Link
          href="/budget"
          className="flex items-center justify-between gap-3 border-t border-ink/5 px-5 py-3 font-body text-sm text-ink/55 transition-colors hover:text-accent"
        >
          Ouvrir le budget en entier
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <DialogLigne
        ligne={ligne}
        onFermer={() => setLigne(null)}
        onEnregistre={async () => {
          setLigne(null);
          await charger();
        }}
      />
    </>
  );
}

function Chiffre({
  libelle,
  valeur,
  accent = false,
  bordGauche = false,
}: {
  libelle: string;
  valeur: string;
  accent?: boolean;
  bordGauche?: boolean;
}) {
  return (
    <div className={cn("px-4 py-4", bordGauche && "border-l border-ink/5")}>
      <p className="font-body text-[11px] text-ink/50">{libelle}</p>
      <p
        className={cn(
          "mt-0.5 font-display text-base font-extrabold tracking-[-0.02em] tabular-nums",
          accent ? "text-accent" : "text-ink",
        )}
      >
        {valeur}
      </p>
    </div>
  );
}
