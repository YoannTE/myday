// Calculs et formatage du budget — fonctions pures, sans état ni accès réseau.
//
// Toute la page raisonne sur un « mois courant » identifié par une clé
// `AAAA-MM`. Les trois sources se combinent ainsi pour un mois donné :
//
//   récurrents actifs  → présents dans TOUS les mois
//   opérations         → celles dont la date tombe dans le mois
//   prévisions datées  → celles dont l'échéance vaut ce mois, si non réalisées
//
// Distinction importante portée ici : le « reste à vivre » n'inclut PAS les
// prévisions. Une commission de 15 000 € ne doit pas donner l'impression qu'il
// reste 15 000 € à dépenser ce mois-là ; l'exceptionnel est affiché à part et
// n'entre que dans la projection de solde.

import type { Compte, Operation, Prevision, Recurrent, Sens } from "./types";

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

const JOURS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

const ENTIER = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** « 1 700 € », « 42,50 € » — les centimes ne s'affichent que s'il y en a. */
export function euros(montant: number): string {
  const arrondi = Math.round(montant * 100) / 100;
  const texte = Number.isInteger(arrondi)
    ? ENTIER.format(arrondi)
    : DECIMAL.format(arrondi);
  return `${texte} €`;
}

/** Même chose, préfixé du signe (− typographique, pas un tiret ASCII). */
export function eurosSignes(montant: number): string {
  const signe = montant > 0 ? "+" : montant < 0 ? "−" : "";
  return signe + euros(Math.abs(montant));
}

export function cleMois(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function moisCourant(): string {
  return cleMois(new Date());
}

/** « août 2026 » */
export function libelleMois(cle: string): string {
  const [annee, mois] = cle.split("-");
  return `${MOIS[Number(mois) - 1]} ${annee}`;
}

/** « d'août 2026 » / « de novembre 2026 » — l'élision compte, en français. */
export function deMois(cle: string): string {
  const nom = MOIS[Number(cle.split("-")[1]) - 1];
  return (/^[aeiouâéêîô]/.test(nom) ? "d'" : "de ") + libelleMois(cle);
}

/** « août 26 » — pour les axes de graphique, où la place manque. */
export function moisCourt(cle: string): string {
  const [annee, mois] = cle.split("-");
  return `${MOIS[Number(mois) - 1].slice(0, 4)} ${annee.slice(2)}`;
}

export function decalerMois(cle: string, pas: number): string {
  const [annee, mois] = cle.split("-").map(Number);
  return cleMois(new Date(annee, mois - 1 + pas, 1));
}

/** `AAAA-MM-JJ` du jour, en heure locale (pas d'ISO UTC : un ajout tard le
 *  soir ne doit pas basculer au lendemain). */
export function aujourdhuiISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** « vendredi 14 août » */
export function libelleJour(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/** « 14 août » */
export function jourCourt(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${MOIS[d.getMonth()].slice(0, 4)}`;
}

const signe = (sens: Sens) => (sens === "entree" ? 1 : -1);

export interface MoisCalcule {
  cle: string;
  /** Récurrent + ponctuel, hors exceptionnel. */
  entreesOrdinaires: number;
  sortiesOrdinaires: number;
  resteAVivre: number;
  recurrentEntrees: number;
  recurrentSorties: number;
  ponctuelEntrees: number;
  ponctuelSorties: number;
  /** Solde des prévisions échéant ce mois (commissions, gros achats). */
  exceptionnel: number;
  /** Ordinaire + exceptionnel : le vrai mouvement du mois. */
  mouvement: number;
  operations: Operation[];
  previsions: Prevision[];
}

export interface SourcesBudget {
  recurrents: Recurrent[];
  operations: Operation[];
  previsions: Prevision[];
}

export function calculerMois(cle: string, sources: SourcesBudget): MoisCalcule {
  const actifs = sources.recurrents.filter((r) => r.actif);
  const somme = (liste: { montant: number }[]) =>
    liste.reduce((total, ligne) => total + ligne.montant, 0);

  const recurrentEntrees = somme(actifs.filter((r) => r.sens === "entree"));
  const recurrentSorties = somme(actifs.filter((r) => r.sens === "sortie"));

  const operations = sources.operations.filter((o) =>
    o.date_operation.startsWith(cle),
  );
  const ponctuelEntrees = somme(operations.filter((o) => o.sens === "entree"));
  const ponctuelSorties = somme(operations.filter((o) => o.sens === "sortie"));

  // Une prévision déjà réalisée est sortie des calculs : elle a normalement
  // été ressaisie en opération, la compter deux fois fausserait tout.
  const previsions = sources.previsions.filter(
    (p) => p.echeance === cle && !p.fait,
  );
  const exceptionnel = previsions.reduce(
    (total, p) => total + signe(p.sens) * p.montant,
    0,
  );

  const entreesOrdinaires = recurrentEntrees + ponctuelEntrees;
  const sortiesOrdinaires = recurrentSorties + ponctuelSorties;

  return {
    cle,
    entreesOrdinaires,
    sortiesOrdinaires,
    resteAVivre: entreesOrdinaires - sortiesOrdinaires,
    recurrentEntrees,
    recurrentSorties,
    ponctuelEntrees,
    ponctuelSorties,
    exceptionnel,
    mouvement: entreesOrdinaires - sortiesOrdinaires + exceptionnel,
    operations,
    previsions,
  };
}

export function totalComptes(comptes: Compte[]): number {
  return comptes.reduce((total, compte) => total + compte.montant, 0);
}

export interface PointProjection {
  cle: string;
  solde: number;
  mouvement: number;
  entrees: number;
  sorties: number;
}

/**
 * Solde cumulé mois après mois à partir du capital détenu aujourd'hui.
 * Contrairement au reste à vivre, la projection intègre l'exceptionnel : c'est
 * précisément ce qu'on veut voir venir.
 */
export function projeter(
  depart: string,
  nbMois: number,
  sources: SourcesBudget,
  comptes: Compte[],
): PointProjection[] {
  let solde = totalComptes(comptes);
  const points: PointProjection[] = [];
  for (let index = 0; index < nbMois; index += 1) {
    const cle = decalerMois(depart, index);
    const mois = calculerMois(cle, sources);
    solde += mois.mouvement;
    points.push({
      cle,
      solde,
      mouvement: mois.mouvement,
      entrees: mois.entreesOrdinaires + Math.max(0, mois.exceptionnel),
      sorties: mois.sortiesOrdinaires + Math.max(0, -mois.exceptionnel),
    });
  }
  return points;
}

export interface PostePondere {
  categorie: string;
  montant: number;
}

/** Dépenses du mois agrégées par poste, du plus lourd au plus léger. */
export function parCategorie(
  cle: string,
  sources: SourcesBudget,
): PostePondere[] {
  const total = new Map<string, number>();
  const ajouter = (categorie: string, montant: number) =>
    total.set(categorie, (total.get(categorie) ?? 0) + montant);

  sources.recurrents
    .filter((r) => r.actif && r.sens === "sortie")
    .forEach((r) => ajouter(r.categorie, r.montant));
  sources.operations
    .filter((o) => o.sens === "sortie" && o.date_operation.startsWith(cle))
    .forEach((o) => ajouter(o.categorie, o.montant));
  sources.previsions
    .filter((p) => p.sens === "sortie" && p.echeance === cle && !p.fait)
    .forEach((p) => ajouter(p.categorie, p.montant));

  return [...total.entries()]
    .map(([categorie, montant]) => ({ categorie, montant }))
    .sort((a, b) => b.montant - a.montant);
}
