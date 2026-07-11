/**
 * Formatage de fraîcheur partagé entre la carte Google des réglages et
 * l'indicateur de fraîcheur global (`src/components/layout/freshness.tsx`).
 */

/** Renvoie la date la plus récente parmi celles fournies (null si aucune). */
export function plusRecente(
  dates: Array<string | null | undefined>,
): string | null {
  const valides = dates.filter((date): date is string => Boolean(date));
  if (valides.length === 0) return null;
  return valides.reduce((recente, courante) =>
    new Date(courante) > new Date(recente) ? courante : recente,
  );
}

/** Formate un écart de temps en français court ("il y a 3 min"). */
export function formaterFraicheur(
  date: string | Date | null | undefined,
): string {
  if (!date) return "jamais";
  const cible = typeof date === "string" ? new Date(date) : date;
  const minutes = Math.max(0, Math.round((Date.now() - cible.getTime()) / 60000));

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const heures = Math.round(minutes / 60);
  if (heures < 24) return heures === 1 ? "il y a 1 h" : `il y a ${heures} h`;

  const jours = Math.round(heures / 24);
  return jours === 1 ? "il y a 1 j" : `il y a ${jours} j`;
}
