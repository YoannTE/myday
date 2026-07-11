"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const MOT_DE_CONFIRMATION = "SUPPRIMER";

// Zone de suppression de compte - transposition fidèle de reglages.html.
// Le bouton final n'est actif qu'une fois le mot "SUPPRIMER" saisi tel quel.
export function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    setLoading(true);
    try {
      await apiCall("/api/me", { method: "DELETE" });
      await authClient.signOut();
      toast.success("Ton compte a été supprimé");
      router.push("/sign-in");
      router.refresh();
    } catch (erreur) {
      toast.error(
        erreur instanceof Error ? erreur.message : "Une erreur est survenue",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="fade-in delay-4 rounded-card border border-ink/10 p-6">
      <h2 className="mb-2 font-display font-bold tracking-[-0.02em] text-ink">
        Supprimer mon compte
      </h2>
      <p className="mb-4 font-body text-sm text-ink/50">
        Toutes tes données MyDay sont effacées définitivement. Tes mails et
        ton agenda Google ne sont pas touchés.
      </p>
      <Dialog
        open={open}
        onOpenChange={(prochainEtat) => {
          setOpen(prochainEtat);
          if (!prochainEtat) setSaisie("");
        }}
      >
        <DialogTrigger
          render={
            <Button
              variant="outline"
              className="h-auto rounded-inner border-ink/15 bg-card px-4 py-2.5 text-sm text-ink/60"
            />
          }
        >
          Supprimer définitivement...
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Cette action est définitive. Écris{" "}
              <strong>{MOT_DE_CONFIRMATION}</strong> ci-dessous pour
              confirmer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirmation-suppression">Confirmation</Label>
            <Input
              id="confirmation-suppression"
              value={saisie}
              onChange={(evenement) => setSaisie(evenement.target.value)}
              placeholder={MOT_DE_CONFIRMATION}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={saisie !== MOT_DE_CONFIRMATION || loading}
              onClick={onConfirm}
            >
              {loading ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
