"use client";

import { useState } from "react";
import { toast } from "sonner";
import { usePwaInstall } from "@/components/pwa/pwa-install-provider";
import { Button } from "@/components/ui/button";

/**
 * Étape 3 du wizard (transposition de la section « Installe MyDay sur ton
 * téléphone » de onboarding.html) : propose l'installation si le navigateur
 * le permet, affiche les instructions iOS sinon, ou confirme si déjà
 * installée. Toujours passable (contrat `usePwaInstall` figé, cf. plan
 * Round 005).
 */
export function EtapePwa({ onContinuer }: { onContinuer: () => void }) {
  const { canInstall, isIOS, isInstalled, promptInstall } = usePwaInstall();
  const [installation, setInstallation] = useState(false);

  async function installer() {
    setInstallation(true);
    try {
      await promptInstall();
      toast.success("Installation lancée sur ton appareil.");
    } catch {
      // L'utilisateur a pu fermer la fenêtre d'installation - pas bloquant.
    } finally {
      setInstallation(false);
    }
  }

  return (
    <section className="fade-in delay-1 rounded-card bg-card p-6 shadow-card md:p-10">
      <span className="mb-4 inline-block rounded-full bg-soft px-2.5 py-1 font-mono text-[10px] tracking-[.04em] text-accent uppercase">
        Étape 3 · En cours
      </span>
      <h2 className="mb-2 font-display text-lg font-extrabold tracking-[-0.02em] text-ink md:text-2xl">
        Installe MyDay sur ton téléphone
      </h2>
      <p className="mb-6 max-w-lg font-body text-sm text-ink/60">
        Indispensable pour recevoir les alertes sur iPhone : ajoute MyDay à
        ton écran d&apos;accueil en deux gestes.
      </p>

      {isInstalled && (
        <p className="mb-6 max-w-lg font-body text-sm text-ink/50">
          MyDay est déjà installée sur cet appareil. Tu peux passer à la
          suite.
        </p>
      )}

      {!isInstalled && isIOS && (
        <div className="mb-6 flex flex-wrap items-center gap-3 font-body text-sm text-ink/60">
          <span className="rounded-inner bg-soft px-3 py-2">
            1 · Touche <strong className="font-semibold">Partager</strong>
          </span>
          <span className="text-ink/30">→</span>
          <span className="rounded-inner bg-soft px-3 py-2">
            2 ·{" "}
            <strong className="font-semibold">
              Sur l&apos;écran d&apos;accueil
            </strong>
          </span>
        </div>
      )}

      {!isInstalled && !isIOS && !canInstall && (
        <p className="mb-6 max-w-lg font-body text-sm text-ink/50">
          L&apos;installation n&apos;est pas proposée par ton navigateur pour
          le moment. Tu pourras réessayer plus tard depuis les réglages.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!isInstalled && !isIOS && canInstall && (
          <Button
            type="button"
            disabled={installation}
            onClick={installer}
            className="cta-gradient h-auto rounded-inner px-6 py-3.5 font-display font-semibold text-white"
          >
            {installation ? "Installation..." : "Installer"}
          </Button>
        )}
        <button
          type="button"
          onClick={onContinuer}
          className="font-body text-sm text-ink/40 underline-offset-4 hover:text-ink/60 hover:underline"
        >
          {!isInstalled && canInstall ? "Continuer sans installer" : "Continuer"}
        </button>
      </div>
    </section>
  );
}
