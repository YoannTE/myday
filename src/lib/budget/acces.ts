// Jeton d'accès au budget : conservation locale et appel API.
//
// Le jeton est délivré par `/api/budget/acces/*` après saisie du code à 4
// chiffres, vaut 12 heures, et doit accompagner chaque appel de données via
// l'en-tête `X-Budget-Acces`. Il est stocké dans le `localStorage` de CET
// appareil : déverrouiller sur le Mac ne déverrouille pas l'iPhone, ce qui est
// exactement le comportement voulu pour une section privée.

import { ApiError, apiCall } from "@/lib/api";

const CLE_JETON = "myday:budget-acces";

interface JetonStocke {
  jeton: string;
  expire_a: string;
}

export function lireJeton(): string | null {
  try {
    const brut = localStorage.getItem(CLE_JETON);
    if (!brut) return null;
    const stocke = JSON.parse(brut) as JetonStocke;
    // On purge dès la lecture : un jeton périmé ne doit pas laisser croire que
    // le budget est ouvert (le serveur le refuserait de toute façon).
    if (new Date(stocke.expire_a).getTime() <= Date.now()) {
      localStorage.removeItem(CLE_JETON);
      return null;
    }
    return stocke.jeton;
  } catch {
    return null;
  }
}

export function memoriserJeton(jeton: string, expireA: string): void {
  try {
    localStorage.setItem(CLE_JETON, JSON.stringify({ jeton, expire_a: expireA }));
  } catch {
    // Stockage indisponible (navigation privée) : l'accès reste valable le
    // temps de la visite, il sera juste redemandé au prochain chargement.
  }
}

export function oublierJeton(): void {
  try {
    localStorage.removeItem(CLE_JETON);
  } catch {
    // Rien à faire : sans stockage, il n'y a rien à oublier.
  }
}

// Repère posé sur l'appareil quand l'utilisateur charge le budget type, pour
// lui rappeler tant qu'il ne l'a pas écarté que ces montants ne sont pas les
// siens. Purement local : c'est un état d'affichage, pas une donnée du budget.
const CLE_EXEMPLE = "myday:budget-exemple";

export function marquerBudgetType(): void {
  try {
    localStorage.setItem(CLE_EXEMPLE, "1");
  } catch {
    // Sans stockage, le rappel ne survit pas au rechargement — acceptable.
  }
}

export function budgetTypeCharge(): boolean {
  try {
    return localStorage.getItem(CLE_EXEMPLE) === "1";
  } catch {
    return false;
  }
}

export function oublierBudgetType(): void {
  try {
    localStorage.removeItem(CLE_EXEMPLE);
  } catch {
    // Rien à faire.
  }
}

/** `true` quand l'API répond « budget verrouillé » (≠ session MyDay expirée). */
export function estVerrouille(erreur: unknown): boolean {
  return erreur instanceof ApiError && erreur.status === 401;
}

/**
 * Appel API du budget, jeton d'accès inclus. Sur 401, le jeton local est
 * effacé : l'écran de saisie du code se réaffiche au lieu de laisser l'écran
 * tourner à vide.
 */
export async function apiBudget<T = unknown>(
  chemin: string,
  options: Parameters<typeof apiCall>[1] = {},
): Promise<T> {
  const jeton = lireJeton();
  try {
    return await apiCall<T>(chemin, {
      ...options,
      headers: { ...options.headers, ...(jeton ? { "X-Budget-Acces": jeton } : {}) },
    });
  } catch (erreur) {
    if (estVerrouille(erreur)) oublierJeton();
    throw erreur;
  }
}
