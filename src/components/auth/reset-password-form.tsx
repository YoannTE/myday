"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Saisie du nouveau mot de passe après clic sur le lien reçu par email. Le
// jeton transite en query string (`?token=...`, posé par le callback
// Better-auth `GET /reset-password/:token`). Si le jeton est invalide ou
// expiré, Better-auth redirige plutôt avec `?error=INVALID_TOKEN`.
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();

    const donnees = new FormData(evenement.currentTarget);
    const motDePasse = String(donnees.get("password") ?? "");
    const confirmation = String(donnees.get("confirmation") ?? "");

    if (motDePasse !== confirmation) {
      toast.error("Les deux mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: motDePasse,
        token,
      });
      if (error) throw new Error(error.message);
      toast.success("Mot de passe mis à jour");
      router.push("/sign-in");
    } catch (erreur) {
      toast.error(
        erreur instanceof Error ? erreur.message : "Une erreur est survenue",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in delay-2">
      <h2 className="mb-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink">
        Choisis un nouveau mot de passe
      </h2>
      <p className="mb-8 font-body text-sm text-ink/50">
        Au moins 6 caractères.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label
            htmlFor="password"
            className="mb-2 font-mono text-[11px] tracking-[.04em] text-ink/50 uppercase"
          >
            Nouveau mot de passe
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="focus-ring h-auto rounded-inner border-ink/10 bg-card px-4 py-3 font-body text-ink"
          />
        </div>
        <div>
          <Label
            htmlFor="confirmation"
            className="mb-2 font-mono text-[11px] tracking-[.04em] text-ink/50 uppercase"
          >
            Confirme le mot de passe
          </Label>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="focus-ring h-auto rounded-inner border-ink/10 bg-card px-4 py-3 font-body text-ink"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="cta-gradient mt-2 h-auto rounded-inner px-6 py-3.5 font-display font-semibold text-white"
        >
          {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
        </Button>
      </form>
    </div>
  );
}

