"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Sous-ensemble minimal de la Web Speech API (non standardisée dans
 * lib.dom.d.ts) - castée prudemment depuis `window`, sans nouvelle
 * dépendance.
 */
interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function obtenirConstructeur(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const fenetre = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return fenetre.SpeechRecognition ?? fenetre.webkitSpeechRecognition ?? null;
}

/**
 * Hook de dictée vocale via la reconnaissance vocale native du navigateur
 * (`SpeechRecognition`/`webkitSpeechRecognition`, sans dépendance) : au
 * démarrage de l'écoute, `onTranscript` est rappelé au fil de l'eau avec le
 * texte reconnu (résultats intermédiaires inclus). `supported` vaut `false`
 * si l'API est absente (ex. Firefox desktop) - le bouton micro ne doit alors
 * pas être affiché par l'appelant.
 */
export function useSpeechDictee(onTranscript: (texte: string) => void) {
  const [ecoute, setEcoute] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const supported = obtenirConstructeur() !== null;

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function demarrer() {
    const Constructeur = obtenirConstructeur();
    if (!Constructeur) return;
    const recognition = new Constructeur();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      onTranscript(transcript);
    };
    recognition.onerror = (event) => {
      setEcoute(false);
      if (event.error !== "no-speech" && event.error !== "aborted") {
        toast.error("La dictée n'est pas disponible.");
      }
    };
    recognition.onend = () => {
      setEcoute(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setEcoute(true);
  }

  function arreter() {
    recognitionRef.current?.stop();
    setEcoute(false);
  }

  function basculer() {
    if (ecoute) {
      arreter();
    } else {
      demarrer();
    }
  }

  return { supported, ecoute, basculer };
}
