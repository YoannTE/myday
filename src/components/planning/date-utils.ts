/**
 * Utilitaires de dates pour le planning (bornes des 4 vues, formatage,
 * conversion `datetime-local` <-> ISO).
 *
 * FUSEAU FORCÉ (Round 013) : toutes les bornes de vue et tous les affichages
 * sont ancrés sur `Europe/Paris` (fuseau de référence de l'app, cf.
 * `backend/app/config.py::app_timezone`), JAMAIS sur le fuseau du navigateur
 * du visiteur. Les anciens helpers utilisaient `Date.prototype.getDay/
 * getDate/setHours` (fuseau LOCAL du navigateur) : un visiteur ouvrant
 * l'app depuis un autre fuseau que Paris aurait vu des journées décalées par
 * rapport au serveur (brief, rappels, agrégats). Tout passe maintenant par
 * `composantsFuseau`/`dateDepuisComposantsCivils` ci-dessous, qui lisent et
 * reconstruisent explicitement les composants calendaires dans ce fuseau via
 * `Intl.DateTimeFormat`.
 */

export const FUSEAU_APP = "Europe/Paris";

export type VuePlanning = "jour" | "semaine" | "mois" | "annee";

const JOURS_ABBREGES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const JOURS_LONGS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
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
const MOIS_ABREGES = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

interface ComposantsCivils {
  annee: number;
  mois: number; // 1-12
  jour: number; // 1-31
  heure: number; // 0-23
  minute: number;
  seconde: number;
}

/** Lit les composants calendaires civils d'un instant dans `Europe/Paris`. */
function composantsFuseau(date: Date): ComposantsCivils {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU_APP,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const valeur = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    annee: valeur("year"),
    mois: valeur("month"),
    jour: valeur("day"),
    heure: valeur("hour") % 24,
    minute: valeur("minute"),
    seconde: valeur("second"),
  };
}

/**
 * Construit l'instant (UTC) correspondant à une date/heure CIVILE dans le
 * fuseau `Europe/Paris`. Technique de correction de décalage : on devine
 * d'abord en interprétant les composants comme de l'UTC, on mesure l'heure
 * que Paris afficherait pour cet instant deviné, puis on corrige par l'écart
 * mesuré. Une seule itération suffit : le décalage Paris (+1h/+2h) ne varie
 * qu'aux bascules d'heure d'été/hiver, jamais dans la fenêtre d'un jour.
 */
function dateDepuisComposantsCivils(
  annee: number,
  mois: number,
  jour: number,
  heure = 0,
  minute = 0,
  seconde = 0,
  milliseconde = 0,
): Date {
  const essai = new Date(
    Date.UTC(annee, mois - 1, jour, heure, minute, seconde, milliseconde),
  );
  const vuParis = composantsFuseau(essai);
  const parisCommeUtc = Date.UTC(
    vuParis.annee,
    vuParis.mois - 1,
    vuParis.jour,
    vuParis.heure,
    vuParis.minute,
    vuParis.seconde,
    milliseconde,
  );
  const decalage = parisCommeUtc - essai.getTime();
  return new Date(essai.getTime() - decalage);
}

/** Jour de la semaine (0 = dimanche .. 6 = samedi) d'une date civile pure. */
function jourSemaineDim0(annee: number, mois: number, jour: number): number {
  return new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay();
}

/** Ajoute (ou retire) `delta` jours à une date civile, avec report de mois/année. */
function ajouterJoursCivils(
  annee: number,
  mois: number,
  jour: number,
  delta: number,
): { annee: number; mois: number; jour: number } {
  const date = new Date(Date.UTC(annee, mois - 1, jour + delta));
  return {
    annee: date.getUTCFullYear(),
    mois: date.getUTCMonth() + 1,
    jour: date.getUTCDate(),
  };
}

/** Composants civils (année/mois/jour) d'un instant, dans `Europe/Paris`. */
export function jourCivil(date: Date): { annee: number; mois: number; jour: number } {
  const { annee, mois, jour } = composantsFuseau(date);
  return { annee, mois, jour };
}

/** Clé "YYYY-MM-DD" du jour civil Paris d'un instant (clé de l'agrégat densité). */
export function cleJourIso(date: Date): string {
  const { annee, mois, jour } = jourCivil(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${annee}-${pad(mois)}-${pad(jour)}`;
}

export function memeJour(a: Date, b: Date): boolean {
  const ca = jourCivil(a);
  const cb = jourCivil(b);
  return ca.annee === cb.annee && ca.mois === cb.mois && ca.jour === cb.jour;
}

export function estMemeMois(a: Date, b: Date): boolean {
  const ca = composantsFuseau(a);
  const cb = composantsFuseau(b);
  return ca.annee === cb.annee && ca.mois === cb.mois;
}

export function estAujourdHui(date: Date): boolean {
  return memeJour(date, new Date());
}

/** Minuit (00:00:00.000) Paris du jour civil contenant `reference`. */
export function debutJour(reference: Date): Date {
  const { annee, mois, jour } = composantsFuseau(reference);
  return dateDepuisComposantsCivils(annee, mois, jour, 0, 0, 0, 0);
}

/** 23:59:59.999 Paris du jour civil contenant `reference`. */
export function finJour(reference: Date): Date {
  const { annee, mois, jour } = composantsFuseau(reference);
  return dateDepuisComposantsCivils(annee, mois, jour, 23, 59, 59, 999);
}

/** Lundi 00:00 Paris de la semaine contenant `reference`. */
export function debutSemaine(reference: Date): Date {
  const { annee, mois, jour } = composantsFuseau(reference);
  const jourSemaine = jourSemaineDim0(annee, mois, jour);
  const decalage = jourSemaine === 0 ? -6 : 1 - jourSemaine;
  const lundi = ajouterJoursCivils(annee, mois, jour, decalage);
  return dateDepuisComposantsCivils(lundi.annee, lundi.mois, lundi.jour, 0, 0, 0, 0);
}

/** Dimanche 23:59:59.999 Paris de la semaine commençant à `debut`. */
export function finSemaine(debut: Date): Date {
  const { annee, mois, jour } = composantsFuseau(debut);
  const dimanche = ajouterJoursCivils(annee, mois, jour, 6);
  return dateDepuisComposantsCivils(
    dimanche.annee,
    dimanche.mois,
    dimanche.jour,
    23,
    59,
    59,
    999,
  );
}

/** Les 7 dates (lundi -> dimanche, minuit Paris) de la semaine commençant à `debut`. */
export function joursDeLaSemaine(debut: Date): Date[] {
  const { annee, mois, jour } = composantsFuseau(debut);
  return Array.from({ length: 7 }, (_, index) => {
    const civil = ajouterJoursCivils(annee, mois, jour, index);
    return dateDepuisComposantsCivils(civil.annee, civil.mois, civil.jour, 0, 0, 0, 0);
  });
}

/** 1er du mois, 00:00 Paris, du mois civil contenant `reference`. */
export function debutMois(reference: Date): Date {
  const { annee, mois } = composantsFuseau(reference);
  return dateDepuisComposantsCivils(annee, mois, 1, 0, 0, 0, 0);
}

/** Dernier jour du mois, 23:59:59.999 Paris, du mois civil contenant `reference`. */
export function finMois(reference: Date): Date {
  const { annee, mois } = composantsFuseau(reference);
  // Le "jour 0" du mois suivant (en UTC pur, calendaire) est le dernier jour du mois courant.
  const dernierJour = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return dateDepuisComposantsCivils(annee, mois, dernierJour, 23, 59, 59, 999);
}

/** 1er janvier, 00:00 Paris, de l'année civile contenant `reference`. */
export function debutAnnee(reference: Date): Date {
  const { annee } = composantsFuseau(reference);
  return dateDepuisComposantsCivils(annee, 1, 1, 0, 0, 0, 0);
}

/** 31 décembre, 23:59:59.999 Paris, de l'année civile contenant `reference`. */
export function finAnnee(reference: Date): Date {
  const { annee } = composantsFuseau(reference);
  return dateDepuisComposantsCivils(annee, 12, 31, 23, 59, 59, 999);
}

/**
 * Grille calendaire complète du mois contenant `reference` : semaines
 * entières (lundi -> dimanche) couvrant tout le mois, avec les jours de
 * bordure des mois voisins nécessaires pour compléter la première et la
 * dernière semaine (4 à 6 semaines selon le mois).
 */
export function joursGrilleMois(reference: Date): Date[] {
  const debutGrille = debutSemaine(debutMois(reference));
  const finGrille = finSemaine(debutSemaine(finMois(reference)));
  const { annee, mois, jour } = composantsFuseau(debutGrille);
  const jours: Date[] = [];
  let curseur = { annee, mois, jour };
  for (;;) {
    const date = dateDepuisComposantsCivils(
      curseur.annee,
      curseur.mois,
      curseur.jour,
      0,
      0,
      0,
      0,
    );
    jours.push(date);
    if (date.getTime() >= finGrille.getTime()) break;
    curseur = ajouterJoursCivils(curseur.annee, curseur.mois, curseur.jour, 1);
  }
  return jours;
}

/** Les 12 premiers jours de mois (minuit Paris) de l'année contenant `reference`. */
export function moisDeLAnnee(reference: Date): Date[] {
  const { annee } = composantsFuseau(reference);
  return Array.from({ length: 12 }, (_, index) =>
    dateDepuisComposantsCivils(annee, index + 1, 1, 0, 0, 0, 0),
  );
}

/** Bornes `{debut, fin}` de chargement API pour une vue et une date de référence. */
export function fenetreVue(
  vue: VuePlanning,
  reference: Date,
): { debut: Date; fin: Date } {
  switch (vue) {
    case "jour":
      return { debut: debutJour(reference), fin: finJour(reference) };
    case "semaine": {
      const debut = debutSemaine(reference);
      return { debut, fin: finSemaine(debut) };
    }
    case "mois": {
      const grille = joursGrilleMois(reference);
      return { debut: grille[0], fin: finJour(grille[grille.length - 1]) };
    }
    case "annee":
      return { debut: debutAnnee(reference), fin: finAnnee(reference) };
  }
}

/**
 * Décale la date de référence d'une vue de `delta` unités (jour/semaine/
 * mois/année selon la vue active). La référence est reconstruite à midi
 * Paris (pas minuit) pour rester marge de sécurité loin des bascules DST
 * qui ont lieu entre 1h et 3h du matin.
 */
export function decalerReference(
  vue: VuePlanning,
  reference: Date,
  delta: number,
): Date {
  const civil = composantsFuseau(reference);
  switch (vue) {
    case "jour": {
      const c = ajouterJoursCivils(civil.annee, civil.mois, civil.jour, delta);
      return dateDepuisComposantsCivils(c.annee, c.mois, c.jour, 12, 0, 0, 0);
    }
    case "semaine": {
      const c = ajouterJoursCivils(civil.annee, civil.mois, civil.jour, delta * 7);
      return dateDepuisComposantsCivils(c.annee, c.mois, c.jour, 12, 0, 0, 0);
    }
    case "mois": {
      const moisTotal = civil.mois - 1 + delta;
      const annee = civil.annee + Math.floor(moisTotal / 12);
      const mois = ((moisTotal % 12) + 12) % 12;
      return dateDepuisComposantsCivils(annee, mois + 1, 1, 12, 0, 0, 0);
    }
    case "annee":
      return dateDepuisComposantsCivils(civil.annee + delta, civil.mois, 1, 12, 0, 0, 0);
  }
}

export function formaterEnteteJour(date: Date): string {
  const civil = jourCivil(date);
  const dim0 = jourSemaineDim0(civil.annee, civil.mois, civil.jour);
  return `${JOURS_ABBREGES[dim0]} ${civil.jour}`;
}

/** Format long d'un jour ("Vendredi 10 juillet"), sans année. */
export function formaterJourLong(date: Date): string {
  const civil = jourCivil(date);
  const dim0 = jourSemaineDim0(civil.annee, civil.mois, civil.jour);
  return `${JOURS_LONGS[dim0]} ${civil.jour} ${MOIS[civil.mois - 1]}`;
}

/** Format long d'un jour avec année ("Vendredi 10 juillet 2026"), pour la vue jour. */
export function formaterJourComplet(date: Date): string {
  const civil = jourCivil(date);
  return `${formaterJourLong(date)} ${civil.annee}`;
}

export function formaterPlageSemaine(debut: Date, fin: Date): string {
  const cd = jourCivil(debut);
  const cf = jourCivil(fin);
  if (cd.mois === cf.mois) {
    return `Semaine du ${cd.jour} au ${cf.jour} ${MOIS[cf.mois - 1]}`;
  }
  return `Semaine du ${cd.jour} ${MOIS[cd.mois - 1]} au ${cf.jour} ${MOIS[cf.mois - 1]}`;
}

/** "Juillet" - nom de mois seul, capitalisé (titres de mini-mois, vue année). */
export function formaterNomMois(date: Date): string {
  const civil = jourCivil(date);
  const nom = MOIS[civil.mois - 1];
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}

/** "Juillet 2026" - libellé de la vue mois. */
export function formaterMoisAnnee(date: Date): string {
  const civil = jourCivil(date);
  return `${formaterNomMois(date)} ${civil.annee}`;
}

/** "2026" - libellé de la vue année. */
export function formaterAnnee(date: Date): string {
  return String(jourCivil(date).annee);
}

/** Heure "HH:mm" d'un instant ISO, dans le fuseau `Europe/Paris`. */
export function formaterHeure(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU_APP,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Formate l'intervalle horaire d'un événement pour l'affichage (carte,
 * détail) :
 * - même jour civil, fin >= début : "HH:mm – HH:mm"
 * - jours différents, fin >= début (multi-jours) : "HH:mm → JJ mmm HH:mm"
 * - cas dégénéré fin < début (donnée incohérente) : juste "HH:mm" de début,
 *   sans tiret ni flèche
 */
export function formaterPlageHoraire(debut: string, fin: string): string {
  const dateDebut = new Date(debut);
  const dateFin = new Date(fin);
  const heureDebut = formaterHeure(debut);

  if (dateFin.getTime() < dateDebut.getTime()) {
    return heureDebut;
  }

  if (memeJour(dateDebut, dateFin)) {
    return `${heureDebut} – ${formaterHeure(fin)}`;
  }

  const civilFin = jourCivil(dateFin);
  return `${heureDebut} → ${civilFin.jour} ${MOIS_ABREGES[civilFin.mois - 1]} ${formaterHeure(fin)}`;
}

/** Convertit une date ISO API en valeur locale (Paris) pour un `datetime-local`. */
export function versDatetimeLocal(iso: string): string {
  const civil = composantsFuseau(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${civil.annee}-${pad(civil.mois)}-${pad(civil.jour)}T${pad(civil.heure)}:${pad(civil.minute)}`;
}

/** Convertit la valeur d'un `datetime-local` (saisie en heure Paris) en ISO pour l'API. */
export function versIso(valeurLocale: string): string {
  const [datePart, heurePart] = valeurLocale.split("T");
  const [annee, mois, jour] = datePart.split("-").map(Number);
  const [heure, minute] = (heurePart ?? "00:00").split(":").map(Number);
  return dateDepuisComposantsCivils(annee, mois, jour, heure, minute, 0, 0).toISOString();
}
