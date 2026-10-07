"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getHomeForRole } from "@/lib/auth/home";
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
      <div className="flex items-center gap-4">
        <Link href="/login" className={linkClass}>
          Iniciar sesión
        </Link>
        <Link
          href="/registro"
          className="rounded-md bg-[#C8102E] px-3 py-2 text-sm font-semibold text-white hover:bg-[#A50D26]"
        >
          Crear cuenta
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-[#A3A3A3]">{user.name}</span>
      <Link href="/perfil" className={linkClass}>
        Mi perfil
      </Link>
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
