"use client";

import { useState } from "react";
import { apiCall } from "@/lib/api";
import { Button } from "@/components/ui/button";

/**
 * Étape 4 du wizard (transposition fidèle de la variante « Brief prêt en
 * scène » de onboarding.html) : clôture l'installation et ouvre le cockpit.
 * Déclenche la génération du tout premier brief en best-effort (Round 007) -
 * un échec ne doit jamais bloquer l'entrée dans le cockpit, le brief se
 * régénère de toute façon le lendemain.
 */
export function EtapeFinale({
  onTerminer,
}: {
  onTerminer: () => Promise<void>;
}) {
  const [envoi, setEnvoi] = useState(false);

  async function terminer() {
    setEnvoi(true);
    try {
      await apiCall("/api/brief/generate?trigger=onboarding", {
        method: "POST",
      });
    } catch {
      // Best-effort non bloquant - le cockpit affichera l'état vide du brief
      // et l'utilisateur pourra le générer manuellement.
    }
    await onTerminer();
  }

  return (
    <section className="cta-gradient fade-in delay-1 rounded-card p-6 text-white md:p-10">
      <span className="mb-4 inline-block rounded-full bg-white/15 px-2.5 py-1 font-mono text-[10px] tracking-[.04em] text-white/70 uppercase">
        Étape 4 · Le meilleur moment
      </span>
      <h2 className="mb-3 font-display text-xl font-extrabold tracking-[-0.02em] md:text-3xl">
        Ton cockpit est prêt.
      </h2>
      <p className="mb-6 max-w-lg font-body text-sm text-white/80 md:text-base">
        Ton agenda, tes mails et tes tâches t&apos;attendent déjà. Et ton tout
        premier brief vient d&apos;être préparé.
      </p>
      <div className="mb-6 max-w-md rounded-inner bg-white p-5">
        <span className="mb-3 inline-block rounded-full bg-soft px-2.5 py-1 font-mono text-[10px] tracking-[.04em] text-accent uppercase">
          Brief · prêt
        </span>
        <p className="mb-2 font-display font-bold tracking-[-0.02em] text-ink">
          Ton premier brief t&apos;attend en haut du cockpit.
        </p>
        <p className="font-body text-sm text-ink/50">
          Il fait le point sur ta journée, et se régénère chaque jour à
          l&apos;heure que tu as choisie.
        </p>
      </div>
      <Button
        type="button"
        disabled={envoi}
        onClick={terminer}
        className="h-auto rounded-inner bg-white px-6 py-3.5 font-display font-semibold text-accent"
      >
        {envoi ? "Ouverture..." : "Ouvrir mon cockpit →"}
      </Button>
    </section>
  );
}
