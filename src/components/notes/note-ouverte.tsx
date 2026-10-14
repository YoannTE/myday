"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NoteCategorySelect,
  SANS_CATEGORIE,
} from "@/components/notes/note-category-select";
import { NoteChecklist } from "@/components/notes/note-checklist";
import { NoteOuverteHeader } from "@/components/notes/note-ouverte-header";
import { NoteOuverteFooter } from "@/components/notes/note-ouverte-footer";
import { useSauvegardeAuto } from "@/components/notes/use-sauvegarde-auto";
import { PartageDialog } from "@/components/partage/partage-dialog";
import type { NoteApi, NoteCategory } from "@/components/notes/types";

interface NoteOuverteProps {
  note: NoteApi;
  onChange: (note: NoteApi) => void;
  onDeleted: (noteId: string) => void;
  categories: NoteCategory[] | null;
  onCategoryCreated: (categorie: NoteCategory) => void;
}

// Panneau de la note ouverte : édition du contenu (enregistré automatiquement
// pendant l'écriture), archiver/désarchiver,
// catégorie (Round 015). Badge « via l'assistant » autorisé (correction #7).
// Une note partagée reçue reste modifiable (titre, contenu, liste à cocher)
// mais catégorie/archiver/partager restent réservés au propriétaire.
export function NoteOuverte({
  note,
  onChange,
  onDeleted,
  categories,
  onCategoryCreated,
}: NoteOuverteProps) {
  const { contenu, modifier, etat, reessayer } = useSauvegardeAuto(note, onChange);
  const [enCours, setEnCours] = useState(false);
  const [enCoursCategorie, setEnCoursCategorie] = useState(false);
  const [partageOuvert, setPartageOuvert] = useState(false);
  const estPartagee = note.partage_par != null;

  async function appliquerPatch(payload: Partial<NoteApi>) {
    const reponse = await apiCall<{ data: NoteApi }>(`/api/notes/${note.id}`, {
      method: "PATCH",
      body: payload,
    });
    onChange(reponse.data);
    return reponse.data;
  }

  async function basculerArchivee() {
    setEnCours(true);
    try {
      const misAJour = await appliquerPatch({ archivee: !note.archivee });
      toast.success(misAJour.archivee ? "Note archivée." : "Note désarchivée.");
    } catch (erreur) {
      toast.error(
        erreur instanceof Error
          ? erreur.message
          : "Impossible de mettre à jour la note.",
      );
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    setEnCours(true);
    try {
      await apiCall(`/api/notes/${note.id}`, { method: "DELETE" });
      toast.success("Note supprimée.");
      onDeleted(note.id);
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible de supprimer la note."));
      setEnCours(false);
    }
  }

  async function renommer(titre: string) {
    try {
      await appliquerPatch({ titre });
      toast.success("Note renommée.");
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible de renommer la note."));
    }
  }

  async function changerCategorie(categorieId: string) {
    setEnCoursCategorie(true);
    try {
      await appliquerPatch({
        categorie_id: categorieId === SANS_CATEGORIE ? null : categorieId,
      });
      toast.success("Catégorie mise à jour.");
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de mettre à jour la catégorie."),
      );
    } finally {
      setEnCoursCategorie(false);
    }
  }

  return (
    <div className="fade-in delay-1 min-w-0 max-w-full overflow-hidden rounded-card bg-card p-6 shadow-card">
      <NoteOuverteHeader
        note={note}
        estPartagee={estPartagee}
        onOuvrirPartage={() => setPartageOuvert(true)}
        onRenommer={renommer}
      />
      <PartageDialog
        open={partageOuvert}
        onOpenChange={setPartageOuvert}
        elementType="note"
        elementId={note.id}
        titre={note.titre}
      />
      {!estPartagee && (
        <div className="mb-4 max-w-xs space-y-1.5">
          <Label>Catégorie</Label>
          <NoteCategorySelect
            categories={categories ?? []}
            disabled={categories === null || enCoursCategorie}
            value={note.categorie?.id ?? SANS_CATEGORIE}
            onValueChange={changerCategorie}
            onCategoryCreated={onCategoryCreated}
          />
        </div>
      )}
      <NoteChecklist
        noteId={note.id}
        items={note.items}
        onItemsChange={(nouveauxItems) =>
          onChange({ ...note, items: nouveauxItems })
        }
      />
      <Textarea
        value={contenu}
        onChange={(evenement) => modifier(evenement.target.value)}
        placeholder="Écris ici..."
        className="min-h-40 w-full max-w-full resize-none rounded-2xl border-none bg-ink/5 px-4 py-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-ink/80 shadow-none focus-visible:ring-0 disabled:opacity-100 md:text-sm"
      />
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/5 pt-4">
        <span className="font-mono text-[10px] tracking-[.04em] text-ink/30 uppercase">
          Créée le{" "}
          {new Date(note.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
          })}
        </span>
        <NoteOuverteFooter
          note={note}
          estPartagee={estPartagee}
          etatSauvegarde={etat}
          enCours={enCours}
          onReessayer={reessayer}
          onBasculerArchivee={basculerArchivee}
          onSupprimer={supprimer}
        />
      </div>
    </div>
  );
}
