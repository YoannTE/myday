"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ZoneActionsContext = createContext<HTMLElement | null>(null);

export const ZoneActionsProvider = ZoneActionsContext.Provider;

/**
 * Projette ses enfants dans le bandeau de titre de la section du cockpit,
 * à droite du libellé (roue crantée « Gérer les catégories », bouton rond
 * « + » de création). Permet à chaque section de garder son état local tout
 * en affichant ses boutons dans l'en-tête commune. Ne rend rien tant que le
 * bandeau n'est pas monté, ou en dehors d'une `CockpitSection`.
 */
export function CockpitSectionActions({ children }: { children: ReactNode }) {
  const zone = useContext(ZoneActionsContext);
  if (!zone) return null;
  return createPortal(children, zone);
}
