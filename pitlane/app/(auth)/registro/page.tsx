"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthField, AuthTitle, primaryButton } from "@/components/auth/ui";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "../errors";

type Errors = Partial<Record<"name" | "email" | "phone" | "password" | "confirm", string>>;

export default function RegistroPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    // Validaciones simples, una por campo.
    const next: Errors = {};
    if (!name) next.name = "Escribe tu nombre completo.";
    if (!email.includes("@")) next.email = "Escribe un correo válido.";
    if (phone.replace(/\D/g, "").length < 8) next.phone = "Escribe un teléfono de 8 dígitos.";
    if (password.length < 8) next.password = "Usa al menos 8 caracteres.";
    if (confirm !== password) next.confirm = "Las contraseñas no coinciden.";

    setErrors(next);
    setError("");
    if (Object.keys(next).length > 0) return;

    // full_name y phone van a user metadata; el trigger los copia a public.profiles.
    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, phone },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setError(translateAuthError(error));
      return;
    }

    // Guardamos el correo para que verificar-correo pueda reenviarlo.
    try {
      sessionStorage.setItem("pitlane:signup-email", email);
    } catch {
      // Sin sessionStorage, verificar-correo le pide el correo al usuario.
    }
    router.push("/verificar-correo");
  }

  return (
    <>
      <AuthTitle title="Crea tu cuenta" subtitle="La necesitas para reservar tu turno en pista." />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField label="Nombre completo" name="name" autoComplete="name" error={errors.name} />
        <AuthField label="Correo" name="email" type="email" autoComplete="email" error={errors.email} />
        <AuthField label="Teléfono" name="phone" type="tel" autoComplete="tel" error={errors.phone} />
        <AuthField label="Contraseña" name="password" type="password" autoComplete="new-password" error={errors.password} />
        <AuthField label="Confirma tu contraseña" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />

        {error && <p className="text-sm text-[#FF6B6B]">{error}</p>}

        <button type="submit" className={`${primaryButton} mt-2`}>
          Crear cuenta
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-[#A3A3A3]">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-[#F4F4F4] underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
