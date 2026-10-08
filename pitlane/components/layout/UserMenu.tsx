"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getHomeForRole } from "@/lib/auth/home";
import { safeNextPath, withNext } from "@/lib/auth/next-path";
import { getCurrentUser, getProfile, onAuthChange, signOut } from "@/services/auth.service";
import type { UserRole } from "@/types";

type MenuUser = { name: string; role: UserRole };

// Menú de usuario para el header. Se usa así: <UserMenu />
export default function UserMenu() {
  const router = useRouter();
  // undefined = cargando (no se muestra nada); null = sin sesión.
  const [user, setUser] = useState<MenuUser | null | undefined>(undefined);

  useEffect(() => {
    async function load() {
      const current = await getCurrentUser();
      if (!current) {
        setUser(null);
        return;
      }
      const profile = await getProfile(current.id);
      setUser({ name: profile?.fullName || current.email || "Mi cuenta", role: profile?.role ?? "pilot" });
    }
    return onAuthChange(load);
  }, []);

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  if (user === undefined) return null;

  const linkClass = "text-sm font-medium text-[#F4F4F4] hover:text-[#C8102E]";

  if (!user) {
    return (
      <Suspense fallback={null}>
        <GuestLinks linkClass={linkClass} />
      </Suspense>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="max-w-48 truncate text-sm text-[#A3A3A3]">{user.name}</span>
      <Link href="/perfil" className={linkClass}>
        Mi perfil
      </Link>
      <Link href="/mis-reservas" className={linkClass}>Mis reservas</Link>
      {user.role !== "pilot" && (
        <Link href={getHomeForRole(user.role)} className={linkClass}>
          Mi panel
        </Link>
      )}
      <button type="button" onClick={handleSignOut} className={linkClass}>
        Cerrar sesión
      </button>
    </div>
  );
}

// Enlaces sin sesión. Conservan el ?next= de la página actual (p. ej. al pasar de registro a login).
// useSearchParams (y no window.location) para que se actualice al navegar sin recargar el layout.
function GuestLinks({ linkClass }: { linkClass: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const nextPath = safeNextPath(params.get("next")) ?? (pathname === '/reservar'
    ? safeNextPath(`${pathname}${params.size ? `?${params}` : ''}`) : null);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Link href={withNext("/login", nextPath)} className={linkClass}>
        Iniciar sesión
      </Link>
      <Link
        href={withNext("/registro", nextPath)}
        className="rounded-md bg-[#C8102E] px-3 py-2 text-sm font-semibold text-white hover:bg-[#A50D26]"
      >
        Crear cuenta
      </Link>
    </div>
  );
}
