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
