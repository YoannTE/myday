"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { messageErreurApi } from "@/lib/api-error-message";
import { apiBudget } from "@/lib/budget/acces";
import { euros } from "@/lib/budget/calculs";
import {
  BUDGET_TYPE,
  RESTE_A_VIVRE,
  SOURCE_BUDGET_TYPE,
  TOTAL_DEPENSES,
  TOTAL_REVENUS,
} from "@/lib/budget/budget-type";
import { Button } from "@/components/ui/button";

/**
 * Premier écran quand le budget ne contient encore rien.
 *
 * La page blanche est le chemin PRINCIPAL, et le budget type un second choix
 * discret : des montants pré-remplis qui ne sont pas les siens, on les
 * survole et on oublie de les corriger — on se retrouve alors avec un budget
 * faux, ce qui est pire qu'un budget vide. Celui qui prend la trame est
 * prévenu de son origine avant de cliquer, puis par un bandeau une fois
 * dedans (cf. `budget-client.tsx`).
 */
export function DemarrageBudget({
  onCommencer,
  onBudgetType,
}: {
  onCommencer: () => void;
  onBudgetType: () => Promise<void>;
}) {
  const [enCours, setEnCours] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);

  async function importerBudgetType() {
    setEnCours(true);
    try {
      // Un seul appel, une seule transaction : les 28 lignes atterrissent
      // ensemble ou pas du tout.
      await apiBudget("/api/budget/recurrents/lot", {
        method: "POST",
        body: { lignes: BUDGET_TYPE },
      });
      toast.success("Budget type chargé — à toi de l'ajuster");
      await onBudgetType();
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Le budget type n'a pas pu être chargé."),
      );
    } finally {
      setEnCours(false);
    }
  }

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
        <Button type="button" onClick={onCommencer} disabled={enCours}>
          Commencer
        </Button>
      </div>

      <div className="mt-7 border-t border-ink/5 pt-5">
        <p className="mx-auto max-w-[46ch] font-body text-sm text-ink/55">
          Tu préfères partir d&apos;une trame ? Je peux charger un{" "}
          <strong className="text-ink">budget type</strong> de {BUDGET_TYPE.length}{" "}
          lignes — couple avec deux enfants, {euros(TOTAL_REVENUS)} de revenus et{" "}
          {euros(TOTAL_DEPENSES)} de charges. Tout est modifiable ensuite.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={importerBudgetType}
            disabled={enCours}
          >
            {enCours ? "Chargement…" : "Charger un budget type"}
          </Button>
          <button
            type="button"
            onClick={() => setDetailVisible((visible) => !visible)}
            aria-expanded={detailVisible}
            className="focus-ring rounded-full px-3 py-1.5 font-body text-sm text-ink/50 transition-colors hover:text-accent"
          >
            {detailVisible ? "Masquer la source" : "D'où viennent ces chiffres ?"}
          </button>
        </div>
        {detailVisible ? (
          <p className="mx-auto mt-3 max-w-[52ch] text-left font-body text-xs leading-relaxed text-ink/50">
            {SOURCE_BUDGET_TYPE} C&apos;est un budget «&nbsp;minimum
            décent&nbsp;» au sens de l&apos;ONPES — le seuil au-dessus duquel un
            ménage participe normalement à la vie sociale — et non une moyenne
            des dépenses françaises. Il laisse {euros(RESTE_A_VIVRE)} de reste à
            vivre. Prends-le comme une base à corriger, pas comme une norme.
          </p>
        ) : null}
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
