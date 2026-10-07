import type { Metadata } from "next";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PerfilForm from "./perfil-form";

export const metadata: Metadata = { title: "Mi perfil | PitLane" };

// Carga los datos reales en el servidor y se los pasa al formulario.
export default async function PerfilPage() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  return (
    <PerfilForm
      userId={user.id}
      name={profile?.full_name ?? ""}
      email={user.email ?? ""}
      phone={profile?.phone ?? ""}
    />
  );
}
