/**
 * Conversion entre l'ISO renvoyé par l'API et un champ `<input type="date">`
 * pour l'échéance des tâches (jour uniquement, pas d'heure - Round 012).
 */

/** Convertit une date ISO API en valeur locale "AAAA-MM-JJ" pour un input date. */
export function versDateLocale(iso: string): string {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/**
 * Convertit la valeur locale "AAAA-MM-JJ" d'un input date en ISO pour l'API.
 * Fixée à midi local pour éviter tout décalage de jour lié au fuseau horaire.
 */
export function dateLocaleVersIso(valeurLocale: string): string {
  return new Date(`${valeurLocale}T12:00:00`).toISOString();
}

/**
 * Convertit une date ISO API en valeur locale "AAAA-MM-JJTHH:MM" pour un
 * champ `<input type="datetime-local">` (rappel avec heure, Round 015).
 */
export function versDatetimeLocale(iso: string): string {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Convertit la valeur locale "AAAA-MM-JJTHH:MM" d'un datetime-local en ISO. */
export function datetimeLocaleVersIso(valeurLocale: string): string {
  return new Date(valeurLocale).toISOString();
}
