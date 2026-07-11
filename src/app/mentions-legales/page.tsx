import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales de l'application MyDay.",
  robots: { index: false, follow: false },
};

export default function MentionsLegalesPage() {
  return (
    <LegalLayout titre="Mentions légales" miseAJour="11 juillet 2026">
      <LegalSection titre="Éditeur">
        <p>
          MyDay est une application personnelle et privée, éditée à titre
          individuel par Yoann Varloud.
        </p>
        <p>
          Contact : <a href="mailto:yoann.varloud@gmail.com" className="text-accent underline underline-offset-2">yoann.varloud@gmail.com</a>
        </p>
      </LegalSection>

      <LegalSection titre="Nature du service">
        <p>
          MyDay est un cockpit personnel unifié (planning, tâches, notes, mails
          importants et assistant IA), accessible uniquement sur invitation. Il
          ne s'agit pas d'un service commercial ouvert au public : l'accès est
          réservé à un cercle restreint d'utilisateurs invités.
        </p>
      </LegalSection>

      <LegalSection titre="Hébergement">
        <p>
          L'application et sa base de données sont hébergées sur une
          infrastructure privée dédiée. Les données restent cloisonnées par
          compte et ne sont jamais partagées entre utilisateurs.
        </p>
      </LegalSection>

      <LegalSection titre="Propriété intellectuelle">
        <p>
          L'ensemble des éléments de l'application (structure, textes, design)
          est la propriété de son éditeur. Les données que tu saisis ou connectes
          (agenda, mails, notes) restent ta propriété exclusive.
        </p>
      </LegalSection>

      <LegalSection titre="Données personnelles">
        <p>
          Le traitement de tes données personnelles est décrit dans la{" "}
          <a href="/confidentialite" className="text-accent underline underline-offset-2">
            politique de confidentialité
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
