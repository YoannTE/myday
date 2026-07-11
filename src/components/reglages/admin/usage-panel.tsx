"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UsageActiviteSemaine } from "@/components/reglages/admin/usage-activite-semaine";
import {
  formaterCoutUsd,
  libelleTypeEvenement,
} from "@/components/reglages/admin/usage-event-label";
import type { AdminUsageResponse } from "@/components/reglages/admin/usage-types";

// Vue journal d'usage de l'onglet Administration (Round 010) - ne montre que
// des compteurs/métadonnées (jamais de contenu mail/note/tâche), alimentée par
// GET /api/admin/usage. Cf. cloisonnement admin dans admin-section.tsx.
export function UsagePanel() {
  const [usage, setUsage] = useState<AdminUsageResponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const reponse = await apiCall<{ data: AdminUsageResponse }>(
        "/api/admin/usage",
      );
      setUsage(reponse.data);
      setErreur(null);
    } catch (erreurChargement) {
      const message =
        erreurChargement instanceof Error
          ? erreurChargement.message
          : "Impossible de charger le journal d'usage";
      setErreur(message);
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  if (erreur) {
    return (
      <div className="mt-6 border-t border-ink/5 pt-6">
        <p className="mb-3 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
          Journal d&apos;usage
        </p>
        <p className="font-body text-sm text-ink/50">{erreur}</p>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="mt-6 border-t border-ink/5 pt-6">
        <Skeleton className="mb-4 h-6 w-40" />
        <Skeleton className="mb-2 h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const evenementsTries = Object.entries(usage.events_by_type).sort(
    (a, b) => b[1] - a[1],
  );
  const maxEvenements = Math.max(1, ...evenementsTries.map(([, count]) => count));

  return (
    <div className="mt-6 border-t border-ink/5 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <p className="font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
          Journal d&apos;usage
        </p>
        <Badge
          variant="secondary"
          className="h-auto rounded-full bg-soft px-2 py-0.5 font-mono text-[9px] tracking-[.04em] text-accent uppercase"
        >
          {usage.active_users} actif{usage.active_users > 1 ? "s" : ""} · 7 j
        </Badge>
      </div>

      <div className="mb-5">
        <p className="mb-2 font-body text-xs text-ink/40">
          Jours actifs par semaine (4 dernières semaines)
        </p>
        <div className="divide-y divide-ink/5 rounded-inner border border-ink/10">
          {usage.active_days_by_user.map((donnees) => (
            <UsageActiviteSemaine key={donnees.user_label} donnees={donnees} />
          ))}
          {usage.active_days_by_user.length === 0 && (
            <p className="px-4 py-3 font-body text-sm text-ink/40">
              Aucune activité enregistrée pour l&apos;instant.
            </p>
          )}
        </div>
      </div>

      <div className="mb-5">
        <p className="mb-2 font-body text-xs text-ink/40">
          Événements par type
        </p>
        <div className="flex flex-col gap-2 rounded-inner border border-ink/10 p-4">
          {evenementsTries.map(([type, count]) => (
            <div key={type} className="flex items-center gap-3">
              <p className="w-40 flex-shrink-0 truncate font-body text-xs text-ink/60">
                {libelleTypeEvenement(type)}
              </p>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.round((count / maxEvenements) * 100)}%` }}
                />
              </div>
              <p className="w-8 flex-shrink-0 text-right font-mono text-xs text-ink">
                {count}
              </p>
            </div>
          ))}
          {evenementsTries.length === 0 && (
            <p className="font-body text-sm text-ink/40">
              Aucun événement enregistré pour l&apos;instant.
            </p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 font-body text-xs text-ink/40">
          Coût IA cumulé
        </p>
        <div className="rounded-inner border border-ink/10 p-4">
          <p className="mb-1 font-display text-lg font-bold tracking-[-0.02em] text-ink">
            {formaterCoutUsd(usage.llm_cost.total_usd)}
          </p>
          <p className="mb-3 font-body text-xs text-ink/40">
            {usage.llm_cost.prompt_tokens.toLocaleString("fr-FR")} tokens en
            entrée · {usage.llm_cost.completion_tokens.toLocaleString("fr-FR")}{" "}
            tokens en sortie
          </p>
          {usage.llm_cost.by_agent.length > 0 && (
            <div className="divide-y divide-ink/5 border-t border-ink/5">
              {usage.llm_cost.by_agent.map((agent) => (
                <div
                  key={agent.agent}
                  className="flex items-center justify-between py-2"
                >
                  <p className="font-body text-xs text-ink/70">
                    {agent.agent}
                  </p>
                  <p className="font-mono text-[11px] text-ink/50">
                    {formaterCoutUsd(agent.cost_usd)} ·{" "}
                    {agent.tokens.toLocaleString("fr-FR")} tokens
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
