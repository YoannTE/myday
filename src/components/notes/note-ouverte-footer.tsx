import { Button } from "@/components/ui/button";
import type { NoteApi } from "@/components/notes/types";

interface NoteOuverteFooterProps {
  note: NoteApi;
  modifie: boolean;
  enregistrement: boolean;
  enCours: boolean;
  onSauvegarder: () => void;
  onBasculerArchivee: () => void;
}

/**
 * Pied de la note ouverte (date de création + Enregistrer/Archiver) -
 * extrait de `NoteOuverte` pour garder le parent sous ~150 lignes. Masqué
 * pour une note partagée reçue (lecture seule) : géré par le parent qui
 * n'affiche ce composant que si la note n'est pas partagée.
 */
export function NoteOuverteFooter({
  note,
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
      <button
        type="button"
        onClick={onBasculerArchivee}
        disabled={enCours}
        className="font-body text-xs text-ink/40 hover:text-accent"
      >
        {note.archivee ? "Désarchiver" : "Archiver"}
      </button>
    </div>
  );
}
