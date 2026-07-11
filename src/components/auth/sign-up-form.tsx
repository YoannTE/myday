"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { InvitationBanner } from "@/components/auth/invitation-banner";
import { InvitationStatusCard } from "@/components/auth/invitation-status-card";
import {
  INVITATION_ERROR_MESSAGES,
  type InvitationInvalidReason,
} from "@/lib/invitation-messages";

type PreviewState =
  | { status: "chargement" }
  | { status: "valide"; inviterFirstName: string; expiresAt: string }
  | { status: "invalide"; reason: InvitationInvalidReason };

type PreviewResponse = {
  data:
    | { valid: true; inviterFirstName: string; expiresAt: string }
    | { valid: false; reason: InvitationInvalidReason };
};

// Formulaire d'inscription protégé par jeton d'invitation - transposition
// fidèle de la variante « Classique » du mockup login.html. Le jeton est
// vérifié via le Route Handler public GET /api/invitations/preview (lecture
// seule, ne consomme jamais le jeton).
export function SignUpForm({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewState>({ status: "chargement" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let annule = false;

    async function verifierJeton() {
      try {
        const reponse = await fetch(
          `/api/invitations/preview?token=${encodeURIComponent(token)}`,
        );
        const { data }: PreviewResponse = await reponse.json();
        if (annule) return;
        if (data.valid) {
          setPreview({
            status: "valide",
            inviterFirstName: data.inviterFirstName,
            expiresAt: data.expiresAt,
          });
        } else {
          setPreview({ status: "invalide", reason: data.reason });
        }
      } catch {
        if (!annule) {
          setPreview({ status: "invalide", reason: "invalide" });
        }
      }
    }

    verifierJeton();
    return () => {
      annule = true;
    };
  }, [token]);

  async function onSubmit(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setLoading(true);

    const donnees = new FormData(evenement.currentTarget);
    const email = String(donnees.get("email") ?? "");
    const password = String(donnees.get("password") ?? "");
    const name = String(donnees.get("name") ?? email.split("@")[0]);

    try {
      // `invitationToken` est un champ TRANSITOIRE lu par le hook
      // `before /sign-up/email` (src/lib/auth.ts) - il n'appartient pas au
      // schéma Better-auth standard (pas un additionalField), d'où ce type
      // étendu explicite plutôt qu'un cast `any`.
      const { error } = await authClient.signUp.email({
        email,
        password,
        name,
        invitationToken: token,
      } as Parameters<typeof authClient.signUp.email>[0] & {
        invitationToken: string;
      });
      if (error) throw new Error(error.message);
      toast.success("Compte créé");
      router.push("/onboarding");
      router.refresh();
    } catch (erreur) {
      toast.error(
        erreur instanceof Error ? erreur.message : "Une erreur est survenue",
      );
    } finally {
      setLoading(false);
    }
  }

  if (preview.status === "chargement") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-inner" />
        <Skeleton className="h-8 w-2/3 rounded-inner" />
        <Skeleton className="h-12 w-full rounded-inner" />
        <Skeleton className="h-12 w-full rounded-inner" />
      </div>
    );
  }

  if (preview.status === "invalide") {
    return (
      <InvitationStatusCard message={INVITATION_ERROR_MESSAGES[preview.reason]} />
    );
  }

  return (
    <div>
      <InvitationBanner
        inviterFirstName={preview.inviterFirstName}
        expiresAt={preview.expiresAt}
      />
      <div className="fade-in delay-2">
        <h2 className="mb-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink">
          Crée ton compte
        </h2>
        <p className="mb-8 font-body text-sm text-ink/50">
          Deux champs et ton cockpit est prêt.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <Label
              htmlFor="name"
              className="mb-2 font-mono text-[11px] tracking-[.04em] text-ink/50 uppercase"
            >
              Ton nom
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Manon Dupuis"
              className="focus-ring h-auto rounded-inner border-ink/10 bg-card px-4 py-3 font-body text-ink"
            />
          </div>
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
              placeholder="manon@gmail.com"
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
              autoComplete="new-password"
              className="focus-ring h-auto rounded-inner border-ink/10 bg-card px-4 py-3 font-body text-ink"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="cta-gradient mt-2 h-auto rounded-inner px-6 py-3.5 font-display font-semibold text-white"
          >
            {loading ? "Création..." : "Créer mon compte"}
          </Button>
          <p className="mt-2 text-center font-body text-sm text-ink/50">
            Déjà un compte ?{" "}
            <Link href="/sign-in" className="font-medium text-accent">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
