"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, SendHorizontal } from "lucide-react";
import { deposerMessageAssistant } from "@/lib/assistant-handoff";
import { useSpeechDictee } from "@/lib/speech";
import { cn } from "@/lib/utils";

/**
 * Barre "Dis-moi quoi faire..." de la navbar (transposition de
 * `shared/components/navbar.html`) : saisie libre qui bascule vers
 * `/assistant` à la touche Entrée. Le message ne transite JAMAIS par l'URL
 * (PII, correction #14 round 008) - il est déposé en sessionStorage et lu
 * une seule fois au montage de `/assistant`. Raccourci global ⌘K / Ctrl+K :
 * focus la barre depuis n'importe quelle page protégée.
 */
export function NavbarAssistantBar() {
  const [valeur, setValeur] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { supported: dicteeSupportee, ecoute, basculer } = useSpeechDictee(
    (texte) => setValeur(texte),
  );

  useEffect(() => {
    function surRaccourci(evenement: KeyboardEvent) {
      const toucheK = evenement.key.toLowerCase() === "k";
      if ((evenement.metaKey || evenement.ctrlKey) && toucheK) {
        evenement.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", surRaccourci);
    return () => window.removeEventListener("keydown", surRaccourci);
  }, []);

  function envoyer() {
    const message = valeur.trim();
    if (!message) return;
    deposerMessageAssistant(message);
    setValeur("");
    router.push("/assistant");
  }

  return (
    <div className="flex items-center gap-2.5 rounded-full border border-accent/20 bg-card px-3 py-2 shadow-card">
      <span className="cta-gradient flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold text-white">
        →
      </span>
      <input
        ref={inputRef}
        type="text"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") envoyer();
        }}
        placeholder="Dis-moi quoi faire — une note, un rendez-vous, un mail..."
        className="min-w-0 flex-1 bg-transparent font-body text-sm text-ink placeholder:text-ink/40 focus:outline-none"
      />
      {dicteeSupportee && (
        <button
          type="button"
          onClick={basculer}
          aria-label={ecoute ? "Arrêter la dictée" : "Dicter au micro"}
          className={cn(
            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-ink/40 transition-colors hover:text-accent",
            ecoute && "pulse-now text-accent",
          )}
        >
          <Mic className="h-4 w-4" />
        </button>
      )}
      {valeur.trim() ? (
        <button
          type="button"
          onClick={envoyer}
          aria-label="Envoyer à l'assistant"
          className="cta-gradient flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white"
        >
          <SendHorizontal className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="hidden rounded-full bg-soft px-2 py-0.5 font-mono text-[10px] tracking-[.04em] text-ink/30 uppercase sm:inline">
          ⌘K
        </span>
      )}
    </div>
  );
}
