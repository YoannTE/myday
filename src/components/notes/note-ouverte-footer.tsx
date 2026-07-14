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
}: NoteOuverteFooterProps) {
  return (
    <div className="ml-auto flex items-center gap-3">
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
    </div>
  );
}
