import { redirect } from "next/navigation";

// Gmail et le tri des mails sont retirés de l'interface (Round 016) - cette
// ancienne route redirige pour ne laisser aucune page orpheline.
export default function MailsPage() {
  redirect("/");
}
