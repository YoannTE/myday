"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Input } from "@/components/ui/input";
import type { Task } from "@/components/taches/types";

/**
 * Ligne « + Nouvelle tâche... » (transposition du champ « Note rapide » du
 * mockup dashboard, appliquée aux tâches) : POST /api/tasks au submit.
 */
export function TaskQuickAdd({
  onCreated,
}: {
  onCreated: (task: Task) => void;
}) {
  const [titre, setTitre] = useState("");
  const [enCours, setEnCours] = useState(false);

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
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible d'ajouter la tâche."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-4 px-5 py-3">
      <span className="text-accent">＋</span>
      <Input
        value={titre}
        onChange={(evenement) => setTitre(evenement.target.value)}
        placeholder="Nouvelle tâche..."
        disabled={enCours}
        className="h-auto flex-1 border-none bg-transparent p-0 font-body text-sm text-ink placeholder:text-ink/40 focus-visible:ring-0"
      />
    </form>
  );
}
