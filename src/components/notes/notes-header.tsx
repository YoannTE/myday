"use client";

import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CockpitSectionActions } from "@/components/cockpit/section-actions";
import { SectionAddButton } from "@/components/cockpit/section-add-button";
import { SectionSettingsButton } from "@/components/cockpit/section-settings-button";
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
      <CockpitSectionActions>
        <SectionSettingsButton
          onClick={onGererCategories}
          libelle="Gérer les catégories de notes"
        />
        <NoteQuickAddDialog
          onCreated={onCreated}
          categories={categories}
          onCategoryCreated={onCategoryCreated}
          trigger={<SectionAddButton aria-label="Ajouter une note" />}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </NoteQuickAddDialog>
      </CockpitSectionActions>
      <div className="fade-in mb-6 flex flex-wrap items-center gap-3">
        <div className="ml-auto max-w-xs flex-1">
          <Input
            value={recherche}
            onChange={(evenement) => onRechercheChange(evenement.target.value)}
            placeholder="Rechercher dans les notes..."
            className="h-auto rounded-full border-none bg-card px-4 py-2 text-xs shadow-card md:text-sm"
          />
        </div>
      </div>
    </div>
  );
}
