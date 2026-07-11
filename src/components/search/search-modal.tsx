"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchResultGroup } from "@/components/search/search-result-group";
import { SearchResultItem } from "@/components/search/search-result-item";
import { RESULTATS_VIDES, type SearchResults } from "@/components/search/types";

const DELAI_DEBOUNCE_MS = 250;

/**
 * Recherche globale (Round 009) - icône loupe dans la navbar + raccourci
 * global ⌘/ (Ctrl+/). Distinct de ⌘K (assistant, R008) : décision figée
 * dans le plan pour éviter tout conflit de raccourci. Résultats groupés
 * (notes/tâches/événements/mails) via `GET /api/search?q=`, debounce 250ms.
 */
export function SearchModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState<SearchResults>(RESULTATS_VIDES);
  const [recherche, setRecherche] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    function surRaccourci(evenement: KeyboardEvent) {
      if ((evenement.metaKey || evenement.ctrlKey) && evenement.key === "/") {
        evenement.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", surRaccourci);
    return () => window.removeEventListener("keydown", surRaccourci);
  }, []);

  useEffect(() => {
    if (!open) return;
    const requeteNettoyee = requete.trim();
    if (!requeteNettoyee) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResultats(RESULTATS_VIDES);
      setErreur(null);
      setRecherche(false);
      return;
    }

    setRecherche(true);
    const controleur = new AbortController();
    const identifiant = setTimeout(() => {
      apiCall<{ data: SearchResults }>(
        `/api/search?q=${encodeURIComponent(requeteNettoyee)}`,
        { signal: controleur.signal },
      )
        .then((reponse) => {
          setResultats(reponse.data);
          setErreur(null);
        })
        .catch((erreurRecherche) => {
          if (controleur.signal.aborted) return;
          setErreur(
            messageErreurApi(erreurRecherche, "Impossible d'effectuer la recherche."),
          );
        })
        .finally(() => setRecherche(false));
    }, DELAI_DEBOUNCE_MS);

    return () => {
      clearTimeout(identifiant);
      controleur.abort();
    };
  }, [requete, open]);

  function allerVers(chemin: string) {
    setOpen(false);
    setRequete("");
    router.push(chemin);
  }

  const aTapeQuelqueChose = requete.trim().length > 0;
  const aucunResultat =
    !recherche &&
    aTapeQuelqueChose &&
    resultats.notes.length === 0 &&
    resultats.taches.length === 0 &&
    resultats.events.length === 0 &&
    resultats.mails.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Rechercher"
        className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-soft hover:text-ink"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      <Dialog
        open={open}
        onOpenChange={(valeur) => {
          setOpen(valeur);
          if (!valeur) setRequete("");
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Recherche globale</DialogTitle>
          <DialogDescription className="sr-only">
            Recherche dans tes notes, tâches, événements et mails.
          </DialogDescription>

          <div className="flex items-center gap-2.5 border-b border-ink/10 px-4 py-3">
            <Search className="h-4 w-4 flex-shrink-0 text-ink/40" />
            <Input
              autoFocus
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              placeholder="Rechercher une note, une tâche, un mail, un événement..."
              className="h-auto border-none bg-transparent p-0 font-body text-sm shadow-none focus-visible:ring-0"
            />
            <span className="hidden flex-shrink-0 rounded-full bg-soft px-2 py-0.5 font-mono text-[10px] tracking-[.04em] text-ink/30 uppercase sm:inline">
              ⌘/
            </span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-3">
            {recherche && (
              <div className="flex flex-col gap-2 p-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {!recherche && erreur && (
              <p className="p-2 font-body text-sm text-ink/50">{erreur}</p>
            )}

            {!recherche && !erreur && !aTapeQuelqueChose && (
              <p className="p-2 font-body text-sm text-ink/40">
                Cherche dans tes notes, tâches, événements et mails.
              </p>
            )}

            {!recherche && !erreur && aucunResultat && (
              <p className="p-2 font-body text-sm text-ink/40">
                Aucun résultat pour « {requete.trim()} ».
              </p>
            )}

            {!recherche && !erreur && !aucunResultat && aTapeQuelqueChose && (
              <>
                <SearchResultGroup titre="Notes" count={resultats.notes.length}>
                  {resultats.notes.map((note) => (
                    <SearchResultItem
                      key={note.id}
                      titre={note.titre}
                      sousTitre={note.contenu}
                      onSelect={() => allerVers("/notes")}
                    />
                  ))}
                </SearchResultGroup>
                <SearchResultGroup titre="Tâches" count={resultats.taches.length}>
                  {resultats.taches.map((tache) => (
                    <SearchResultItem
                      key={tache.id}
                      titre={tache.titre}
                      sousTitre={tache.description}
                      onSelect={() => allerVers("/taches")}
                    />
                  ))}
                </SearchResultGroup>
                <SearchResultGroup
                  titre="Événements"
                  count={resultats.events.length}
                >
                  {resultats.events.map((evenement) => (
                    <SearchResultItem
                      key={evenement.id}
                      titre={evenement.titre}
                      sousTitre={evenement.lieu}
                      onSelect={() => allerVers("/planning")}
                    />
                  ))}
                </SearchResultGroup>
                <SearchResultGroup titre="Mails" count={resultats.mails.length}>
                  {resultats.mails.map((mail) => (
                    <SearchResultItem
                      key={mail.id}
                      titre={mail.sujet ?? mail.expediteur}
                      sousTitre={mail.extrait ?? mail.expediteur}
                      onSelect={() => allerVers("/mails")}
                    />
                  ))}
                </SearchResultGroup>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
