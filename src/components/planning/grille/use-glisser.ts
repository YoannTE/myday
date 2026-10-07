"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  instantDepuisMinutesAbsolues,
  minutesAbsolues,
} from "@/components/planning/date-utils";
import type { ElementPlanning } from "@/components/planning/grille/disposition";

export type ModeGlisser = "deplacer" | "duree";

/** Aperçu affiché pendant le glissement (positions en minutes absolues). */
export interface Glissement {
  element: ElementPlanning;
  mode: ModeGlisser;
  debutAbs: number;
  finAbs: number;
  x: number;
  y: number;
}

interface OptionsGlisser {
  /** Écart minimal entre deux positions : 15 min (grille) ou 1440 (vue mois). */
  pas: number;
  positionDepuisPointeur: (x: number, y: number) => number | null;
  onDeposer: (element: ElementPlanning, debut: Date, fin: Date) => void;
  zoneDefilement?: () => HTMLElement | null;
  /** Vue jour : rester au bord gauche/droit change de jour (comme sur iPhone). */
  onBord?: (delta: -1 | 1) => void;
}

const DELAI_APPUI_LONG = 450;
const SEUIL_SOURIS = 4;
const SEUIL_DOIGT = 8;
const MARGE_DEFILEMENT = 44;
const MARGE_BORD = 28;
const DELAI_BORD = 600;
const REPETITION_BORD = 1000;
const DUREE_MIN = 15;

interface EtatInterne {
  element: ElementPlanning;
  mode: ModeGlisser;
  pointeur: number;
  doigt: boolean;
  departX: number;
  departY: number;
  x: number;
  y: number;
  origine: number;
  debutAbs: number;
  finAbs: number;
  actif: boolean;
  minuteur: number | null;
  bordDepuis: number | null;
  derniere: Glissement | null;
}

/** À chaque image : défilement automatique près du haut/bas de la grille, et
 * changement de jour quand le doigt reste au bord gauche/droit (vue jour). */
function defilerEtBord(etat: EtatInterne, options: OptionsGlisser) {
  const zone = options.zoneDefilement?.();
  if (!zone) return;
  const rect = zone.getBoundingClientRect();
  if (etat.y < rect.top + MARGE_DEFILEMENT) zone.scrollTop -= 8;
  else if (etat.y > rect.bottom - MARGE_DEFILEMENT) zone.scrollTop += 8;
  const auBord = etat.x < rect.left + MARGE_BORD ? -1 : etat.x > rect.right - MARGE_BORD ? 1 : 0;
  if (!options.onBord || auBord === 0 || etat.mode !== "deplacer") {
    etat.bordDepuis = null;
    return;
  }
  const maintenant = performance.now();
  etat.bordDepuis ??= maintenant;
  if (maintenant - etat.bordDepuis > DELAI_BORD) {
    options.onBord(auBord);
    // Jour suivant après 0,6 s au bord, puis un jour de plus chaque seconde.
    etat.bordDepuis = maintenant - DELAI_BORD + REPETITION_BORD;
  }
}

/**
 * Glisser-déposer du planning, à la souris (dès 4 px de mouvement) ou au
 * doigt (appui long d'une demi-seconde, puis petite vibration). Un doigt qui
 * bouge AVANT la fin de l'appui long fait défiler la page normalement.
 * Écouteurs posés sur `window` : le glissement continue même si la vue
 * change de jour sous le doigt.
 */
export function useGlisser(options: OptionsGlisser) {
  const optionsRef = useRef(options);
  const etatRef = useRef<EtatInterne | null>(null);
  const vientDeGlisserRef = useRef(false);
  const [glissement, setGlissement] = useState<Glissement | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  });

  const calculer = useCallback((etat: EtatInterne): Glissement => {
    const { pas, positionDepuisPointeur } = optionsRef.current;
    const position = positionDepuisPointeur(etat.x, etat.y);
    if (position === null && etat.derniere) return { ...etat.derniere, x: etat.x, y: etat.y };
    const ecart = Math.round(((position ?? etat.origine) - etat.origine) / pas) * pas;
    const debutAbs = etat.mode === "deplacer" ? etat.debutAbs + ecart : etat.debutAbs;
    const finAbs = etat.mode === "deplacer"
      ? etat.finAbs + ecart
      : Math.max(etat.finAbs + ecart, etat.debutAbs + DUREE_MIN);
    return { element: etat.element, mode: etat.mode, debutAbs, finAbs, x: etat.x, y: etat.y };
  }, []);

  const rafraichir = useCallback(() => {
    const etat = etatRef.current;
    if (!etat?.actif) return;
    etat.derniere = calculer(etat);
    setGlissement(etat.derniere);
  }, [calculer]);

  const activer = useCallback(() => {
    const etat = etatRef.current;
    if (!etat || etat.actif) return;
    etat.actif = true;
    if (etat.doigt) navigator.vibrate?.(12);
    rafraichir();
    const tour = () => {
      const enCours = etatRef.current;
      if (!enCours?.actif) return;
      defilerEtBord(enCours, optionsRef.current);
      rafraichir();
      requestAnimationFrame(tour);
    };
    requestAnimationFrame(tour);
  }, [rafraichir]);

  const terminer = useCallback((deposer: boolean) => {
    const etat = etatRef.current;
    if (!etat) return;
    if (etat.minuteur !== null) window.clearTimeout(etat.minuteur);
    etatRef.current = null;
    setGlissement(null);
    if (!etat.actif) return;
    vientDeGlisserRef.current = true;
    window.setTimeout(() => (vientDeGlisserRef.current = false), 80);
    const final = etat.derniere;
    if (!deposer || !final) return;
    if (final.debutAbs === etat.debutAbs && final.finAbs === etat.finAbs) return;
    optionsRef.current.onDeposer(
      etat.element,
      instantDepuisMinutesAbsolues(final.debutAbs),
      instantDepuisMinutesAbsolues(final.finAbs),
    );
  }, []);

  useEffect(() => {
    function surMouvement(evenement: PointerEvent) {
      const etat = etatRef.current;
      if (!etat || evenement.pointerId !== etat.pointeur) return;
      etat.x = evenement.clientX;
      etat.y = evenement.clientY;
      const distance = Math.hypot(etat.x - etat.departX, etat.y - etat.departY);
      if (!etat.actif) {
        if (etat.doigt && distance > SEUIL_DOIGT) terminer(false);
        else if (!etat.doigt && distance > SEUIL_SOURIS) activer();
        return;
      }
      rafraichir();
    }
    function surFin(evenement: PointerEvent) {
      if (etatRef.current?.pointeur === evenement.pointerId) {
        terminer(evenement.type === "pointerup");
      }
    }
    function bloquerDefilement(evenement: TouchEvent) {
      if (etatRef.current?.actif) evenement.preventDefault();
    }
    function bloquerMenu(evenement: Event) {
      if (etatRef.current) evenement.preventDefault();
    }
    window.addEventListener("pointermove", surMouvement);
    window.addEventListener("pointerup", surFin);
    window.addEventListener("pointercancel", surFin);
    window.addEventListener("touchmove", bloquerDefilement, { passive: false });
    window.addEventListener("contextmenu", bloquerMenu);
    return () => {
      window.removeEventListener("pointermove", surMouvement);
      window.removeEventListener("pointerup", surFin);
      window.removeEventListener("pointercancel", surFin);
      window.removeEventListener("touchmove", bloquerDefilement);
      window.removeEventListener("contextmenu", bloquerMenu);
    };
  }, [activer, rafraichir, terminer]);

  const demarrer = useCallback(
    (element: ElementPlanning, mode: ModeGlisser) => (evenement: React.PointerEvent) => {
      if (evenement.pointerType === "mouse" && evenement.button !== 0) return;
      evenement.stopPropagation();
      const origine = optionsRef.current.positionDepuisPointeur(evenement.clientX, evenement.clientY);
      if (origine === null || etatRef.current) return;
      const doigt = evenement.pointerType !== "mouse";
      etatRef.current = {
        element, mode, doigt, origine,
        pointeur: evenement.pointerId,
        departX: evenement.clientX, departY: evenement.clientY,
        x: evenement.clientX, y: evenement.clientY,
        debutAbs: minutesAbsolues(new Date(element.debut)),
        finAbs: minutesAbsolues(new Date(element.fin)),
        actif: false, bordDepuis: null, derniere: null,
        minuteur: doigt ? window.setTimeout(activer, DELAI_APPUI_LONG) : null,
      };
    },
    [activer],
  );

  /** Vrai juste après un glissement : le clic qui suit ne doit rien ouvrir. */
  const vientDeGlisser = useCallback(() => vientDeGlisserRef.current, []);

  return { glissement, demarrer, vientDeGlisser };
}
