import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Comment MyDay traite et protège tes données personnelles.",
  robots: { index: false, follow: false },
};

export default function ConfidentialitePage() {
  return (
    <LegalLayout titre="Politique de confidentialité" miseAJour="11 juillet 2026">
      <LegalSection titre="Notre approche">
        <p>
          MyDay est conçu pour réunir tes informations personnelles au même
          endroit — et pour les garder privées. Aucune donnée n'est vendue,
          partagée avec un tiers à des fins publicitaires, ni utilisée en dehors
          du service que tu utilises. Aucun traceur publicitaire n'est présent.
        </p>
      </LegalSection>

      <LegalSection titre="Données que nous traitons">
        <p>Selon ton usage, MyDay peut traiter :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Ton compte : nom, adresse e-mail, mot de passe (chiffré).</li>
          <li>Tes contenus : notes, tâches, événements que tu crées.</li>
          <li>
            Tes données Google, si tu connectes ton compte : événements de ton
            agenda et mails, utilisés uniquement pour t'afficher ton planning et
            trier tes messages importants.
          </li>
          <li>
            Des métadonnées d'usage techniques (ouvertures du tableau de bord,
            volume d'appels IA) pour suivre le bon fonctionnement — jamais le
            contenu de tes notes, mails ou tâches.
          </li>
        </ul>
      </LegalSection>

      <LegalSection titre="Connexion à Google (Gmail & Agenda)">
        <p>
          Si tu connectes ton compte Google, MyDay accède en lecture à ton
          agenda et à tes mails pour te les présenter et les prioriser. Les
          jetons d'accès Google sont <strong>chiffrés au repos</strong>. Tu peux
          révoquer cette connexion à tout moment depuis les réglages, ou depuis
          les paramètres de sécurité de ton compte Google.
        </p>
        <p>
          MyDay n'envoie de mail en ton nom qu'après une validation explicite de
          ta part, jamais automatiquement.
        </p>
      </LegalSection>

      <LegalSection titre="Assistant IA">
        <p>
          Certaines fonctions (tri des mails, brief quotidien, assistant
          conversationnel) utilisent un modèle d'IA (Anthropic Claude) pour
          analyser et résumer tes informations. Les données envoyées au modèle
          servent uniquement à produire ta réponse et ne sont pas utilisées pour
          entraîner le modèle.
        </p>
      </LegalSection>

      <LegalSection titre="Cookies">
        <p>
          MyDay n'utilise qu'un seul cookie, strictement nécessaire :
          le cookie de session qui te maintient connecté. Aucun cookie de mesure
          d'audience, publicitaire ou tiers n'est déposé. C'est pourquoi aucune
          bannière de consentement n'est nécessaire.
        </p>
      </LegalSection>

      <LegalSection titre="Cloisonnement et sécurité">
        <p>
          Chaque compte est strictement isolé au niveau de la base de données
          (Row-Level Security) : un utilisateur ne peut jamais accéder aux
          données d'un autre. L'administrateur ne voit jamais le contenu des
          autres comptes.
        </p>
      </LegalSection>

      <LegalSection titre="Tes droits">
        <p>
          Conformément au RGPD, tu disposes d'un droit d'accès, de rectification
          et de suppression de tes données. Tu peux supprimer tes contenus
          directement dans l'application, ou demander la suppression de ton
          compte en écrivant à{" "}
          <a href="mailto:yoann.varloud@gmail.com" className="text-accent underline underline-offset-2">
            yoann.varloud@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
