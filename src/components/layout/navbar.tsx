import Link from "next/link";
import { Euro } from "lucide-react";
import { DarkModeToggle } from "@/components/layout/dark-mode-toggle";
import { LogoMyDay } from "@/components/layout/logo-myday";
import { NavbarAssistantBar } from "@/components/layout/navbar-assistant-bar";
import { NavbarUserMenu } from "@/components/layout/navbar-user-menu";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { ThemeSync } from "@/components/layout/theme-sync";
import { AutoPushSubscribe } from "@/components/pwa/auto-push-subscribe";
import { SearchModal } from "@/components/search/search-modal";
import { initialeAvatar } from "@/lib/avatar";

interface NavbarProps {
  user: {
    name: string;
    email: string;
  };
}

const CLASSE_LIEN_NAV =
  "font-mono text-[11px] font-bold tracking-[.04em] text-ink/50 uppercase whitespace-nowrap hover:text-accent";

function formaterDateDuJour(date: Date): string {
  const brut = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return brut.charAt(0).toUpperCase() + brut.slice(1);
}

/**
 * Barre du haut AEVIO One (transposition fidèle de
 * .project/mockups/shared/components/navbar.html) : logo M dégradé + date
 * du jour, barre assistant centrale (Round 008 : envoie vers `/assistant` via
 * `NavbarAssistantBar`), lien « Aide », recherche globale + cloche de
 * notifications (Round 009), bouton mode sombre fonctionnel et avatar. Tout
 * le contenu (planning, tâches, notes) vivant désormais sur le cockpit
 * unique (« / »), il n'y a plus de seconde rangée de liens de navigation.
 * Server Component : seuls les éléments interactifs (assistant, recherche,
 * notifications, mode sombre, menu utilisateur) sont des Client Components.
 */
export function Navbar({ user }: NavbarProps) {
  const dateDuJour = formaterDateDuJour(new Date());

  return (
    <header className="fade-in border-b border-ink/5">
      <ThemeSync />
      <AutoPushSubscribe />
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-2">
          <LogoMyDay className="h-8 w-8" />
          <span className="font-display font-bold tracking-[-0.02em] text-ink">
            {dateDuJour}
          </span>
        </div>

        <div className="order-3 w-full sm:order-none sm:mx-auto sm:w-auto sm:max-w-xl sm:flex-1">
          <NavbarAssistantBar />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/aide" className={CLASSE_LIEN_NAV}>
            Aide
          </Link>
          {/* Accès au budget : section privée, toujours reverrouillée par un
              code à 4 chiffres — le bouton mène à l'écran de saisie, jamais
              directement aux chiffres. */}
          <Link
            href="/budget"
            aria-label="Budget"
            title="Budget"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-soft hover:text-accent"
          >
            <Euro className="h-4 w-4" aria-hidden="true" />
          </Link>
          <SearchModal />
          <NotificationsBell />
          <DarkModeToggle />
          <NavbarUserMenu initiale={initialeAvatar(user.name, user.email)} />
        </div>
      </div>
    </header>
  );
}
