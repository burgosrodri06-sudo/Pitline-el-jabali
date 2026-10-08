import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";
import { RaceControlShell } from "./RaceControlShell";

// Layout de /staff, /cobros y /admin. Lee el rol solo para decidir qué enlaces mostrar;
// la autorización sigue en proxy.ts y en el requireRole/requireAdmin de cada página.
export default async function RaceControlLayout({ children }: { children: ReactNode }) {
  let role: UserRole | undefined;
  const user = await getCurrentUser();
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: UserRole }>();
    role = data?.role;
  }
  return <RaceControlShell role={role}>{children}</RaceControlShell>;
}
