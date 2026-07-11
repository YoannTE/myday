"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InvitationsPanel } from "@/components/reglages/admin/invitations-panel";
import { AccountsPanel } from "@/components/reglages/admin/accounts-panel";
import { UsagePanel } from "@/components/reglages/admin/usage-panel";
import type { CompteAdmin, InvitationAdmin } from "@/components/reglages/admin/types";

// Orchestrateur de l'onglet Administration : charge invitations + comptes et
// les redistribue aux deux panneaux. Visible uniquement pour un admin (garde
// posée par la page /reglages via requireAdmin côté serveur en amont de ce
// rendu client).
export function AdminSection({ currentUserId }: { currentUserId: string }) {
  const [invitations, setInvitations] = useState<InvitationAdmin[] | null>(null);
  const [comptes, setComptes] = useState<CompteAdmin[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    try {
      const [invitationsReponse, comptesReponse] = await Promise.all([
        apiCall<{ data: InvitationAdmin[] }>("/api/admin/invitations"),
        apiCall<{ data: CompteAdmin[] }>("/api/admin/accounts"),
      ]);
      setInvitations(invitationsReponse.data);
      setComptes(comptesReponse.data);
      setErreur(null);
    } catch (erreurChargement) {
      const message =
        erreurChargement instanceof Error
          ? erreurChargement.message
          : "Impossible de charger les données d'administration";
      setErreur(message);
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    // Chargement initial des données admin au montage - `recharger` met à
    // jour l'état de façon asynchrone (après l'appel réseau), pas de manière
    // synchrone pendant l'effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recharger();
  }, [recharger]);

  if (erreur) {
    return (
      <section className="fade-in delay-3 rounded-card bg-card p-6 shadow-card">
        <h2 className="mb-2 font-display font-bold tracking-[-0.02em] text-ink">
          Administration
        </h2>
        <p className="font-body text-sm text-ink/50">{erreur}</p>
      </section>
    );
  }

  if (!invitations || !comptes) {
    return (
      <section className="fade-in delay-3 rounded-card bg-card p-6 shadow-card">
        <Skeleton className="mb-4 h-6 w-40" />
        <Skeleton className="mb-2 h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </section>
    );
  }

  return (
    <section className="fade-in delay-3 rounded-card bg-card p-6 shadow-card">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="font-display font-bold tracking-[-0.02em] text-ink">
          Administration
        </h2>
        <Badge
          variant="secondary"
          className="h-auto rounded-full bg-soft px-2 py-0.5 font-mono text-[9px] tracking-[.04em] text-accent uppercase"
        >
          Visible par toi seul
        </Badge>
      </div>

      <InvitationsPanel invitations={invitations} onChanged={recharger} />
      <AccountsPanel
        comptes={comptes}
        currentUserId={currentUserId}
        onChanged={recharger}
      />

      <p className="mt-3 font-body text-xs text-ink/40">
        Tu vois uniquement les informations de compte — jamais le contenu
        (mails, notes, tâches) des autres utilisateurs.
      </p>

      <UsagePanel />
    </section>
  );
}
