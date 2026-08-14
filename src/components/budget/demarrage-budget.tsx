"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Sparkles } from "lucide-react";
import { messageErreurApi } from "@/lib/api-error-message";
import { apiBudget } from "@/lib/budget/acces";
import { Button } from "@/components/ui/button";

// Reprise du classeur « Budget MYE.xlsx » (février 2025). Trois écarts assumés
// par rapport au fichier d'origine, parce que le fichier mélangeait deux
// notions :
//   - « Commissions », « Noël » et « Anniversaire » étaient comptés en capital ;
//     ce sont des rentrées À VENIR, pas de l'argent détenu. Le capital réel au
//     01.07.2024 était de 8 100 €, pas 39 600 €.
//   - Le « Crédit conso » figurait en dépense : il porte une note pour être
//     requalifié (financement reçu ou remboursement ?).
//   - Les projets de la feuille Dépenses n'avaient pas de date : ils arrivent
//     sans échéance, à caler.

const RECURRENTS = [
  ["Salaire Yoann", "Salaire", 2750, "entree"],
  ["Salaire Manon", "Salaire", 1600, "entree"],
  ["Primes & bonus Yoann", "Primes & commissions", 2000, "entree"],
  ["Prêt immobilier", "Logement", 1700, "sortie"],
  ["Courses", "Alimentation", 1000, "sortie"],
  ["Lou", "Enfants", 700, "sortie"],
  ["Nounou Eden", "Enfants", 600, "sortie"],
  ["Prêt automobile", "Transport", 550, "sortie"],
  ["Électricité", "Logement", 200, "sortie"],
  ["Divers 1", "Autre", 200, "sortie"],
  ["Divers 2", "Autre", 190, "sortie"],
  ["Charges de copropriété", "Logement", 150, "sortie"],
  ["Assurance automobile", "Transport", 150, "sortie"],
  ["Téléphones mobiles", "Abonnements", 60, "sortie"],
  ["TV / Internet", "Abonnements", 50, "sortie"],
  ["Keiris", "Assurances", 42, "sortie"],
  ["Aviva", "Assurances", 25, "sortie"],
  ["Assurance habitation", "Assurances", 20, "sortie"],
  ["CFDT", "Abonnements", 20, "sortie"],
  ["Spotify + Apple", "Abonnements", 20, "sortie"],
] as const;

const PREVISIONS = [
  ["Commissions août", "Primes & commissions", 15000, "entree", "2026-08", null],
  ["Commissions novembre", "Primes & commissions", 10000, "entree", "2026-11", null],
  ["Noël", "Aides", 1000, "entree", "2026-12", null],
  ["Commissions février", "Primes & commissions", 5000, "entree", "2027-02", null],
  ["Anniversaire Yoann", "Aides", 500, "entree", null, null],
  ["Jardin", "Logement", 3500, "sortie", null, null],
  ["Table à manger + chaises", "Équipement", 1500, "sortie", null, null],
  ["Salon de jardin + table", "Équipement", 1300, "sortie", null, null],
  ["Sèche-linge", "Équipement", 600, "sortie", null, null],
  ["Armoire Eden", "Équipement", 600, "sortie", null, null],
  ["Congélateur", "Équipement", 500, "sortie", null, null],
  ["Portes de cuisine", "Logement", 300, "sortie", null, null],
  ["Tables de chevet", "Équipement", 200, "sortie", null, null],
  ["Parasol", "Équipement", 200, "sortie", null, null],
  ["Serviettes", "Équipement", 150, "sortie", null, null],
  ["Bureau Yoann", "Équipement", 120, "sortie", null, null],
  ["Vaisselle", "Équipement", 100, "sortie", null, null],
  ["Étendoir", "Équipement", 100, "sortie", null, null],
  ["Cadre TV", "Équipement", 80, "sortie", null, null],
  [
    "Crédit conso",
    "Autre",
    20000,
    "sortie",
    null,
    "Repris du classeur Budget MYE — à requalifier : financement reçu ou remboursement ?",
  ],
] as const;

const COMPTES = [
  ["Compte Yoann", 2800, "2024-07-01"],
  ["Compte commun", 3300, "2024-07-01"],
  ["Compte Manon", 2000, "2024-07-01"],
] as const;

/**
 * Premier écran quand le budget est vide : soit on repart du classeur Budget
 * MYE, soit on commence de zéro. Rien n'est créé sans un clic explicite — un
 * budget pré-rempli imposé serait faux pour tout autre utilisateur de MyDay.
 */
export function DemarrageBudget({
  onPret,
  onIgnorer,
}: {
  onPret: () => Promise<void>;
  onIgnorer: () => void;
}) {
  const [enCours, setEnCours] = useState(false);

  async function importer() {
    setEnCours(true);
    try {
      // Séquentiel plutôt qu'en parallèle : une quarantaine de lignes, et le
      // pool de connexions du backend est dimensionné pour de l'usage humain.
      for (const [libelle, categorie, montant, sens] of RECURRENTS) {
        await apiBudget("/api/budget/recurrents", {
          method: "POST",
          body: { libelle, categorie, montant, sens },
        });
      }
      for (const [libelle, categorie, montant, sens, echeance, note] of PREVISIONS) {
        await apiBudget("/api/budget/previsions", {
          method: "POST",
          body: { libelle, categorie, montant, sens, echeance, note },
        });
      }
      for (const [libelle, montant, date_releve] of COMPTES) {
        await apiBudget("/api/budget/comptes", {
          method: "POST",
          body: { libelle, montant, date_releve },
        });
      }
      toast.success("Budget MYE importé");
      await onPret();
    } catch (erreur) {
      toast.error(messageErreurApi(erreur, "L'import n'a pas pu aller au bout."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="fade-in mx-auto max-w-xl rounded-card bg-card p-7 text-center shadow-card">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-soft text-accent">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-ink">
        Ton budget est vide
      </h2>
      <p className="mx-auto mt-2 max-w-[46ch] font-body text-sm text-ink/55">
        Tu peux repartir du classeur <strong>Budget MYE</strong> — revenus,
        charges mensuelles, projets et comptes déjà saisis — ou commencer de
        zéro et tout ajouter toi-même.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={importer} disabled={enCours}>
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          {enCours ? "Import en cours…" : "Partir du budget MYE"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onIgnorer}
          disabled={enCours}
        >
          Commencer de zéro
        </Button>
      </div>
    </div>
  );
}
