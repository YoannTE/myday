import { redirect } from "next/navigation";

// Le cockpit vit à la racine de l'app (« / ») — cette ancienne route
// du starterkit redirige pour ne laisser aucune page orpheline.
export default function DashboardPage() {
  redirect("/");
}
