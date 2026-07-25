"use client";

import { Settings } from "lucide-react";

interface SectionSettingsButtonProps {
  onClick: () => void;
  libelle: string;
}

/**
 * Roue crantée du bandeau de section (Planning, Tâches, Notes) : remplace
 * l'ancien lien texte « Gérer les catégories ». Le libellé complet reste
 * accessible via `aria-label` et l'infobulle native.
 *
 * `stopPropagation` est INDISPENSABLE : les dialogs de catégories sont des
 * `Dialog` Base UI pilotés par `open`/`onOpenChange`, sans `DialogTrigger`.
 * Sans lui, le clic continue de remonter jusqu'au document APRÈS l'ouverture,
 * où le dialog fraîchement monté l'interprète comme un clic à l'extérieur et
 * se referme aussitôt (l'ancien lien texte était cassé pour cette raison).
 */
export function SectionSettingsButton({
  onClick,
  libelle,
}: SectionSettingsButtonProps) {
  return (
    <button
      type="button"
      onClick={(evenement) => {
        evenement.stopPropagation();
        onClick();
      }}
      aria-label={libelle}
      title={libelle}
      className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
    >
      <Settings className="h-4 w-4" />
    </button>
  );
}
