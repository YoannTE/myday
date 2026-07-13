"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { usePwaInstall } from "@/components/pwa/pwa-install-provider";
import { urlBase64VersUint8Array } from "@/lib/push/url-base64";

type EtatPush =
  | "chargement"
  | "non_supporte"
  | "ios_non_installe"
  | "refuse"
  | "inactif"
  | "actif";

async function obtenirAbonnementActuel(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Abonnement aux notifications push (Round 009) - monté dans l'onglet
 * « Brief & notifications » de /reglages, à côté des toggles par type
 * (`brief-notifications-form.tsx`, inchangé). Flux VAPID standard :
 * permission navigateur -> abonnement PushManager -> POST /api/push/subscribe.
 */
export function NotificationsPush() {
  const { isIOS, isInstalled } = usePwaInstall();
  const [etat, setEtat] = useState<EtatPush>("chargement");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;

    async function initialiser() {
      const supporte =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supporte) {
        if (!annule) setEtat("non_supporte");
        return;
      }
      if (isIOS && !isInstalled) {
        if (!annule) setEtat("ios_non_installe");
        return;
      }
      if (Notification.permission === "denied") {
        if (!annule) setEtat("refuse");
        return;
      }
      try {
        const abonnement = await obtenirAbonnementActuel();
        if (!annule) setEtat(abonnement ? "actif" : "inactif");
      } catch {
        if (!annule) setEtat("inactif");
      }
    }

    initialiser();
    return () => {
      annule = true;
    };
  }, [isIOS, isInstalled]);

  async function activer() {
    setEnCours(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat("refuse");
        toast.error("Autorise les notifications pour les activer.");
        return;
      }
      const { data } = await apiCall<{ data: { public_key: string } }>(
        "/api/push/vapid-public-key",
      );
      const registration = await navigator.serviceWorker.ready;
      const abonnement = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64VersUint8Array(data.public_key),
      });
      const cles = abonnement.toJSON().keys;
      if (!cles?.p256dh || !cles?.auth) {
        throw new Error("Abonnement incomplet, réessaie.");
      }
      await apiCall("/api/push/subscribe", {
        method: "POST",
        body: {
          endpoint: abonnement.endpoint,
          keys: { p256dh: cles.p256dh, auth: cles.auth },
        },
      });
      setEtat("actif");
      toast.success("Notifications activées sur cet appareil");
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible d'activer les notifications."),
      );
    } finally {
      setEnCours(false);
    }
  }

  async function envoyerTest() {
    setEnCours(true);
    try {
      const { data } = await apiCall<{
        data: { subscriptions: number; sent: number };
      }>("/api/push/test", { method: "POST" });
      if (data.sent > 0) {
        toast.success(
          `Notification de test envoyée à ${data.sent} appareil(s) — tu devrais la recevoir dans quelques secondes.`,
        );
      } else if (data.subscriptions === 0) {
        toast.error(
          "Aucun appareil abonné : active les notifications sur chaque appareil concerné.",
        );
      } else {
        toast.error(
          "Envoi impossible (abonnement expiré ou limite atteinte). Désactive puis réactive les notifications sur cet appareil.",
        );
      }
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible d'envoyer la notification de test."),
      );
    } finally {
      setEnCours(false);
    }
  }

  async function desactiver() {
    setEnCours(true);
    try {
      const abonnement = await obtenirAbonnementActuel();
      if (abonnement) {
        await apiCall("/api/push/subscribe", {
          method: "DELETE",
          body: { endpoint: abonnement.endpoint },
        });
        await abonnement.unsubscribe();
      }
      setEtat("inactif");
      toast.success("Notifications désactivées sur cet appareil");
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de désactiver les notifications."),
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="fade-in delay-2 rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-1 font-display font-bold tracking-[-0.02em] text-ink">
        Notifications sur cet appareil
      </h2>
      <p className="mb-4 font-body text-xs text-ink/40">
        Reçois les alertes MyDay même quand l&apos;app n&apos;est pas ouverte.
      </p>

      {etat === "chargement" && <Skeleton className="h-11 w-64" />}

      {etat === "non_supporte" && (
        <p className="font-body text-sm text-ink/50">
          Les notifications ne sont pas prises en charge par ce navigateur.
        </p>
      )}

      {etat === "ios_non_installe" && (
        <p className="font-body text-sm text-ink/50">
          Installe MyDay sur ton écran d&apos;accueil d&apos;abord, puis reviens
          ici pour activer les notifications.
        </p>
      )}

      {etat === "refuse" && (
        <p className="font-body text-sm text-ink/50">
          Tu as refusé les notifications pour MyDay. Autorise-les dans les
          réglages de ton navigateur pour les activer.
        </p>
      )}

      {etat === "inactif" && (
        <button
          type="button"
          onClick={activer}
          disabled={enCours}
          className="cta-gradient inline-flex items-center gap-2 rounded-inner px-4 py-2.5 font-display text-sm font-semibold text-white disabled:opacity-60"
        >
          <Bell className="h-4 w-4" />
          {enCours ? "Activation..." : "Activer les notifications sur cet appareil"}
        </button>
      )}

      {etat === "actif" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.04em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Activées sur cet appareil
          </span>
          <button
            type="button"
            onClick={envoyerTest}
            disabled={enCours}
            className="inline-flex items-center gap-2 rounded-inner border border-accent/30 bg-soft px-3 py-1.5 font-body text-xs text-accent disabled:opacity-60"
          >
            <Bell className="h-3.5 w-3.5" />
            {enCours ? "Envoi..." : "Notification de test"}
          </button>
          <button
            type="button"
            onClick={desactiver}
            disabled={enCours}
            className="ml-auto inline-flex items-center gap-2 rounded-inner border border-ink/10 bg-card px-3 py-1.5 font-body text-xs text-ink/60 disabled:opacity-60"
          >
            <BellOff className="h-3.5 w-3.5" />
            {enCours ? "..." : "Désactiver"}
          </button>
        </div>
      )}
    </section>
  );
}
