import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import type { ElementType } from "@/components/partage/types";

/**
 * Partage best-effort d'un élément fraîchement créé avec chaque contact
 * sélectionné dans `PartageContactsPicker` - une erreur de partage isolée
 * n'annule jamais la création, un seul toast d'erreur générique est émis si
 * au moins un partage échoue.
 */
export async function partagerApresCreation(
  elementType: ElementType,
  elementId: string,
  contactIds: string[],
): Promise<void> {
  if (contactIds.length === 0) return;
  const resultats = await Promise.allSettled(
    contactIds.map((contactId) =>
      apiCall("/api/partages", {
        method: "POST",
        body: {
          element_type: elementType,
          element_id: elementId,
          contact_id: contactId,
        },
      }),
    ),
  );
  const echec = resultats.some((resultat) => resultat.status === "rejected");
  if (echec) {
    toast.error("Certains partages n'ont pas pu être enregistrés.");
  }
}
