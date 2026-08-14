"use client";

import { useState } from "react";
import { toast } from "sonner";
import { messageErreurApi } from "@/lib/api-error-message";
import { apiBudget } from "@/lib/budget/acces";
import {
  aujourdhuiISO,
  calculerMois,
  deMois,
  euros,
  eurosSignes,
  libelleJour,
  moisCourant,
} from "@/lib/budget/calculs";
import { CATEGORIES, type Operation, type Sens } from "@/lib/budget/types";
import type { BudgetDonnees } from "@/lib/budget/types";
import {
  BandeauTotaux,
  CarteBudget,
  LigneBudget,
  ListeVide,
} from "@/components/budget/elements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface OngletQuotidienProps {
  donnees: BudgetDonnees;
  mois: string;
  onModifier: (operation: Operation) => void;
  onRecharger: () => Promise<void>;
}

/**
 * Le quotidien : saisie rapide en tête, puis les écritures du mois groupées
 * par jour. La barre de saisie garde le focus sur le montant après validation
 * — on saisit rarement une seule dépense à la fois.
 */
export function OngletQuotidien({
  donnees,
  mois,
  onModifier,
  onRecharger,
}: OngletQuotidienProps) {
  const calcul = calculerMois(mois, donnees);
  const [sens, setSens] = useState<Sens>("sortie");
  const [montant, setMontant] = useState("");
  const [libelle, setLibelle] = useState("");
  const [categorie, setCategorie] = useState(CATEGORIES.sortie[0]);
  const [date, setDate] = useState(
    mois === moisCourant() ? aujourdhuiISO() : `${mois}-01`,
  );
  const [enCours, setEnCours] = useState(false);

  function changerSens(nouveau: Sens) {
    setSens(nouveau);
    setCategorie(CATEGORIES[nouveau][0]);
  }

  async function ajouter() {
    const valeur = Number(montant.replace(",", "."));
    if (!Number.isFinite(valeur) || valeur <= 0) {
      toast.error("Saisis un montant supérieur à zéro.");
      return;
    }
    setEnCours(true);
    try {
      await apiBudget("/api/budget/operations", {
        method: "POST",
        body: {
          date_operation: date,
          libelle: libelle.trim() || categorie,
          categorie,
          montant: valeur,
          sens,
        },
      });
      setMontant("");
      setLibelle("");
      await onRecharger();
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible d'ajouter l'écriture."));
    } finally {
      setEnCours(false);
    }
  }

  const parJour = new Map<string, Operation[]>();
  calcul.operations.forEach((operation) => {
    const liste = parJour.get(operation.date_operation) ?? [];
    liste.push(operation);
    parJour.set(operation.date_operation, liste);
  });
  const jours = [...parJour.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <CarteBudget
      className="fade-in"
      titre="Au quotidien"
      sous={`Les écritures ponctuelles ${deMois(mois)}, en plus du budget récurrent`}
    >
      <div className="flex flex-wrap items-end gap-2 border-t border-ink/5 bg-soft/50 px-5 py-4">
        <div className="inline-flex gap-1 rounded-full bg-card p-1">
          {(
            [
              { valeur: "sortie", libelle: "Dépense" },
              { valeur: "entree", libelle: "Recette" },
            ] as const
          ).map((option) => (
            <button
              key={option.valeur}
              type="button"
              aria-pressed={sens === option.valeur}
              onClick={() => changerSens(option.valeur)}
              className={cn(
                "focus-ring rounded-full px-3 py-1.5 font-body text-sm transition-colors",
                sens === option.valeur
                  ? "bg-accent font-bold text-white"
                  : "text-ink/55 hover:text-ink",
              )}
            >
              {option.libelle}
            </button>
          ))}
        </div>

        <Input
          type="text"
          inputMode="decimal"
          value={montant}
          onChange={(evenement) =>
            setMontant(evenement.target.value.replace(/[^0-9.,]/g, ""))
          }
          onKeyDown={(evenement) => evenement.key === "Enter" && ajouter()}
          placeholder="Montant"
          aria-label="Montant"
          className="w-28 bg-card tabular-nums"
        />
        <Input
          value={libelle}
          onChange={(evenement) => setLibelle(evenement.target.value)}
          onKeyDown={(evenement) => evenement.key === "Enter" && ajouter()}
          placeholder="Libellé — essence, restaurant…"
          aria-label="Libellé"
          className="min-w-[10rem] flex-1 bg-card"
        />
        <Select
          value={categorie}
          onValueChange={(valeur) => (valeur ? setCategorie(valeur) : undefined)}
        >
          <SelectTrigger className="w-40 bg-card" aria-label="Catégorie">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES[sens].map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={date}
          onChange={(evenement) => setDate(evenement.target.value)}
          aria-label="Date"
          className="w-40 bg-card"
        />
        <Button type="button" onClick={ajouter} disabled={enCours}>
          Ajouter
        </Button>
      </div>

      <BandeauTotaux
        entrees={[
          { libelle: "Dépenses ponctuelles", valeur: euros(calcul.ponctuelSorties) },
          {
            libelle: "Rentrées ponctuelles",
            valeur: euros(calcul.ponctuelEntrees),
            ton: "accent",
          },
          {
            libelle: "Solde du quotidien",
            valeur: eurosSignes(calcul.ponctuelEntrees - calcul.ponctuelSorties),
            ton:
              calcul.ponctuelEntrees - calcul.ponctuelSorties < 0
                ? undefined
                : "accent",
          },
        ]}
      />

      {jours.length === 0 ? (
        <ListeVide>
          Aucune écriture en {deMois(mois).replace(/^d[e']\s?/, "")}.
          <br />
          Ajoute-en une avec la barre ci-dessus.
        </ListeVide>
      ) : (
        <div>
          {jours.map((jour) => {
            const liste = parJour.get(jour) as Operation[];
            const total = liste.reduce(
              (somme, operation) =>
                somme +
                (operation.sens === "entree" ? operation.montant : -operation.montant),
              0,
            );
            return (
              <div key={jour}>
                <div className="flex items-baseline justify-between border-t border-ink/5 bg-soft/40 px-5 py-2">
                  <span className="label-mono text-ink/45">{libelleJour(jour)}</span>
                  <span className="font-body text-xs text-ink/50 tabular-nums">
                    {eurosSignes(total)}
                  </span>
                </div>
                {liste.map((operation) => (
                  <LigneBudget
                    key={operation.id}
                    libelle={operation.libelle}
                    meta={operation.categorie}
                    montant={operation.montant}
                    sens={operation.sens}
                    onClick={() => onModifier(operation)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </CarteBudget>
  );
}
