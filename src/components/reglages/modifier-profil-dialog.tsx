"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

// Dialog d'édition du nom affiché (bouton « Modifier » de la carte profil).
// L'email reste en lecture seule (identifiant de connexion Better-auth).
export function ModifierProfilDialog({ nomActuel }: { nomActuel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    const nom = String(donnees.get("name") ?? "").trim();
    if (!nom) {
      toast.error("Le nom ne peut pas être vide");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.updateUser({ name: nom });
      if (error) throw new Error(error.message);
      toast.success("Profil mis à jour");
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="secondary"
            className="h-auto rounded-inner bg-soft px-4 py-2 text-sm text-ink/70"
          />
        }
      >
        Modifier
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier ton profil</DialogTitle>
          <DialogDescription>
            Seul le nom affiché peut être modifié ici. L&apos;email reste
            l&apos;identifiant de connexion.
          </DialogDescription>
        </DialogHeader>
        <form
          id="form-modifier-profil"
          onSubmit={onSubmit}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom affiché</Label>
            <Input id="name" name="name" defaultValue={nomActuel} required />
          </div>
        </form>
        <DialogFooter>
          <Button
            type="submit"
            form="form-modifier-profil"
            disabled={loading}
          >
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
