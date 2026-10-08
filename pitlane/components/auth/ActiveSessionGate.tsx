"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AuthTitle } from "@/components/auth/ui";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { getHomeForRole } from "@/lib/auth/home";
import { useNextPath } from "@/lib/auth/next-path";
import { getCurrentUser, getProfile, signOut } from "@/services/auth.service";
import type { UserRole } from "@/types";

type ActiveUser = { name: string; role: UserRole };

// Envuelve los formularios de login y registro. Si ya hay sesión, muestra un aviso en lugar del
// formulario. Solo revisa al montar: así un login exitoso en el propio formulario no lo reemplaza.
export function ActiveSessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const nextPath = useNextPath();
  // undefined = revisando; null = sin sesión.
  const [user, setUser] = useState<ActiveUser | null | undefined>(undefined);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const current = await getCurrentUser();
      if (!current) {
        if (!cancelled) setUser(null);
        return;
      }
      const profile = await getProfile(current.id);
      if (!cancelled)
        setUser({ name: profile?.fullName || current.email || "tu cuenta", role: profile?.role ?? "pilot" });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setUser(null);
    router.refresh();
  }

  if (user === undefined) {
    return (
      <div aria-busy="true">
        <p role="status" className="sr-only">
          Revisando tu sesión…
        </p>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-6 h-12" />
        <Skeleton className="mt-4 h-12" />
        <Skeleton className="mt-6 h-13" />
      </div>
    );
  }

  if (!user) return children;

  return (
    <div>
      <AuthTitle title="Sesión activa" />
      <Alert tone="info" role="status" title={`Ya iniciaste sesión como ${user.name}`}>
        Puedes continuar con esta cuenta o cerrar sesión para entrar con otra.
      </Alert>
      <div className="mt-6 grid gap-3">
        <Button size="lg" block onClick={() => router.push(nextPath ?? getHomeForRole(user.role))}>
          Continuar
        </Button>
        <Button variant="secondary" size="lg" block disabled={signingOut} onClick={handleSignOut}>
          {signingOut ? "Cerrando sesión…" : "Cerrar sesión y usar otra cuenta"}
        </Button>
      </div>
    </div>
  );
}
