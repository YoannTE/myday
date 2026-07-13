import { Share2 } from "lucide-react";
import { formaterFraicheur } from "@/lib/freshness";
import { PartageBadge } from "@/components/partage/partage-badge";
import type { NoteApi } from "@/components/notes/types";

interface NoteOuverteHeaderProps {
  note: NoteApi;
  estPartagee: boolean;
  enCours: boolean;
  onBasculerEpinglee: () => void;
  onOuvrirPartage: () => void;
}

/**
 * En-tête de la note ouverte (titre + badges + actions rapides) - extrait de
 * `NoteOuverte` pour garder le parent sous ~150 lignes. Épingler et
 * « Partager » sont masqués pour une note partagée reçue (lecture seule) ;
 * `PartageBadge` prend leur place.
 */
export function NoteOuverteHeader({
  note,
  estPartagee,
  enCours,
  onBasculerEpinglee,
  onOuvrirPartage,
}: NoteOuverteHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h2 className="min-w-0 flex-1 font-display text-lg font-extrabold tracking-[-0.02em] break-words text-ink">
        {note.titre}
      </h2>
      {note.origine === "assistant" && (
        <span className="rounded-full bg-soft px-2 py-0.5 font-mono text-[9px] tracking-[.04em] text-accent uppercase">
          via l&apos;assistant
        </span>
      )}
      <span className="rounded-full bg-soft px-2 py-0.5 font-mono text-[9px] tracking-[.04em] text-ink/40 uppercase">
        Modifiée {formaterFraicheur(note.updated_at)}
      </span>
      {estPartagee ? (
        <PartageBadge nom={note.partage_par as string} />
      ) : (
        <>
          <button
            type="button"
            onClick={onOuvrirPartage}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 font-body text-xs text-ink/50 transition-colors hover:bg-soft hover:text-ink"
          >
            <Share2 className="h-3.5 w-3.5" />
            Partager
          </button>
          <button
            type="button"
            onClick={onBasculerEpinglee}
            disabled={enCours}
            title={note.epinglee ? "Désépingler" : "Épingler"}
            className={`flex h-8 w-8 items-center justify-center rounded-inner text-sm ${
              note.epinglee ? "bg-accent text-white" : "bg-soft text-ink/50"
            }`}
          >
            📌
          </button>
        </>
      )}
    </div>
  );
}
