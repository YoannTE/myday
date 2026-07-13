"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  eventFormSchema,
  type EventFormValues,
} from "@/components/planning/event-schema";
import {
  formaterPlageHoraire,
  versDatetimeLocal,
  versIso,
} from "@/components/planning/date-utils";
import {
  EventCategorySelect,
  SANS_CATEGORIE,
} from "@/components/planning/event-category-select";
import type { EventCategory, EvenementApi } from "@/components/planning/types";

interface EventFormDialogProps {
  evenement?: EvenementApi;
  trigger: React.ReactElement;
  children: React.ReactNode;
  onSuccess: () => void;
}

function valeursParDefaut(evenement?: EvenementApi): EventFormValues {
  return {
    titre: evenement?.titre ?? "",
    debut: evenement ? versDatetimeLocal(evenement.debut) : "",
    fin: evenement ? versDatetimeLocal(evenement.fin) : "",
    lieu: evenement?.lieu ?? "",
    description: evenement?.description ?? "",
  };
}

// Dialog unique pour créer OU modifier un événement (le mode dépend de la
// présence de `evenement`). Validation zod stricte `fin > debut` côté client
// uniquement (correction #7 - pas de contrainte BDD). Pas de badge « via
// l'assistant » ici : la table events n'a pas de colonne origine.
export function EventFormDialog({
  evenement,
  trigger,
  children,
  onSuccess,
}: EventFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [categories, setCategories] = useState<EventCategory[] | null>(null);
  const [categorieId, setCategorieId] = useState(
    evenement?.categorie?.id ?? SANS_CATEGORIE,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: valeursParDefaut(evenement),
  });

  useEffect(() => {
    if (open) {
      reset(valeursParDefaut(evenement));
      setCategorieId(evenement?.categorie?.id ?? SANS_CATEGORIE);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmationSuppression(false);
      apiCall<{ data: EventCategory[] }>("/api/event-categories")
        .then((reponse) => setCategories(reponse.data))
        .catch(() => setCategories((actuelles) => actuelles ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(valeurs: EventFormValues) {
    setEnregistrement(true);
    try {
      const payload = {
        titre: valeurs.titre,
        debut: versIso(valeurs.debut),
        fin: versIso(valeurs.fin),
        lieu: valeurs.lieu || null,
        description: valeurs.description || null,
        categorie_id: categorieId === SANS_CATEGORIE ? null : categorieId,
      };
      if (evenement) {
        await apiCall(`/api/events/${evenement.id}`, {
          method: "PATCH",
          body: payload,
        });
        toast.success("Événement modifié.");
      } else {
        await apiCall("/api/events", { method: "POST", body: payload });
        toast.success("Événement créé.");
      }
      setOpen(false);
      onSuccess();
    } catch (erreur) {
      toast.error(
        erreur instanceof Error
          ? erreur.message
          : "Impossible d'enregistrer l'événement.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  async function supprimer() {
    if (!evenement) return;
    setSuppression(true);
    try {
      await apiCall(`/api/events/${evenement.id}`, { method: "DELETE" });
      toast.success("Événement supprimé.");
      setOpen(false);
      onSuccess();
    } catch (erreur) {
      toast.error(
        erreur instanceof Error
          ? erreur.message
          : "Impossible de supprimer l'événement.",
      );
    } finally {
      setSuppression(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {evenement ? "Modifier l'événement" : "Nouvel événement"}
          </DialogTitle>
          <DialogDescription>
            {evenement
              ? "Les modifications sont répercutées sur Google Agenda si ton compte est connecté."
              : "L'événement est ajouté à ton planning et synchronisé avec Google Agenda si ton compte est connecté."}
          </DialogDescription>
        </DialogHeader>
        {evenement && (
          <p className="-mt-1 font-mono text-xs tracking-[.04em] text-accent uppercase">
            {formaterPlageHoraire(evenement.debut, evenement.fin)}
          </p>
        )}
        <form
          id="form-evenement"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="titre">Titre</Label>
            <Input id="titre" aria-invalid={!!errors.titre} {...register("titre")} />
            {errors.titre && (
              <p className="text-xs text-destructive">{errors.titre.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="debut">Début</Label>
              <Input
                id="debut"
                type="datetime-local"
                aria-invalid={!!errors.debut}
                {...register("debut")}
              />
              {errors.debut && (
                <p className="text-xs text-destructive">{errors.debut.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin">Fin</Label>
              <Input
                id="fin"
                type="datetime-local"
                aria-invalid={!!errors.fin}
                {...register("fin")}
              />
              {errors.fin && (
                <p className="text-xs text-destructive">{errors.fin.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lieu">Lieu</Label>
            <Input id="lieu" placeholder="Optionnel" {...register("lieu")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optionnel"
              {...register("description")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <EventCategorySelect
              categories={categories ?? []}
              disabled={categories === null}
              value={categorieId}
              onValueChange={setCategorieId}
              onCategoryCreated={(categorie) =>
                setCategories((actuelles) => [...(actuelles ?? []), categorie])
              }
            />
          </div>
        </form>
        <DialogFooter className="items-center sm:justify-between">
          {evenement ? (
            confirmationSuppression ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink/50">Confirmer ?</span>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={suppression}
                  onClick={supprimer}
                >
                  {suppression ? "Suppression..." : "Oui, supprimer"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmationSuppression(false)}
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmationSuppression(true)}
              >
                Supprimer
              </Button>
            )
          ) : (
            <span />
          )}
          <Button type="submit" form="form-evenement" disabled={enregistrement}>
            {enregistrement ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
