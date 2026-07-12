import Link from "next/link";
import { Plus } from "lucide-react";
import { SectionAddButton } from "@/components/cockpit/section-add-button";
import { NoteQuickAddDialog } from "@/components/notes/note-quick-add-dialog";
import { NoteCategoryBadge } from "@/components/notes/note-category-badge";
import type { Note } from "@/components/cockpit/types";

function ignorerNoteCreee() {
  // Une note nouvellement créée n'est jamais épinglée par défaut (valeur
  // BDD `false`) : rien à ajouter à cette section qui n'affiche que les
  // notes épinglées. Le toast de confirmation est déjà géré par
  // `NoteQuickAddDialog` (F7, Round 014).
}

/**
 * Bloc « Notes » du cockpit (transposition fidèle de la variante V0 « Liste
 * épinglée » du mockup dashboard) : lecture seule pour la donnée elle-même
 * (toutes les notes reçues sont épinglées par construction, `GET
 * /api/cockpit`), mais chaque note est cliquable (F6, Round 014) et ouvre
 * son détail sur `/notes`. Bouton « + » (F7) : création rapide sans quitter
 * le cockpit. L'ajout/l'édition complète vivent sur `/notes` (FRONT-2).
 */
export function NotesEpinglees({ notes }: { notes: Note[] }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
            Notes
          </h2>
          <NoteQuickAddDialog
            onCreated={ignorerNoteCreee}
            trigger={<SectionAddButton aria-label="Ajouter une note" />}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </NoteQuickAddDialog>
        </div>
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
            <Link
              key={note.id}
              href={`/notes?note=${note.id}`}
              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-soft/30"
            >
              <span className="flex-1 truncate font-body text-sm text-ink">
                {note.titre}
              </span>
              {note.categorie && (
                <NoteCategoryBadge categorie={note.categorie} />
              )}
              <span className="font-mono text-[10px] tracking-[.04em] text-accent uppercase">
                Épinglée
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
