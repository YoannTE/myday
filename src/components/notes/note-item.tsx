"use client";

import { formaterFraicheur } from "@/lib/freshness";
import type { NoteApi } from "@/components/notes/types";

interface NoteItemProps {
  note: NoteApi;
  selectionnee: boolean;
  onSelect: () => void;
}

// Ligne de la liste des notes. Badge « via l'assistant » autorisé ici
// (note.origine existe, contrairement aux events - correction #7).
export function NoteItem({ note, selectionnee, onSelect }: NoteItemProps) {
  const extrait = note.contenu?.trim().split("\n").find(Boolean) ?? "";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        selectionnee ? "bg-soft/60" : "hover:bg-soft/30"
      } ${note.archivee ? "opacity-50" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold text-ink">
          {note.titre}
        </p>
        {extrait && (
          <p className="truncate font-body text-xs text-ink/50">{extrait}</p>
        )}
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        {note.archivee ? (
          <span className="font-mono text-[9px] tracking-[.04em] text-ink/30 uppercase">
            Archivée
          </span>
        ) : note.epinglee ? (
          <span className="rounded-full bg-soft px-1.5 py-0.5 font-mono text-[9px] tracking-[.04em] text-accent uppercase">
            Épinglée
          </span>
        ) : (
          <span className="font-mono text-[9px] tracking-[.04em] text-ink/30 uppercase">
            {formaterFraicheur(note.updated_at)}
          </span>
        )}
        {note.origine === "assistant" && (
          <span className="font-mono text-[9px] tracking-[.04em] text-accent uppercase">
            via l&apos;assistant
          </span>
        )}
      </div>
    </button>
  );
}
