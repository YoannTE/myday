"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PartageBadge } from "@/components/partage/partage-badge";
import type { NoteApi } from "@/components/notes/types";

interface NoteOuverteHeaderProps {
  note: NoteApi;
  estPartagee: boolean;
  enCours: boolean;
  onBasculerEpinglee: () => void;
  onOuvrirPartage: () => void;
  onRenommer: (titre: string) => void;
}

/**
 * En-tête de la note ouverte (titre + badges + actions rapides) - extrait de
 * `NoteOuverte` pour garder le parent sous ~150 lignes. Le titre s'édite en
 * ligne (clic -> input -> Entrée/perte de focus), comme celui des tâches,
 * y compris pour une note partagée reçue. Épingler et « Partager » restent
 * réservés au propriétaire de la note ; `PartageBadge` prend leur place.
 */
export function NoteOuverteHeader({
  note,
  estPartagee,
  enCours,
  onBasculerEpinglee,
  onOuvrirPartage,
  onRenommer,
}: NoteOuverteHeaderProps) {
  const [enEdition, setEnEdition] = useState(false);
  const [titreEdition, setTitreEdition] = useState(note.titre);

  function validerTitre() {
    setEnEdition(false);
    const nettoye = titreEdition.trim();
    if (!nettoye || nettoye === note.titre) {
      setTitreEdition(note.titre);
      return;
    }
    onRenommer(nettoye);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {enEdition ? (
        <Input
          autoFocus
          value={titreEdition}
          onChange={(evenement) => setTitreEdition(evenement.target.value)}
          onBlur={validerTitre}
          onKeyDown={(evenement) => {
            if (evenement.key === "Enter") {
              evenement.preventDefault();
              validerTitre();
            }
            if (evenement.key === "Escape") {
              setTitreEdition(note.titre);
              setEnEdition(false);
            }
          }}
          className="h-auto min-w-0 flex-1 border-none bg-transparent p-0 font-display text-lg font-extrabold tracking-[-0.02em] text-ink focus-visible:ring-0"
        />
      ) : (
        <h2
          onClick={() => {
            setTitreEdition(note.titre);
            setEnEdition(true);
          }}
          title="Cliquer pour renommer"
          className="min-w-0 flex-1 cursor-text font-display text-lg font-extrabold tracking-[-0.02em] break-words text-ink"
        >
          {note.titre}
        </h2>
      )}
      {note.origine === "assistant" && (
        <span className="rounded-full bg-soft px-2 py-0.5 font-mono text-[9px] tracking-[.04em] text-accent uppercase">
          via l&apos;assistant
        </span>
      )}
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
