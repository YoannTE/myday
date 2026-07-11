"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { formaterFraicheur, plusRecente } from "@/lib/freshness";
import { messageErreurGoogle } from "@/components/reglages/google/google-errors";
import type { GoogleStatus } from "@/components/reglages/google/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Carte Google - état connecté (transposition fidèle de la variante « État
// détaillé » de reglages.html) : sync la plus récente, rappel des scopes,
// resynchronisation manuelle et déconnexion avec dialog de confirmation.
export function GoogleCardConnecte({
  statut,
  onChange,
}: {
  statut: GoogleStatus;
  onChange: () => void;
}) {
  const [resynchronisation, setResynchronisation] = useState(false);
  const [deconnexion, setDeconnexion] = useState(false);
  const [dialogOuvert, setDialogOuvert] = useState(false);

  const sync = plusRecente([statut.calendar_synced_at, statut.gmail_synced_at]);

  async function resynchroniser() {
    setResynchronisation(true);
    try {
      await apiCall("/api/google/sync", { method: "POST" });
      toast.success("Resynchronisation lancée.");
      onChange();
    } catch (erreur) {
      toast.error(
        messageErreurGoogle(
          erreur,
          "Impossible de lancer la synchronisation.",
        ),
      );
    } finally {
      setResynchronisation(false);
    }
  }

  async function deconnecter() {
    setDeconnexion(true);
    try {
      await apiCall("/api/google", { method: "DELETE" });
      toast.success("Compte Google déconnecté.");
      setDialogOuvert(false);
      onChange();
    } catch (erreur) {
      toast.error(
        messageErreurGoogle(
          erreur,
          "Impossible de déconnecter le compte Google.",
        ),
      );
    } finally {
      setDeconnexion(false);
    }
  }

  return (
    <div className="rounded-inner border border-ink/10 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-soft font-bold text-accent shadow-card">
          G
        </span>
        <div>
          <p className="font-display text-sm font-semibold text-ink">
            Compte Google connecté
          </p>
          <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[.04em] text-accent uppercase">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            {sync
              ? `Synchronisé ${formaterFraicheur(sync)}`
              : "Pas encore synchronisé"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={resynchronisation}
            onClick={resynchroniser}
            className="h-auto rounded-inner bg-soft px-3 py-1.5 text-xs text-ink/70"
          >
            {resynchronisation ? "Synchronisation..." : "Resynchroniser"}
          </Button>
          <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  className="h-auto rounded-inner border border-ink/10 bg-card px-3 py-1.5 text-xs text-ink/50"
                />
              }
            >
              Déconnecter
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Déconnecter ton compte Google ?</DialogTitle>
                <DialogDescription>
                  MyDay arrêtera de synchroniser ton Agenda et Gmail. Rien
                  n&apos;est supprimé côté Google — tu pourras te reconnecter
                  à tout moment.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deconnexion}
                  onClick={deconnecter}
                >
                  {deconnexion ? "Déconnexion..." : "Déconnecter"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <p className="font-body text-xs text-ink/50">
        Agenda (lecture + écriture) · Gmail (lecture + réponses validées) —
        MyDay ne supprime jamais rien dans Gmail.
      </p>
    </div>
  );
}
