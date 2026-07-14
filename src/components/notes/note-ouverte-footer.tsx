"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NoteApi } from "@/components/notes/types";

interface NoteOuverteFooterProps {
  note: NoteApi;
  estPartagee: boolean;
  modifie: boolean;
  enregistrement: boolean;
  enCours: boolean;
  onSauvegarder: () => void;
  onBasculerArchivee: () => void;
  onSupprimer: () => void;
}

/**
 * Pied de la note ouverte (date de création + Enregistrer/Archiver) -
 * extrait de `NoteOuverte` pour garder le parent sous ~150 lignes.
 * « Enregistrer » reste actif pour une note partagée reçue (le contenu est
 * modifiable) ; « Archiver » reste réservé au propriétaire de la note.
 */
export function NoteOuverteFooter({
  note,
  estPartagee,
  modifie,
  enregistrement,
  enCours,
  onSauvegarder,
  onBasculerArchivee,
  onSupprimer,
}: NoteOuverteFooterProps) {
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);

  return (
    <div className="ml-auto flex flex-wrap items-center gap-3">
      {modifie && (
        <Button
          type="button"
          size="sm"
          disabled={enregistrement}
          onClick={onSauvegarder}
        >
          {enregistrement ? "Enregistrement..." : "Enregistrer"}
        </Button>
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
