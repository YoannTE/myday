"use client";

import { useEffect } from "react";
import { usePwaInstall } from "@/components/pwa/pwa-install-provider";
import { abonnerPush } from "@/lib/push/subscribe";

// Mémorise (par appareil) qu'on a déjà demandé automatiquement la permission,
// pour ne pas re-solliciter l'utilisateur à chaque page s'il n'a pas répondu.
const CLE_DEMANDE_AUTO = "myday:push-auto-demande";

/**
 * Active les notifications par défaut, sans clic manuel dans les réglages.
 *
 * Monté sur toutes les pages connectées (via la navbar) :
 * - si la permission est déjà accordée mais l'appareil non abonné → abonnement
 *   silencieux immédiat ;
 * - si la permission n'a pas encore été demandée → on la demande
 *   automatiquement au premier geste de l'utilisateur (contrainte navigateur /
 *   iOS : `requestPermission` doit suivre une interaction), une seule fois par
 *   appareil ;
 * - si l'utilisateur a refusé, on ne le sollicite plus (il peut réactiver dans
 *   les réglages).
 *
 * Les préférences par type (mails, rappels, brief) sont déjà activées par
 * défaut côté profil ; ce composant ne gère que l'abonnement push de l'appareil.
 */
export function AutoPushSubscribe() {
  const { isIOS, isInstalled } = usePwaInstall();

  useEffect(() => {
    const supporte =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supporte) return;
    // Sur iOS, le push n'existe que dans la PWA installée.
    if (isIOS && !isInstalled) return;
    if (Notification.permission === "denied") return;

    let annule = false;

    async function assurerAbonnement() {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existant = await registration.pushManager.getSubscription();
        if (!existant && !annule) await abonnerPush();
      } catch {
        // Silencieux : nouvel essai au prochain chargement.
      }
    }

    if (Notification.permission === "granted") {
      assurerAbonnement();
      return () => {
        annule = true;
      };
    }

    // Permission jamais demandée : on la sollicite au premier geste, une fois.
    if (window.localStorage.getItem(CLE_DEMANDE_AUTO) === "1") return;

    async function demanderAuPremierGeste() {
      window.removeEventListener("pointerdown", demanderAuPremierGeste);
      if (annule) return;
      try {
        window.localStorage.setItem(CLE_DEMANDE_AUTO, "1");
        const permission = await Notification.requestPermission();
        if (permission === "granted") await assurerAbonnement();
      } catch {
        // Silencieux.
      }
    }

    window.addEventListener("pointerdown", demanderAuPremierGeste, {
      once: true,
    });
    return () => {
      annule = true;
      window.removeEventListener("pointerdown", demanderAuPremierGeste);
    };
  }, [isIOS, isInstalled]);

  return null;
}
