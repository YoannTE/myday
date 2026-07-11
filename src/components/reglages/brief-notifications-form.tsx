"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BriefTone, Preferences } from "@/components/onboarding/types";

const HEURES = Array.from({ length: 48 }, (_, index) => {
  const heures = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${heures}:${minutes}`;
});

const TONS: { valeur: BriefTone; libelle: string }[] = [
  { valeur: "neutre", libelle: "Neutre" },
  { valeur: "motivant", libelle: "Motivant" },
  { valeur: "direct", libelle: "Direct" },
];

const FUSEAUX = [
  { valeur: "Europe/Paris", libelle: "Paris (heure de France)" },
  { valeur: "Europe/London", libelle: "Londres" },
  { valeur: "America/New_York", libelle: "New York" },
  { valeur: "America/Los_Angeles", libelle: "Los Angeles" },
  { valeur: "Asia/Tokyo", libelle: "Tokyo" },
];

const NOTIFICATIONS = [
  {
    cle: "notif_important_mail" as const,
    titre: "Mails importants",
    description: "Une alerte quand un mail nécessite ton attention.",
  },
  {
    cle: "notif_event_reminder" as const,
    titre: "Rappels d'événements",
    description: "Un rappel avant chaque rendez-vous de ta journée.",
  },
  {
    cle: "notif_brief_ready" as const,
    titre: "Brief prêt",
    description: "Une notification dès que ton brief du jour est généré.",
  },
];

/**
 * Onglet « Brief & notifications » de /reglages - formulaire complet (heure,
 * fuseau horaire, 3 alertes) lisant/écrivant GET/PATCH /api/preferences
 * (cf. .project/rounds/005/plan.md « Contrats figés »). Chaque changement
 * s'enregistre immédiatement (pas de bouton « Enregistrer » séparé).
 */
export function BriefNotificationsForm() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    let annule = false;
    apiCall<{ data: Preferences }>("/api/preferences")
      .then((reponse) => {
        if (!annule) setPreferences(reponse.data);
      })
      .catch((erreurChargement) => {
        if (!annule) {
          setErreur(
            messageErreurApi(
              erreurChargement,
              "Impossible de récupérer tes préférences.",
            ),
          );
        }
      });
    return () => {
      annule = true;
    };
  }, []);

  async function enregistrer(patch: Partial<Preferences>) {
    if (!preferences) return;
    const precedentes = preferences;
    setPreferences({ ...preferences, ...patch });
    setEnregistrement(true);
    try {
      const reponse = await apiCall<{ data: Preferences }>(
        "/api/preferences",
        { method: "PATCH", body: patch },
      );
      setPreferences(reponse.data);
      toast.success("Préférences enregistrées");
    } catch (erreurEnvoi) {
      setPreferences(precedentes);
      toast.error(
        messageErreurApi(
          erreurEnvoi,
          "Impossible d'enregistrer tes préférences.",
        ),
      );
    } finally {
      setEnregistrement(false);
    }
  }

  if (erreur) {
    return (
      <section className="fade-in delay-1 rounded-card bg-card p-6 shadow-card">
        <p className="font-body text-sm text-ink/60">{erreur}</p>
      </section>
    );
  }

  if (!preferences) {
    return (
      <section className="fade-in delay-1 rounded-card bg-card p-6 shadow-card">
        <Skeleton className="mb-3 h-6 w-40" />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  return (
    <section className="fade-in delay-1 rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-5 font-display font-bold tracking-[-0.02em] text-ink">
        Brief &amp; notifications
      </h2>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
            Heure du brief
          </p>
          <Select
            value={preferences.brief_hour}
            onValueChange={(valeur) =>
              enregistrer({ brief_hour: valeur as string })
            }
          >
            <SelectTrigger className="h-auto w-full justify-between rounded-inner border-ink/10 bg-card px-4 py-3 font-body text-ink">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEURES.map((heure) => (
                <SelectItem key={heure} value={heure}>
                  {heure}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
            Fuseau horaire
          </p>
          <Select
            value={preferences.timezone}
            onValueChange={(valeur) =>
              enregistrer({ timezone: valeur as string })
            }
          >
            <SelectTrigger className="h-auto w-full justify-between rounded-inner border-ink/10 bg-card px-4 py-3 font-body text-ink">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUSEAUX.map((fuseau) => (
                <SelectItem key={fuseau.valeur} value={fuseau.valeur}>
                  {fuseau.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
            Ton du brief
          </p>
          <Select
            value={preferences.brief_tone}
            onValueChange={(valeur) =>
              enregistrer({ brief_tone: valeur as BriefTone })
            }
          >
            <SelectTrigger className="h-auto w-full justify-between rounded-inner border-ink/10 bg-card px-4 py-3 font-body text-ink">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONS.map((ton) => (
                <SelectItem key={ton.valeur} value={ton.valeur}>
                  {ton.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {NOTIFICATIONS.map((notification) => (
          <div
            key={notification.cle}
            className="flex items-center justify-between gap-4 rounded-inner border border-ink/10 px-4 py-3"
          >
            <div>
              <Label className="font-body text-sm text-ink">
                {notification.titre}
              </Label>
              <p className="font-body text-xs text-ink/40">
                {notification.description}
              </p>
            </div>
            <Switch
              checked={preferences[notification.cle]}
              disabled={enregistrement}
              onCheckedChange={(valeur) =>
                enregistrer({ [notification.cle]: valeur })
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}
