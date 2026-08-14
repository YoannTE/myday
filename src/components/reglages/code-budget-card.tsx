"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { memoriserJeton } from "@/lib/budget/acces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const CHIFFRES_SEULS = /[^0-9]/g;

/**
 * Carte « Code du budget » de /reglages : change le code à 4 chiffres qui
 * protège la section Budget. L'ancien code est exigé — sans lui, n'importe
 * quelle session ouverte pourrait redéfinir le code et vider le verrou de son
 * sens.
 *
 * Tant qu'aucun code n'existe, la carte renvoie vers la page Budget plutôt que
 * de proposer une seconde façon de le créer : un seul chemin de création,
 * c'est un chemin de moins à sécuriser.
 */
export function CodeBudgetCard() {
  const [defini, setDefini] = useState<boolean | null>(null);
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    apiCall<{ data: { code_defini: boolean } }>("/api/budget/acces")
      .then((reponse) => {
        if (!annule) setDefini(reponse.data.code_defini);
      })
      .catch(() => {
        if (!annule) setDefini(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  async function enregistrer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (nouveau.length !== 4) {
      toast.error("Le nouveau code doit contenir 4 chiffres.");
      return;
    }
    if (nouveau !== confirmation) {
      toast.error("Les deux nouveaux codes ne correspondent pas.");
      return;
    }
    setEnCours(true);
    try {
      const reponse = await apiCall<{
        data: { jeton: string; expire_a: string };
      }>("/api/budget/acces/modifier", {
        method: "POST",
        body: { code_actuel: actuel, nouveau_code: nouveau },
      });
      // Le changement rouvre l'accès sur cet appareil : inutile de retaper le
      // code qu'on vient de choisir.
      memoriserJeton(reponse.data.jeton, reponse.data.expire_a);
      setActuel("");
      setNouveau("");
      setConfirmation("");
      toast.success("Code du budget modifié");
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "Impossible de modifier le code."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="fade-in delay-2 rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-1 flex items-center gap-2 font-display font-bold tracking-[-0.02em] text-ink">
        <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
        Code du budget
      </h2>
      <p className="mb-5 font-body text-sm text-ink/50">
        Les quatre chiffres qui protègent ta section Budget, demandés en plus de
        ta connexion MyDay. L&apos;accès reste ouvert 12 heures sur chaque
        appareil.
      </p>

      {defini === null ? (
        <Skeleton className="h-24 w-full" />
      ) : !defini ? (
        <p className="font-body text-sm text-ink/60">
          Aucun code n&apos;est encore défini. Ouvre la page{" "}
          <a href="/budget" className="font-bold text-accent hover:underline">
            Budget
          </a>{" "}
          pour le choisir.
        </p>
      ) : (
        <form onSubmit={enregistrer} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Champ
              id="code-actuel"
              libelle="Code actuel"
              valeur={actuel}
              onChange={setActuel}
            />
            <Champ
              id="code-nouveau"
              libelle="Nouveau code"
              valeur={nouveau}
              onChange={setNouveau}
            />
            <Champ
              id="code-confirmation"
              libelle="Confirmer"
              valeur={confirmation}
              onChange={setConfirmation}
            />
          </div>
          <Button type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Modifier le code"}
          </Button>
        </form>
      )}
    </section>
  );
}

function Champ({
  id,
  libelle,
  valeur,
  onChange,
}: {
  id: string;
  libelle: string;
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{libelle}</Label>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={valeur}
        onChange={(evenement) =>
          onChange(evenement.target.value.replace(CHIFFRES_SEULS, "").slice(0, 4))
        }
        placeholder="••••"
        className="tracking-[0.4em]"
      />
    </div>
  );
}
