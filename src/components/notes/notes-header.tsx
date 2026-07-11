"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { NoteQuickAddDialog } from "@/components/notes/note-quick-add-dialog";
import type { NoteApi } from "@/components/notes/types";

interface NotesHeaderProps {
  recherche: string;
  onRechercheChange: (valeur: string) => void;
  onCreated: (note: NoteApi) => void;
}

export function NotesHeader({
  recherche,
  onRechercheChange,
  onCreated,
}: NotesHeaderProps) {
  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-2 font-body text-sm text-ink/50 transition-colors hover:text-accent"
      >
        ← Cockpit
      </Link>
      <div className="fade-in mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-extrabold tracking-[-0.02em] text-ink md:text-2xl">
          Notes
        </h1>
        <div className="ml-auto max-w-xs flex-1">
          <Input
            value={recherche}
            onChange={(evenement) => onRechercheChange(evenement.target.value)}
            placeholder="Rechercher dans les notes..."
            className="h-auto rounded-full border-none bg-card px-4 py-2 shadow-card"
          />
        </div>
        <NoteQuickAddDialog onCreated={onCreated} />
      </div>
    </div>
  );
}
