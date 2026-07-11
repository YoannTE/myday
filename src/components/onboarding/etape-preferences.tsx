"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Preferences } from "@/components/onboarding/types";

const HEURES = Array.from({ length: 48 }, (_, index) => {
  const heures = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${heures}:${minutes}`;
});

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

type ValeursNotifications = Record<(typeof NOTIFICATIONS)[number]["cle"], boolean>;

/**
 * Étape 2 du wizard (transposition interactive de la section « Règle ton
 * brief » de onboarding.html) : heure du brief + 3 alertes, envoyées en une
 * seule transition vers l'étape 3.
 */
export function EtapePreferences({
  preferences,
  onContinuer,
}: {
  preferences: Preferences;
  onContinuer: (patch: { brief_hour: string } & ValeursNotifications) => void;
}) {
  const [heure, setHeure] = useState(preferences.brief_hour);
  const [notifications, setNotifications] = useState<ValeursNotifications>({
    notif_important_mail: preferences.notif_important_mail,
    notif_event_reminder: preferences.notif_event_reminder,
    notif_brief_ready: preferences.notif_brief_ready,
  });

  return (
    <section className="fade-in delay-1 rounded-card bg-card p-6 shadow-card md:p-10">
      <span className="mb-4 inline-block rounded-full bg-soft px-2.5 py-1 font-mono text-[10px] tracking-[.04em] text-accent uppercase">
        Étape 2 · En cours
      </span>
      <h2 className="mb-2 font-display text-lg font-extrabold tracking-[-0.02em] text-ink md:text-2xl">
        Règle ton brief
      </h2>
      <p className="mb-6 max-w-lg font-body text-sm text-ink/60">
        À quelle heure veux-tu recevoir ton brief, et pour quelles alertes ?
      </p>

      <div className="mb-6 max-w-lg">
        <p className="mb-2 font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
          Heure du brief
        </p>
        <Select value={heure} onValueChange={(valeur) => setHeure(valeur as string)}>
          <SelectTrigger className="h-auto w-full justify-between rounded-inner border-ink/10 bg-card px-4 py-3 font-body text-ink">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HEURES.map((valeurHeure) => (
              <SelectItem key={valeurHeure} value={valeurHeure}>
                {valeurHeure}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-8 flex max-w-lg flex-col gap-4">
        <p className="font-mono text-[10px] tracking-[.04em] text-ink/40 uppercase">
          Notifications
        </p>
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
              checked={notifications[notification.cle]}
              onCheckedChange={(valeur) =>
                setNotifications((actuelles) => ({
                  ...actuelles,
                  [notification.cle]: valeur,
                }))
              }
            />
          </div>
        ))}
      </div>

      <Button
        type="button"
        onClick={() => onContinuer({ brief_hour: heure, ...notifications })}
        className="cta-gradient h-auto rounded-inner px-6 py-3.5 font-display font-semibold text-white"
      >
        Continuer
      </Button>
    </section>
  );
}
