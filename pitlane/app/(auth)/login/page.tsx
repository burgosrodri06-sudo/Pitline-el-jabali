"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthField, AuthTitle, primaryButton } from "@/components/auth/ui";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "../errors";

// Solo acepta rutas internas ("/algo"), nunca "//otro-sitio.com" ni URLs completas.
function getNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/reservar";
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    if (!email || !password) {
      setError("Ingresa tu correo y tu contraseña.");
      return;
    }

    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(translateAuthError(error));
      return;
    }

    router.push(getNextPath());
    router.refresh();
  }

  return (
    <>
      <AuthTitle title="Inicia sesión" subtitle="Para continuar con tu reserva." />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField label="Correo" name="email" type="email" autoComplete="email" />
        <AuthField label="Contraseña" name="password" type="password" autoComplete="current-password" />

        {error && <p className="text-sm text-[#FF6B6B]">{error}</p>}

        <div className="text-right">
          <Link href="/recuperar" className="text-sm text-[#A3A3A3] underline">
            Olvidé mi contraseña
          </Link>
        </div>

        <button type="submit" className={primaryButton}>
          Iniciar sesión
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-[#A3A3A3]">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-[#F4F4F4] underline">
          Crea una
        </Link>
      </p>
    </>
  );
}
