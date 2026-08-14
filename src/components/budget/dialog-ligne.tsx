"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { messageErreurApi } from "@/lib/api-error-message";
import { apiBudget } from "@/lib/budget/acces";
import { aujourdhuiISO, moisCourant } from "@/lib/budget/calculs";
import { CATEGORIES, type Rythme, type Sens } from "@/lib/budget/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Une ligne en cours d'édition, quelle que soit sa table d'origine. */
export interface LigneEnEdition {
  id?: string;
  rythme: Rythme;
  sens: Sens;
  libelle: string;
  categorie: string;
  montant: string;
  /** `AAAA-MM-JJ` pour une opération. */
  date: string;
  /** `AAAA-MM` pour une prévision, ou "" quand rien n'est calé. */
  echeance: string;
  fait: boolean;
}

const CHEMIN: Record<Rythme, string> = {
  operation: "/api/budget/operations",
  recurrent: "/api/budget/recurrents",
  prevision: "/api/budget/previsions",
};

const RYTHMES: { valeur: Rythme; libelle: string; aide: string }[] = [
  {
    valeur: "operation",
    libelle: "Ponctuel",
    aide: "Une seule fois, à cette date. C'est le quotidien.",
  },
  {
    valeur: "recurrent",
    libelle: "Chaque mois",
    aide: "Repris automatiquement tous les mois, dans tous les calculs.",
  },
  {
    valeur: "prevision",
    libelle: "À venir",
    aide: "Un projet ou une rentrée exceptionnelle. Datée, elle entre dans la projection de solde.",
  },
];

export function ligneVierge(
  mois: string,
  rythme: Rythme = "operation",
): LigneEnEdition {
  return {
    rythme,
    sens: "sortie",
    libelle: "",
    categorie: CATEGORIES.sortie[0],
    montant: "",
    date: mois === moisCourant() ? aujourdhuiISO() : `${mois}-01`,
    echeance: rythme === "prevision" ? mois : "",
    fait: false,
  };
}

interface DialogLigneProps {
  ligne: LigneEnEdition | null;
  onFermer: () => void;
  onEnregistre: () => void;
}

/**
 * Fiche unique de saisie/édition. Le choix « Rythme » décide de la table
 * cible : c'est la seule chose que l'utilisateur ait à comprendre, et ça
 * évite trois formulaires quasi identiques.
 *
 * Changer le rythme d'une ligne existante la déplace bien d'une table à
 * l'autre : on crée la nouvelle puis on supprime l'ancienne, dans cet ordre —
 * si la création échoue, rien n'est perdu.
 */
export function DialogLigne({ ligne, onFermer, onEnregistre }: DialogLigneProps) {
  if (!ligne) return null;
  // `key` remonte la fiche quand on passe d'une ligne à l'autre : le brouillon
  // repart de la ligne reçue sans effet de synchronisation à écrire.
  return (
    <FicheLigne
      key={ligne.id ?? "nouvelle"}
      ligne={ligne}
      onFermer={onFermer}
      onEnregistre={onEnregistre}
    />
  );
}

function FicheLigne({
  ligne,
  onFermer,
  onEnregistre,
}: {
  ligne: LigneEnEdition;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [brouillon, setBrouillon] = useState<LigneEnEdition>(ligne);
  const [enCours, setEnCours] = useState(false);

  const edition = Boolean(brouillon.id);
  const categories = CATEGORIES[brouillon.sens];

  function modifier(champs: Partial<LigneEnEdition>) {
    setBrouillon((actuel) => ({ ...actuel, ...champs }));
  }

  function changerSens(sens: Sens) {
    // La liste des catégories dépend du sens : on retombe sur la première
    // valeur valide plutôt que de garder une catégorie de dépense sur une
    // recette.
    const disponibles = CATEGORIES[sens];
    modifier({
      sens,
      categorie: disponibles.includes(brouillon.categorie)
        ? brouillon.categorie
        : disponibles[0],
    });
  }

  function corps(courant: LigneEnEdition) {
    const montant = Number(courant.montant.replace(",", "."));
    const base = {
      libelle: courant.libelle.trim() || courant.categorie,
      categorie: courant.categorie,
      montant,
      sens: courant.sens,
    };
    if (courant.rythme === "operation") {
      return { ...base, date_operation: courant.date };
    }
    if (courant.rythme === "prevision") {
      return { ...base, echeance: courant.echeance || null, fait: courant.fait };
    }
    return base;
  }

  async function enregistrer() {
    const courant = brouillon;
    const montant = Number(courant.montant.replace(",", "."));
    if (!Number.isFinite(montant) || montant <= 0) {
      toast.error("Saisis un montant supérieur à zéro.");
      return;
    }
    setEnCours(true);
    try {
      const rythmeInchange = ligne.rythme === courant.rythme;
      if (edition && rythmeInchange) {
        await apiBudget(`${CHEMIN[courant.rythme]}/${courant.id}`, {
          method: "PATCH",
          body: corps(courant),
        });
      } else {
        await apiBudget(CHEMIN[courant.rythme], {
          method: "POST",
          body: corps(courant),
        });
        if (edition) {
          await apiBudget(`${CHEMIN[ligne.rythme]}/${courant.id}`, {
            method: "DELETE",
          });
        }
      }
      toast.success(edition ? "Ligne mise à jour" : "Ligne ajoutée");
      onEnregistre();
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible d'enregistrer la ligne."));
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    const courant = brouillon;
    setEnCours(true);
    try {
      await apiBudget(`${CHEMIN[courant.rythme]}/${courant.id}`, {
        method: "DELETE",
      });
      toast.success("Ligne supprimée");
      onEnregistre();
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible de supprimer la ligne."));
    } finally {
      setEnCours(false);
    }
  }

  const aideRythme = RYTHMES.find((r) => r.valeur === brouillon.rythme)?.aide;

  return (
    <Dialog open onOpenChange={(ouvert) => (!ouvert ? onFermer() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {edition ? "Modifier la ligne" : "Nouvelle ligne"}
          </DialogTitle>
          <DialogDescription>
            Le montant reste toujours positif : c&apos;est le choix
            dépense/recette qui porte le signe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Segmente
            options={[
              { valeur: "sortie", libelle: "Dépense" },
              { valeur: "entree", libelle: "Recette" },
            ]}
            valeur={brouillon.sens}
            onChange={(valeur) => changerSens(valeur as Sens)}
          />

          <div className="flex items-center gap-3 rounded-inner bg-soft px-4 py-3">
            <Input
              type="text"
              inputMode="decimal"
              autoFocus
              value={brouillon.montant}
              onChange={(evenement) =>
                modifier({ montant: evenement.target.value.replace(/[^0-9.,]/g, "") })
              }
              placeholder="0"
              aria-label="Montant en euros"
              className="h-auto border-0 bg-transparent p-0 font-display text-3xl font-extrabold tracking-[-0.02em] tabular-nums shadow-none focus-visible:ring-0"
            />
            <span className="font-display text-2xl font-bold text-ink/35">€</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget-libelle">Libellé</Label>
            <Input
              id="budget-libelle"
              value={brouillon.libelle}
              onChange={(evenement) => modifier({ libelle: evenement.target.value })}
              placeholder="Courses, essence, prime…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select
              value={brouillon.categorie}
              onValueChange={(valeur) =>
                valeur ? modifier({ categorie: valeur }) : undefined
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((categorie) => (
                  <SelectItem key={categorie} value={categorie}>
                    {categorie}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Rythme</Label>
            <Segmente
              options={RYTHMES.map((r) => ({
                valeur: r.valeur,
                libelle: r.libelle,
              }))}
              valeur={brouillon.rythme}
              onChange={(valeur) => modifier({ rythme: valeur as Rythme })}
            />
            <p className="font-body text-xs text-ink/45">{aideRythme}</p>
          </div>

          {brouillon.rythme === "operation" ? (
            <div className="space-y-1.5">
              <Label htmlFor="budget-date">Date</Label>
              <Input
                id="budget-date"
                type="date"
                value={brouillon.date}
                onChange={(evenement) => modifier({ date: evenement.target.value })}
              />
            </div>
          ) : null}

          {brouillon.rythme === "prevision" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="budget-echeance">
                  Échéance{" "}
                  <span className="font-normal text-ink/45">
                    (vide = non planifié)
                  </span>
                </Label>
                <Input
                  id="budget-echeance"
                  type="month"
                  value={brouillon.echeance}
                  onChange={(evenement) =>
                    modifier({ echeance: evenement.target.value })
                  }
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 font-body text-sm text-ink/70">
                <Checkbox
                  checked={brouillon.fait}
                  onCheckedChange={(coche) => modifier({ fait: Boolean(coche) })}
                />
                Déjà réalisé
              </label>
            </>
          ) : null}
        </div>

        <DialogFooter>
          {edition ? (
            <Button
              type="button"
              variant="ghost"
              disabled={enCours}
              onClick={supprimer}
              aria-label="Supprimer la ligne"
              className="mr-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Supprimer
            </Button>
          ) : null}
          <Button type="button" disabled={enCours} onClick={enregistrer}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Segmente({
  options,
  valeur,
  onChange,
}: {
  options: { valeur: string; libelle: string }[];
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  return (
    <div className="inline-flex w-full gap-1 rounded-full bg-soft p-1">
      {options.map((option) => {
        const actif = option.valeur === valeur;
        return (
          <button
            key={option.valeur}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(option.valeur)}
            className={cn(
              "focus-ring flex-1 rounded-full px-3 py-1.5 font-body text-sm transition-colors",
              actif
                ? "bg-card font-bold text-ink shadow-card"
                : "text-ink/55 hover:text-ink",
            )}
          >
            {option.libelle}
          </button>
        );
      })}
    </div>
  );
}
