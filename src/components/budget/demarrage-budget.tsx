"use client";

import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Premier écran quand le budget ne contient encore rien. Aucune donnée n'est
 * pré-remplie : chacun part de son propre budget. L'écran sert juste à
 * expliquer les trois rythmes de saisie avant d'entrer, pour que la première
 * ligne créée soit posée au bon endroit.
 */
export function DemarrageBudget({ onCommencer }: { onCommencer: () => void }) {
  return (
    <div className="fade-in mx-auto max-w-xl rounded-card bg-card p-7 text-center shadow-card">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-soft text-accent">
        <Wallet className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-ink">
        Ton budget est vide
      </h2>
      <p className="mx-auto mt-2 max-w-[46ch] font-body text-sm text-ink/55">
        Tout part du bouton <strong className="text-ink">Ajouter</strong>. Chaque
        ligne suit l&apos;un des trois rythmes :
      </p>
      <dl className="mx-auto mt-5 max-w-[42ch] space-y-2.5 text-left">
        <Rythme
          nom="Chaque mois"
          quoi="Salaires, prêts, abonnements — le socle qui revient à l'identique."
        />
        <Rythme
          nom="Ponctuel"
          quoi="Les courses, l'essence, un restaurant. Le quotidien, daté au jour."
        />
        <Rythme
          nom="À venir"
          quoi="Un projet ou une rentrée exceptionnelle. Avec une échéance, elle entre dans la projection de solde."
        />
      </dl>
      <p className="mx-auto mt-5 max-w-[46ch] font-body text-sm text-ink/55">
        Pense aussi à saisir tes soldes dans l&apos;onglet{" "}
        <strong className="text-ink">Capital</strong> : c&apos;est le point de
        départ de la projection.
      </p>
      <div className="mt-6">
        <Button type="button" onClick={onCommencer}>
          Commencer
        </Button>
      </div>
    </div>
  );
}

function Rythme({ nom, quoi }: { nom: string; quoi: string }) {
  return (
    <div className="rounded-inner bg-soft/60 px-4 py-2.5">
      <dt className="font-body text-sm font-bold text-ink">{nom}</dt>
      <dd className="mt-0.5 font-body text-xs text-ink/55">{quoi}</dd>
    </div>
  );
}
