"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationRow } from "@/components/layout/notification-row";
import type { NotificationApi } from "@/components/layout/notification-types";

const ROUTE_PAR_TYPE: Record<string, string> = {
  mail_important: "/mails",
  rappel_evenement: "/planning",
  brief_pret: "/",
};

const INTERVALLE_POLL_MS = 60_000;

/**
 * Cloche de notifications de la navbar (Round 009) - badge du nombre de
 * non-lues (poll léger toutes les 60s), dropdown listant les notifications
 * récentes (chargées à la première ouverture), « Tout marquer comme lu »,
 * clic sur une notif -> navigation vers la page liée au type.
 */
export function NotificationsBell() {
  const router = useRouter();
  const [nombreNonLues, setNombreNonLues] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const [notifications, setNotifications] = useState<NotificationApi[] | null>(
    null,
  );
  const [chargement, setChargement] = useState(false);

  const rafraichirCompteur = useCallback(async () => {
    try {
      const reponse = await apiCall<{ data: { count: number } }>(
        "/api/notifications/unread-count",
      );
      setNombreNonLues(reponse.data.count);
    } catch {
      // Silencieux : le badge reste à sa dernière valeur connue.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    rafraichirCompteur();
    const identifiant = setInterval(rafraichirCompteur, INTERVALLE_POLL_MS);
    return () => clearInterval(identifiant);
  }, [rafraichirCompteur]);

  async function surOuverture(valeur: boolean) {
    setOuvert(valeur);
    if (!valeur || notifications !== null) return;
    setChargement(true);
    try {
      const reponse = await apiCall<{ data: NotificationApi[] }>(
        "/api/notifications",
      );
      setNotifications(reponse.data);
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible de récupérer tes notifications."),
      );
    } finally {
      setChargement(false);
    }
  }

  async function toutMarquerLu() {
    try {
      await apiCall("/api/notifications/read", { method: "POST", body: {} });
      setNotifications(
        (actuelles) =>
          actuelles?.map((notification) => ({ ...notification, lue: true })) ??
          null,
      );
      setNombreNonLues(0);
    } catch (erreur) {
      toast.error(
        messageErreurApi(
          erreur,
          "Impossible de marquer les notifications comme lues.",
        ),
      );
    }
  }

  function surSelection(notification: NotificationApi) {
    setOuvert(false);
    router.push(ROUTE_PAR_TYPE[notification.type] ?? "/");
  }

  return (
    <DropdownMenu open={ouvert} onOpenChange={surOuverture}>
      <DropdownMenuTrigger
        className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-full text-ink/50 outline-none transition-colors hover:bg-soft hover:text-ink"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {nombreNonLues > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-semibold text-white">
            {nombreNonLues > 9 ? "9+" : nombreNonLues}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[90vw] p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
            Notifications
          </span>
          <button
            type="button"
            onClick={toutMarquerLu}
            className="font-body text-xs text-accent hover:underline"
          >
            Tout marquer comme lu
          </button>
        </div>

        {chargement && (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {!chargement && notifications && notifications.length === 0 && (
          <p className="px-2 py-3 font-body text-sm text-ink/40">
            Aucune notification pour le moment.
          </p>
        )}

        {!chargement && notifications && notifications.length > 0 && (
          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onSelect={() => surSelection(notification)}
              />
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
