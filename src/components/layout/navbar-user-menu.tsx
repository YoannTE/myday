"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Avatar de la navbar avec menu déroulant (Réglages, Se déconnecter) -
 * remplace l'ancien avatar statique (cf. patterns.md).
 */
export function NavbarUserMenu({ initiale }: { initiale: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSignOut() {
    setLoading(true);
    try {
      await authClient.signOut();
      toast.success("À bientôt");
      router.push("/sign-in");
      router.refresh();
    } catch {
      toast.error("Échec de déconnexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-ring flex h-9 w-9 items-center justify-center rounded-full bg-soft font-display font-semibold text-ink outline-none"
        aria-label="Menu du compte"
      >
        {initiale}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem render={<Link href="/reglages" />}>
          Réglages
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={loading}
          onClick={onSignOut}
        >
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
