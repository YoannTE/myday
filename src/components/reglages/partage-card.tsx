"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { apiCall } from "@/lib/api";
import { messageErreurApi } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PartageDemandeRow } from "@/components/reglages/partage-demande-row";
import { PartageContactRow } from "@/components/reglages/partage-contact-row";
import type { Contact } from "@/components/partage/types";

/**
 * Carte « Partage » de /reglages : gestion des contacts (envoi de demande,
 * acceptation/refus, retrait). Le partage d'un élément précis
 * (événement/tâche/note) se fait ensuite depuis sa propre page via
 * `PartageDialog`.
 */
export function PartageCard() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [email, setEmail] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function charger() {
    apiCall<{ data: Contact[] }>("/api/contacts")
      .then((reponse) => setContacts(reponse.data))
      .catch(() => setContacts((actuels) => actuels ?? []));
  }

  useEffect(() => {
    charger();
  }, []);

  async function envoyerDemande(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const nettoyee = email.trim();
    if (!nettoyee) return;
    setEnvoiEnCours(true);
    try {
      await apiCall("/api/contacts", {
        method: "POST",
        body: { email: nettoyee },
      });
      toast.success("Demande envoyée.");
      setEmail("");
      charger();
    } catch (erreur) {
      toast.error(
        messageErreurApi(erreur, "Impossible d'envoyer la demande."),
      );
    } finally {
      setEnvoiEnCours(false);
    }
  }

  const demandesRecues =
    contacts?.filter(
      (contact) => contact.direction === "recue" && contact.statut === "en_attente",
    ) ?? [];
  const demandesEnvoyees =
    contacts?.filter(
      (contact) =>
        contact.direction === "envoyee" && contact.statut === "en_attente",
    ) ?? [];
  const contactsAcceptes =
    contacts?.filter((contact) => contact.statut === "accepte") ?? [];

  return (
    <section className="fade-in delay-2 rounded-card bg-card p-6 shadow-card">
      <h2 className="mb-2 font-display font-bold tracking-[-0.02em] text-ink">
        Partage
      </h2>
      <p className="mb-4 font-body text-sm text-ink/50">
        Relie ton compte à un proche pour partager des événements, tâches ou
        notes précis, en lecture seule.
      </p>

      <form
        onSubmit={envoyerDemande}
        className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="email-contact">Adresse email</Label>
          <Input
            id="email-contact"
            type="email"
            placeholder="proche@exemple.fr"
            value={email}
            onChange={(evenement) => setEmail(evenement.target.value)}
            disabled={envoiEnCours}
          />
        </div>
        <Button
          type="submit"
          disabled={envoiEnCours || !email.trim()}
          className="flex-shrink-0"
        >
          {envoiEnCours ? "Envoi..." : "Envoyer une demande"}
        </Button>
      </form>

      {contacts === null ? (
        <p className="font-body text-sm text-ink/50">Chargement...</p>
      ) : (
        <div className="space-y-5">
          {demandesRecues.length > 0 && (
            <div className="space-y-2">
              <p className="label-mono text-ink/40">Demandes reçues</p>
              <div className="flex flex-col gap-2">
                {demandesRecues.map((contact) => (
                  <PartageDemandeRow
                    key={contact.id}
                    contact={contact}
                    onChanged={charger}
                  />
                ))}
              </div>
            </div>
          )}
          {demandesEnvoyees.length > 0 && (
            <div className="space-y-2">
              <p className="label-mono text-ink/40">Demandes envoyées</p>
              <div className="flex flex-col gap-2">
                {demandesEnvoyees.map((contact) => (
                  <PartageDemandeRow
                    key={contact.id}
                    contact={contact}
                    onChanged={charger}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <p className="label-mono text-ink/40">Contacts</p>
            {contactsAcceptes.length === 0 ? (
              <p className="font-body text-sm text-ink/50">
                Aucun contact relié pour l&apos;instant.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {contactsAcceptes.map((contact) => (
                  <PartageContactRow
                    key={contact.id}
                    contact={contact}
                    onChanged={charger}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
