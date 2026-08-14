"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Lock, Plus, X } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import {
  apiBudget,
  budgetTypeCharge,
  estVerrouille,
  lireJeton,
  marquerBudgetType,
  oublierBudgetType,
  oublierJeton,
} from "@/lib/budget/acces";
import {
  decalerMois,
  libelleMois,
  moisCourant,
} from "@/lib/budget/calculs";
import type {
  BudgetDonnees,
  Operation,
  Prevision,
  Recurrent,
} from "@/lib/budget/types";
import { VerrouBudget } from "@/components/budget/verrou-budget";
import { VueEnsemble } from "@/components/budget/vue-ensemble";
import { OngletRecurrents } from "@/components/budget/onglet-recurrents";
import { OngletQuotidien } from "@/components/budget/onglet-quotidien";
import { OngletPrevisions } from "@/components/budget/onglet-previsions";
import { OngletComptes } from "@/components/budget/onglet-comptes";
import { DemarrageBudget } from "@/components/budget/demarrage-budget";
import {
  DialogLigne,
  ligneVierge,
  type LigneEnEdition,
} from "@/components/budget/dialog-ligne";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Onglet = "ensemble" | "recurrents" | "quotidien" | "previsions" | "comptes";

const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: "ensemble", libelle: "Vue d'ensemble" },
  { cle: "recurrents", libelle: "Chaque mois" },
  { cle: "quotidien", libelle: "Au quotidien" },
  { cle: "previsions", libelle: "À venir" },
  { cle: "comptes", libelle: "Capital" },
];

interface EtatAcces {
  code_defini: boolean;
  bloque_jusqua: string | null;
}

/**
 * Racine de la page Budget. Enchaîne trois états :
 *
 *   1. verrouillé — le clavier à 4 chiffres (aucune donnée n'est chargée) ;
 *   2. vide — accueil qui explique les trois rythmes de saisie ;
 *   3. ouvert — le mois courant, ses cinq écrans et la fiche de saisie.
 *
 * Toutes les données sont chargées en un appel et les calculs se font côté
 * client : changer de mois ne redemande rien au serveur.
 */
export function BudgetClient() {
  const [etat, setEtat] = useState<EtatAcces | null>(null);
  const [donnees, setDonnees] = useState<BudgetDonnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mois, setMois] = useState(moisCourant());
  const [onglet, setOnglet] = useState<Onglet>("ensemble");
  const [ligne, setLigne] = useState<LigneEnEdition | null>(null);
  const [demarrageIgnore, setDemarrageIgnore] = useState(false);
  const [rappelExemple, setRappelExemple] = useState(false);

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
    } catch (echec) {
      setErreur(messageErreurApi(echec, "Impossible de contacter le budget."));
      return null;
    }
  }, []);

  useEffect(() => {
    let annule = false;
    (async () => {
      const etatLu = await lireEtat();
      if (annule) return;
      setRappelExemple(budgetTypeCharge());
      if (!etatLu?.code_defini) return;
      if (lireJeton()) await charger();
    })();
    return () => {
      annule = true;
    };
  }, [charger, lireEtat]);

  async function apresDeverrouillage() {
    await lireEtat();
    await charger();
  }

  function verrouiller() {
    oublierJeton();
    setDonnees(null);
    void lireEtat();
  }

  if (erreur && !donnees) {
    return (
      <div className="rounded-card bg-card p-6 text-center shadow-card">
        <p className="font-body text-sm text-ink/60">{erreur}</p>
      </div>
    );
  }

  if (!etat) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (!donnees) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <VerrouBudget
          etat={etat}
          onOuvert={apresDeverrouillage}
          captureClavier
        />
      </div>
    );
  }

  const vide =
    donnees.recurrents.length === 0 &&
    donnees.operations.length === 0 &&
    donnees.previsions.length === 0 &&
    donnees.comptes.length === 0;

  if (vide && !demarrageIgnore) {
    return (
      <DemarrageBudget
        onCommencer={() => setDemarrageIgnore(true)}
        onBudgetType={async () => {
          marquerBudgetType();
          setRappelExemple(true);
          await charger();
        }}
      />
    );
  }

  function ouvrirRecurrent(recurrent: Recurrent) {
    setLigne({
      id: recurrent.id,
      rythme: "recurrent",
      sens: recurrent.sens,
      libelle: recurrent.libelle,
      categorie: recurrent.categorie,
      montant: String(recurrent.montant),
      date: `${mois}-01`,
      echeance: "",
      fait: false,
    });
  }

  function ouvrirOperation(operation: Operation) {
    setLigne({
      id: operation.id,
      rythme: "operation",
      sens: operation.sens,
      libelle: operation.libelle,
      categorie: operation.categorie,
      montant: String(operation.montant),
      date: operation.date_operation,
      echeance: "",
      fait: false,
    });
  }

  function ouvrirPrevision(prevision: Prevision) {
    setLigne({
      id: prevision.id,
      rythme: "prevision",
      sens: prevision.sens,
      libelle: prevision.libelle,
      categorie: prevision.categorie,
      montant: String(prevision.montant),
      date: `${mois}-01`,
      echeance: prevision.echeance ?? "",
      fait: prevision.fait,
    });
  }

  const rythmeParDefaut =
    onglet === "recurrents"
      ? "recurrent"
      : onglet === "previsions"
        ? "prevision"
        : "operation";

  return (
    <div className="flex flex-col gap-5">
      {rappelExemple ? (
        <div className="fade-in flex items-start gap-3 rounded-card bg-soft p-4">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-accent"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 font-body text-sm text-ink/70">
            Ces montants viennent d&apos;un budget type (couple avec deux
            enfants, sources ONPES, INSEE et CAF).{" "}
            <strong className="font-bold text-ink">
              Ce ne sont pas tes chiffres
            </strong>{" "}
            : reprends chaque ligne dans « Chaque mois » et ajuste-la.
          </p>
          <button
            type="button"
            onClick={() => {
              oublierBudgetType();
              setRappelExemple(false);
            }}
            aria-label="Masquer ce rappel"
            className="focus-ring -m-1 shrink-0 rounded-full p-1 text-ink/40 transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-card p-1 shadow-card">
          <button
            type="button"
            onClick={() => setMois(decalerMois(mois, -1))}
            aria-label="Mois précédent"
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-soft hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-[8.5rem] text-center font-body text-sm font-bold text-ink capitalize">
            {libelleMois(mois)}
          </span>
          <button
            type="button"
            onClick={() => setMois(decalerMois(mois, 1))}
            aria-label="Mois suivant"
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-soft hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {mois !== moisCourant() ? (
          <button
            type="button"
            onClick={() => setMois(moisCourant())}
            className="focus-ring rounded-full px-3 py-1.5 font-body text-sm text-ink/50 transition-colors hover:text-accent"
          >
            Ce mois-ci
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={verrouiller}
            className="text-ink/50"
            aria-label="Verrouiller le budget"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Verrouiller</span>
          </Button>
          <Button
            type="button"
            onClick={() => setLigne(ligneVierge(mois, rythmeParDefaut))}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter
          </Button>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="inline-flex gap-1 rounded-full bg-soft p-1">
          {ONGLETS.map((entree) => (
            <button
              key={entree.cle}
              type="button"
              aria-current={onglet === entree.cle ? "page" : undefined}
              onClick={() => setOnglet(entree.cle)}
              className={cn(
                "focus-ring rounded-full px-3.5 py-1.5 font-body text-sm whitespace-nowrap transition-colors",
                onglet === entree.cle
                  ? "bg-card font-bold text-ink shadow-card"
                  : "text-ink/55 hover:text-ink",
              )}
            >
              {entree.libelle}
            </button>
          ))}
        </div>
      </div>

      {onglet === "ensemble" ? (
        <VueEnsemble
          donnees={donnees}
          mois={mois}
          onOuvrirPrevision={ouvrirPrevision}
        />
      ) : null}
      {onglet === "recurrents" ? (
        <OngletRecurrents donnees={donnees} onModifier={ouvrirRecurrent} />
      ) : null}
      {onglet === "quotidien" ? (
        <OngletQuotidien
          donnees={donnees}
          mois={mois}
          onModifier={ouvrirOperation}
          onRecharger={charger}
        />
      ) : null}
      {onglet === "previsions" ? (
        <OngletPrevisions donnees={donnees} onModifier={ouvrirPrevision} />
      ) : null}
      {onglet === "comptes" ? (
        <OngletComptes donnees={donnees} mois={mois} onRecharger={charger} />
      ) : null}

      <DialogLigne
        ligne={ligne}
        onFermer={() => setLigne(null)}
        onEnregistre={async () => {
          setLigne(null);
          await charger();
        }}
      />
    </div>
  );
}
