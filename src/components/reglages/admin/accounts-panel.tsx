"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { initialeAvatar } from "@/lib/avatar";
import type { CompteAdmin } from "@/components/reglages/admin/types";

function formaterDerniereConnexion(dateISO: string | null): string {
  if (!dateISO) return "Jamais connecté";
  return `Dernière connexion : ${new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateISO))}`;
}

export function AccountsPanel({
  comptes,
  currentUserId,
  onChanged,
}: {
  comptes: CompteAdmin[];
  currentUserId: string;
  onChanged: () => void;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function basculerActivation(compte: CompteAdmin) {
    setLoadingId(compte.id);
    try {
      await apiCall(`/api/admin/accounts/${compte.id}`, {
        method: "PATCH",
        body: { active: !compte.active },
      });
      toast.success(
        compte.active ? "Compte désactivé" : "Compte réactivé",
      );
      onChanged();
    } catch (erreur) {
      toast.error(
        erreur instanceof Error ? erreur.message : "Échec de la mise à jour",
      );
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <p className="mb-3 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
        Comptes
      </p>
      <div className="divide-y divide-ink/5 rounded-inner border border-ink/10">
        {comptes.map((compte) => (
          <div key={compte.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-soft font-display text-xs font-semibold text-ink">
              {initialeAvatar(compte.name, compte.email)}
            </span>
            <div className="flex-1">
              <p className="font-body text-sm text-ink">
                {compte.email}
                {compte.role === "admin" && (
                  <span className="ml-1 font-mono text-[9px] tracking-[.04em] text-accent uppercase">
                    Admin
                  </span>
                )}
                {!compte.active && (
                  <span className="ml-1 font-mono text-[9px] tracking-[.04em] text-ink/40 uppercase">
                    Désactivé
                  </span>
                )}
              </p>
              <p className="font-body text-xs text-ink/40">
                {formaterDerniereConnexion(compte.last_connexion)}
              </p>
            </div>
            {compte.id !== currentUserId && (
              <button
                type="button"
                disabled={loadingId === compte.id}
                onClick={() => basculerActivation(compte)}
                className="font-body text-xs text-ink/40"
              >
                {loadingId === compte.id
                  ? "..."
                  : compte.active
                    ? "Désactiver"
                    : "Réactiver"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
