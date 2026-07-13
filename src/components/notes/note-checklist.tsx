"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NoteChecklistItem } from "@/components/notes/note-checklist-item";
import type { NoteItemApi } from "@/components/notes/types";

interface NoteChecklistProps {
  noteId: string;
  items: NoteItemApi[];
  onItemsChange: (items: NoteItemApi[]) => void;
  lectureSeule?: boolean;
}

/** Trie les éléments : non cochés d'abord (par position), cochés en bas. */
function trierItems(items: NoteItemApi[]): NoteItemApi[] {
  return [...items].sort((a, b) => {
    if (a.coche !== b.coche) return a.coche ? 1 : -1;
    return a.position - b.position;
  });
}

// Section « Liste à cocher » d'une note (idéale pour une liste de courses) :
// ajout, cochage optimiste, édition inline et suppression d'éléments. Chaque
// mutation reconstruit la liste triée et remonte via `onItemsChange` pour
// garder la note ouverte et la liste des notes synchronisées.
export function NoteChecklist({
  noteId,
  items,
  onItemsChange,
  lectureSeule = false,
}: NoteChecklistProps) {
  const [nouveauContenu, setNouveauContenu] = useState("");
  const [ajoutEnCours, setAjoutEnCours] = useState(false);

  async function ajouterElement() {
    const contenu = nouveauContenu.trim();
    if (!contenu || ajoutEnCours) return;
    setAjoutEnCours(true);
    try {
      const reponse = await apiCall<{ data: NoteItemApi }>(
        `/api/notes/${noteId}/items`,
        { method: "POST", body: { contenu } },
      );
      onItemsChange(trierItems([...items, reponse.data]));
      setNouveauContenu("");
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible d'ajouter l'élément."));
    } finally {
      setAjoutEnCours(false);
    }
  }

  function remplacerItem(item: NoteItemApi) {
    onItemsChange(
      trierItems(items.map((existant) => (existant.id === item.id ? item : existant))),
    );
  }

  function retirerItem(itemId: string) {
    onItemsChange(items.filter((existant) => existant.id !== itemId));
  }

  return (
    <div className="mb-4 min-w-0 space-y-2">
      <p className="label-mono text-ink/40">Liste à cocher</p>
      {items.length > 0 && (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <NoteChecklistItem
              key={item.id}
              item={item}
              onUpdated={remplacerItem}
              onDeleted={() => retirerItem(item.id)}
              lectureSeule={lectureSeule}
            />
          ))}
        </div>
      )}
      {!lectureSeule && (
        <div className="flex min-w-0 items-center gap-2">
          <Input
            value={nouveauContenu}
            onChange={(evenement) => setNouveauContenu(evenement.target.value)}
            onKeyDown={(evenement) => {
              if (evenement.key === "Enter") {
                evenement.preventDefault();
                ajouterElement();
              }
            }}
            placeholder="Ajouter un élément..."
            disabled={ajoutEnCours}
            className="h-8 min-w-0 flex-1 border-none bg-transparent px-0 font-body text-sm text-ink focus-visible:ring-0"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={ajoutEnCours || !nouveauContenu.trim()}
            onClick={ajouterElement}
            aria-label="Ajouter l'élément"
          >
            <Plus className="text-accent" />
          </Button>
        </div>
      )}
    </div>
  );
}
