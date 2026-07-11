import { initialeAvatar } from "@/lib/avatar";
import { ModifierProfilDialog } from "@/components/reglages/modifier-profil-dialog";
import { GoogleCard } from "@/components/reglages/google/google-card";

// Section « Mon compte » - transposition fidèle de reglages.html (bloc
// profil + carte Google). Server Component : seule l'édition du nom est
// interactive (dialog client).
export function ProfilCard({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  return (
    <section className="fade-in delay-1 rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-5 font-display font-bold tracking-[-0.02em] text-ink">
        Mon compte
      </h2>
      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-soft font-display text-xl font-bold text-ink">
          {initialeAvatar(name, email)}
        </div>
        <div>
          <p className="font-display font-semibold text-ink">{name}</p>
          <p className="font-body text-sm text-ink/50">
            {email}
            {role === "admin" && (
              <>
                {" "}
                ·{" "}
                <span className="font-mono text-[10px] tracking-[.04em] text-accent uppercase">
                  Admin
                </span>
              </>
            )}
          </p>
        </div>
        <div className="ml-auto">
          <ModifierProfilDialog nomActuel={name} />
        </div>
      </div>

      <GoogleCard />
    </section>
  );
}
