import { redirect } from "next/navigation";

// /admin no tiene contenido propio: la primera sección es eventos.
export default function AdminPage() {
  redirect("/admin/eventos");
}
