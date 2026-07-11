/**
 * Utilitaires de dates pour le planning (semaine lundi -> dimanche) et pour
 * la conversion entre l'ISO renvoyé par l'API et les champs
 * `<input type="datetime-local">` du formulaire d'événement.
 */

const JOURS_ABBREGES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Renvoie le lundi 00:00 de la semaine contenant `reference`. */
export function debutSemaine(reference: Date): Date {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  const jour = date.getDay(); // 0 = dimanche
  const decalage = jour === 0 ? -6 : 1 - jour;
  date.setDate(date.getDate() + decalage);
  return date;
}

/** Renvoie le dimanche 23:59:59.999 de la semaine commençant à `debut`. */
export function finSemaine(debut: Date): Date {
  const date = new Date(debut);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

/** Renvoie les 7 dates (lundi -> dimanche) de la semaine commençant à `debut`. */
export function joursDeLaSemaine(debut: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(debut);
    date.setDate(date.getDate() + index);
    return date;
  });
}

export function estAujourdHui(date: Date): boolean {
  return memeJour(date, new Date());
}

export function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formaterEnteteJour(date: Date): string {
  return `${JOURS_ABBREGES[date.getDay()]} ${date.getDate()}`;
}

/** Format long d'un jour ("Vendredi 10 juillet"), utilisé par la vue jour mobile. */
export function formaterJourLong(date: Date): string {
  const jourSemaine = new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(
    date,
  );
  const capitalise = jourSemaine.charAt(0).toUpperCase() + jourSemaine.slice(1);
  return `${capitalise} ${date.getDate()} ${MOIS[date.getMonth()]}`;
}

export function formaterPlageSemaine(debut: Date, fin: Date): string {
  if (debut.getMonth() === fin.getMonth()) {
    return `Semaine du ${debut.getDate()} au ${fin.getDate()} ${MOIS[fin.getMonth()]}`;
  }
  return `Semaine du ${debut.getDate()} ${MOIS[debut.getMonth()]} au ${fin.getDate()} ${MOIS[fin.getMonth()]}`;
}

/** Convertit une date ISO API en valeur locale pour un champ datetime-local. */
export function versDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Convertit la valeur locale d'un champ datetime-local en ISO pour l'API. */
export function versIso(valeurLocale: string): string {
  return new Date(valeurLocale).toISOString();
}
