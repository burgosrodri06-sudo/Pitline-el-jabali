import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

export { getHomeForRole } from "./home";

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
  if (!user) {
    // proxy.ts pone la ruta actual en x-pathname.
    const pathname = (await headers()).get("x-pathname") ?? "/";
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  return user;
}

export async function requireVerifiedUser() {
  const user = await requireAuthenticatedUser();
  if (!user.email_confirmed_at) redirect("/verificar-correo");
  return user;
}

// Exige sesión y uno de los roles; si no lo tiene, manda al inicio.
export async function requireRole(...roles: UserRole[]) {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single<{ full_name: string | null; role: UserRole }>();

  if (!profile || !roles.includes(profile.role)) redirect("/");
  return { user, profile };
}

export function requireAdmin() {
  return requireRole("kre_admin", "system_admin");
}
