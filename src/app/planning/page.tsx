import { redirect } from "next/navigation";

// Le planning vit désormais dans le cockpit unique (« / », Round 016) -
// cette ancienne route redirige pour ne laisser aucune page orpheline.
export default function PlanningPage() {
  redirect("/");
}
