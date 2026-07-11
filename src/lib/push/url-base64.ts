/**
 * Convertit la clé publique VAPID (base64url, format standard Web Push) en
 * `Uint8Array` attendu par `PushManager.subscribe({ applicationServerKey })`.
 */
export function urlBase64VersUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = window.atob(base64);
  const tableau = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) {
    tableau[i] = brut.charCodeAt(i);
  }
  return tableau;
}
