import { LogoMyDay } from "@/components/layout/logo-myday";

// Panneau partagé des pages d'authentification - transposition fidèle de
// .project/mockups/pages/login.html (variante retenue : « Pitch dégradé »).
// Server Component : purement statique, aucune interactivité.
export function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-bg text-ink lg:grid-cols-[45%_1fr]">
      <aside className="fade-in flex min-h-[220px] flex-col justify-between cta-gradient p-8 text-white lg:min-h-screen lg:p-14">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-inner bg-white/15">
            <LogoMyDay variante="trace" className="h-7 w-7" />
          </div>
          <span className="font-display text-lg font-bold tracking-[-0.02em]">
            MyDay
          </span>
        </div>
        <div className="my-8 lg:my-0">
          <h1 className="mb-4 max-w-md font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] lg:text-4xl">
            Ton cockpit t&apos;attend.
          </h1>
          <p className="max-w-sm font-body text-sm text-white/80 lg:text-base">
            Planning, notes, tâches et mails réunis au même endroit — avec un
            assistant qui te dit quoi faire maintenant.
          </p>
        </div>
        <p className="hidden font-mono text-[11px] tracking-[.04em] text-white/50 uppercase lg:block">
          Sur invitation uniquement
        </p>
      </aside>

      <main className="flex flex-col items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-md">{children}</div>
        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <a href="/mentions-legales" className="transition-colors hover:text-ink">
            Mentions légales
          </a>
          <span aria-hidden className="text-ink/20">
            ·
          </span>
          <a href="/confidentialite" className="transition-colors hover:text-ink">
            Confidentialité
          </a>
          <span aria-hidden className="text-ink/20">
            ·
          </span>
          <a href="/cgu" className="transition-colors hover:text-ink">
            CGU
          </a>
        </footer>
      </main>
    </div>
  );
}
