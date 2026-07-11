"use client";

import { useState } from "react";

const SUGGESTIONS = [
  "Ajoute une tâche",
  "Cale un rendez-vous",
  "Quelles sont mes priorités ?",
  "Prends une note",
];

interface ComposerProps {
  disabled: boolean;
  onEnvoyer: (message: string) => void;
}

/**
 * Barre de saisie fixe en bas d'écran (transposition de la V0
 * "Barre + suggestions" de `assistant.html`) : chips de suggestions qui
 * pré-remplissent le champ, puis envoi au clic ou à la touche Entrée.
 */
export function Composer({ disabled, onEnvoyer }: ComposerProps) {
  const [valeur, setValeur] = useState("");

  function envoyer() {
    const message = valeur.trim();
    if (!message || disabled) return;
    onEnvoyer(message);
    setValeur("");
  }

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-ink/5 bg-bg/95 py-4">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setValeur(suggestion)}
              className="rounded-full bg-soft px-3 py-1.5 font-body text-xs text-ink/60 hover:text-accent"
            >
              « {suggestion} »
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-full border border-accent/20 bg-card px-4 py-3 shadow-card">
          <span className="cta-gradient flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold text-white">
            →
          </span>
          <input
            type="text"
            value={valeur}
            disabled={disabled}
            onChange={(e) => setValeur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") envoyer();
            }}
            placeholder="Dis-moi quoi faire..."
            className="min-w-0 flex-1 bg-transparent font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none"
          />
          <button
            type="button"
            disabled={disabled || !valeur.trim()}
            onClick={envoyer}
            className="font-mono text-[10px] tracking-[.04em] text-ink/30 uppercase disabled:opacity-40"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
