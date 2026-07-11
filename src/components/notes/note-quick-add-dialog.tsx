"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { NoteApi } from "@/components/notes/types";

interface NoteQuickAddDialogProps {
  onCreated: (note: NoteApi) => void;
}

// Dialog « Note rapide » : titre obligatoire + contenu optionnel, POST
// direct. Pas de zod ici (un seul champ obligatoire, simple à valider).
export function NoteQuickAddDialog({ onCreated }: NoteQuickAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [erreurTitre, setErreurTitre] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  function reinitialiser() {
    setTitre("");
    setContenu("");
    setErreurTitre(null);
  }

  async function onSubmit(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const titreNettoye = titre.trim();
    if (!titreNettoye) {
      setErreurTitre("Le titre est obligatoire.");
      return;
    }

    setEnregistrement(true);
    try {
      const reponse = await apiCall<{ data: NoteApi }>("/api/notes", {
        method: "POST",
        body: { titre: titreNettoye, contenu: contenu.trim() || undefined },
      });
      toast.success("Note créée.");
      onCreated(reponse.data);
      setOpen(false);
      reinitialiser();
    } catch (erreur) {
      toast.error(
        erreur instanceof Error ? erreur.message : "Impossible de créer la note.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(valeur) => {
        setOpen(valeur);
        if (!valeur) reinitialiser();
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="cta-gradient rounded-inner px-4 py-2 font-display text-sm font-semibold text-white"
          />
        }
      >
        + Note
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Note rapide</DialogTitle>
          <DialogDescription>
            Écris ce que tu veux garder, tu pourras l&apos;épingler ou
            l&apos;archiver plus tard.
          </DialogDescription>
        </DialogHeader>
        <form id="form-note-rapide" onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="titre-note">Titre</Label>
            <Input
              id="titre-note"
              value={titre}
              aria-invalid={!!erreurTitre}
              onChange={(evenement) => {
                setTitre(evenement.target.value);
                if (erreurTitre) setErreurTitre(null);
              }}
            />
            {erreurTitre && (
              <p className="text-xs text-destructive">{erreurTitre}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contenu-note">Contenu</Label>
            <Textarea
              id="contenu-note"
              value={contenu}
              placeholder="Optionnel"
              onChange={(evenement) => setContenu(evenement.target.value)}
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="form-note-rapide" disabled={enregistrement}>
            {enregistrement ? "Enregistrement..." : "Créer la note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
