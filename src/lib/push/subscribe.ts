import { apiCall } from "@/lib/api";
import { urlBase64VersUint8Array } from "@/lib/push/url-base64";

/**
 * Crée (ou récupère) l'abonnement Web Push de cet appareil et l'enregistre côté
 * serveur (POST /api/push/subscribe). Idempotent : `pushManager.subscribe`
 * renvoie l'abonnement existant s'il y en a déjà un. Suppose la permission
 * navigateur déjà accordée (`Notification.permission === "granted"`).
 *
 * Partagé entre l'activation manuelle (réglages) et l'abonnement automatique à
 * la connexion (`AutoPushSubscribe`).
 */
export async function abonnerPush(): Promise<void> {
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
}
