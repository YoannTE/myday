"use client";

import { euros, eurosSignes } from "@/lib/budget/calculs";
import type { BudgetDonnees, Recurrent } from "@/lib/budget/types";
import {
  BandeauTotaux,
  CarteBudget,
  LigneBudget,
  ListeVide,
} from "@/components/budget/elements";

/**
 * Le socle mensuel : salaires d'un côté, charges de l'autre. Les deux colonnes
 * sont triées du plus lourd au plus léger — c'est dans cet ordre qu'on décide
 * quoi renégocier.
 */
export function OngletRecurrents({
  donnees,
  onModifier,
}: {
  donnees: BudgetDonnees;
  onModifier: (recurrent: Recurrent) => void;
}) {
  const trier = (liste: Recurrent[]) =>
    [...liste].sort((a, b) => b.montant - a.montant);
  const entrees = trier(donnees.recurrents.filter((r) => r.sens === "entree"));
  const sorties = trier(donnees.recurrents.filter((r) => r.sens === "sortie"));

  const totalEntrees = entrees
    .filter((r) => r.actif)
    .reduce((somme, r) => somme + r.montant, 0);
  const totalSorties = sorties
    .filter((r) => r.actif)
    .reduce((somme, r) => somme + r.montant, 0);
  const reste = totalEntrees - totalSorties;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <CarteBudget
        className="fade-in"
        titre="Ce qui rentre"
        sous="Tous les mois, sans rien faire"
        droite={
          <span className="font-body text-sm font-bold text-accent tabular-nums">
            {euros(totalEntrees)}
          </span>
        }
      >
        {entrees.length === 0 ? (
          <ListeVide>Aucun revenu récurrent.</ListeVide>
        ) : (
          entrees.map((ligne) => (
            <LigneBudget
              key={ligne.id}
              libelle={ligne.libelle}
              meta={ligne.actif ? `Tous les mois · ${ligne.categorie}` : "Suspendu"}
              montant={ligne.montant}
              sens={ligne.sens}
              barre={!ligne.actif}
              onClick={() => onModifier(ligne)}
            />
          ))
        )}
      </CarteBudget>

      <CarteBudget
        className="fade-in delay-1"
        titre="Ce qui sort"
        sous="Prêts, charges, abonnements"
        droite={
          <span className="font-body text-sm font-bold text-ink tabular-nums">
            {euros(totalSorties)}
          </span>
        }
      >
        {sorties.length === 0 ? (
          <ListeVide>Aucune charge récurrente.</ListeVide>
        ) : (
          sorties.map((ligne) => (
            <LigneBudget
              key={ligne.id}
              libelle={ligne.libelle}
              meta={ligne.actif ? `Tous les mois · ${ligne.categorie}` : "Suspendu"}
              montant={ligne.montant}
              sens={ligne.sens}
              barre={!ligne.actif}
              onClick={() => onModifier(ligne)}
            />
          ))
        )}
        <BandeauTotaux
          entrees={[
            {
              libelle: "Reste chaque mois",
              valeur: eurosSignes(reste),
              ton: reste < 0 ? "alerte" : "accent",
            },
            {
              libelle: "Taux d'engagement",
              valeur:
                totalEntrees > 0
                  ? `${Math.round((totalSorties / totalEntrees) * 100)} %`
                  : "—",
            },
          ]}
        />
      </CarteBudget>
    </div>
  );
}
