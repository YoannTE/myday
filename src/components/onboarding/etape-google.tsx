"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useGoogleStatus } from "@/components/reglages/google/use-google-status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const PERMISSIONS = [
  "Lire ton agenda et y ajouter tes événements",
  "Lire tes mails pour repérer les importants",
  "Envoyer une réponse uniquement quand tu la valides",
];

/**
 * Étape 1 du wizard (transposition fidèle de la variante « Carte
 * permissions » de onboarding.html) : demande la connexion Google, confirme
 * qu'elle est déjà active (skippable), ou affiche un message clair en cas
 * d'échec OAuth (`?google=error`).
 */
function EtapeGoogleContenu({ onContinuer }: { onContinuer: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const echecOAuth = searchParams.get("google") === "error";
  const dejaTraite = useRef(false);
  const { donnees, erreur, recharger } = useGoogleStatus();

  useEffect(() => {
    if (dejaTraite.current) return;
    const resultat = searchParams.get("google");
    if (!resultat) return;
    dejaTraite.current = true;

    if (resultat === "connected") {
      toast.success("Ton compte Google est bien connecté.");
      recharger();
    }
    router.replace("/onboarding");
  }, [searchParams, recharger, router]);

  return (
    <section className="fade-in delay-1 rounded-card bg-card p-6 shadow-card md:p-10">
      <span className="mb-4 inline-block rounded-full bg-soft px-2.5 py-1 font-mono text-[10px] tracking-[.04em] text-accent uppercase">
        Étape 1 · En cours
      </span>
      <h1 className="mb-3 font-display text-xl font-extrabold tracking-[-0.02em] text-ink md:text-3xl">
        Connecte ton compte Google
      </h1>
      <p className="mb-6 max-w-lg font-body text-sm text-ink/60 md:text-base">
        C&apos;est lui qui remplit ton cockpit : ton agenda et tes mails
        arrivent tout seuls, en sécurité, via la connexion officielle Google.
      </p>

      {echecOAuth && (
        <div className="mb-6 max-w-lg rounded-inner border border-accent/20 bg-soft p-4">
          <p className="font-body text-sm text-ink/70">
            La connexion à Google a échoué. Réessaie, ou passe cette étape
            pour continuer sans agenda ni mails pour l&apos;instant.
          </p>
        </div>
      )}

      {erreur && <p className="mb-4 font-body text-sm text-ink/50">{erreur}</p>}

      {!erreur && !donnees && (
        <Skeleton className="mb-6 h-32 w-full max-w-lg rounded-inner" />
      )}

      {donnees?.connected && (
        <div className="mb-6 max-w-lg rounded-inner bg-soft p-5">
          <p className="font-body text-sm text-ink/80">
            <span className="font-semibold text-accent">✓</span> Ton compte
            Google est déjà connecté.
          </p>
        </div>
      )}

      {donnees && !donnees.connected && (
        <div className="mb-6 max-w-lg rounded-inner bg-soft p-5">
          <p className="mb-3 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
            MyDay pourra
          </p>
          <div className="flex flex-col gap-2.5 font-body text-sm text-ink/80">
            {PERMISSIONS.map((permission) => (
              <p key={permission}>
                <span className="font-semibold text-accent">✓</span>{" "}
                {permission}
              </p>
            ))}
          </div>
          <p className="mt-3 font-body text-xs text-ink/40">
            MyDay ne supprime jamais rien dans Gmail.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {donnees?.connected ? (
          <Button
            type="button"
            onClick={onContinuer}
            className="cta-gradient h-auto rounded-inner px-6 py-3.5 font-display font-semibold text-white"
          >
            Continuer
          </Button>
        ) : (
          <Button
            type="button"
            render={<a href="/api/google/connect?next=/onboarding" />}
            className="cta-gradient h-auto gap-3 rounded-inner px-6 py-3.5 font-display font-semibold text-white"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-accent">
              G
            </span>
            Continuer avec Google
          </Button>
        )}
        <button
          type="button"
          onClick={onContinuer}
          className="font-body text-sm text-ink/40 underline-offset-4 hover:text-ink/60 hover:underline"
        >
          Passer cette étape
        </button>
      </div>
    </section>
  );
}

export function EtapeGoogle({ onContinuer }: { onContinuer: () => void }) {
  return (
    <Suspense fallback={null}>
      <EtapeGoogleContenu onContinuer={onContinuer} />
    </Suspense>
  );
}
