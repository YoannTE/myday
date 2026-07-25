"use client";

import { Input } from "@/components/ui/input";
import { NoteQuickAddDialog } from "@/components/notes/note-quick-add-dialog";
import type { NoteApi, NoteCategory } from "@/components/notes/types";

interface NotesHeaderProps {
  recherche: string;
  onRechercheChange: (valeur: string) => void;
  onCreated: (note: NoteApi) => void;
  categories: NoteCategory[] | null;
  onCategoryCreated: (categorie: NoteCategory) => void;
  onGererCategories: () => void;
}

export function NotesHeader({
  recherche,
  onRechercheChange,
  onCreated,
  categories,
  onCategoryCreated,
  onGererCategories,
}: NotesHeaderProps) {
  return (
    <div>
      <div className="fade-in mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onGererCategories}
          className="font-body text-sm text-accent"
        >
          Gérer les catégories
        </button>
        <div className="ml-auto max-w-xs flex-1">
          <Input
            value={recherche}
            onChange={(evenement) => onRechercheChange(evenement.target.value)}
            placeholder="Rechercher dans les notes..."
            className="h-auto rounded-full border-none bg-card px-4 py-2 text-xs shadow-card md:text-sm"
          />
        </div>
        <NoteQuickAddDialog
          onCreated={onCreated}
          categories={categories}
          onCategoryCreated={onCategoryCreated}
        />
      </div>
    </div>
  );
}
