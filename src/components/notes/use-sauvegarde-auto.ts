"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiCall } from "@/lib/api";
import type { NoteApi } from "@/components/notes/types";

// Enregistrement 1,5 s après la dernière frappe : une seule petite requête
// par pause d'écriture, pas une par lettre.
const DELAI_MS = 1500;

export type EtatSauvegarde = "enregistre" | "en-attente" | "enregistrement" | "erreur";

/**
 * Contenu d'une note enregistré automatiquement pendant l'écriture. Ce qui
 * reste en attente part aussi quand on quitte la note ou l'application
 * (`keepalive` : la requête survit à la fermeture de la page).
 * Une seule requête à la fois, pour que les réponses n'arrivent jamais dans
 * le désordre et n'écrasent pas ce qui vient d'être tapé.
 */
export function useSauvegardeAuto(note: NoteApi, onChange: (note: NoteApi) => void) {
  const [contenu, setContenu] = useState(note.contenu ?? "");
  const [etat, setEtat] = useState<EtatSauvegarde>("enregistre");
  const connuServeurRef = useRef(note.contenu ?? "");
  const enAttenteRef = useRef<string | null>(null);
  const enVolRef = useRef(false);
  const minuteurRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Contenu modifié ailleurs (assistant, autre appareil) : repris seulement
  // si rien n'est en cours d'écriture ici.
  useEffect(() => {
    const serveur = note.contenu ?? "";
    if (serveur === connuServeurRef.current || enAttenteRef.current !== null || enVolRef.current) return;
    connuServeurRef.current = serveur;
    setContenu(serveur);
  }, [note.contenu]);

  const envoyer = useCallback(
    async (keepalive = false) => {
      if (minuteurRef.current !== null) window.clearTimeout(minuteurRef.current);
      minuteurRef.current = null;
      if (enVolRef.current) return;
      // Boucle : ce qui a été tapé pendant l'envoi part juste après.
      while (enAttenteRef.current !== null) {
        const valeur = enAttenteRef.current;
        enAttenteRef.current = null;
        if (valeur === connuServeurRef.current) continue;
        enVolRef.current = true;
        setEtat("enregistrement");
        try {
          const reponse = await apiCall<{ data: NoteApi }>(`/api/notes/${note.id}`, {
            method: "PATCH",
            body: { contenu: valeur },
            keepalive,
          });
          connuServeurRef.current = reponse.data.contenu ?? "";
          onChangeRef.current(reponse.data);
        } catch {
          enAttenteRef.current ??= valeur;
          setEtat("erreur");
          return;
        } finally {
          enVolRef.current = false;
        }
      }
      setEtat("enregistre");
    },
    [note.id],
  );

  const modifier = useCallback(
    (valeur: string) => {
      setContenu(valeur);
      enAttenteRef.current = valeur;
      setEtat("en-attente");
      if (minuteurRef.current !== null) window.clearTimeout(minuteurRef.current);
      minuteurRef.current = window.setTimeout(() => void envoyer(), DELAI_MS);
    },
    [envoyer],
  );

  // Départ de la note (autre note, autre page) ou de l'application : on
  // enregistre tout de suite ce qui n'est pas encore parti.
  useEffect(() => {
    const surDepart = () => {
      if (document.visibilityState === "hidden") void envoyer(true);
    };
    const surFermeture = () => void envoyer(true);
    document.addEventListener("visibilitychange", surDepart);
    window.addEventListener("pagehide", surFermeture);
    return () => {
      document.removeEventListener("visibilitychange", surDepart);
      window.removeEventListener("pagehide", surFermeture);
      void envoyer(true);
    };
  }, [envoyer]);

  return { contenu, modifier, etat, reessayer: () => void envoyer() };
}
