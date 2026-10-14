"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EtatSauvegarde } from "@/components/notes/use-sauvegarde-auto";
import type { NoteApi } from "@/components/notes/types";

interface NoteOuverteFooterProps {
  note: NoteApi;
  estPartagee: boolean;
  etatSauvegarde: EtatSauvegarde;
  enCours: boolean;
  onReessayer: () => void;
  onBasculerArchivee: () => void;
  onSupprimer: () => void;
}

/**
 * Pied de la note ouverte (état de l'enregistrement automatique + Archiver) -
 * extrait de `NoteOuverte` pour garder le parent sous ~150 lignes.
 * « Archiver » reste réservé au propriétaire de la note.
 */
export function NoteOuverteFooter({
  note,
  estPartagee,
  etatSauvegarde,
  enCours,
  onReessayer,
  onBasculerArchivee,
  onSupprimer,
}: NoteOuverteFooterProps) {
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);

  return (
    <div className="ml-auto flex flex-wrap items-center gap-3">
      {etatSauvegarde === "erreur" ? (
        <span className="flex items-center gap-2 font-body text-xs text-destructive">
          Non enregistrée
          <Button type="button" size="xs" variant="outline" onClick={onReessayer}>
            Réessayer
          </Button>
        </span>
      ) : (
        <span aria-live="polite" className="font-mono text-[10px] tracking-[.04em] text-ink/35 uppercase">
          {etatSauvegarde === "enregistre" ? "Enregistrée" : "Enregistrement..."}
        </span>
      )}
      {!estPartagee && (
        <button
          type="button"
          onClick={onBasculerArchivee}
          disabled={enCours}
          className="font-body text-xs text-ink/40 hover:text-accent"
        >
          {note.archivee ? "Désarchiver" : "Archiver"}
        </button>
      )}
      {!estPartagee &&
        (confirmationSuppression ? (
          <span className="flex items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="xs"
              disabled={enCours}
              onClick={onSupprimer}
            >
              Oui, supprimer
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setConfirmationSuppression(false)}
            >
              Annuler
            </Button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmationSuppression(true)}
            disabled={enCours}
            aria-label="Supprimer la note"
            title="Supprimer la note"
            className="text-destructive/70 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ))}
    </div>
  );
}
