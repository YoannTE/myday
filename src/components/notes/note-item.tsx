"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { cn } from "@/lib/utils";
import { formaterFraicheur } from "@/lib/freshness";
import { NoteCategoryBadge } from "@/components/notes/note-category-badge";
import { PartageBadge } from "@/components/partage/partage-badge";
import type { NoteApi } from "@/components/notes/types";

interface NoteItemProps {
  note: NoteApi;
  selectionnee: boolean;
  onSelect: () => void;
  /** Remplace la liste complète après un déplacement (`POST /api/notes/{id}/deplacer`). Absent = flèches masquées (ex. recherche active). */
  onReordonnee?: (notes: NoteApi[]) => void;
  /** Fausse quand la note est déjà première de la liste complète. */
  peutMonter?: boolean;
  /** Fausse quand la note est déjà dernière de la liste complète. */
  peutDescendre?: boolean;
}

// Ligne de la liste des notes. Badge « via l'assistant » autorisé ici
// (note.origine existe, contrairement aux events - correction #7). Round 017 :
// flèches de réordonnancement manuel (remplace l'épinglage retiré), masquées
// quand la liste est filtrée par une recherche (le déplacement porte sur la
// liste complète, pas sur un sous-ensemble filtré).
export function NoteItem({
  note,
  selectionnee,
  onSelect,
  onReordonnee,
  peutMonter,
  peutDescendre,
}: NoteItemProps) {
  const [enCours, setEnCours] = useState(false);
  const extrait = note.contenu?.trim().split("\n").find(Boolean) ?? "";
  const nombreCoches = note.items.filter((item) => item.coche).length;
  const afficherFleches = Boolean(onReordonnee);

  async function deplacer(direction: "haut" | "bas") {
    if (enCours || !onReordonnee) return;
    setEnCours(true);
    try {
      const reponse = await apiCall<{ data: NoteApi[] }>(
        `/api/notes/${note.id}/deplacer`,
        { method: "POST", body: { direction } },
      );
      onReordonnee(reponse.data);
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible de déplacer la note."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1 transition-colors",
        selectionnee ? "bg-soft/60" : "hover:bg-soft/30",
        note.archivee && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xs font-semibold text-ink md:text-sm">
            {note.titre}
          </p>
          {extrait && (
            <p className="truncate font-body text-xs text-ink/50">{extrait}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {note.categorie && <NoteCategoryBadge categorie={note.categorie} />}
            {note.partage_par != null && (
              <PartageBadge nom={note.partage_par} />
            )}
            {note.items.length > 0 && (
              <span className="font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
                ☑ {nombreCoches}/{note.items.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          {note.archivee ? (
            <span className="font-mono text-xs tracking-[.04em] text-ink/30 uppercase md:text-sm">
              Archivée
            </span>
          ) : (
            <span className="font-mono text-xs tracking-[.04em] text-ink/30 uppercase md:text-sm">
              {formaterFraicheur(note.updated_at)}
            </span>
          )}
          {note.origine === "assistant" && (
            <span className="font-mono text-[10px] tracking-[.04em] text-accent uppercase">
              via l&apos;assistant
            </span>
          )}
        </div>
      </button>
      {afficherFleches && (
        <div className="flex flex-shrink-0 flex-col pr-3">
          <button
            type="button"
            aria-label="Monter la note"
            disabled={enCours || !peutMonter}
            onClick={() => deplacer("haut")}
            className="flex h-4 w-4 items-center justify-center text-ink/30 transition-colors hover:text-accent disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Descendre la note"
            disabled={enCours || !peutDescendre}
            onClick={() => deplacer("bas")}
            className="flex h-4 w-4 items-center justify-center text-ink/30 transition-colors hover:text-accent disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
