"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Mode = "sign-in" | "sign-up";

export function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: Mode;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isSignUp = mode === "sign-up";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? email.split("@")[0]);

    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message);
      }
      toast.success(isSignUp ? "Compte cree" : "Connexion reussie");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Une erreur est survenue",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Echec Google OAuth");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isSignUp ? "Creer un compte" : "Se connecter"}</CardTitle>
        <CardDescription>
          {isSignUp
            ? "Email et mot de passe (min 6 caracteres)"
            : "Avec ton email ou Google"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-3">
          {isSignUp && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom</Label>
              <Input id="name" name="name" type="text" placeholder="Ton nom" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Chargement..."
              : isSignUp
                ? "Creer le compte"
                : "Se connecter"}
          </Button>
        </form>

        {googleEnabled && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={onGoogle}
              disabled={loading}
            >
              Continuer avec Google
            </Button>
          </>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Deja un compte ? " : "Pas encore de compte ? "}
          <Link
            href={isSignUp ? "/sign-in" : "/sign-up"}
            className="underline hover:text-foreground"
          >
            {isSignUp ? "Se connecter" : "Creer un compte"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
