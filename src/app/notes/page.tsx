import { redirect } from "next/navigation";

// Les notes vivent désormais dans le cockpit unique (« / », Round 016) -
// cette ancienne route redirige pour ne laisser aucune page orpheline.
export default function NotesPage() {
  redirect("/");
}
