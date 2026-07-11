import Link from "next/link";
import type { Note } from "@/components/cockpit/types";

/**
 * Bloc « Notes » du cockpit (transposition fidèle de la variante V0 « Liste
 * épinglée » du mockup dashboard) : lecture seule, toutes les notes reçues
 * sont épinglées par construction (`GET /api/cockpit`). L'ajout/l'édition
 * complète vivent sur `/notes` (FRONT-2).
 */
export function NotesEpinglees({ notes }: { notes: Note[] }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
          Notes
        </h2>
        <Link href="/notes" className="font-body text-sm text-accent">
          Tout voir →
        </Link>
      </div>
      <div className="divide-y divide-ink/5 rounded-card bg-card shadow-card">
        {notes.length === 0 ? (
          <p className="px-5 py-6 text-center font-body text-sm text-ink/50">
            Aucune note épinglée.
          </p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="flex items-center gap-4 px-5 py-3">
              <span className="flex-1 truncate font-body text-sm text-ink">
                {note.titre}
              </span>
              <span className="font-mono text-[10px] tracking-[.04em] text-accent uppercase">
                Épinglée
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
