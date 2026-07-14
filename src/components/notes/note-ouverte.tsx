"use client";

import { useEffect, useState } from "react";
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
import { PartageDialog } from "@/components/partage/partage-dialog";
import type { NoteApi, NoteCategory } from "@/components/notes/types";

interface NoteOuverteProps {
  note: NoteApi;
  onChange: (note: NoteApi) => void;
  categories: NoteCategory[] | null;
  onCategoryCreated: (categorie: NoteCategory) => void;
}

// Panneau de la note ouverte : édition du contenu, épingler/désépingler,
// archiver/désarchiver, catégorie (Round 015). Badge « via l'assistant »
// autorisé (correction #7). Une note partagée reçue reste modifiable
// (titre, contenu, liste à cocher) mais catégorie/épingler/archiver/partager
// restent réservés au propriétaire.
export function NoteOuverte({
  note,
  onChange,
  categories,
  onCategoryCreated,
}: NoteOuverteProps) {
  const [contenu, setContenu] = useState(note.contenu ?? "");
  const [enregistrement, setEnregistrement] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [enCoursCategorie, setEnCoursCategorie] = useState(false);
  const [partageOuvert, setPartageOuvert] = useState(false);
  const estPartagee = note.partage_par != null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContenu(note.contenu ?? "");
  }, [note.id, note.contenu]);

  const modifie = contenu !== (note.contenu ?? "");

  async function appliquerPatch(payload: Partial<NoteApi>) {
    const reponse = await apiCall<{ data: NoteApi }>(`/api/notes/${note.id}`, {
      method: "PATCH",
      body: payload,
    });
    onChange(reponse.data);
    return reponse.data;
  }

  async function sauvegarderContenu() {
    setEnregistrement(true);
    try {
      await appliquerPatch({ contenu });
      toast.success("Note enregistrée.");
    } catch (erreur) {
      toast.error(
        erreur instanceof Error
          ? erreur.message
          : "Impossible d'enregistrer la note.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  async function basculerEpinglee() {
    setEnCours(true);
    try {
      await appliquerPatch({ epinglee: !note.epinglee });
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
        enCours={enCours}
        onBasculerEpinglee={basculerEpinglee}
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
        onChange={(evenement) => setContenu(evenement.target.value)}
        placeholder="Écris ici..."
        className="min-h-40 w-full max-w-full resize-none border-none bg-transparent p-0 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink/80 shadow-none focus-visible:ring-0 disabled:opacity-100"
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
          modifie={modifie}
          enregistrement={enregistrement}
          enCours={enCours}
          onSauvegarder={sauvegarderContenu}
          onBasculerArchivee={basculerArchivee}
        />
      </div>
    </div>
  );
}
