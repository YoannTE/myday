"use client";

import { useState } from "react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NoteCategory } from "@/components/notes/types";

/** Valeur sentinelle pour "aucune catégorie" (base-ui Select refuse une chaîne vide). */
export const SANS_CATEGORIE = "none";
const NOUVELLE_CATEGORIE = "__new__";

interface NoteCategorySelectProps {
  categories: NoteCategory[];
  value: string;
  onValueChange: (value: string) => void;
  onCategoryCreated: (categorie: NoteCategory) => void;
  disabled?: boolean;
}

/**
 * Sélecteur de catégorie de note avec création inline ("+ Nouvelle
 * catégorie") - miroir de `CategorySelect` (tâches, Round 012) appliqué aux
 * notes (Round 015) : la couleur est toujours auto-assignée par le backend
 * (palette tournante), l'utilisateur ne saisit que le nom.
 */
export function NoteCategorySelect({
  categories,
  value,
  onValueChange,
  onCategoryCreated,
  disabled,
}: NoteCategorySelectProps) {
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer() {
    const nomNettoye = nom.trim();
    if (!nomNettoye) {
      setErreur("Le nom de la catégorie est obligatoire.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const reponse = await apiCall<{ data: NoteCategory }>(
        "/api/note-categories",
        { method: "POST", body: { nom: nomNettoye } },
      );
      onCategoryCreated(reponse.data);
      onValueChange(reponse.data.id);
      setCreation(false);
      setNom("");
    } catch (erreurCreation) {
      setErreur(
        messageErreurApi(erreurCreation, "Impossible de créer la catégorie."),
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-2">
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(nouvelleValeur) => {
          if (!nouvelleValeur) return;
          if (nouvelleValeur === NOUVELLE_CATEGORIE) {
            setCreation(true);
            return;
          }
          onValueChange(nouvelleValeur);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Sans catégorie">
            {(valeurSelectionnee) => {
              const categorie = categories.find(
                (c) => c.id === valeurSelectionnee,
              );
              if (!categorie) return "Sans catégorie";
              return (
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: categorie.couleur }}
                    aria-hidden="true"
                  />
                  {categorie.nom}
                </span>
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SANS_CATEGORIE}>Sans catégorie</SelectItem>
          {categories.map((categorie) => (
            <SelectItem key={categorie.id} value={categorie.id}>
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: categorie.couleur }}
                  aria-hidden="true"
                />
                {categorie.nom}
              </span>
            </SelectItem>
          ))}
          <SelectItem value={NOUVELLE_CATEGORIE}>
            + Nouvelle catégorie
          </SelectItem>
        </SelectContent>
      </Select>
      {creation && (
        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-1">
            <Input
              autoFocus
              value={nom}
              placeholder="Nom de la catégorie"
              onChange={(evenement) => {
                setNom(evenement.target.value);
                if (erreur) setErreur(null);
              }}
              onKeyDown={(evenement) => {
                if (evenement.key === "Enter") {
                  evenement.preventDefault();
                  creer();
                }
              }}
            />
            {erreur && <p className="text-xs text-destructive">{erreur}</p>}
          </div>
          <Button type="button" size="sm" disabled={enCours} onClick={creer}>
            {enCours ? "Création..." : "Créer"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCreation(false);
              setNom("");
              setErreur(null);
            }}
          >
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}
