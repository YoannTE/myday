"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Delete, Lock, ShieldCheck } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { memoriserJeton } from "@/lib/budget/acces";
import { cn } from "@/lib/utils";

const LONGUEUR = 4;
const TOUCHES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "",
  "0",
  "retour",
];

interface EtatAcces {
  code_defini: boolean;
  bloque_jusqua: string | null;
}

interface VerrouBudgetProps {
  etat: EtatAcces;
  onOuvert: () => void;
  /**
   * Écoute des chiffres au clavier. Vrai sur la page Budget, où il n'y a rien
   * d'autre à taper. Faux dans le cockpit : le pavé y voisine avec la barre
   * assistant et les champs des autres sections, et un chiffre frappé au
   * hasard consommerait un des cinq essais autorisés.
   */
  captureClavier?: boolean;
}

type Etape = "saisie" | "confirmation";

/**
 * Écran de déverrouillage du budget : quatre chiffres, saisis au clavier ou
 * sur le pavé tactile. Le budget est une section privée — le code est demandé
 * même quand la session MyDay est déjà ouverte, et redemandé toutes les 12 h
 * sur chaque appareil.
 *
 * Au tout premier accès, `code_defini` est faux : on passe par une double
 * saisie (choix puis confirmation) avant de poser le code.
 */
export function VerrouBudget({
  etat,
  onOuvert,
  captureClavier = false,
}: VerrouBudgetProps) {
  const creation = !etat.code_defini;
  const [code, setCode] = useState("");
  const [premier, setPremier] = useState("");
  const [etape, setEtape] = useState<Etape>("saisie");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const carteRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<HTMLDivElement>(null);

  // Blocage anti-force brute posé par le serveur : le clavier reste inerte
  // jusqu'à l'échéance, puis se rouvre tout seul (le serveur reste l'autorité,
  // c'est lui qui renvoie 429 tant que le délai court).
  const [bloque, setBloque] = useState(false);
  useEffect(() => {
    const jusqua = etat.bloque_jusqua
      ? new Date(etat.bloque_jusqua).getTime()
      : 0;
    const restant = jusqua - Date.now();
    if (restant <= 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBloque(true);
    const minuterie = setTimeout(() => setBloque(false), restant);
    return () => clearTimeout(minuterie);
  }, [etat.bloque_jusqua]);

  const secouer = useCallback(() => {
    if (!carteRef.current) return;
    gsap.fromTo(
      carteRef.current,
      { x: -9 },
      { x: 0, duration: 0.55, ease: "elastic.out(1.1, 0.35)" },
    );
  }, []);

  const valider = useCallback(
    async (saisi: string) => {
      setEnCours(true);
      setErreur(null);
      try {
        if (creation && etape === "saisie") {
          setPremier(saisi);
          setEtape("confirmation");
          setCode("");
          return;
        }
        if (creation) {
          if (saisi !== premier) {
            setErreur("Les deux codes ne correspondent pas. On recommence.");
            setPremier("");
            setEtape("saisie");
            setCode("");
            secouer();
            return;
          }
          const reponse = await apiCall<{
            data: { jeton: string; expire_a: string };
          }>("/api/budget/acces/definir", {
            method: "POST",
            body: { code: saisi },
          });
          memoriserJeton(reponse.data.jeton, reponse.data.expire_a);
          onOuvert();
          return;
        }

        const reponse = await apiCall<{
          data: { jeton: string; expire_a: string };
        }>("/api/budget/acces/ouvrir", {
          method: "POST",
          body: { code: saisi },
        });
        memoriserJeton(reponse.data.jeton, reponse.data.expire_a);
        onOuvert();
      } catch (echec) {
        setErreur(messageErreurApi(echec, "Impossible de vérifier le code."));
        setCode("");
        secouer();
      } finally {
        setEnCours(false);
      }
    },
    [creation, etape, onOuvert, premier, secouer],
  );

  const ajouter = useCallback(
    (chiffre: string) => {
      if (enCours || bloque) return;
      setCode((actuel) => {
        if (actuel.length >= LONGUEUR) return actuel;
        const suivant = actuel + chiffre;
        if (suivant.length === LONGUEUR) {
          // Laisse le 4e point s'afficher avant de partir en vérification.
          setTimeout(() => valider(suivant), 140);
        }
        return suivant;
      });
    },
    [bloque, enCours, valider],
  );

  const effacer = useCallback(() => {
    if (enCours) return;
    setCode((actuel) => actuel.slice(0, -1));
  }, [enCours]);

  // Saisie au clavier : sur ordinateur, personne n'a envie de viser un pavé
  // tactile à la souris. Les frappes destinées à un champ de saisie sont
  // ignorées, sans quoi taper « 4 » dans une recherche remplirait le code.
  useEffect(() => {
    if (!captureClavier) return;
    function auClavier(evenement: KeyboardEvent) {
      // `target` n'est pas toujours un élément (un événement émis sur `window`
      // se cible lui-même) : sans ce test, `closest` ferait tomber le handler.
      const cible = evenement.target;
      if (
        cible instanceof Element &&
        cible.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (/^[0-9]$/.test(evenement.key)) {
        evenement.preventDefault();
        ajouter(evenement.key);
      } else if (evenement.key === "Backspace") {
        evenement.preventDefault();
        effacer();
      }
    }
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, [ajouter, captureClavier, effacer]);

  // Le point qui vient d'être rempli « tombe » en place : le retour visuel
  // remplace le chiffre qu'on ne montre pas.
  useEffect(() => {
    const points = pointsRef.current;
    if (!points || code.length === 0) return;
    const dernier = points.children[code.length - 1];
    if (dernier) {
      gsap.fromTo(
        dernier,
        { scale: 0.4, opacity: 0.4 },
        { scale: 1, opacity: 1, duration: 0.28, ease: "back.out(3)" },
      );
    }
  }, [code]);

  const titre = creation
    ? etape === "saisie"
      ? "Choisis ton code"
      : "Confirme ton code"
    : "Budget verrouillé";

  const explication = creation
    ? etape === "saisie"
      ? "Quatre chiffres pour protéger ton budget. Il te sera demandé à chaque ouverture, même connecté à MyDay."
      : "Saisis-le une seconde fois pour être sûr."
    : "Saisis ton code à 4 chiffres. Il reste valable 12 heures sur cet appareil.";

  // Carte autonome, sans conteneur de centrage : la page Budget la centre dans
  // sa hauteur, le cockpit la pose telle quelle dans sa section.
  return (
    <div
      ref={carteRef}
      className="fade-in mx-auto w-full max-w-sm rounded-card bg-card p-7 text-center shadow-card"
    >
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-soft text-accent">
        {creation ? (
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Lock className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      {/* Volontairement un paragraphe et non un titre : la carte vit sous le
          h1 de la page Budget comme sous le bandeau d'une section du cockpit,
          et n'a pas de niveau de titre stable à revendiquer. */}
      <p className="font-display text-lg font-extrabold tracking-[-0.02em] text-ink">
        {titre}
      </p>
      <p className="mx-auto mt-2 max-w-[34ch] font-body text-sm text-ink/50">
        {explication}
      </p>

      <div
        ref={pointsRef}
        className="mt-7 flex justify-center gap-3"
        role="status"
        aria-label={`${code.length} chiffre sur ${LONGUEUR} saisi`}
      >
        {Array.from({ length: LONGUEUR }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-3.5 w-3.5 rounded-full transition-colors",
              index < code.length ? "bg-accent" : "bg-ink/15",
            )}
          />
        ))}
      </div>

      <p
        className={cn(
          "mt-4 min-h-[2.5rem] font-body text-sm",
          erreur || bloque ? "text-destructive" : "text-transparent",
        )}
        role={erreur || bloque ? "alert" : undefined}
      >
        {bloque
          ? "Trop d'essais. Reviens dans quelques minutes."
          : (erreur ?? "—")}
      </p>

      <div className="mt-2 grid grid-cols-3 gap-2.5">
        {TOUCHES.map((touche, index) => {
          if (touche === "") return <span key={`vide-${index}`} />;
          const estRetour = touche === "retour";
          return (
            <button
              key={touche}
              type="button"
              disabled={enCours || bloque}
              onClick={() => (estRetour ? effacer() : ajouter(touche))}
              aria-label={estRetour ? "Effacer le dernier chiffre" : touche}
              className={cn(
                "focus-ring flex h-14 items-center justify-center rounded-inner font-display text-xl font-bold text-ink transition-colors",
                "bg-soft hover:bg-accent/10 active:bg-accent/15",
                "disabled:opacity-40",
              )}
            >
              {estRetour ? (
                <Delete className="h-5 w-5 text-ink/60" aria-hidden="true" />
              ) : (
                touche
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
