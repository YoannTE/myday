"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { MailEntete } from "@/components/mails/mail-entete";
import { MailListe } from "@/components/mails/mail-liste";
import { MailDetail } from "@/components/mails/mail-detail";
import type {
  FiltreMail,
  Mail,
  MailsListResponse,
  TriageRefreshResult,
  ValeurFeedback,
} from "@/components/mails/types";

function MailsSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}

/**
 * Page `/mails` (F7) : liste des mails scorés par le tri IA (filtres
 * Importants/Tous), mail ouvert (résumé, raison du score, extrait) et
 * boucle de feedback qui alimente `sender_preferences` pour le run suivant.
 */
export function MailsClient() {
  const [filtre, setFiltre] = useState<FiltreMail>("important");
  const [donnees, setDonnees] = useState<MailsListResponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mailSelectionneId, setMailSelectionneId] = useState<string | null>(null);
  const [feedbackEnCoursId, setFeedbackEnCoursId] = useState<string | null>(null);
  const [rafraichissementEnCours, setRafraichissementEnCours] = useState(false);

  const charger = useCallback(async (filtreActuel: FiltreMail) => {
    try {
      const reponse = await apiCall<{ data: MailsListResponse }>(
        `/api/mails?filter=${filtreActuel}`,
      );
      setDonnees(reponse.data);
      setErreur(null);
      setMailSelectionneId((precedent) => {
        if (precedent && reponse.data.mails.some((m) => m.id === precedent)) {
          return precedent;
        }
        return reponse.data.mails[0]?.id ?? null;
      });
    } catch (erreurChargement) {
      setErreur(
        messageErreurApi(erreurChargement, "Impossible de récupérer tes mails."),
      );
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger(filtre);
  }, [filtre, charger]);

  async function selectionnerMail(mail: Mail) {
    setMailSelectionneId(mail.id);
    if (mail.lu) return;
    try {
      const reponse = await apiCall<{ data: Mail }>(`/api/mails/${mail.id}`);
      setDonnees((actuelles) => {
        if (!actuelles) return actuelles;
        return {
          ...actuelles,
          mails: actuelles.mails.map((m) =>
            m.id === reponse.data.id ? reponse.data : m,
          ),
        };
      });
    } catch {
      // Marquage "lu" best-effort : un échec ne doit jamais bloquer la lecture.
    }
  }

  async function envoyerFeedback(mailId: string, valeur: ValeurFeedback) {
    setFeedbackEnCoursId(mailId);
    try {
      await apiCall(`/api/mails/${mailId}/feedback`, {
        method: "POST",
        body: { valeur },
      });
      toast.success(
        valeur === "important"
          ? "Mail marqué comme important."
          : "Mail marqué comme pas important.",
      );
      await charger(filtre);
    } catch (erreurFeedback) {
      toast.error(
        messageErreurApi(erreurFeedback, "Impossible d'enregistrer ton choix."),
      );
    } finally {
      setFeedbackEnCoursId(null);
    }
  }

  async function rafraichirTri() {
    setRafraichissementEnCours(true);
    try {
      const reponse = await apiCall<{ data: TriageRefreshResult }>(
        "/api/triage/refresh",
        { method: "POST" },
      );
      const { processed, important_count } = reponse.data;
      toast.success(
        processed === 0
          ? "Aucun nouveau mail à trier."
          : `${processed} mail${processed > 1 ? "s" : ""} trié${processed > 1 ? "s" : ""}, ${important_count} important${important_count > 1 ? "s" : ""}.`,
      );
      await charger(filtre);
    } catch (erreurRafraichissement) {
      toast.error(
        messageErreurApi(
          erreurRafraichissement,
          "Impossible de rafraîchir le tri.",
        ),
      );
    } finally {
      setRafraichissementEnCours(false);
    }
  }

  if (erreur) {
    return (
      <div className="rounded-card bg-card p-6 text-center shadow-card">
        <p className="font-body text-sm text-ink/60">{erreur}</p>
      </div>
    );
  }

  if (!donnees) {
    return (
      <>
        <MailEntete
          filtre={filtre}
          onFiltreChange={setFiltre}
          onRafraichir={rafraichirTri}
          rafraichissementEnCours={rafraichissementEnCours}
        />
        <MailsSkeleton />
      </>
    );
  }

  const mailSelectionne =
    donnees.mails.find((m) => m.id === mailSelectionneId) ?? null;

  return (
    <>
      <MailEntete
        filtre={filtre}
        onFiltreChange={setFiltre}
        onRafraichir={rafraichirTri}
        rafraichissementEnCours={rafraichissementEnCours}
      />
      {donnees.mails.length === 0 ? (
        <p className="rounded-card bg-card p-6 text-center font-body text-sm text-ink/50 shadow-card">
          {filtre === "important"
            ? "Aucun mail important pour l'instant."
            : "Aucun mail."}
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
          <MailListe
            mails={donnees.mails}
            ecartes={donnees.ecartes}
            filtre={filtre}
            mailSelectionneId={mailSelectionneId}
            onSelectionner={selectionnerMail}
            onVoirEcartes={() => setFiltre("tous")}
          />
          <MailDetail
            mail={mailSelectionne}
            feedbackEnCoursId={feedbackEnCoursId}
            onFeedback={envoyerFeedback}
          />
        </div>
      )}
    </>
  );
}
