"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Share2, Trash2 } from "lucide-react";
import { apiCall } from "@/lib/api";
import { partagerApresCreation } from "@/lib/partage-apres-creation";
import { PartageDialog } from "@/components/partage/partage-dialog";
import { PartageContactsPicker } from "@/components/partage/partage-contacts-picker";
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
import { RappelAvanceSelect } from "@/components/planning/rappel-avance-select";
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
// l'assistant » ici : la table events n'a pas de colonne origine. Pour un
// événement partagé reçu (`partage_par` non nul), seuls titre/début/fin/lieu/
// description sont modifiables ; catégorie, notification, suppression et
// partage restent réservés au propriétaire.
export function EventFormDialog({
  evenement,
  trigger,
  children,
  onSuccess,
}: EventFormDialogProps) {
  const estPartagee = evenement?.partage_par != null;
  const [open, setOpen] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [partageOuvert, setPartageOuvert] = useState(false);
  const [categories, setCategories] = useState<EventCategory[] | null>(null);
  const [categorieId, setCategorieId] = useState(
    evenement?.categorie?.id ?? SANS_CATEGORIE,
  );
  const [rappelAvance, setRappelAvance] = useState(
    evenement?.rappel_avance_minutes ?? 30,
  );
  const [contactsSelectionnes, setContactsSelectionnes] = useState<string[]>(
    [],
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
      setRappelAvance(evenement?.rappel_avance_minutes ?? 30);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmationSuppression(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContactsSelectionnes([]);
      apiCall<{ data: EventCategory[] }>("/api/event-categories")
        .then((reponse) => setCategories(reponse.data))
        .catch(() => setCategories((actuelles) => actuelles ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(valeurs: EventFormValues) {
    setEnregistrement(true);
    try {
      const payload = estPartagee
        ? {
            titre: valeurs.titre,
            debut: versIso(valeurs.debut),
            fin: versIso(valeurs.fin),
            lieu: valeurs.lieu || null,
            description: valeurs.description || null,
          }
        : {
            titre: valeurs.titre,
            debut: versIso(valeurs.debut),
            fin: versIso(valeurs.fin),
            lieu: valeurs.lieu || null,
            description: valeurs.description || null,
            categorie_id: categorieId === SANS_CATEGORIE ? null : categorieId,
            rappel_avance_minutes: rappelAvance,
          };
      if (evenement) {
        await apiCall(`/api/events/${evenement.id}`, {
          method: "PATCH",
          body: payload,
        });
        toast.success("Événement modifié.");
      } else {
        const reponse = await apiCall<{ data: EvenementApi }>("/api/events", {
          method: "POST",
          body: payload,
        });
        toast.success("Événement créé.");
        await partagerApresCreation(
          "event",
          reponse.data.id,
          contactsSelectionnes,
        );
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
            {estPartagee
              ? `Événement partagé par ${evenement?.partage_par} — vous pouvez le modifier à deux.`
              : evenement
                ? "Les modifications sont répercutées sur Google Agenda si ton compte est connecté."
                : "L'événement est ajouté à ton planning et synchronisé avec Google Agenda si ton compte est connecté."}
          </DialogDescription>
        </DialogHeader>
        {evenement && (
          <div className="-mt-1 flex items-center justify-between gap-2">
            <p className="font-mono text-xs tracking-[.04em] text-accent uppercase">
              {formaterPlageHoraire(evenement.debut, evenement.fin)}
            </p>
            {!estPartagee && (
              <button
                type="button"
                onClick={() => setPartageOuvert(true)}
                className="flex items-center gap-1.5 rounded-full px-2 py-1 font-body text-xs text-ink/50 transition-colors hover:bg-soft hover:text-ink"
              >
                <Share2 className="h-3.5 w-3.5" />
                Partager
              </button>
            )}
          </div>
        )}
        {evenement && (
          <PartageDialog
            open={partageOuvert}
            onOpenChange={setPartageOuvert}
            elementType="event"
            elementId={evenement.id}
            titre={evenement.titre}
          />
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          {!estPartagee && (
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
          )}
          {!estPartagee && (
            <div className="space-y-1.5">
              <Label>Notification</Label>
              <RappelAvanceSelect
                value={rappelAvance}
                onValueChange={setRappelAvance}
              />
            </div>
          )}
          {!evenement && (
            <PartageContactsPicker
              selection={contactsSelectionnes}
              onSelectionChange={setContactsSelectionnes}
            />
          )}
        </form>
        <DialogFooter className="items-center sm:justify-between">
          {evenement && !estPartagee ? (
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
                aria-label="Supprimer l'événement"
                onClick={() => setConfirmationSuppression(true)}
              >
                <Trash2 className="h-4 w-4" />
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
