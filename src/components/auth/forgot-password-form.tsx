"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Demande de réinitialisation de mot de passe. Message TOUJOURS neutre
// (anti-énumération de comptes) : on ne révèle jamais si l'email existe.
export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  async function onSubmit(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setLoading(true);

    const donnees = new FormData(evenement.currentTarget);
    const email = String(donnees.get("email") ?? "");

    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reinitialiser-mot-de-passe",
      });
    } catch {
      // Volontairement silencieux : le message reste neutre dans tous les cas.
    } finally {
      setLoading(false);
      setEnvoye(true);
    }
  }

  if (envoye) {
    return (
      <div className="fade-in delay-2 rounded-card border border-ink/10 bg-card p-6 shadow-card">
        <h2 className="mb-2 font-display text-xl font-extrabold tracking-[-0.02em] text-ink">
          Vérifie ta boîte mail
        </h2>
        <p className="mb-6 font-body text-sm text-ink/50">
          Si un compte existe avec cet email, un lien de réinitialisation
          vient d&apos;être envoyé.
        </p>
        <Link href="/sign-in" className="font-body text-sm font-medium text-accent">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="fade-in delay-2">
      <h2 className="mb-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink">
        Mot de passe oublié ?
      </h2>
      <p className="mb-8 font-body text-sm text-ink/50">
        Indique ton email, on t&apos;envoie un lien pour en choisir un nouveau.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <Label
            htmlFor="email"
            className="mb-2 font-mono text-[11px] tracking-[.04em] text-ink/50 uppercase"
          >
            Ton email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="focus-ring h-auto rounded-inner border-ink/10 bg-card px-4 py-3 font-body text-ink"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="cta-gradient mt-2 h-auto rounded-inner px-6 py-3.5 font-display font-semibold text-white"
        >
          {loading ? "Envoi..." : "Envoyer le lien"}
        </Button>
        <p className="mt-2 text-center font-body text-sm text-ink/50">
          <Link href="/sign-in" className="font-medium text-accent">
            Retour à la connexion
          </Link>
        </p>
      </form>
    </div>
  );
}
