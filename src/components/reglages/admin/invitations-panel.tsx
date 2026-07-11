"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvitationAdmin, StatutInvitation } from "@/components/reglages/admin/types";

const LIBELLES_STATUT: Record<StatutInvitation, string> = {
  envoyee: "Envoyée",
  acceptee: "Acceptée",
  revoquee: "Révoquée",
  expiree: "Expirée",
};

function formaterDateCourte(dateISO: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
    new Date(dateISO),
  );
}

function BadgeStatut({ statut }: { statut: StatutInvitation }) {
  const classe =
    statut === "acceptee"
      ? "bg-soft text-accent"
      : statut === "revoquee" || statut === "expiree"
        ? "bg-ink/5 text-ink/40"
        : "bg-transparent text-ink/40";
  return (
    <Badge
      variant="outline"
      className={`h-auto rounded-full border-none px-2 py-0.5 font-mono text-[9px] tracking-[.04em] uppercase ${classe}`}
    >
      {LIBELLES_STATUT[statut]}
    </Badge>
  );
}

export function InvitationsPanel({
  invitations,
  onChanged,
}: {
  invitations: InvitationAdmin[];
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function envoyerInvitation() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const reponse = await apiCall<{ data: { invite_url: string } }>(
        "/api/admin/invitations",
        { method: "POST", body: { email: email.trim() } },
      );
      await navigator.clipboard?.writeText(reponse.data.invite_url).catch(() => {});
      toast.success("Invitation envoyée — le lien a été copié");
      setEmail("");
      onChanged();
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Échec de l'envoi");
    } finally {
      setLoading(false);
    }
  }

  async function renouveler(id: string) {
    try {
      const reponse = await apiCall<{ data: InvitationAdmin }>(
        `/api/admin/invitations/${id}/renew`,
        { method: "POST" },
      );
      await navigator.clipboard?.writeText(reponse.data.invite_url).catch(() => {});
      toast.success("Invitation renouvelée — le nouveau lien a été copié");
      onChanged();
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Échec du renouvellement");
    }
  }

  async function revoquer(id: string) {
    try {
      await apiCall(`/api/admin/invitations/${id}`, { method: "DELETE" });
      toast.success("Invitation révoquée");
      onChanged();
    } catch (erreur) {
      toast.error(erreur instanceof Error ? erreur.message : "Échec de la révocation");
    }
  }

  return (
    <div className="mb-6">
      <p className="mb-3 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
        Invitations
      </p>
      <div className="mb-3 divide-y divide-ink/5 rounded-inner border border-ink/10">
        {invitations.length === 0 && (
          <p className="px-4 py-3 font-body text-sm text-ink/40">
            Aucune invitation envoyée pour le moment.
          </p>
        )}
        {invitations.map((invitation) => (
          <div key={invitation.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 font-body text-sm text-ink">
              {invitation.email}
            </span>
            {invitation.statut === "envoyee" && (
              <span className="font-mono text-[9px] tracking-[.04em] text-ink/40 uppercase">
                Envoyée · expire le {formaterDateCourte(invitation.expiration)}
              </span>
            )}
            <BadgeStatut statut={invitation.statut} />
            {invitation.statut !== "acceptee" && (
              <>
                <button
                  type="button"
                  onClick={() => renouveler(invitation.id)}
                  className="font-body text-xs text-accent"
                >
                  Renvoyer
                </button>
                {invitation.statut !== "revoquee" && (
                  <button
                    type="button"
                    onClick={() => revoquer(invitation.id)}
                    className="font-body text-xs text-ink/40"
                  >
                    Révoquer
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-inner bg-soft px-4 py-3">
        <span className="font-semibold text-accent">＋</span>
        <Input
          value={email}
          onChange={(evenement) => setEmail(evenement.target.value)}
          placeholder="Inviter quelqu'un — son email..."
          className="h-auto flex-1 border-none bg-transparent px-0 py-0 font-body text-sm text-ink shadow-none focus-visible:ring-0"
        />
        <Button
          type="button"
          disabled={loading || !email.trim()}
          onClick={envoyerInvitation}
          className="cta-gradient h-auto rounded-inner px-4 py-2 text-xs font-semibold text-white"
        >
          {loading ? "Envoi..." : "Envoyer l'invitation"}
        </Button>
      </div>
    </div>
  );
}
