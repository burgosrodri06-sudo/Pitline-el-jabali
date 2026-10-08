"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import NavLink from "@/components/layout/NavLink";
import { headerLinkClass } from "@/components/layout/nav-styles";
import { buttonClass } from "@/components/ui/button";
import { Close, Menu } from "@/components/ui/icons";
import { getHomeForRole } from "@/lib/auth/home";
import { safeNextPath, withNext } from "@/lib/auth/next-path";
import { getCurrentUser, getProfile, onAuthChange, signOut } from "@/services/auth.service";
import type { UserRole } from "@/types";

type MenuUser = { name: string; role: UserRole };

const drawerLinkClass =
  "flex min-h-12 items-center border-b border-line px-1 text-base font-medium text-ink transition-colors hover:text-brand-text " +
  "aria-[current=page]:text-brand-text";

// Menú de usuario para el header. Se usa así: <UserMenu />
export default function UserMenu() {
  const router = useRouter();
  // undefined = cargando (no se muestra nada); null = sin sesión.
  const [user, setUser] = useState<MenuUser | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

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

  // Escape cierra el menú móvil y devuelve el foco al botón.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  }

  if (user === undefined) return null;

  if (!user) {
    return (
      <Suspense fallback={null}>
        <GuestLinks />
      </Suspense>
    );
  }

  const close = () => setOpen(false);

  return (
    <>
      {/* Escritorio: todo en línea. Un nombre largo se corta con "...". */}
      <div className="hidden min-w-0 items-center gap-6 md:flex">
        <NavLink href="/mis-reservas" className={headerLinkClass}>
          Mis reservas
        </NavLink>
        {user.role !== "pilot" && (
          <Link href={getHomeForRole(user.role)} className={headerLinkClass}>
            Mi panel
          </Link>
        )}
        <span className="h-5 w-px bg-line" aria-hidden="true" />
        <NavLink href="/perfil" className={`${headerLinkClass} max-w-48`} title="Mi perfil">
          <span className="truncate">{user.name}</span>
          <span className="sr-only"> · Mi perfil</span>
        </NavLink>
        <button type="button" onClick={handleSignOut} className={headerLinkClass}>
          Cerrar sesión
        </button>
      </div>

      {/* Móvil: botón de menú con panel desplegable. */}
      <button
        ref={toggle}
        type="button"
        className="-mr-2 inline-flex size-11 items-center justify-center rounded-[var(--pl-radius)] text-ink hover:bg-surface-2 md:hidden"
        aria-expanded={open}
        aria-controls="menu-piloto"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setOpen(!open)}
      >
        {open ? <Close size={22} /> : <Menu size={22} />}
      </button>
      {open && (
        <div
          id="menu-piloto"
          className="absolute inset-x-0 top-full border-b border-line bg-background px-4 pb-5 pt-2 shadow-[0_24px_40px_-24px_rgb(0_0_0/0.8)] animate-enter md:hidden"
        >
          <p className="truncate py-3 text-sm text-muted">{user.name}</p>
          <nav aria-label="Cuenta" className="flex flex-col">
            <NavLink href="/mis-reservas" className={drawerLinkClass} onClick={close}>
              Mis reservas
            </NavLink>
            <NavLink href="/perfil" className={drawerLinkClass} onClick={close}>
              Mi perfil
            </NavLink>
            {user.role !== "pilot" && (
              <Link href={getHomeForRole(user.role)} className={drawerLinkClass} onClick={close}>
                Mi panel
              </Link>
            )}
          </nav>
          <button type="button" onClick={handleSignOut} className={buttonClass({ variant: "secondary", block: true, className: "mt-4" })}>
            Cerrar sesión
          </button>
        </div>
      )}
    </>
  );
}

// Enlaces sin sesión. Conservan el ?next= de la página actual (p. ej. al pasar de registro a login).
// useSearchParams (y no window.location) para que se actualice al navegar sin recargar el layout.
function GuestLinks() {
  const nextPath = safeNextPath(useSearchParams().get("next"));
  return (
    <div className="flex items-center gap-3 sm:gap-6">
      <Link href={withNext("/login", nextPath)} className={headerLinkClass}>
        <span className="sm:hidden">Entrar</span>
        <span className="hidden sm:inline">Iniciar sesión</span>
      </Link>
      <Link href={withNext("/registro", nextPath)} className={buttonClass({ className: "min-h-10 whitespace-nowrap px-3" })}>
        Crear cuenta
      </Link>
    </div>
  );
}
