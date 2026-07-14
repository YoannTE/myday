"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { partagerApresCreation } from "@/lib/partage-apres-creation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartageContactsPicker } from "@/components/partage/partage-contacts-picker";
import type { Task } from "@/components/taches/types";

/**
 * Ligne « + Nouvelle tâche... » (transposition du champ « Note rapide » du
 * mockup dashboard, appliquée aux tâches) : POST /api/tasks au submit, puis
 * partage best-effort avec les contacts sélectionnés dans le picker compact.
 */
export function TaskQuickAdd({
  onCreated,
}: {
  onCreated: (task: Task) => void;
}) {
  const [titre, setTitre] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [contactsSelectionnes, setContactsSelectionnes] = useState<string[]>(
    [],
  );

  async function handleSubmit(evenement: FormEvent) {
    evenement.preventDefault();
    const titreNettoye = titre.trim();
    if (!titreNettoye || enCours) return;

    setEnCours(true);
    try {
      const reponse = await apiCall<{ data: Task }>("/api/tasks", {
        method: "POST",
        body: { titre: titreNettoye },
      });
      onCreated(reponse.data);
      setTitre("");
      await partagerApresCreation(
        "task",
        reponse.data.id,
        contactsSelectionnes,
      );
      setContactsSelectionnes([]);
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible d'ajouter la tâche."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 px-5 py-3">
      <div className="flex items-center gap-4">
        <span className="text-accent">＋</span>
        <Input
          value={titre}
          onChange={(evenement) => setTitre(evenement.target.value)}
          placeholder="Nouvelle tâche..."
          disabled={enCours}
          className="h-auto min-w-0 flex-1 border-none bg-transparent p-0 font-body text-sm text-ink placeholder:text-ink/40 focus-visible:ring-0"
        />
        {titre.trim() && (
          <Button type="submit" size="sm" disabled={enCours}>
            {enCours ? "Ajout..." : "Ajouter"}
          </Button>
        )}
      </div>
      <PartageContactsPicker
        selection={contactsSelectionnes}
        onSelectionChange={setContactsSelectionnes}
      />
    </form>
  );
}
