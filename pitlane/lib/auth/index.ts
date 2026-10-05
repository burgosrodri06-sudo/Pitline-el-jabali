import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Usamos getUser() (valida el token contra Supabase), nunca getSession().

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireVerifiedUser() {
  const user = await requireAuthenticatedUser();
  if (!user.email_confirmed_at) redirect("/verificar-correo");
  return user;
}

// Exige sesión y role = 'admin' en profiles; si no es admin, manda al inicio.
export async function requireAdmin() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");
  return { user, profile };
}
