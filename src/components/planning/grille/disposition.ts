import {
  MINUTES_PAR_JOUR,
  minutesAbsolues,
  numeroJourCivil,
} from "@/components/planning/date-utils";
import type { EvenementApi } from "@/components/planning/types";
import type { Task } from "@/components/taches/types";

/** Élément déplaçable de la grille : un rendez-vous ou une tâche planifiée. */
export type ElementPlanning =
  | { cle: string; type: "evenement"; titre: string; debut: string; fin: string; evenement: EvenementApi }
  | { cle: string; type: "tache"; titre: string; debut: string; fin: string; tache: Task };

/** Morceau d'un élément affiché dans UNE colonne-jour (un rendez-vous sur 2 jours = 2 segments). */
export interface Segment {
  cleRendu: string;
  element: ElementPlanning;
  colonne: number;
  debutMinutes: number;
  finMinutes: number;
  voie: number;
  voies: number;
}

// Durée minimale affichée : un rendez-vous de 0 ou 5 minutes reste cliquable.
const DUREE_AFFICHEE_MIN = 20;

export function elementsPlanning(evenements: EvenementApi[], taches: Task[]): ElementPlanning[] {
  return [
    ...evenements.map((evenement): ElementPlanning => ({
      cle: `evenement-${evenement.id}`,
      type: "evenement",
      titre: evenement.titre,
      debut: evenement.debut,
      fin: evenement.fin,
      evenement,
    })),
    ...taches
      .filter((tache) => tache.planifie_debut && tache.planifie_fin)
      .map((tache): ElementPlanning => ({
        cle: `tache-${tache.id}`,
        type: "tache",
        titre: tache.titre,
        debut: tache.planifie_debut as string,
        fin: tache.planifie_fin as string,
        tache,
      })),
  ];
}

/** Découpe un élément (ou un aperçu en cours de glissement) par colonne-jour. */
export function segmentsElement(
  element: ElementPlanning,
  jours: Date[],
  debutAbs = minutesAbsolues(new Date(element.debut)),
  finAbs = minutesAbsolues(new Date(element.fin)),
): Omit<Segment, "voie" | "voies">[] {
  const segments: Omit<Segment, "voie" | "voies">[] = [];
  jours.forEach((jour, colonne) => {
    const origineJour = numeroJourCivil(jour) * MINUTES_PAR_JOUR;
    const debut = Math.max(debutAbs, origineJour) - origineJour;
    const fin = Math.min(Math.max(finAbs, debutAbs), origineJour + MINUTES_PAR_JOUR) - origineJour;
    const commenceCeJour = debutAbs >= origineJour && debutAbs < origineJour + MINUTES_PAR_JOUR;
    if (fin > debut || commenceCeJour) {
      segments.push({
        cleRendu: `${element.cle}-${numeroJourCivil(jour)}`,
        element,
        colonne,
        debutMinutes: debut,
        finMinutes: Math.min(Math.max(fin, debut + DUREE_AFFICHEE_MIN), MINUTES_PAR_JOUR),
      });
    }
  });
  return segments;
}

/**
 * Place les segments côte à côte quand ils se chevauchent (comme le
 * calendrier Apple) : chaque groupe de segments qui se recouvrent partage la
 * largeur de la colonne en autant de « voies » que nécessaire.
 */
export function disposerSegments(elements: ElementPlanning[], jours: Date[]): Segment[] {
  const resultat: Segment[] = [];
  jours.forEach((_, colonne) => {
    const duJour = elements
      .flatMap((element) => segmentsElement(element, jours))
      .filter((segment) => segment.colonne === colonne)
      .sort((a, b) => a.debutMinutes - b.debutMinutes || b.finMinutes - a.finMinutes);

    let groupe: Segment[] = [];
    let finGroupe = -1;
    const fermerGroupe = () => {
      const voies = Math.max(1, ...groupe.map((segment) => segment.voie + 1));
      groupe.forEach((segment) => resultat.push({ ...segment, voies }));
      groupe = [];
    };

    for (const segment of duJour) {
      if (segment.debutMinutes >= finGroupe && groupe.length > 0) fermerGroupe();
      const finsParVoie: number[] = [];
      groupe.forEach((s) => {
        finsParVoie[s.voie] = Math.max(finsParVoie[s.voie] ?? 0, s.finMinutes);
      });
      let voie = finsParVoie.findIndex((fin) => fin <= segment.debutMinutes);
      if (voie === -1) voie = finsParVoie.length;
      groupe.push({ ...segment, voie, voies: 1 });
      finGroupe = Math.max(finGroupe, segment.finMinutes);
    }
    if (groupe.length > 0) fermerGroupe();
  });
  return resultat;
}
