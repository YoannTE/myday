"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { messageErreurApi } from "@/lib/api-error-message";
import { apiBudget } from "@/lib/budget/acces";
import {
  aujourdhuiISO,
  euros,
  eurosSignes,
  libelleMois,
  projeter,
  totalComptes,
} from "@/lib/budget/calculs";
import type { BudgetDonnees, Compte } from "@/lib/budget/types";
import { CarteBudget, ListeVide } from "@/components/budget/elements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MOIS_PROJETES = 13;

/**
 * Les soldes réellement détenus, point de départ de toute la projection —
 * d'où la trajectoire affichée juste en dessous, qui montre ce que ces soldes
 * deviennent mois après mois.
 */
export function OngletComptes({
  donnees,
  mois,
  onRecharger,
}: {
  donnees: BudgetDonnees;
  mois: string;
  onRecharger: () => Promise<void>;
}) {
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [edition, setEdition] = useState<Compte | null>(null);

  const capital = totalComptes(donnees.comptes);
  const trajectoire = projeter(mois, MOIS_PROJETES, donnees, donnees.comptes);

  async function ajouter() {
    const valeur = Number(montant.replace(",", "."));
    if (!libelle.trim() || !Number.isFinite(valeur)) {
      toast.error("Indique un nom de compte et un solde.");
      return;
    }
    setEnCours(true);
    try {
      await apiBudget("/api/budget/comptes", {
        method: "POST",
        body: {
          libelle: libelle.trim(),
          montant: valeur,
          date_releve: aujourdhuiISO(),
        },
      });
      setLibelle("");
      setMontant("");
      await onRecharger();
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible d'ajouter le compte."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <CarteBudget
        className="fade-in"
        titre="Comptes"
        sous="Ce que tu as réellement de côté aujourd'hui"
        droite={
          <span className="font-body text-sm font-bold text-ink tabular-nums">
            {euros(capital)}
          </span>
        }
      >
        {donnees.comptes.length === 0 ? (
          <ListeVide>Aucun compte enregistré.</ListeVide>
        ) : (
          donnees.comptes.map((compte) => (
            <button
              key={compte.id}
              type="button"
              onClick={() => setEdition(compte)}
              className="group flex w-full items-center gap-3.5 border-t border-ink/5 px-5 py-3 text-left transition-colors first:border-t-0 hover:bg-soft/60"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-7 w-1.5 shrink-0 rounded-full",
                  compte.montant < 0 ? "bg-destructive/60" : "bg-accent",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-body text-sm text-ink">
                  {compte.libelle}
                </span>
                <span className="label-mono mt-0.5 block text-ink/40 normal-case">
                  {compte.date_releve
                    ? `Relevé du ${new Date(
                        `${compte.date_releve}T12:00:00`,
                      ).toLocaleDateString("fr-FR")}`
                    : "Solde saisi"}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 font-body text-sm font-bold tabular-nums",
                  compte.montant < 0 ? "text-destructive" : "text-ink",
                )}
              >
                {euros(compte.montant)}
              </span>
              <Pencil
                aria-hidden="true"
                className="hidden h-3.5 w-3.5 shrink-0 text-ink/25 group-hover:text-ink/50 sm:block"
              />
            </button>
          ))
        )}

        <div className="flex flex-wrap items-end gap-2 border-t border-ink/5 bg-soft/50 px-5 py-4">
          <Input
            value={libelle}
            onChange={(evenement) => setLibelle(evenement.target.value)}
            placeholder="Nom du compte — ex. Livret A"
            aria-label="Nom du compte"
            className="min-w-[12rem] flex-1 bg-card"
          />
          <Input
            type="text"
            inputMode="decimal"
            value={montant}
            onChange={(evenement) =>
              setMontant(evenement.target.value.replace(/[^0-9.,-]/g, ""))
            }
            onKeyDown={(evenement) => evenement.key === "Enter" && ajouter()}
            placeholder="Solde"
            aria-label="Solde"
            className="w-32 bg-card tabular-nums"
          />
          <Button type="button" variant="secondary" onClick={ajouter} disabled={enCours}>
            Ajouter un compte
          </Button>
        </div>
      </CarteBudget>

      <CarteBudget
        className="fade-in delay-1"
        titre="Trajectoire"
        sous="Solde attendu à la fin de chaque mois"
      >
        {trajectoire.map((point) => (
          <div
            key={point.cle}
            className="flex items-center gap-3.5 border-t border-ink/5 px-5 py-2.5 first:border-t-0"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-6 w-1.5 shrink-0 rounded-full",
                point.mouvement < 0 ? "bg-ink/25" : "bg-accent",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-body text-sm text-ink capitalize">
                {libelleMois(point.cle)}
              </span>
              <span className="label-mono mt-0.5 block text-ink/40 normal-case">
                {eurosSignes(point.mouvement)} sur le mois
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 font-body text-sm font-bold tabular-nums",
                point.solde < 0 ? "text-destructive" : "text-ink",
              )}
            >
              {eurosSignes(point.solde)}
            </span>
          </div>
        ))}
      </CarteBudget>

      <DialogCompte
        compte={edition}
        onFermer={() => setEdition(null)}
        onEnregistre={async () => {
          setEdition(null);
          await onRecharger();
        }}
      />
    </div>
  );
}

function DialogCompte({
  compte,
  onFermer,
  onEnregistre,
}: {
  compte: Compte | null;
  onFermer: () => void;
  onEnregistre: () => Promise<void>;
}) {
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [prepare, setPrepare] = useState<string | null>(null);

  // Réamorce les champs quand on ouvre un autre compte (le dialog est monté en
  // permanence, on ne peut pas s'appuyer sur le montage pour initialiser).
  if (compte && prepare !== compte.id) {
    setPrepare(compte.id);
    setLibelle(compte.libelle);
    setMontant(String(compte.montant));
  }

  if (!compte) return null;

  async function enregistrer() {
    const valeur = Number(montant.replace(",", "."));
    if (!libelle.trim() || !Number.isFinite(valeur)) {
      toast.error("Indique un nom de compte et un solde.");
      return;
    }
    setEnCours(true);
    try {
      await apiBudget(`/api/budget/comptes/${compte!.id}`, {
        method: "PATCH",
        body: {
          libelle: libelle.trim(),
          montant: valeur,
          date_releve: aujourdhuiISO(),
        },
      });
      toast.success("Compte mis à jour");
      await onEnregistre();
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible d'enregistrer le compte."));
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    setEnCours(true);
    try {
      await apiBudget(`/api/budget/comptes/${compte!.id}`, { method: "DELETE" });
      toast.success("Compte supprimé");
      await onEnregistre();
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible de supprimer le compte."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Dialog open onOpenChange={(ouvert) => (!ouvert ? onFermer() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le compte</DialogTitle>
          <DialogDescription>
            Mets le solde à jour quand tu relèves tes comptes : c&apos;est le
            point de départ de toute la projection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Input
              value={libelle}
              onChange={(evenement) => setLibelle(evenement.target.value)}
              aria-label="Nom du compte"
            />
          </div>
          <div className="space-y-1.5">
            <Input
              type="text"
              inputMode="decimal"
              value={montant}
              onChange={(evenement) =>
                setMontant(evenement.target.value.replace(/[^0-9.,-]/g, ""))
              }
              aria-label="Solde"
              className="tabular-nums"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={enCours}
            onClick={supprimer}
            className="mr-auto text-destructive hover:text-destructive"
          >
            Supprimer
          </Button>
          <Button type="button" onClick={enregistrer} disabled={enCours}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
