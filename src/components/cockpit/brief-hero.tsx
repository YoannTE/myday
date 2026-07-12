"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall, ApiError } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import type { Brief } from "@/components/cockpit/types";

interface GenerateBriefResponse {
  brief_id: string;
  generated: boolean;
  degraded: boolean;
}

interface BriefHeroProps {
  brief: Brief | null;
  onRegenerated: () => void;
  onMasquer: () => void;
}

/**
 * Carte hero « Brief du jour » (F8, Round 007 - transposition fidèle de la
 * variante V0 « Carte hero » du mockup dashboard), en tête du cockpit.
 * Le brief dégradé (`degraded: true`, chemin nominal sans clé LLM) reste
 * affiché normalement avec un simple libellé discret « Brief express » -
 * jamais d'alarme. Le bouton « Régénérer » appelle `POST /api/brief/generate`
 * puis délègue le rechargement du cockpit au parent (`onRegenerated`).
 */
export function BriefHero({ brief, onRegenerated, onMasquer }: BriefHeroProps) {
  const [enCours, setEnCours] = useState(false);

  async function genererBrief(trigger: "manual" = "manual") {
    if (enCours) return;
    setEnCours(true);
    try {
      await apiCall<{ data: GenerateBriefResponse }>(
        `/api/brief/generate?trigger=${trigger}`,
        { method: "POST" },
      );
      toast.success("Ton brief a été régénéré.");
      onRegenerated();
    } catch (erreur) {
      if (erreur instanceof ApiError && erreur.status === 429) {
        toast.error("Attends une minute avant de régénérer.");
      } else {
        toast.error(
          messageErreurApi(erreur, "Impossible de régénérer ton brief."),
        );
      }
    } finally {
      setEnCours(false);
    }
  }

  if (!brief) {
    return (
      <section className="fade-in delay-1 relative overflow-hidden rounded-card bg-card p-6 text-center shadow-card md:p-12">
        <div className="cta-gradient absolute inset-x-0 top-0 h-1" />
        <button
          type="button"
          onClick={onMasquer}
          className="absolute top-3 right-4 font-body text-sm text-ink/40 transition-colors hover:text-ink/70 md:top-5"
        >
          Masquer
        </button>
        <h1 className="mb-3 font-display text-lg font-extrabold tracking-[-0.02em] text-ink md:text-3xl">
          Ton premier brief arrive.
        </h1>
        <p className="mx-auto mb-6 max-w-md font-body text-sm text-ink/60 md:text-base">
          Génère-le maintenant pour voir les priorités de ta journée en un
          coup d&apos;œil.
        </p>
        <Button
          type="button"
          disabled={enCours}
          onClick={() => genererBrief()}
          className="h-auto rounded-inner px-6 py-3.5 font-display font-semibold"
        >
          {enCours ? "Génération..." : "Générer mon brief"}
        </Button>
      </section>
    );
  }

  const { contenu, degraded, generated_at } = brief;
  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(generated_at));

  const syntheses = [
    { libelle: "Planning", valeur: contenu.schedule_summary },
    { libelle: "Tâches", valeur: contenu.tasks_summary },
    { libelle: "Mails", valeur: contenu.mails_summary },
  ];

  return (
    <section className="fade-in delay-1 relative overflow-hidden rounded-card bg-card p-4 shadow-card md:p-12">
      <div className="cta-gradient absolute inset-x-0 top-0 h-1" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block rounded-full bg-soft px-3 py-1 font-mono text-[10px] tracking-[.04em] text-accent uppercase md:text-[11px]">
            Brief · {heure}
          </span>
          {degraded && (
            <span className="inline-block rounded-full bg-ink/5 px-3 py-1 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase md:text-[11px]">
              Brief express
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={enCours}
            onClick={() => genererBrief()}
            className="font-body text-sm text-accent disabled:opacity-50"
          >
            {enCours ? "Régénération..." : "Régénérer"}
          </button>
          <button
            type="button"
            onClick={onMasquer}
            className="font-body text-sm text-ink/40 transition-colors hover:text-ink/70"
          >
            Masquer
          </button>
        </div>
      </div>

      <h1 className="mb-4 max-w-2xl font-display text-lg leading-tight font-extrabold tracking-[-0.02em] text-ink md:mb-8 md:text-4xl">
        {contenu.headline}
      </h1>

      {contenu.priorities.length > 0 && (
        <div className="mb-4 flex max-w-xl flex-col gap-2 md:mb-8 md:gap-3">
          {contenu.priorities.map((priorite, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-inner border border-ink/10 px-3 py-2.5 md:gap-4 md:px-5 md:py-4"
            >
              <span className="cta-gradient flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full font-mono text-[10px] text-white md:h-7 md:w-7 md:text-xs">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="font-body text-sm text-ink md:text-base">
                {priorite}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 grid gap-2 md:mb-8 md:grid-cols-3 md:gap-4">
        {syntheses.map((synthese) => (
          <div
            key={synthese.libelle}
            className="rounded-inner bg-soft/60 px-3 py-2.5 md:px-4 md:py-3"
          >
            <p className="mb-1 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
              {synthese.libelle}
            </p>
            <p className="font-body text-xs text-ink/70 md:text-sm">
              {synthese.valeur}
            </p>
          </div>
        ))}
      </div>

      {contenu.alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {contenu.alerts.map((alerte, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-inner bg-soft px-3 py-2.5 md:px-5 md:py-4"
            >
              <span className="flex-shrink-0 font-mono text-[10px] tracking-[.04em] text-accent uppercase md:text-[11px]">
                Alerte
              </span>
              <p className="font-body text-xs text-ink/70 md:text-sm">
                {alerte}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
