"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formaterFraicheur } from "@/lib/freshness";
import {
  NoteCategorySelect,
  SANS_CATEGORIE,
} from "@/components/notes/note-category-select";
import type { NoteApi, NoteCategory } from "@/components/notes/types";

interface NoteOuverteProps {
  note: NoteApi;
  onChange: (note: NoteApi) => void;
  categories: NoteCategory[] | null;
  onCategoryCreated: (categorie: NoteCategory) => void;
}

// Panneau de la note ouverte : édition du contenu, épingler/désépingler,
// archiver/désarchiver, catégorie (Round 015). Badge « via l'assistant »
// autorisé (correction #7).
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
    <div className="fade-in delay-1 max-w-full overflow-hidden rounded-card bg-card p-6 shadow-card">
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
        <button
          type="button"
          onClick={basculerEpinglee}
          disabled={enCours}
          title={note.epinglee ? "Désépingler" : "Épingler"}
          className={`flex h-8 w-8 items-center justify-center rounded-inner text-sm ${
            note.epinglee ? "bg-accent text-white" : "bg-soft text-ink/50"
          }`}
        >
          📌
        </button>
      </div>
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
      <Textarea
        value={contenu}
        onChange={(evenement) => setContenu(evenement.target.value)}
        placeholder="Écris ici..."
        className="min-h-40 w-full max-w-full resize-none border-none bg-transparent p-0 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink/80 shadow-none focus-visible:ring-0"
      />
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/5 pt-4">
        <span className="font-mono text-[10px] tracking-[.04em] text-ink/30 uppercase">
          Créée le{" "}
          {new Date(note.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
          })}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {modifie && (
            <Button
              type="button"
              size="sm"
              disabled={enregistrement}
              onClick={sauvegarderContenu}
            >
              {enregistrement ? "Enregistrement..." : "Enregistrer"}
            </Button>
          )}
          <button
            type="button"
            onClick={basculerArchivee}
            disabled={enCours}
            className="font-body text-xs text-ink/40 hover:text-accent"
          >
            {note.archivee ? "Désarchiver" : "Archiver"}
          </button>
        </div>
      </div>
    </div>
  );
}
