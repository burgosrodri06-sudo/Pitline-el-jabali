import type { ReactNode } from "react";
import type { UserRole } from "@/types";
import { canAccessOperation } from "@/lib/operations/rules";
import { RaceControlNav, type RaceControlItem } from "./RaceControlNav";

const roleLabels: Partial<Record<UserRole, string>> = {
  staff: "Staff de pista",
  payments: "Cobros",
  kre_admin: "Administración KRE",
  system_admin: "Administración del sistema",
};

// Mismos roles que requireAdmin(); aquí solo deciden qué enlaces se muestran.
const adminRoles: readonly UserRole[] = ["kre_admin", "system_admin"];

function itemsFor(role?: UserRole): RaceControlItem[] {
  if (!role) return [];
  return [
    ...(canAccessOperation(role, "track")
      ? ([
          { href: "/staff/check-in", label: "Check-in", icon: "scan" },
          { href: "/staff/venta", label: "Venta en pista", icon: "ticket" },
        ] as const)
      : []),
    ...(canAccessOperation(role, "payments") ? ([{ href: "/cobros/verificacion", label: "Cobros", icon: "card" }] as const) : []),
    ...(canAccessOperation(role, "reports") ? ([{ href: "/admin/reportes", label: "Reportes", icon: "chart" }] as const) : []),
    ...(adminRoles.includes(role)
      ? ([
          { href: "/admin/eventos", label: "Fechas y tandas", icon: "calendar" },
          { href: "/admin/paquetes", label: "Paquetes", icon: "package" },
        ] as const)
      : []),
  ];
}

// Shell de las pantallas operativas. Sin rol (loading/error) muestra solo la marca y los enlaces generales.
export function RaceControlShell({ role, children }: { role?: UserRole; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-ink lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <RaceControlNav items={itemsFor(role)} roleLabel={role ? roleLabels[role] : undefined} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
