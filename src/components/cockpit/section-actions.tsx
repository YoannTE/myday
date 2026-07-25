"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ZonesSection {
  /** Juste à droite du libellé : bouton rond « + ». */
  titre: HTMLElement | null;
  /** À l'extrémité droite, avant les flèches : roue crantée. */
  actions: HTMLElement | null;
}

const ZonesContext = createContext<ZonesSection>({
  titre: null,
  actions: null,
});

export const ZonesSectionProvider = ZonesContext.Provider;

/**
 * Projette ses enfants dans le bandeau de titre de la section du cockpit.
 * Permet à chaque section de garder son état local (dialogs, rafraîchissements)
 * tout en affichant ses boutons dans l'en-tête commune. Ne rend rien tant que
 * le bandeau n'est pas monté, ou en dehors d'une `CockpitSection`.
 */
export function CockpitSectionActions({
  children,
  emplacement = "actions",
}: {
  children: ReactNode;
  emplacement?: keyof ZonesSection;
}) {
  const zones = useContext(ZonesContext);
  const zone = zones[emplacement];
  if (!zone) return null;
  return createPortal(children, zone);
}
