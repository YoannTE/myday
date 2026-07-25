import { NoteItem } from "@/components/notes/note-item";
import type { NoteApi } from "@/components/notes/types";

interface NotesListeProps {
  notes: NoteApi[];
  noteSelectionneeId: string | null;
  onSelect: (id: string) => void;
  /** Vraie quand une recherche filtre la liste : masque les flèches (le déplacement porte sur la liste complète). */
  rechercheActive: boolean;
  /** Remplace la liste complète après un déplacement (`POST /api/notes/{id}/deplacer`). */
  onReordonnee: (notes: NoteApi[]) => void;
}

export function NotesListe({
  notes,
  noteSelectionneeId,
  onSelect,
  rechercheActive,
  onReordonnee,
}: NotesListeProps) {
  return (
    <div className="fade-in delay-1 min-w-0 self-start divide-y divide-ink/5 rounded-card bg-card shadow-card">
      {notes.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink/50">
          Aucune note pour le moment.
        </p>
      ) : (
        notes.map((note, index) => (
          <NoteItem
            key={note.id}
            note={note}
            selectionnee={note.id === noteSelectionneeId}
            onSelect={() => onSelect(note.id)}
            onReordonnee={rechercheActive ? undefined : onReordonnee}
            peutMonter={index > 0}
            peutDescendre={index < notes.length - 1}
          />
        ))
      )}
    </div>
  );
}
