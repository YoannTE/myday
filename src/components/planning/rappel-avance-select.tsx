"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Délais de notification proposés avant un événement ou un créneau planifié.
 * Les valeurs (minutes) doivent rester alignées sur la contrainte CHECK
 * backend (-1, 0, 5, 30, 60). La valeur -1 signifie « aucune notification ».
 */
export const RAPPEL_AVANCE_OPTIONS: { valeur: number; libelle: string }[] = [
  { valeur: 60, libelle: "1 heure avant" },
  { valeur: 30, libelle: "30 minutes avant" },
  { valeur: 5, libelle: "5 minutes avant" },
  { valeur: 0, libelle: "Au moment même" },
  { valeur: -1, libelle: "Aucune" },
];

function libellePour(valeur: number): string {
  return (
    RAPPEL_AVANCE_OPTIONS.find((option) => option.valeur === valeur)?.libelle ??
    "30 minutes avant"
  );
}

interface RappelAvanceSelectProps {
  value: number;
  onValueChange: (valeur: number) => void;
  disabled?: boolean;
}

/** Sélecteur du délai de notification (partagé événements / tâches planifiées). */
export function RappelAvanceSelect({
  value,
  onValueChange,
  disabled,
}: RappelAvanceSelectProps) {
  return (
    <Select
      value={String(value)}
      disabled={disabled}
      onValueChange={(nouvelleValeur) => {
        if (!nouvelleValeur) return;
        onValueChange(Number(nouvelleValeur));
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          {(valeurSelectionnee) => libellePour(Number(valeurSelectionnee))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {RAPPEL_AVANCE_OPTIONS.map((option) => (
          <SelectItem key={option.valeur} value={String(option.valeur)}>
            {option.libelle}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
