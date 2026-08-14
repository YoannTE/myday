"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { euros } from "@/lib/budget/calculs";
import type { Sens } from "@/lib/budget/types";
import { cn } from "@/lib/utils";

// Briques partagées par les cinq écrans du budget. Règle de couleur (design
// AEVIO One, aucun vert dans l'app) : une entrée est portée par l'accent bleu,
// une sortie reste en encre neutre, et seul un solde négatif passe en
// `destructive`. Le signe et le libellé portent le sens, pas la seule couleur.

export function CarteBudget({
  titre,
  sous,
  droite,
  children,
  className,
}: {
  titre: string;
  sous?: string;
  droite?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-card bg-card shadow-card",
        className,
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h2 className="font-display font-bold tracking-[-0.02em] text-ink">
            {titre}
          </h2>
          {sous ? (
            <p className="mt-0.5 font-body text-xs text-ink/50">{sous}</p>
          ) : null}
        </div>
        {droite ? (
          <div className="ml-auto shrink-0 pt-0.5 text-right">{droite}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function LigneBudget({
  libelle,
  meta,
  montant,
  sens,
  barre = false,
  onClick,
}: {
  libelle: string;
  meta: string;
  montant: number;
  sens: Sens;
  barre?: boolean;
  onClick?: () => void;
}) {
  const entree = sens === "entree";
  const Balise = onClick ? "button" : "div";
  return (
    <Balise
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "group flex w-full items-center gap-3.5 border-t border-ink/5 px-5 py-3 text-left first:border-t-0",
        onClick && "transition-colors hover:bg-soft/60",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-7 w-1.5 shrink-0 rounded-full",
          barre ? "bg-ink/15" : entree ? "bg-accent" : "bg-ink/25",
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-body text-sm text-ink",
            barre && "text-ink/40 line-through",
          )}
        >
          {libelle}
        </span>
        <span className="label-mono mt-0.5 block truncate text-ink/40 normal-case">
          {meta}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 font-body text-sm font-bold tabular-nums",
          barre ? "text-ink/40" : entree ? "text-accent" : "text-ink",
        )}
      >
        {entree ? "+" : "−"}
        {euros(montant)}
      </span>
      {onClick ? (
        <Pencil
          aria-hidden="true"
          className="hidden h-3.5 w-3.5 shrink-0 text-ink/25 transition-opacity group-hover:text-ink/50 sm:block"
        />
      ) : null}
    </Balise>
  );
}

export function ListeVide({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-10 text-center font-body text-sm text-ink/40">
      {children}
    </p>
  );
}

export function BandeauTotaux({
  entrees,
}: {
  entrees: { libelle: string; valeur: string; ton?: "accent" | "alerte" }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-ink/5 bg-soft/50 px-5 py-3.5">
      {entrees.map((entree) => (
        <div key={entree.libelle}>
          <p className="label-mono text-ink/45">{entree.libelle}</p>
          <p
            className={cn(
              "mt-0.5 font-display text-base font-bold tabular-nums",
              entree.ton === "accent" && "text-accent",
              entree.ton === "alerte" && "text-destructive",
              !entree.ton && "text-ink",
            )}
          >
            {entree.valeur}
          </p>
        </div>
      ))}
    </div>
  );
}
