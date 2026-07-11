"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Transposition fidèle de la variante « Connexion existante » du mockup
// login.html (formulaire V2).
export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setLoading(true);

    const donnees = new FormData(evenement.currentTarget);
    const email = String(donnees.get("email") ?? "");
    const password = String(donnees.get("password") ?? "");

    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        // Better-auth renvoie ses messages par défaut en anglais : on traduit
        // les codes connus, et on garde tels quels nos messages déjà français
        // (« Compte désactivé » vient du hook serveur).
        const message =
          error.code === "INVALID_EMAIL_OR_PASSWORD" ||
          /invalid email or password/i.test(error.message ?? "")
            ? "Email ou mot de passe incorrect"
            : (error.message ?? "Une erreur est survenue");
        throw new Error(message);
      }
      toast.success("Connexion réussie");
      router.push("/");
      router.refresh();
    } catch (erreur) {
      toast.error(
        erreur instanceof Error ? erreur.message : "Une erreur est survenue",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    } catch (erreur) {
      toast.error(
        erreur instanceof Error ? erreur.message : "Échec de connexion Google",
      );
      setLoading(false);
    }
  }

  return (
    <div className="fade-in delay-2">
      <h2 className="mb-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink">
        Bon retour !
      </h2>
      <p className="mb-8 font-body text-sm text-ink/50">
        Connecte-toi pour retrouver ton cockpit.
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
        <div>
          <Label
            htmlFor="password"
            className="mb-2 font-mono text-[11px] tracking-[.04em] text-ink/50 uppercase"
          >
            Mot de passe
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            className="focus-ring h-auto rounded-inner border-ink/10 bg-card px-4 py-3 font-body text-ink"
          />
        </div>
        <div className="mt-1 flex items-center justify-between">
          <Link
            href="/mot-de-passe-oublie"
            className="font-body text-sm text-accent"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="cta-gradient mt-1 h-auto rounded-inner px-6 py-3.5 font-display font-semibold text-white"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-ink/10" />
            </div>
            <div className="relative flex justify-center font-mono text-[10px] tracking-[.04em] text-ink/30 uppercase">
              <span className="bg-bg px-2">ou</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onGoogle}
            className="h-auto w-full rounded-inner border-ink/10 bg-card py-3 font-body text-ink"
          >
            Continuer avec Google
          </Button>
        </>
      )}
    </div>
  );
}
