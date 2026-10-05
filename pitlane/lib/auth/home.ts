import type { UserRole } from "@/types";

// Ruta de inicio de cada rol después del login.
// Archivo aparte (sin imports de servidor) para poder usarlo en Client Components.
const HOME_BY_ROLE: Record<UserRole, string> = {
  pilot: "/karting/kartingrentalexperience/reservar",
  staff: "/staff/check-in",
  payments: "/cobros/verificacion",
  kre_admin: "/admin/eventos",
  system_admin: "/admin/eventos",
};

export function getHomeForRole(role: UserRole) {
  return HOME_BY_ROLE[role] ?? HOME_BY_ROLE.pilot;
}
