import { NoteItem } from "@/components/notes/note-item";
import type { NoteApi } from "@/components/notes/types";

interface NotesListeProps {
  notes: NoteApi[];
  noteSelectionneeId: string | null;
  onSelect: (id: string) => void;
}

export function NotesListe({
  notes,
  noteSelectionneeId,
  onSelect,
}: NotesListeProps) {
  return (
    <div className="fade-in delay-1 min-w-0 self-start divide-y divide-ink/5 rounded-card bg-card shadow-card">
      {notes.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink/50">
          Aucune note pour le moment.
        </p>
      ) : (
        notes.map((note) => (
          <NoteItem
            key={note.id}
            note={note}
            selectionnee={note.id === noteSelectionneeId}
            onSelect={() => onSelect(note.id)}
          />
        ))
      )}
    </div>
  );
}
