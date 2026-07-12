"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiCall } from "@/lib/api";
import { NotesHeader } from "@/components/notes/notes-header";
import { NotesListe } from "@/components/notes/notes-liste";
import { NoteOuverte } from "@/components/notes/note-ouverte";
import { NotesSkeleton } from "@/components/notes/notes-skeleton";
import type { NoteApi } from "@/components/notes/types";

// Orchestrateur client de la page Notes : recherche (debounce), liste +
// note ouverte, création via « Note rapide ». Les notes archivées restent
// visibles dans la liste (grisées), comme dans le mockup. Round 014 (F6) :
// une note ouverte depuis le cockpit arrive via `?note=<id>` et est
// pré-sélectionnée dès que la liste est chargée.
export function NotesClient() {
  const searchParams = useSearchParams();
  const noteIdDepuisUrl = searchParams.get("note");
  const [notes, setNotes] = useState<NoteApi[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [noteSelectionneeId, setNoteSelectionneeId] = useState<string | null>(
    null,
  );

  const recharger = useCallback(async (q: string) => {
    try {
      const suffixe = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const reponse = await apiCall<{ data: NoteApi[] }>(`/api/notes${suffixe}`);
      setNotes(reponse.data);
      setErreur(null);
    } catch (erreurChargement) {
      setErreur(
        erreurChargement instanceof Error
          ? erreurChargement.message
          : "Impossible de charger les notes.",
      );
    }
  }, []);

  useEffect(() => {
    const identifiant = setTimeout(() => {
      recharger(recherche);
    }, 300);
    return () => clearTimeout(identifiant);
  }, [recherche, recharger]);

  useEffect(() => {
    if (notes && noteSelectionneeId === null && notes.length > 0) {
      const noteDemandeeExiste =
        noteIdDepuisUrl && notes.some((note) => note.id === noteIdDepuisUrl);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoteSelectionneeId(
        noteDemandeeExiste ? noteIdDepuisUrl : notes[0].id,
      );
    }
  }, [notes, noteSelectionneeId, noteIdDepuisUrl]);

  function onCreated(note: NoteApi) {
    setNotes((actuelles) => (actuelles ? [note, ...actuelles] : [note]));
    setNoteSelectionneeId(note.id);
  }

  function onNoteChange(note: NoteApi) {
    setNotes((actuelles) =>
      actuelles
        ? actuelles.map((item) => (item.id === note.id ? note : item))
        : [note],
    );
  }

  const noteSelectionnee =
    notes?.find((note) => note.id === noteSelectionneeId) ?? null;

  return (
    <div>
      <NotesHeader
        recherche={recherche}
        onRechercheChange={setRecherche}
        onCreated={onCreated}
      />
      {erreur ? (
        <p className="rounded-card bg-card p-6 text-sm text-destructive shadow-card">
          {erreur}
        </p>
      ) : notes === null ? (
        <NotesSkeleton />
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
          <NotesListe
            notes={notes}
            noteSelectionneeId={noteSelectionneeId}
            onSelect={setNoteSelectionneeId}
          />
          {noteSelectionnee ? (
            <NoteOuverte note={noteSelectionnee} onChange={onNoteChange} />
          ) : (
            <div className="flex items-center justify-center rounded-card bg-card p-6 text-sm text-ink/50 shadow-card">
              Sélectionne une note pour l&apos;ouvrir.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
