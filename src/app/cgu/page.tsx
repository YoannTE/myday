import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description: "Les conditions d'utilisation de l'application MyDay.",
  robots: { index: false, follow: false },
};

export default function CguPage() {
  return (
    <LegalLayout
      titre="Conditions générales d'utilisation"
      miseAJour="11 juillet 2026"
    >
      <LegalSection titre="Objet">
        <p>
          Les présentes conditions encadrent l'utilisation de MyDay, un cockpit
          personnel accessible sur invitation. En utilisant l'application, tu
          acceptes ces conditions.
        </p>
      </LegalSection>

      <LegalSection titre="Accès au service">
        <p>
          L'accès à MyDay se fait uniquement sur invitation. Ton compte est
          personnel : tu es responsable de la confidentialité de tes
          identifiants et des activités réalisées depuis ton compte.
        </p>
      </LegalSection>

      <LegalSection titre="Usage attendu">
        <p>
          MyDay est un outil d'organisation personnelle. Tu t'engages à
          l'utiliser dans un cadre légal et à ne pas y stocker de contenu
          illicite. Tu restes responsable des données que tu saisis ou connectes.
        </p>
      </LegalSection>

      <LegalSection titre="Disponibilité">
        <p>
          MyDay est fourni « en l'état », sans garantie de disponibilité
          permanente. Des interruptions peuvent survenir pour maintenance ou
          mise à jour. L'éditeur met en œuvre les moyens raisonnables pour
          assurer la continuité et la sécurité du service.
        </p>
      </LegalSection>

      <LegalSection titre="Assistant IA">
        <p>
          Les fonctions d'IA (tri, brief, assistant) produisent des suggestions
          et des synthèses qui peuvent contenir des imprécisions. Elles ne
          remplacent pas ta propre vérification, en particulier avant toute
          action importante (envoi de mail, décision).
        </p>
      </LegalSection>

      <LegalSection titre="Résiliation">
        <p>
          Tu peux cesser d'utiliser MyDay à tout moment et demander la
          suppression de ton compte. L'éditeur peut suspendre un compte en cas
          d'usage manifestement abusif ou illicite.
        </p>
      </LegalSection>

      <LegalSection titre="Données personnelles">
        <p>
          Le traitement de tes données est détaillé dans la{" "}
          <a href="/confidentialite" className="text-accent underline underline-offset-2">
            politique de confidentialité
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
