"use client";

import { AlertTriangle } from "lucide-react";
import { euros, eurosSignes, libelleMois, totalComptes } from "@/lib/budget/calculs";
import type { BudgetDonnees, Prevision } from "@/lib/budget/types";
import {
  BandeauTotaux,
  CarteBudget,
  LigneBudget,
  ListeVide,
} from "@/components/budget/elements";

/**
 * Projets et rentrées exceptionnelles. Deux blocs délibérément séparés : ce
 * qui a une échéance entre dans la projection de solde, ce qui n'en a pas
 * reste une intention. Voir les deux totaux côte à côte, c'est voir ce qu'il
 * reste à arbitrer.
 */
export function OngletPrevisions({
  donnees,
  onModifier,
}: {
  donnees: BudgetDonnees;
  onModifier: (prevision: Prevision) => void;
}) {
  const trier = (liste: Prevision[]) =>
    [...liste].sort((a, b) => {
      if (a.fait !== b.fait) return a.fait ? 1 : -1;
      if (a.echeance && b.echeance && a.echeance !== b.echeance) {
        return a.echeance.localeCompare(b.echeance);
      }
      return b.montant - a.montant;
    });

  const datees = trier(donnees.previsions.filter((p) => p.echeance));
  const sansDate = trier(donnees.previsions.filter((p) => !p.echeance));
  const notes = donnees.previsions.filter((p) => p.note);

  const ouvertes = donnees.previsions.filter((p) => !p.fait);
  const aFinancer = ouvertes
    .filter((p) => p.sens === "sortie")
    .reduce((somme, p) => somme + p.montant, 0);
  const attendu = ouvertes
    .filter((p) => p.sens === "entree")
    .reduce((somme, p) => somme + p.montant, 0);

  const sansDateAFinancer = sansDate
    .filter((p) => !p.fait && p.sens === "sortie")
    .reduce((somme, p) => somme + p.montant, 0);

  return (
    <div className="flex flex-col gap-5">
      {notes.length > 0 ? (
        <div className="fade-in flex gap-3 rounded-card bg-soft p-4">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-accent"
            aria-hidden="true"
          />
          <div className="font-body text-sm text-ink/70">
            {notes.map((note) => (
              <p key={note.id}>
                <strong className="font-bold text-ink">{note.libelle}</strong> —{" "}
                {note.note}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <CarteBudget
        className="fade-in delay-1"
        titre="Planifié"
        sous="Rattaché à un mois précis, donc pris en compte dans la projection"
        droite={
          <span className="label-mono text-ink/45">
            {datees.length} ligne{datees.length > 1 ? "s" : ""}
          </span>
        }
      >
        {datees.length === 0 ? (
          <ListeVide>Rien de daté pour l&apos;instant.</ListeVide>
        ) : (
          datees.map((prevision) => (
            <LigneBudget
              key={prevision.id}
              libelle={prevision.libelle}
              meta={`${libelleMois(prevision.echeance as string)} · ${prevision.categorie}`}
              montant={prevision.montant}
              sens={prevision.sens}
              barre={prevision.fait}
              onClick={() => onModifier(prevision)}
            />
          ))
        )}
        <BandeauTotaux
          entrees={[
            { libelle: "Reste à financer", valeur: euros(aFinancer) },
            {
              libelle: "Rentrées attendues",
              valeur: euros(attendu),
              ton: "accent",
            },
            {
              libelle: "Capital + attendu − projets",
              valeur: eurosSignes(totalComptes(donnees.comptes) + attendu - aFinancer),
              ton:
                totalComptes(donnees.comptes) + attendu - aFinancer < 0
                  ? "alerte"
                  : undefined,
            },
          ]}
        />
      </CarteBudget>

      <CarteBudget
        className="fade-in delay-2"
        titre="Sans échéance"
        sous="À caler dès qu'une date est décidée"
        droite={
          <span className="font-body text-sm font-bold text-ink tabular-nums">
            {euros(sansDateAFinancer)}
          </span>
        }
      >
        {sansDate.length === 0 ? (
          <ListeVide>Tout est planifié.</ListeVide>
        ) : (
          sansDate.map((prevision) => (
            <LigneBudget
              key={prevision.id}
              libelle={prevision.libelle}
              meta={`Sans échéance · ${prevision.categorie}`}
              montant={prevision.montant}
              sens={prevision.sens}
              barre={prevision.fait}
              onClick={() => onModifier(prevision)}
            />
          ))
        )}
      </CarteBudget>
    </div>
  );
}
