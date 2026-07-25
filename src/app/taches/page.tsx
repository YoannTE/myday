import { redirect } from "next/navigation";

// Les tâches vivent désormais dans le cockpit unique (« / », Round 016) -
// cette ancienne route redirige pour ne laisser aucune page orpheline.
export default function TachesPage() {
  redirect("/");
}
